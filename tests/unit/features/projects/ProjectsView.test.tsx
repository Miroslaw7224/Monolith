import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetailDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";
import { ProjectsView } from "@/src/features/projects/ProjectsView";

afterEach(() => cleanup());

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

function packResponse(): Response {
  const pack = {
    markdown: "# P\n\n## Save State\n\nx",
    approxTokens: 3850,
    truncated: false,
    warnings: [],
  };
  return new Response(JSON.stringify(pack), { status: 200 });
}

function listResponse(projects: ProjectSummaryDto[], warnings: string[] = []): Response {
  return new Response(JSON.stringify({ projects, warnings }), { status: 200 });
}

function makeApiFetch(
  projects: ProjectSummaryDto[],
  details: Record<string, ProjectDetailDto | Response>,
  warnings: string[] = []
) {
  return vi.fn(async (url: string) => {
    if (url === "/api/projects") return listResponse(projects, warnings);
    if (url.endsWith("/context-pack")) return packResponse();
    const prefix = "/api/projects/";
    if (url.startsWith(prefix)) {
      const id = decodeURIComponent(url.slice(prefix.length));
      const value = details[id];
      if (value instanceof Response) return value;
      if (value) return new Response(JSON.stringify(value), { status: 200 });
      return new Response(JSON.stringify({ error: `Nie ma projektu o id ${id}` }), {
        status: 404,
      });
    }
    return new Response("{}", { status: 404 });
  });
}

describe("ProjectsView", () => {
  it("ładowanie", () => {
    const apiFetch = vi.fn(() => new Promise<Response>(() => {}));
    render(<ProjectsView apiFetch={apiFetch} />);
    expect(screen.getByText("Ładowanie…")).toBeInTheDocument();
  });

  it("pusto", async () => {
    const apiFetch = makeApiFetch([], {});
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByText("Brak projektów w rejestrze")).toBeInTheDocument();
    });
  });

  it("ostrzeżenia", async () => {
    const a = summary({ id: "a" });
    const apiFetch = makeApiFetch([a], { a: detail({ id: "a" }) }, ["b: boom"]);
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("b: boom");
    });
  });

  it("stale i done", async () => {
    const a = summary({ id: "a", freshness: "stale" });
    const c = summary({ id: "c", status: "done" });
    const apiFetch = makeApiFetch([a, c], {
      a: detail({ id: "a", freshness: "stale" }),
      c: detail({ id: "c", status: "done" }),
    });
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(itemButton("a")).toHaveClass("prj-item--stale");
    });
    const items = screen.getAllByRole("listitem");
    expect(items.at(-1)).toHaveTextContent("c");
    expect(itemButton("c")).toHaveClass("prj-item--done");
  });

  it("bugi", async () => {
    const a = summary({ id: "a" });
    const apiFetch = makeApiFetch([a], {
      a: detail({
        id: "a",
        bugs: [
          { id: "GP-001", title: "porty", section: "Aktywne", priority: "high", status: "open" },
          { id: "EA-001", title: "stary", section: "Zamknięte" },
        ],
      }),
    });
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByText("GP-001")).toBeInTheDocument();
    });
    expect(screen.queryByText("EA-001")).not.toBeInTheDocument();
    expect(screen.getByText("Zamknięte: 1")).toBeInTheDocument();
  });

  it("linki tylko http(s): inny protokół jako zwykły tekst", async () => {
    const a = summary({ id: "a", github: "javascript:alert(1)", deploy: "https://example.com" });
    const apiFetch = makeApiFetch([a], {
      a: detail({ id: "a", github: "javascript:alert(1)", deploy: "https://example.com" }),
    });
    render(<ProjectsView apiFetch={apiFetch} />);
    const deploy = await screen.findByRole("link", { name: "Dev: example.com" });
    expect(deploy).toHaveAttribute("href", "https://example.com");
    expect(screen.queryByRole("link", { name: /Repo/ })).not.toBeInTheDocument();
    expect(screen.getByText("Repo: javascript:alert(1)")).toBeInTheDocument();
  });

  it("same zamknięte bugi: licznik bez pustej listy", async () => {
    const a = summary({ id: "a" });
    const apiFetch = makeApiFetch([a], {
      a: detail({ id: "a", bugs: [{ id: "EA-001", title: "stary", section: "Zamknięte" }] }),
    });
    const { container } = render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByText("Zamknięte: 1")).toBeInTheDocument();
    });
    expect(container.querySelector("ul.prj-bugs")).toBeNull();
  });

  it("brak bugów", async () => {
    const a = summary({ id: "a" });
    const apiFetch = makeApiFetch([a], { a: detail({ id: "a", bugs: [] }) });
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByText("Brak bugów")).toBeInTheDocument();
    });
  });

  it("Gdzie skończyłem", async () => {
    const a = summary({ id: "a" });
    const apiFetch = makeApiFetch([a], { a: detail({ id: "a", whereIStopped: "Koniec X." }) });
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(screen.getByText("Koniec X.")).toBeInTheDocument();
    });
  });

  it("znacznik „Dane z firmy” tylko dla owner work", async () => {
    const w = summary({ id: "w", owner: "work" });
    const p = summary({ id: "p" });
    const apiFetch = makeApiFetch([w, p], {
      w: detail({ id: "w", owner: "work" }),
      p: detail({ id: "p" }),
    });
    render(<ProjectsView apiFetch={apiFetch} />);
    await screen.findByText("w", { selector: ".prj-item__name" });
    await userEvent.click(itemMain("w"));
    const workCard = await screen.findByRole("region", { name: "Teczka projektu w" });
    expect(within(workCard).getByText("Dane z firmy")).toBeInTheDocument();
    await userEvent.click(itemMain("p"));
    const personalCard = await screen.findByRole("region", { name: "Teczka projektu p" });
    expect(within(personalCard).queryByText("Dane z firmy")).not.toBeInTheDocument();
  });

  it("kafle statystyk, filtr rejestru, chip Firma i alert przy stale", async () => {
    const a = summary({ id: "alfa", freshness: "stale" });
    const b = summary({ id: "beta", owner: "work" });
    const apiFetch = makeApiFetch([a, b], {
      alfa: detail({ id: "alfa", freshness: "stale" }),
      beta: detail({ id: "beta", owner: "work" }),
    });
    render(<ProjectsView apiFetch={apiFetch} />);
    const tiles = await screen.findByRole("region", { name: "Statystyki projektów" });
    expect(within(tiles).getByText("Aktywne projekty")).toBeInTheDocument();
    expect(within(tiles).getByText("Wymaga decyzji (>14 dni)")).toBeInTheDocument();
    expect(screen.getByText("Firma")).toBeInTheDocument();
    expect(screen.getByText(/Brak zmian od ponad 14 dni/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Filtruj projekty"), "bet");
    expect(screen.queryByText("alfa", { selector: ".prj-item__name" })).not.toBeInTheDocument();
    expect(screen.getByText("beta", { selector: ".prj-item__name" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Filtruj projekty"), "zzz");
    expect(screen.getByText("Brak projektów pasujących do filtra")).toBeInTheDocument();
  });

  it("wybrany element", async () => {
    const a = summary({ id: "a" });
    const b = summary({ id: "b" });
    const apiFetch = makeApiFetch([a, b], { a: detail({ id: "a" }), b: detail({ id: "b" }) });
    render(<ProjectsView apiFetch={apiFetch} />);
    await waitFor(() => {
      expect(itemButton("a")).toHaveClass("prj-item--sel");
    });
  });
});

function itemButton(id: string): HTMLElement {
  const name = screen.getByText(id, { selector: ".prj-item__name" });
  const item = name.closest(".prj-item");
  if (!item) throw new Error(`brak karty dla ${id}`);
  return item as HTMLElement;
}

/** Przycisk wyboru wewnątrz karty projektu (kliknięcie karty `div` niczego nie wybiera). */
function itemMain(id: string): HTMLElement {
  return within(itemButton(id)).getByRole("button", { name: new RegExp(id) });
}

/** apiFetch z zapisem: trzyma bieżące szczegóły projektu `a` i odpowiada na PUT/POST/PATCH. */
function makeRwApiFetch(initial: ProjectDetailDto, patchResponse?: Response) {
  let current = initial;
  const fetchFn = vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method ?? "GET";
    if (url === "/api/projects") return listResponse([summary({ id: "a" })]);
    if (url.endsWith("/context-pack")) return packResponse();
    if (url === "/api/projects/a" && method === "GET") {
      return new Response(JSON.stringify(current), { status: 200 });
    }
    if (url === "/api/projects/a" && method === "PATCH") {
      if (patchResponse) return patchResponse;
      current = { ...current, type: JSON.parse(String(options?.body)).type };
      return new Response(JSON.stringify(current), { status: 200 });
    }
    if (url === "/api/projects/a/state" && method === "PUT") {
      const body = JSON.parse(String(options?.body));
      current = {
        ...current,
        state: {
          branch: body.branch,
          env: body.env,
          blocker: body.blocker,
          nextStep: body.nextStep,
          links: body.links,
          milestone: body.milestone,
          updated: "2026-11-13T09:15",
        },
        stateVersion: "9:h",
      };
      return new Response(JSON.stringify(current), { status: 200 });
    }
    if (url === "/api/projects/a/devlog" && method === "POST") {
      const body = JSON.parse(String(options?.body));
      current = {
        ...current,
        devlog: [{ date: "2026-11-13", title: body.title, why: body.why }, ...current.devlog],
      };
      return new Response(JSON.stringify(current), { status: 201 });
    }
    return new Response("{}", { status: 404 });
  });
  return fetchFn;
}

describe("ProjectsView: Save State, devlog, typ", () => {
  it("projekt bez state: „Gdzie skończyłem”, przycisk utworzenia i pusty devlog", async () => {
    const apiFetch = makeRwApiFetch(detail({ id: "a", whereIStopped: "tu skończyłem" }));
    render(<ProjectsView apiFetch={apiFetch} />);
    expect(await screen.findByText("tu skończyłem")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Utwórz Save State" })).toBeInTheDocument();
    expect(screen.getByText("Brak wpisów")).toBeInTheDocument();
  });

  it("projekt ze state: kafle i kamień milowy bez paska postępu", async () => {
    const apiFetch = makeRwApiFetch(
      detail({
        id: "a",
        stateVersion: "5:h",
        state: {
          branch: "feat/x",
          env: "",
          blocker: "",
          nextStep: "krok",
          links: ["javascript:x"],
          milestone: "M",
          milestoneDue: "2026-12-01",
        },
      })
    );
    render(<ProjectsView apiFetch={apiFetch} />);
    expect(await screen.findByText("feat/x")).toBeInTheDocument();
    expect(screen.getByText(/Kamień milowy: M/)).toBeInTheDocument();
    expect(screen.getByText(/do 2026-12-01/)).toBeInTheDocument();
    // jedyny pasek to budżet paczki kontekstu, kamień milowy nie ma paska procentowego
    for (const bar of screen.queryAllByRole("progressbar")) {
      expect(bar).toHaveAccessibleName("Budżet paczki kontekstu");
    }
    expect(screen.getByText("javascript:x")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "javascript:x" })).toBeNull();
  });

  it("zmiana typu: PATCH z {type} i wartość z odpowiedzi", async () => {
    const user = userEvent.setup();
    const apiFetch = makeRwApiFetch(detail({ id: "a" }));
    render(<ProjectsView apiFetch={apiFetch} />);
    const select = await screen.findByLabelText("Typ projektu");
    await user.selectOptions(select, "wlasny");
    await waitFor(() => expect(select).toHaveValue("wlasny"));
    expect(apiFetch).toHaveBeenCalledWith("/api/projects/a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "wlasny" }),
    });
  });

  it("PATCH 422: komunikat w role=alert", async () => {
    const user = userEvent.setup();
    const apiFetch = makeRwApiFetch(
      detail({ id: "a" }),
      new Response(JSON.stringify({ error: "index.md nie ma frontmattera" }), { status: 422 })
    );
    render(<ProjectsView apiFetch={apiFetch} />);
    await user.selectOptions(await screen.findByLabelText("Typ projektu"), "etat");
    expect(await screen.findByRole("alert")).toHaveTextContent("index.md nie ma frontmattera");
  });

  it("utworzenie Save State: PUT z version null i kafle z odpowiedzi", async () => {
    const user = userEvent.setup();
    const apiFetch = makeRwApiFetch(detail({ id: "a" }));
    render(<ProjectsView apiFetch={apiFetch} />);
    await user.click(await screen.findByRole("button", { name: "Utwórz Save State" }));
    await user.type(screen.getByLabelText("Branch"), "feat/y");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByText("feat/y")).toBeInTheDocument();
    const put = apiFetch.mock.calls.find((c) => c[1]?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({ branch: "feat/y", version: null });
    expect(screen.getByRole("button", { name: "Edytuj" })).toBeInTheDocument();
  });

  it("dopisanie wpisu devlogu: lista z odpowiedzi serwera", async () => {
    const user = userEvent.setup();
    const apiFetch = makeRwApiFetch(detail({ id: "a" }));
    render(<ProjectsView apiFetch={apiFetch} />);
    await user.type(await screen.findByLabelText("Tytuł"), "Decyzja");
    await user.type(screen.getByLabelText("Dlaczego"), "bo tak");
    await user.click(screen.getByRole("button", { name: "Dodaj wpis" }));
    expect(await screen.findByText("Decyzja")).toBeInTheDocument();
    expect(screen.getByText("bo tak")).toBeInTheDocument();
    expect(screen.getByText("2026-11-13")).toBeInTheDocument();
    expect(screen.getByLabelText("Tytuł")).toHaveValue("");
  });

  it("zadania: kolumna Blokery bez pozycji pokazuje „Brak”", async () => {
    const apiFetch = makeRwApiFetch(detail({ id: "a" }));
    render(<ProjectsView apiFetch={apiFetch} />);
    const column = await screen.findByRole("region", { name: "Kolumna Blokery" });
    expect(within(column).getByText("Brak")).toBeInTheDocument();
  });
});

describe("ProjectsView: uśpienie i nowy projekt", () => {
  function makeStatusApi() {
    const stale = summary({ id: "a", freshness: "stale" });
    const calls: { url: string; method: string; body: unknown }[] = [];
    const fetchFn = vi.fn(async (url: string, options?: RequestInit) => {
      const method = options?.method ?? "GET";
      if (method !== "GET") {
        calls.push({ url, method, body: JSON.parse(String(options?.body)) });
      }
      if (url === "/api/projects" && method === "GET") return listResponse([stale]);
      if (url === "/api/projects" && method === "POST") {
        return new Response(
          JSON.stringify(detail({ id: "nowy", name: "Nowy", lastWorked: "2026-11-14" })),
          { status: 201 }
        );
      }
      if (url.endsWith("/context-pack")) return packResponse();
      if (url === "/api/projects/a" && method === "PATCH") {
        return new Response(
          JSON.stringify(detail({ id: "a", status: "paused", freshness: "stale" }))
        );
      }
      if (url === "/api/projects/a")
        return new Response(JSON.stringify(detail({ id: "a", freshness: "stale" })));
      if (url === "/api/projects/nowy")
        return new Response(JSON.stringify(detail({ id: "nowy", name: "Nowy" })));
      return new Response("{}", { status: 404 });
    });
    return { fetchFn, calls };
  }

  it("„Uśpij” w alercie: PATCH {status: paused}, projekt przestaje wymagać decyzji", async () => {
    const { fetchFn, calls } = makeStatusApi();
    render(<ProjectsView apiFetch={fetchFn} />);
    await userEvent.click(await screen.findByRole("button", { name: "Uśpij projekt a" }));

    await waitFor(() => {
      expect(calls).toEqual([
        { url: "/api/projects/a", method: "PATCH", body: { status: "paused" } },
      ]);
    });
    expect(await screen.findByRole("button", { name: "Wznów projekt a" })).toBeInTheDocument();
    expect(screen.queryByText(/Brak zmian od ponad 14 dni/)).not.toBeInTheDocument();
    expect(itemButton("a")).toHaveClass("prj-item--paused");
    expect(itemButton("a")).not.toHaveClass("prj-item--stale");
    const tiles = screen.getByRole("region", { name: "Statystyki projektów" });
    expect(within(tiles).getByText("wszystko świeże")).toBeInTheDocument();
  });

  it("przycisk „Uśpij projekt” w teczce wysyła ten sam PATCH", async () => {
    const { fetchFn, calls } = makeStatusApi();
    render(<ProjectsView apiFetch={fetchFn} />);
    await userEvent.click(await screen.findByRole("button", { name: "Uśpij projekt" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ status: "paused" });
    expect(await screen.findByRole("button", { name: "Wznów projekt" })).toBeInTheDocument();
  });

  it("„+ Nowy projekt”: formularz, POST i wybór nowego projektu", async () => {
    const { fetchFn, calls } = makeStatusApi();
    render(<ProjectsView apiFetch={fetchFn} />);
    await userEvent.click(await screen.findByRole("button", { name: "+ Nowy projekt" }));

    const dialog = screen.getByRole("dialog", { name: "Nowy projekt" });
    const create = within(dialog).getByRole("button", { name: "Utwórz projekt" });
    expect(create).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Nazwa"), "Nowy");
    await userEvent.type(within(dialog).getByLabelText(/Ścieżka lokalna/), "~/projects/nowy");
    await userEvent.selectOptions(within(dialog).getByLabelText("Typ"), "wlasny");
    await userEvent.click(create);

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      url: "/api/projects",
      method: "POST",
      body: { name: "Nowy", priority: "medium", localPath: "~/projects/nowy", type: "wlasny" },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("region", { name: "Teczka projektu Nowy" })).toBeInTheDocument();
  });

  it("„+ Nowy projekt”: błąd serwera w oknie, okno zostaje; Esc zamyka", async () => {
    const fetchFn = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/projects" && options?.method === "POST") {
        return new Response(JSON.stringify({ error: "Projekt nowy już jest w rejestrze" }), {
          status: 409,
        });
      }
      if (url === "/api/projects") return listResponse([summary({ id: "a" })]);
      if (url.endsWith("/context-pack")) return packResponse();
      return new Response(JSON.stringify(detail({ id: "a" })));
    });
    render(<ProjectsView apiFetch={fetchFn} />);
    await userEvent.click(await screen.findByRole("button", { name: "+ Nowy projekt" }));
    await userEvent.type(screen.getByLabelText("Nazwa"), "Nowy");
    await userEvent.click(screen.getByRole("button", { name: "Utwórz projekt" }));

    expect(await screen.findByText("Projekt nowy już jest w rejestrze")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("kafel „Paczka kontekstu” pokazuje tokeny wybranego projektu", async () => {
    const { fetchFn } = makeStatusApi();
    render(<ProjectsView apiFetch={fetchFn} />);
    const tiles = await screen.findByRole("region", { name: "Statystyki projektów" });
    expect(await within(tiles).findByText("3 850 tok")).toBeInTheDocument();
    expect(within(tiles).getByText("Paczka kontekstu")).toBeInTheDocument();
    expect(within(tiles).getByText("96% budżetu 4 000 tokenów")).toBeInTheDocument();
  });

  it("projekt bez state.md: karta Save State z „Gdzie skończyłem” i przycisk utworzenia", async () => {
    const { fetchFn } = makeStatusApi();
    render(<ProjectsView apiFetch={fetchFn} />);
    expect(await screen.findByText("Save State")).toBeInTheDocument();
    expect(screen.getByText("brak state.md")).toBeInTheDocument();
    expect(screen.getByText("Gdzie skończyłem (z index.md)")).toBeInTheDocument();
  });
});
