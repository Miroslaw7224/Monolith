import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoursesView } from "@/src/features/arsenal/CoursesView";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await act(async () => {
    await setLanguage("pl");
  });
});

const list = {
  courses: [
    {
      id: "c1",
      title: "Next.js App Router",
      url: "https://a.example.com",
      provider: "Udemy",
      status: "w-trakcie",
      certificateMissing: false,
    },
    {
      id: "c2",
      title: "Plan na później",
      url: "https://b.example.com",
      status: "plan",
      certificateMissing: false,
    },
    {
      id: "c3",
      title: "MCP w praktyce",
      url: "https://c.example.com",
      status: "ukonczony",
      completed: "2026-03-01",
      certificateUrl: "https://c.example.com/cert",
      certificateFile: "certyfikaty/mcp.pdf",
      certificateMissing: true,
      note: "Warto wrócić",
    },
  ],
  skipped: 0,
};

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

function setup() {
  const apiFetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "DELETE"
      ? ({ ok: true, status: 204 } as Response)
      : json(init?.method ? {} : list)
  );
  render(<CoursesView apiFetch={apiFetch} />);
  return apiFetch;
}

describe("CoursesView", () => {
  it("pokazuje kafle i listę w kolejności z serwera", async () => {
    setup();
    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(3);
    const tiles = screen.getByLabelText("Statystyki kursów");
    expect(within(tiles).getByText("W trakcie").parentElement).toHaveTextContent("1");
    expect(within(tiles).getByText("Ukończone").parentElement).toHaveTextContent("1");
  });

  it("kurs z certyfikatem pokazuje link, ścieżkę, ostrzeżenie o braku pliku i notatkę", async () => {
    setup();
    const card = (await screen.findByText("MCP w praktyce")).closest("article")!;
    expect(within(card).getByRole("link", { name: "Certyfikat" })).toHaveAttribute(
      "href",
      "https://c.example.com/cert"
    );
    expect(within(card).getByText("Plik: certyfikaty/mcp.pdf")).toBeInTheDocument();
    expect(within(card).getByText("brak pliku w Vault/Documents/")).toBeInTheDocument();
    expect(within(card).getByText("Warto wrócić")).toBeInTheDocument();
  });

  it("tytuł kursu to link otwierany w nowej karcie z rel noopener", async () => {
    setup();
    const link = await screen.findByRole("link", { name: "Next.js App Router" });
    expect(link).toHaveAttribute("href", "https://a.example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("filtr statusu zawęża listę", async () => {
    setup();
    await screen.findAllByRole("article");
    await userEvent.click(screen.getByRole("button", { name: "Plan" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Plan na później")).toBeInTheDocument();
  });

  it("dodawanie: formularz wysyła POST z polami i odświeża listę", async () => {
    const apiFetch = setup();
    await screen.findAllByRole("article");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj kurs" }));
    await userEvent.type(screen.getByLabelText("Tytuł"), "Nowy kurs");
    await userEvent.type(
      screen.getByLabelText("Adres kursu (http/https)"),
      "https://n.example.com"
    );
    await userEvent.selectOptions(screen.getByLabelText("Status"), "w-trakcie");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      const post = apiFetch.mock.calls.find(([, init]) => init?.method === "POST");
      expect(post).toBeDefined();
      expect(JSON.parse(post![1]!.body as string)).toMatchObject({
        title: "Nowy kurs",
        url: "https://n.example.com",
        status: "w-trakcie",
      });
    });
    await waitFor(() => expect(screen.queryByLabelText("Tytuł")).toBeNull());
  });

  it("błąd zapisu zostawia formularz i pokazuje komunikat", async () => {
    const apiFetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? ({ ok: false, status: 400, json: async () => ({ error: "Zły adres" }) } as Response)
        : json(list)
    );
    render(<CoursesView apiFetch={apiFetch} />);
    await screen.findAllByRole("article");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj kurs" }));
    await userEvent.type(screen.getByLabelText("Tytuł"), "X");
    await userEvent.type(
      screen.getByLabelText("Adres kursu (http/https)"),
      "https://x.example.com"
    );
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Zły adres");
    expect(screen.getByLabelText("Tytuł")).toBeInTheDocument();
  });

  it("edycja: formularz startuje z danymi kursu i wysyła PUT", async () => {
    const apiFetch = setup();
    const card = (await screen.findByText("Plan na później")).closest("article")!;
    await userEvent.click(within(card).getByRole("button", { name: "Edytuj" }));
    expect(screen.getByLabelText("Tytuł")).toHaveValue("Plan na później");
    await userEvent.clear(screen.getByLabelText("Tytuł"));
    await userEvent.type(screen.getByLabelText("Tytuł"), "Zmieniony");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      const put = apiFetch.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(put![0]).toBe("/api/arsenal/courses/c2");
      expect(JSON.parse(put![1]!.body as string).title).toBe("Zmieniony");
    });
  });

  it("usuwanie: po potwierdzeniu wysyła DELETE, po odmowie nic", async () => {
    const apiFetch = setup();
    const card = (await screen.findByText("Plan na później")).closest("article")!;
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    await userEvent.click(within(card).getByRole("button", { name: "Usuń" }));
    expect(apiFetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    await userEvent.click(within(card).getByRole("button", { name: "Usuń" }));
    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          ([url, init]) => url === "/api/arsenal/courses/c2" && init?.method === "DELETE"
        )
      ).toBe(true)
    );
    expect(confirm).toHaveBeenCalledWith("Usunąć kurs „Plan na później”?");
  });

  it("po angielsku: etykiety EN", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    setup();
    expect(await screen.findByRole("button", { name: "Add course" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Certificate" })).toBeInTheDocument();
  });

  it("przycisk Dodaj kurs jest nieaktywny, gdy lista się nie załadowała", async () => {
    const apiFetch = vi.fn(
      async () => ({ ok: false, status: 500, json: async () => ({ error: "Awaria" }) }) as Response
    );
    render(<CoursesView apiFetch={apiFetch} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Awaria");
    expect(screen.getByRole("button", { name: "Dodaj kurs" })).toBeDisabled();
  });
});
