import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useArsenal } from "@/src/features/arsenal/useArsenal";

const catalog = {
  entries: [
    {
      kind: "skill",
      id: "skill:tdd",
      path: "Arsenal/Skills/tdd/skill.md",
      name: "tdd",
      slug: "tdd",
      summary: "s",
      body: "b",
      deployed: [],
      templates: [],
    },
    {
      kind: "prompt",
      id: "prompt:R",
      path: "Knowledge/prompty/R.md",
      name: "R",
      summary: "r",
      body: "b",
      projects: [],
    },
  ],
  targets: [{ id: "p", name: "P", localPath: "~/p", owner: "personal", companyData: false }],
  skipped: 0,
};

const json = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

function setup(handler?: (url: string, init?: RequestInit) => Response) {
  const apiFetch = vi.fn(async (url: string, init?: RequestInit) =>
    handler ? handler(url, init) : json(catalog)
  );
  const hook = renderHook(() => useArsenal(apiFetch));
  return { apiFetch, ...hook };
}

describe("useArsenal", () => {
  it("ładuje katalog i zwraca wszystkie wpisy", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries.map((e) => e.id)).toEqual(["skill:tdd", "prompt:R"]);
    expect(result.current.targets).toHaveLength(1);
  });

  it("filtry zawężają listę", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setFilters({ ...result.current.filters, kind: "prompt" }));
    expect(result.current.entries.map((e) => e.id)).toEqual(["prompt:R"]);
  });

  it("domyślnie wybiera pierwszy widoczny wpis; wybór użytkownika ma pierwszeństwo", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.selected?.id).toBe("skill:tdd");
    act(() => result.current.setSelectedId("prompt:R"));
    expect(result.current.selected?.id).toBe("prompt:R");
  });

  it("gdy wybrany wpis wypadnie z filtra, wybiera pierwszy widoczny", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setSelectedId("skill:tdd"));
    act(() => result.current.setFilters({ ...result.current.filters, kind: "prompt" }));
    expect(result.current.selected?.id).toBe("prompt:R");
  });

  it("brak wpisów daje selected = null", async () => {
    const { result } = setup(() => json({ entries: [], targets: [], skipped: 0 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.selected).toBeNull();
  });

  it("błąd HTTP trafia do error z komunikatem serwera", async () => {
    const { result } = setup(() => json({ error: "Vault niedostępny" }, false, 500));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Vault niedostępny");
  });

  it("fetchInstructions woła trasę deploy z kodowanymi parametrami", async () => {
    const { result, apiFetch } = setup((url) =>
      url.includes("/deploy?") ? json({ mode: "full", text: "cmd" }) : json(catalog)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const out = await result.current.fetchInstructions("tdd", "p", "full");
    expect(out).toEqual({ mode: "full", text: "cmd" });
    expect(apiFetch).toHaveBeenCalledWith("/api/arsenal/skills/tdd/deploy?project=p&mode=full");
  });

  it("markDeployed wysyła POST i przeładowuje katalog", async () => {
    const { result, apiFetch } = setup((_url, init) =>
      init?.method === "POST" ? json({}) : json(catalog)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.markDeployed("tdd", "p", "full");
    });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/arsenal/skills/tdd/deployed",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ project: "p", mode: "full" }),
      })
    );
    const gets = apiFetch.mock.calls.filter(([url]) => url === "/api/arsenal");
    expect(gets).toHaveLength(2);
  });

  it("błąd odświeżenia po zapisie odrzuca markDeployed, ale nie zastępuje widoku błędem", async () => {
    let gets = 0;
    const { result } = setup((_url, init) => {
      if (init?.method === "POST") return json({});
      gets += 1;
      return gets === 1 ? json(catalog) : json({ error: "pad" }, false, 500);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await expect(result.current.markDeployed("tdd", "p", "full")).rejects.toThrow(
        /nie udało się odświeżyć/i
      );
    });
    expect(result.current.error).toBeNull();
    expect(result.current.entries).toHaveLength(2);
  });
});
