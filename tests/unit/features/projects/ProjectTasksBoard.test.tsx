import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetailDto, TasksBoardDto } from "@/contexts/bc_projects/schemas";
import { ProjectsView } from "@/src/features/projects/ProjectsView";

afterEach(() => cleanup());

const V = `12:${"a".repeat(64)}`;

function board(partial: Partial<TasksBoardDto> = {}): TasksBoardDto {
  return {
    blockers: [],
    now: [{ text: "Drugie", done: false }],
    next: [
      { text: "Pierwsze", done: false },
      { text: "Trzecie", done: false },
    ],
    icebox: [{ text: "Zrobione", done: true, doneDate: "2026-05-19" }],
    version: V,
    ...partial,
  };
}

function detail(b: TasksBoardDto): ProjectDetailDto {
  return {
    id: "a",
    name: "a",
    status: "active",
    priority: "P2",
    localPath: "/tmp/a",
    owner: "personal",
    kind: "wlasny",
    companyData: false,
    freshness: "fresh",
    tasks: [],
    board: b,
    bugs: [],
    whereIStopped: null,
    state: null,
    stateVersion: null,
    devlog: [],
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** `onPost` dostaje sparsowane ciało; domyślnie odsyła ten sam stan. */
function makeApi(
  initial: ProjectDetailDto,
  onPost?: (body: unknown) => Response | Promise<Response>
) {
  return vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/projects") {
      const { id, name, status, priority, localPath, owner, kind, companyData, freshness } =
        initial;
      return json({
        projects: [{ id, name, status, priority, localPath, owner, kind, companyData, freshness }],
        warnings: [],
      });
    }
    if (url === "/api/projects/a/tasks/archive" && options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      return onPost ? onPost(body) : json({ ...initial, archived: 0 });
    }
    if (url === "/api/projects/a/tasks" && options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      return onPost ? onPost(body) : json(initial);
    }
    if (url === "/api/projects/a") return json(initial);
    if (url === "/api/projects/a/context-pack") {
      return json({ markdown: "# P", approxTokens: 100, truncated: false, warnings: [] });
    }
    return new Response("{}", { status: 404 });
  });
}

const posts = (api: ReturnType<typeof makeApi>) =>
  api.mock.calls.filter((c) => c[1]?.method === "POST").map((c) => JSON.parse(String(c[1]?.body)));

const column = (name: string) => screen.getByRole("region", { name: `Kolumna ${name}` });

const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: "", dropEffect: "" });
const handle = (taskText: string) => screen.getByLabelText(`Przeciągnij: ${taskText}`);

/** Pełne przeciągnięcie uchwytu zadania na kolumnę (dragStart → dragOver → drop → dragEnd). */
function dragTo(taskText: string, columnName: string) {
  const dt = dataTransfer();
  fireEvent.dragStart(handle(taskText), { dataTransfer: dt });
  fireEvent.dragOver(column(columnName), { dataTransfer: dt });
  fireEvent.drop(column(columnName), { dataTransfer: dt });
  fireEvent.dragEnd(handle(taskText), { dataTransfer: dt });
}

describe("ProjectTasksBoard (przez ProjectsView)", () => {
  it("renderuje cztery kolumny z zadaniami i licznik Teraz", async () => {
    render(<ProjectsView apiFetch={makeApi(detail(board()))} />);
    // Pierwsze renderowanie ProjectsView w pliku: pod obciążeniem pełnego przebiegu przekracza domyślne 1 s.
    await screen.findByRole("region", { name: "Kolumna Teraz" }, { timeout: 5000 });
    expect(within(column("Teraz")).getByText("Drugie")).toBeInTheDocument();
    expect(within(column("Teraz")).getByText("1/3")).toBeInTheDocument();
    expect(within(column("Następne")).getByText("Trzecie")).toBeInTheDocument();
    expect(within(column("Icebox")).getByText("Zrobione")).toBeInTheDocument();
    expect(within(column("Icebox")).getByText("2026-05-19")).toBeInTheDocument();
    expect(within(column("Blokery")).getByText("Brak")).toBeInTheDocument();
  });

  it("odhaczenie: POST toggle z kolumną, indeksem, tekstem i wersją; stan z odpowiedzi", async () => {
    const user = userEvent.setup();
    const after = board({
      next: [
        { text: "Pierwsze", done: false },
        { text: "Trzecie", done: true, doneDate: "2026-11-13" },
      ],
    });
    const api = makeApi(detail(board()), () => json(detail(after)));
    render(<ProjectsView apiFetch={api} />);
    await user.click(
      await within(await findColumn("Następne")).findByRole("checkbox", { name: "Trzecie" })
    );
    expect(posts(api)).toEqual([
      { op: "toggle", column: "next", index: 1, text: "Trzecie", version: V },
    ]);
    await waitFor(() =>
      expect(within(column("Następne")).getByRole("checkbox", { name: "Trzecie" })).toBeChecked()
    );
  });

  it("dodawanie: POST add, pole czyszczone po sukcesie", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(board()));
    render(<ProjectsView apiFetch={api} />);
    const input = await screen.findByLabelText("Dodaj zadanie: Następne");
    await user.type(input, "Nowe");
    await user.click(within(column("Następne")).getByRole("button", { name: "Dodaj zadanie" }));
    expect(posts(api)).toEqual([{ op: "add", column: "next", text: "Nowe", version: V }]);
    await waitFor(() => expect(screen.getByLabelText("Dodaj zadanie: Następne")).toHaveValue(""));
  });

  it("brak pliku (version null): add wysyła version null", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(board({ now: [], next: [], icebox: [], version: null })));
    render(<ProjectsView apiFetch={api} />);
    await user.type(await screen.findByLabelText("Dodaj zadanie: Icebox"), "Coś");
    await user.click(within(column("Icebox")).getByRole("button", { name: "Dodaj zadanie" }));
    expect(posts(api)).toEqual([{ op: "add", column: "icebox", text: "Coś", version: null }]);
  });

  it("pusty tekst nie wysyła żądania", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(board()));
    render(<ProjectsView apiFetch={api} />);
    await screen.findByLabelText("Dodaj zadanie: Następne");
    await user.click(within(column("Następne")).getByRole("button", { name: "Dodaj zadanie" }));
    expect(posts(api)).toEqual([]);
  });

  it("Teraz pełne: dodawanie wyłączone, a upuszczenie zadania w Teraz pokazuje błąd bez żądania", async () => {
    const api = makeApi(
      detail(
        board({
          now: [
            { text: "1", done: false },
            { text: "2", done: false },
            { text: "3", done: false },
          ],
        })
      )
    );
    render(<ProjectsView apiFetch={api} />);
    expect(await screen.findByLabelText("Dodaj zadanie: Teraz")).toBeDisabled();
    expect(within(column("Teraz")).getByRole("button", { name: "Dodaj zadanie" })).toBeDisabled();
    dragTo("Trzecie", "Teraz");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Limit 3/);
    expect(posts(api)).toEqual([]);
  });

  it("ukończone zadanie upuszczone w Teraz: błąd i brak żądania", async () => {
    const api = makeApi(detail(board()));
    render(<ProjectsView apiFetch={api} />);
    await screen.findByLabelText("Przeciągnij: Zrobione");
    dragTo("Zrobione", "Teraz");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Ukończone zadanie/);
    expect(posts(api)).toEqual([]);
  });

  it("edycja inline: POST edit z newText", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(board()));
    render(<ProjectsView apiFetch={api} />);
    await user.click(await screen.findByRole("button", { name: "Edytuj: Trzecie" }));
    const field = screen.getByLabelText("Edytuj zadanie");
    expect(field).toHaveValue("Trzecie");
    await user.clear(field);
    await user.type(field, "Trzecie v2");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(posts(api)).toEqual([
      { op: "edit", column: "next", index: 1, text: "Trzecie", newText: "Trzecie v2", version: V },
    ]);
  });

  it("po udanej mutacji innego zadania otwarta edycja i potwierdzenie usunięcia się zamykają", async () => {
    const user = userEvent.setup();
    const after = board({ next: [{ text: "Trzecie", done: false }] });
    const api = makeApi(detail(board()), () => json(detail(after)));
    render(<ProjectsView apiFetch={api} />);
    await user.click(await screen.findByRole("button", { name: "Edytuj: Trzecie" }));
    expect(screen.getByLabelText("Edytuj zadanie")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usuń: Pierwsze" }));
    expect(screen.queryByLabelText("Edytuj zadanie")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Potwierdź usunięcie: Pierwsze" }));
    await waitFor(() => expect(posts(api)).toHaveLength(1));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Potwierdź usunięcie/ })).not.toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: "Usuń: Trzecie" }));
    await user.click(within(column("Teraz")).getByRole("checkbox", { name: "Drugie" }));
    await waitFor(() => expect(posts(api)).toHaveLength(2));
    expect(screen.queryByRole("button", { name: /Potwierdź usunięcie/ })).not.toBeInTheDocument();
    // Długi scenariusz (ok. 10 akcji userEvent): pod obciążeniem pełnego przebiegu przekracza domyślne 5 s.
  }, 20_000);

  it("usuwanie dwuetapowe: dopiero potwierdzenie wysyła POST remove", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(board()));
    render(<ProjectsView apiFetch={api} />);
    await user.click(await screen.findByRole("button", { name: "Usuń: Trzecie" }));
    expect(posts(api)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Potwierdź usunięcie: Trzecie" }));
    expect(posts(api)).toEqual([
      { op: "remove", column: "next", index: 1, text: "Trzecie", version: V },
    ]);
  });

  it("przeciągnięcie na kolumnę: POST move z kolumną docelową", async () => {
    const api = makeApi(detail(board()));
    render(<ProjectsView apiFetch={api} />);
    await screen.findByLabelText("Przeciągnij: Trzecie");
    dragTo("Trzecie", "Icebox");
    await waitFor(() => expect(posts(api)).toHaveLength(1));
    expect(posts(api)).toEqual([
      { op: "move", column: "next", index: 1, text: "Trzecie", to: "icebox", version: V },
    ]);
  });

  it("upuszczenie w tej samej kolumnie nie wysyła żądania", async () => {
    const api = makeApi(detail(board()));
    render(<ProjectsView apiFetch={api} />);
    await screen.findByLabelText("Przeciągnij: Trzecie");
    dragTo("Trzecie", "Następne");
    expect(posts(api)).toEqual([]);
  });

  it("kolumna docelowa jest podświetlona w trakcie przeciągania i po zakończeniu wraca", async () => {
    render(<ProjectsView apiFetch={makeApi(detail(board()))} />);
    await screen.findByLabelText("Przeciągnij: Trzecie");
    const dt = dataTransfer();
    fireEvent.dragStart(handle("Trzecie"), { dataTransfer: dt });
    fireEvent.dragOver(column("Icebox"), { dataTransfer: dt });
    expect(column("Icebox")).toHaveClass("prj-board__col--over");
    fireEvent.dragEnd(handle("Trzecie"), { dataTransfer: dt });
    expect(column("Icebox")).not.toHaveClass("prj-board__col--over");
  });

  it("zamiast menu „Przenieś do…” zadanie ma uchwyt do przeciągania", async () => {
    render(<ProjectsView apiFetch={makeApi(detail(board()))} />);
    const grip = await screen.findByLabelText("Przeciągnij: Trzecie");
    expect(grip).toHaveAttribute("draggable", "true");
    expect(screen.queryByLabelText("Przenieś: Trzecie")).not.toBeInTheDocument();
  });

  it("konflikt 409: komunikat i ponowne pobranie szczegółów", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(board()), () =>
      json({ error: "Zadanie zmieniło się w pliku" }, 409)
    );
    render(<ProjectsView apiFetch={api} />);
    await user.click(
      await within(await findColumn("Następne")).findByRole("checkbox", { name: "Trzecie" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/zmieniło się|odświeżono/i);
    await waitFor(() =>
      expect(
        api.mock.calls.filter((c) => c[0] === "/api/projects/a").length
      ).toBeGreaterThanOrEqual(2)
    );
  });

  it("w trakcie żądania kontrolki są wyłączone", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(board()), () => new Promise<Response>(() => {}));
    render(<ProjectsView apiFetch={api} />);
    const checkbox = await within(await findColumn("Następne")).findByRole("checkbox", {
      name: "Trzecie",
    });
    await user.click(checkbox);
    await waitFor(() => expect(checkbox).toBeDisabled());
    expect(screen.getByLabelText("Dodaj zadanie: Następne")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edytuj: Pierwsze" })).toBeDisabled();
    expect(handle("Pierwsze")).toHaveAttribute("draggable", "false");
  });
});

async function findColumn(name: string): Promise<HTMLElement> {
  return screen.findByRole("region", { name: `Kolumna ${name}` });
}

const mixedBoard = () =>
  board({
    now: [{ text: "Teraz1", done: false }],
    next: [
      { text: "N-otwarte", done: false },
      { text: "N-gotowe", done: true, doneDate: "2026-11-12" },
      { text: "N-za-gotowym", done: false },
    ],
    icebox: [{ text: "I-gotowe", done: true, doneDate: "2026-11-01" }],
  });

describe("ProjectTasksBoard: filtr otwarte / ukończone", () => {
  const renderMixed = async (onPost?: Parameters<typeof makeApi>[1]) => {
    const api = makeApi(detail(mixedBoard()), onPost);
    render(<ProjectsView apiFetch={api} />);
    await findColumn("Następne");
    return api;
  };
  const pick = (name: string) => userEvent.setup().click(screen.getByRole("button", { name }));

  it("„Otwarte” ukrywa ukończone, „Ukończone” ukrywa otwarte, „Wszystkie” pokazuje oba", async () => {
    await renderMixed();
    const next = () => within(column("Następne"));
    expect(next().getByText("N-gotowe")).toBeInTheDocument();
    await pick("Otwarte");
    expect(next().queryByText("N-gotowe")).not.toBeInTheDocument();
    expect(next().getByText("N-otwarte")).toBeInTheDocument();
    expect(next().getByText("N-za-gotowym")).toBeInTheDocument();
    await pick("Ukończone");
    expect(next().getByText("N-gotowe")).toBeInTheDocument();
    expect(next().queryByText("N-otwarte")).not.toBeInTheDocument();
    await pick("Wszystkie");
    expect(next().getByText("N-otwarte")).toBeInTheDocument();
    expect(next().getByText("N-gotowe")).toBeInTheDocument();
  });

  it("pusta kolumna w widoku filtrowanym: „Brak otwartych” / „Brak ukończonych”", async () => {
    await renderMixed();
    await pick("Otwarte");
    expect(within(column("Icebox")).getByText("Brak otwartych")).toBeInTheDocument();
    await pick("Ukończone");
    expect(within(column("Teraz")).getByText("Brak ukończonych")).toBeInTheDocument();
    expect(within(column("Blokery")).getByText("Brak ukończonych")).toBeInTheDocument();
  });

  it("licznik kolumny pokazuje widoczne zadania, a n/NOW_LIMIT w Teraz zostaje z pełnych danych", async () => {
    await renderMixed();
    expect(within(column("Następne")).getByText("3 zadania")).toBeInTheDocument();
    await pick("Otwarte");
    expect(within(column("Następne")).getByText("2 zadania")).toBeInTheDocument();
    await pick("Ukończone");
    expect(within(column("Następne")).getByText("1 zadanie")).toBeInTheDocument();
    expect(within(column("Teraz")).getByText("1/3")).toBeInTheDocument();
  });

  it("„Ukończone” ukrywa formularze dodawania, pozostałe filtry je zostawiają", async () => {
    await renderMixed();
    await pick("Otwarte");
    expect(screen.getByLabelText("Dodaj zadanie: Następne")).toBeInTheDocument();
    await pick("Ukończone");
    expect(screen.queryByLabelText("Dodaj zadanie: Następne")).not.toBeInTheDocument();
  });

  it("pod filtrem „Otwarte” toggle, edit, remove i move wysyłają ORYGINALNY indeks", async () => {
    const user = userEvent.setup();
    const api = await renderMixed();
    await user.click(screen.getByRole("button", { name: "Otwarte" }));

    await user.click(within(column("Następne")).getByRole("checkbox", { name: "N-za-gotowym" }));
    await user.click(screen.getByRole("button", { name: "Edytuj: N-za-gotowym" }));
    const input = screen.getByLabelText("Edytuj zadanie");
    await user.clear(input);
    await user.type(input, "Nowy");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await user.click(screen.getByRole("button", { name: "Usuń: N-za-gotowym" }));
    await user.click(screen.getByRole("button", { name: "Potwierdź usunięcie: N-za-gotowym" }));
    // Przeciąganie jest zablokowane, dopóki trwa mutacja (`busy`): czekamy, aż uchwyt znów jest aktywny.
    await waitFor(() => expect(handle("N-za-gotowym")).toHaveAttribute("draggable", "true"));
    dragTo("N-za-gotowym", "Icebox");

    await waitFor(() => expect(posts(api)).toHaveLength(4));
    expect(posts(api)).toEqual([
      { op: "toggle", column: "next", index: 2, text: "N-za-gotowym", version: V },
      { op: "edit", column: "next", index: 2, text: "N-za-gotowym", newText: "Nowy", version: V },
      { op: "remove", column: "next", index: 2, text: "N-za-gotowym", version: V },
      { op: "move", column: "next", index: 2, text: "N-za-gotowym", to: "icebox", version: V },
    ]);
  });

  it("zmiana filtra zamyka otwartą edycję i potwierdzenie usunięcia", async () => {
    const user = userEvent.setup();
    await renderMixed();
    await user.click(screen.getByRole("button", { name: "Edytuj: N-otwarte" }));
    expect(screen.getByLabelText("Edytuj zadanie")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Otwarte" }));
    expect(screen.queryByLabelText("Edytuj zadanie")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Usuń: N-otwarte" }));
    expect(
      screen.getByRole("button", { name: "Potwierdź usunięcie: N-otwarte" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wszystkie" }));
    expect(
      screen.queryByRole("button", { name: "Potwierdź usunięcie: N-otwarte" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usuń: N-otwarte" })).toBeInTheDocument();
  });
});

describe("ProjectTasksBoard: archiwizacja ukończonych", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 14, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  // Dziś 2026-11-14. N = 7: M = 1 (tylko „Bez daty”); N = 3: M = 2 (Stare 11-10 i „Bez daty”), K = 1.
  const archBoard = () =>
    board({
      now: [],
      next: [
        { text: "Otwarte", done: false },
        { text: "Stare", done: true, doneDate: "2026-11-10" },
        { text: "Świeże", done: true, doneDate: "2026-11-12" },
      ],
      icebox: [{ text: "Bez daty", done: true }],
    });
  const onlyDated = () =>
    board({
      now: [],
      icebox: [],
      next: [{ text: "Stare", done: true, doneDate: "2026-11-10" }],
    });
  const BTN = (m: number) => ({ name: `Archiwizuj ukończone (${m})` });
  const setDays = (user: ReturnType<typeof userEvent.setup>, value: string) =>
    user.selectOptions(screen.getByLabelText("Archiwizuj starsze niż"), value);

  it("przycisk ukryty przy M = 0 (same otwarte)", async () => {
    render(
      <ProjectsView
        apiFetch={makeApi(detail(board({ icebox: [], next: [{ text: "A", done: false }] })))}
      />
    );
    await findColumn("Następne");
    expect(screen.queryByRole("button", { name: /Archiwizuj ukończone/ })).not.toBeInTheDocument();
  });

  it("M zmienia się z progiem; przy M = 0 przycisk wraca po zmianie progu", async () => {
    const user = userEvent.setup();
    render(<ProjectsView apiFetch={makeApi(detail(archBoard()))} />);
    expect(await screen.findByRole("button", BTN(1))).toBeInTheDocument();
    await setDays(user, "3");
    expect(screen.getByRole("button", BTN(2))).toBeInTheDocument();

    cleanup();
    render(<ProjectsView apiFetch={makeApi(detail(onlyDated()))} />);
    await findColumn("Następne");
    expect(screen.queryByRole("button", { name: /Archiwizuj ukończone/ })).not.toBeInTheDocument();
    await setDays(userEvent.setup(), "3");
    expect(screen.getByRole("button", BTN(1))).toBeInTheDocument();
  });

  it("potwierdzenie: „(w tym K bez daty)” tylko gdy K > 0", async () => {
    const user = userEvent.setup();
    render(<ProjectsView apiFetch={makeApi(detail(archBoard()))} />);
    await user.click(await screen.findByRole("button", BTN(1)));
    expect(
      screen.getByText("Przenieść 1 zadań do changelog.md (w tym 1 bez daty)?")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anuluj archiwizację" }));
    expect(screen.queryByText(/Przenieść/)).not.toBeInTheDocument();

    cleanup();
    render(<ProjectsView apiFetch={makeApi(detail(onlyDated()))} />);
    await findColumn("Następne");
    const user2 = userEvent.setup();
    await setDays(user2, "3");
    await user2.click(screen.getByRole("button", BTN(1)));
    expect(screen.getByText("Przenieść 1 zadań do changelog.md?")).toBeInTheDocument();
  });

  it("potwierdzenie → POST /tasks/archive z wersją i progiem; komunikat z archived z odpowiedzi", async () => {
    const user = userEvent.setup();
    const after = board({ now: [], icebox: [], next: [{ text: "Otwarte", done: false }] });
    const api = makeApi(detail(archBoard()), () => json({ ...detail(after), archived: 2 }));
    render(<ProjectsView apiFetch={api} />);
    await findColumn("Następne");
    await setDays(user, "3");
    await user.click(screen.getByRole("button", BTN(2)));
    await user.click(screen.getByRole("button", { name: "Potwierdź archiwizację" }));
    expect(posts(api)).toEqual([{ version: V, olderThanDays: 3 }]);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Przeniesiono 2 zadań do changelog.md"
    );
    expect(screen.queryByRole("button", { name: /Archiwizuj ukończone/ })).not.toBeInTheDocument();
  });

  it("konflikt 409: komunikat i ponowne pobranie szczegółów", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(archBoard()), () =>
      json({ error: "Plik zadań zmienił się w międzyczasie" }, 409)
    );
    render(<ProjectsView apiFetch={api} />);
    await user.click(await screen.findByRole("button", BTN(1)));
    await user.click(screen.getByRole("button", { name: "Potwierdź archiwizację" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/zmienił się|odświeżono/i);
    await waitFor(() =>
      expect(
        api.mock.calls.filter((c) => c[0] === "/api/projects/a").length
      ).toBeGreaterThanOrEqual(2)
    );
  });

  it("inna mutacja zamyka otwarte potwierdzenie archiwizacji", async () => {
    const user = userEvent.setup();
    render(<ProjectsView apiFetch={makeApi(detail(archBoard()))} />);
    await user.click(await screen.findByRole("button", BTN(1)));
    expect(screen.getByText(/Przenieść/)).toBeInTheDocument();
    await user.click(within(column("Następne")).getByRole("checkbox", { name: "Otwarte" }));
    await waitFor(() => expect(screen.queryByText(/Przenieść/)).not.toBeInTheDocument());
  });

  it("M nie zmienia się po przełączeniu filtra (liczony z pełnej tablicy)", async () => {
    const user = userEvent.setup();
    render(<ProjectsView apiFetch={makeApi(detail(archBoard()))} />);
    await screen.findByRole("button", BTN(1));
    await user.click(screen.getByRole("button", { name: "Otwarte" }));
    expect(screen.getByRole("button", BTN(1))).toBeInTheDocument();
  });
});
