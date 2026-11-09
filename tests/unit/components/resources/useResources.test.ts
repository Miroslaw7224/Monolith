import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useResources } from "@/src/components/resources/useResources";

const apiFetch = vi.fn();

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
  const { result } = renderHook(() => useResources(apiFetch, {}));

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
  const { result } = renderHook(() => useResources(apiFetch, {}));

  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => {
    result.current.setAddDescription("Notatka");
  });

  await act(async () => {
    await result.current.handleAdd();
  });

  expect(apiFetch.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false);
});
