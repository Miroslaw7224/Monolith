# Paczka kontekstu: szablony per rola — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paczka kontekstu ma cztery role (`full`, `review`, `implementation`, `debug`) różniące się zestawem i kolejnością sekcji, z wyborem roli w karcie „Paczka kontekstu”.

**Architecture:** Profile ról (`ROLE_PROFILES`) w `services/context-pack.ts` sterują składaniem sekcji i krokami redukcji do budżetu; rola jedzie jako `?role=` do istniejącej trasy `GET /api/projects/[id]/context-pack` (brak = `full`, wynik bajt w bajt jak dziś). UI: wybór roli w `useContextPack` i karcie paczki.

**Tech Stack:** Next.js 14, TypeScript, zod, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-14-paczka-kontekstu-role-design.md`

**Jeden commit implementacji (decyzja użytkownika):** Taski 1–5 NIE commitują; cały kod i testy trafiają do jednego commita w Tasku 6. Spec i plan są w osobnych commitach dokumentów, już zrobionych na gałęzi `feat/paczka-kontekstu-role`.

**Zasady wykonania (CLAUDE.md):** testy, `tsc`, lint i build zleca się `cursor` (`scripts/ask-helper.sh --role task --tier light --approve-allowed cursor "<komendy>; odpowiedz: przeszło albo lista plik:linia + przyczyna"`); poniżej same komendy. Testu architektury nie zmieniamy. Commit kończy się linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

## Mapa plików

| Plik                                                                 | Zmiana                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `contexts/bc_projects/models.ts`                                     | `CONTEXT_PACK_ROLES`, `ContextPackRole`                                                                                                          |
| `contexts/bc_projects/schemas.ts`                                    | `ContextPackRoleSchema`, `PACK_ROLES`, re-eksport typu `ContextPackRole`                                                                         |
| `contexts/bc_projects/services/context-pack.ts`                      | `ROLE_PROFILES`, `renderPack` wg profilu, `ContextPackInput.role?`, `composeContextPack` z profilem                                              |
| `contexts/bc_projects/services/index.ts`                             | `buildContextPack(id, today, role = "full")`                                                                                                     |
| `contexts/bc_projects/router.ts`                                     | `getContextPack` czyta `?role=`                                                                                                                  |
| `src/features/projects/mutation.ts`                                  | `loadContextPack: (role?) => …`                                                                                                                  |
| `src/features/projects/useProjects.ts`                               | `loadContextPack(role = "full")`                                                                                                                 |
| `src/features/projects/useContextPack.ts`                            | rola (`role`, `setRole`), `load(role)`                                                                                                           |
| `src/features/projects/ProjectContextPack.tsx`                       | grupa przycisków ról w karcie                                                                                                                    |
| `src/features/projects/projects.css`                                 | `.prj-pack-card__roles`                                                                                                                          |
| `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md` | dwie linie: szablony per rola zrealizowane                                                                                                       |
| testy                                                                | `context-pack.roles.test.ts` (nowy), `schemas.pack-role.test.ts` (nowy), `router.test.ts`, `ProjectContextPack.test.tsx`, `useProjects.test.tsx` |

---

### Task 1: Typ roli i schemat

**Files:**

- Modify: `contexts/bc_projects/models.ts`, `contexts/bc_projects/schemas.ts`
- Test: `tests/unit/contexts/bc_projects/schemas.pack-role.test.ts` (nowy)

- [ ] **Step 1: Napisz test**

`tests/unit/contexts/bc_projects/schemas.pack-role.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CONTEXT_PACK_ROLES } from "@/contexts/bc_projects/models";
import { ContextPackRoleSchema, PACK_ROLES } from "@/contexts/bc_projects/schemas";

describe("role paczki kontekstu", () => {
  it("lista z ContextPackRoleSchema zgodna z CONTEXT_PACK_ROLES w models", () => {
    expect([...ContextPackRoleSchema.options]).toEqual([...CONTEXT_PACK_ROLES]);
  });

  it("PACK_ROLES ma te same klucze w tej samej kolejności i niepuste etykiety", () => {
    expect(PACK_ROLES.map((r) => r.key)).toEqual([...CONTEXT_PACK_ROLES]);
    for (const r of PACK_ROLES) expect(r.label.length).toBeGreaterThan(0);
  });

  it("schemat przyjmuje role i odrzuca nieznaną", () => {
    expect(ContextPackRoleSchema.safeParse("review").success).toBe(true);
    expect(ContextPackRoleSchema.safeParse("zly").success).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom: czerwone**

Run: `npx vitest run tests/unit/contexts/bc_projects/schemas.pack-role.test.ts`
Expected: FAIL (brak `CONTEXT_PACK_ROLES`, `ContextPackRoleSchema`, `PACK_ROLES`).

- [ ] **Step 3: `models.ts`**

Pod typem `ContextPack` (kończy się `warnings: string[]; };`, linia ~173) dopisz:

```ts
/** Role paczki kontekstu (zestaw sekcji); `full` to pełna paczka sprzed wprowadzenia ról. */
export const CONTEXT_PACK_ROLES = ["full", "review", "implementation", "debug"] as const;
export type ContextPackRole = (typeof CONTEXT_PACK_ROLES)[number];
```

- [ ] **Step 4: `schemas.ts`**

W `import type { … } from "./models"` dodaj `ContextPackRole,` (alfabetycznie po `ContextPack,`). Pod `export type { Owner, ProjectType };` zmień na:

```ts
export type { ContextPackRole, Owner, ProjectType };
```

(zachowaj istniejący re-eksport `archiveDateOf…` z `lib/schema`, jeśli jest w następnej linii). Pod `export const PACK_BUDGET_TOKENS = 4000;` dopisz:

```ts
/** Role paczki kontekstu; lista zgodna z `CONTEXT_PACK_ROLES` w `models` (pilnuje test). */
export const ContextPackRoleSchema = z.enum(["full", "review", "implementation", "debug"]);

/** Role w UI: klucz i etykieta (kolejność przycisków). */
export const PACK_ROLES: { key: ContextPackRole; label: string }[] = [
  { key: "full", label: "Pełna" },
  { key: "review", label: "Review" },
  { key: "implementation", label: "Implementacja" },
  { key: "debug", label: "Debug" },
];
```

- [ ] **Step 5: Zielone + tsc**

Run: `npx vitest run tests/unit/contexts/bc_projects/schemas.pack-role.test.ts tests/unit/contexts/bc_projects/schemas.test.ts tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS (`schemas` robi tylko `import type` z `models`; wartości `CONTEXT_PACK_ROLES` importuje wyłącznie test).

---

### Task 2: Kompozytor: profile ról

**Files:**

- Modify: `contexts/bc_projects/services/context-pack.ts`
- Test: `tests/unit/contexts/bc_projects/context-pack.roles.test.ts` (nowy)

- [ ] **Step 1: Napisz test**

`tests/unit/contexts/bc_projects/context-pack.roles.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ContextPackRole, ProjectWithContent } from "@/contexts/bc_projects/models";
import {
  composeContextPack,
  estimateTokens,
  type ContextPackInput,
} from "@/contexts/bc_projects/services/context-pack";

const BIG = 1_000_000;

const project: ProjectWithContent = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "~/projects/a",
  owner: "personal",
  whereIStopped: null,
  freshness: "fresh",
  tasks: [],
  board: {
    blockers: [{ text: "B1", done: false }],
    now: [
      { text: "N1", done: false },
      { text: "ZADANIE-GOTOWE", done: true },
    ],
    next: [{ text: "NASTEPNE-X", done: false }],
    icebox: [],
    version: null,
  },
  bugs: [
    { id: "BUG-1", title: "Pierwszy", section: "Aktywne", priority: "P1", status: "open" },
    { id: "BUG-3", title: "ZAMKNIETY", section: "Zamknięte" },
  ],
  state: {
    branch: "main",
    env: "local",
    blocker: "",
    nextStep: "Zrobić Z",
    links: [],
    milestone: "",
    notes: "",
  },
  stateVersion: null,
  devlog: [
    { date: "2026-11-13", title: "Trzeci", why: "powód trzeci" },
    { date: "2026-11-12", title: "Drugi", why: "" },
  ],
};

const pad = (n: number) => String(n).padStart(3, "0");
const diffStat = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => ` src/some/long/path/file${pad(i + 1)}.ts | 10 ++++++++++`
  ).join("\n");
const paragraphs = Array.from({ length: 30 }, (_, i) => `Akapit ${i + 1}: ${"x".repeat(90)}`).join(
  "\n\n"
);

function makeInput(over: Partial<ContextPackInput> = {}): ContextPackInput {
  return {
    project,
    lastWorked: "2026-11-10",
    rules: { source: "CLAUDE.md", text: paragraphs },
    git: {
      ok: true,
      snapshot: {
        status: "## main\n M a.txt",
        log: ["aaaaaaa c5", "bbbbbbb c4", "ccccccc c3", "ddddddd c2", "eeeeeee c1"].join("\n"),
        diffStat: diffStat(30),
      },
    },
    warnings: [],
    ...over,
  };
}

/** Sekcja od `heading` do następnego `\n\n## ` (albo do końca). */
function sectionOf(md: string, heading: string): string {
  const start = md.indexOf(heading);
  if (start < 0) return "";
  const next = md.indexOf("\n\n## ", start + heading.length);
  return next < 0 ? md.slice(start) : md.slice(start, next);
}

const HEADINGS = [
  "## Zasady projektu",
  "## Save State",
  "## Kod (git)",
  "## Zadania",
  "## Bugi (otwarte)",
  "## Devlog",
];

/** Nagłówki sekcji obecne w paczce, w kolejności w markdownie (`## main` w bloku kodu nie jest sekcją). */
const present = (md: string) =>
  HEADINGS.filter((h) => md.includes(`\n\n${h}`)).sort(
    (a, b) => md.indexOf(`\n\n${a}`) - md.indexOf(`\n\n${b}`)
  );

const pack = (role: ContextPackRole, budget = BIG) =>
  composeContextPack(makeInput({ role }), budget);

describe("composeContextPack: role", () => {
  it("brak roli = full", () => {
    expect(composeContextPack(makeInput(), BIG)).toEqual(pack("full"));
    expect(present(pack("full").markdown)).toEqual(HEADINGS);
  });

  it("review: Zasady, Save State, Kod, Zadania; tylko Teraz; diff --stat; bez Bugów i Devlogu", () => {
    const md = pack("review").markdown;
    expect(present(md)).toEqual([
      "## Zasady projektu",
      "## Save State",
      "## Kod (git)",
      "## Zadania",
    ]);
    const tasks = sectionOf(md, "## Zadania");
    expect(tasks).toContain("### Teraz\n- N1");
    expect(tasks).not.toContain("Blokery");
    expect(sectionOf(md, "## Kod (git)")).toContain("Zmiany (diff --stat)");
  });

  it("implementation: Zasady, Save State, Zadania, Kod, Bugi; Blokery i Teraz; Kod bez diff --stat; bez Devlogu", () => {
    const md = pack("implementation").markdown;
    expect(present(md)).toEqual([
      "## Zasady projektu",
      "## Save State",
      "## Zadania",
      "## Kod (git)",
      "## Bugi (otwarte)",
    ]);
    const tasks = sectionOf(md, "## Zadania");
    expect(tasks).toContain("### Blokery\n- B1");
    expect(tasks).toContain("### Teraz\n- N1");
    const code = sectionOf(md, "## Kod (git)");
    expect(code).toContain("Ostatnie commity");
    expect(code).not.toContain("diff --stat");
  });

  it("debug: Bugi, Save State, Kod, Devlog, Zasady; zasady do 1200 znaków bez flagi truncated; bez Zadań", () => {
    const result = pack("debug");
    const md = result.markdown;
    expect(present(md)).toEqual([
      "## Bugi (otwarte)",
      "## Save State",
      "## Kod (git)",
      "## Devlog",
      "## Zasady projektu",
    ]);
    expect(result.truncated).toBe(false);
    expect(sectionOf(md, "## Kod (git)")).toContain("Zmiany (diff --stat)");
    const rules = sectionOf(md, "## Zasady projektu");
    const body = rules.slice(rules.indexOf("\n\n") + 2);
    expect(body.length).toBeLessThanOrEqual(1200);
    expect(body.endsWith("…")).toBe(true);
  });

  it("nagłówek jest zawsze pierwszy", () => {
    for (const role of ["full", "review", "implementation", "debug"] as const) {
      expect(pack(role).markdown.startsWith("# Kontekst projektu: Alpha\n\nStatus:")).toBe(true);
    }
  });

  it("review chroni diff --stat przy cięciu do budżetu, full go przycina", () => {
    const LAST = "file030.ts";
    const size = (role: ContextPackRole) => estimateTokens(pack(role).markdown);

    const review = pack("review", size("review") - 100);
    expect(review.truncated).toBe(true);
    expect(review.markdown).toContain(LAST);
    expect(review.approxTokens).toBeLessThanOrEqual(size("review") - 100);

    const full = pack("full", size("full") - 100);
    expect(full.truncated).toBe(true);
    expect(full.markdown).not.toContain(LAST);
  });

  it("implementation nie ma kroków diff: przy małym budżecie tnie log i zasady, nie diff", () => {
    const size = estimateTokens(pack("implementation").markdown);
    const result = pack("implementation", size - 100);
    expect(result.truncated).toBe(true);
    expect(result.markdown).not.toContain("diff --stat");
    expect(result.approxTokens).toBeLessThanOrEqual(size - 100);
  });
});
```

- [ ] **Step 2: Uruchom: czerwone**

Run: `npx vitest run tests/unit/contexts/bc_projects/context-pack.roles.test.ts`
Expected: FAIL (brak `role` w `ContextPackInput`; `tsc` też zgłosi błąd typu, vitest ignoruje typy, więc padają testy ról).

- [ ] **Step 3: Importy i wejście w `context-pack.ts`**

Pierwszy import zamień na:

```ts
import type {
  ContextPack,
  ContextPackRole,
  GitSnapshotResult,
  ProjectWithContent,
  RepoUnavailableReason,
} from "@/contexts/bc_projects/models";
```

W `ContextPackInput` dopisz na końcu pole:

```ts
  /** Rola paczki (zestaw sekcji); brak = `full`. */
  role?: ContextPackRole;
```

- [ ] **Step 4: Profile ról**

Pod definicją `type Knobs = {…};` (przed `const lineCount`) dodaj:

```ts
export type SectionId = "rules" | "state" | "git" | "tasks" | "bugs" | "devlog";

type RoleProfile = {
  /** Sekcje po nagłówku, w kolejności paczki. */
  order: readonly SectionId[];
  /** Które kolumny tablicy trafiają do sekcji „Zadania”. */
  tasks: { blockers: boolean; now: boolean };
  /** Czy sekcja „Kod” zawiera `diff --stat`. */
  diff: boolean;
  /** Kroki redukcji do budżetu nie ruszają `diff --stat`. */
  protectDiff: boolean;
  /** Limit znaków zasad od początku (`Infinity` = bez limitu); wybór roli, nie cięcie do budżetu. */
  rulesMax: number;
};

/** Profile ról paczki; `full` odtwarza paczkę sprzed wprowadzenia ról (kolejność i zawartość bez zmian). */
export const ROLE_PROFILES: Record<ContextPackRole, RoleProfile> = {
  full: {
    order: ["rules", "state", "git", "tasks", "bugs", "devlog"],
    tasks: { blockers: true, now: true },
    diff: true,
    protectDiff: false,
    rulesMax: Infinity,
  },
  review: {
    order: ["rules", "state", "git", "tasks"],
    tasks: { blockers: false, now: true },
    diff: true,
    protectDiff: true,
    rulesMax: Infinity,
  },
  implementation: {
    order: ["rules", "state", "tasks", "git", "bugs"],
    tasks: { blockers: true, now: true },
    diff: false,
    protectDiff: false,
    rulesMax: Infinity,
  },
  debug: {
    order: ["bugs", "state", "git", "devlog", "rules"],
    tasks: { blockers: true, now: true },
    diff: true,
    protectDiff: false,
    rulesMax: 1200,
  },
};
```

- [ ] **Step 5: `renderPack` wg profilu**

Zastąp całą funkcję `renderPack` (od `function renderPack(` do jej zamykającego `}` przed komentarzem „Składa paczkę…”) tym:

```ts
function renderPack(input: ContextPackInput, k: Knobs, profile: RoleProfile): string {
  const { project, git, rules, lastWorked } = input;

  // Niepoprawna data (świeżość `unknown`) nie jest wypisywana.
  const worked =
    lastWorked && project.freshness !== "unknown"
      ? `${lastWorked} (${FRESHNESS_LABEL[project.freshness]})`
      : FRESHNESS_LABEL.unknown;
  const head = `# Kontekst projektu: ${project.name}\n\nStatus: ${project.status} · priorytet: ${project.priority} · ostatnia praca: ${worked}`;

  const open = (items: { text: string; done: boolean }[]) =>
    items.filter((t) => t.done === false).map((t) => `- ${t.text}`);

  const render: Record<SectionId, () => string | null> = {
    rules: () => {
      if (!rules) return null;
      const text = k.rulesMax === Infinity ? rules.text : cutAtParagraph(rules.text, k.rulesMax);
      return `## Zasady projektu (źródło: ${rules.source})\n\n${text}`;
    },
    state: () => {
      if (project.state) {
        const s = project.state;
        const lines = [
          `Branch: ${s.branch || "—"} · Środowisko: ${s.env || "—"}`,
          `Bloker: ${s.blocker || "brak"}`,
          `Następny krok: ${s.nextStep || "—"}`,
        ];
        if (s.milestone) {
          lines.push(
            `Kamień milowy: ${s.milestone}${s.milestoneDue ? ` · do ${s.milestoneDue}` : ""}`
          );
        }
        return `## Save State\n\n${lines.join("\n")}`;
      }
      if (project.whereIStopped) {
        return `## Gdzie skończyłem (brak state.md)\n\n${project.whereIStopped}`;
      }
      return null;
    },
    git: () => {
      if (git.ok === false) {
        return `## Kod (git)\n\nRepozytorium niedostępne (${REPO_REASON_TEXT[git.reason]}).`;
      }
      const { status, log, diffStat } = git.snapshot;
      const parts = [`Status:\n${block(status)}`];
      const logText = log.split("\n").slice(0, k.logCount).join("\n");
      if (logText !== "") parts.push(`Ostatnie commity:\n${block(logText)}`);
      if (k.diff && diffStat !== "") {
        parts.push(`Zmiany (diff --stat):\n${block(limitLines(diffStat, k.diffLines))}`);
      }
      return `## Kod (git)\n\n${parts.join("\n\n")}`;
    },
    tasks: () => {
      const blockers = profile.tasks.blockers ? open(project.board.blockers) : [];
      const now = profile.tasks.now ? open(project.board.now) : [];
      if (blockers.length === 0 && now.length === 0) return null;
      let tasks = "## Zadania";
      if (blockers.length > 0) tasks += `\n\n### Blokery\n${blockers.join("\n")}`;
      if (now.length > 0) tasks += `\n\n### Teraz\n${now.join("\n")}`;
      return tasks;
    },
    bugs: () => {
      const bugs = project.bugs
        .filter((b) => b.section !== "Zamknięte")
        .map(
          (b) =>
            `- ${b.id}: ${b.title}${b.priority ? ` [${b.priority}]` : ""}${b.status ? ` (${b.status})` : ""}`
        );
      return bugs.length > 0 ? `## Bugi (otwarte)\n\n${bugs.join("\n")}` : null;
    },
    devlog: () => {
      const entries = project.devlog.slice(0, k.devlog);
      if (entries.length === 0) return null;
      const lines = entries.map(
        (e) => `- ${e.date ?? "—"}: ${e.title}${e.why ? ` — ${e.why}` : ""}`
      );
      return `## Devlog (ostatnie ${entries.length})\n\n${lines.join("\n")}`;
    },
  };

  const sections = profile.order.map((id) => render[id]()).filter((s): s is string => s !== null);
  return [head, ...sections].join("\n\n");
}
```

- [ ] **Step 6: `composeContextPack` z profilem**

Zastąp ciało funkcji od `export function composeContextPack(` do końca pliku:

```ts
export function composeContextPack(
  rawInput: ContextPackInput,
  budgetTokens: number = PACK_BUDGET_TOKENS
): ContextPack {
  const profile = ROLE_PROFILES[rawInput.role ?? "full"];
  // Nagłówki zasad schodzą pod sekcję „Zasady” raz, na wejściu: budżet i cięcie liczą się już po tym.
  const input: ContextPackInput = rawInput.rules
    ? { ...rawInput, rules: { ...rawInput.rules, text: demoteHeadings(rawInput.rules.text) } }
    : rawInput;
  // Role bez `diff --stat` albo z chronionym nie mają kroków redukcji dla diffu, a role bez Devlogu kroków devlogu.
  const stat =
    input.git.ok && profile.diff && !profile.protectDiff
      ? lineCount(input.git.snapshot.diffStat)
      : 0;
  const logLines = input.git.ok ? lineCount(input.git.snapshot.log) : 0;
  const devlogLength = profile.order.includes("devlog") ? input.project.devlog.length : 0;
  const rulesLength = input.rules?.text.length ?? 0;

  let k: Knobs = {
    diffLines: DIFF_LINES_MAX,
    logCount: 5,
    diff: profile.diff,
    devlog: 3,
    rulesMax: profile.rulesMax,
  };
  let markdown = renderPack(input, k, profile);
  let truncated = false;
  const over = () => estimateTokens(markdown) > budgetTokens;
  const step = (next: Knobs) => {
    k = next;
    truncated = true;
    markdown = renderPack(input, k, profile);
  };

  if (over() && stat > 10 && k.diffLines > 10) step({ ...k, diffLines: 10 });
  if (over() && logLines > 3) step({ ...k, logCount: 3 });
  if (over() && stat > 0 && k.diff) step({ ...k, diff: false });
  if (over() && devlogLength > 2) step({ ...k, devlog: 2 });
  if (over() && devlogLength > 1) step({ ...k, devlog: 1 });
  while (over() && rulesLength > RULES_MIN_CHARS && k.rulesMax > RULES_MIN_CHARS) {
    step({
      ...k,
      rulesMax: Math.max(RULES_MIN_CHARS, Math.floor(Math.min(rulesLength, k.rulesMax) / 2)),
    });
  }

  const approxTokens = estimateTokens(markdown);
  const warnings = [...input.warnings];
  if (approxTokens > budgetTokens) warnings.push(`Paczka ponad budżet (~${approxTokens} tokenów)`);
  return { markdown, approxTokens, truncated, warnings };
}
```

Komentarz doc nad `composeContextPack` (blok „Składa paczkę kontekstu w budżecie tokenów…”) zostaje i dopisz do niego zdanie: „Zestaw i kolejność sekcji wynikają z roli (`ROLE_PROFILES`).”

- [ ] **Step 7: Zielone (nowe i wszystkie istniejące testy paczki) + tsc**

Run: `npx vitest run tests/unit/contexts/bc_projects/context-pack.roles.test.ts tests/unit/contexts/bc_projects/context-pack.compose.test.ts tests/unit/contexts/bc_projects/services.context-pack.test.ts && npx tsc --noEmit`
Expected: PASS. Istniejące testy kompozytora są testem regresji dla `full`; gdyby któryś padł, napraw kod, nie test.

---

### Task 3: Serwis i trasa

**Files:**

- Modify: `contexts/bc_projects/services/index.ts`, `contexts/bc_projects/router.ts`
- Test: `tests/unit/contexts/bc_projects/router.test.ts`

- [ ] **Step 1: Testy routera**

W `router.test.ts`, w `describe("bc_projects router: context-pack", …)` zmień istniejącą asercję `expect(mockBuildContextPack).toHaveBeenCalledWith("a");` na:

```ts
expect(mockBuildContextPack).toHaveBeenCalledWith("a", expect.any(Date), "full");
```

i po teście „200 z ContextPackDto” dopisz:

```ts
const reqRole = (role: string) =>
  new NextRequest(`http://localhost/api/projects/a/context-pack?role=${role}`);
const ctxA = { params: Promise.resolve({ id: "a" }) };

it("?role=review: serwis dostaje rolę", async () => {
  mockBuildContextPack.mockReturnValue({
    markdown: "# R",
    approxTokens: 1,
    truncated: false,
    warnings: [],
  });
  const res = await packGET(reqRole("review"), ctxA);
  expect(res.status).toBe(200);
  expect(mockBuildContextPack).toHaveBeenCalledWith("a", expect.any(Date), "review");
});

it("nieznana rola: 400 bez wywołania serwisu", async () => {
  const res = await packGET(reqRole("zly"), ctxA);
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "Nieznana rola paczki" });
  expect(mockBuildContextPack).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Uruchom: czerwone**

Run: `npx vitest run tests/unit/contexts/bc_projects/router.test.ts`
Expected: FAIL (router nie czyta `role`).

- [ ] **Step 3: Serwis**

W `services/index.ts` dopisz `type ContextPackRole,` do importu z `@/contexts/bc_projects/models` (pod `type ContextPack,`). Zmień sygnaturę i wywołanie:

```ts
export function buildContextPack(
  id: string,
  today: Date = new Date(),
  role: ContextPackRole = "full"
): ContextPack {
```

a w `composeContextPack({ … })` dopisz na końcu obiektu `role,`.

- [ ] **Step 4: Router**

W `router.ts` dopisz `ContextPackRoleSchema,` do importu ze `./schemas` (alfabetycznie, po `ArchiveDoneInputSchema`, jeśli jest, albo na początku listy) i zastąp `getContextPack`:

```ts
export async function getContextPack(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const role = ContextPackRoleSchema.safeParse(req.nextUrl.searchParams.get("role") ?? "full");
    if (role.success === false) {
      return NextResponse.json({ error: "Nieznana rola paczki" }, { status: 400 });
    }
    const { id } = await ctx.params;
    return NextResponse.json(
      toContextPackDto(services.buildContextPack(id, new Date(), role.data))
    );
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 5: Zielone + tsc + architektura**

Run: `npx vitest run tests/unit/contexts/bc_projects tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS (istniejące wywołania `buildContextPack(id, today)` w testach działają bez zmian).

---

### Task 4: UI: hook, wybór roli, karta

**Files:**

- Modify: `src/features/projects/mutation.ts`, `src/features/projects/useProjects.ts`, `src/features/projects/useContextPack.ts`, `src/features/projects/ProjectContextPack.tsx`, `src/features/projects/projects.css`
- Test: `tests/unit/features/projects/ProjectContextPack.test.tsx`, `tests/unit/features/projects/useProjects.test.tsx`

- [ ] **Step 1: Testy UI**

W `ProjectContextPack.test.tsx`: zmień importy RTL na `import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";`, dodaj `import type { ContextPackRole } from "@/contexts/bc_projects/schemas";` i zmień typ w `Harness`:

```tsx
function Harness(props: {
  load: (role: ContextPackRole) => Promise<ContextPackResult>;
  id?: string | null;
}) {
```

(`renderIt(load: () => Promise<ContextPackResult>, …)` zostaje: `vi.fn(async () => …)` jest przypisywalne do `(role) => …`; dla nowych testów używamy `Parameters`-owego typu poniżej.) Zmień też parametr `renderIt`: `load: (role: ContextPackRole) => Promise<ContextPackResult>`. Na końcu pliku dopisz:

```tsx
describe("paczka kontekstu: role", () => {
  const packFor = (role: string) => ({ ...PACK, markdown: `# P ${role}\n\n## Save State\n\nx` });
  const roleLoad = () =>
    vi.fn(
      async (role: ContextPackRole): Promise<ContextPackResult> => ({
        ok: true,
        pack: packFor(role),
      })
    );
  const roleButton = (name: string) => screen.getByRole("button", { name });

  it("pokazuje cztery role, „Pełna” wciśnięta", async () => {
    renderIt(roleLoad());
    await screen.findByText("3 200 / 4 000 tokenów");
    const group = screen.getByRole("group", { name: "Rola paczki" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["Pełna", "Review", "Implementacja", "Debug"]);
    expect(roleButton("Pełna")).toHaveAttribute("aria-pressed", "true");
  });

  it("wybór „Review” pobiera paczkę tej roli i przestawia przycisk", async () => {
    const load = roleLoad();
    const { user } = renderIt(load);
    await screen.findByText("3 200 / 4 000 tokenów");
    expect(load).toHaveBeenNthCalledWith(1, "full");
    await user.click(roleButton("Review"));
    await waitFor(() => expect(load).toHaveBeenLastCalledWith("review"));
    expect(roleButton("Review")).toHaveAttribute("aria-pressed", "true");
    expect(roleButton("Pełna")).toHaveAttribute("aria-pressed", "false");
  });

  it("kopiowanie po wyborze „Debug” składa i kopiuje paczkę tej roli", async () => {
    const load = roleLoad();
    const { user, writeText } = renderIt(load);
    await screen.findByText("3 200 / 4 000 tokenów");
    await user.click(roleButton("Debug"));
    await waitFor(() => expect(load).toHaveBeenLastCalledWith("debug"));
    await user.click(copyButtons()[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(packFor("debug").markdown));
    expect(load).toHaveBeenLastCalledWith("debug");
  });

  it("zmiana projektu przywraca rolę „Pełna”", async () => {
    const load = roleLoad();
    const { user, rerender } = renderIt(load);
    await screen.findByText("3 200 / 4 000 tokenów");
    await user.click(roleButton("Review"));
    await waitFor(() => expect(roleButton("Review")).toHaveAttribute("aria-pressed", "true"));
    rerender(<Harness load={load} id="b" />);
    await waitFor(() => expect(roleButton("Pełna")).toHaveAttribute("aria-pressed", "true"));
    expect(load).toHaveBeenLastCalledWith("full");
  });
});
```

W `useProjects.test.tsx`, bezpośrednio pod testem „loadContextPack: pobiera paczkę wybranego projektu” dopisz:

```tsx
it("loadContextPack(role): ?role= tylko dla ról innych niż full", async () => {
  const a = summary({ id: "a" });
  const pack = { markdown: "# A", approxTokens: 1, truncated: false, warnings: [] };
  const apiFetch = vi.fn(async (url: string) => {
    if (url === "/api/projects") {
      return new Response(JSON.stringify({ projects: [a], warnings: [] }), { status: 200 });
    }
    if (url === "/api/projects/a") {
      return new Response(JSON.stringify(detail({ id: "a" })), { status: 200 });
    }
    if (url.startsWith("/api/projects/a/context-pack")) {
      return new Response(JSON.stringify(pack), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  });

  const { result } = renderHook(() => useProjects(apiFetch));
  await waitFor(() => expect(result.current.detail?.id).toBe("a"));

  await act(async () => {
    await result.current.loadContextPack("review");
    await result.current.loadContextPack("full");
  });

  expect(apiFetch).toHaveBeenCalledWith("/api/projects/a/context-pack?role=review");
  expect(apiFetch).toHaveBeenCalledWith("/api/projects/a/context-pack");
});
```

- [ ] **Step 2: Uruchom: czerwone**

Run: `npx vitest run tests/unit/features/projects/ProjectContextPack.test.tsx tests/unit/features/projects/useProjects.test.tsx`
Expected: FAIL (brak grupy ról, `loadContextPack` ignoruje rolę).

- [ ] **Step 3: `mutation.ts` i `useProjects.ts`**

W `mutation.ts` dopisz `ContextPackRole,` do importu typów ze `@/contexts/bc_projects/schemas` i zmień linię w `ProjectActions`:

```ts
loadContextPack: (role?: ContextPackRole) => Promise<ContextPackResult>;
```

W `useProjects.ts` zmień import `import type { ContextPackDto } from "@/contexts/bc_projects/schemas";` na `import type { ContextPackDto, ContextPackRole } from "@/contexts/bc_projects/schemas";` i `loadContextPack`:

```ts
/** Odczyt, nie zapis: poza `mutate`, nie zmienia `detail`. Rola `full` bez zapytania (URL jak dotąd). */
const loadContextPack = useCallback(
  async (role: ContextPackRole = "full"): Promise<ContextPackResult> => {
    const id = selectedIdRef.current;
    if (id === null) return { ok: false, error: "Nie wybrano projektu" };
    try {
      const query = role === "full" ? "" : `?role=${role}`;
      const res = await apiFetch(`/api/projects/${encodeURIComponent(id)}/context-pack${query}`);
      if (!res.ok) return { ok: false, error: await readError(res) };
      return { ok: true, pack: (await res.json()) as ContextPackDto };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
  [apiFetch]
);
```

- [ ] **Step 4: `useContextPack.ts`**

Zastąp plik od importów do końca funkcji (typy `PackState`, `CopyNotice` bez zmian):

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContextPackDto, ContextPackRole } from "@/contexts/bc_projects/schemas";
import type { ContextPackResult } from "./mutation";

export type PackState =
  | { status: "loading" }
  | { status: "ready"; pack: ContextPackDto }
  | { status: "error"; error: string };

/** Wynik ostatniego kopiowania do schowka (pokazywany przy przycisku i w karcie paczki). */
export type CopyNotice =
  | { kind: "copied"; pack: ContextPackDto }
  | { kind: "error"; error: string };

/**
 * Paczka kontekstu wybranego projektu i roli: pobierana przy zmianie projektu albo roli (kafel i karta
 * pokazują budżet), a `copy` składa ją od nowa, żeby schowek miał aktualny stan, i kopiuje do schowka.
 * Rola jest powiązana z projektem: po zmianie projektu wraca do `full` (bez dodatkowego pobrania).
 */
export function useContextPack(
  projectId: string | null,
  load: (role: ContextPackRole) => Promise<ContextPackResult>
): {
  state: PackState;
  busy: boolean;
  notice: CopyNotice | null;
  copy: () => Promise<void>;
  role: ContextPackRole;
  setRole: (role: ContextPackRole) => void;
} {
  const [state, setState] = useState<PackState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<CopyNotice | null>(null);
  const [pick, setPick] = useState<{ id: string | null; role: ContextPackRole }>({
    id: null,
    role: "full",
  });
  const role: ContextPackRole = pick.id === projectId ? pick.role : "full";
  const setRole = useCallback(
    (next: ContextPackRole) => setPick({ id: projectId, role: next }),
    [projectId]
  );
  /** Numer bieżącego żądania (projekt, rola): spóźniona odpowiedź nie rusza stanu ani schowka. */
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const mine = generation.current;
    setNotice(null);
    setBusy(false);
    if (projectId === null) {
      setState({ status: "loading" });
      return;
    }
    setState({ status: "loading" });
    void load(role).then((result) => {
      if (generation.current !== mine) return;
      setState(
        result.ok === false
          ? { status: "error", error: result.error }
          : { status: "ready", pack: result.pack }
      );
    });
  }, [projectId, load, role]);

  const copy = useCallback(async () => {
    const mine = generation.current;
    setBusy(true);
    setNotice(null);
    const result = await load(role);
    if (generation.current !== mine) return;
    if (result.ok === false) {
      setNotice({ kind: "error", error: result.error });
      setBusy(false);
      return;
    }
    setState({ status: "ready", pack: result.pack });
    try {
      await navigator.clipboard.writeText(result.pack.markdown);
      if (generation.current === mine) setNotice({ kind: "copied", pack: result.pack });
    } catch {
      if (generation.current === mine) {
        setNotice({ kind: "error", error: "Nie udało się skopiować do schowka" });
      }
    }
    if (generation.current === mine) setBusy(false);
  }, [load, role]);

  return { state, busy, notice, copy, role, setRole };
}
```

- [ ] **Step 5: Karta `ProjectContextPack.tsx`**

Importy: `import type { ContextPackRole } from "@/contexts/bc_projects/schemas";` oraz zmień `import { PACK_BUDGET_TOKENS } from "@/contexts/bc_projects/schemas";` na `import { PACK_BUDGET_TOKENS, PACK_ROLES } from "@/contexts/bc_projects/schemas";` (jeden import z obu: `import { PACK_BUDGET_TOKENS, PACK_ROLES, type ContextPackRole } from "@/contexts/bc_projects/schemas";`). `ContextPackModel`:

```tsx
export type ContextPackModel = {
  state: PackState;
  busy: boolean;
  notice: CopyNotice | null;
  copy: () => Promise<void>;
  role: ContextPackRole;
  setRole: (role: ContextPackRole) => void;
};
```

W `ProjectContextPack`: `const { state, busy, notice, copy, role, setRole } = props.pack;` i bezpośrednio pod zamykającym `</div>` bloku `prj-card__head` (przed `{state.status === "loading" …}`) wstaw:

```tsx
<div className="prj-pack-card__roles" role="group" aria-label="Rola paczki">
  {PACK_ROLES.map(({ key, label }) => (
    <button
      key={key}
      type="button"
      className={role === key ? "prj-btn prj-btn--primary" : "prj-btn"}
      aria-pressed={role === key}
      onClick={() => setRole(key)}
    >
      {label}
    </button>
  ))}
</div>
```

- [ ] **Step 6: CSS**

Na końcu `src/features/projects/projects.css` dopisz:

```css
.prj-pack-card__roles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-1);
  margin: 0 0 var(--s-3);
}
```

- [ ] **Step 7: Zielone + tsc + lint**

Run: `npx vitest run tests/unit/features/projects tests/unit/features/home && npx tsc --noEmit && npm run lint`
Expected: PASS. (`ProjectsView` nie wymaga zmian: `useContextPack(detail?.id ?? null, loadContextPack)`; `loadContextPack` z opcjonalnym parametrem pasuje do `(role) => …`.)

---

### Task 5: Dokumentacja

**Files:**

- Modify: `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md`

- [ ] **Step 1: Zaktualizuj dwa zdania w spec asystenta**

```bash
python3 - <<'EOF'
p = "docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md"
s = open(p, encoding="utf8").read()
pairs = [
    ("szablony per rola i podgląd nadal odłożone.",
     "szablony per rola zrealizowane wg `2026-11-14-paczka-kontekstu-role-design.md` (podgląd Markdown jest w karcie paczki)."),
    ("Później (koszt M): szablony per rola (review / implementacja / debug) z innym zestawem sekcji i podglądem przed skopiowaniem.",
     "Szablony per rola (review / implementacja / debug): zrealizowane, zob. wyżej."),
]
for old, new in pairs:
    assert s.count(old) == 1, old
    s = s.replace(old, new)
open(p, "w", encoding="utf8").write(s)
EOF
git diff --stat
```

Expected: 1 plik, 2 linie zmienione.

---

### Task 6: Weryfikacja i jeden commit

- [ ] **Step 1: Pełny przebieg** (przez `cursor`; odpowiedź: „przeszło” albo lista `plik:linia + przyczyna`)

Run (osobno): `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
Expected: wszystko zielone.

- [ ] **Step 2: Review diffa przez `agy`** (CLAUDE.md: po większej zmianie; opinie to hipotezy, weryfikuj w kodzie)

```bash
scripts/ask-helper.sh --role review --fresh agy "Review diffa (git diff main, tylko odczyt) gałęzi feat/paczka-kontekstu-role. Spec: docs/superpowers/specs/2026-11-14-paczka-kontekstu-role-design.md. Szukaj: regresji roli full (musi być bajt w bajt jak dotąd), błędów w profilach ról i krokach redukcji w contexts/bc_projects/services/context-pack.ts, wyścigów w useContextPack (generation, zmiana roli i projektu), niezgodności URL (full bez ?role=). Lista: plik:linia + problem + dlaczego realny. Bez pochwał."
```

- [ ] **Step 3: Ręcznie w przeglądarce** (spec §7): karta Projekty, projekt `monolith`: przełącz cztery role, porównaj „Podgląd Markdown” ze skopiowanym tekstem, sprawdź rozmiar w kaflu „Paczka kontekstu”.

- [ ] **Step 4: Jeden commit**

```bash
git add contexts/bc_projects src/features/projects docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md tests/unit
git commit -m "feat(projekty): paczka kontekstu: szablony per rola (review, implementacja, debug)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Po merge'u (NEXUS):** w `Vault/Projects/monolith/tasks.md` odhacz „Paczka kontekstu: szablony per rola …” (osobny commit w NEXUS).

---

## Self-review (spec ↔ plan)

| Wymóg specu                                                                               | Zadanie   |
| ----------------------------------------------------------------------------------------- | --------- |
| §2 skład ról, ochrona diffu, brak kroków dla nieobecnych sekcji, limit zasad w `debug`    | Task 2    |
| §3 `models`, `schemas` (`ContextPackRoleSchema`, `PACK_ROLES`, typ), `services`, `router` | Taski 1–3 |
| §3 `buildContextPack(id, today, role)` zgodność wsteczna                                  | Task 3    |
| §4 `?role=`, `full` bez zapytania                                                         | Taski 3–4 |
| §5 hook, karta, kafel, `useProjects`, `mutation.ts`                                       | Task 4    |
| §6 400 dla nieznanej roli                                                                 | Task 3    |
| §7 testy (kompozytor, schematy, router, UI)                                               | Taski 1–4 |
| §8 jeden commit                                                                           | Task 6    |
| zmiana dwóch zdań w spec asystenta                                                        | Task 5    |

Spójność nazw: `ContextPackRole`/`CONTEXT_PACK_ROLES` (models), `ContextPackRoleSchema`/`PACK_ROLES` (schemas), `ROLE_PROFILES`/`SectionId` (context-pack), `role?` w `ContextPackInput`, `buildContextPack(id, today, role)`, `loadContextPack(role?)`, `useContextPack` zwraca `role`/`setRole`, `ContextPackModel` ma `role`/`setRole`.

Świadome luki: kafel paczki (`projectTiles.ts`) bez zmian w kodzie (pokazuje rozmiar wybranej roli); paczka Kokpitu (`CockpitSections.tsx`) zostaje `full`.
