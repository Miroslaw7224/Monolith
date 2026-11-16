# Słownik tagów Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. W tym repo zadania wykonują pomocnicy (`cursor --role task`), a Claude Code weryfikuje diff i commituje (sekcja „Podział pracy”). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeden słownik tagów (`Resources/tags.yaml`) dla kalendarza i zasobów: synonimy (`aliases`) zastępują zaszyty `TAG_MERGE_MAP`, nowy tag dopisuje się do słownika sam, a istniejące dane są scalone jednorazową migracją.

**Architecture:** `bc_tags/services.ts` dostaje `resolveTags(names)` (czysta część `resolveTagNames` + dopisywanie brakujących). `bc_resources/services.ts` i `bc_calendar/services.ts` wołają `resolveTags` przed zapisem (dozwolone: `services` → `services`). Format plików danych nie zmienia się, rekord słownika dostaje opcjonalne `aliases`.

**Tech Stack:** TypeScript, zod, Vitest (`tests/unit/**`), YAML w vaulcie (`lib/nexus`).

Spec: `docs/superpowers/specs/2026-11-16-slownik-tagow-design.md`. Gałąź: `feat/slownik-tagow`.

---

## Podział pracy

| Zadanie                     | Wykonawca                 | Weryfikacja Claude Code                                                   |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| 1–5 (kod i testy)           | `cursor --role task`      | `git diff`, `npx vitest run <pliki>` przez `cursor`, review `agy`         |
| 6 (dokument formatu)        | `cursor --role task`      | `git diff`                                                                |
| 7 (migracja danych w NEXUS) | `cursor --role task`      | skrypt kontrolny (krok 7.4), `git diff` w NEXUS, commit przez Claude Code |
| 8 (testy całości, review)   | `cursor` + `agy` (review) | pełny output tylko, gdy podsumowanie nie wystarcza                        |

Zasady: jedno zadanie naraz, bez równoległej edycji tych samych plików. Commity robi Claude Code (nie pomocnik). Test architektury (`tests/unit/architecture.static.test.ts`) **nie jest zmieniany**. Modele: `cursor --tier light`; review `agy` z `AGY_DEEP_TAG=Hydrogen` albo Flash (Argon wyczerpany do ~2026-11-21). Wyniki `cursora` sprawdzaj skryptem i review, bo przy tekstach gubi cudzysłowy i literały.

## Mapa plików

| Plik                                                          | Zmiana                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `contexts/bc_tags/models.ts`                                  | `aliases?: string[]` w `UserTag`                                  |
| `contexts/bc_tags/repositories.ts`                            | odczyt i normalizacja `aliases` (`toAliases`)                     |
| `contexts/bc_tags/schemas.ts`                                 | `aliases?: string[]` w `UserTagDto` i `toUserTagDto`              |
| `contexts/bc_tags/services.ts`                                | `resolveTagNames` (czysta), `resolveTags` (z zapisem brakujących) |
| `contexts/bc_resources/services.ts`                           | usunięty `normalizeTags`, wołanie `resolveTags`                   |
| `contexts/bc_resources/models.ts`                             | usunięty `TAG_MERGE_MAP`                                          |
| `contexts/bc_calendar/services.ts`                            | `resolveTags` w `createCalendarEvent` i `updateCalendarEvent`     |
| `src/features/tags/TagsSection.tsx`                           | aliasy tylko do odczytu                                           |
| `docs/nexus-vault-formaty-yaml.md`                            | pole `aliases`, zasada scalania                                   |
| `tests/unit/contexts/bc_tags/repositories.test.ts`            | + testy `aliases`                                                 |
| `tests/unit/contexts/bc_tags/services.resolve.test.ts`        | nowy: `resolveTagNames`, `resolveTags`                            |
| `tests/unit/contexts/bc_resources/services.resources.test.ts` | usunięty blok `normalizeTags`, nowe testy z mockiem `resolveTags` |
| `tests/unit/contexts/bc_calendar/services.test.ts`            | mock `resolveTags` + testy tagów                                  |

---

### Task 1: `aliases` w `bc_tags` (model, repozytorium, DTO)

**Files:**

- Modify: `contexts/bc_tags/models.ts`, `contexts/bc_tags/repositories.ts`, `contexts/bc_tags/schemas.ts`
- Test: `tests/unit/contexts/bc_tags/repositories.test.ts`

- [ ] **Step 1: Napisz testy (czerwone)** — dopisz na końcu bloku `describe("tags repository", ...)` w `tests/unit/contexts/bc_tags/repositories.test.ts` (importy `readList`, `formatYamlList`, `GENERATED_BY_IMPORT`, `setupTempVault`, `vault`, `FILE` już są w pliku):

```ts
it("czyta aliases: przycina, zdejmuje #, pomija puste, duplikaty i nazwę kanoniczną", async () => {
  vault.write(
    FILE,
    formatYamlList(
      "tags",
      [
        {
          id: "tagC",
          tag: "Agenci AI",
          title: "Agenci AI",
          aliases: ["Agent AI", "agenci ai", "", "  ", "#Agent AI", "Agenci AI", "agent"],
          created: "2026-03-03T10:00:00.000Z",
        },
      ],
      GENERATED_BY_IMPORT
    )
  );
  const [tag] = await getUserTags();
  expect(tag.aliases).toEqual(["Agent AI", "agent"]);
});

it("rekord bez aliases (lub z pustą listą) nie ma klucza aliases", async () => {
  seed();
  vault.write(
    FILE,
    formatYamlList(
      "tags",
      [{ id: "tagD", tag: "Delta", title: "D", aliases: [], created: "2026-03-04T10:00:00.000Z" }],
      GENERATED_BY_IMPORT
    )
  );
  const [tag] = await getUserTags();
  expect(tag).not.toHaveProperty("aliases");
});

it("updateUserTag zachowuje aliases zapisane w pliku", async () => {
  vault.write(
    FILE,
    formatYamlList(
      "tags",
      [
        {
          id: "tagE",
          tag: "Echo",
          title: "E",
          aliases: ["Eko"],
          created: "2026-03-05T10:00:00.000Z",
        },
      ],
      GENERATED_BY_IMPORT
    )
  );
  await updateUserTag("tagE", { title: "Echo 2" });
  const raw = readList(FILE, "tags").find((r) => r.id === "tagE");
  expect(raw?.aliases).toEqual(["Eko"]);
  expect(raw?.title).toBe("Echo 2");
});
```

- [ ] **Step 2: Uruchom — ma być czerwono**

Run: `npx vitest run tests/unit/contexts/bc_tags/repositories.test.ts`
Expected: FAIL (`tag.aliases` jest `undefined`; trzeci test może już przejść, bo `patchRecord` zachowuje nieznane klucze).

- [ ] **Step 3: Implementacja**

`contexts/bc_tags/models.ts`, w typie `UserTag` dodaj po `color?: string;`:

```ts
  aliases?: string[]; // synonimy (porównanie bez względu na wielkość liter)
```

`contexts/bc_tags/repositories.ts`, przed `function toTag` dodaj:

```ts
/** Synonimy: przycięte, bez `#`, bez pustych, duplikatów (bez wielkości liter) i nazwy kanonicznej. */
function toAliases(value: unknown, canonical: string): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>([canonical.toLowerCase()]);
  const out: string[] = [];
  for (const raw of value) {
    const alias = normTag(raw);
    const key = alias.toLowerCase();
    if (alias === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(alias);
  }
  return out.length > 0 ? out : undefined;
}
```

oraz zastąp `toTag` tym:

```ts
function toTag(record: YamlRecord): UserTag {
  const tag = normTag(record.tag);
  const aliases = toAliases(record.aliases, tag);
  return {
    id: str(record.id),
    tag,
    title: str(record.title).trim(),
    color: optStr(record.color),
    ...(aliases ? { aliases } : {}),
    created_at: optStr(record.created),
  };
}
```

`contexts/bc_tags/schemas.ts`: w `UserTagDto` dodaj `aliases?: string[];` po `color?: string;`, a w `toUserTagDto` po `color: tag.color,` dodaj `aliases: tag.aliases,`.

- [ ] **Step 4: Uruchom — ma być zielono**

Run: `npx vitest run tests/unit/contexts/bc_tags`
Expected: PASS (także istniejące testy `repositories`, `services`, `router`).

- [ ] **Step 5: Commit (Claude Code)**

```bash
git add contexts/bc_tags tests/unit/contexts/bc_tags
git commit -m "feat(tags): pole aliases w słowniku tagów"
```

---

### Task 2: `resolveTagNames` i `resolveTags` w `bc_tags/services.ts`

**Files:**

- Modify: `contexts/bc_tags/services.ts`
- Test: `tests/unit/contexts/bc_tags/services.resolve.test.ts` (nowy)

- [ ] **Step 1: Napisz testy (czerwone)** — nowy plik `tests/unit/contexts/bc_tags/services.resolve.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { UserTag } from "@/contexts/bc_tags/models";
import { resolveTagNames, resolveTags } from "@/contexts/bc_tags/services";

const mockGetUserTags = vi.hoisted(() => vi.fn());
const mockCreateUserTag = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_tags/repositories", () => ({
  getUserTags: (...a: unknown[]) => mockGetUserTags(...a),
  createUserTag: (...a: unknown[]) => mockCreateUserTag(...a),
  updateUserTag: vi.fn(),
  deleteUserTag: vi.fn(),
}));

const DICT: UserTag[] = [
  { id: "t1", tag: "Agenci AI", title: "Agenci AI", aliases: ["Agent AI"] },
  {
    id: "t2",
    tag: "Praca własna",
    title: "Moje projekty",
    color: "#ff8800",
    aliases: ["Projekty", "moje projekty"],
  },
  { id: "t3", tag: "AI", title: "AI" },
];

describe("resolveTagNames", () => {
  it("zamienia alias na nazwę kanoniczną bez względu na wielkość liter", () => {
    expect(resolveTagNames(["agent ai"], DICT)).toEqual({ tags: ["Agenci AI"], missing: [] });
  });
  it("sprowadza nazwę kanoniczną do zapisu ze słownika i usuwa duplikaty", () => {
    expect(resolveTagNames(["ai", " AI ", "Ai"], DICT)).toEqual({ tags: ["AI"], missing: [] });
  });
  it("kilka aliasów tego samego tagu daje jeden tag", () => {
    expect(resolveTagNames(["Projekty", "moje projekty", "Praca własna"], DICT).tags).toEqual([
      "Praca własna",
    ]);
  });
  it("nieznane tagi zachowują kolejność, trafiają do missing raz", () => {
    expect(resolveTagNames(["Nowy", "nowy", "Inny"], DICT)).toEqual({
      tags: ["Nowy", "Inny"],
      missing: ["Nowy", "Inny"],
    });
  });
  it("pomija puste i nie-teksty, zdejmuje wiodące #", () => {
    expect(resolveTagNames(["", "  ", 5, null, "#Nowy"], DICT)).toEqual({
      tags: ["Nowy"],
      missing: ["Nowy"],
    });
  });
  it("nazwa kanoniczna ma pierwszeństwo przed aliasem innego tagu", () => {
    const dict: UserTag[] = [
      { id: "a", tag: "A", title: "A", aliases: ["B"] },
      { id: "b", tag: "B", title: "B" },
    ];
    expect(resolveTagNames(["b"], dict).tags).toEqual(["B"]);
  });
  it("zwraca puste wyniki dla pustego wejścia", () => {
    expect(resolveTagNames([], DICT)).toEqual({ tags: [], missing: [] });
  });
});

describe("resolveTags", () => {
  beforeEach(() => {
    mockGetUserTags.mockReset();
    mockCreateUserTag.mockReset();
    mockGetUserTags.mockResolvedValue(DICT);
    mockCreateUserTag.mockResolvedValue({ id: "new", tag: "x", title: "x" });
  });

  it("dla pustej listy nie czyta słownika", async () => {
    expect(await resolveTags([])).toEqual([]);
    expect(mockGetUserTags).not.toHaveBeenCalled();
  });
  it("znane tagi: bez dopisywania do słownika", async () => {
    expect(await resolveTags(["agent ai", "AI"])).toEqual(["Agenci AI", "AI"]);
    expect(mockCreateUserTag).not.toHaveBeenCalled();
  });
  it("nieznany tag dopisuje do słownika raz, bez koloru, z title = nazwa", async () => {
    expect(await resolveTags(["Nowy", "nowy"])).toEqual(["Nowy"]);
    expect(mockCreateUserTag).toHaveBeenCalledTimes(1);
    expect(mockCreateUserTag).toHaveBeenCalledWith({ tag: "Nowy", title: "Nowy" });
  });
  it("błąd zapisu słownika przerywa operację", async () => {
    mockCreateUserTag.mockRejectedValue(new Error("409"));
    await expect(resolveTags(["Nowy"])).rejects.toThrow("409");
  });
});
```

- [ ] **Step 2: Uruchom — ma być czerwono**

Run: `npx vitest run tests/unit/contexts/bc_tags/services.resolve.test.ts`
Expected: FAIL (`resolveTagNames is not a function` albo brak eksportu).

- [ ] **Step 3: Implementacja** — w `contexts/bc_tags/services.ts` dodaj import `import type { UserTag } from "./models";` na górze (po `import * as repositories`) i na końcu pliku:

```ts
/**
 * Czysta część: dopasowuje nazwy do słownika (nazwa kanoniczna lub alias, bez wielkości liter).
 * `tags`: nazwy kanoniczne (nieznane zostają jak podano, bez `#`), bez duplikatów, w kolejności wejścia.
 * `missing`: te spośród `tags`, których nie ma w słowniku.
 */
export function resolveTagNames(
  names: readonly unknown[],
  dictionary: readonly UserTag[]
): { tags: string[]; missing: string[] } {
  const byKey = new Map<string, string>();
  for (const entry of dictionary) byKey.set(entry.tag.toLowerCase(), entry.tag);
  for (const entry of dictionary) {
    for (const alias of entry.aliases ?? []) {
      const key = alias.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, entry.tag);
    }
  }
  const tags: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    if (typeof raw !== "string") continue;
    const name = raw.trim().replace(/^#/, "").trim();
    if (name === "") continue;
    const canonical = byKey.get(name.toLowerCase());
    const tag = canonical ?? name;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (canonical === undefined) missing.push(tag);
  }
  return { tags, missing };
}

/** Sprowadza nazwy do kanonicznych i dopisuje nieznane tagi do słownika (bez koloru). */
export async function resolveTags(names: readonly unknown[]): Promise<string[]> {
  if (names.length === 0) return [];
  const dictionary = await repositories.getUserTags();
  const { tags, missing } = resolveTagNames(names, dictionary);
  for (const tag of missing) {
    await repositories.createUserTag({ tag, title: tag });
  }
  return tags;
}
```

- [ ] **Step 4: Uruchom — ma być zielono**

Run: `npx vitest run tests/unit/contexts/bc_tags`
Expected: PASS.

- [ ] **Step 5: Commit (Claude Code)**

```bash
git add contexts/bc_tags/services.ts tests/unit/contexts/bc_tags/services.resolve.test.ts
git commit -m "feat(tags): resolveTags scala synonimy i dopisuje nowe tagi do słownika"
```

---

### Task 3: `bc_resources` używa `resolveTags` zamiast `TAG_MERGE_MAP`

**Files:**

- Modify: `contexts/bc_resources/services.ts`, `contexts/bc_resources/models.ts`
- Test: `tests/unit/contexts/bc_resources/services.resources.test.ts`

- [ ] **Step 1: Zmień testy (czerwone)** w `tests/unit/contexts/bc_resources/services.resources.test.ts`:

1. Przy pozostałych `vi.hoisted` dodaj `const mockResolveTags = vi.hoisted(() => vi.fn());`, a po `vi.mock("@/contexts/bc_nexus_docs/services", ...)` dodaj:

```ts
vi.mock("@/contexts/bc_tags/services", () => ({
  resolveTags: (...a: unknown[]) => mockResolveTags(...a),
}));
```

2. W `beforeEach` głównego `describe` dodaj `mockResolveTags.mockReset();` oraz `mockResolveTags.mockImplementation(async (names: string[]) => names);`.
3. Usuń `normalizeTags,` z importu i cały blok `describe("normalizeTags", ...)` (testy tej logiki są teraz w `services.resolve.test.ts`).
4. Zastąp blok `describe("tagi w addResource/updateResource", ...)` (dwa testy) tym, zachowując kolejne testy z tego bloku, jeśli istnieją:

```ts
describe("tagi w addResource/updateResource", () => {
  it("addResource zapisuje tagi zwrócone przez resolveTags", async () => {
    mockResolveTags.mockResolvedValue(["Learning"]);
    mockAdd.mockImplementation(async (p: Record<string, unknown>) => ({ id: "r5", ...p }));
    await addResource({ description: "d", url: "https://example.com", tags: ["kurs", "nauka"] });
    expect(mockResolveTags).toHaveBeenCalledWith(["kurs", "nauka"]);
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ tags: ["Learning"] }));
  });
  it("addResource bez tagów woła resolveTags z pustą listą", async () => {
    mockAdd.mockImplementation(async (p: Record<string, unknown>) => ({ id: "r6", ...p }));
    await addResource({ description: "d", url: "https://example.com" });
    expect(mockResolveTags).toHaveBeenCalledWith([]);
  });
  it("updateResource scala tagi przez resolveTags, a bez tagów ich nie dotyka", async () => {
    mockUpdate.mockResolvedValue(undefined);
    mockResolveTags.mockResolvedValue(["Learning"]);
    await updateResource("r1", { tags: ["Kursy", "kurs"] });
    expect(mockUpdate).toHaveBeenCalledWith("r1", { tags: ["Learning"] });
    mockResolveTags.mockClear();
    await updateResource("r1", { isFavorite: true });
    expect(mockResolveTags).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenLastCalledWith("r1", { isFavorite: true });
  });
});
```

- [ ] **Step 2: Uruchom — ma być czerwono**

Run: `npx vitest run tests/unit/contexts/bc_resources/services.resources.test.ts`
Expected: FAIL (`resolveTags` nie jest wołany, bo kod nadal używa `normalizeTags`).

- [ ] **Step 3: Implementacja**

`contexts/bc_resources/services.ts`:

- zmień `import { TAG_MERGE_MAP, type Resource } from "./models";` na `import type { Resource } from "./models";`;
- dodaj `import { resolveTags } from "@/contexts/bc_tags/services";` po imporcie `bc_nexus_docs`;
- usuń całą funkcję `normalizeTags` (z linii `export function normalizeTags` do zamykającego `}`);
- w `addResource`: `tags: normalizeTags(data.tags ?? []),` → `tags: await resolveTags(data.tags ?? []),`;
- w `updateResource`: `...(data.tags !== undefined && { tags: normalizeTags(data.tags) }),` → `...(data.tags !== undefined && { tags: await resolveTags(data.tags) }),`.

`contexts/bc_resources/models.ts`: usuń komentarz `/** Scalanie wariantów tagów ... */` i cały `export const TAG_MERGE_MAP = { ... };` (zostaje typ `Resource` i reszta pliku).

- [ ] **Step 4: Uruchom — ma być zielono**

Run: `npx vitest run tests/unit/contexts/bc_resources tests/unit/architecture.static.test.ts`
Expected: PASS. Jeśli pęka test architektury, popraw kod (nie test).

- [ ] **Step 5: Commit (Claude Code)**

```bash
git add contexts/bc_resources tests/unit/contexts/bc_resources
git commit -m "feat(resources): tagi zasobów przez słownik zamiast TAG_MERGE_MAP"
```

---

### Task 4: `bc_calendar` używa `resolveTags`

**Files:**

- Modify: `contexts/bc_calendar/services.ts`
- Test: `tests/unit/contexts/bc_calendar/services.test.ts`

- [ ] **Step 1: Napisz testy (czerwone)** w `tests/unit/contexts/bc_calendar/services.test.ts`:

1. Dodaj `const mockResolveTags = vi.hoisted(() => vi.fn());` i po `vi.mock("@/contexts/bc_tasks/services", ...)`:

```ts
vi.mock("@/contexts/bc_tags/services", () => ({
  resolveTags: (...args: unknown[]) => mockResolveTags(...args),
}));
```

2. W `beforeEach` dodaj `mockResolveTags.mockReset();` i `mockResolveTags.mockImplementation(async (names: string[]) => names);`.
3. Dopisz na końcu głównego `describe("calendarService", ...)`:

```ts
describe("tagi wydarzeń", () => {
  const base = {
    date: "2026-11-18",
    start_minutes: 540,
    duration_minutes: 60,
    title: "Spotkanie",
    color: "#3B82F6",
  };

  it("createCalendarEvent zapisuje tagi zwrócone przez resolveTags", async () => {
    mockResolveTags.mockResolvedValue(["Agenci AI"]);
    mockCreateCalendarEvent.mockResolvedValue({ id: "e1" });
    await createCalendarEvent({ ...base, tags: ["agent ai"] });
    expect(mockResolveTags).toHaveBeenCalledWith(["agent ai"]);
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["Agenci AI"] })
    );
  });

  it("updateCalendarEvent z tags woła resolveTags", async () => {
    mockResolveTags.mockResolvedValue(["Praca własna"]);
    mockUpdateCalendarEvent.mockResolvedValue({ id: "e1" });
    await updateCalendarEvent("e1", { tags: ["Projekty"] });
    expect(mockResolveTags).toHaveBeenCalledWith(["Projekty"]);
    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ tags: ["Praca własna"] })
    );
  });

  it("updateCalendarEvent bez tags nie woła resolveTags i nie dodaje klucza tags", async () => {
    mockUpdateCalendarEvent.mockResolvedValue({ id: "e1" });
    await updateCalendarEvent("e1", { title: "Nowy tytuł" });
    expect(mockResolveTags).not.toHaveBeenCalled();
    expect(mockUpdateCalendarEvent.mock.calls[0][1]).not.toHaveProperty("tags");
  });
});
```

- [ ] **Step 2: Uruchom — ma być czerwono**

Run: `npx vitest run tests/unit/contexts/bc_calendar/services.test.ts`
Expected: FAIL (`resolveTags` nie jest wołany).

- [ ] **Step 3: Implementacja** — `contexts/bc_calendar/services.ts`: dodaj `import * as tagService from "@/contexts/bc_tags/services";` po imporcie `taskService`; w `createCalendarEvent` zastąp wywołanie repozytorium:

```ts
return repositories.createCalendarEvent({
  ...data,
  tags: await tagService.resolveTags(data.tags),
  link: normalizeLink(data.link),
  brief: normalizeBrief(data.brief),
});
```

w `updateCalendarEvent`:

```ts
return repositories.updateCalendarEvent(id, {
  ...data,
  ...(data.tags !== undefined && { tags: await tagService.resolveTags(data.tags) }),
  link: normalizeLink(data.link),
  brief: normalizeBrief(data.brief),
});
```

- [ ] **Step 4: Uruchom — ma być zielono**

Run: `npx vitest run tests/unit/contexts/bc_calendar tests/unit/architecture.static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (Claude Code)**

```bash
git add contexts/bc_calendar tests/unit/contexts/bc_calendar
git commit -m "feat(calendar): tagi wydarzeń przez słownik"
```

---

### Task 5: aliasy w sekcji Tagi (tylko odczyt)

**Files:**

- Modify: `src/features/tags/TagsSection.tsx`
- Test: nowy test komponentu, wzorowany na sąsiednim teście renderującym komponent z `useT` (`tests/unit/components/` lub `tests/unit/features/`; helper znajdź grepem po `render(` i `useT`)

- [ ] **Step 1: Napisz test (czerwony)** — renderuje `TagsSection` z `userTags=[{id:"t1", tag:"Agenci AI", title:"Agenci AI", aliases:["Agent AI","agent"]}, {id:"t2", tag:"AI", title:"AI"}]` i oczekuje: (a) tekst `≈ Agent AI, agent` jest w dokumencie; (b) w wierszu `AI` nie ma elementu z `≈`.

- [ ] **Step 2: Uruchom — ma być czerwono**

Run: `npx vitest run <ścieżka nowego testu>`
Expected: FAIL (brak tekstu `≈ Agent AI, agent`).

- [ ] **Step 3: Implementacja** — w `src/features/tags/TagsSection.tsx`, w gałęzi nie-edycyjnej wiersza, zaraz po `<span className="flex-1 min-w-0 text-sm text-[var(--text2)] truncate">{item.title || "—"}</span>` dodaj:

```tsx
{
  item.aliases && item.aliases.length > 0 && (
    <span className="text-xs text-[var(--text2)] truncate" title={item.aliases.join(", ")}>
      ≈ {item.aliases.join(", ")}
    </span>
  );
}
```

- [ ] **Step 4: Uruchom — ma być zielono**

Run: `npx vitest run <ścieżka nowego testu>`
Expected: PASS.

- [ ] **Step 5: Commit (Claude Code)**

```bash
git add src/features/tags tests/unit
git commit -m "feat(tags): sekcja Tagi pokazuje synonimy"
```

---

### Task 6: dokument formatu

**Files:**

- Modify: `docs/nexus-vault-formaty-yaml.md`

- [ ] **Step 1:** W tabeli na początku pliku zmień wiersz `Resources/tags.yaml` na pola `id`, `tag`, `title`, `color` (opcjonalne), `aliases`\* (opcjonalne), `created`.
- [ ] **Step 2:** Pod tabelą „Zasady zapisu” dodaj sekcję `## Tagi: słownik i synonimy` z treścią: (1) `aliases` to lista synonimów nazwy `tag`, porównywanych bez względu na wielkość liter; klucz jest pomijany, gdy brak synonimów; (2) kalendarz (`Calendar/*.yaml`) i zasoby (`Resources/resources.yaml`) trzymają w `tags` **nazwy kanoniczne**; (3) zapis przez API sprowadza synonimy do nazw kanonicznych, usuwa duplikaty i dopisuje nieznane tagi do `tags.yaml` (bez `color`, `title` = nazwa); ręczny zapis plików tego **nie** robi, więc dopisz tag do słownika sam; (4) synonimy dopisuje się ręcznie lub przez agenta, UI ich nie edytuje; (5) w polu `tags` wydarzeń (wiersz tabeli kalendarza) zmień opis na: „lista nazw kanonicznych tagów (może być `[]`); to nazwy, nie id tagów z `Resources/tags.yaml`”.
- [ ] **Step 3: Sprawdź** — `npx prettier --check docs/nexus-vault-formaty-yaml.md` (tylko sprawdzenie, bez `--write`); jeśli zgłasza błąd, popraw ręcznie.
- [ ] **Step 4: Commit (Claude Code)**

```bash
git add docs/nexus-vault-formaty-yaml.md
git commit -m "docs: pole aliases i zasady scalania tagów w formatach vaulta"
```

---

### Task 7: migracja danych w NEXUS (po zadaniach 1–6)

**Files (repo `~/projects/Brain_7224/NEXUS`):**

- Modify: `Vault/Resources/tags.yaml`, `Vault/Resources/resources.yaml`

Reguły (wykonawca zmienia pliki wyłącznie edycją tekstu wpisów, bez przeformatowywania reszty pliku):

1. W `Vault/Resources/resources.yaml` w polu `tags` każdego zasobu zamień: `Agent AI` → `Agenci AI`; `Projekty` → `Praca własna`; `kurs`, `kursy`, `Kursy`, `nauka`, `Nauka` → `Learning`; usuń powstałe duplikaty (bez względu na wielkość liter, zachowując kolejność pierwszego wystąpienia). Inne tagi bez zmian.
2. W `Vault/Resources/tags.yaml` do rekordów `Agenci AI`, `Praca własna` dopisz `aliases` (`Agenci AI`: `Agent AI`; `Praca własna`: `Projekty`, `moje projekty`). Nowy rekord `Learning` z `aliases`: `kurs`, `kursy`, `nauka`. Dla każdego innego tagu użytego w zasobach (po zamianach z punktu 1) i dla `Crait` z kalendarza, którego nie ma w słowniku, dopisz rekord: `id` (20 znaków alfanumerycznych, unikalne w pliku), `tag`, `title` równe nazwie, `created` (ISO 8601 UTC, bieżący czas), bez `color`. Istniejących rekordów (`Career Guide` z tytułem „QA Tester”, kolorów) nie zmieniaj.
3. `Vault/Calendar/*.yaml` nie zmienia się (tagi `Career Guide` i `Crait` są już kanoniczne).

- [ ] **Step 7.1: Zapisz stan przed** — wykonawca zapisuje do `/tmp/claude-1000/-home-miro7224-projects-Brain-7224-Monolith/5ce05a7d-2276-41d4-90c2-b1dab2c10724/scratchpad/tagi-przed.txt` liczbę zasobów i listę unikalnych tagów z liczbą użyć (ten sam format co po migracji).
- [ ] **Step 7.2: Wykonaj reguły 1–3.**
- [ ] **Step 7.3: Zapisz stan po** do `.../scratchpad/tagi-po.txt`.
- [ ] **Step 7.4: Kontrola (Claude Code, nie wykonawca)** — `git -C ~/projects/Brain_7224/NEXUS diff --stat` pokazuje tylko dwa pliki; liczba zasobów bez zmian (74); w `resources.yaml` nie ma już tagów `Agent AI`, `Projekty`, `kurs`, `kursy`, `Kursy`, `nauka`; każdy tag użyty w zasobach i w kalendarzu występuje w `tags.yaml` (bez względu na wielkość liter); `tags.yaml` parsuje się (`node -e` z pakietem `yaml` z Monolith lub aplikacja czyta plik bez błędu); `git diff` nie zawiera przeformatowań poza zmienionymi wpisami.
- [ ] **Step 7.5: Commit i push w NEXUS (Claude Code)** — `git -C ~/projects/Brain_7224/NEXUS add Vault/Resources && git -C ~/projects/Brain_7224/NEXUS commit -m "chore(vault): scalenie tagów, słownik obejmuje tagi zasobów i kalendarza"` i push (NEXUS: commit i push od razu; pusty commit oznacza, że był szybszy timer auto-sync).

---

### Task 8: weryfikacja całości i review

- [ ] **Step 1:** `cursor --role task --approve-allowed`: `npx tsc --noEmit`, `npx vitest run`, `npm run lint` — odpowiedź „przeszło” albo lista `plik:linia + przyczyna`.
- [ ] **Step 2:** Review diffa gałęzi względem `main` przez `agy --role review` (tier: `AGY_DEEP_TAG=Hydrogen` albo Flash). Pytania: czy `resolveTags` może zdublować tag przy równoległych zapisach (jeden użytkownik, więc ryzyko niskie), czy zachowanie `updateCalendarEvent` bez `tags` zostało nienaruszone, czy brakuje testu brzegowego. Wnioski traktuj jak hipotezy i weryfikuj w kodzie.
- [ ] **Step 3: Sprawdzenie w aplikacji (Claude Code)** na kopii vaulta (`NEXUS_VAULT_PATH`): dodaj zasób z tagiem `agent ai` i wydarzenie z tagiem `projekty`; w plikach pojawiają się `Agenci AI` i `Praca własna`, a słownik nie ma duplikatów.
- [ ] **Step 4:** Odhaczenie pozycji „słownik tagów” w `NEXUS/Vault/Projects/monolith/tasks.md` (commit i push w NEXUS) oraz PR z gałęzi `feat/slownik-tagow` (na prośbę użytkownika).

---

## Self-review planu względem specu

- T1 (jedno pojęcie), T2 (podpowiada, dopisuje, synonimy zamiast mapy): Taski 1–4. T3 (migracja przez agenta, po kodzie): Task 7 po 1–6. T4 (kolizje): Task 7, reguły 1–2. T5 (kolory opcjonalne): `resolveTags` tworzy tagi bez `color` (Task 2), migracja bez kolorów (Task 7). T6 (aliasy tylko poza UI, UI pokazuje): Task 5.
- Sekcja 6 specu (testy): przypadki 1–6 w Taskach 1–2 (alias, duplikaty, nowy tag raz bez koloru, puste, ten sam wynik w zasobach i wydarzeniach przez wspólne `resolveTags`, stary plik bez `aliases`, filtr aliasów). Przypadek „alias identyczny z nazwą kanoniczną lub zduplikowany” jest w Task 1.
- Zmiana względem specu (zapisana w specu, sekcja 4 i 7): brak podpowiedzi w formularzach zasobów (to zwykłe pole tekstowe), wiodące `#` pomijane przy dopasowaniu.
- Typy i nazwy spójne: `UserTag.aliases`, `UserTagDto.aliases`, `resolveTagNames(names, dictionary) → { tags, missing }`, `resolveTags(names) → Promise<string[]>`.
