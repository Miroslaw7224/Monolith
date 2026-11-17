import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiagnosticsView } from "@/src/features/diagnostics/DiagnosticsView";

afterEach(() => {
  cleanup();
});

let seq = 0;
const port = (o: Record<string, unknown>) => ({
  id: `wsl|${++seq}|3000`,
  role: null,
  orphan: false,
  source: "wsl",
  port: 3000,
  addresses: ["127.0.0.1"],
  exposure: "local",
  pid: 100,
  process: "node",
  path: null,
  commandLine: null,
  warning: null,
  killCommand: "kill 100",
  relevant: true,
  project: null,
  ...o,
});
const body = (ports: unknown[], windows: unknown = { ok: true }, groups: unknown[] = []) => ({
  generatedAt: "2026-11-17T10:00:00.000Z",
  sources: { wsl: { ok: true }, windows },
  ports,
  groups,
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
              addresses: ["0.0.0.0", "::"],
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

  it("błąd API pokazuje komunikat", async () => {
    const apiFetch = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ error: "zepsute" }), { status: 500 })
      );
    render(<DiagnosticsView apiFetch={apiFetch} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się pobrać portów: zepsute"
    );
  });

  it("filtr bez wyników pokazuje komunikat o filtrze", async () => {
    render(<DiagnosticsView apiFetch={fetchOf(body([port({})]))} />);
    await screen.findByText("node");
    await userEvent.type(screen.getByRole("searchbox", { name: "Filtr portów" }), "zzz");
    expect(screen.getByText("Brak wyników dla filtra.")).toBeInTheDocument();
  });

  it("pusta nazwa procesu pokazuje (nieznany)", async () => {
    render(<DiagnosticsView apiFetch={fetchOf(body([port({ process: "" })]))} />);
    expect(await screen.findByText("(nieznany)")).toBeInTheDocument();
  });

  it("odrzucony schowek pokazuje komunikat o błędzie kopiowania", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<DiagnosticsView apiFetch={fetchOf(body([port({})]))} />);
    await userEvent.click(await screen.findByRole("button", { name: /Kopiuj kill/ }));
    expect(await screen.findByText("Nie udało się skopiować")).toBeInTheDocument();
  });

  it("sortowanie po procesie zmienia kolejność wierszy", async () => {
    render(
      <DiagnosticsView
        apiFetch={fetchOf(
          body([
            port({ port: 80, process: "zeta", pid: 1 }),
            port({ port: 90, process: "alfa", pid: 2 }),
          ])
        )}
      />
    );
    await screen.findByText("zeta");
    const firstPort = () => document.querySelector("tbody tr .diag-port")?.textContent;
    expect(firstPort()).toBe("80");
    await userEvent.selectOptions(screen.getByRole("combobox"), "process");
    expect(firstPort()).toBe("90");
  });

  it("pokazuje nazwę projektu przy procesie, a filtr znajduje po nazwie projektu", async () => {
    render(
      <DiagnosticsView
        apiFetch={fetchOf(
          body([
            port({ port: 5173, project: { id: "tester-ai", name: "TesterAI" } }),
            port({ port: 8001, process: "python", pid: 9 }),
          ])
        )}
      />
    );
    expect(await screen.findByText("TesterAI")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox", { name: "Filtr portów" }), "tester");
    expect(screen.getByText("TesterAI")).toBeInTheDocument();
    expect(screen.queryByText("python")).not.toBeInTheDocument();
  });

  it("domyślnie ukrywa porty nieaplikacyjne, a checkbox pokazuje wszystkie", async () => {
    render(
      <DiagnosticsView
        apiFetch={fetchOf(
          body([port({}), port({ port: 6463, process: "Discord", pid: 5, relevant: false })])
        )}
      />
    );
    await screen.findByText("node");
    expect(screen.queryByText("Discord")).not.toBeInTheDocument();
    expect(screen.getByText(/Ukryto: 1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Pokaż wszystkie porty" }));
    expect(screen.getByText("Discord")).toBeInTheDocument();
    expect(screen.queryByText(/Ukryto/)).not.toBeInTheDocument();
  });

  it("gdy wszystko jest ukryte, podpowiada checkbox", async () => {
    render(
      <DiagnosticsView apiFetch={fetchOf(body([port({ process: "Discord", relevant: false })]))} />
    );
    expect(await screen.findByText(/zaznacz „Pokaż wszystkie porty”/)).toBeInTheDocument();
  });

  it("pokazuje scalone adresy IPv4/IPv6 w jednym wierszu", async () => {
    render(
      <DiagnosticsView
        apiFetch={fetchOf(body([port({ addresses: ["0.0.0.0", "::"], exposure: "network" })]))}
      />
    );
    await screen.findByText("node");
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(screen.getByText("0.0.0.0")).toBeInTheDocument();
    expect(screen.getByText("::")).toBeInTheDocument();
  });

  describe("grupy aplikacji (frontend + backend)", () => {
    const TESTER = { id: "tester-ai", name: "Tester AI" };
    const front = () =>
      port({
        port: 5173,
        pid: 11,
        process: "node",
        project: TESTER,
        role: "frontend",
        killCommand: "kill 11",
      });
    const back = () =>
      port({
        port: 8001,
        pid: 22,
        process: "python",
        project: TESTER,
        role: "backend",
        killCommand: "kill 22",
      });
    const group = (o: Record<string, unknown> = {}) => ({
      projectId: "tester-ai",
      launcher: null,
      missingRole: null,
      ...o,
    });

    it("łączy frontend i backend tego samego projektu w jedną grupę z rolami i wspólnym rodzicem", async () => {
      render(
        <DiagnosticsView
          apiFetch={fetchOf(
            body([front(), back()], { ok: true }, [group({ launcher: { pid: 20, name: "node" } })])
          )}
        />
      );
      expect(await screen.findByText("frontend")).toBeInTheDocument();
      expect(screen.getByText("backend")).toBeInTheDocument();
      expect(screen.getByText("wspólny rodzic: node (PID 20)")).toBeInTheDocument();
      expect(document.querySelectorAll(".diag-group__head")).toHaveLength(1);
    });

    it("Kopiuj kill grupy składa komendy wierszy w jedną linię", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      render(
        <DiagnosticsView apiFetch={fetchOf(body([front(), back()], { ok: true }, [group()]))} />
      );
      await userEvent.click(await screen.findByRole("button", { name: "Kopiuj kill grupy" }));
      expect(writeText).toHaveBeenCalledWith("kill 11; kill 22");
    });

    it("Kopiuj kill grupy jest nieaktywny, gdy żaden wiersz nie ma komendy", async () => {
      const a = port({ project: TESTER, role: "frontend", pid: null, killCommand: null });
      const b = port({
        port: 8001,
        project: TESTER,
        role: "backend",
        pid: null,
        killCommand: null,
      });
      render(<DiagnosticsView apiFetch={fetchOf(body([a, b], { ok: true }, [group()]))} />);
      expect(await screen.findByRole("button", { name: "Kopiuj kill grupy" })).toBeDisabled();
    });

    it("pokazuje brakującą rolę także dla grupy z jednym procesem", async () => {
      render(
        <DiagnosticsView
          apiFetch={fetchOf(body([front()], { ok: true }, [group({ missingRole: "backend" })]))}
        />
      );
      expect(await screen.findByText("niekompletna: nie działa backend")).toBeInTheDocument();
    });

    it("pojedynczy proces projektu bez problemów ma nagłówek projektu bez przycisku grupy", async () => {
      render(<DiagnosticsView apiFetch={fetchOf(body([front()], { ok: true }, [group()]))} />);
      await screen.findByText("node");
      expect(document.querySelectorAll(".diag-group__head")).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "Kopiuj kill grupy" })).not.toBeInTheDocument();
    });

    it("oznacza sierotę", async () => {
      render(
        <DiagnosticsView
          apiFetch={fetchOf(body([{ ...front(), orphan: true }], { ok: true }, [group()]))}
        />
      );
      expect(await screen.findByText("możliwa sierota")).toBeInTheDocument();
    });

    it("dwa procesy tego samego projektu bez ról, rodzica i braków (np. dev i prod) mają nagłówek projektu, ale bez „Kopiuj kill grupy”", async () => {
      const dev = port({
        port: 3100,
        pid: 1,
        process: "next-server",
        project: { id: "m", name: "Monolith" },
        killCommand: "kill 1",
      });
      const prod = port({
        port: 3101,
        pid: 2,
        process: "next-server",
        project: { id: "m", name: "Monolith" },
        killCommand: "kill 2",
      });
      render(
        <DiagnosticsView
          apiFetch={fetchOf(
            body([dev, prod], { ok: true }, [{ projectId: "m", launcher: null, missingRole: null }])
          )}
        />
      );
      await screen.findAllByText("next-server");
      expect(document.querySelectorAll(".diag-group__head")).toHaveLength(1);
      expect(screen.getAllByText("Monolith")).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "Kopiuj kill grupy" })).not.toBeInTheDocument();
      expect(screen.queryByText("Pozostałe porty")).not.toBeInTheDocument();
    });

    it("porty spoza grup są pod nagłówkiem „Pozostałe porty”, gdy istnieje grupa", async () => {
      const other = port({ port: 5398, pid: 9, process: "postgres", killCommand: "kill 9" });
      render(
        <DiagnosticsView
          apiFetch={fetchOf(
            body([front(), back(), other], { ok: true }, [
              group({ launcher: { pid: 20, name: "node" } }),
            ])
          )}
        />
      );
      await screen.findByText("postgres");
      const heads = [...document.querySelectorAll(".diag-group__head")].map((h) => h.textContent);
      expect(heads).toHaveLength(2);
      expect(heads[1]).toContain("Pozostałe porty");
      // postgres jest po nagłówku „Pozostałe”, a frontend/backend przed nim
      const cells = [...document.querySelectorAll("tbody tr")].map((r) => r.textContent ?? "");
      const iOther = cells.findIndex((c) => c.includes("Pozostałe porty"));
      expect(cells.findIndex((c) => c.includes("postgres"))).toBeGreaterThan(iOther);
      expect(cells.findIndex((c) => c.includes("frontend"))).toBeLessThan(iOther);
    });

    it("wiersz z projektem nigdy nie ląduje w „Pozostałych portach”", async () => {
      const mono = port({
        port: 3100,
        pid: 5,
        process: "next-server",
        project: { id: "m", name: "Monolith" },
      });
      const other = port({ port: 5398, pid: 9, process: "postgres" });
      render(
        <DiagnosticsView
          apiFetch={fetchOf(
            body([mono, other], { ok: true }, [
              { projectId: "m", launcher: null, missingRole: null },
            ])
          )}
        />
      );
      await screen.findByText("postgres");
      const rows = [...document.querySelectorAll("tbody tr")].map((r) => r.textContent ?? "");
      const iOther = rows.findIndex((c) => c.includes("Pozostałe porty"));
      expect(iOther).toBeGreaterThan(-1);
      expect(rows.findIndex((c) => c.includes("next-server"))).toBeLessThan(iOther);
      expect(rows.findIndex((c) => c.includes("postgres"))).toBeGreaterThan(iOther);
    });

    it("bez żadnej grupy lista jest płaska i nie ma nagłówka „Pozostałe porty”", async () => {
      render(<DiagnosticsView apiFetch={fetchOf(body([port({})], { ok: true }, []))} />);
      await screen.findByText("node");
      expect(screen.queryByText("Pozostałe porty")).not.toBeInTheDocument();
    });

    it("wiersz projektu bez wpisu w groups też trafia do bloku projektu (bez przycisku grupy)", async () => {
      render(<DiagnosticsView apiFetch={fetchOf(body([front()], { ok: true }, []))} />);
      expect(await screen.findByText("node")).toBeInTheDocument();
      expect(document.querySelectorAll(".diag-group__head")).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "Kopiuj kill grupy" })).not.toBeInTheDocument();
    });
  });

  it("pusta lista pokazuje komunikat", async () => {
    render(<DiagnosticsView apiFetch={fetchOf(body([]))} />);
    expect(await screen.findByText("Brak nasłuchujących portów.")).toBeInTheDocument();
  });
});
