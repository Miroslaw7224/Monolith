# Karta Mapa (etap 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karta Mapa (Alt+8) pokazuje sieć NEXUS jako powoli obracany globus 3D (7 projektów + 3 kontynenty), cztery kafle z realnymi liczbami i panel agentów Herdr (tylko odczyt).

**Architecture:** Nowy kontekst `contexts/bc_map/` (pięć plików, ADR-021) czyta vault przez `lib/nexus`, terminale Herdr przez nową warstwę `lib/herdr`, projekty przez `bc_projects/services`. UI w `src/features/map/` rysuje globus na `<canvas>` z własną projekcją 3D (`globeMath.ts`, czysta matematyka) i importuje z kontekstu tylko `schemas`. Dwie trasy GET: `/api/map/graph` (raz) i `/api/map/agents` (przycisk „Odśwież stan”).

**Tech Stack:** Next.js 14, TypeScript, zod, Vitest + Testing Library (jsdom), canvas 2D (bez nowych zależności).

**Spec:** `docs/superpowers/specs/2026-11-14-karta-mapa-design.md` (decyzje D1–D13, §7 odłożone). Makieta: `docs/mockups/karty/cards/08-mapa.html`.

## Zasady wykonania (z CLAUDE.md)

- Gałąź: `feat/karta-mapa` (już istnieje, spec zacommitowany).
- **Zmiana `tests/unit/architecture.static.test.ts` idzie osobnym commitem, nigdy razem z kodem** (Task 1). Ten test zostaje czerwony do końca Taska 4; to zamierzone: „pękający test naprawia się kodem”.
- Każdy commit kończy się linią: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Testy/lint/typecheck/build można zlecić `cursor` (`scripts/ask-helper.sh --role task --approve-allowed cursor "…"`, `--tier light`); poniżej są komendy i oczekiwany wynik. Po zleceniu sprawdź `git diff --stat`.
- Cała aplikacja tylko czyta; nic nie zapisuje do vaulta. `Work/` jest zawsze pomijany.

## Ustalenia wykonawcze (uzupełnienia speca, bez zmiany decyzji)

1. **Agent a powłoka.** `hc ls` zwraca też terminale z `agent: "bash"` (zwykła powłoka). Do panelu i kafla „Agenci na żywo” liczymy terminale, których `agent` (po `trim`, bez wielkości liter) **nie** jest `bash`. Pusty `agent` (np. cursor) zostaje, z etykietą „terminal”.
2. **`status` agenta** (np. `working`, `done`) pokazujemy tylko dla agenta dopasowanego do projektu `personal`; agent `work` i bez projektu dostają wyłącznie `address`, `label`, `state` (D9).
3. **Id węzłów kontynentów** to `@wiedza`, `@ai-2030`, `@skille` (znak `@` nie występuje w slugach projektów, więc nie ma kolizji).
4. **Pole `soon`** w węźle (D13): `true` tylko dla Skille; węzeł rysowany przerywanym obrysem, podpis „wkrótce”, bez `size`.
5. **`size` kontynentów** liczy wszystkie pliki `.md` (w tym `_index.md`, `_tags.md` w Wiedzy), zgodnie ze specem.

## Mapa plików

| Plik                                                                                 | Odpowiedzialność                                                     |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `tests/unit/architecture.static.test.ts` (M)                                         | `bc_map/repositories` na liście `VAULT_FS_IMPORTERS` (osobny commit) |
| `lib/nexus/vault-fs.ts` (M)                                                          | `listVaultFilesRecursive`                                            |
| `lib/herdr/hc-ls.ts` (C)                                                             | `hc ls` → `HerdrTerminal[]`, odporny na brak `hc`/timeout            |
| `contexts/bc_map/models.ts` (C)                                                      | typy domeny                                                          |
| `contexts/bc_map/repositories.ts` (C)                                                | jedyny dostęp do vaulta i Herdr; parsery plików                      |
| `contexts/bc_map/services.ts` (C)                                                    | graf, kafle, dopasowanie agent → projekt, filtr prywatności          |
| `contexts/bc_map/schemas.ts` (C)                                                     | zod + DTO + mapery (bezpieczny dla klienta)                          |
| `contexts/bc_map/router.ts` (C)                                                      | handlery GET                                                         |
| `app/api/map/graph/route.ts`, `app/api/map/agents/route.ts` (C)                      | tylko re-eksport                                                     |
| `src/features/map/globeMath.ts` (C)                                                  | układ na kuli, rotacja, rzut, łuki, hit-test                         |
| `src/features/map/mapTiles.ts` (C)                                                   | kafle z danych grafu i agentów                                       |
| `src/features/map/useMapGraph.ts`, `useMapAgents.ts` (C)                             | pobieranie danych                                                    |
| `src/features/map/MapNodeList.tsx`, `MapAgentsPanel.tsx`, `MapBlockersPanel.tsx` (C) | małe komponenty prezentacyjne                                        |
| `src/features/map/Globe.tsx` (C)                                                     | canvas, pętla animacji, wskaźnik myszy                               |
| `src/features/map/MapView.tsx`, `map.css` (C)                                        | skład karty                                                          |
| `src/features/cards/cards.ts`, `useCardNavigation.ts`, `src/App.tsx` (M)             | wpięcie karty w aplikację                                            |

---

### Task 1: Test architektury (OSOBNY COMMIT, tylko test)

**Files:**

- Modify: `tests/unit/architecture.static.test.ts:491-500`

- [ ] **Step 1: Dopisz importera na listę (alfabetycznie, między `bc_inbox` a `bc_mind_maps`)**

```ts
const VAULT_FS_IMPORTERS = [
  "contexts/bc_board/repositories",
  "contexts/bc_calendar/repositories",
  "contexts/bc_inbox/repositories",
  "contexts/bc_map/repositories",
  "contexts/bc_mind_maps/repositories",
  "contexts/bc_projects/repositories",
  "contexts/bc_tasks/repositories/tasks",
  "lib/nexus/markdown-dir",
  "lib/nexus/yaml-store",
];
```

- [ ] **Step 2: Sprawdź, że test jest teraz czerwony z oczekiwanego powodu**

Run: `npx vitest run tests/unit/architecture.static.test.ts`
Expected: FAIL tylko w „zapis do vaulta (vault-fs) tylko ze znanych plików” (na liście jest `bc_map/repositories`, którego jeszcze nie ma). Pozostałe testy zielone.

- [ ] **Step 3: Commit (tylko ten plik)**

```bash
git add tests/unit/architecture.static.test.ts
git commit -m "test(arch): bc_map/repositories na liście VAULT_FS_IMPORTERS

Test zostaje czerwony do dodania repozytorium bc_map (kolejne commity).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `listVaultFilesRecursive` w `lib/nexus/vault-fs.ts`

**Files:**

- Modify: `lib/nexus/vault-fs.ts` (nowa funkcja po `listVaultFiles`, ok. linii 263)
- Test: `tests/unit/lib/nexus/vault-fs-recursive.test.ts` (nowy)

Uwaga: `tests/unit/lib/nexus/static.test.ts` zabrania w `vault-fs.ts` słów `child_process|execSync|spawn|node:os|homedir|backups` (także w komentarzach) i ogranicza `rmSync` do dwóch wywołań. Nowy kod ich nie używa.

- [ ] **Step 1: Napisz test (czerwony)**

```ts
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listVaultFilesRecursive } from "@/lib/nexus/vault-fs";
import { useTempVault } from "../../helpers/tempVault";

describe("listVaultFilesRecursive", () => {
  const vault = useTempVault();

  it("schodzi do podfolderów i zwraca tylko .md, posortowane, względem korzenia vaulta", () => {
    vault.write("Knowledge/b.md", "b");
    vault.write("Knowledge/a.md", "a");
    vault.write("Knowledge/sub/c.md", "c");
    vault.write("Knowledge/sub/deep/d.md", "d");
    vault.write("Knowledge/sub/note.txt", "nie md");
    expect(listVaultFilesRecursive("Knowledge")).toEqual([
      "Knowledge/a.md",
      "Knowledge/b.md",
      "Knowledge/sub/c.md",
      "Knowledge/sub/deep/d.md",
    ]);
  });

  it("pomija katalog Work (także zagnieżdżony i w innej wielkości liter) bez rzucania wyjątku", () => {
    vault.write("Projects/p/index.md", "i");
    vault.write("Projects/Work/secret.md", "s");
    vault.write("Projects/p/work/secret2.md", "s");
    expect(listVaultFilesRecursive("Projects")).toEqual(["Projects/p/index.md"]);
  });

  it("pomija dowiązania do plików i katalogów", () => {
    vault.write("Knowledge/a.md", "a");
    vault.write("Knowledge/sub/b.md", "b");
    fs.symlinkSync(
      path.join(vault.root, "Knowledge/a.md"),
      path.join(vault.root, "Knowledge/link.md")
    );
    fs.symlinkSync(
      path.join(vault.root, "Knowledge/sub"),
      path.join(vault.root, "Knowledge/linkdir")
    );
    expect(listVaultFilesRecursive("Knowledge")).toEqual(["Knowledge/a.md", "Knowledge/sub/b.md"]);
  });

  it("brak katalogu daje []", () => {
    expect(listVaultFilesRecursive("Nie-ma")).toEqual([]);
  });
});
```

- [ ] **Step 2: Uruchom — ma paść**

Run: `npx vitest run tests/unit/lib/nexus/vault-fs-recursive.test.ts`
Expected: FAIL (`listVaultFilesRecursive is not a function` lub błąd importu).

- [ ] **Step 3: Implementacja (po funkcji `listVaultFiles`)**

```ts
/**
 * Ścieżki (względem korzenia vaulta, separator `/`) wszystkich plików `.md` pod `relDir`, rekurencyjnie,
 * posortowane. Pomija dowiązania (pliki i katalogi) oraz każdy katalog `Work` na dowolnej głębokości,
 * więc nie rzuca `WorkAreaBlockedError` dla poddrzew. Brak katalogu daje []. `relDir` przechodzi przez
 * resolveInsideVault.
 */
export function listVaultFilesRecursive(relDir: string, opts?: VaultFsOptions): string[] {
  const abs = resolveInsideVault(rootOf(opts), relDir, opts);
  const base = relDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const out: string[] = [];
  const walk = (dirAbs: string, dirRel: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") return;
      throw err;
    }
    for (const entry of entries) {
      const rel = `${dirRel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!isWorkSegment(entry.name)) walk(path.join(dirAbs, entry.name), rel);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(rel);
      }
    }
  };
  walk(abs, base);
  return out.sort();
}
```

(`Dirent.isDirectory()` / `isFile()` są fałszywe dla dowiązań, więc symlinki odpadają same.)

- [ ] **Step 4: Uruchom — ma przejść, plus testy strażnicze `lib/nexus`**

Run: `npx vitest run tests/unit/lib/nexus`
Expected: PASS (w tym `static.test.ts` i `vault-fs.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/vault-fs.ts tests/unit/lib/nexus/vault-fs-recursive.test.ts
git commit -m "feat(nexus): listVaultFilesRecursive (tylko .md, bez symlinków i Work/)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `lib/herdr/hc-ls.ts`

**Files:**

- Create: `lib/herdr/hc-ls.ts`
- Test: `tests/unit/lib/herdr/hc-ls.test.ts`

Format `hc ls` (sprawdzony): `{"hidden_finished":0,"terminals":[{"address":"t1r","agent":"claude-code","cwd":"/home/…","state":"live","status":"working","turn":507,"where":"Monolith / 1"}]}`. Pole `agent` i `status` bywają nieobecne.

- [ ] **Step 1: Test (czerwony)**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { listTerminals, parseHcLs } from "@/lib/herdr/hc-ls";

const DUMP = JSON.stringify({
  hidden_finished: 0,
  terminals: [
    {
      address: "t1q",
      agent: "bash",
      cwd: "/home/u/NEXUS",
      state: "live",
      turn: 0,
      where: "NEXUS / 1",
    },
    {
      address: "t1r",
      agent: "claude-code",
      cwd: "/home/u/Monolith",
      state: "live",
      status: "working",
      turn: 507,
      where: "Monolith / 1",
    },
    { address: "t1u", cwd: "/home/u/Monolith", state: "live", turn: 2, where: "Monolith / 1" },
    { agent: "bez-adresu" },
    5,
  ],
});

describe("parseHcLs", () => {
  it("parsuje terminale, pomija wpisy bez adresu i niebędące obiektami", () => {
    const list = parseHcLs(DUMP);
    expect(list).toHaveLength(3);
    expect(list![1]).toEqual({
      address: "t1r",
      agent: "claude-code",
      cwd: "/home/u/Monolith",
      state: "live",
      status: "working",
      where: "Monolith / 1",
    });
  });

  it("puste lub brakujące pole agent daje pusty napis, brak status nie tworzy klucza", () => {
    const list = parseHcLs(DUMP)!;
    expect(list[2].agent).toBe("");
    expect(list[0]).not.toHaveProperty("status");
  });

  it("zły JSON i brak listy terminals dają null", () => {
    expect(parseHcLs("nie json")).toBeNull();
    expect(parseHcLs("{}")).toBeNull();
    expect(parseHcLs("null")).toBeNull();
  });
});

describe("listTerminals", () => {
  it("zwraca terminale, gdy hc odpowiada", () => {
    const res = listTerminals(() => DUMP);
    expect(res.available).toBe(true);
    if (res.available) expect(res.terminals).toHaveLength(3);
  });

  it("brak hc, timeout (wyjątek z wywołania) kończą się available:false, nie wyjątkiem", () => {
    const res = listTerminals(() => {
      throw new Error("ENOENT");
    });
    expect(res).toEqual({ available: false });
  });

  it("niepoprawna odpowiedź kończy się available:false", () => {
    expect(listTerminals(() => "śmieci")).toEqual({ available: false });
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run tests/unit/lib/herdr/hc-ls.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Implementacja `lib/herdr/hc-ls.ts`**

```ts
import { execFileSync } from "node:child_process";

/** Surowy rekord terminala z `hc ls`. `cwd` nie opuszcza `bc_map/services` (D9). */
export type HerdrTerminal = {
  address: string;
  agent: string;
  cwd: string;
  state: string;
  status?: string;
  where: string;
};

export type TerminalsResult =
  | { available: true; terminals: HerdrTerminal[] }
  | { available: false };

const text = (v: unknown): string => (typeof v === "string" ? v : "");

/** `null`, gdy to nie jest poprawny zrzut `hc ls`. Wpisy bez `address` są pomijane. */
export function parseHcLs(raw: string): HerdrTerminal[] | null {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return null;
  }
  if (doc === null || typeof doc !== "object") return null;
  const list = (doc as { terminals?: unknown }).terminals;
  if (!Array.isArray(list)) return null;
  const out: HerdrTerminal[] = [];
  for (const item of list) {
    if (item === null || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const address = text(r.address);
    if (address === "") continue;
    const status = text(r.status);
    out.push({
      address,
      agent: text(r.agent).trim(),
      cwd: text(r.cwd),
      state: text(r.state),
      where: text(r.where),
      ...(status !== "" ? { status } : {}),
    });
  }
  return out;
}

/** Bez powłoki, stałe argumenty, limit czasu 2 s (wzór: `lib/git/project-git.ts`). */
function runHcLs(): string {
  return execFileSync("hc", ["ls"], {
    encoding: "utf8",
    timeout: 2000,
    maxBuffer: 256 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/** Brak `hc`, błąd, timeout i śmieci w odpowiedzi dają `{ available: false }`, nigdy wyjątek. `run` tylko dla testów. */
export function listTerminals(run: () => string = runHcLs): TerminalsResult {
  try {
    const terminals = parseHcLs(run());
    return terminals === null ? { available: false } : { available: true, terminals };
  } catch {
    return { available: false };
  }
}
```

- [ ] **Step 4: Run — PASS**

Run: `npx vitest run tests/unit/lib/herdr/hc-ls.test.ts`
Expected: PASS (6 testów).

- [ ] **Step 5: Commit**

```bash
git add lib/herdr/hc-ls.ts tests/unit/lib/herdr/hc-ls.test.ts
git commit -m "feat(herdr): lib/herdr, odczyt hc ls (timeout 2 s, bez powłoki)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `bc_map`: models + repositories

**Files:**

- Create: `contexts/bc_map/models.ts`, `contexts/bc_map/repositories.ts`
- Test: `tests/unit/contexts/bc_map/repositories.test.ts`

Po tym tasku test architektury (Task 1) ma być **zielony**.

- [ ] **Step 1: `contexts/bc_map/models.ts`**

```ts
export type Owner = "personal" | "work";

export type MapNode = {
  id: string;
  kind: "project" | "continent";
  label: string;
  /** Tylko kontynenty z danymi (Wiedza, AI-2030): liczba plików `.md`. */
  size?: number;
  owner?: Owner;
  /** D13: placeholder (Skille), bez rozmiaru i krawędzi. */
  soon?: boolean;
};

export type MapEdge = { from: string; to: string; weight: number; type: "shared" };

export type MapTiles = {
  neurons: { total: number; knowledge: number; ai2030: number; projects: number };
  dependencies: number;
};

export type MapGraph = {
  nodes: MapNode[];
  edges: MapEdge[];
  tiles: MapTiles;
  warnings: string[];
};

/** Agent po dopasowaniu i filtrze prywatności (D9). Nigdy nie niesie `cwd`. */
export type Agent = {
  address: string;
  label: string;
  state: string;
  status?: string;
  projectId?: string;
  where?: string;
};

/** Projekt z rejestru w zakresie potrzebnym Mapie (z `bc_projects/services`). */
export type ProjectRef = { id: string; name: string; localPath: string; owner: Owner };

/** Surowe dane z vaulta, przed złożeniem grafu. */
export type MapSources = {
  /** Id projektów z każdej linii `**Używają:**` w `tech-stack-wspolny.md`. */
  sharedSections: string[][];
  /** Niepuste `projects:` z frontmatteru notatek `Knowledge/` (jedna lista na notatkę). */
  noteProjects: string[][];
  counts: { knowledge: number; ai2030: number; projects: number };
  warnings: string[];
};

export const CONTINENT_IDS = {
  knowledge: "@wiedza",
  ai2030: "@ai-2030",
  skills: "@skille",
} as const;
```

- [ ] **Step 2: Test repozytorium (czerwony)** — `tests/unit/contexts/bc_map/repositories.test.ts`

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseNoteProjects,
  parseSharedSections,
  readMapSources,
} from "@/contexts/bc_map/repositories";
import { useTempVault } from "../../helpers/tempVault";

const TECH_STACK = `# Wspólny stack

## OpenAI API — integracja

**Używają:** [[Projects/english-agent/english-agent|English Agent]], [[Projects/gen-podsum-ai/gen-podsum-ai|Gen Podsum AI]] (V2), [[Projects/code-sensei/code-sensei|Code Sensei]]

| Co | Gdzie działa |
| -- | ------------ |
| x  | y            |

## Deploy

| Co | Gdzie |
| -- | ----- |
| x  | y     |

## Supabase — wzorce

**Używają:** [[Projects/english-agent/english-agent|English Agent]]
`;

describe("parseSharedSections", () => {
  it("wyciąga id z linków z dopiskami poza ]], pomija sekcje bez linii Używają", () => {
    expect(parseSharedSections(TECH_STACK)).toEqual([
      ["english-agent", "gen-podsum-ai", "code-sensei"],
      ["english-agent"],
    ]);
  });
});

describe("parseNoteProjects", () => {
  it("zwraca niepuste teksty, ignoruje puste listy i niepoprawne typy", () => {
    expect(parseNoteProjects({ projects: ["nexus", " monolith ", "", 5] })).toEqual([
      "nexus",
      "monolith",
    ]);
    expect(parseNoteProjects({ projects: [] })).toEqual([]);
    expect(parseNoteProjects({ projects: "nexus" })).toEqual([]);
    expect(parseNoteProjects({})).toEqual([]);
  });
});

describe("readMapSources", () => {
  const vault = useTempVault();

  it("czyta sekcje, projekty z notatek i liczby plików; pomija Work/", () => {
    vault.write("tech-stack-wspolny.md", TECH_STACK);
    vault.write("Knowledge/a.md", "---\nname: A\nprojects: [nexus, monolith]\n---\ntreść");
    vault.write("Knowledge/sub/b.md", "---\nname: B\nprojects: []\n---\ntreść");
    vault.write("Knowledge/sub/c.md", "bez frontmatteru");
    vault.write("AI-2030/x.md", "x");
    vault.write("AI-2030/y.md", "y");
    vault.write("Projects/nexus/index.md", "i");
    vault.write("Projects/Work/secret.md", "s");

    const sources = readMapSources();
    expect(sources.sharedSections).toHaveLength(2);
    expect(sources.noteProjects).toEqual([["nexus", "monolith"]]);
    expect(sources.counts).toEqual({ knowledge: 3, ai2030: 2, projects: 1 });
    expect(sources.warnings).toEqual([]);
  });

  it("brak tech-stack-wspolny.md daje ostrzeżenie, nie wyjątek", () => {
    const sources = readMapSources();
    expect(sources.sharedSections).toEqual([]);
    expect(sources.warnings.join(" ")).toMatch(/tech-stack-wspolny\.md/);
    expect(sources.counts).toEqual({ knowledge: 0, ai2030: 0, projects: 0 });
  });
});
```

- [ ] **Step 3: Run — FAIL**

Run: `npx vitest run tests/unit/contexts/bc_map/repositories.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 4: `contexts/bc_map/repositories.ts`**

```ts
import { listTerminals, type TerminalsResult } from "@/lib/herdr/hc-ls";
import { parseFrontmatter, type Frontmatter } from "@/lib/nexus/frontmatter";
import { listVaultFilesRecursive, readVaultFile } from "@/lib/nexus/vault-fs";
import type { MapSources } from "./models";

const TECH_STACK = "tech-stack-wspolny.md";
const USERS_LINE = /^\*\*Używają:\*\*(.*)$/;
const PROJECT_LINK = /\[\[Projects\/([^/|\]]+)/g;

/** Id projektów z każdej linii `**Używają:**` (jedna lista na sekcję); dopiski typu „(V2)” poza `]]` nie przeszkadzają. */
export function parseSharedSections(text: string): string[][] {
  const out: string[][] = [];
  for (const line of text.split("\n")) {
    const m = USERS_LINE.exec(line.trim());
    if (!m) continue;
    out.push([...m[1].matchAll(PROJECT_LINK)].map((x) => x[1]));
  }
  return out;
}

/** Niepuste teksty z pola `projects:` frontmatteru notatki (lista); wszystko inne daje []. */
export function parseNoteProjects(meta: Frontmatter): string[] {
  const value = meta.projects;
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/** Odczyt grafu z vaulta. Nieczytelny plik daje ostrzeżenie zamiast wyjątku. */
export function readMapSources(): MapSources {
  const warnings: string[] = [];

  let sharedSections: string[][] = [];
  const stack = readVaultFile(TECH_STACK);
  if (stack === null) {
    warnings.push(`Brak ${TECH_STACK}: bez krawędzi projekt–projekt`);
  } else {
    sharedSections = parseSharedSections(stack.text);
  }

  const knowledgeFiles = listVaultFilesRecursive("Knowledge");
  const noteProjects: string[][] = [];
  for (const rel of knowledgeFiles) {
    try {
      const file = readVaultFile(rel);
      const parsed = file ? parseFrontmatter(file.text) : null;
      const ids = parsed ? parseNoteProjects(parsed.meta) : [];
      if (ids.length > 0) noteProjects.push(ids);
    } catch {
      warnings.push(`Nie można odczytać notatki ${rel}`);
    }
  }

  return {
    sharedSections,
    noteProjects,
    counts: {
      knowledge: knowledgeFiles.length,
      ai2030: listVaultFilesRecursive("AI-2030").length,
      projects: listVaultFilesRecursive("Projects").length,
    },
    warnings,
  };
}

/** Terminale Herdr (`hc ls`); niedostępny Herdr to `{ available: false }`. */
export function readTerminals(): TerminalsResult {
  return listTerminals();
}
```

- [ ] **Step 5: Run — PASS, w tym test architektury**

Run: `npx vitest run tests/unit/contexts/bc_map/repositories.test.ts tests/unit/architecture.static.test.ts`
Expected: PASS wszystko (test z Taska 1 jest już zielony).

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_map/models.ts contexts/bc_map/repositories.ts tests/unit/contexts/bc_map/repositories.test.ts
git commit -m "feat(mapa): bc_map models i repositories (sekcje Używają, projects: z Wiedzy, liczby plików)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `bc_map/services.ts`

**Files:**

- Create: `contexts/bc_map/services.ts`
- Test: `tests/unit/contexts/bc_map/services.test.ts`

- [ ] **Step 1: Test (czerwony)**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { composeGraph, resolveAgentProject, toAgents } from "@/contexts/bc_map/services";
import type { MapSources, ProjectRef } from "@/contexts/bc_map/models";
import type { HerdrTerminal } from "@/lib/herdr/hc-ls";

const P = (id: string, localPath: string, owner: "personal" | "work" = "personal"): ProjectRef => ({
  id,
  name: id.toUpperCase(),
  localPath,
  owner,
});

describe("composeGraph", () => {
  const projects = [P("nexus", "~/n"), P("monolith", "~/m"), P("english-agent", "~/e")];
  const sources: MapSources = {
    sharedSections: [
      ["english-agent", "monolith", "unknown-x"],
      ["english-agent", "monolith"],
    ],
    noteProjects: [["monolith"], ["monolith", "nexus"], ["ghost"]],
    counts: { knowledge: 10, ai2030: 4, projects: 20 },
    warnings: [],
  };
  const graph = composeGraph(projects, sources);

  it("liczy krawędzie: pary ze wspólnych sekcji i projekt–Wiedza, posortowane", () => {
    expect(graph.edges).toEqual([
      { from: "english-agent", to: "monolith", weight: 2, type: "shared" },
      { from: "monolith", to: "@wiedza", weight: 2, type: "shared" },
      { from: "nexus", to: "@wiedza", weight: 1, type: "shared" },
    ]);
  });

  it("nieznane id nie tworzy krawędzi i daje ostrzeżenie", () => {
    const text = graph.warnings.join("\n");
    expect(text).toContain("unknown-x");
    expect(text).toContain("ghost");
  });

  it("węzły: 3 projekty i 3 kontynenty; Skille to placeholder bez rozmiaru", () => {
    expect(graph.nodes.filter((n) => n.kind === "project").map((n) => n.id)).toEqual([
      "english-agent",
      "monolith",
      "nexus",
    ]);
    const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    expect(byId["@wiedza"]).toMatchObject({ kind: "continent", label: "Wiedza", size: 10 });
    expect(byId["@ai-2030"]).toMatchObject({ kind: "continent", size: 4 });
    expect(byId["@skille"]).toMatchObject({ kind: "continent", soon: true });
    expect(byId["@skille"]).not.toHaveProperty("size");
  });

  it("kafle: neurony bez Skille, zależności = liczba krawędzi", () => {
    expect(graph.tiles).toEqual({
      neurons: { total: 34, knowledge: 10, ai2030: 4, projects: 20 },
      dependencies: 3,
    });
  });
});

describe("resolveAgentProject", () => {
  const home = "/home/u";
  const projects = [
    P("proj", "~/projects/proj"),
    P("proj2", "~/projects/proj-2"),
    P("nested", "~/projects/proj/sub"),
    P("tool", "/opt/tool"),
    P("rel", "relative/path"),
  ];
  const T = (cwd: string): HerdrTerminal => ({
    address: "t1",
    agent: "claude-code",
    cwd,
    state: "live",
    where: "w",
  });
  const idFor = (cwd: string) =>
    resolveAgentProject([T(cwd)], projects, home)[0].project?.id ?? null;

  it("granica segmentu: proj-2 nie pasuje do proj", () => {
    expect(idFor("/home/u/projects/proj-2")).toBe("proj2");
    expect(idFor("/home/u/projects/proj-2/src")).toBe("proj2");
  });
  it("najdłuższy prefiks wygrywa", () => {
    expect(idFor("/home/u/projects/proj/sub/x")).toBe("nested");
    expect(idFor("/home/u/projects/proj/other")).toBe("proj");
  });
  it("dokładna ścieżka i ukośnik końcowy", () => {
    expect(idFor("/home/u/projects/proj")).toBe("proj");
    expect(idFor("/home/u/projects/proj/")).toBe("proj");
  });
  it("ścieżka bezwzględna w rejestrze; względna jest ignorowana", () => {
    expect(idFor("/opt/tool/bin")).toBe("tool");
    expect(idFor("relative/path")).toBeNull();
  });
  it("brak dopasowania i pusty cwd", () => {
    expect(idFor("/home/u/other")).toBeNull();
    expect(idFor("")).toBeNull();
  });
});

describe("toAgents (prywatność D9)", () => {
  const home = "/home/u";
  const projects = [P("mine", "~/mine"), P("job", "~/job", "work")];
  const T = (address: string, agent: string, cwd: string, status?: string): HerdrTerminal => ({
    address,
    agent,
    cwd,
    state: "live",
    where: `${address} / 1`,
    ...(status ? { status } : {}),
  });
  const agents = toAgents(
    resolveAgentProject(
      [
        T("t1", "claude-code", "/home/u/mine", "working"),
        T("t2", "claude-code", "/home/u/job/app", "working"),
        T("t3", "antigravity", "/somewhere/else", "done"),
        T("t4", "bash", "/home/u/mine"),
        T("t5", "", "/home/u/mine"),
      ],
      projects,
      home
    )
  );
  const byAddr = Object.fromEntries(agents.map((a) => [a.address, a]));

  it("pomija powłokę (agent bash)", () => {
    expect(agents.map((a) => a.address)).toEqual(["t1", "t2", "t3", "t5"]);
  });
  it("agent z projektu personal ma projekt, where i status", () => {
    expect(byAddr.t1).toEqual({
      address: "t1",
      label: "claude-code",
      state: "live",
      status: "working",
      projectId: "mine",
      where: "t1 / 1",
    });
  });
  it("agent z projektu work i agent bez projektu mają tylko etykietę i stan", () => {
    expect(byAddr.t2).toEqual({ address: "t2", label: "claude-code", state: "live" });
    expect(byAddr.t3).toEqual({ address: "t3", label: "antigravity", state: "live" });
  });
  it("pusty agent dostaje etykietę „terminal”", () => {
    expect(byAddr.t5.label).toBe("terminal");
  });
  it("cwd nigdy nie trafia do wyniku", () => {
    expect(JSON.stringify(agents)).not.toContain("/home/u");
    expect(JSON.stringify(agents)).not.toContain("/somewhere");
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run tests/unit/contexts/bc_map/services.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: `contexts/bc_map/services.ts`**

```ts
import os from "node:os";
import path from "node:path";
import { isWorkProject, listProjects } from "@/contexts/bc_projects/services";
import type { HerdrTerminal } from "@/lib/herdr/hc-ls";
import {
  CONTINENT_IDS,
  type Agent,
  type MapEdge,
  type MapGraph,
  type MapNode,
  type MapSources,
  type ProjectRef,
} from "./models";
import { readMapSources, readTerminals } from "./repositories";

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const SEP = "\u0000";

/** Czysta funkcja: składa węzły, krawędzie i kafle. Nieznane id (spoza rejestru) pomija z ostrzeżeniem. */
export function composeGraph(projects: ProjectRef[], sources: MapSources): MapGraph {
  const warnings = [...sources.warnings];
  const known = new Set(projects.map((p) => p.id));
  const unknown = new Set<string>();
  const weights = new Map<string, number>();
  const bump = (a: string, b: string): void => {
    const key = `${a}${SEP}${b}`;
    weights.set(key, (weights.get(key) ?? 0) + 1);
  };

  for (const section of sources.sharedSections) {
    const ids = [...new Set(section)];
    for (const id of ids) if (!known.has(id)) unknown.add(id);
    const valid = ids.filter((id) => known.has(id)).sort(cmp);
    for (let i = 0; i < valid.length; i += 1) {
      for (let j = i + 1; j < valid.length; j += 1) bump(valid[i], valid[j]);
    }
  }
  for (const noteIds of sources.noteProjects) {
    for (const id of new Set(noteIds)) {
      if (known.has(id)) bump(id, CONTINENT_IDS.knowledge);
      else unknown.add(id);
    }
  }
  for (const id of [...unknown].sort(cmp)) {
    warnings.push(
      `Mapa: nieznany projekt „${id}” w tech-stack-wspolny.md lub notatkach Wiedzy (pominięty)`
    );
  }

  const edges: MapEdge[] = [...weights]
    .map(([key, weight]) => {
      const [from, to] = key.split(SEP);
      return { from, to, weight, type: "shared" as const };
    })
    .sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to));

  const { counts } = sources;
  const nodes: MapNode[] = [
    ...[...projects]
      .sort((a, b) => cmp(a.id, b.id))
      .map((p): MapNode => ({ id: p.id, kind: "project", label: p.name, owner: p.owner })),
    { id: CONTINENT_IDS.knowledge, kind: "continent", label: "Wiedza", size: counts.knowledge },
    { id: CONTINENT_IDS.ai2030, kind: "continent", label: "AI-2030", size: counts.ai2030 },
    { id: CONTINENT_IDS.skills, kind: "continent", label: "Skille", soon: true },
  ];

  return {
    nodes,
    edges,
    tiles: {
      neurons: {
        total: counts.knowledge + counts.ai2030 + counts.projects,
        knowledge: counts.knowledge,
        ai2030: counts.ai2030,
        projects: counts.projects,
      },
      dependencies: edges.length,
    },
    warnings,
  };
}

/** `~`, `~/x` lub ścieżka bezwzględna → znormalizowana ścieżka bez końcowego `/`; inaczej `null`. */
function expandHome(raw: string, home: string): string | null {
  const p = raw.trim();
  let abs: string;
  if (p === "~") abs = home;
  else if (p.startsWith("~/")) abs = path.posix.join(home, p.slice(2));
  else if (p.startsWith("/")) abs = p;
  else return null;
  const norm = path.posix.normalize(abs).replace(/\/+$/, "");
  return norm === "" ? null : norm;
}

export type ResolvedTerminal = { terminal: HerdrTerminal; project: ProjectRef | null };

/**
 * Agent → projekt po prefiksie `cwd` względem `localPath` na granicy segmentu; najdłuższy prefiks wygrywa
 * (remis długości: alfabetycznie po `id`). Porównanie tekstowe, symlinki nie są rozwiązywane.
 */
export function resolveAgentProject(
  terminals: HerdrTerminal[],
  projects: ProjectRef[],
  home: string
): ResolvedTerminal[] {
  const roots = projects.flatMap((project) => {
    const root = expandHome(project.localPath, home);
    return root === null ? [] : [{ project, root }];
  });
  return terminals.map((terminal) => {
    if (!terminal.cwd.startsWith("/")) return { terminal, project: null };
    const cwd = path.posix.normalize(terminal.cwd).replace(/\/+$/, "");
    let best: { project: ProjectRef; root: string } | null = null;
    for (const r of roots) {
      if (cwd !== r.root && !cwd.startsWith(`${r.root}/`)) continue;
      if (
        best === null ||
        r.root.length > best.root.length ||
        (r.root.length === best.root.length && r.project.id < best.project.id)
      ) {
        best = r;
      }
    }
    return { terminal, project: best?.project ?? null };
  });
}

const isAgentTerminal = (t: HerdrTerminal): boolean => t.agent.toLowerCase() !== "bash";

/** Filtr prywatności D9: `work` i brak projektu → tylko adres, etykieta i stan. `cwd` nie opuszcza tej funkcji. */
export function toAgents(resolved: ResolvedTerminal[]): Agent[] {
  return resolved
    .filter(({ terminal }) => isAgentTerminal(terminal))
    .map(({ terminal, project }): Agent => {
      const base = {
        address: terminal.address,
        label: terminal.agent === "" ? "terminal" : terminal.agent,
        state: terminal.state,
      };
      if (project === null || isWorkProject(project)) return base;
      return {
        ...base,
        ...(terminal.status ? { status: terminal.status } : {}),
        projectId: project.id,
        where: terminal.where,
      };
    });
}

function projectRefs(): { refs: ProjectRef[]; warnings: string[] } {
  const { projects, warnings } = listProjects();
  return {
    refs: projects.map((p) => ({ id: p.id, name: p.name, localPath: p.localPath, owner: p.owner })),
    warnings,
  };
}

export function getGraph(): MapGraph {
  const { refs, warnings } = projectRefs();
  const graph = composeGraph(refs, readMapSources());
  return { ...graph, warnings: [...warnings, ...graph.warnings] };
}

export function getAgents(): { available: boolean; agents: Agent[] } {
  const result = readTerminals();
  if (!result.available) return { available: false, agents: [] };
  const { refs } = projectRefs();
  return {
    available: true,
    agents: toAgents(resolveAgentProject(result.terminals, refs, os.homedir())),
  };
}
```

- [ ] **Step 4: Run — PASS + architektura**

Run: `npx vitest run tests/unit/contexts/bc_map tests/unit/architecture.static.test.ts`
Expected: PASS. (R2: `bc_map/services` → `bc_projects/services` dozwolone; R7: brak cyklu, bo `bc_projects` nie importuje `bc_map`.)

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_map/services.ts tests/unit/contexts/bc_map/services.test.ts
git commit -m "feat(mapa): bc_map services (graf, kafle, dopasowanie agent → projekt, prywatność D9)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `bc_map`: schemas, router, trasy

**Files:**

- Create: `contexts/bc_map/schemas.ts`, `contexts/bc_map/router.ts`, `app/api/map/graph/route.ts`, `app/api/map/agents/route.ts`
- Test: `tests/unit/contexts/bc_map/schemas.test.ts`, `tests/unit/contexts/bc_map/router.test.ts`

- [ ] **Step 1: Testy (czerwone)**

`tests/unit/contexts/bc_map/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Agent, MapGraph } from "@/contexts/bc_map/models";
import {
  MapAgentsDtoSchema,
  MapGraphDtoSchema,
  toAgentsDto,
  toGraphDto,
} from "@/contexts/bc_map/schemas";

const graph: MapGraph = {
  nodes: [
    { id: "nexus", kind: "project", label: "NEXUS", owner: "personal" },
    { id: "@skille", kind: "continent", label: "Skille", soon: true },
  ],
  edges: [{ from: "nexus", to: "@wiedza", weight: 2, type: "shared" }],
  tiles: { neurons: { total: 5, knowledge: 2, ai2030: 1, projects: 2 }, dependencies: 1 },
  warnings: ["w"],
};

describe("toGraphDto", () => {
  it("daje DTO zgodne ze schematem, z kaflem blokerów = null (D12)", () => {
    const dto = toGraphDto(graph);
    expect(dto.tiles.blockers).toBeNull();
    expect(MapGraphDtoSchema.safeParse(dto).success).toBe(true);
  });
});

describe("toAgentsDto", () => {
  it("kopiuje tylko znane pola: nawet obce pole cwd nie przechodzi", () => {
    const leaky = { address: "t1", label: "x", state: "live", cwd: "/home/u/secret" } as Agent;
    const dto = toAgentsDto({ available: true, agents: [leaky] });
    expect(JSON.stringify(dto)).not.toContain("secret");
    expect(MapAgentsDtoSchema.safeParse(dto).success).toBe(true);
  });
});
```

`tests/unit/contexts/bc_map/router.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const mockGetGraph = vi.hoisted(() => vi.fn());
const mockGetAgents = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_map/services", () => ({
  getGraph: mockGetGraph,
  getAgents: mockGetAgents,
}));

import { GET as graphGET } from "@/app/api/map/graph/route";
import { GET as agentsGET } from "@/app/api/map/agents/route";

beforeEach(() => {
  mockGetGraph.mockReset();
  mockGetAgents.mockReset();
});

describe("GET /api/map/graph", () => {
  it("zwraca graf jako DTO", async () => {
    mockGetGraph.mockReturnValue({
      nodes: [{ id: "nexus", kind: "project", label: "NEXUS", owner: "personal" }],
      edges: [],
      tiles: { neurons: { total: 1, knowledge: 0, ai2030: 0, projects: 1 }, dependencies: 0 },
      warnings: [],
    });
    const res = await graphGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodes).toHaveLength(1);
    expect(body.tiles.blockers).toBeNull();
  });

  it("błąd domeny mapuje na jego status", async () => {
    mockGetGraph.mockImplementation(() => {
      throw new DomainError("boom", 400);
    });
    const res = await graphGET();
    expect(res.status).toBe(400);
  });
});

describe("GET /api/map/agents", () => {
  it("zwraca agentów i available", async () => {
    mockGetAgents.mockReturnValue({
      available: true,
      agents: [{ address: "t1", label: "claude-code", state: "live" }],
    });
    const res = await agentsGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      available: true,
      agents: [{ address: "t1", label: "claude-code", state: "live" }],
    });
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run tests/unit/contexts/bc_map/schemas.test.ts tests/unit/contexts/bc_map/router.test.ts`
Expected: FAIL (brak modułów).

- [ ] **Step 3: `contexts/bc_map/schemas.ts`**

```ts
import { z } from "zod";
import type { Agent, MapGraph } from "./models";

const count = z.number().int().nonnegative();

export const MapNodeDtoSchema = z.object({
  id: z.string(),
  kind: z.enum(["project", "continent"]),
  label: z.string(),
  size: count.optional(),
  owner: z.enum(["personal", "work"]).optional(),
  soon: z.boolean().optional(),
});

export const MapEdgeDtoSchema = z.object({
  from: z.string(),
  to: z.string(),
  weight: z.number().int().positive(),
  type: z.literal("shared"),
});

export const MapGraphDtoSchema = z.object({
  nodes: z.array(MapNodeDtoSchema),
  edges: z.array(MapEdgeDtoSchema),
  tiles: z.object({
    neurons: z.object({ total: count, knowledge: count, ai2030: count, projects: count }),
    dependencies: count,
    /** D12: brak danych o blokerach. */
    blockers: z.null(),
  }),
  warnings: z.array(z.string()),
});

export const AgentDtoSchema = z.object({
  address: z.string(),
  label: z.string(),
  state: z.string(),
  status: z.string().optional(),
  projectId: z.string().optional(),
  where: z.string().optional(),
});

export const MapAgentsDtoSchema = z.object({
  agents: z.array(AgentDtoSchema),
  available: z.boolean(),
});

export type MapNodeDto = z.infer<typeof MapNodeDtoSchema>;
export type MapEdgeDto = z.infer<typeof MapEdgeDtoSchema>;
export type MapGraphDto = z.infer<typeof MapGraphDtoSchema>;
export type AgentDto = z.infer<typeof AgentDtoSchema>;
export type MapAgentsDto = z.infer<typeof MapAgentsDtoSchema>;

export function toGraphDto(graph: MapGraph): MapGraphDto {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      label: n.label,
      ...(n.size !== undefined ? { size: n.size } : {}),
      ...(n.owner !== undefined ? { owner: n.owner } : {}),
      ...(n.soon ? { soon: true } : {}),
    })),
    edges: graph.edges.map((e) => ({ from: e.from, to: e.to, weight: e.weight, type: e.type })),
    tiles: {
      neurons: { ...graph.tiles.neurons },
      dependencies: graph.tiles.dependencies,
      blockers: null,
    },
    warnings: [...graph.warnings],
  };
}

/** Jawne kopiowanie pól: żadne dodatkowe pole (np. `cwd`) nie przejdzie do odpowiedzi. */
export function toAgentDto(a: Agent): AgentDto {
  return {
    address: a.address,
    label: a.label,
    state: a.state,
    ...(a.status !== undefined ? { status: a.status } : {}),
    ...(a.projectId !== undefined ? { projectId: a.projectId } : {}),
    ...(a.where !== undefined ? { where: a.where } : {}),
  };
}

export function toAgentsDto(result: { available: boolean; agents: Agent[] }): MapAgentsDto {
  return { available: result.available, agents: result.agents.map(toAgentDto) };
}
```

- [ ] **Step 4: `contexts/bc_map/router.ts`**

```ts
import { NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { toAgentsDto, toGraphDto } from "./schemas";
import * as services from "./services";

export async function getMapGraph(): Promise<NextResponse> {
  try {
    return NextResponse.json(toGraphDto(services.getGraph()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function getMapAgents(): Promise<NextResponse> {
  try {
    return NextResponse.json(toAgentsDto(services.getAgents()));
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 5: Trasy (tylko re-eksport)**

`app/api/map/graph/route.ts`:

```ts
export { getMapGraph as GET } from "@/contexts/bc_map/router";

// Vault czytamy przy każdym żądaniu; bez tego Next mógłby wyrenderować trasę statycznie przy buildzie.
export const dynamic = "force-dynamic";
```

`app/api/map/agents/route.ts`:

```ts
export { getMapAgents as GET } from "@/contexts/bc_map/router";

// Stan Herdr zmienia się w czasie; trasa nigdy nie jest statyczna.
export const dynamic = "force-dynamic";
```

- [ ] **Step 6: Run — PASS, wraz z testami strażniczymi**

Run: `npx vitest run tests/unit/contexts/bc_map tests/unit/architecture.static.test.ts tests/unit/no-model-api.static.test.ts`
Expected: PASS. (Trasy `/api/map/*` nie pasują do `FORBIDDEN`; R4 — trasa to jeden re-eksport routera.)

- [ ] **Step 7: Commit**

```bash
git add contexts/bc_map/schemas.ts contexts/bc_map/router.ts app/api/map tests/unit/contexts/bc_map/schemas.test.ts tests/unit/contexts/bc_map/router.test.ts
git commit -m "feat(mapa): schemas, router i trasy /api/map/graph i /api/map/agents

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `globeMath.ts` (czysta matematyka)

**Files:**

- Create: `src/features/map/globeMath.ts`
- Test: `tests/unit/features/map/globeMath.test.ts`

Konwencje: oś `z` wskazuje na widza; punkt `lon=0, lat=0` leży na wprost (`z=1`). `rotate`: najpierw obrót wokół `y` o `yaw`, potem wokół `x` o `pitch`. Rzut perspektywiczny: kamera w odległości `CAMERA = 3`, `scale = 3 / (3 - z)` (bliżej widza = większy).

- [ ] **Step 1: Test (czerwony)**

```ts
import { describe, expect, it } from "vitest";
import {
  arcPoints,
  fromLonLat,
  globeRadius,
  hitTest,
  isClick,
  layoutNodes,
  project,
  rotate,
  rotationTo,
  wrapAngle,
  type Vec3,
} from "@/src/features/map/globeMath";

const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

const CONT = [
  { id: "@a", kind: "continent" as const },
  { id: "@b", kind: "continent" as const },
  { id: "@c", kind: "continent" as const },
];

describe("layoutNodes", () => {
  const nodes = [
    ...CONT,
    ...["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => ({ id, kind: "project" as const })),
    { id: "free", kind: "project" as const },
  ];
  const edges = ["p1", "p2", "p3", "p4", "p5", "p6"].map((p) => ({ from: p, to: "@a", weight: 1 }));

  it("jest deterministyczny", () => {
    expect(layoutNodes(nodes, edges)).toEqual(
      layoutNodes([...nodes].reverse(), [...edges].reverse())
    );
  });

  it("wszystkie punkty leżą na sferze jednostkowej", () => {
    for (const v of Object.values(layoutNodes(nodes, edges))) expect(len(v)).toBeCloseTo(1, 9);
  });

  it("kotwice kontynentów są rozłożone (cięciwa 120° ≈ 1,73)", () => {
    const pos = layoutNodes(nodes, edges);
    expect(dist(pos["@a"], pos["@b"])).toBeGreaterThan(1.5);
    expect(dist(pos["@b"], pos["@c"])).toBeGreaterThan(1.5);
    expect(dist(pos["@a"], pos["@c"])).toBeGreaterThan(1.5);
  });

  it("projekty z jednego sektora nie nakładają się", () => {
    const pos = layoutNodes(nodes, edges);
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        expect(dist(pos[ids[i]], pos[ids[j]])).toBeGreaterThan(0.2);
      }
    }
  });

  it("projekt leży bliżej kontynentu o największej wadze; remis: pierwszy alfabetycznie", () => {
    const pos = layoutNodes(
      [...CONT, { id: "x", kind: "project" }, { id: "y", kind: "project" }],
      [
        { from: "x", to: "@a", weight: 1 },
        { from: "x", to: "@b", weight: 3 },
        { from: "y", to: "@c", weight: 2 },
        { from: "y", to: "@b", weight: 2 },
      ]
    );
    expect(dot(pos.x, pos["@b"])).toBeGreaterThan(dot(pos.x, pos["@a"]));
    expect(dot(pos.y, pos["@b"])).toBeGreaterThan(dot(pos.y, pos["@c"]));
  });

  it("projekt bez krawędzi też dostaje punkt na sferze", () => {
    expect(len(layoutNodes(nodes, edges).free)).toBeCloseTo(1, 9);
  });
});

describe("rotate / rotationTo", () => {
  it("rotationTo sprowadza punkt na wprost widza", () => {
    for (const [lon, lat] of [
      [0.3, 0.4],
      [2.5, -0.7],
      [-1.9, 0.1],
    ]) {
      const p = fromLonLat(lon, lat);
      const { yaw, pitch } = rotationTo(p);
      const r = rotate(p, yaw, pitch);
      expect(r.x).toBeCloseTo(0, 9);
      expect(r.y).toBeCloseTo(0, 9);
      expect(r.z).toBeCloseTo(1, 9);
    }
  });

  it("rotate zachowuje długość", () => {
    expect(len(rotate({ x: 0.2, y: 0.5, z: 0.84 }, 1.1, -0.4))).toBeCloseTo(
      len({ x: 0.2, y: 0.5, z: 0.84 }),
      9
    );
  });
});

describe("project", () => {
  it("punkt przed kulą jest większy niż za kulą", () => {
    const front = project({ x: 0, y: 0, z: 1 }, 400, 400);
    const back = project({ x: 0, y: 0, z: -1 }, 400, 400);
    expect(front.scale).toBeGreaterThan(back.scale);
    expect(front.z).toBe(1);
  });

  it("środek kuli ląduje na środku płótna, y rośnie w dół ekranu", () => {
    const c = project({ x: 0, y: 0, z: 0 }, 400, 300);
    expect(c.x).toBeCloseTo(200, 9);
    expect(c.y).toBeCloseTo(150, 9);
    expect(project({ x: 0, y: 1, z: 0 }, 400, 300).y).toBeLessThan(150);
  });

  it("globeRadius zależy od krótszego boku", () => {
    expect(globeRadius(400, 300)).toBeCloseTo(300 * 0.36, 9);
  });
});

describe("arcPoints", () => {
  it("zaczyna i kończy w węzłach, wszystkie punkty na sferze", () => {
    const a = fromLonLat(0.2, 0.3);
    const b = fromLonLat(2.0, -0.4);
    const pts = arcPoints(a, b, 20);
    expect(pts).toHaveLength(21);
    expect(dist(pts[0], a)).toBeCloseTo(0, 9);
    expect(dist(pts[20], b)).toBeCloseTo(0, 9);
    for (const p of pts) expect(len(p)).toBeCloseTo(1, 9);
  });

  it("punkty antypodalne nie dają NaN i omijają środek kuli", () => {
    const a = { x: 0, y: 0, z: 1 };
    const b = { x: 0, y: 0, z: -1 };
    const pts = arcPoints(a, b, 16);
    for (const p of pts) {
      expect(Number.isNaN(p.x + p.y + p.z)).toBe(false);
      expect(len(p)).toBeCloseTo(1, 6);
    }
    expect(dist(pts[0], a)).toBeCloseTo(0, 6);
    expect(dist(pts[16], b)).toBeCloseTo(0, 6);
  });

  it("ten sam punkt daje stały łuk bez NaN", () => {
    const a = fromLonLat(1, 0.2);
    for (const p of arcPoints(a, a, 4)) expect(dist(p, a)).toBeCloseTo(0, 9);
  });
});

describe("hitTest / isClick / wrapAngle", () => {
  const nodes = [
    { id: "back", x: 100, y: 100, z: -0.5, r: 10 },
    { id: "near", x: 100, y: 100, z: 0.8, r: 10 },
    { id: "far", x: 300, y: 300, z: 0.1, r: 10 },
  ];
  it("wybiera najbliższy widzowi węzeł (z malejąco), ignoruje tylną półkulę", () => {
    expect(hitTest(nodes, 102, 101)).toBe("near");
    expect(hitTest([nodes[0]], 100, 100)).toBeNull();
  });
  it("trafienie w promieniu + margines, pudło daje null", () => {
    expect(hitTest(nodes, 300 + 13, 300)).toBe("far");
    expect(hitTest(nodes, 300 + 20, 300)).toBeNull();
  });
  it("próg kliknięcia to 4 px", () => {
    expect(isClick(3, 0)).toBe(true);
    expect(isClick(2.9, 2.9)).toBe(false);
    expect(isClick(4, 0)).toBe(false);
  });
  it("wrapAngle sprowadza do (−π, π]", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5, 9);
  });
});
```

Uwaga do `isClick(2.9, 2.9)`: `hypot(2.9, 2.9) ≈ 4.10`, więc `false`.
Uwaga do `wrapAngle(-3π)`: wynik ma być `π` lub `−π`; test zakłada `π`, więc implementacja sprowadza do `(−π, π]` (patrz niżej).

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run tests/unit/features/map/globeMath.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: `src/features/map/globeMath.ts`**

```ts
export type Vec3 = { x: number; y: number; z: number };
export type LayoutNode = { id: string; kind: "project" | "continent" };
export type LayoutEdge = { from: string; to: string; weight: number };
export type Projected = { x: number; y: number; z: number; scale: number };
export type ProjectedNode = { id: string; x: number; y: number; z: number; r: number };

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const CAMERA = 3;
const EPS = 1e-6;
export const CLICK_THRESHOLD_PX = 4;
/** Węzły na tylnej półkuli poniżej tego `z` nie reagują na klik. */
export const HIT_MIN_Z = -0.2;

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** `lon`/`lat` w radianach; `lon=0, lat=0` leży na wprost widza (`z=1`). */
export function fromLonLat(lon: number, lat: number): Vec3 {
  return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
}

/** Kąt do przedziału (−π, π]. */
export function wrapAngle(a: number): number {
  const t = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return t === -Math.PI ? Math.PI : t;
}

/**
 * Deterministyczny układ na kuli (zależy tylko od danych). Kontynenty: równomiernie na równiku (kolejność
 * po `id`). Projekt: blisko kontynentu o największej wadze krawędzi (remis: pierwszy alfabetycznie),
 * na szerokości ±38° (naprzemiennie), rozsunięty po długości w sektorze kontynentu. Bez krawędzi:
 * równomiernie po długości, szerokość ±62°.
 */
export function layoutNodes(nodes: LayoutNode[], edges: LayoutEdge[]): Record<string, Vec3> {
  const out: Record<string, Vec3> = {};
  const continents = nodes
    .filter((n) => n.kind === "continent")
    .map((n) => n.id)
    .sort(cmp);
  const projects = nodes
    .filter((n) => n.kind === "project")
    .map((n) => n.id)
    .sort(cmp);
  const sector = continents.length > 0 ? TAU / continents.length : TAU;
  const lonOf = new Map<string, number>();
  continents.forEach((id, i) => {
    lonOf.set(id, sector * i);
    out[id] = fromLonLat(sector * i, 0);
  });

  const groups = new Map<string, string[]>();
  const free: string[] = [];
  for (const p of projects) {
    let best: string | null = null;
    let bestWeight = 0;
    for (const e of edges) {
      const other = e.from === p ? e.to : e.to === p ? e.from : null;
      if (other === null || !lonOf.has(other)) continue;
      if (e.weight > bestWeight || (e.weight === bestWeight && best !== null && other < best)) {
        best = other;
        bestWeight = e.weight;
      }
    }
    if (best === null) free.push(p);
    else groups.set(best, [...(groups.get(best) ?? []), p]);
  }

  for (const [continent, ids] of groups) {
    const width = sector * 0.8;
    ids.forEach((id, j) => {
      const lon = (lonOf.get(continent) ?? 0) + width * ((j + 0.5) / ids.length - 0.5);
      out[id] = fromLonLat(lon, (j % 2 === 0 ? 1 : -1) * 38 * DEG);
    });
  }
  free.forEach((id, m) => {
    out[id] = fromLonLat((TAU * (m + 0.5)) / free.length, (m % 2 === 0 ? 1 : -1) * 62 * DEG);
  });
  return out;
}

/** Obrót wokół osi `y` o `yaw`, potem wokół `x` o `pitch`. */
export function rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return { x: x1, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
}

/** Kąty, po których `rotate` ustawia punkt dokładnie na wprost widza. */
export function rotationTo(p: Vec3): { yaw: number; pitch: number } {
  return { yaw: -Math.atan2(p.x, p.z), pitch: Math.atan2(p.y, Math.hypot(p.x, p.z)) };
}

export function globeRadius(w: number, h: number): number {
  return Math.min(w, h) * 0.36;
}

/** Rzut perspektywiczny; `scale` > 1 dla punktów przed kulą, < 1 za nią; `y` rośnie w dół ekranu. */
export function project(p: Vec3, w: number, h: number): Projected {
  const scale = CAMERA / (CAMERA - p.z);
  const r = globeRadius(w, h);
  return { x: w / 2 + p.x * r * scale, y: h / 2 - p.y * r * scale, z: p.z, scale };
}

function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const theta = Math.acos(d);
  const s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s;
  const wb = Math.sin(t * theta) / s;
  return { x: wa * a.x + wb * b.x, y: wa * a.y + wb * b.y, z: wa * a.z + wb * b.z };
}

/**
 * `n + 1` punktów łuku wielkiego koła od `a` do `b` (slerp). Dla punktów prawie antypodalnych
 * (`sin θ ≈ 0`) łuk przechodzi przez punkt pośredni prostopadły do obu; dla tego samego punktu
 * wszystkie punkty są równe `a`.
 */
export function arcPoints(a: Vec3, b: Vec3, n: number): Vec3[] {
  const count = Math.max(1, Math.floor(n));
  const d = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const out: Vec3[] = [];
  if (Math.sin(Math.acos(d)) < EPS) {
    if (d > 0) return Array.from({ length: count + 1 }, () => ({ ...a }));
    const helper: Vec3 = Math.abs(a.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const cx = a.y * helper.z - a.z * helper.y;
    const cy = a.z * helper.x - a.x * helper.z;
    const cz = a.x * helper.y - a.y * helper.x;
    const l = Math.hypot(cx, cy, cz);
    const mid: Vec3 = { x: cx / l, y: cy / l, z: cz / l };
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      out.push(t <= 0.5 ? slerp(a, mid, t * 2) : slerp(mid, b, (t - 0.5) * 2));
    }
    return out;
  }
  for (let i = 0; i <= count; i += 1) out.push(slerp(a, b, i / count));
  return out;
}

/** Najbliższy widzowi węzeł w promieniu `r + pad`; węzły z `z < HIT_MIN_Z` (tylna półkula) są ignorowane. */
export function hitTest(nodes: ProjectedNode[], x: number, y: number, pad = 4): string | null {
  const sorted = [...nodes].sort((a, b) => b.z - a.z);
  for (const n of sorted) {
    if (n.z < HIT_MIN_Z) continue;
    if (Math.hypot(n.x - x, n.y - y) <= n.r + pad) return n.id;
  }
  return null;
}

/** Przesunięcie poniżej 4 px od wciśnięcia to klik, nie przeciągnięcie. */
export function isClick(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < CLICK_THRESHOLD_PX;
}
```

Uwaga o `slerp` w gałęzi antypodalnej: segmenty `a→mid` i `mid→b` są prostopadłe (θ = 90°, sin θ = 1), więc nie ma dzielenia przez zero.

- [ ] **Step 4: Run — PASS**

Run: `npx vitest run tests/unit/features/map/globeMath.test.ts`
Expected: PASS (wszystkie). Jeśli `projekty z jednego sektora` padnie na progu 0,2: rozsuń `width` (np. do `sector * 0.9`), nie zmieniaj testu.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/globeMath.ts tests/unit/features/map/globeMath.test.ts
git commit -m "feat(mapa): globeMath (układ na kuli, rotacja, rzut, łuki, hit-test)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Dane i małe komponenty UI

**Files:**

- Create: `src/features/map/mapTiles.ts`, `useMapGraph.ts`, `useMapAgents.ts`, `MapNodeList.tsx`, `MapAgentsPanel.tsx`, `MapBlockersPanel.tsx`
- Test: `tests/unit/features/map/mapTiles.test.ts`, `MapNodeList.test.tsx`, `MapAgentsPanel.test.tsx`, `MapBlockersPanel.test.tsx`

UI importuje z kontekstu **wyłącznie** `@/contexts/bc_map/schemas` (R1).

- [ ] **Step 1: Testy (czerwone)**

`tests/unit/features/map/mapTiles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MapGraphDto } from "@/contexts/bc_map/schemas";
import { buildMapTiles } from "@/src/features/map/mapTiles";

const graph: MapGraphDto = {
  nodes: [],
  edges: [],
  tiles: {
    neurons: { total: 330, knowledge: 300, ai2030: 20, projects: 10 },
    dependencies: 12,
    blockers: null,
  },
  warnings: [],
};

describe("buildMapTiles", () => {
  it("cztery kafle z realnymi liczbami; blokery to „—”", () => {
    const tiles = buildMapTiles(graph, { available: true, count: 3 });
    expect(tiles.map((t) => [t.id, t.value])).toEqual([
      ["neurons", "330"],
      ["deps", "12"],
      ["blockers", "—"],
      ["agents", "3"],
    ]);
    expect(tiles[0].meta).toContain("300 Wiedza");
  });

  it("niedostępny Herdr: kafel agentów to „—”", () => {
    const tiles = buildMapTiles(graph, { available: false, count: 0 });
    expect(tiles[3].value).toBe("—");
    expect(tiles[3].meta).toMatch(/niedostępny/);
  });
});
```

`tests/unit/features/map/MapNodeList.test.tsx`:

```tsx
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapNodeList } from "@/src/features/map/MapNodeList";

afterEach(() => cleanup());

const nodes = [
  { id: "nexus", kind: "project" as const, label: "NEXUS" },
  { id: "@wiedza", kind: "continent" as const, label: "Wiedza", size: 300 },
  { id: "@skille", kind: "continent" as const, label: "Skille", soon: true },
];

describe("MapNodeList", () => {
  it("Tab + Enter wybiera węzeł", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MapNodeList nodes={nodes} selectedId={null} onSelect={onSelect} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("nexus");
  });

  it("opisuje rozmiar kontynentu i placeholder", () => {
    render(<MapNodeList nodes={nodes} selectedId="@wiedza" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Wiedza.*300/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(screen.getByRole("button", { name: /Skille.*wkrótce/ })).toBeInTheDocument();
  });
});
```

`tests/unit/features/map/MapAgentsPanel.test.tsx`:

```tsx
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapAgentsPanel } from "@/src/features/map/MapAgentsPanel";

afterEach(() => cleanup());

describe("MapAgentsPanel", () => {
  it("niedostępny Herdr pokazuje komunikat i nie psuje panelu", () => {
    render(
      <MapAgentsPanel
        available={false}
        agents={[]}
        loading={false}
        projectNames={{}}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText("Herdr niedostępny")).toBeInTheDocument();
  });

  it("agent z projektu ma nazwę projektu i miejsce; agent bez projektu tylko etykietę i stan", () => {
    render(
      <MapAgentsPanel
        available
        loading={false}
        projectNames={{ mine: "Moja apka" }}
        onRefresh={() => {}}
        agents={[
          {
            address: "t1",
            label: "claude-code",
            state: "live",
            status: "working",
            projectId: "mine",
            where: "Mono / 1",
          },
          { address: "t2", label: "antigravity", state: "live" },
        ]}
      />
    );
    expect(screen.getByText("Moja apka")).toBeInTheDocument();
    expect(screen.getByText("Mono / 1")).toBeInTheDocument();
    expect(screen.getByText("antigravity")).toBeInTheDocument();
    expect(screen.getAllByText("live")).toHaveLength(2);
  });

  it("przycisk „Odśwież stan” wywołuje odświeżenie", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(
      <MapAgentsPanel
        available
        agents={[]}
        loading={false}
        projectNames={{}}
        onRefresh={onRefresh}
      />
    );
    await user.click(screen.getByRole("button", { name: "Odśwież stan" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
```

`tests/unit/features/map/MapBlockersPanel.test.tsx`:

```tsx
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MapBlockersPanel } from "@/src/features/map/MapBlockersPanel";

afterEach(() => cleanup());

it("radar blokad to stan pusty „wkrótce”, bez wymyślonych danych", () => {
  render(<MapBlockersPanel />);
  expect(screen.getByRole("heading", { name: /Radar blokad/ })).toBeInTheDocument();
  expect(screen.getByText(/wkrótce/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run tests/unit/features/map`
Expected: FAIL (brak modułów; `globeMath` zielony).

- [ ] **Step 3: `src/features/map/mapTiles.ts`**

```ts
import type { MapGraphDto } from "@/contexts/bc_map/schemas";

export type MapTile = { id: string; label: string; value: string; meta: string };

export function buildMapTiles(
  graph: MapGraphDto,
  agents: { available: boolean; count: number }
): MapTile[] {
  const n = graph.tiles.neurons;
  return [
    {
      id: "neurons",
      label: "Neurony NEXUS",
      value: String(n.total),
      meta: `${n.knowledge} Wiedza · ${n.ai2030} AI-2030 · ${n.projects} w projektach`,
    },
    {
      id: "deps",
      label: "Zależności",
      value: String(graph.tiles.dependencies),
      meta: "współdzielone komponenty i wiedza",
    },
    { id: "blockers", label: "Aktywne blokery", value: "—", meta: "wkrótce" },
    {
      id: "agents",
      label: "Agenci na żywo",
      value: agents.available ? String(agents.count) : "—",
      meta: agents.available ? "Herdr" : "Herdr niedostępny",
    },
  ];
}
```

- [ ] **Step 4: `src/features/map/useMapGraph.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import { MapGraphDtoSchema, type MapGraphDto } from "@/contexts/bc_map/schemas";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;
type State =
  | { status: "loading"; graph: null; error: null }
  | { status: "ready"; graph: MapGraphDto; error: null }
  | { status: "error"; graph: null; error: string };

/** Graf ładujemy raz (D11); odświeżanie agentów go nie przelicza. */
export function useMapGraph(apiFetch: ApiFetch): State {
  const [state, setState] = useState<State>({ status: "loading", graph: null, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/map/graph");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = MapGraphDtoSchema.safeParse(await res.json());
        if (!parsed.success) throw new Error("Nieprawidłowa odpowiedź /api/map/graph");
        if (!cancelled) setState({ status: "ready", graph: parsed.data, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            graph: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  return state;
}
```

- [ ] **Step 5: `src/features/map/useMapAgents.ts`**

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapAgentsDtoSchema, type AgentDto } from "@/contexts/bc_map/schemas";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

/** Agenci Herdr: pierwsze wczytanie przy montowaniu, potem ręcznie (`refresh`). Błąd = „niedostępny”. */
export function useMapAgents(apiFetch: ApiFetch): {
  loading: boolean;
  available: boolean;
  agents: AgentDto[];
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<{ loading: boolean; available: boolean; agents: AgentDto[] }>({
    loading: true,
    available: true,
    agents: [],
  });
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    let next = { loading: false, available: false, agents: [] as AgentDto[] };
    try {
      const res = await apiFetch("/api/map/agents");
      if (res.ok) {
        const parsed = MapAgentsDtoSchema.safeParse(await res.json());
        if (parsed.success) next = { loading: false, ...parsed.data };
      }
    } catch {
      /* Herdr niedostępny: panel pokaże komunikat, reszta Mapy działa */
    }
    if (alive.current) setState(next);
  }, [apiFetch]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  return { ...state, refresh };
}
```

- [ ] **Step 6: Komponenty**

`src/features/map/MapNodeList.tsx`:

```tsx
"use client";

import React from "react";
import type { MapNodeDto } from "@/contexts/bc_map/schemas";

function describe(node: MapNodeDto): string {
  if (node.soon) return `${node.label} (wkrótce)`;
  if (node.kind === "continent" && node.size !== undefined) {
    return `${node.label}, ${node.size} plików`;
  }
  return node.label;
}

/** Dostępna z klawiatury (Tab, Enter) alternatywa dla globusa na canvasie. */
export function MapNodeList(props: {
  nodes: MapNodeDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="map-nodelist" aria-label="Węzły sieci NEXUS">
      {props.nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            className="map-nodelist__item"
            aria-current={props.selectedId === node.id ? "true" : undefined}
            onClick={() => props.onSelect(node.id)}
          >
            {describe(node)}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

`src/features/map/MapAgentsPanel.tsx`:

```tsx
"use client";

import React from "react";
import type { AgentDto } from "@/contexts/bc_map/schemas";

export function MapAgentsPanel(props: {
  available: boolean;
  agents: AgentDto[];
  loading: boolean;
  projectNames: Record<string, string>;
  onRefresh: () => void;
}) {
  return (
    <section className="map-panel" aria-labelledby="map-agents-title">
      <header className="map-panel__head">
        <h2 id="map-agents-title" className="map-panel__title">
          Agenci (Herdr)
        </h2>
        <button
          type="button"
          className="map-panel__btn"
          disabled={props.loading}
          onClick={props.onRefresh}
        >
          Odśwież stan
        </button>
      </header>
      {!props.available ? (
        <p className="map-panel__empty">Herdr niedostępny</p>
      ) : props.agents.length === 0 ? (
        <p className="map-panel__empty">Brak aktywnych agentów</p>
      ) : (
        <ul className="map-agents">
          {props.agents.map((a) => (
            <li key={a.address} className="map-agent-item">
              <div className="map-agent-top">
                <span className="map-agent-name">{a.label}</span>
                <span className="chip">{a.state}</span>
                {a.status ? <span className="chip chip--ok">{a.status}</span> : null}
              </div>
              {a.projectId ? (
                <div className="map-agent-meta">
                  <span>{props.projectNames[a.projectId] ?? a.projectId}</span>
                  {a.where ? <span className="mono muted">{a.where}</span> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

`src/features/map/MapBlockersPanel.tsx`:

```tsx
"use client";

import React from "react";

/** D12: `bugs.md` nie ma pola blokera, więc radar jest stanem pustym bez wymyślonych danych. */
export function MapBlockersPanel() {
  return (
    <section className="map-panel" aria-labelledby="map-blockers-title">
      <header className="map-panel__head">
        <h2 id="map-blockers-title" className="map-panel__title">
          Radar blokad
        </h2>
        <span className="chip">wkrótce</span>
      </header>
      <p className="map-panel__empty">
        Blokery pojawią się, gdy pliki bugs.md dostaną pole blokera. Do tego czasu radar jest pusty.
      </p>
    </section>
  );
}
```

- [ ] **Step 7: Run — PASS**

Run: `npx vitest run tests/unit/features/map`
Expected: PASS. Jeśli `getByRole("button", { name: /Wiedza.*300/ })` nie znajdzie przycisku, sprawdź tekst z `describe()` („Wiedza, 300 plików”).

- [ ] **Step 8: Commit**

```bash
git add src/features/map tests/unit/features/map
git commit -m "feat(mapa): kafle, hooki danych, lista węzłów, panel agentów i radar „wkrótce”

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `Globe.tsx`, `MapView.tsx`, `map.css`

**Files:**

- Create: `src/features/map/Globe.tsx`, `src/features/map/MapView.tsx`, `src/features/map/map.css`

Canvas nie ma sensownego testu w jsdom (brak `getContext`); logikę pokrywa `globeMath.test.ts`. Weryfikacja: `npx tsc --noEmit`, `npm run lint` i ręczny przegląd w przeglądarce (Task 11).

- [ ] **Step 1: `src/features/map/Globe.tsx`**

```tsx
"use client";

import React, { useEffect, useMemo, useRef } from "react";
import type { MapEdgeDto, MapNodeDto } from "@/contexts/bc_map/schemas";
import {
  arcPoints,
  globeRadius,
  hitTest,
  isClick,
  layoutNodes,
  project,
  rotate,
  rotationTo,
  wrapAngle,
  type ProjectedNode,
  type Vec3,
} from "./globeMath";

/** Prędkość auto-obrotu: ok. 0,12 rad/s, pełny obrót w ~52 s. */
const AUTO_SPEED = 0.12;
const PITCH_LIMIT = 1.2;

type Palette = {
  accent: string;
  ok: string;
  text: string;
  muted: string;
  line: string;
  surface: string;
};
const FALLBACK: Palette = {
  accent: "#3d95ff",
  ok: "#4ade9b",
  text: "#f0f0f2",
  muted: "#a8aab2",
  line: "#373a42",
  surface: "#1e1f24",
};

function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const pick = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    accent: pick("--accent", FALLBACK.accent),
    ok: pick("--ok", FALLBACK.ok),
    text: pick("--text", FALLBACK.text),
    muted: pick("--muted", FALLBACK.muted),
    line: pick("--line", FALLBACK.line),
    surface: pick("--surface", FALLBACK.surface),
  };
}

function nodeRadius(n: MapNodeDto): number {
  if (n.kind === "project") return 7;
  if (n.soon) return 9;
  return 9 + Math.min(14, Math.sqrt(n.size ?? 0) * 0.8);
}

export type GlobeProps = {
  nodes: MapNodeDto[];
  edges: MapEdgeDto[];
  selectedId: string | null;
  /** Zmiana `tick` obraca globus do węzła `id`. */
  focus: { id: string; tick: number } | null;
  /** Zatrzymuje auto-obrót (np. fokus w liście węzłów). */
  paused?: boolean;
  onSelect: (id: string) => void;
  ariaLabel: string;
};

export function Globe({
  nodes,
  edges,
  selectedId,
  focus,
  paused = false,
  onSelect,
  ariaLabel,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positions = useMemo(
    () =>
      layoutNodes(
        nodes.map((n) => ({ id: n.id, kind: n.kind })),
        edges
      ),
    [nodes, edges]
  );
  const view = useRef({ yaw: 0.4, pitch: -0.25 });
  const target = useRef<{ yaw: number; pitch: number } | null>(null);
  const hover = useRef(false);
  const drag = useRef<{ sx: number; sy: number; lx: number; ly: number } | null>(null);
  const projected = useRef<ProjectedNode[]>([]);
  const pausedRef = useRef(paused);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const reduced = useRef(false);
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    pausedRef.current = paused;
    selectedRef.current = selectedId;
    onSelectRef.current = onSelect;
    drawRef.current();
  }, [paused, selectedId, onSelect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const pal = readPalette(canvas);

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const { yaw, pitch } = view.current;
      const selected = selectedRef.current;

      ctx.beginPath();
      ctx.arc(w / 2, h / 2, globeRadius(w, h), 0, Math.PI * 2);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = pal.surface;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1;
      ctx.stroke();

      for (const e of edges) {
        const a = positions[e.from];
        const b = positions[e.to];
        if (!a || !b) continue;
        const pts = arcPoints(a, b, 28).map((p) => project(rotate(p, yaw, pitch), w, h));
        const hot = selected !== null && (e.from === selected || e.to === selected);
        ctx.strokeStyle = hot ? pal.accent : pal.muted;
        ctx.lineWidth = (hot ? 2 : 1) + Math.min(e.weight, 4) * 0.35;
        for (let i = 1; i < pts.length; i += 1) {
          const front = (pts[i - 1].z + pts[i].z) / 2 >= 0;
          ctx.globalAlpha = (hot ? 0.95 : 0.55) * (front ? 1 : 0.25);
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      const items = nodes
        .flatMap((n) => {
          const p: Vec3 | undefined = positions[n.id];
          if (!p) return [];
          const pr = project(rotate(p, yaw, pitch), w, h);
          return [{ n, pr, r: nodeRadius(n) * pr.scale }];
        })
        .sort((a, b) => a.pr.z - b.pr.z);
      projected.current = items.map((i) => ({
        id: i.n.id,
        x: i.pr.x,
        y: i.pr.y,
        z: i.pr.z,
        r: i.r,
      }));

      for (const { n, pr, r } of items) {
        const front = pr.z >= 0;
        const color = n.kind === "continent" ? pal.ok : pal.accent;
        ctx.globalAlpha = front ? 1 : 0.3;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
        if (n.soon) {
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }
        if (n.id === selected) {
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = pal.text;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        if (pr.z > -0.2) {
          ctx.fillStyle = pal.text;
          ctx.font = `${Math.round(11 * pr.scale)}px ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.fillText(n.soon ? `${n.label} (wkrótce)` : n.label, pr.x, pr.y + r + 13);
        }
      }
      ctx.globalAlpha = 1;
    };
    drawRef.current = draw;

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = target.current;
      if (t) {
        const dy = wrapAngle(t.yaw - view.current.yaw);
        const dp = t.pitch - view.current.pitch;
        view.current.yaw += dy * 0.14;
        view.current.pitch += dp * 0.14;
        if (Math.abs(dy) < 0.002 && Math.abs(dp) < 0.002) target.current = null;
      } else if (!hover.current && !pausedRef.current && !drag.current) {
        view.current.yaw += dt * AUTO_SPEED;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    if (!reduced.current) raf = requestAnimationFrame(loop);
    draw();

    const local = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture?.(e.pointerId);
      drag.current = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY };
      target.current = null;
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (d) {
        view.current.yaw += (e.clientX - d.lx) * 0.008;
        view.current.pitch = Math.max(
          -PITCH_LIMIT,
          Math.min(PITCH_LIMIT, view.current.pitch + (e.clientY - d.ly) * 0.008)
        );
        d.lx = e.clientX;
        d.ly = e.clientY;
        draw();
        return;
      }
      const { x, y } = local(e);
      canvas.style.cursor = hitTest(projected.current, x, y) ? "pointer" : "grab";
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (d && isClick(e.clientX - d.sx, e.clientY - d.sy)) {
        const { x, y } = local(e);
        const id = hitTest(projected.current, x, y);
        if (id) onSelectRef.current(id);
      }
    };
    const onCancel = () => {
      drag.current = null;
    };
    const onEnter = () => {
      hover.current = true;
    };
    const onLeave = () => {
      hover.current = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerenter", onEnter);
    canvas.addEventListener("pointerleave", onLeave);

    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => draw());
    resize?.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      resize?.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
      drawRef.current = () => {};
    };
  }, [nodes, edges, positions]);

  useEffect(() => {
    if (!focus) return;
    const p = positions[focus.id];
    if (!p) return;
    const goal = rotationTo(p);
    if (reduced.current) {
      view.current = { ...goal };
      drawRef.current();
    } else {
      target.current = goal;
    }
  }, [focus, positions]);

  return <canvas ref={canvasRef} className="map-canvas__el" role="img" aria-label={ariaLabel} />;
}
```

- [ ] **Step 2: `src/features/map/MapView.tsx`**

```tsx
"use client";

import React, { useCallback, useMemo, useState } from "react";
import "./map.css";
import { Globe } from "./Globe";
import { MapAgentsPanel } from "./MapAgentsPanel";
import { MapBlockersPanel } from "./MapBlockersPanel";
import { MapNodeList } from "./MapNodeList";
import { buildMapTiles } from "./mapTiles";
import { useMapAgents } from "./useMapAgents";
import { useMapGraph } from "./useMapGraph";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

export function MapView({
  apiFetch,
  onOpenProject,
}: {
  apiFetch: ApiFetch;
  onOpenProject: (id: string) => void;
}) {
  const graph = useMapGraph(apiFetch);
  const agents = useMapAgents(apiFetch);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null);
  const [listFocused, setListFocused] = useState(false);

  const nodes = graph.graph?.nodes ?? [];
  const projectNames = useMemo(
    () => Object.fromEntries(nodes.filter((n) => n.kind === "project").map((n) => [n.id, n.label])),
    [nodes]
  );

  /** Globus i lista robią to samo: zaznacz, obróć; projekt dodatkowo otwiera kartę Projekty. */
  const activate = useCallback(
    (id: string) => {
      setSelectedId(id);
      setFocus((f) => ({ id, tick: (f?.tick ?? 0) + 1 }));
      if (graph.graph?.nodes.find((n) => n.id === id)?.kind === "project") onOpenProject(id);
    },
    [graph.graph, onOpenProject]
  );

  if (graph.status === "loading") {
    return (
      <section className="map" aria-busy="true">
        <p className="map-panel__empty">Wczytywanie mapy…</p>
      </section>
    );
  }
  if (graph.status === "error") {
    return (
      <section className="map">
        <p role="alert" className="map-panel__empty">
          Nie udało się wczytać mapy: {graph.error}
        </p>
      </section>
    );
  }

  const data = graph.graph;
  const tiles = buildMapTiles(data, { available: agents.available, count: agents.agents.length });
  const selected = data.nodes.find((n) => n.id === selectedId) ?? null;
  const projectsCount = data.nodes.filter((n) => n.kind === "project").length;
  const continentsCount = data.nodes.length - projectsCount;
  const caption =
    selected === null
      ? null
      : selected.soon
        ? `${selected.label}: wkrótce`
        : selected.kind === "continent"
          ? `${selected.label}: ${selected.size ?? 0} plików`
          : selected.label;

  return (
    <section className="map" aria-labelledby="map-title">
      <header className="map-head">
        <h1 id="map-title" className="map-head__title">
          Mapa
        </h1>
        <p className="map-head__sub">Sieć NEXUS: projekty, wiedza i agenci.</p>
      </header>

      <div className="map-tiles">
        {tiles.map((t) => (
          <div key={t.id} className="map-tile">
            <div className="map-tile__label">{t.label}</div>
            <div className="map-tile__value">{t.value}</div>
            <div className="map-tile__meta">{t.meta}</div>
          </div>
        ))}
      </div>

      <div className="map-layout">
        <div
          className="map-stage"
          onFocusCapture={() => setListFocused(true)}
          onBlurCapture={() => setListFocused(false)}
        >
          <div className="map-canvas">
            <Globe
              nodes={data.nodes}
              edges={data.edges}
              selectedId={selectedId}
              focus={focus}
              paused={listFocused}
              onSelect={activate}
              ariaLabel={`Globus sieci NEXUS: ${projectsCount} projektów, ${continentsCount} kontynenty, ${data.edges.length} połączeń`}
            />
            {caption ? (
              <div className="map-caption" aria-live="polite">
                {caption}
              </div>
            ) : null}
          </div>
          <ul className="map-legend" aria-label="Legenda">
            <li className="map-legend-item">
              <span className="map-legend-line map-legend-line--shared" />
              współdzielenie (komponenty, wiedza)
            </li>
            <li className="map-legend-item">Skille: bez powiązań (placeholder)</li>
          </ul>
          <MapNodeList nodes={data.nodes} selectedId={selectedId} onSelect={activate} />
        </div>

        <aside className="map-sidebar">
          <MapAgentsPanel
            available={agents.available}
            agents={agents.agents}
            loading={agents.loading}
            projectNames={projectNames}
            onRefresh={() => void agents.refresh()}
          />
          <MapBlockersPanel />
        </aside>
      </div>

      {data.warnings.length > 0 ? (
        <ul className="map-warnings" aria-label="Ostrzeżenia">
          {data.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
```

(`onFocusCapture/onBlurCapture` na `.map-stage` obejmuje listę węzłów; `paused` zatrzymuje auto-obrót zgodnie ze specem.)

- [ ] **Step 3: `src/features/map/map.css`** (motyw jak w `projects.css`; kolory tylko przez `var(--…)`)

```css
/* Karta Mapa — klasy .map-* wg docs/mockups/karty/cards/08-mapa.html + tokens.css. */

[data-card="mapa"] .map {
  --bg: #15161a;
  --surface: #1e1f24;
  --surface-2: #282a30;
  --line: #373a42;
  --text: #f0f0f2;
  --muted: #a8aab2;
  --accent: #3d95ff;
  --ok: #4ade9b;
  --warn: #ffc857;
  --danger: #ff7272;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --r-md: 10px;
  --r-lg: 16px;

  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px;
  background: var(--bg);
  color: var(--text);
}

.map-head__title {
  margin: 0;
  font-size: 24px;
}
.map-head__sub {
  margin: 4px 0 16px;
  color: var(--muted);
  font-size: 13px;
}

.map-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.map-tile {
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
}
.map-tile__label {
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.map-tile__value {
  margin-top: 4px;
  font-size: 28px;
  font-weight: 600;
}
.map-tile__meta {
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
}

.map-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
}
@media (max-width: 900px) {
  .map-layout {
    grid-template-columns: 1fr;
  }
}

.map-canvas {
  position: relative;
  height: min(60vh, 520px);
  min-height: 320px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.map-canvas__el {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}
.map-caption {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 4px 10px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  font-family: var(--font-mono);
  font-size: 12px;
}

.map-legend,
.map-nodelist,
.map-warnings,
.map-agents {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--muted);
  font-size: 12px;
}
.map-legend-line {
  display: inline-block;
  width: 24px;
  height: 0;
  margin-right: 8px;
  border-top: 2px solid var(--muted);
  vertical-align: middle;
}
.map-nodelist {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.map-nodelist__item {
  padding: 4px 10px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  font-size: 12px;
  cursor: pointer;
}
.map-nodelist__item[aria-current="true"],
.map-nodelist__item:focus-visible {
  border-color: var(--accent);
  outline: none;
}

.map-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.map-panel {
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
}
.map-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.map-panel__title {
  margin: 0;
  font-size: 14px;
}
.map-panel__btn {
  padding: 4px 10px;
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  font-size: 12px;
  cursor: pointer;
}
.map-panel__btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.map-panel__empty {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.map-agent-item {
  padding: 8px 0;
  border-top: 1px solid var(--line);
}
.map-agent-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.map-agent-name {
  font-weight: 600;
  font-size: 13px;
}
.map-agent-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}
.chip {
  padding: 1px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 11px;
}
.chip--ok {
  color: var(--ok);
}
.map .mono {
  font-family: var(--font-mono);
}
.map-warnings {
  color: var(--warn);
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .map-canvas__el {
    cursor: default;
  }
}
```

- [ ] **Step 4: Typecheck i lint**

Run: `npx tsc --noEmit` — Expected: bez błędów.
Run: `npm run lint` — Expected: bez błędów w `src/features/map`.
Jeśli `react-hooks/exhaustive-deps` zgłosi `nodes` w `useMemo` (`MapView.projectNames`), opakuj `const nodes = useMemo(() => graph.graph?.nodes ?? [], [graph.graph])`.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/Globe.tsx src/features/map/MapView.tsx src/features/map/map.css
git commit -m "feat(mapa): globus 3D na canvasie, widok karty Mapa i style

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Wpięcie karty w aplikację

**Files:**

- Modify: `src/features/cards/cards.ts:16-20,42`, `src/features/cards/useCardNavigation.ts`, `src/App.tsx:23,34,83,93-107`
- Modify (testy): `tests/unit/features/cards/cards.test.ts:30`, `tests/unit/features/cards/useCardNavigation.test.ts:26-34`, `tests/unit/features/cards/CardPlaceholder.test.tsx:6-11`

- [ ] **Step 1: Zaktualizuj testy (czerwone)**

`tests/unit/features/cards/cards.test.ts:30`: zamień oczekiwanie

```ts
expect(getCard("mapa").target).toEqual({ kind: "map" });
```

`tests/unit/features/cards/useCardNavigation.test.ts`: test „karta bez kodu ustawia zaślepkę…” przenieś na `kodeks` i dodaj test Mapy:

```ts
test("karta bez kodu ustawia zaślepkę, kolejna karta ją zdejmuje", () => {
  const { result } = renderHook(() => useCardNavigation());
  act(() => result.current.selectCard("kodeks"));
  expect(result.current.placeholder).toBe("kodeks");
  expect(result.current.activeCard).toBe("kodeks");
  act(() => result.current.selectCard("kokpit"));
  expect(result.current.placeholder).toBeNull();
  expect(result.current.appMode).toBe("home");
});

test("karta Mapa ustawia mapOpen, nie zaślepkę; kolejna karta zdejmuje mapOpen", () => {
  const { result } = renderHook(() => useCardNavigation());
  act(() => result.current.selectCard("mapa"));
  expect(result.current.mapOpen).toBe(true);
  expect(result.current.placeholder).toBeNull();
  expect(result.current.activeCard).toBe("mapa");
  act(() => result.current.selectCard("kokpit"));
  expect(result.current.mapOpen).toBe(false);
});
```

`tests/unit/features/cards/CardPlaceholder.test.tsx`: usuń pierwszy test (zaślepka „mapa” — karta ma już widok); drugi (Kodeks) zostaje.

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run tests/unit/features/cards`
Expected: FAIL (`mapOpen` nie istnieje, target nadal `placeholder`).

- [ ] **Step 3: `cards.ts`**

W `CardTarget` dodaj wariant, w `CARDS` zmień target Mapy:

```ts
export type CardTarget =
  | { kind: "home" }
  | { kind: "planning"; tab: PlanningTab }
  | { kind: "projects" }
  | { kind: "map" }
  | { kind: "placeholder"; stage: string };
```

```ts
  { id: "mapa", label: "Mapa", hotkey: 8, target: { kind: "map" } },
```

- [ ] **Step 4: `useCardNavigation.ts`**

W interfejsie dodaj `mapOpen: boolean;` (po `projectsOpen`). W `selectCard`:

```ts
    if (target.kind === "placeholder" || target.kind === "projects" || target.kind === "map") {
```

Po `projectsOpen`:

```ts
const mapOpen = standalone === "mapa";
```

oraz `mapOpen,` w obiekcie zwracanym (po `projectsOpen`).

- [ ] **Step 5: `App.tsx`**

Dodaj import `import { MapView } from "@/src/features/map/MapView";` (po `ProjectsView`). W destrukturyzacji `useCardNavigation()` dodaj `mapOpen,`. Warunek Kokpitu:

```tsx
      {!projectsOpen && !mapOpen && !placeholder && appMode === "home" ? (
```

Łańcuch widoków:

```tsx
          {projectsOpen ? (
            <ProjectsView apiFetch={apiFetch} initialProjectId={projectToOpen} />
          ) : mapOpen ? (
            <MapView apiFetch={apiFetch} onOpenProject={openProject} />
          ) : placeholder ? (
```

- [ ] **Step 6: Znajdź ewentualne inne miejsca zależne od `target.kind`**

Run: `grep -rn "target.kind\|kind: \"placeholder\"" src tests/unit | grep -v "^src/features/cards/cards.ts"`
Expected: tylko już zaktualizowane pliki. Jeśli coś jeszcze zakłada, że Mapa to `placeholder`, popraw to w tym samym commicie.

- [ ] **Step 7: Run — PASS**

Run: `npx tsc --noEmit && npx vitest run tests/unit/features/cards`
Expected: PASS, tsc bez błędów.

- [ ] **Step 8: Commit**

```bash
git add src/features/cards src/App.tsx tests/unit/features/cards
git commit -m "feat(mapa): karta Mapa (Alt+8) wpięta w aplikację zamiast zaślepki

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Weryfikacja końcowa i zgodność speca

**Files:**

- Modify: `docs/superpowers/specs/2026-11-14-karta-mapa-design.md` (drobna synchronizacja z planem)

- [ ] **Step 1: Pełna weryfikacja (zlecić `cursor`, `--role task --approve-allowed`, `--tier light`)**

Prompt do cursor: „W Monolith uruchom po kolei: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`. Odpowiedz „przeszło” albo listą `plik:linia + przyczyna`. Nic nie edytuj.”
Expected: wszystkie cztery zielone. Szczególnie: `architecture.static.test.ts`, `no-model-api.static.test.ts`, `lib/nexus/static.test.ts`, `cardsCss.test.ts`. Jeśli `cardsCss.test.ts` coś narzeka na nowy plik CSS, popraw `map.css` kodem (nie testem).

- [ ] **Step 2: Przegląd w przeglądarce (ocena wzrokowa, §6 speca)**

Run: `npm run dev`, otwórz aplikację, Alt+8. Sprawdź:

1. Globus obraca się powoli (~1 obrót na ~50 s), widać 7 projektów i 3 kontynenty, tylna półkula przygaszona.
2. Przeciągnięcie obraca; po najechaniu kursorem auto-obrót staje; klik w kontynent obraca go na wprost i pokazuje podpis z liczbą plików; Skille mają przerywany obrys i „wkrótce”.
3. Klik w projekt otwiera kartę Projekty.
4. Kafle: Neurony ≈ suma, Zależności > 0, Blokery „—”, Agenci = liczba terminali nie-bash.
5. Panel agentów: „Odśwież stan” działa; agent z Monolith ma nazwę projektu i miejsce; w odpowiedzi `/api/map/agents` (zakładka Network) nie ma pola `cwd`.
6. Tab przechodzi po liście węzłów, Enter obraca globus; z włączonym „ogranicz ruch” globus stoi.
7. Alt+8 z Kokpitu zamienia widok (Kokpit znika).

- [ ] **Step 3: Synchronizacja speca (osobny commit docs)**

W specu dopisz w D8 zdanie: „Terminale z `agent: "bash"` (zwykła powłoka) nie są agentami i nie trafiają do panelu ani kafla.”; w §3 w opisie modelu: „`MapNode` ma też `soon?: boolean` (D13); id kontynentów to `@wiedza`, `@ai-2030`, `@skille`.”

```bash
git add docs/superpowers/specs/2026-11-14-karta-mapa-design.md
git commit -m "docs(mapa): spec zgodny z planem (powłoka bash poza agentami, pole soon, id kontynentów)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Zakończenie gałęzi**

Użyj `finishing-a-development-branch` (PR z `feat/karta-mapa` do `main`). Po etapie 1 wróć do spec §7 (krawędzie Skille, rozmiar Skille, analiza D9).

---

## Samoocena planu względem speca

**Pokrycie wymagań (§1 → zadania):**

| Wymaganie speca                                                                    | Task    |
| ---------------------------------------------------------------------------------- | ------- |
| Globus canvas 2D, własna projekcja 3D, powolny obrót, `prefers-reduced-motion`     | 7, 9    |
| 7 projektów + 3 kontynenty (Skille placeholder, D13)                               | 5, 9    |
| Krawędzie projekt–projekt i projekt–Wiedza (D5), pułapki parsowania                | 4, 5    |
| Kafle: Neurony, Zależności, Blokery „—”, Agenci                                    | 5, 8    |
| Panel agentów `hc ls`, dopasowanie po prefiksie na granicy segmentu (D8)           | 3, 5, 8 |
| Prywatność D9 (`cwd` nigdy w DTO; `work`/brak projektu = etykieta + stan)          | 5, 6    |
| Dostępność Herdr D10 (brak `hc`/timeout 2 s)                                       | 3, 8    |
| Dwa endpointy D11                                                                  | 6       |
| Radar blokad „wkrótce” D12                                                         | 8       |
| `listVaultFilesRecursive` bez symlinków i `Work/`                                  | 2       |
| Test architektury osobnym commitem                                                 | 1       |
| Wpięcie w `cards.ts` / `useCardNavigation` / `App.tsx` (`!mapOpen`)                | 10      |
| Lista węzłów z klawiatury, `aria-label` z liczbami, klik 4 px, hit-test `z < -0,2` | 7, 8, 9 |
| Przejście do karty Projekty                                                        | 9, 10   |
| `no-model-api` i architektura zielone                                              | 6, 11   |

**Świadomie poza planem (zgodnie ze specem §1/§7):** krawędzie „bloker”/„przepływ”, kontynent Docs, krawędzie Skille, `lib/skills`, zapisy, akcje na agentach.

**Spójność nazw:** `listVaultFilesRecursive`, `parseHcLs`/`listTerminals`/`HerdrTerminal`, `parseSharedSections`/`parseNoteProjects`/`readMapSources`/`readTerminals`, `composeGraph`/`resolveAgentProject`/`toAgents`/`getGraph`/`getAgents`, `toGraphDto`/`toAgentsDto`, `getMapGraph`/`getMapAgents`, `layoutNodes`/`rotate`/`rotationTo`/`project`/`globeRadius`/`arcPoints`/`hitTest`/`isClick`/`wrapAngle`, `buildMapTiles`, `useMapGraph`/`useMapAgents` są używane identycznie w testach i implementacji.

**Znane ryzyka do sprawdzenia przy wykonaniu:** próg `> 0.2` w teście rozsunięcia projektów (Task 7, krok 4); ewentualne zastrzeżenia `cardsCss.test.ts` do nowego CSS (Task 11); ostrzeżenie `exhaustive-deps` dla `nodes` w `MapView` (Task 9, krok 4).
