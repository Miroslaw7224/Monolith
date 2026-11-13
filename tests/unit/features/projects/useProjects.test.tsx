import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ProjectDetailDto,
  ProjectSummaryDto,
  StateInputDto,
} from "@/contexts/bc_projects/schemas";
import { useProjects } from "@/src/features/projects/useProjects";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function summary(
  partial: Partial<ProjectSummaryDto> & Pick<ProjectSummaryDto, "id">
): ProjectSummaryDto {
  return {
    name: partial.id,
    status: "active",
    priority: "P2",
    localPath: `/tmp/${partial.id}`,
    owner: "personal",
    freshness: "fresh",
    ...partial,
  };
}

function detail(
  partial: Partial<ProjectDetailDto> & Pick<ProjectDetailDto, "id">
): ProjectDetailDto {
  return {
    ...summary(partial),
    tasks: [],
    board: { blockers: [], now: [], next: [], icebox: [], version: null },
    bugs: [],
    whereIStopped: null,
    state: null,
    stateVersion: null,
    devlog: [],
    ...partial,
  };
}

describe("useProjects", () => {
  it("błąd", async () => {
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") {
        return new Response(JSON.stringify({ error: "Brak NEXUS_VAULT_PATH" }), { status: 500 });
      }
      return new Response("{}", { status: 404 });
    });

    const { result } = renderHook(() => useProjects(apiFetch));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Brak NEXUS_VAULT_PATH");
  });

  it("domyślny wybór i przełączanie", async () => {
    const a = summary({ id: "a" });
    const b = summary({ id: "b" });
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") {
        return new Response(JSON.stringify({ projects: [a, b], warnings: [] }), { status: 200 });
      }
      if (url === "/api/projects/a") {
        return new Response(JSON.stringify(detail({ id: "a", name: "A" })), { status: 200 });
      }
      if (url === "/api/projects/b") {
        return new Response(JSON.stringify(detail({ id: "b", name: "B" })), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const { result } = renderHook(() => useProjects(apiFetch));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.selectedId).toBe("a");
    expect(apiFetch).toHaveBeenCalledWith("/api/projects");
    await waitFor(() =>
      expect(apiFetch.mock.calls.some((c) => c[0] === "/api/projects/a")).toBe(true)
    );

    act(() => {
      result.current.select("b");
    });
    await waitFor(() => expect(result.current.selectedId).toBe("b"));
    await waitFor(() =>
      expect(apiFetch.mock.calls.some((c) => c[0] === "/api/projects/b")).toBe(true)
    );
    await waitFor(() => expect(result.current.detail?.id).toBe("b"));
  });

  it("błąd szczegółów", async () => {
    const a = summary({ id: "a" });
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") {
        return new Response(JSON.stringify({ projects: [a], warnings: [] }), { status: 200 });
      }
      if (url === "/api/projects/a") {
        return new Response(JSON.stringify({ error: "Nie ma projektu o id a" }), { status: 404 });
      }
      return new Response("{}", { status: 404 });
    });

    const { result } = renderHook(() => useProjects(apiFetch));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    await waitFor(() => expect(result.current.detailError).toBe("Nie ma projektu o id a"));
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.detail).toBeNull();
  });

  it("nieaktualna odpowiedź", async () => {
    const a = summary({ id: "a" });
    const b = summary({ id: "b" });
    let resolveA!: (value: Response) => void;
    const aPromise = new Promise<Response>((resolve) => {
      resolveA = resolve;
    });

    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") {
        return new Response(JSON.stringify({ projects: [a, b], warnings: [] }), { status: 200 });
      }
      if (url === "/api/projects/a") {
        return aPromise;
      }
      if (url === "/api/projects/b") {
        return new Response(JSON.stringify(detail({ id: "b", name: "B" })), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const { result } = renderHook(() => useProjects(apiFetch));

    await waitFor(() => expect(result.current.selectedId).toBe("a"));
    await waitFor(() =>
      expect(apiFetch.mock.calls.some((c) => c[0] === "/api/projects/a")).toBe(true)
    );

    act(() => {
      result.current.select("b");
    });
    await waitFor(() => expect(result.current.detail?.id).toBe("b"));

    await act(async () => {
      resolveA(new Response(JSON.stringify(detail({ id: "a", name: "A late" })), { status: 200 }));
    });

    expect(result.current.detail?.id).toBe("b");
  });

  it("odrzucony fetch listy kończy się błędem, nie wiecznym ładowaniem", async () => {
    const apiFetch = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });
    const { result } = renderHook(() => useProjects(apiFetch));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Failed to fetch");
  });
});

describe("useProjects: zapisy", () => {
  const INPUT: StateInputDto = {
    branch: "main",
    env: "",
    blocker: "",
    nextStep: "",
    links: [],
    milestone: "",
    milestoneDue: "",
    version: null,
  };
  const JSON_HEADERS = { "content-type": "application/json" };

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
  }

  /** Lista [a(stale)], GET a → `initial`; `onWrite` obsługuje żądania z `options`. */
  function setup(
    onWrite: (url: string, options: RequestInit) => Response | Promise<Response>,
    initial: ProjectDetailDto = detail({ id: "a" }),
    extra: ProjectSummaryDto[] = []
  ) {
    const apiFetch = vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method && options.method !== "GET") return onWrite(url, options);
      if (url === "/api/projects") {
        return json({
          projects: [summary({ id: "a", freshness: "stale" }), ...extra],
          warnings: [],
        });
      }
      if (url === "/api/projects/a") return json(initial);
      if (url === "/api/projects/b") return json(detail({ id: "b", name: "B" }));
      return json({}, 404);
    });
    const hook = renderHook(() => useProjects(apiFetch));
    return { apiFetch, ...hook };
  }

  it("saveState: PUT, detail i świeżość listy z odpowiedzi", async () => {
    const { apiFetch, result } = setup(() =>
      json(detail({ id: "a", stateVersion: "5:h", freshness: "fresh" }))
    );
    await waitFor(() => expect(result.current.detail?.id).toBe("a"));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.saveState(INPUT);
    });

    expect(outcome).toEqual({ ok: true });
    expect(apiFetch).toHaveBeenCalledWith("/api/projects/a/state", {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(INPUT),
    });
    expect(result.current.detail?.stateVersion).toBe("5:h");
    expect(result.current.projects[0].freshness).toBe("fresh");
  });

  it("409: błąd z konfliktem, detail bez zmian", async () => {
    const { result } = setup(() => json({ error: "Plik zmienił się" }, 409));
    await waitFor(() => expect(result.current.detail?.id).toBe("a"));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.saveState(INPUT);
    });
    expect(outcome).toEqual({ ok: false, error: "Plik zmienił się", conflict: true });
    expect(result.current.detail?.stateVersion).toBeNull();
  });

  it("500 bez JSON", async () => {
    const { result } = setup(() => new Response("oops", { status: 500 }));
    await waitFor(() => expect(result.current.detail?.id).toBe("a"));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.saveState(INPUT);
    });
    expect(outcome).toEqual({ ok: false, error: "HTTP 500", conflict: false });
  });

  it("400 z details: komunikat zawiera nazwy niepoprawnych pól", async () => {
    const { result } = setup(() =>
      json({ error: "Validation failed", details: { links: ["x"], branch: ["y"] } }, 400)
    );
    await waitFor(() => expect(result.current.detail?.id).toBe("a"));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.saveState(INPUT);
    });
    expect(outcome).toEqual({
      ok: false,
      error: "Validation failed: links, branch",
      conflict: false,
    });
  });

  it("wyjątek sieci", async () => {
    const { result } = setup(() => {
      throw new Error("Failed to fetch");
    });
    await waitFor(() => expect(result.current.detail?.id).toBe("a"));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.saveState(INPUT);
    });
    expect(outcome).toEqual({ ok: false, error: "Failed to fetch", conflict: false });
  });

  it("spóźniona odpowiedź po zmianie projektu nie nadpisuje szczegółów", async () => {
    let resolveWrite!: (r: Response) => void;
    const pending = new Promise<Response>((r) => (resolveWrite = r));
    const { result } = setup(() => pending, detail({ id: "a" }), [summary({ id: "b" })]);
    await waitFor(() => expect(result.current.detail?.id).toBe("a"));

    let outcome: Promise<unknown> | undefined;
    act(() => {
      outcome = result.current.saveState(INPUT);
    });
    act(() => {
      result.current.select("b");
    });
    await waitFor(() => expect(result.current.detail?.id).toBe("b"));

    await act(async () => {
      resolveWrite(json(detail({ id: "a", name: "A po zapisie", stateVersion: "7:x" })));
      await outcome;
    });
    expect(result.current.detail?.id).toBe("b");
  });

  it("addDevlogEntry: POST /devlog; setType: PATCH z {type}", async () => {
    const { apiFetch, result } = setup((url) =>
      json(detail({ id: "a", type: url.endsWith("/devlog") ? undefined : "wlasny" }), 200)
    );
    await waitFor(() => expect(result.current.detail?.id).toBe("a"));

    await act(async () => {
      await result.current.addDevlogEntry({ title: "T", why: "W" });
    });
    expect(apiFetch).toHaveBeenCalledWith("/api/projects/a/devlog", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ title: "T", why: "W" }),
    });

    await act(async () => {
      await result.current.setType("wlasny");
    });
    expect(apiFetch).toHaveBeenCalledWith("/api/projects/a", {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ type: "wlasny" }),
    });
    expect(result.current.detail?.type).toBe("wlasny");
    expect(result.current.projects[0].type).toBe("wlasny");
  });

  it("reloadDetail nie czyści detail w trakcie przeładowania (szkice w teczce nie znikają)", async () => {
    let resolveSecond!: (r: Response) => void;
    let calls = 0;
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") return json({ projects: [summary({ id: "a" })], warnings: [] });
      calls += 1;
      if (calls === 1) return json(detail({ id: "a", name: "wersja 1" }));
      return new Promise<Response>((r) => (resolveSecond = r));
    });
    const { result } = renderHook(() => useProjects(apiFetch));
    await waitFor(() => expect(result.current.detail?.name).toBe("wersja 1"));
    act(() => {
      result.current.reloadDetail();
    });
    await waitFor(() => expect(calls).toBe(2));
    expect(result.current.detail?.name).toBe("wersja 1");
    await act(async () => resolveSecond(json(detail({ id: "a", name: "wersja 2" }))));
    expect(result.current.detail?.name).toBe("wersja 2");
  });

  it("select() i zapis w tym samym ticku trafiają do nowo wybranego projektu", async () => {
    const { apiFetch, result } = setup(
      (url) => json(detail({ id: url.split("/")[3] })),
      detail({ id: "a" }),
      [summary({ id: "b" })]
    );
    await waitFor(() => expect(result.current.detail?.id).toBe("a"));
    await act(async () => {
      result.current.select("b");
      await result.current.saveState(INPUT);
    });
    expect(apiFetch).toHaveBeenCalledWith("/api/projects/b/state", expect.anything());
  });

  it("reloadDetail: ponowny GET szczegółów", async () => {
    let calls = 0;
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") return json({ projects: [summary({ id: "a" })], warnings: [] });
      calls += 1;
      return json(detail({ id: "a", name: `wersja ${calls}` }));
    });
    const { result } = renderHook(() => useProjects(apiFetch));
    await waitFor(() => expect(result.current.detail?.name).toBe("wersja 1"));
    act(() => {
      result.current.reloadDetail();
    });
    await waitFor(() => expect(result.current.detail?.name).toBe("wersja 2"));
  });
  it("loadContextPack: pobiera paczkę wybranego projektu", async () => {
    const a = summary({ id: "a" });
    const pack = { markdown: "# A", approxTokens: 1, truncated: false, warnings: [] };
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") {
        return new Response(JSON.stringify({ projects: [a], warnings: [] }), { status: 200 });
      }
      if (url === "/api/projects/a") {
        return new Response(JSON.stringify(detail({ id: "a" })), { status: 200 });
      }
      if (url === "/api/projects/a/context-pack") {
        return new Response(JSON.stringify(pack), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const { result } = renderHook(() => useProjects(apiFetch));
    await waitFor(() => expect(result.current.detail?.id).toBe("a"));

    let outcome: Awaited<ReturnType<typeof result.current.loadContextPack>> | undefined;
    await act(async () => {
      outcome = await result.current.loadContextPack();
    });

    expect(outcome).toEqual({ ok: true, pack });
    expect(apiFetch).toHaveBeenCalledWith("/api/projects/a/context-pack");
  });

  it("loadContextPack: błąd serwera", async () => {
    const a = summary({ id: "a" });
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") {
        return new Response(JSON.stringify({ projects: [a], warnings: [] }), { status: 200 });
      }
      if (url === "/api/projects/a") {
        return new Response(JSON.stringify(detail({ id: "a" })), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "Nie ma projektu o id a" }), { status: 404 });
    });

    const { result } = renderHook(() => useProjects(apiFetch));
    await waitFor(() => expect(result.current.detail?.id).toBe("a"));

    let outcome: Awaited<ReturnType<typeof result.current.loadContextPack>> | undefined;
    await act(async () => {
      outcome = await result.current.loadContextPack();
    });

    expect(outcome).toEqual({ ok: false, error: "Nie ma projektu o id a" });
  });
});
