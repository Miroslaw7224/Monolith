# Karta Diagnostyka (porty nasłuchujące) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dziesiąta karta „Diagnostyka” (Alt+0) pokazuje porty TCP w stanie LISTEN z WSL (`ss`) i Windows (PowerShell), z nazwą procesu i przyciskiem „Kopiuj kill”; aplikacja niczego nie zabija ani nie zapisuje.

**Architecture:** Nowa infrastruktura `lib/ports/` (jedyne miejsce z `child_process`/`fs`; czyste parsery osobno od procesów, wstrzykiwane zależności do testów) i nowy kontekst `contexts/bc_diagnostics/` (pięć plików wg ADR-021) z jednym endpointem `GET /api/diagnostics/ports`. UI to `src/features/diagnostics/` importujące z kontekstu tylko `schemas`; karta rejestrowana jak Kodeks (widok „standalone”).

**Tech Stack:** Next.js 14, TypeScript, zod, Vitest + Testing Library, i18next (PL/EN).

**Spec:** `docs/superpowers/specs/2026-11-17-diagnostyka-porty-design.md` (decyzje D1–D9). Gałąź: `feat/diagnostyka-porty` (spec już zacommitowany jako 76b8d81).

**Zasady wykonania (CLAUDE.md):**

- Testy, lint, typecheck, build deleguj do `cursor` (`scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "…"`, odpowiedź „przeszło” albo lista `plik:linia + przyczyna`). Komendy w planie są do uruchomienia przez pomocnika lub ręcznie.
- `tests/unit/architecture.static.test.ts` ma przechodzić **bez edycji**; gdyby wymagał zmiany, to osobny commit, nigdy razem z kodem.
- Commity na końcu każdego zadania. Wiadomości kończą się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Brak commitu `push`/PR bez prośby użytkownika.

## Odchylenia od specu (do akceptacji w review planu)

1. **Skrypt PowerShell**: spec mówi `@(...) | ConvertTo-Json`, ale w PS 5.1 potok rozpakowuje tablicę, więc jeden element dałby obiekt, nie tablicę. Używamy `ConvertTo-Json -InputObject $rows -Compress` (zawsze tablica, pusta daje `[]`). Parser i tak toleruje pojedynczy obiekt (jak w specu). Dodajemy `[Console]::OutputEncoding = UTF8`, żeby polskie znaki w ścieżkach nie zostały zniekształcone.
2. **`killCommand` w modelu**: spec dodaje je dopiero w DTO, ale `schemas` nie może importować `services`, więc `killCommand` liczy `services` i trzyma w `PortListener` (`models.ts`). DTO = model 1:1.
3. **Dodatkowy typ `SourceEntry`** w `models.ts` (wiersz źródła przed klasyfikacją `exposure`/`warning`/`killCommand`), żeby `repositories` zwracały model bez reguł domeny.
4. **Redakcja D8** rozszerzona o prefiksy zmiennych (`API_TOKEN=`, `DB_PASSWORD=`) i bez rozróżniania wielkości liter; poza tym zgodnie ze specem.
5. **`tokens.css` makiet**: test `cardsCss.test.ts` wymaga `--c-diagnostyka` i bloku `[data-card="diagnostyka"] {` także w `docs/mockups/karty/tokens.css`; spec tego nie wymienia, plan dodaje.
6. **Kolor karty**: `#cbd5e1` (neutralna „stal”; pozostałe kolory są już zajęte przez sąsiednie odcienie). Do zmiany w review, jeśli wolisz inny.

## Struktura plików

**Tworzone:**

- `lib/ports/types.ts`: `RawListener`, `SourceResult`.
- `lib/ports/run.ts`: `runCommand` (async `execFile`, bez powłoki, nigdy nie rzuca).
- `lib/ports/parse-ss.ts`: czysty `parseSs`.
- `lib/ports/parse-windows.ts`: czysty `parseWindowsJson`.
- `lib/ports/wsl.ts`: `listWslListeners`.
- `lib/ports/windows.ts`: `listWindowsListeners`, stała `WINDOWS_SCRIPT`.
- `contexts/bc_diagnostics/{models,repositories,services,schemas,router}.ts`.
- `app/api/diagnostics/ports/route.ts`.
- `src/features/diagnostics/{useDiagnostics.ts,DiagnosticsView.tsx,diagnostics.css}`.
- `src/i18n/locales/{pl,en}/diagnostics.ts`.
- `docs/mockups/karty/cards/10-diagnostyka.html`.
- Testy: `tests/unit/lib/ports/{run,parse-ss,parse-windows,wsl,windows}.test.ts`, `tests/unit/contexts/bc_diagnostics/{repositories,services,schemas,router}.test.ts`, `tests/unit/features/diagnostics/{useDiagnostics.test.tsx,DiagnosticsView.test.tsx}`.

**Modyfikowane:** `src/features/cards/{cards.ts,useCardHotkeys.ts,useCardNavigation.ts,cards.css}`, `src/App.tsx`, `src/i18n/{resources.ts,index.ts}`, `src/i18n/locales/{pl,en}/shell.ts`, `docs/mockups/karty/{tokens.css,shell.js,index.html}`, `CLAUDE.md`, testy kart (zadanie 7).

---

### Task 1: `lib/ports` — typy, `runCommand`, `parseSs`

**Files:**

- Create: `lib/ports/types.ts`, `lib/ports/run.ts`, `lib/ports/parse-ss.ts`
- Test: `tests/unit/lib/ports/run.test.ts`, `tests/unit/lib/ports/parse-ss.test.ts`

- [ ] **Step 1: Napisz test `parseSs`**

`tests/unit/lib/ports/parse-ss.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseSs } from "@/lib/ports/parse-ss";

describe("parseSs", () => {
  it("czyta port, adres, PID i nazwę procesu", () => {
    const raw =
      'LISTEN 0      511        127.0.0.1:3101       0.0.0.0:*    users:(("next-server (v1",pid=2562323,fd=22))\n';
    expect(parseSs(raw)).toEqual([
      {
        port: 3101,
        address: "127.0.0.1",
        pid: 2562323,
        process: "next-server (v1",
        path: null,
        commandLine: null,
      },
    ]);
  });

  it("wiersz bez users: ma pid null i process null", () => {
    const [row] = parseSs("LISTEN 0      4096              *:5434             *:*\n");
    expect(row).toMatchObject({ port: 5434, address: "*", pid: null, process: null });
  });

  it("dzieli po ostatnim dwukropku i zdejmuje nawiasy IPv6", () => {
    const [row] = parseSs("LISTEN 0 128 [::]:22 [::]:*\n");
    expect(row).toMatchObject({ port: 22, address: "::" });
  });

  it("zdejmuje %iface z adresu", () => {
    const [a] = parseSs("LISTEN 0 128 [fe80::1%eth0]:8080 [::]:*\n");
    expect(a).toMatchObject({ port: 8080, address: "fe80::1" });
    const [b] = parseSs("LISTEN 0 4096 127.0.0.53%lo:53 0.0.0.0:*\n");
    expect(b).toMatchObject({ port: 53, address: "127.0.0.53" });
  });

  it("z kilku procesów bierze pierwszy", () => {
    const [row] = parseSs(
      'LISTEN 0 1 0.0.0.0:80 0.0.0.0:* users:(("a",pid=1,fd=3),("b",pid=2,fd=4))\n'
    );
    expect(row).toMatchObject({ process: "a", pid: 1 });
  });

  it("pusty wynik, śmieci i nagłówek dają []", () => {
    expect(parseSs("")).toEqual([]);
    expect(parseSs("State Recv-Q Send-Q Local Address:Port Peer Address:Port\n")).toEqual([]);
    expect(parseSs("LISTEN 0 1 bezportu 0.0.0.0:*\n")).toEqual([]);
  });
});
```

- [ ] **Step 2: Uruchom test, ma paść**

Run: `npx vitest run tests/unit/lib/ports/parse-ss.test.ts`
Expected: FAIL (`Failed to resolve import "@/lib/ports/parse-ss"`).

- [ ] **Step 3: Napisz typy i `parseSs`**

`lib/ports/types.ts`:

```ts
/** Surowy nasłuchujący port z jednego źródła (bez reguł domeny). */
export type RawListener = {
  port: number;
  address: string;
  pid: number | null;
  process: string | null;
  path: string | null;
  commandLine: string | null;
};

export type SourceFailureReason = "missing" | "timeout" | "error";

export type SourceResult =
  | { ok: true; listeners: RawListener[] }
  | { ok: false; reason: SourceFailureReason };
```

`lib/ports/parse-ss.ts`:

```ts
import type { RawListener } from "./types";

const OWNER = /users:\(\("((?:[^"\\]|\\.)*)",pid=(\d+)/;

function splitLocal(local: string): { address: string; port: number } | null {
  const i = local.lastIndexOf(":");
  if (i <= 0) return null;
  const port = Number(local.slice(i + 1));
  if (!Number.isInteger(port) || port < 0 || port > 65535) return null;
  let address = local.slice(0, i);
  if (address.startsWith("[") && address.endsWith("]")) address = address.slice(1, -1);
  const pct = address.indexOf("%");
  if (pct >= 0) address = address.slice(0, pct);
  return { address, port };
}

/** Zrzut `ss -ltnpH`: `LISTEN Recv-Q Send-Q Local Peer [users:(("nazwa",pid=N,fd=M),…)]`. */
export function parseSs(raw: string): RawListener[] {
  const out: RawListener[] = [];
  for (const line of raw.split("\n")) {
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] !== "LISTEN" || tokens.length < 5) continue;
    const local = splitLocal(tokens[3]);
    if (!local) continue;
    const owner = OWNER.exec(line);
    out.push({
      port: local.port,
      address: local.address,
      pid: owner ? Number(owner[2]) : null,
      process: owner ? owner[1] : null,
      path: null,
      commandLine: null,
    });
  }
  return out;
}
```

- [ ] **Step 4: Uruchom test, ma przejść**

Run: `npx vitest run tests/unit/lib/ports/parse-ss.test.ts`
Expected: PASS (6 testów).

- [ ] **Step 5: Test `runCommand`**

`tests/unit/lib/ports/run.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { runCommand } from "@/lib/ports/run";

describe("runCommand", () => {
  it("zwraca stdout", async () => {
    const r = await runCommand(process.execPath, ["-e", "process.stdout.write('ok')"], 5000);
    expect(r).toEqual({ ok: true, stdout: "ok" });
  });

  it("brak programu to missing", async () => {
    const r = await runCommand("/nie/ma/takiego-programu", [], 5000);
    expect(r).toEqual({ ok: false, reason: "missing" });
  });

  it("przekroczenie czasu to timeout", async () => {
    const r = await runCommand(process.execPath, ["-e", "setTimeout(()=>{},5000)"], 150);
    expect(r).toEqual({ ok: false, reason: "timeout" });
  });

  it("kod wyjścia ≠ 0 to error", async () => {
    const r = await runCommand(process.execPath, ["-e", "process.exit(3)"], 5000);
    expect(r).toEqual({ ok: false, reason: "error" });
  });
});
```

- [ ] **Step 6: Uruchom, ma paść; potem zaimplementuj `run.ts`**

Run: `npx vitest run tests/unit/lib/ports/run.test.ts` → FAIL (brak modułu).

`lib/ports/run.ts`:

```ts
import { execFile } from "node:child_process";
import type { SourceFailureReason } from "./types";

export type RunResult = { ok: true; stdout: string } | { ok: false; reason: SourceFailureReason };

export type RunFn = (
  file: string,
  args: readonly string[],
  timeoutMs?: number
) => Promise<RunResult>;

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_BUFFER = 2 * 1024 * 1024;

/**
 * Uruchamia program bez powłoki i bez blokowania pętli zdarzeń; nigdy nie rzuca.
 * `file` i `args` muszą być stałymi (nigdy danymi od użytkownika).
 */
export const runCommand: RunFn = (file, args, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  new Promise((resolve) => {
    try {
      execFile(
        file,
        [...args],
        { encoding: "utf8", timeout: timeoutMs, maxBuffer: MAX_BUFFER, windowsHide: true },
        (err, stdout) => {
          if (err) {
            const e = err as NodeJS.ErrnoException & { killed?: boolean };
            if (e.code === "ENOENT") resolve({ ok: false, reason: "missing" });
            else if (e.killed === true) resolve({ ok: false, reason: "timeout" });
            else resolve({ ok: false, reason: "error" });
            return;
          }
          resolve({ ok: true, stdout: String(stdout) });
        }
      );
    } catch {
      resolve({ ok: false, reason: "error" });
    }
  });
```

- [ ] **Step 7: Uruchom oba testy, ma przejść**

Run: `npx vitest run tests/unit/lib/ports/`
Expected: PASS (10 testów).

- [ ] **Step 8: Commit**

```bash
git add lib/ports tests/unit/lib/ports
git commit -m "feat(ports): typy, runCommand i parser ss"
```

---

### Task 2: `parseWindowsJson`

**Files:**

- Create: `lib/ports/parse-windows.ts`
- Test: `tests/unit/lib/ports/parse-windows.test.ts`

- [ ] **Step 1: Test**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseWindowsJson } from "@/lib/ports/parse-windows";

const ROW = {
  LocalAddress: "::1",
  LocalPort: 42050,
  OwningProcess: 59140,
  Name: "OneDrive.Sync.Service",
  Path: "C:\\Users\\u\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.Sync.Service.exe",
  CommandLine: null,
};

describe("parseWindowsJson", () => {
  it("czyta tablicę obiektów, null w CommandLine zostaje null", () => {
    expect(parseWindowsJson(JSON.stringify([ROW]))).toEqual([
      {
        port: 42050,
        address: "::1",
        pid: 59140,
        process: "OneDrive.Sync.Service",
        path: ROW.Path,
        commandLine: null,
      },
    ]);
  });

  it("pojedynczy obiekt traktuje jak tablicę jednoelementową", () => {
    expect(parseWindowsJson(JSON.stringify(ROW))).toHaveLength(1);
  });

  it("pusty tekst i [] dają []", () => {
    expect(parseWindowsJson("")).toEqual([]);
    expect(parseWindowsJson("  \n")).toEqual([]);
    expect(parseWindowsJson("[]")).toEqual([]);
  });

  it("pomija wpisy bez poprawnego portu, braki nazwy i PID daje null", () => {
    const rows = [
      { LocalAddress: "0.0.0.0", LocalPort: "x" },
      { LocalAddress: "0.0.0.0", LocalPort: 80 },
    ];
    expect(parseWindowsJson(JSON.stringify(rows))).toEqual([
      { port: 80, address: "0.0.0.0", pid: null, process: null, path: null, commandLine: null },
    ]);
  });

  it("niepoprawny JSON rzuca wyjątek (źródło oznaczy go jako error)", () => {
    expect(() => parseWindowsJson("{nie json")).toThrow();
  });
});
```

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/ports/parse-windows.test.ts` → FAIL (brak modułu).

- [ ] **Step 3: Implementacja**

`lib/ports/parse-windows.ts`:

```ts
import type { RawListener } from "./types";

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/**
 * Wyjście skryptu z `windows.ts`: tablica (lub pojedynczy obiekt) z polami
 * `LocalAddress, LocalPort, OwningProcess, Name, Path, CommandLine`. Rzuca przy niepoprawnym JSON.
 */
export function parseWindowsJson(raw: string): RawListener[] {
  const text = raw.trim();
  if (text === "") return [];
  const doc: unknown = JSON.parse(text);
  const list = Array.isArray(doc) ? doc : [doc];
  const out: RawListener[] = [];
  for (const item of list) {
    if (item === null || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const port = r.LocalPort;
    if (typeof port !== "number" || !Number.isInteger(port) || port < 0 || port > 65535) continue;
    out.push({
      port,
      address: str(r.LocalAddress) ?? "",
      pid:
        typeof r.OwningProcess === "number" && Number.isInteger(r.OwningProcess)
          ? r.OwningProcess
          : null,
      process: str(r.Name),
      path: str(r.Path),
      commandLine: str(r.CommandLine),
    });
  }
  return out;
}
```

- [ ] **Step 4: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/lib/ports/parse-windows.test.ts` → PASS (5).

- [ ] **Step 5: Commit**

```bash
git add lib/ports/parse-windows.ts tests/unit/lib/ports/parse-windows.test.ts
git commit -m "feat(ports): parser JSON z Get-NetTCPConnection"
```

---

### Task 3: źródła `wsl.ts` i `windows.ts`

**Files:**

- Create: `lib/ports/wsl.ts`, `lib/ports/windows.ts`
- Test: `tests/unit/lib/ports/wsl.test.ts`, `tests/unit/lib/ports/windows.test.ts`

- [ ] **Step 1: Testy**

`tests/unit/lib/ports/wsl.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { listWslListeners } from "@/lib/ports/wsl";

const SS =
  'LISTEN 0 511 127.0.0.1:3101 0.0.0.0:* users:(("next-server (v1",pid=2562323,fd=22))\nLISTEN 0 4096 *:5434 *:*\n';

describe("listWslListeners", () => {
  it("woła ss ze stałymi argumentami i dopisuje commandLine z /proc", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, stdout: SS });
    const readCmdline = vi.fn().mockResolvedValue("node server.js --port 3101");
    const r = await listWslListeners({ run, readCmdline });
    expect(run).toHaveBeenCalledWith("ss", ["-ltnpH"], 8000);
    expect(readCmdline).toHaveBeenCalledTimes(1);
    expect(readCmdline).toHaveBeenCalledWith(2562323);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) {
      expect(r.listeners[0].commandLine).toBe("node server.js --port 3101");
      expect(r.listeners[1]).toMatchObject({ pid: null, commandLine: null });
    }
  });

  it("błąd odczytu cmdline daje null, nie psuje źródła", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, stdout: SS });
    const r = await listWslListeners({ run, readCmdline: vi.fn().mockResolvedValue(null) });
    expect(r.ok && r.listeners[0].commandLine).toBeNull();
  });

  it("propaguje niepowodzenie uruchomienia", async () => {
    const run = vi.fn().mockResolvedValue({ ok: false, reason: "missing" });
    expect(await listWslListeners({ run, readCmdline: vi.fn() })).toEqual({
      ok: false,
      reason: "missing",
    });
  });
});
```

`tests/unit/lib/ports/windows.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { WINDOWS_SCRIPT, POWERSHELL_PATH, listWindowsListeners } from "@/lib/ports/windows";

describe("listWindowsListeners", () => {
  it("woła PowerShell ze stałą ścieżką i skryptem", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, stdout: "[]" });
    const r = await listWindowsListeners({ run });
    expect(run).toHaveBeenCalledWith(
      POWERSHELL_PATH,
      ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_SCRIPT],
      8000
    );
    expect(r).toEqual({ ok: true, listeners: [] });
  });

  it("skrypt jest stałą bez cudzysłowów i kończy się ConvertTo-Json", () => {
    expect(WINDOWS_SCRIPT).not.toContain('"');
    expect(WINDOWS_SCRIPT).toMatch(/ConvertTo-Json -InputObject \$rows -Compress$/);
  });

  it("brak powershell.exe to missing", async () => {
    const run = vi.fn().mockResolvedValue({ ok: false, reason: "missing" });
    expect(await listWindowsListeners({ run })).toEqual({ ok: false, reason: "missing" });
  });

  it("niepoprawny JSON to error", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, stdout: "{nie json" });
    expect(await listWindowsListeners({ run })).toEqual({ ok: false, reason: "error" });
  });
});
```

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/ports/wsl.test.ts tests/unit/lib/ports/windows.test.ts` → FAIL (brak modułów).

- [ ] **Step 3: Implementacja**

`lib/ports/wsl.ts`:

```ts
import { readFile } from "node:fs/promises";
import { parseSs } from "./parse-ss";
import { runCommand, type RunFn } from "./run";
import type { SourceResult } from "./types";

export interface WslDeps {
  run: RunFn;
  readCmdline: (pid: number) => Promise<string | null>;
}

async function readProcCmdline(pid: number): Promise<string | null> {
  try {
    const raw = await readFile(`/proc/${pid}/cmdline`, "utf8");
    const text = raw
      .split("\0")
      .filter((p) => p !== "")
      .join(" ");
    return text === "" ? null : text;
  } catch {
    return null;
  }
}

const DEFAULT_DEPS: WslDeps = { run: runCommand, readCmdline: readProcCmdline };

/** Porty LISTEN w WSL: `ss -ltnpH` + `/proc/<pid>/cmdline`. Nigdy nie rzuca. */
export async function listWslListeners(deps: WslDeps = DEFAULT_DEPS): Promise<SourceResult> {
  const res = await deps.run("ss", ["-ltnpH"], 8000);
  if (!res.ok) return { ok: false, reason: res.reason };
  const listeners = parseSs(res.stdout);
  const pids = [...new Set(listeners.flatMap((l) => (l.pid === null ? [] : [l.pid])))];
  const cmdlines = new Map<number, string | null>(
    await Promise.all(pids.map(async (pid) => [pid, await deps.readCmdline(pid)] as const))
  );
  return {
    ok: true,
    listeners: listeners.map((l) => ({
      ...l,
      commandLine: l.pid === null ? null : (cmdlines.get(l.pid) ?? null),
    })),
  };
}
```

`lib/ports/windows.ts`:

```ts
import { parseWindowsJson } from "./parse-windows";
import { runCommand, type RunFn } from "./run";
import type { SourceResult } from "./types";

export const POWERSHELL_PATH = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";

/** Stały skrypt (bez danych od użytkownika, bez cudzysłowów). Zawsze zwraca tablicę JSON. */
export const WINDOWS_SCRIPT = [
  "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
  "$cmd = @{}",
  "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object { $cmd[[int]$_.ProcessId] = $_.CommandLine }",
  "$proc = @{}",
  "Get-Process -ErrorAction SilentlyContinue | ForEach-Object { $proc[[int]$_.Id] = $_ }",
  "$rows = @(Get-NetTCPConnection -State Listen | ForEach-Object { $p = $proc[[int]$_.OwningProcess]; [pscustomobject]@{ LocalAddress = $_.LocalAddress; LocalPort = $_.LocalPort; OwningProcess = $_.OwningProcess; Name = $p.ProcessName; Path = $p.Path; CommandLine = $cmd[[int]$_.OwningProcess] } })",
  "ConvertTo-Json -InputObject $rows -Compress",
].join("; ");

export interface WindowsDeps {
  run: RunFn;
}

/** Porty LISTEN w Windows przez interop WSL. Nigdy nie rzuca. */
export async function listWindowsListeners(
  deps: WindowsDeps = { run: runCommand }
): Promise<SourceResult> {
  const res = await deps.run(
    POWERSHELL_PATH,
    ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_SCRIPT],
    8000
  );
  if (!res.ok) return { ok: false, reason: res.reason };
  try {
    return { ok: true, listeners: parseWindowsJson(res.stdout) };
  } catch {
    return { ok: false, reason: "error" };
  }
}
```

- [ ] **Step 4: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/lib/ports/` → PASS (wszystkie z zadań 1–3).

- [ ] **Step 5: Szybki test na prawdziwej maszynie (jednorazowo, bez zapisu)**

Run: `npx tsx -e "import('./lib/ports/windows.ts').then(async m=>{const t=Date.now();const r=await m.listWindowsListeners();console.log(r.ok?r.listeners.length:r.reason,Date.now()-t,'ms')})"`
Expected: liczba portów > 0 i czas w ms (zanotuj do sekcji ręcznej weryfikacji w zadaniu 11). Jeśli `tsx` niedostępny: pomiń, sprawdzimy w zadaniu 11 przez endpoint.

- [ ] **Step 6: Commit**

```bash
git add lib/ports tests/unit/lib/ports
git commit -m "feat(ports): źródła WSL (ss) i Windows (PowerShell)"
```

---

### Task 4: kontekst `bc_diagnostics` — `models` i `repositories`

**Files:**

- Create: `contexts/bc_diagnostics/models.ts`, `contexts/bc_diagnostics/repositories.ts`
- Test: `tests/unit/contexts/bc_diagnostics/repositories.test.ts`

- [ ] **Step 1: Test**

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWsl = vi.hoisted(() => vi.fn());
const mockWin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ports/wsl", () => ({ listWslListeners: mockWsl }));
vi.mock("@/lib/ports/windows", () => ({ listWindowsListeners: mockWin }));

import { readWindows, readWsl } from "@/contexts/bc_diagnostics/repositories";

beforeEach(() => {
  mockWsl.mockReset();
  mockWin.mockReset();
});

describe("repositories", () => {
  it("mapuje RawListener na SourceEntry ze znacznikiem źródła, brak nazwy to pusty tekst", async () => {
    mockWsl.mockResolvedValue({
      ok: true,
      listeners: [
        { port: 80, address: "*", pid: null, process: null, path: null, commandLine: null },
      ],
    });
    expect(await readWsl()).toEqual({
      ok: true,
      entries: [
        {
          source: "wsl",
          port: 80,
          address: "*",
          pid: null,
          process: "",
          path: null,
          commandLine: null,
        },
      ],
    });
  });

  it("niepowodzenie źródła przechodzi bez zmian", async () => {
    mockWin.mockResolvedValue({ ok: false, reason: "missing" });
    expect(await readWindows()).toEqual({ ok: false, reason: "missing" });
  });
});
```

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/contexts/bc_diagnostics/repositories.test.ts` → FAIL.

- [ ] **Step 3: Implementacja**

`contexts/bc_diagnostics/models.ts`:

```ts
export type SourceName = "wsl" | "windows";
export type SourceFailure = "missing" | "timeout" | "error";
export type Exposure = "local" | "network";
export type PortWarning = "self" | "system";

/** Wiersz ze źródła, przed regułami domeny. */
export type SourceEntry = {
  source: SourceName;
  port: number;
  address: string;
  pid: number | null;
  process: string;
  path: string | null;
  commandLine: string | null;
};

export type SourceRead =
  | { ok: true; entries: SourceEntry[] }
  | { ok: false; reason: SourceFailure };

export type PortListener = SourceEntry & {
  exposure: Exposure;
  warning: PortWarning | null;
  killCommand: string | null;
};

export type SourceStatus = { ok: true } | { ok: false; reason: SourceFailure };

export type PortsSnapshot = {
  generatedAt: string;
  sources: Record<SourceName, SourceStatus>;
  ports: PortListener[];
};
```

`contexts/bc_diagnostics/repositories.ts`:

```ts
import { listWindowsListeners } from "@/lib/ports/windows";
import { listWslListeners } from "@/lib/ports/wsl";
import type { SourceResult } from "@/lib/ports/types";
import type { SourceName, SourceRead } from "./models";

function toRead(source: SourceName, result: SourceResult): SourceRead {
  if (!result.ok) return { ok: false, reason: result.reason };
  return {
    ok: true,
    entries: result.listeners.map((l) => ({
      source,
      port: l.port,
      address: l.address,
      pid: l.pid,
      process: l.process ?? "",
      path: l.path,
      commandLine: l.commandLine,
    })),
  };
}

export async function readWsl(): Promise<SourceRead> {
  return toRead("wsl", await listWslListeners());
}

export async function readWindows(): Promise<SourceRead> {
  return toRead("windows", await listWindowsListeners());
}
```

- [ ] **Step 4: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/contexts/bc_diagnostics/repositories.test.ts` → PASS (2).

- [ ] **Step 5: Test architektury (bez edycji)**

Run: `npx vitest run tests/unit/architecture.static.test.ts`
Expected: PASS. Jeśli pęka: naprawić kodem, nie testem.

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_diagnostics tests/unit/contexts/bc_diagnostics
git commit -m "feat(diagnostics): modele i repozytorium (źródła WSL i Windows)"
```

---

### Task 5: `services` — reguły domeny

**Files:**

- Create: `contexts/bc_diagnostics/services.ts`
- Test: `tests/unit/contexts/bc_diagnostics/services.test.ts`

Interfejs (eksporty): `classifyExposure(address)`, `redactCommand(cmd)`, `buildKillCommand(source, pid)`, `listPorts(opts?: { selfPid?: number; now?: () => Date })`.

- [ ] **Step 1: Test**

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceEntry, SourceRead } from "@/contexts/bc_diagnostics/models";

const mockWsl = vi.hoisted(() => vi.fn());
const mockWin = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_diagnostics/repositories", () => ({
  readWsl: mockWsl,
  readWindows: mockWin,
}));

import {
  buildKillCommand,
  classifyExposure,
  listPorts,
  redactCommand,
} from "@/contexts/bc_diagnostics/services";

const entry = (o: Partial<SourceEntry> = {}): SourceEntry => ({
  source: "wsl",
  port: 3000,
  address: "127.0.0.1",
  pid: 100,
  process: "node",
  path: null,
  commandLine: null,
  ...o,
});
const ok = (...entries: SourceEntry[]): SourceRead => ({ ok: true, entries });
const NOW = () => new Date("2026-11-17T10:00:00.000Z");

beforeEach(() => {
  mockWsl.mockReset().mockResolvedValue(ok());
  mockWin.mockReset().mockResolvedValue(ok());
});

describe("classifyExposure", () => {
  it.each(["127.0.0.1", "127.0.0.53", "::1", "::ffff:127.0.0.1"])("%s to local", (a) => {
    expect(classifyExposure(a)).toBe("local");
  });
  it.each(["0.0.0.0", "::", "*", "10.255.255.254", "192.168.1.5"])("%s to network", (a) => {
    expect(classifyExposure(a)).toBe("network");
  });
});

describe("buildKillCommand", () => {
  it("składa komendę wyłącznie z PID", () => {
    expect(buildKillCommand("wsl", 2562323)).toBe("kill 2562323");
    expect(buildKillCommand("windows", 2562323)).toBe("Stop-Process -Id 2562323");
  });
  it.each([null, 0, -5, 1.5, Number.NaN])("PID %s daje null", (pid) => {
    expect(buildKillCommand("wsl", pid)).toBeNull();
  });
});

describe("redactCommand", () => {
  it("maskuje tokeny, hasła i sekrety", () => {
    expect(redactCommand("node app.js --token=abc123 --port 80")).toBe(
      "node app.js --token=*** --port 80"
    );
    expect(redactCommand("x --password=p --secret=s --api-key=k")).toBe(
      "x --password=*** --secret=*** --api-key=***"
    );
    expect(redactCommand("API_TOKEN=abc DB_PASSWORD=zzz node a.js")).toBe(
      "API_TOKEN=*** DB_PASSWORD=*** node a.js"
    );
  });
  it("maskuje hasło w URL", () => {
    expect(redactCommand("x postgres://user:haslo@host/db")).toBe("x postgres://user:***@host/db");
  });
  it("ucina do 200 znaków po redakcji", () => {
    expect(redactCommand("a".repeat(500))).toHaveLength(200);
  });
  it("null zostaje null", () => {
    expect(redactCommand(null)).toBeNull();
  });
});

describe("listPorts", () => {
  it("awaria Windows nie psuje listy WSL", async () => {
    mockWsl.mockResolvedValue(ok(entry()));
    mockWin.mockResolvedValue({ ok: false, reason: "missing" });
    const r = await listPorts({ now: NOW });
    expect(r.ports).toHaveLength(1);
    expect(r.sources).toEqual({ wsl: { ok: true }, windows: { ok: false, reason: "missing" } });
    expect(r.generatedAt).toBe("2026-11-17T10:00:00.000Z");
  });

  it("odrzucona obietnica źródła to reason error", async () => {
    mockWsl.mockRejectedValue(new Error("boom"));
    const r = await listPorts({ now: NOW });
    expect(r.sources.wsl).toEqual({ ok: false, reason: "error" });
  });

  it("ten sam port z różnymi PID w WSL i Windows to dwa wiersze", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: 1 })));
    mockWin.mockResolvedValue(ok(entry({ source: "windows", pid: 2 })));
    expect((await listPorts({ now: NOW })).ports).toHaveLength(2);
  });

  it("deduplikuje po (source, pid, port, address)", async () => {
    mockWsl.mockResolvedValue(ok(entry(), entry()));
    expect((await listPorts({ now: NOW })).ports).toHaveLength(1);
  });

  it("sortuje po porcie, potem źródle (wsl przed windows)", async () => {
    mockWsl.mockResolvedValue(ok(entry({ port: 8080 }), entry({ port: 22 })));
    mockWin.mockResolvedValue(ok(entry({ source: "windows", port: 22, pid: 9 })));
    const r = await listPorts({ now: NOW });
    expect(r.ports.map((p) => `${p.port}/${p.source}`)).toEqual([
      "22/wsl",
      "22/windows",
      "8080/wsl",
    ]);
  });

  it("PID serwera Monolith w WSL to self; ten sam numer w Windows to null", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: 777, port: 3100 })));
    mockWin.mockResolvedValue(ok(entry({ source: "windows", pid: 777, port: 3101 })));
    const r = await listPorts({ selfPid: 777, now: NOW });
    expect(r.ports.find((p) => p.source === "wsl")?.warning).toBe("self");
    expect(r.ports.find((p) => p.source === "windows")?.warning).toBeNull();
  });

  it("procesy systemowe Windows dostają system (bez rozróżniania wielkości liter)", async () => {
    mockWin.mockResolvedValue(ok(entry({ source: "windows", process: "lsass", pid: 5 })));
    expect((await listPorts({ now: NOW })).ports[0].warning).toBe("system");
  });

  it("buduje killCommand, redaguje commandLine i nie bierze nic z nazwy procesu", async () => {
    mockWsl.mockResolvedValue(
      ok(entry({ process: "x; rm -rf ~", pid: 42, commandLine: "srv --token=abc" }))
    );
    const [p] = (await listPorts({ now: NOW })).ports;
    expect(p.killCommand).toBe("kill 42");
    expect(p.killCommand).not.toContain("rm");
    expect(p.commandLine).toBe("srv --token=***");
  });

  it("wiersz bez PID ma killCommand null", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: null })));
    expect((await listPorts({ now: NOW })).ports[0].killCommand).toBeNull();
  });
});
```

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/contexts/bc_diagnostics/services.test.ts` → FAIL (brak eksportów).

- [ ] **Step 3: Implementacja**

`contexts/bc_diagnostics/services.ts`:

```ts
import type {
  Exposure,
  PortListener,
  PortsSnapshot,
  PortWarning,
  SourceEntry,
  SourceName,
  SourceRead,
  SourceStatus,
} from "./models";
import { readWindows, readWsl } from "./repositories";

const MAX_COMMAND = 200;
const SYSTEM_PROCESSES = new Set([
  "system",
  "lsass",
  "services",
  "wininit",
  "svchost",
  "csrss",
  "smss",
]);
const SOURCE_ORDER: Record<SourceName, number> = { wsl: 0, windows: 1 };

export function classifyExposure(address: string): Exposure {
  const a = address.toLowerCase();
  if (/^127\./.test(a) || a === "::1" || a.startsWith("::ffff:127.")) return "local";
  return "network";
}

/** Komenda kill powstaje wyłącznie z całkowitego dodatniego PID-a (nigdy z nazwy ani komendy procesu). */
export function buildKillCommand(source: SourceName, pid: number | null): string | null {
  if (pid === null || !Number.isInteger(pid) || pid <= 0) return null;
  return source === "wsl" ? `kill ${pid}` : `Stop-Process -Id ${pid}`;
}

/** D8: maskuje sekrety, potem ucina do 200 znaków. */
export function redactCommand(command: string | null): string | null {
  if (command === null) return null;
  const masked = command
    .replace(/(--(?:token|password|secret|api-key)=)\S+/gi, "$1***")
    .replace(/(\b[A-Za-z0-9_]*(?:TOKEN|PASSWORD|SECRET)=)\S+/gi, "$1***")
    .replace(/(:\/\/[^\s:@/]+:)[^\s@/]+@/g, "$1***@");
  return masked.slice(0, MAX_COMMAND);
}

function warningFor(entry: SourceEntry, selfPid: number): PortWarning | null {
  if (entry.source === "wsl" && entry.pid === selfPid) return "self";
  if (entry.source === "windows" && SYSTEM_PROCESSES.has(entry.process.toLowerCase()))
    return "system";
  return null;
}

function settle(result: PromiseSettledResult<SourceRead>): SourceRead {
  return result.status === "fulfilled" ? result.value : { ok: false, reason: "error" };
}

const statusOf = (read: SourceRead): SourceStatus =>
  read.ok ? { ok: true } : { ok: false, reason: read.reason };

export interface ListPortsOptions {
  /** PID serwera Monolith (domyślnie `process.pid`); tylko do testów. */
  selfPid?: number;
  now?: () => Date;
}

export async function listPorts(options: ListPortsOptions = {}): Promise<PortsSnapshot> {
  const selfPid = options.selfPid ?? process.pid;
  const now = options.now ?? (() => new Date());
  const [wslRes, winRes] = await Promise.allSettled([readWsl(), readWindows()]);
  const wsl = settle(wslRes);
  const windows = settle(winRes);

  const seen = new Set<string>();
  const ports: PortListener[] = [];
  for (const read of [wsl, windows]) {
    if (!read.ok) continue;
    for (const e of read.entries) {
      const key = `${e.source}|${e.pid}|${e.port}|${e.address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ports.push({
        ...e,
        commandLine: redactCommand(e.commandLine),
        exposure: classifyExposure(e.address),
        warning: warningFor(e, selfPid),
        killCommand: buildKillCommand(e.source, e.pid),
      });
    }
  }
  ports.sort(
    (a, b) =>
      a.port - b.port ||
      SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
      a.address.localeCompare(b.address)
  );

  return {
    generatedAt: now().toISOString(),
    sources: { wsl: statusOf(wsl), windows: statusOf(windows) },
    ports,
  };
}
```

- [ ] **Step 4: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/contexts/bc_diagnostics/services.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_diagnostics/services.ts tests/unit/contexts/bc_diagnostics/services.test.ts
git commit -m "feat(diagnostics): reguły domeny (ekspozycja, ostrzeżenia, kill, redakcja)"
```

---

### Task 6: `schemas`, `router`, trasa API

**Files:**

- Create: `contexts/bc_diagnostics/schemas.ts`, `contexts/bc_diagnostics/router.ts`, `app/api/diagnostics/ports/route.ts`
- Test: `tests/unit/contexts/bc_diagnostics/schemas.test.ts`, `tests/unit/contexts/bc_diagnostics/router.test.ts`

- [ ] **Step 1: Testy**

`schemas.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PortsResponseSchema, toPortsDto } from "@/contexts/bc_diagnostics/schemas";
import type { PortsSnapshot } from "@/contexts/bc_diagnostics/models";

const SNAP: PortsSnapshot = {
  generatedAt: "2026-11-17T10:00:00.000Z",
  sources: { wsl: { ok: true }, windows: { ok: false, reason: "timeout" } },
  ports: [
    {
      source: "wsl",
      port: 3101,
      address: "127.0.0.1",
      pid: 1,
      process: "next-server",
      path: null,
      commandLine: null,
      exposure: "local",
      warning: "self",
      killCommand: "kill 1",
    },
  ],
};

describe("toPortsDto", () => {
  it("przepisuje migawkę i przechodzi walidację zod", () => {
    const dto = toPortsDto(SNAP);
    expect(dto.ports[0].killCommand).toBe("kill 1");
    expect(PortsResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("odrzuca nieznane źródło błędu", () => {
    const bad = {
      ...toPortsDto(SNAP),
      sources: { wsl: { ok: false, reason: "x" }, windows: { ok: true } },
    };
    expect(PortsResponseSchema.safeParse(bad).success).toBe(false);
  });
});
```

`router.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const mockList = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_diagnostics/services", () => ({ listPorts: mockList }));

import { GET } from "@/app/api/diagnostics/ports/route";

beforeEach(() => mockList.mockReset());

describe("GET /api/diagnostics/ports", () => {
  it("zwraca DTO", async () => {
    mockList.mockResolvedValue({
      generatedAt: "2026-11-17T10:00:00.000Z",
      sources: { wsl: { ok: true }, windows: { ok: true } },
      ports: [],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      generatedAt: "2026-11-17T10:00:00.000Z",
      sources: { wsl: { ok: true }, windows: { ok: true } },
      ports: [],
    });
  });

  it("mapuje błąd domeny przez handleServiceError", async () => {
    mockList.mockRejectedValue(new DomainError("brak", 404));
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
```

(`DomainError(message, statusCode)` wg `lib/errors.ts`; wzór: `tests/unit/contexts/bc_map/router.test.ts`.)

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/contexts/bc_diagnostics/` → FAIL (brak schemas/router/route).

- [ ] **Step 3: Implementacja**

`contexts/bc_diagnostics/schemas.ts`:

```ts
import { z } from "zod";
import type { PortsSnapshot } from "./models";

const FailureSchema = z.enum(["missing", "timeout", "error"]);
const SourceStatusSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: FailureSchema }),
]);

export const PortListenerSchema = z.object({
  source: z.enum(["wsl", "windows"]),
  port: z.number().int(),
  address: z.string(),
  exposure: z.enum(["local", "network"]),
  pid: z.number().int().nullable(),
  process: z.string(),
  path: z.string().nullable(),
  commandLine: z.string().nullable(),
  warning: z.enum(["self", "system"]).nullable(),
  killCommand: z.string().nullable(),
});

export const PortsResponseSchema = z.object({
  generatedAt: z.string(),
  sources: z.object({ wsl: SourceStatusSchema, windows: SourceStatusSchema }),
  ports: z.array(PortListenerSchema),
});

export type PortListenerDto = z.infer<typeof PortListenerSchema>;
export type SourceStatusDto = z.infer<typeof SourceStatusSchema>;
export type PortsResponseDto = z.infer<typeof PortsResponseSchema>;

export function toPortsDto(snapshot: PortsSnapshot): PortsResponseDto {
  return {
    generatedAt: snapshot.generatedAt,
    sources: { wsl: snapshot.sources.wsl, windows: snapshot.sources.windows },
    ports: snapshot.ports.map((p) => ({
      source: p.source,
      port: p.port,
      address: p.address,
      exposure: p.exposure,
      pid: p.pid,
      process: p.process,
      path: p.path,
      commandLine: p.commandLine,
      warning: p.warning,
      killCommand: p.killCommand,
    })),
  };
}
```

`contexts/bc_diagnostics/router.ts`:

```ts
import { NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { toPortsDto } from "./schemas";
import * as services from "./services";

export async function getPorts(): Promise<NextResponse> {
  try {
    return NextResponse.json(toPortsDto(await services.listPorts()));
  } catch (err) {
    return handleServiceError(err);
  }
}
```

`app/api/diagnostics/ports/route.ts`:

```ts
export { getPorts as GET } from "@/contexts/bc_diagnostics/router";

// Stan portów zmienia się w czasie; trasa nigdy nie jest statyczna.
export const dynamic = "force-dynamic";
```

- [ ] **Step 4: Uruchom testy i architekturę**

Run: `npx vitest run tests/unit/contexts/bc_diagnostics/ tests/unit/architecture.static.test.ts`
Expected: PASS (architektura bez edycji testu).

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_diagnostics app/api/diagnostics tests/unit/contexts/bc_diagnostics
git commit -m "feat(diagnostics): schemas, router i GET /api/diagnostics/ports"
```

---

### Task 7: rejestracja karty (cards, skróty, nawigacja)

**Files:**

- Modify: `src/features/cards/cards.ts`, `src/features/cards/useCardHotkeys.ts`, `src/features/cards/useCardNavigation.ts`
- Modify tests: `tests/unit/features/cards/{cards.test.ts,CardRail.test.tsx,cardCommands.test.ts,useCardHotkeys.test.ts,useCardNavigation.test.ts}`, `tests/unit/features/home/statusBar.test.tsx`

Uwaga: zadania 7–8 zostawiają testy kart/i18n czerwone między krokami; commit dopiero po zielonym zadaniu 8 w części dotyczącej i18n (patrz Step 7).

- [ ] **Step 1: Zaktualizuj testy kart (czerwone)**

`cards.test.ts`: zmień pierwszy test na

```ts
test("ma 10 kart z klawiszami 1..9, 0 w kolejności", () => {
  expect(CARDS.map((c) => c.hotkey)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
  expect(CARDS.map((c) => c.id)).toEqual([
    "kokpit",
    "kalendarz",
    "zadania",
    "projekty",
    "notatki",
    "plotno",
    "arsenal",
    "mapa",
    "kodeks",
    "diagnostyka",
  ]);
});
```

zamień „mapa i kodeks mają własne widoki” na dodatkową asercję `expect(getCard("diagnostyka").target).toEqual({ kind: "diagnostics" });`, a test „Kodeks jest ostatnią kartą…” na:

```ts
test("Diagnostyka jest ostatnią kartą z klawiszem 0", () => {
  expect(CARDS[CARDS.length - 1]).toMatchObject({ id: "diagnostyka", hotkey: 0 });
});
```

W `describe("cardByHotkey")` dodaj `expect(cardByHotkey(0)?.id).toBe("diagnostyka");`.

`CardRail.test.tsx`: `toHaveLength(10)`, ostatni `data-card-id` = `"diagnostyka"`, tytuł `Kodeks (Alt+9)` zostaje, dodaj `expect(screen.getByRole("button", { name: /Diagnostyka/ })).toHaveAttribute("title", "Diagnostyka (Alt+0)");`. Nazwę testu zmień na „pokazuje 10 kart… Diagnostyka ostatnia”.

`cardCommands.test.ts`: `toHaveLength(10)`; test o Kodeksie: `cmds[8]` zostaje; dodaj test:

```ts
test("ostatnia komenda przechodzi do Diagnostyki z hintem Alt+0", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard, i18n.t);
  expect(cmds[9]).toMatchObject({
    id: "go-diagnostyka",
    label: "Przejdź: Diagnostyka",
    hint: "Alt+0",
  });
  cmds[9].run();
  expect(selectCard).toHaveBeenCalledWith("diagnostyka");
});
```

`useCardHotkeys.test.ts`: dodaj

```ts
test("Alt+0 wybiera Diagnostykę", () => {
  const { onSelectCard } = setup();
  fireEvent.keyDown(window, { key: "0", code: "Digit0", altKey: true });
  expect(onSelectCard).toHaveBeenCalledWith("diagnostyka");
});
```

`useCardNavigation.test.ts`: dodaj

```ts
test("Diagnostyka otwiera własny widok, kolejna karta go zamyka", () => {
  const { result } = renderHook(() => useCardNavigation());
  act(() => result.current.selectCard("diagnostyka"));
  expect(result.current.diagnosticsOpen).toBe(true);
  expect(result.current.activeCard).toBe("diagnostyka");
  act(() => result.current.selectCard("kokpit"));
  expect(result.current.diagnosticsOpen).toBe(false);
});
```

`statusBar.test.tsx`: dwie asercje zmień na `Alt+0…9 karty · Alt+I inbox · Ctrl+K polecenia` i `Alt+0…9 cards · Alt+I inbox · Ctrl+K commands`.

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/features/cards tests/unit/features/home/statusBar.test.tsx` → FAIL.

- [ ] **Step 3: Zmiany w kodzie**

`src/features/cards/cards.ts`: w `CardId` dodaj `| "diagnostyka"` po `"kodeks"`; w `CardTarget` dodaj `| { kind: "diagnostics" }`; w `CARDS` po Kodeksie dodaj `{ id: "diagnostyka", hotkey: 0, target: { kind: "diagnostics" } },`.

`src/features/cards/useCardHotkeys.ts`: `/^Digit([1-9])$/` → `/^Digit([0-9])$/`.

`src/features/cards/useCardNavigation.ts`:

- interfejs: `diagnosticsOpen: boolean;` po `codexOpen`;
- w `selectCard`: warunek rozszerz o `|| target.kind === "diagnostics"`;
- `const diagnosticsOpen = standalone === "diagnostyka";` po `codexOpen`;
- w zwracanym obiekcie dodaj `diagnosticsOpen,`.

- [ ] **Step 4: Podpowiedzi w shell (PL/EN)**

`src/i18n/locales/pl/shell.ts`: `hints: "Alt+0…9 karty · Alt+I inbox · Ctrl+K polecenia"`, w `cards` dodaj `diagnostyka: "Diagnostyka",`.
`src/i18n/locales/en/shell.ts`: `hints: "Alt+0…9 cards · Alt+I inbox · Ctrl+K commands"`, w `cards` dodaj `diagnostyka: "Diagnostics",` (zachowaj kolejność kluczy jak w PL).

- [ ] **Step 5: Tokeny koloru**

`src/features/cards/cards.css`: po `--c-kodeks: #3ddc84;` dodaj `--c-diagnostyka: #cbd5e1;`.
`docs/mockups/karty/tokens.css`: po `--c-kodeks: #3ddc84;` dodaj `--c-diagnostyka: #cbd5e1;`, a na końcu pliku blok motywu:

```css
/* ---------- Alt+0 Diagnostyka: grafit + stal ---------- */
[data-card="diagnostyka"] {
  --bg: #121317;
  --surface: #1b1c21;
  --surface-2: #25272d;
  --line: #34363e;
  --text: #eef0f3;
  --muted: #a3a8b3;
  --accent: #cbd5e1;
  --accent-text: #dbe3ee;
  --accent-ink: #0b0e14;
  --accent-soft: rgba(203, 213, 225, 0.12);
  --glow: rgba(203, 213, 225, 0.4);
  --ok: #5eead4;
  --warn: #facc15;
  --danger: #ff6b6b;
  --font-display: "Manrope", var(--font-body);
  --pattern: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.04) 1px, transparent 0) 0 0 /
    22px 22px;
  color-scheme: dark;
}
```

- [ ] **Step 6: Uruchom testy kart i CSS**

Run: `npx vitest run tests/unit/features/cards tests/unit/features/home/statusBar.test.tsx`
Expected: PASS. Zostaje tylko brak namespace `diagnostics` (zadanie 8); testy kart go nie wymagają.

- [ ] **Step 7: Commit**

```bash
git add src/features/cards src/i18n/locales docs/mockups/karty/tokens.css tests/unit/features
git commit -m "feat(cards): rejestracja karty Diagnostyka (Alt+0)"
```

---

### Task 8: słowniki i18n `diagnostics`

**Files:**

- Create: `src/i18n/locales/pl/diagnostics.ts`, `src/i18n/locales/en/diagnostics.ts`
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts` (lista `ns`, po `"codex"` dodaj `"diagnostics"`)
- Test: istniejący `tests/unit/i18n/parity.test.ts` (bez zmian)

- [ ] **Step 1: Słowniki**

`src/i18n/locales/pl/diagnostics.ts`:

```ts
export const diagnostics = {
  title: "Diagnostyka",
  subtitle:
    "Porty TCP w stanie LISTEN w WSL i Windows. Tylko odczyt; aplikacja niczego nie zabija.",
  refresh: "Odśwież",
  refreshing: "Odświeżam…",
  filterAria: "Filtr portów",
  filterPlaceholder: "Port lub nazwa procesu",
  loading: "Pobieram porty…",
  error: "Nie udało się pobrać portów: {{message}}",
  errorGeneric: "Nieznany błąd",
  empty: "Brak nasłuchujących portów.",
  emptyFiltered: "Brak wyników dla filtra.",
  generatedAt: "Stan z {{time}}",
  total: "Portów: {{count}}",
  columns: {
    port: "Port",
    source: "Źródło",
    address: "Adres",
    process: "Proces",
    pid: "PID",
    action: "Akcja",
  },
  source: { wsl: "WSL", windows: "Windows" },
  sourceFailed: {
    missing: "Źródło {{source}} niedostępne (brak programu).",
    timeout: "Źródło {{source}} nie odpowiedziało w limicie czasu.",
    error: "Źródło {{source}} zwróciło błąd.",
  },
  exposure: { local: "lokalny", network: "sieć" },
  warning: {
    self: "uwaga: to serwer Monolith",
    system: "uwaga: proces systemowy",
  },
  unknownProcess: "(nieznany)",
  kill: {
    copy: "Kopiuj kill",
    copied: "Skopiowano",
    failed: "Nie udało się skopiować",
    noPid: "Brak PID (proces innego użytkownika)",
  },
};
```

`src/i18n/locales/en/diagnostics.ts` (te same klucze):

```ts
export const diagnostics = {
  title: "Diagnostics",
  subtitle:
    "TCP ports in LISTEN state in WSL and Windows. Read-only; the app never kills anything.",
  refresh: "Refresh",
  refreshing: "Refreshing…",
  filterAria: "Port filter",
  filterPlaceholder: "Port or process name",
  loading: "Loading ports…",
  error: "Could not load ports: {{message}}",
  errorGeneric: "Unknown error",
  empty: "No listening ports.",
  emptyFiltered: "No results for the filter.",
  generatedAt: "Snapshot from {{time}}",
  total: "Ports: {{count}}",
  columns: {
    port: "Port",
    source: "Source",
    address: "Address",
    process: "Process",
    pid: "PID",
    action: "Action",
  },
  source: { wsl: "WSL", windows: "Windows" },
  sourceFailed: {
    missing: "Source {{source}} unavailable (program not found).",
    timeout: "Source {{source}} did not respond in time.",
    error: "Source {{source}} returned an error.",
  },
  exposure: { local: "local", network: "network" },
  warning: {
    self: "warning: this is the Monolith server",
    system: "warning: system process",
  },
  unknownProcess: "(unknown)",
  kill: {
    copy: "Copy kill",
    copied: "Copied",
    failed: "Copy failed",
    noPid: "No PID (process owned by another user)",
  },
};
```

- [ ] **Step 2: Rejestracja**

W `src/i18n/resources.ts` dodaj importy `diagnostics as plDiagnostics` / `enDiagnostics` oraz wpisy `diagnostics: plDiagnostics,` / `diagnostics: enDiagnostics,` po `codex`. W `src/i18n/index.ts` dodaj `"diagnostics"` do tablicy `ns` po `"codex"`.

- [ ] **Step 3: Testy**

Run: `npx vitest run tests/unit/i18n tests/unit/features/cards` → PASS (parytet kluczy PL/EN, brak pustych wartości).

- [ ] **Step 4: Commit**

```bash
git add src/i18n tests/unit/i18n
git commit -m "feat(i18n): słownik diagnostics (PL/EN)"
```

---

### Task 9: UI — `useDiagnostics`, `DiagnosticsView`, wpięcie w `App`

**Files:**

- Create: `src/features/diagnostics/{useDiagnostics.ts,DiagnosticsView.tsx,diagnostics.css}`
- Modify: `src/App.tsx`
- Test: `tests/unit/features/diagnostics/{useDiagnostics.test.tsx,DiagnosticsView.test.tsx}`

Interfejsy:

- `useDiagnostics(apiFetch): { data: PortsResponseDto | null; error: string | null; loading: boolean; reload: () => Promise<void> }`. Pobiera przy montowaniu i na `reload`; przy błędzie zostawia ostatnie dane; ignoruje odpowiedzi przestarzałe (licznik żądań) i po odmontowaniu.
- `DiagnosticsView({ apiFetch })`.

- [ ] **Step 1: Test hooka**

`tests/unit/features/diagnostics/useDiagnostics.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useDiagnostics } from "@/src/features/diagnostics/useDiagnostics";

const BODY = {
  generatedAt: "2026-11-17T10:00:00.000Z",
  sources: { wsl: { ok: true }, windows: { ok: true } },
  ports: [],
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("useDiagnostics", () => {
  it("pobiera przy montowaniu i woła właściwy adres", async () => {
    const apiFetch = vi.fn().mockResolvedValue(json(BODY));
    const { result } = renderHook(() => useDiagnostics(apiFetch));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(BODY));
    expect(apiFetch).toHaveBeenCalledWith("/api/diagnostics/ports");
    expect(result.current.loading).toBe(false);
  });

  it("błąd HTTP ustawia error, a odświeżenie z błędem zostawia ostatnie dane", async () => {
    const apiFetch = vi
      .fn()
      .mockResolvedValueOnce(json(BODY))
      .mockResolvedValueOnce(json({ error: "zepsute" }, 500));
    const { result } = renderHook(() => useDiagnostics(apiFetch));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBe("zepsute");
    expect(result.current.data).toEqual(BODY);
  });

  it("odpowiedź niezgodna ze schematem to błąd", async () => {
    const apiFetch = vi.fn().mockResolvedValue(json({ ports: "x" }));
    const { result } = renderHook(() => useDiagnostics(apiFetch));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toBeNull();
  });
});
```

- [ ] **Step 2: Uruchom, ma paść** (`npx vitest run tests/unit/features/diagnostics/useDiagnostics.test.tsx`).

- [ ] **Step 3: Implementacja hooka**

`src/features/diagnostics/useDiagnostics.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PortsResponseSchema, type PortsResponseDto } from "@/contexts/bc_diagnostics/schemas";
import i18n from "@/src/i18n";

export type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : i18n.t("diagnostics:errorGeneric");

export function useDiagnostics(apiFetch: ApiFetch) {
  const [data, setData] = useState<PortsResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await apiFetch("/api/diagnostics/ports");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(typeof body?.error === "string" ? body.error : `HTTP ${res.status}`);
      }
      const parsed = PortsResponseSchema.parse(await res.json());
      if (!alive.current || mine !== seq.current) return;
      setData(parsed);
      setError(null);
    } catch (err) {
      if (!alive.current || mine !== seq.current) return;
      setError(messageOf(err));
    } finally {
      if (alive.current && mine === seq.current) setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  return { data, error, loading, reload };
}
```

- [ ] **Step 4: Uruchom test hooka, ma przejść.**

- [ ] **Step 5: Test widoku**

`tests/unit/features/diagnostics/DiagnosticsView.test.tsx`:

```tsx
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiagnosticsView } from "@/src/features/diagnostics/DiagnosticsView";

afterEach(() => cleanup());

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
  vi.fn().mockResolvedValue(new Response(JSON.stringify(b), { status: 200 }));

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
```

(`within` w imporcie usuń, jeśli nieużywany, żeby lint przeszedł. Uwaga: `new Response` z jednego `mockResolvedValue` można odczytać tylko raz; w teście „Odśwież” użyj `mockImplementation(async () => new Response(...))`: zrób tak także w `fetchOf`.)

- [ ] **Step 6: Uruchom, ma paść** (brak `DiagnosticsView`).

- [ ] **Step 7: Implementacja widoku**

`src/features/diagnostics/DiagnosticsView.tsx` (zachowanie, nie ozdobniki):

```tsx
"use client";

import React, { useMemo, useState } from "react";
import type { PortListenerDto, SourceStatusDto } from "@/contexts/bc_diagnostics/schemas";
import { formatTimeSeconds } from "@/src/i18n/format";
import { useT } from "@/src/i18n/useT";
import { useDiagnostics, type ApiFetch } from "./useDiagnostics";
import "./diagnostics.css";

type SortKey = "port" | "process" | "source";

const fold = (s: string) => s.toLowerCase();

function matches(p: PortListenerDto, q: string): boolean {
  if (q === "") return true;
  return String(p.port).includes(q) || fold(p.process).includes(q);
}

function sortRows(rows: PortListenerDto[], key: SortKey): PortListenerDto[] {
  const cmp = (a: PortListenerDto, b: PortListenerDto): number =>
    key === "process"
      ? a.process.localeCompare(b.process) || a.port - b.port
      : key === "source"
        ? a.source.localeCompare(b.source) || a.port - b.port
        : a.port - b.port || a.source.localeCompare(b.source);
  return [...rows].sort(cmp);
}

export function DiagnosticsView({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const { data, error, loading, reload } = useDiagnostics(apiFetch);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("port");
  const [copied, setCopied] = useState<{ key: string; ok: boolean } | null>(null);

  const q = fold(query.trim());
  const rows = useMemo(
    () =>
      sortRows(
        (data?.ports ?? []).filter((p) => matches(p, q)),
        sort
      ),
    [data, q, sort]
  );

  const copy = async (key: string, text: string) => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ok = false;
    }
    setCopied({ key, ok });
    setTimeout(() => setCopied((c) => (c?.key === key ? null : c)), 1500);
  };

  const failures = (["wsl", "windows"] as const).flatMap((name) => {
    const s: SourceStatusDto | undefined = data?.sources[name];
    return s && !s.ok ? [{ name, reason: s.reason }] : [];
  });

  return (
    <section className="diag-root" aria-labelledby="diag-title">
      <header className="diag-head">
        <div>
          <h1 id="diag-title">{t("diagnostics:title")}</h1>
          <p className="diag-sub">{t("diagnostics:subtitle")}</p>
        </div>
        <div className="diag-tools">
          <input
            type="search"
            className="diag-filter"
            aria-label={t("diagnostics:filterAria")}
            placeholder={t("diagnostics:filterPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="diag-sort"
            aria-label={t("diagnostics:columns.port")}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="port">{t("diagnostics:columns.port")}</option>
            <option value="process">{t("diagnostics:columns.process")}</option>
            <option value="source">{t("diagnostics:columns.source")}</option>
          </select>
          <button
            type="button"
            className="diag-btn"
            onClick={() => void reload()}
            disabled={loading}
          >
            {loading ? t("diagnostics:refreshing") : t("diagnostics:refresh")}
          </button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="diag-alert">
          {t("diagnostics:error", { message: error })}
        </p>
      ) : null}
      {failures.map((f) => (
        <p key={f.name} role="status" className="diag-alert diag-alert--warn">
          {t(`diagnostics:sourceFailed.${f.reason}`, { source: t(`diagnostics:source.${f.name}`) })}
        </p>
      ))}

      {data ? (
        <p className="diag-meta">
          {t("diagnostics:total", { count: rows.length })} ·{" "}
          {t("diagnostics:generatedAt", { time: formatTimeSeconds(new Date(data.generatedAt)) })}
        </p>
      ) : loading ? (
        <p className="diag-meta">{t("diagnostics:loading")}</p>
      ) : null}

      {data && rows.length === 0 ? (
        <p className="diag-empty">
          {data.ports.length === 0 ? t("diagnostics:empty") : t("diagnostics:emptyFiltered")}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <table className="diag-table">
          <thead>
            <tr>
              <th>{t("diagnostics:columns.port")}</th>
              <th>{t("diagnostics:columns.source")}</th>
              <th>{t("diagnostics:columns.address")}</th>
              <th>{t("diagnostics:columns.process")}</th>
              <th>{t("diagnostics:columns.pid")}</th>
              <th>{t("diagnostics:columns.action")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const key = `${p.source}|${p.pid}|${p.port}|${p.address}`;
              const state = copied?.key === key ? copied : null;
              return (
                <tr key={key} data-warning={p.warning ?? undefined}>
                  <td className="diag-port">{p.port}</td>
                  <td>{t(`diagnostics:source.${p.source}`)}</td>
                  <td>
                    <code>{p.address}</code>{" "}
                    <span className={`diag-chip diag-chip--${p.exposure}`}>
                      {t(`diagnostics:exposure.${p.exposure}`)}
                    </span>
                  </td>
                  <td title={p.commandLine ?? p.path ?? undefined}>
                    {p.process === "" ? t("diagnostics:unknownProcess") : p.process}
                    {p.warning ? (
                      <span className="diag-chip diag-chip--warn">
                        {t(`diagnostics:warning.${p.warning}`)}
                      </span>
                    ) : null}
                  </td>
                  <td>{p.pid ?? "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="diag-btn diag-btn--sm"
                      disabled={p.killCommand === null}
                      title={p.killCommand ?? t("diagnostics:kill.noPid")}
                      onClick={() => p.killCommand && void copy(key, p.killCommand)}
                    >
                      {t("diagnostics:kill.copy")}
                    </button>
                    {state ? (
                      <span role="status" className="diag-copied">
                        {state.ok ? t("diagnostics:kill.copied") : t("diagnostics:kill.failed")}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
```

`src/features/diagnostics/diagnostics.css`: klasy `.diag-*` z tokenami zawężonymi do `.diag-root` (wzór: początek `src/features/codex/codex.css`): grafitowe tło `#121317`, tekst `#eef0f3`, akcent `var(--c-diagnostyka)`, tabela pełnej szerokości z `overflow:auto` w kontenerze `.diag-root`, `.diag-chip--network` w kolorze ostrzegawczym `#facc15`, `.diag-chip--warn` czerwonym `#ff6b6b`, `.diag-btn:disabled { opacity: .45; cursor: not-allowed }`, `tr[data-warning] { background: rgba(255,107,107,.08) }`. Bez animacji.

- [ ] **Step 8: Wpięcie w `App.tsx`**

Dodaj dynamiczny import (obok `CodexView`):

```tsx
const DiagnosticsView = dynamic(
  () => import("@/src/features/diagnostics/DiagnosticsView").then((m) => m.DiagnosticsView),
  { ssr: false, loading: ViewFallback }
);
```

W destrukturyzacji `useCardNavigation()` dodaj `diagnosticsOpen`; warunek Kokpitu: `!projectsOpen && !mapOpen && !codexOpen && !diagnosticsOpen && appMode === "home"`; w łańcuchu widoków po gałęzi `codexOpen` dodaj `) : diagnosticsOpen ? (<DiagnosticsView apiFetch={apiFetch} />`.

- [ ] **Step 9: Testy, typy i lint**

Run: `npx vitest run tests/unit/features/diagnostics tests/unit/features/cards tests/unit/i18n` → PASS; `npx tsc --noEmit` → bez błędów (dynamiczne klucze `t(...)` typuje `TFn`; gdyby TS narzekał na szablony kluczy, rzutuj przez wąski union literałów, nie przez `any`); `npm run lint` → bez błędów.

- [ ] **Step 10: Commit**

```bash
git add src/features/diagnostics src/App.tsx tests/unit/features/diagnostics
git commit -m "feat(diagnostics): widok karty, hook pobierania i wpięcie w App"
```

---

### Task 10: makieta i dokumentacja

**Files:**

- Create: `docs/mockups/karty/cards/10-diagnostyka.html`
- Modify: `docs/mockups/karty/shell.js`, `docs/mockups/karty/index.html`, `docs/mockups/karty/STYLEGUIDE.md` (wiersz o `tokens.css`: „palety 9 kart” → „palety 10 kart”), `CLAUDE.md`

- [ ] **Step 1: `shell.js`**

- W tablicy `CARDS` po Kodeksie: `{ id: "diagnostyka", label: "Diagnostyka", file: "10-diagnostyka.html" },`.
- W numeracji paska: `${i + 1}` → `${(i + 1) % 10}` (w `rail__num` i w `title`: `Alt+${(i + 1) % 10}`).
- Przełącznik źródeł danych: tytuł przycisku `Źródła danych (Alt+S)`, a w obsłudze klawiszy `if (e.altKey && e.code === "Digit0")` → `if (e.altKey && e.code === "KeyS")`.
- Skrót kart: `/^Digit[1-9]$/` → `/^Digit[0-9]$/` i `CARDS[+e.code.slice(5) - 1].file` → `CARDS[(+e.code.slice(5) + 9) % 10].file`.
- Pasek stanu: `Alt+1…9 karty · Alt+0 źródła · Ctrl+K polecenia` → `Alt+0…9 karty · Alt+S źródła · Ctrl+K polecenia`.
- Lista komend palety w tym pliku (jeśli zawiera `Alt+${i+1}`): ta sama poprawka `(i + 1) % 10`.

- [ ] **Step 2: `10-diagnostyka.html`**

Skopiuj nagłówek `<head>` z `09-kodeks.html` (fonty, `../tokens.css`, `../shell.css`), ustaw `<html lang="pl" data-card="diagnostyka" data-project="second-brain" data-branch="main">`, `<title>Diagnostyka · Second Brain</title>`. Ciało: `<div class="app"><main class="view">` z nagłówkiem, polem filtra, przyciskiem „Odśwież” i tabelą (Port | Źródło | Adres | Proces | PID | Akcja) z ośmioma wierszami z prawdziwych zrzutów (3100/3101 `next-server`, 22 `sshd`, 5173 `vite`, 5434 bez PID, Windows 42050 `OneDrive.Sync.Service`, 445 `System` z chipem „uwaga: proces systemowy”, 3101 z chipem „uwaga: to serwer Monolith”), przyciskami „Kopiuj kill” i `<script src="../shell.js"></script>` na końcu. Styl: klasy `btn`, `chip` ze `shell.css`; własne reguły w `<style>` z prefiksem `.diag-`. Bez mockowania fetch.

- [ ] **Step 3: `index.html`**

Po kafelku Kodeksu dodaj kafelek 10 (identyczna struktura jak 9): `href="cards/10-diagnostyka.html"`, `style="--c: #cbd5e1"`, `iframe src="cards/10-diagnostyka.html"`, `title="Podgląd: Diagnostyka"`, `<span class="num">0</span>`, `<h2>Diagnostyka</h2>`, opis „Porty nasłuchujące w WSL i Windows z nazwą procesu i gotową komendą kill.”, `<span class="key">Alt+0</span>`. W akapicie z „Alt+1…9 … Alt+0, który pokazuje…” (ok. linii 184) zamień na „Alt+0…9 … Alt+S, który pokazuje…”.

- [ ] **Step 4: `CLAUDE.md`**

W akapicie „Infrastruktura wspólna” dopisz po `lib/github/…`: ``, `lib/ports/` (porty TCP LISTEN z WSL przez `ss` i z Windows przez PowerShell, tylko odczyt; `child_process` i `fs` tylko tu)``.

- [ ] **Step 5: Sprawdź testy CSS i podgląd**

Run: `npx vitest run tests/unit/features/cards/cardsCss.test.ts` → PASS (10 × 3 przypadków + Kodeks).
Ręcznie: otwórz `docs/mockups/karty/index.html` w przeglądarce i sprawdź kafelek 10, Alt+0 w makiecie oraz Alt+S dla źródeł danych.

- [ ] **Step 6: Commit**

```bash
git add docs/mockups CLAUDE.md
git commit -m "docs: makieta karty Diagnostyka i wzmianka o lib/ports"
```

---

### Task 11: weryfikacja końcowa (przed review kodu)

- [ ] **Step 1: Pełny zestaw (przez `cursor --approve-allowed`)**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
Expected: wszystko zielone; w razie błędów lista `plik:linia + przyczyna`. Test statyczny architektury przeszedł bez edycji (`git diff main -- tests/unit/architecture.static.test.ts` puste).

- [ ] **Step 2: Ręczna weryfikacja w działającej aplikacji (sekcja 5 specu)**

Run: `npm run dev` (port 3100), potem `curl -s http://127.0.0.1:3100/api/diagnostics/ports | head -c 1200` oraz otwórz kartę Alt+0 w przeglądarce.
Sprawdź i zanotuj w opisie PR:

1. Czy przy `networkingMode=mirrored` (`wslinfo --networking-mode`) ten sam port nie pojawia się dwa razy z tym samym procesem; jeśli tak, doprecyzuj deduplikację osobnym zadaniem (nie zgaduj teraz).
2. Czas odpowiedzi endpointu (PowerShell przez interop); jeśli > 3 s, zanotuj jako uwagę, nie optymalizuj bez prośby.
3. Wiersz serwera dev (3100) ma znacznik „uwaga: to serwer Monolith”; „Kopiuj kill” wkleja `kill <PID>`; Windows `System` ma znacznik systemowy.
4. `curl -s -H "Host: evil.example" http://127.0.0.1:3100/api/diagnostics/ports` zwraca odmowę (D9: strażnik hosta działa bez zmian).
5. Alt+0 otwiera kartę, Alt+9 Kodeks, paleta Ctrl+K ma „Przejdź: Diagnostyka”, hash `#diagnostyka` przeładowuje na kartę.

- [ ] **Step 3: Review diffa przez pomocnika**

Run: `scripts/ask-helper.sh --role review --tier deep agy "Zrób review diffa gałęzi feat/diagnostyka-porty względem main (git diff main...HEAD). Cel: karta Diagnostyka, spec docs/superpowers/specs/2026-11-17-diagnostyka-porty-design.md. Szukaj: wstrzyknięcia poleceń, wycieku sekretów w commandLine, rozjazdu z regułami architektury ADR-021, brakujących testów. Odpowiedz listą plik:linia + problem."` (pamiętaj o wyczerpanym limicie Argon: do ~2026-11-21 użyj `AGY_DEEP_TAG=Hydrogen` albo `--tier light`). Opinie weryfikuj w kodzie przed zmianą.

- [ ] **Step 4: Przekazanie użytkownikowi**

Podsumuj wyniki kroków 1–3. Push i PR dopiero na prośbę użytkownika.

---

## Samoprzegląd planu

**Pokrycie specu:** D1 (zadania 1–3, 5, 9), D2 (`-ltnpH`, `-State Listen`), D3 (przycisk kopiuj, brak wykonania; zadanie 9), D4 (zadania 7–8, 10), D5 (`warningFor`, zadanie 5), D6 (hook pobiera przy wejściu i przy „Odśwież”, bez timera; zadanie 9), D7 (brak zapisów; `lib/ports` nie dotyka vaulta), D8 (`redactCommand`, zadanie 5), D9 (zadanie 11, krok 2.4; brak zmian w `middleware.ts`). Sekcje 3.1–3.4 specu: zadania 1–3, 4–6, 5, 7–10. Testy z sekcji 4: parseSs/Windows (1–2), services (5), kill (5), redakcja (5), karty (7), parytet i18n (8), architektura bez zmian (4, 6, 11). Sekcja 5: zadanie 11.

**Spójność nazw:** `RawListener`/`SourceResult` (lib) → `SourceEntry`/`SourceRead` (kontekst) → `PortListener`/`PortsSnapshot` → `PortListenerDto`/`PortsResponseDto`; funkcje `readWsl`/`readWindows`, `listPorts`, `getPorts`, `useDiagnostics`, `DiagnosticsView`, `diagnosticsOpen` użyte jednolicie w testach i kodzie.
