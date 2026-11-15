import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAgents } from "@/src/features/arsenal/useAgents";

const overview = {
  agents: [{ kind: "agent", id: "a1", name: "agy", role: "Review" }],
  presets: [],
  scripts: [],
  skipped: 1,
};
const json = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

function setup(handler?: (url: string, init?: RequestInit) => Response) {
  const apiFetch = vi.fn(async (url: string, init?: RequestInit) =>
    handler ? handler(url, init) : json(overview)
  );
  return { apiFetch, ...renderHook(() => useAgents(apiFetch)) };
}

const input = { kind: "preset" as const, name: "P", command: "cmd" };

describe("useAgents", () => {
  it("ładuje trzy sekcje i licznik pominiętych", async () => {
    const { result, apiFetch } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiFetch).toHaveBeenCalledWith("/api/arsenal/agents");
    expect(result.current.agents.map((a) => a.id)).toEqual(["a1"]);
    expect(result.current.presets).toEqual([]);
    expect(result.current.skipped).toBe(1);
  });

  it("błąd ładowania trafia do `error`", async () => {
    const { result } = setup(() => json({ error: "Zepsute" }, false, 500));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Zepsute");
  });

  it("save bez id robi POST, z id robi PUT, potem odświeża listę", async () => {
    const { result, apiFetch } = setup((_url, init) => json(init?.method ? {} : overview));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.save(input));
    const post = apiFetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe("/api/arsenal/agents");
    expect(JSON.parse(post[1]!.body as string)).toEqual(input);
    await act(() => result.current.save(input, "a1"));
    expect(
      apiFetch.mock.calls.some(
        ([url, init]) => url === "/api/arsenal/agents/a1" && init?.method === "PUT"
      )
    ).toBe(true);
    expect(apiFetch.mock.calls.filter(([, init]) => init === undefined)).toHaveLength(3);
  });

  it("save przy błędzie serwera rzuca z komunikatem serwera", async () => {
    const { result } = setup((_url, init) =>
      init?.method === "POST" ? json({ error: "Brak roli" }, false, 400) : json(overview)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(act(() => result.current.save(input))).rejects.toThrow("Brak roli");
  });

  it("remove robi DELETE i odświeża listę", async () => {
    const { result, apiFetch } = setup((_url, init) =>
      init?.method === "DELETE" ? ({ ok: true, status: 204 } as Response) : json(overview)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.remove("a1"));
    expect(
      apiFetch.mock.calls.some(
        ([url, init]) => url === "/api/arsenal/agents/a1" && init?.method === "DELETE"
      )
    ).toBe(true);
  });

  it("save pokazuje pierwszy komunikat walidacji pola z odpowiedzi 400", async () => {
    const { result } = setup((_url, init) =>
      init?.method === "POST"
        ? json({ error: "Validation failed", details: { role: ["Required"] } }, false, 400)
        : json(overview)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(act(() => result.current.save(input))).rejects.toThrow(
      "Validation failed: Required"
    );
  });

  it("zapis się udał, a odświeżenie padło: save nie rzuca (brak duplikatu przy ponownym zapisie)", async () => {
    let posted = false;
    const { result } = setup((_url, init) => {
      if (init?.method === "POST") {
        posted = true;
        return json({});
      }
      return posted ? json({ error: "Odświeżenie padło" }, false, 500) : json(overview);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.save(input));
    expect(result.current.error).toBe("Odświeżenie padło");
  });
});
