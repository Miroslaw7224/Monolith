import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentsView } from "@/src/features/arsenal/AgentsView";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await act(async () => {
    await setLanguage("pl");
  });
});

const overview = {
  agents: [
    {
      kind: "agent",
      id: "a1",
      name: "agy",
      role: "Review i wyszukiwanie",
      model: "Gemini Flash",
      when: "Pytania o kod",
    },
  ],
  presets: [
    {
      kind: "preset",
      id: "p1",
      name: "Review diffa",
      command: 'scripts/ask-helper.sh --role review agy "x"',
      description: "Niezależna opinia",
    },
  ],
  scripts: [
    {
      kind: "script",
      id: "s1",
      name: "ask-helper",
      path: "scripts/ask-helper.sh",
      description: "Wysyła prompt",
      example: 'scripts/ask-helper.sh agy "pytanie"',
    },
  ],
  skipped: 2,
};

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

function setup() {
  const apiFetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "DELETE"
      ? ({ ok: true, status: 204 } as Response)
      : json(init?.method ? {} : overview)
  );
  render(<AgentsView apiFetch={apiFetch} />);
  return apiFetch;
}

describe("AgentsView", () => {
  it("pokazuje trzy sekcje z wpisami i licznik pominiętych", async () => {
    setup();
    expect(await screen.findByRole("heading", { name: "Kto do czego" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Presety poleceń" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Skrypty" })).toBeInTheDocument();
    expect(screen.getByText("Review i wyszukiwanie")).toBeInTheDocument();
    expect(screen.getByText("scripts/ask-helper.sh")).toBeInTheDocument();
    expect(screen.getByText(/pominięto 2/)).toBeInTheDocument();
  });

  it("kopiuje polecenie presetu i przykład skryptu do schowka; nie ma przycisku uruchamiania", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setup();
    const preset = (await screen.findByText("Review diffa")).closest("article")!;
    await userEvent.click(within(preset).getByRole("button", { name: "Kopiuj polecenie" }));
    expect(writeText).toHaveBeenCalledWith('scripts/ask-helper.sh --role review agy "x"');
    const script = screen.getByText("ask-helper").closest("article")!;
    await userEvent.click(within(script).getByRole("button", { name: "Kopiuj przykład" }));
    expect(writeText).toHaveBeenLastCalledWith('scripts/ask-helper.sh agy "pytanie"');
    expect(screen.queryByRole("button", { name: /uruchom|run|execute/i })).toBeNull();
  });

  it("dodawanie presetu: formularz wysyła POST z rodzajem preset", async () => {
    const apiFetch = setup();
    await screen.findByText("Review diffa");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj preset" }));
    await userEvent.type(screen.getByLabelText("Nazwa"), "Testy");
    await userEvent.type(screen.getByLabelText("Szablon polecenia"), "npx vitest run");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      const post = apiFetch.mock.calls.find(([, init]) => init?.method === "POST");
      expect(JSON.parse(post![1]!.body as string)).toMatchObject({
        kind: "preset",
        name: "Testy",
        command: "npx vitest run",
      });
    });
    await waitFor(() => expect(screen.queryByLabelText("Nazwa")).toBeNull());
  });

  it("błąd zapisu zostawia formularz i pokazuje komunikat", async () => {
    const apiFetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? ({ ok: false, status: 400, json: async () => ({ error: "Brak roli" }) } as Response)
        : json(overview)
    );
    render(<AgentsView apiFetch={apiFetch} />);
    await screen.findByText("Review diffa");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj agenta" }));
    await userEvent.type(screen.getByLabelText("Nazwa"), "X");
    await userEvent.type(screen.getByLabelText("Rola"), "Y");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Brak roli");
    expect(screen.getByLabelText("Nazwa")).toBeInTheDocument();
  });

  it("edycja agenta: formularz startuje z danymi i wysyła PUT z kind agent", async () => {
    const apiFetch = setup();
    const card = (await screen.findByText("Review i wyszukiwanie")).closest("article")!;
    await userEvent.click(within(card).getByRole("button", { name: "Edytuj" }));
    expect(screen.getByLabelText("Rola")).toHaveValue("Review i wyszukiwanie");
    await userEvent.clear(screen.getByLabelText("Rola"));
    await userEvent.type(screen.getByLabelText("Rola"), "Tylko review");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      const put = apiFetch.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(put![0]).toBe("/api/arsenal/agents/a1");
      expect(JSON.parse(put![1]!.body as string)).toMatchObject({
        kind: "agent",
        role: "Tylko review",
      });
    });
  });

  it("usuwanie: po potwierdzeniu wysyła DELETE, po odmowie nic", async () => {
    const apiFetch = setup();
    const card = (await screen.findByText("Review diffa")).closest("article")!;
    const delBtn = () => within(card).getByRole("button", { name: "Usuń" });
    await userEvent.click(delBtn());
    const dialog = screen.getByRole("dialog", { name: "Usunąć wpis „Review diffa”?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(apiFetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    await userEvent.click(delBtn());
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń" }));
    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          ([url, init]) => url === "/api/arsenal/agents/p1" && init?.method === "DELETE"
        )
      ).toBe(true)
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("po angielsku: etykiety EN", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    setup();
    expect(await screen.findByRole("heading", { name: "Who does what" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add agent" })).toBeInTheDocument();
  });

  it("nie pokazuje przycisków dodawania, gdy lista się nie załadowała", async () => {
    const apiFetch = vi.fn(
      async () => ({ ok: false, status: 500, json: async () => ({ error: "Awaria" }) }) as Response
    );
    render(<AgentsView apiFetch={apiFetch} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Awaria");
    expect(screen.queryByRole("button", { name: "Dodaj agenta" })).toBeNull();
  });

  it("udany zapis czyści stary komunikat błędu po nieudanym usunięciu", async () => {
    const apiFetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? ({
            ok: false,
            status: 500,
            json: async () => ({ error: "Nie można usunąć" }),
          } as Response)
        : json(init?.method ? {} : overview)
    );
    render(<AgentsView apiFetch={apiFetch} />);
    const card = (await screen.findByText("Review diffa")).closest("article")!;
    await userEvent.click(within(card).getByRole("button", { name: "Usuń" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie można usunąć");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj preset" }));
    await userEvent.type(screen.getByLabelText("Nazwa"), "Testy");
    await userEvent.type(screen.getByLabelText("Szablon polecenia"), "npx vitest run");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
