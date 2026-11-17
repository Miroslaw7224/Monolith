import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiagnosticsView } from "@/src/features/diagnostics/DiagnosticsView";

afterEach(() => {
  cleanup();
});

const port = (o: Record<string, unknown>) => ({
  source: "wsl",
  port: 3000,
  address: "127.0.0.1",
  exposure: "local",
  pid: 100,
  process: "node",
  path: null,
  commandLine: null,
  warning: null,
  killCommand: "kill 100",
  ...o,
});
const body = (ports: unknown[], windows: unknown = { ok: true }) => ({
  generatedAt: "2026-11-17T10:00:00.000Z",
  sources: { wsl: { ok: true }, windows },
  ports,
});
const fetchOf = (b: unknown) =>
  vi.fn().mockImplementation(async () => new Response(JSON.stringify(b), { status: 200 }));

describe("DiagnosticsView", () => {
  it("pokazuje wiersze z procesem, PID i znacznikami", async () => {
    render(
      <DiagnosticsView
        apiFetch={fetchOf(
          body([
            port({}),
            port({
              port: 3100,
              pid: 7,
              process: "next-server",
              warning: "self",
              exposure: "network",
              address: "0.0.0.0",
              killCommand: "kill 7",
            }),
          ])
        )}
      />
    );
    expect(await screen.findByText("next-server")).toBeInTheDocument();
    expect(screen.getByText("uwaga: to serwer Monolith")).toBeInTheDocument();
    expect(screen.getByText("sieć")).toBeInTheDocument();
    expect(screen.getByText("lokalny")).toBeInTheDocument();
  });

  it("filtruje po porcie i nazwie procesu", async () => {
    render(
      <DiagnosticsView
        apiFetch={fetchOf(body([port({}), port({ port: 5173, process: "vite", pid: 9 })]))}
      />
    );
    await screen.findByText("vite");
    await userEvent.type(screen.getByRole("searchbox", { name: "Filtr portów" }), "vit");
    expect(screen.queryByText("node")).not.toBeInTheDocument();
    expect(screen.getByText("vite")).toBeInTheDocument();
  });

  it("Kopiuj kill zapisuje komendę do schowka", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<DiagnosticsView apiFetch={fetchOf(body([port({})]))} />);
    await userEvent.click(await screen.findByRole("button", { name: /Kopiuj kill/ }));
    expect(writeText).toHaveBeenCalledWith("kill 100");
    expect(await screen.findByText("Skopiowano")).toBeInTheDocument();
  });

  it("przycisk jest nieaktywny, gdy killCommand to null", async () => {
    render(<DiagnosticsView apiFetch={fetchOf(body([port({ pid: null, killCommand: null })]))} />);
    expect(await screen.findByRole("button", { name: /Kopiuj kill/ })).toBeDisabled();
  });

  it("pokazuje komunikat o źródle, które zawiodło, i nadal listę z drugiego", async () => {
    render(
      <DiagnosticsView apiFetch={fetchOf(body([port({})], { ok: false, reason: "missing" }))} />
    );
    expect(
      await screen.findByText("Źródło Windows niedostępne (brak programu).")
    ).toBeInTheDocument();
    expect(screen.getByText("node")).toBeInTheDocument();
  });

  it("Odśwież pobiera dane ponownie", async () => {
    const apiFetch = fetchOf(body([port({})]));
    render(<DiagnosticsView apiFetch={apiFetch} />);
    await screen.findByText("node");
    await userEvent.click(screen.getByRole("button", { name: "Odśwież" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  });

  it("pusta lista pokazuje komunikat", async () => {
    render(<DiagnosticsView apiFetch={fetchOf(body([]))} />);
    expect(await screen.findByText("Brak nasłuchujących portów.")).toBeInTheDocument();
  });
});
