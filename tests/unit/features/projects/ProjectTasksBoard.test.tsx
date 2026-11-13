import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
      const { id, name, status, priority, localPath, owner, freshness } = initial;
      return json({
        projects: [{ id, name, status, priority, localPath, owner, freshness }],
        warnings: [],
      });
    }
    if (url === "/api/projects/a/tasks" && options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      return onPost ? onPost(body) : json(initial);
    }
    if (url === "/api/projects/a") return json(initial);
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
    await screen.findByRole("region", { name: "Kolumna Teraz" });
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
    await user.click(within(column("Następne")).getByRole("button", { name: "Dodaj" }));
    expect(posts(api)).toEqual([{ op: "add", column: "next", text: "Nowe", version: V }]);
    await waitFor(() => expect(screen.getByLabelText("Dodaj zadanie: Następne")).toHaveValue(""));
  });

  it("brak pliku (version null): add wysyła version null", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(board({ now: [], next: [], icebox: [], version: null })));
    render(<ProjectsView apiFetch={api} />);
    await user.type(await screen.findByLabelText("Dodaj zadanie: Icebox"), "Coś");
    await user.click(within(column("Icebox")).getByRole("button", { name: "Dodaj" }));
    expect(posts(api)).toEqual([{ op: "add", column: "icebox", text: "Coś", version: null }]);
  });

  it("pusty tekst nie wysyła żądania", async () => {
    const user = userEvent.setup();
    const api = makeApi(detail(board()));
    render(<ProjectsView apiFetch={api} />);
    await screen.findByLabelText("Dodaj zadanie: Następne");
    await user.click(within(column("Następne")).getByRole("button", { name: "Dodaj" }));
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
    expect(within(column("Teraz")).getByRole("button", { name: "Dodaj" })).toBeDisabled();
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
  });

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
