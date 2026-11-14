import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInboxOpen } from "@/src/features/notes/useInboxOpen";

afterEach(() => cleanup());

const json = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

describe("useInboxOpen", () => {
  it("zwraca liczbę otwartych wpisów z /api/inbox", async () => {
    const apiFetch = vi.fn(async () => json({ items: [], open: 5, closed: 2 }));
    const { result } = renderHook(() => useInboxOpen(apiFetch, true));
    await waitFor(() => expect(result.current).toBe(5));
    expect(apiFetch).toHaveBeenCalledWith("/api/inbox");
  });

  it("nie pyta o Inbox, gdy wyłączony", () => {
    const apiFetch = vi.fn(async () => json({ open: 1 }));
    const { result } = renderHook(() => useInboxOpen(apiFetch, false));
    expect(result.current).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("błąd odpowiedzi daje null", async () => {
    const apiFetch = vi.fn(async () => json({ error: "x" }, false));
    const { result } = renderHook(() => useInboxOpen(apiFetch, true));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
