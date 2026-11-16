import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetailDto } from "@/contexts/bc_projects/schemas";
import { useCodeSync } from "@/src/features/projects/useCodeSync";

afterEach(cleanup);

const HEAD = "a".repeat(40);
const json = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

describe("useCodeSync", () => {
  it("nie woła API, dopóki lista nie jest gotowa", () => {
    const apiFetch = vi.fn();
    renderHook(() => useCodeSync(apiFetch, false, null));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("pobiera mapę po gotowej liście", async () => {
    const apiFetch = vi.fn().mockReturnValue(json({ codeSync: { a: { status: "no-baseline" } } }));
    const { result } = renderHook(() => useCodeSync(apiFetch, true, null));
    await waitFor(() => expect(result.current).toEqual({ a: { status: "no-baseline" } }));
    expect(apiFetch).toHaveBeenCalledWith("/api/projects/code-sync");
  });

  it("błąd sieci albo HTTP: pusta mapa, bez wyjątku", async () => {
    const apiFetch = vi.fn().mockReturnValue(json({}, false));
    const { result } = renderHook(() => useCodeSync(apiFetch, true, null));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(result.current).toEqual({});
    const failing = vi.fn().mockRejectedValue(new Error("offline"));
    const second = renderHook(() => useCodeSync(failing, true, null));
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(second.result.current).toEqual({});
  });

  it("spóźniona mapa nie nadpisuje świeższego wpisu ze szczegółów", async () => {
    let resolve: (r: Response) => void = () => {};
    const apiFetch = vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const detail = { id: "a", codeSync: { status: "current", head: HEAD } } as ProjectDetailDto;
    const { result, rerender } = renderHook(
      ({ d }: { d: ProjectDetailDto | null }) => useCodeSync(apiFetch, true, d),
      { initialProps: { d: null as ProjectDetailDto | null } }
    );
    rerender({ d: detail });
    await waitFor(() => expect(result.current.a).toEqual({ status: "current", head: HEAD }));
    resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          codeSync: { a: { status: "no-baseline" }, b: { status: "unknown-sha" } },
        }),
    } as Response);
    await waitFor(() => expect(result.current.b).toEqual({ status: "unknown-sha" }));
    expect(result.current.a).toEqual({ status: "current", head: HEAD });
  });

  it("codeSync ze szczegółów wybranego projektu nadpisuje wpis w mapie", async () => {
    const apiFetch = vi.fn().mockReturnValue(json({ codeSync: { a: { status: "no-baseline" } } }));
    const detail = { id: "a", codeSync: { status: "current", head: HEAD } } as ProjectDetailDto;
    const { result, rerender } = renderHook(
      ({ d }: { d: ProjectDetailDto | null }) => useCodeSync(apiFetch, true, d),
      { initialProps: { d: null as ProjectDetailDto | null } }
    );
    await waitFor(() => expect(result.current.a).toEqual({ status: "no-baseline" }));
    rerender({ d: detail });
    await waitFor(() => expect(result.current.a).toEqual({ status: "current", head: HEAD }));
  });
});
