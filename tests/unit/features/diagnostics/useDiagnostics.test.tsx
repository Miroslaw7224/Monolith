import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useDiagnostics } from "@/src/features/diagnostics/useDiagnostics";

const BODY = {
  generatedAt: "2026-11-17T10:00:00.000Z",
  sources: { wsl: { ok: true }, windows: { ok: true } },
  ports: [],
  groups: [],
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("useDiagnostics", () => {
  it("pobiera przy montowaniu i woła właściwy adres", async () => {
    const apiFetch = vi.fn().mockResolvedValue(json(BODY));
    const { result } = renderHook(() => useDiagnostics(apiFetch));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(BODY));
    expect(apiFetch).toHaveBeenCalledWith("/api/diagnostics/ports");
    expect(result.current.loading).toBe(false);
  });

  it("błąd HTTP ustawia error, a odświeżenie z błędem zostawia ostatnie dane", async () => {
    const apiFetch = vi
      .fn()
      .mockResolvedValueOnce(json(BODY))
      .mockResolvedValueOnce(json({ error: "zepsute" }, 500));
    const { result } = renderHook(() => useDiagnostics(apiFetch));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBe("zepsute");
    expect(result.current.data).toEqual(BODY);
  });

  it("odpowiedź niezgodna ze schematem to błąd", async () => {
    const apiFetch = vi.fn().mockResolvedValue(json({ ports: "x" }));
    const { result } = renderHook(() => useDiagnostics(apiFetch));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toBeNull();
  });

  it("udane odświeżenie czyści poprzedni błąd", async () => {
    const apiFetch = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "x" }, 500))
      .mockResolvedValueOnce(json(BODY));
    const { result } = renderHook(() => useDiagnostics(apiFetch));
    await waitFor(() => expect(result.current.error).toBe("x"));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(BODY);
  });
});
