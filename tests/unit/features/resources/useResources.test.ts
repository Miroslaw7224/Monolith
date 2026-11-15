import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useResources } from "@/src/features/resources/useResources";

const apiFetch = vi.fn();

afterEach(cleanup);

beforeEach(() => {
  apiFetch.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === "/api/resources" && options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      return {
        ok: true,
        json: async () => ({
          id: "r1",
          description: body.description,
          url: body.url,
          tags: body.tags,
          title: "Example",
        }),
      };
    }
    return { ok: true, json: async () => [] };
  });
});

test("handleAdd posts the trimmed resource and prepends it", async () => {
  const { result } = renderHook(() => useResources(apiFetch));

  await waitFor(() => expect(result.current.loading).toBe(false));

  act(() => {
    result.current.setAddDescription("  Notatka  ");
    result.current.setAddUrl(" https://example.com ");
    result.current.setAddTags("a, b");
  });

  await act(async () => {
    await result.current.handleAdd();
  });

  expect(apiFetch).toHaveBeenCalledWith("/api/resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: "Notatka",
      url: "https://example.com",
      tags: ["a", "b"],
    }),
  });
  expect(result.current.resources[0]).toMatchObject({
    id: "r1",
    description: "Notatka",
    url: "https://example.com",
  });
  expect(result.current.addDescription).toBe("");
  expect(result.current.addUrl).toBe("");
});

test("handleAdd does not post when the url is empty", async () => {
  const { result } = renderHook(() => useResources(apiFetch));

  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => {
    result.current.setAddDescription("Notatka");
  });

  await act(async () => {
    await result.current.handleAdd();
  });

  expect(apiFetch.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false);
});

test("tagCounts liczy tagi wczytanych zasobów", async () => {
  apiFetch.mockImplementation(async () => ({
    ok: true,
    json: async () => [
      { id: "1", description: "", url: "https://a", title: "A", tags: ["x", "y"] },
      { id: "2", description: "", url: "https://b", title: "B", tags: ["x"] },
    ],
  }));
  const { result } = renderHook(() => useResources(apiFetch));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.tagCounts).toEqual([
    { tag: "x", count: 2 },
    { tag: "y", count: 1 },
  ]);
});

test("toggleFixOnly zawęża listę do zasobów do poprawy", async () => {
  apiFetch.mockImplementation(async () => ({
    ok: true,
    json: async () => [
      {
        id: "ok",
        description: "",
        url: "https://a",
        title: "A",
        tags: [],
        thumbnailUrl: "https://i",
      },
      {
        id: "bad",
        description: "",
        url: "https://b",
        title: "Just a moment...",
        tags: [],
        thumbnailUrl: "https://i",
      },
    ],
  }));
  const { result } = renderHook(() => useResources(apiFetch));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.fixCount).toBe(1);
  act(() => result.current.toggleFixOnly());
  expect(result.current.filteredResources.map((r) => r.id)).toEqual(["bad"]);
  act(() => result.current.clearTagFilter());
  expect(result.current.fixOnly).toBe(false);
  // Bez ulubionych sortowanie jest stabilne: kolejność wejściowa.
  expect(result.current.filteredResources.map((r) => r.id)).toEqual(["ok", "bad"]);
});

test("formularz dodawania jest domyślnie zwinięty", async () => {
  const { result } = renderHook(() => useResources(apiFetch));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.formExpanded).toBe(false);
});

test("dense zapamiętuje wybór w localStorage", async () => {
  localStorage.removeItem("monolith.resources.dense");
  const { result } = renderHook(() => useResources(apiFetch));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.dense).toBe(false);
  act(() => result.current.setDense(true));
  expect(localStorage.getItem("monolith.resources.dense")).toBe("1");
  const again = renderHook(() => useResources(apiFetch));
  await waitFor(() => expect(again.result.current.dense).toBe(true));
});

test("handleSaveEdit: odpowiedź bez notePath usuwa stary notePath zasobu", async () => {
  const original = {
    id: "e1",
    description: "",
    url: "https://a.example",
    title: "A",
    tags: [],
    notePath: "Knowledge/a.md",
  };
  apiFetch.mockImplementation(async (url: string, options?: RequestInit) => {
    if (options?.method === "PUT") {
      return {
        ok: true,
        json: async () => ({
          id: "e1",
          description: "",
          url: "https://b.example",
          title: "A",
          tags: [],
        }),
      };
    }
    return { ok: true, json: async () => [original] };
  });
  const { result } = renderHook(() => useResources(apiFetch));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.resources[0].notePath).toBe("Knowledge/a.md");
  act(() => result.current.openEditModal(result.current.resources[0]));
  await act(async () => {
    await result.current.handleSaveEdit();
  });
  expect(result.current.resources[0].url).toBe("https://b.example");
  expect(result.current.resources[0].notePath).toBeUndefined();
});
