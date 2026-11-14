import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNexusDoc, useNexusDocs } from "@/src/features/notes/useNexusDocs";

afterEach(() => cleanup());

const json = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

const LIST = [{ path: "Knowledge/a.md", area: "Knowledge", group: "", title: "A", tags: [] }];

describe("useNexusDocs", () => {
  it("pobiera listę z /api/nexus-docs", async () => {
    const apiFetch = vi.fn(async () => json(LIST));
    const { result } = renderHook(() => useNexusDocs(apiFetch));
    await waitFor(() => expect(result.current.docs).toHaveLength(1));
    expect(apiFetch).toHaveBeenCalledWith("/api/nexus-docs");
    expect(result.current.error).toBeNull();
  });

  it("bez apiFetch nic nie pobiera", () => {
    const { result } = renderHook(() => useNexusDocs(undefined));
    expect(result.current.docs).toEqual([]);
  });

  it("błąd odpowiedzi daje pustą listę i komunikat", async () => {
    const apiFetch = vi.fn(async () => json({ error: "x" }, false));
    const { result } = renderHook(() => useNexusDocs(apiFetch));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.docs).toEqual([]);
  });
});

describe("useNexusDoc", () => {
  const DOC = { ...LIST[0], frontmatter: [], body: "treść" };

  it("pobiera dokument, kodując segmenty ścieżki", async () => {
    const apiFetch = vi.fn(async () => json({ ...DOC, path: "Knowledge/a b.md" }));
    const { result } = renderHook(() => useNexusDoc(apiFetch, "Knowledge/a b.md"));
    await waitFor(() => expect(result.current.doc).not.toBeNull());
    expect(apiFetch).toHaveBeenCalledWith("/api/nexus-docs/Knowledge/a%20b.md");
    expect(result.current.loading).toBe(false);
  });

  it("brak ścieżki: nic nie pobiera", () => {
    const apiFetch = vi.fn(async () => json(DOC));
    const { result } = renderHook(() => useNexusDoc(apiFetch, null));
    expect(result.current.doc).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("404 daje komunikat błędu", async () => {
    const apiFetch = vi.fn(async () => json({ error: "nie ma" }, false));
    const { result } = renderHook(() => useNexusDoc(apiFetch, "Knowledge/x.md"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.doc).toBeNull();
  });
});
