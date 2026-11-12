# Etap 0c-2: tagi, szablony zadań, zasoby w vaulcie — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przepiąć kolekcje `tags`, `task_templates` i `resources` z Firestore na pliki YAML w vaulcie NEXUS (`Resources/tags.yaml`, `Tasks/templates.yaml`, `Resources/resources.yaml`), bez zmiany zachowania serwisów, route handlerów i UI.

**Architecture:** Wspólny `lib/nexus/yaml-store.ts` (odczyt listy rekordów i zmiana listy przez `updateVaultFile` z 0c-1) plus `lib/nexus/repos/common.ts` (id, sortowanie, łatanie rekordów) i trzy cienkie repozytoria w `lib/nexus/repos/`. Barrel `lib/firestore-db.ts` zachowuje nazwy i sygnatury funkcji, więc serwisy się nie zmieniają. Czas w typach rekordów staje się tekstem ISO; trzy stare pliki `lib/firestore/*` są usuwane.

**Tech Stack:** TypeScript, Next.js 14, Vitest (`// @vitest-environment node` dla testów plikowych), `node:crypto`, `yaml` (przez `lib/nexus/yaml-lists.ts`).

Spec: `docs/superpowers/specs/2026-11-12-etap-0c-2-tagi-szablony-zasoby-design.md`. Zasady wykonania: TDD (czerwony test, zielony test), commit po każdym zadaniu, `tsc`/lint/pełny vitest deleguj do `cursor` (CLAUDE.md). Pojedyncze uruchomienia testów z kroków TDD wolno puszczać samemu (krótki output).

## Doprecyzowania względem speca (zatwierdzone w tym planie)

1. **`updateList` pomija zapis przez wyjątek-wartownika, nie przez „bajtowo identyczną treść”.** `updateVaultFile` zawsze zapisuje wynik `mutate`, a dla brakującego pliku `mutate` musiałoby zwrócić jakiś tekst (powstałby pusty plik przy `delete` na nieistniejącym id). Dlatego `mutate` rzuca prywatny `NoChange`, który `updateList` łapie i zwraca `false`. `updateVaultFile` przepuszcza błędy z `mutate` bez ponawiania (wywołuje je poza `try` z `ConflictError`), więc to działa.
2. **Dodatkowy plik `lib/nexus/repos/common.ts`** (spec wymienia tylko `yaml-store` i trzy repozytoria): wspólne helpery (`generateId`, `sortByCreated`, `appendRecord`, `patchRecord`, `removeRecord`) zamiast trzykrotnego powielania.
3. **P1 (status `VaultConfigError`):** `handleServiceError` kieruje go do gałęzi końcowej: HTTP 500 z `err.message` (komunikat „Brak vaulta: ustaw NEXUS_VAULT_PATH…” jest już czytelny) i `console.error`. Bez zmiany kodu; Zadanie 6 dodaje test charakteryzujący to zachowanie.
4. **P2 (`createdAt`/`updatedAt` w `NoteResourceRecord`):** opcjonalne (`createdAt?: string`). Żaden kod UI ich nie czyta, a rekord z ręcznie edytowanego pliku może nie mieć dat. `ResourceListItem.test.tsx` traci pola `createdAt: null`/`updatedAt: null`.
5. **Remisy w sortowaniu:** zawsze rosnąco po `id`, niezależnie od kierunku sortowania po dacie.
6. **`userId` w repozytoriach:** parametr zostaje w sygnaturach (barrel bez zmian). Tagi i szablony nazywają go `_userId`; zasoby dopisują go do zwracanego rekordu.

## Struktura plików

| Plik                                                                | Akcja       | Odpowiedzialność                                                  |
| ------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `lib/nexus/yaml-store.ts`                                           | nowy        | `readList`, `updateList`: lista rekordów w pliku YAML             |
| `lib/nexus/repos/common.ts`                                         | nowy        | id, czas, sortowanie, `appendRecord`/`patchRecord`/`removeRecord` |
| `lib/nexus/repos/tags.ts`                                           | nowy        | repozytorium tagów (`Resources/tags.yaml`)                        |
| `lib/nexus/repos/taskTemplates.ts`                                  | nowy        | repozytorium szablonów (`Tasks/templates.yaml`)                   |
| `lib/nexus/repos/resources.ts`                                      | nowy        | repozytorium zasobów (`Resources/resources.yaml`)                 |
| `types/records.ts`                                                  | modyfikacja | pola czasu jako ISO w trzech typach                               |
| `lib/firestore-db.ts`                                               | modyfikacja | eksporty trzech grup wskazują na `lib/nexus/repos/*`              |
| `lib/firestore/{tags,taskTemplates,resources}.ts`                   | usunięte    | stare repozytoria Firestore                                       |
| `lib/firestore/collections.ts`                                      | modyfikacja | usunąć `userTagsCol`, `taskTemplatesCol`, `userResourcesCol`      |
| `tests/unit/lib/nexus/repos/helpers.ts`                             | nowy        | `useTempVault()`: tymczasowy vault + `NEXUS_VAULT_PATH`           |
| `tests/unit/lib/nexus/yaml-store.test.ts`                           | nowy        | testy store                                                       |
| `tests/unit/lib/nexus/repos/{tags,taskTemplates,resources}.test.ts` | nowy        | testy repozytoriów                                                |
| `tests/unit/lib/nexus/repos-static.test.ts`                         | nowy        | testy statyczne (bez firebase, bez `fs`, brak starych plików)     |
| `tests/unit/components/resources/ResourceListItem.test.tsx`         | modyfikacja | usunąć `createdAt: null`, `updatedAt: null`                       |
| `tests/unit/lib/apiError.test.ts`                                   | modyfikacja | test charakteryzujący `VaultConfigError` → 500                    |
| `docs/nexus-vault-formaty-yaml.md`                                  | nowy        | opis formatu trzech plików                                        |
| `docs/superpowers/specs/2026-11-12-etap-0c-2-…-design.md`           | modyfikacja | status „zaimplementowany”, rozstrzygnięcia P1 i P2                |

---

### Task 0: Krok zerowy (D1) i gałąź

**Files:** brak zmian w kodzie aplikacji. Commit w repo NEXUS robi człowiek albo agent **za wyraźną zgodą użytkownika** (CLAUDE.md: kod projektów tylko do odczytu, commity to decyzja wykonawcy; nie deleguj).

- [ ] **Step 1: Sprawdź, że zaimportowane pliki są nieśledzone w repo NEXUS**

Run: `git -C ../NEXUS status --short Vault/`
Expected: wiersze `?? Vault/Notes/`, `?? Vault/Resources/`, `?? Vault/Tasks/` (lub podobne). Jeśli wynik jest pusty, krok zerowy jest już zrobiony; przejdź do kroku 3.

- [ ] **Step 2: Zatwierdź zaimportowane pliki w repo NEXUS (po zgodzie użytkownika)**

```bash
git -C ../NEXUS add Vault/Notes Vault/Resources Vault/Tasks
git -C ../NEXUS commit -m "data: import notes, resources, tags, task templates from Firestore (stage 0b)"
git -C ../NEXUS status --short Vault/
```

Expected: ostatnia komenda nic nie wypisuje. Od tej chwili każdy zapis aplikacji jest widoczny w `git -C ../NEXUS diff` i odwracalny. **Aplikacja nie zapisuje do vaulta przed tym krokiem.**

- [ ] **Step 3: Załóż gałąź implementacji z gałęzi ze specem**

```bash
git switch docs/etap-0c-2-spec && git switch -c feat/etap-0c-2-tagi-szablony-zasoby
```

Expected: `Switched to a new branch 'feat/etap-0c-2-tagi-szablony-zasoby'`.

---

### Task 1: `yaml-store.ts` i helper testowy

**Files:**

- Create: `lib/nexus/yaml-store.ts`
- Create: `tests/unit/lib/nexus/repos/helpers.ts`
- Test: `tests/unit/lib/nexus/yaml-store.test.ts`

- [ ] **Step 1: Napisz helper testowy** (`tests/unit/lib/nexus/repos/helpers.ts`)

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

export type TempVault = {
  readonly root: string;
  write(rel: string, text: string): void;
  /** Treść pliku albo `null`, gdy nie istnieje. */
  read(rel: string): string | null;
};

/** Tymczasowy vault na czas jednego testu: ustawia NEXUS_VAULT_PATH i sprząta po teście. */
export function useTempVault(): TempVault {
  let tmp = "";
  let root = "";
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.NEXUS_VAULT_PATH;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-repo-"));
    root = path.join(tmp, "vault");
    fs.mkdirSync(root);
    process.env.NEXUS_VAULT_PATH = root;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.NEXUS_VAULT_PATH;
    else process.env.NEXUS_VAULT_PATH = previous;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  return {
    get root() {
      return root;
    },
    write(rel, text) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text, "utf8");
    },
    read(rel) {
      try {
        return fs.readFileSync(path.join(root, rel), "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
  };
}
```

- [ ] **Step 2: Napisz czerwony test** (`tests/unit/lib/nexus/yaml-store.test.ts`)

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ConflictError } from "@/lib/errors";
import { VaultConfigError } from "@/lib/nexus/vault-path";
import { formatYamlList } from "@/lib/nexus/yaml-lists";
import { readList, updateList } from "@/lib/nexus/yaml-store";
import { useTempVault } from "./repos/helpers";

const REL = "Resources/tags.yaml";
const vault = useTempVault();

describe("readList", () => {
  it("returns [] for a missing, empty and whitespace-only file", () => {
    expect(readList(REL, "tags")).toEqual([]);
    vault.write(REL, "");
    expect(readList(REL, "tags")).toEqual([]);
    vault.write(REL, "  \n\n");
    expect(readList(REL, "tags")).toEqual([]);
  });

  it("reads items from a file in the 0b format", () => {
    vault.write(REL, formatYamlList("tags", [{ id: "a", tag: "x" }], "import-to-vault"));
    expect(readList(REL, "tags")).toEqual([{ id: "a", tag: "x" }]);
  });

  it("names the file in the error for broken YAML", () => {
    vault.write(REL, "tags: [unclosed\n");
    expect(() => readList(REL, "tags")).toThrow(REL);
  });

  it("throws VaultConfigError when NEXUS_VAULT_PATH is unset", () => {
    delete process.env.NEXUS_VAULT_PATH;
    expect(() => readList(REL, "tags")).toThrow(VaultConfigError);
  });
});

describe("updateList", () => {
  it("creates the file with version 1 and without generated_by", async () => {
    expect(await updateList(REL, "tags", () => [{ id: "a" }])).toBe(true);
    const text = vault.read(REL)!;
    expect(text).toMatch(/^version: 1\n/);
    expect(text).not.toContain("generated_by");
    expect(readList(REL, "tags")).toEqual([{ id: "a" }]);
  });

  it("hands fn an empty list for a missing file", async () => {
    let seen: unknown;
    await updateList(REL, "tags", (items) => {
      seen = items;
      return items;
    });
    expect(seen).toEqual([]);
  });

  it("drops generated_by but keeps unknown keys and record order", async () => {
    const items = [{ id: "b", x_note: "ręcznie" }, { id: "a" }];
    vault.write(REL, formatYamlList("tags", items, "import-to-vault"));
    await updateList(REL, "tags", (list) => [...list, { id: "c" }]);
    expect(vault.read(REL)).toBe(formatYamlList("tags", [...items, { id: "c" }]));
  });

  it("does not create a file when fn returns null on a missing file", async () => {
    expect(await updateList(REL, "tags", () => null)).toBe(false);
    expect(vault.read(REL)).toBeNull();
  });

  it("leaves an existing file byte-identical when fn returns null", async () => {
    const text = formatYamlList("tags", [{ id: "a" }], "import-to-vault");
    vault.write(REL, text);
    expect(await updateList(REL, "tags", () => null)).toBe(false);
    expect(vault.read(REL)).toBe(text);
  });

  it("never overwrites an unparsable file", async () => {
    vault.write(REL, "tags: [unclosed\n");
    await expect(updateList(REL, "tags", () => [{ id: "a" }])).rejects.toThrow(REL);
    expect(vault.read(REL)).toBe("tags: [unclosed\n");
  });

  it("re-applies fn to fresh content after an external change", async () => {
    let calls = 0;
    await updateList(REL, "tags", (list) => {
      calls += 1;
      if (calls === 1) vault.write(REL, formatYamlList("tags", [{ id: "ext" }]));
      return [...list, { id: "new" }];
    });
    expect(calls).toBe(2);
    expect(readList(REL, "tags").map((r) => r.id)).toEqual(["ext", "new"]);
  });

  it("throws ConflictError when retries are exhausted", async () => {
    let calls = 0;
    await expect(
      updateList(
        REL,
        "tags",
        (list) => {
          calls += 1;
          vault.write(REL, `version: 1\ntags: []\n# zmiana ${calls}\n`);
          return [...list, { id: "x" }];
        },
        { retries: 1 }
      )
    ).rejects.toBeInstanceOf(ConflictError);
    expect(calls).toBe(2);
  });

  it("rejects with VaultConfigError when NEXUS_VAULT_PATH is unset", async () => {
    delete process.env.NEXUS_VAULT_PATH;
    await expect(updateList(REL, "tags", () => [])).rejects.toThrow(VaultConfigError);
  });
});
```

- [ ] **Step 3: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/nexus/yaml-store.test.ts`
Expected: FAIL (nie można zaimportować `@/lib/nexus/yaml-store`).

- [ ] **Step 4: Implementacja** (`lib/nexus/yaml-store.ts`)

```ts
import { readVaultFile, updateVaultFile, type VaultFsOptions } from "./vault-fs";
import { formatYamlList, parseYamlList, type YamlRecord } from "./yaml-lists";

/** Wartownik: `fn` nic nie zmieniło, więc `updateList` nie zapisuje pliku. */
class NoChange extends Error {}

/** Brak pliku, pusty tekst i same białe znaki to pusta lista (parser odrzuca `null`). */
function parseItems(text: string | null, rel: string, listKey: string): YamlRecord[] {
  if (text === null || text.trim() === "") return [];
  try {
    return parseYamlList(text, listKey).items;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Nie można odczytać pliku ${rel}: ${reason}`);
  }
}

export function readList(rel: string, listKey: string, opts?: VaultFsOptions): YamlRecord[] {
  return parseItems(readVaultFile(rel, opts)?.text ?? null, rel, listKey);
}

/**
 * Odczyt, zmiana listy i zapis przez `updateVaultFile` (ponawianie przy zmianie zewnętrznej:
 * `fn` jest wtedy wywoływane od nowa na świeżej liście). `fn` zwraca nową listę albo `null`,
 * gdy nic się nie zmieniło. Zwraca `true`, gdy plik zapisano.
 * Plik, który się nie parsuje, nigdy nie jest nadpisywany. Zapis nie dodaje `generated_by`.
 */
export async function updateList(
  rel: string,
  listKey: string,
  fn: (items: YamlRecord[]) => YamlRecord[] | null,
  opts: VaultFsOptions & { retries?: number } = {}
): Promise<boolean> {
  try {
    await updateVaultFile(
      rel,
      (current) => {
        const next = fn(parseItems(current, rel, listKey));
        if (next === null) throw new NoChange();
        return formatYamlList(listKey, next, undefined);
      },
      opts
    );
    return true;
  } catch (err) {
    if (err instanceof NoChange) return false;
    throw err;
  }
}
```

- [ ] **Step 5: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/lib/nexus/yaml-store.test.ts`
Expected: PASS (13 testów).

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/yaml-store.ts tests/unit/lib/nexus/yaml-store.test.ts tests/unit/lib/nexus/repos/helpers.ts
git commit -m "feat(nexus): add yaml-store for record lists in the vault"
```

---

### Task 2: `common.ts` i repozytorium tagów

**Files:**

- Create: `lib/nexus/repos/common.ts`
- Create: `lib/nexus/repos/tags.ts`
- Test: `tests/unit/lib/nexus/repos/tags.test.ts`

- [ ] **Step 1: Napisz czerwony test** (`tests/unit/lib/nexus/repos/tags.test.ts`)

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatYamlList, GENERATED_BY_IMPORT } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import { createUserTag, deleteUserTag, getUserTags, updateUserTag } from "@/lib/nexus/repos/tags";
import { useTempVault } from "./helpers";

const FILE = "Resources/tags.yaml";
const STORED = [
  {
    id: "tagA",
    tag: "Alpha",
    title: "Alfa",
    color: "#ff0000",
    created: "2026-03-02T10:00:00.000Z",
    x_note: "ręcznie",
  },
  { id: "tagB", tag: "Beta", title: "Beta title", created: "2026-03-01T10:00:00.000Z" },
];

const vault = useTempVault();
const seed = () => vault.write(FILE, formatYamlList("tags", STORED, GENERATED_BY_IMPORT));

describe("tags repository", () => {
  it("returns [] when the file does not exist", async () => {
    expect(await getUserTags("u1")).toEqual([]);
  });

  it("maps a 0b file and sorts ascending by created", async () => {
    seed();
    expect(await getUserTags("u1")).toEqual([
      { id: "tagB", tag: "Beta", title: "Beta title", created_at: "2026-03-01T10:00:00.000Z" },
      {
        id: "tagA",
        tag: "Alpha",
        title: "Alfa",
        color: "#ff0000",
        created_at: "2026-03-02T10:00:00.000Z",
      },
    ]);
  });

  it("breaks ties and missing dates by id", async () => {
    vault.write(
      FILE,
      formatYamlList("tags", [
        { id: "b", tag: "b", title: "b" },
        { id: "a", tag: "a", title: "a" },
      ])
    );
    expect((await getUserTags("u1")).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("creates a normalized tag, creating the file when missing", async () => {
    const tag = await createUserTag("u1", { tag: " #Gamma ", title: " Gamma title ", color: "  " });
    expect(tag.id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(tag).toMatchObject({ tag: "Gamma", title: "Gamma title" });
    expect(tag.color).toBeUndefined();
    expect(new Date(tag.created_at!).toISOString()).toBe(tag.created_at);
    const [stored] = readList(FILE, "tags");
    expect(Object.keys(stored)).toEqual(["id", "tag", "title", "created"]);
    expect(vault.read(FILE)).not.toContain("generated_by");
  });

  it("appends to existing records without losing them", async () => {
    seed();
    const tag = await createUserTag("u1", { tag: "Gamma", title: "G", color: " #00ff00 " });
    const stored = readList(FILE, "tags");
    expect(stored.slice(0, 2)).toEqual(STORED);
    expect(stored[2]).toMatchObject({ id: tag.id, color: "#00ff00" });
  });

  it("updates only the passed fields and keeps unknown keys and order", async () => {
    seed();
    await updateUserTag("u1", "tagA", { title: " Nowy " });
    expect(readList(FILE, "tags")).toEqual([{ ...STORED[0], title: "Nowy" }, STORED[1]]);
  });

  it("normalizes the tag on update", async () => {
    seed();
    await updateUserTag("u1", "tagB", { tag: "#Nowy" });
    expect(readList(FILE, "tags")[1]).toMatchObject({ tag: "Nowy" });
  });

  it("removes the color key instead of writing null", async () => {
    seed();
    await updateUserTag("u1", "tagA", { color: null });
    expect(readList(FILE, "tags")[0]).toEqual({
      id: "tagA",
      tag: "Alpha",
      title: "Alfa",
      created: "2026-03-02T10:00:00.000Z",
      x_note: "ręcznie",
    });
    expect(vault.read(FILE)).not.toContain("color: null");
  });

  it("rewriting with unchanged values differs from the original only by generated_by", async () => {
    seed();
    const before = vault.read(FILE)!;
    await updateUserTag("u1", "tagB", { title: "Beta title" });
    expect(vault.read(FILE)).toBe(before.replace("generated_by: import-to-vault\n", ""));
  });

  it("update of a missing id is a 404 and leaves the file untouched", async () => {
    seed();
    const before = vault.read(FILE);
    await expect(updateUserTag("u1", "nope", { title: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(vault.read(FILE)).toBe(before);
  });

  it("update with no fields does no I/O", async () => {
    await expect(updateUserTag("u1", "nope", {})).resolves.toBeUndefined();
    expect(vault.read(FILE)).toBeNull();
  });

  it("deletes a tag; deleting a missing id does not touch the file", async () => {
    seed();
    await deleteUserTag("u1", "tagA");
    expect(readList(FILE, "tags").map((r) => r.id)).toEqual(["tagB"]);
    const before = vault.read(FILE);
    await deleteUserTag("u1", "nope");
    expect(vault.read(FILE)).toBe(before);
  });

  it("round-trips special characters and YAML 1.1 words", async () => {
    const title = 'Tom & Jerry: "cytat" #hash — zażółć gęślą jaźń &apos;';
    const tag = await createUserTag("u1", { tag: "no", title });
    expect(await getUserTags("u1")).toEqual([
      expect.objectContaining({ id: tag.id, tag: "no", title }),
    ]);
  });
});
```

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/nexus/repos/tags.test.ts`
Expected: FAIL (brak `@/lib/nexus/repos/tags`).

- [ ] **Step 3: Implementacja `common.ts`** (`lib/nexus/repos/common.ts`)

```ts
import { randomInt } from "node:crypto";
import { DomainError } from "@/lib/errors";
import type { YamlRecord } from "../yaml-lists";
import { updateList } from "../yaml-store";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** 20 znaków alfanumerycznych (kształt jak id z Firestore), bez kolizji z `taken`. */
export function generateId(taken: ReadonlySet<string>): string {
  for (;;) {
    let id = "";
    for (let i = 0; i < 20; i += 1) id += ALPHABET[randomInt(ALPHABET.length)];
    if (!taken.has(id)) return id;
  }
}

export const nowIso = (): string => new Date().toISOString();

/** Wartość pola jako tekst (`null`/`undefined` → ""). */
export function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Przycięty tekst albo `undefined`, gdy pusty. */
export function optStr(value: unknown): string | undefined {
  const text = str(value).trim();
  return text === "" ? undefined : text;
}

function timeOf(iso: string | undefined): number {
  const time = Date.parse(iso ?? "");
  return Number.isNaN(time) ? 0 : time;
}

/** Sortuje kopię listy po dacie (brak daty = 0); remisy rosnąco po `id`. */
export function sortByCreated<T extends { id: string }>(
  list: readonly T[],
  created: (item: T) => string | undefined,
  direction: "asc" | "desc"
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const diff = timeOf(created(a)) - timeOf(created(b));
    if (diff !== 0) return sign * diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Nakłada `patch` na rekord; wartość `undefined` usuwa klucz. */
export function applyPatch(record: YamlRecord, patch: Record<string, unknown>): YamlRecord {
  const next: YamlRecord = { ...record };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next;
}

/** Dopisuje rekord zbudowany przez `build` (dostaje zajęte id) i zwraca go. */
export async function appendRecord(
  file: string,
  listKey: string,
  build: (takenIds: ReadonlySet<string>) => YamlRecord
): Promise<YamlRecord> {
  let created: YamlRecord | undefined;
  await updateList(file, listKey, (items) => {
    const record = build(new Set(items.map((r) => str(r.id))));
    created = record;
    return [...items, record];
  });
  return created as YamlRecord;
}

/** Nakłada `patch` na rekord o danym `id`; brak rekordu to `DomainError(404)`. */
export async function patchRecord(
  file: string,
  listKey: string,
  id: string,
  patch: Record<string, unknown>,
  notFoundMessage: string
): Promise<void> {
  await updateList(file, listKey, (items) => {
    const index = items.findIndex((r) => str(r.id) === id);
    if (index === -1) throw new DomainError(notFoundMessage, 404);
    const next = [...items];
    next[index] = applyPatch(items[index], patch);
    return next;
  });
}

/** Usuwa rekord o danym `id`; brak rekordu nie powoduje zapisu pliku. */
export async function removeRecord(file: string, listKey: string, id: string): Promise<void> {
  await updateList(file, listKey, (items) => {
    const next = items.filter((r) => str(r.id) !== id);
    return next.length === items.length ? null : next;
  });
}
```

- [ ] **Step 4: Implementacja repozytorium tagów** (`lib/nexus/repos/tags.ts`)

```ts
import type { UserTagRecord } from "@/types/records";
import type { YamlRecord } from "../yaml-lists";
import { readList } from "../yaml-store";
import {
  appendRecord,
  generateId,
  nowIso,
  optStr,
  patchRecord,
  removeRecord,
  sortByCreated,
  str,
} from "./common";

const FILE = "Resources/tags.yaml";
const KEY = "tags";

const normTag = (value: unknown): string => str(value).trim().replace(/^#/, "");
const normColor = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

function toTag(record: YamlRecord): UserTagRecord {
  return {
    id: str(record.id),
    tag: normTag(record.tag),
    title: str(record.title).trim(),
    color: optStr(record.color),
    created_at: optStr(record.created),
  };
}

export async function getUserTags(_userId: string): Promise<UserTagRecord[]> {
  return sortByCreated(readList(FILE, KEY).map(toTag), (t) => t.created_at, "asc");
}

export async function createUserTag(
  _userId: string,
  data: { tag: string; title: string; color?: string }
): Promise<UserTagRecord> {
  const color = normColor(data.color);
  const record = await appendRecord(FILE, KEY, (taken) => ({
    id: generateId(taken),
    tag: normTag(data.tag),
    title: str(data.title).trim(),
    ...(color ? { color } : {}),
    created: nowIso(),
  }));
  return toTag(record);
}

export async function updateUserTag(
  _userId: string,
  tagId: string,
  data: { tag?: string; title?: string; color?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.tag !== undefined) patch.tag = normTag(data.tag);
  if (data.title !== undefined) patch.title = str(data.title).trim();
  if (data.color !== undefined) patch.color = normColor(data.color); // undefined usuwa klucz
  if (Object.keys(patch).length === 0) return;
  await patchRecord(FILE, KEY, tagId, patch, "Tag not found");
}

export async function deleteUserTag(_userId: string, tagId: string): Promise<void> {
  await removeRecord(FILE, KEY, tagId);
}
```

- [ ] **Step 5: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/lib/nexus/repos/tags.test.ts`
Expected: PASS (13 testów).

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/repos/common.ts lib/nexus/repos/tags.ts tests/unit/lib/nexus/repos/tags.test.ts
git commit -m "feat(nexus): add vault-backed tags repository"
```

---

### Task 3: Repozytorium szablonów zadań

**Files:**

- Create: `lib/nexus/repos/taskTemplates.ts`
- Test: `tests/unit/lib/nexus/repos/taskTemplates.test.ts`

- [ ] **Step 1: Napisz czerwony test** (`tests/unit/lib/nexus/repos/taskTemplates.test.ts`)

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatYamlList, GENERATED_BY_IMPORT } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  createTaskTemplate,
  deleteTaskTemplate,
  getTaskTemplates,
  updateTaskTemplate,
} from "@/lib/nexus/repos/taskTemplates";
import { useTempVault } from "./helpers";

const FILE = "Tasks/templates.yaml";
const STORED = [
  {
    id: "tplA",
    label: "PR",
    title: "Sprawdzić PR",
    link: "https://example.com/pr",
    created: "2026-08-02T10:00:00.000Z",
    x_note: "ręcznie",
  },
  {
    id: "tplB",
    label: "Bug",
    title: "Zgłosić błąd",
    link: "",
    created: "2026-08-01T10:00:00.000Z",
  },
];

const vault = useTempVault();
const seed = () => vault.write(FILE, formatYamlList("templates", STORED, GENERATED_BY_IMPORT));

describe("task templates repository", () => {
  it("returns [] when the file does not exist", async () => {
    expect(await getTaskTemplates("u1")).toEqual([]);
  });

  it("maps a 0b file and sorts ascending by created", async () => {
    seed();
    expect(await getTaskTemplates("u1")).toEqual([
      {
        id: "tplB",
        label: "Bug",
        title: "Zgłosić błąd",
        link: "",
        created_at: "2026-08-01T10:00:00.000Z",
      },
      {
        id: "tplA",
        label: "PR",
        title: "Sprawdzić PR",
        link: "https://example.com/pr",
        created_at: "2026-08-02T10:00:00.000Z",
      },
    ]);
  });

  it("creates a trimmed template with an empty link by default, creating the file", async () => {
    const tpl = await createTaskTemplate("u1", { label: " Doc ", title: " Dokumentacja " });
    expect(tpl.id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(tpl).toMatchObject({ label: "Doc", title: "Dokumentacja", link: "" });
    const [stored] = readList(FILE, "templates");
    expect(Object.keys(stored)).toEqual(["id", "label", "title", "link", "created"]);
    expect(vault.read(FILE)).not.toContain("generated_by");
  });

  it("appends without losing existing records", async () => {
    seed();
    await createTaskTemplate("u1", { label: "Doc", title: "D", link: " https://x.dev " });
    const stored = readList(FILE, "templates");
    expect(stored.slice(0, 2)).toEqual(STORED);
    expect(stored[2]).toMatchObject({ link: "https://x.dev" });
  });

  it("updates only the passed fields and keeps unknown keys", async () => {
    seed();
    await updateTaskTemplate("u1", "tplA", { link: " https://new.dev " });
    expect(readList(FILE, "templates")).toEqual([
      { ...STORED[0], link: "https://new.dev" },
      STORED[1],
    ]);
  });

  it("update of a missing id is a 404 and leaves the file untouched", async () => {
    seed();
    const before = vault.read(FILE);
    await expect(updateTaskTemplate("u1", "nope", { label: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(vault.read(FILE)).toBe(before);
  });

  it("update with no fields does no I/O", async () => {
    await expect(updateTaskTemplate("u1", "nope", {})).resolves.toBeUndefined();
    expect(vault.read(FILE)).toBeNull();
  });

  it("deletes a template; deleting a missing id does not touch the file", async () => {
    seed();
    await deleteTaskTemplate("u1", "tplA");
    expect(readList(FILE, "templates").map((r) => r.id)).toEqual(["tplB"]);
    const before = vault.read(FILE);
    await deleteTaskTemplate("u1", "nope");
    expect(vault.read(FILE)).toBe(before);
  });

  it("round-trips special characters", async () => {
    const title = 'Sprawdź: "PR" #12 &apos; — zażółć gęślą jaźń';
    const tpl = await createTaskTemplate("u1", { label: "yes", title });
    expect(await getTaskTemplates("u1")).toEqual([
      expect.objectContaining({ id: tpl.id, label: "yes", title }),
    ]);
  });
});
```

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/nexus/repos/taskTemplates.test.ts`
Expected: FAIL (brak `@/lib/nexus/repos/taskTemplates`).

- [ ] **Step 3: Implementacja** (`lib/nexus/repos/taskTemplates.ts`)

```ts
import type { TaskTemplateRecord } from "@/types/records";
import type { YamlRecord } from "../yaml-lists";
import { readList } from "../yaml-store";
import {
  appendRecord,
  generateId,
  nowIso,
  optStr,
  patchRecord,
  removeRecord,
  sortByCreated,
  str,
} from "./common";

const FILE = "Tasks/templates.yaml";
const KEY = "templates";

const link = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function toTemplate(record: YamlRecord): TaskTemplateRecord {
  return {
    id: str(record.id),
    label: str(record.label).trim(),
    title: str(record.title).trim(),
    link: link(record.link),
    created_at: optStr(record.created),
  };
}

export async function getTaskTemplates(_userId: string): Promise<TaskTemplateRecord[]> {
  return sortByCreated(readList(FILE, KEY).map(toTemplate), (t) => t.created_at, "asc");
}

export async function createTaskTemplate(
  _userId: string,
  data: { label: string; title: string; link?: string }
): Promise<TaskTemplateRecord> {
  const record = await appendRecord(FILE, KEY, (taken) => ({
    id: generateId(taken),
    label: str(data.label).trim(),
    title: str(data.title).trim(),
    link: link(data.link),
    created: nowIso(),
  }));
  return toTemplate(record);
}

export async function updateTaskTemplate(
  _userId: string,
  templateId: string,
  data: { label?: string; title?: string; link?: string }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.label !== undefined) patch.label = str(data.label).trim();
  if (data.title !== undefined) patch.title = str(data.title).trim();
  if (data.link !== undefined) patch.link = link(data.link);
  if (Object.keys(patch).length === 0) return;
  await patchRecord(FILE, KEY, templateId, patch, "Template not found");
}

export async function deleteTaskTemplate(_userId: string, templateId: string): Promise<void> {
  await removeRecord(FILE, KEY, templateId);
}
```

- [ ] **Step 4: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/lib/nexus/repos/taskTemplates.test.ts`
Expected: PASS (9 testów).

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/repos/taskTemplates.ts tests/unit/lib/nexus/repos/taskTemplates.test.ts
git commit -m "feat(nexus): add vault-backed task templates repository"
```

---

### Task 4: Typy ISO i repozytorium zasobów

**Files:**

- Modify: `types/records.ts` (`NoteResourceRecord`, `UserTagRecord`, `TaskTemplateRecord`)
- Modify: `tests/unit/components/resources/ResourceListItem.test.tsx` (funkcja `mockResource`)
- Create: `lib/nexus/repos/resources.ts`
- Test: `tests/unit/lib/nexus/repos/resources.test.ts`

Uwaga: po zmianie typów `tsc` jest czerwony do końca Zadania 5 (stary `lib/firestore/resources.ts` rzutuje na `Timestamp`). To oczekiwane; `tsc` uruchamiamy w Zadaniu 7.

- [ ] **Step 1: Zmień typy w `types/records.ts`**

W `NoteResourceRecord` zamień

```ts
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

na

```ts
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}
```

W `UserTagRecord` i `TaskTemplateRecord` usuń linię `createdAt?: Timestamp;` (zostaje `created_at?: string;`). Import `Timestamp` na górze pliku zostaje (używają go pozostałe typy do końca 0c-4).

- [ ] **Step 2: Popraw `mockResource` w `ResourceListItem.test.tsx`**

Usuń dwie linie z obiektu zwracanego przez `mockResource`:

```ts
    createdAt: null,
    updatedAt: null,
```

- [ ] **Step 3: Napisz czerwony test** (`tests/unit/lib/nexus/repos/resources.test.ts`)

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatYamlList, GENERATED_BY_IMPORT, parseYamlList } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  addResourceToFirestore,
  deleteResourceFromFirestore,
  getResourcesFromFirestore,
  updateResourceInFirestore,
} from "@/lib/nexus/repos/resources";
import { useTempVault } from "./helpers";

const FILE = "Resources/resources.yaml";
const STORED = [
  {
    id: "resA",
    title: "Strona A",
    url: "https://a.example.com",
    description: "Opis A",
    tags: ["Backend", "Cloud"],
    favorite: true,
    thumbnail_url: "https://a.example.com/t.png",
    note_id: "note-1",
    created: "2026-03-01T10:00:00.000Z",
    updated: "2026-03-02T10:00:00.000Z",
    x_note: "ręcznie",
  },
  {
    id: "resB",
    title: "Strona B",
    url: "https://b.example.com",
    description: "Opis B",
    tags: [],
    favorite: false,
    created: "2026-03-05T10:00:00.000Z",
    updated: "2026-03-05T10:00:00.000Z",
  },
];

const vault = useTempVault();
const seed = () => vault.write(FILE, formatYamlList("resources", STORED, GENERATED_BY_IMPORT));

describe("resources repository", () => {
  it("returns [] when the file does not exist", async () => {
    expect(await getResourcesFromFirestore("u1")).toEqual([]);
  });

  it("maps a 0b file, adds userId and sorts descending by createdAt", async () => {
    seed();
    expect(await getResourcesFromFirestore("u1")).toEqual([
      {
        id: "resB",
        userId: "u1",
        title: "Strona B",
        url: "https://b.example.com",
        description: "Opis B",
        tags: [],
        isFavorite: false,
        createdAt: "2026-03-05T10:00:00.000Z",
        updatedAt: "2026-03-05T10:00:00.000Z",
      },
      {
        id: "resA",
        userId: "u1",
        noteId: "note-1",
        title: "Strona A",
        url: "https://a.example.com",
        description: "Opis A",
        thumbnailUrl: "https://a.example.com/t.png",
        tags: ["Backend", "Cloud"],
        isFavorite: true,
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-02T10:00:00.000Z",
      },
    ]);
  });

  it("breaks ties by id ascending", async () => {
    vault.write(
      FILE,
      formatYamlList("resources", [
        { id: "b", title: "b", url: "u", description: "d", tags: [], favorite: false },
        { id: "a", title: "a", url: "u", description: "d", tags: [], favorite: false },
      ])
    );
    expect((await getResourcesFromFirestore("u1")).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("creates a resource with defaults and the 0b key order", async () => {
    const res = await addResourceToFirestore("u1", {
      userId: "u1",
      title: "Nowa",
      url: "https://n.example.com",
      description: "Opis",
      tags: [],
      thumbnailUrl: "https://n.example.com/t.png",
    });
    expect(res.id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(res).toMatchObject({ userId: "u1", isFavorite: false, tags: [] });
    expect(res.noteId).toBeUndefined();
    expect(res.createdAt).toBe(res.updatedAt);
    expect(new Date(res.createdAt!).toISOString()).toBe(res.createdAt);
    const [stored] = readList(FILE, "resources");
    expect(Object.keys(stored)).toEqual([
      "id",
      "title",
      "url",
      "description",
      "tags",
      "favorite",
      "thumbnail_url",
      "created",
      "updated",
    ]);
    expect(vault.read(FILE)).toContain("favorite: false");
    expect(vault.read(FILE)).toContain("tags: []");
    expect(vault.read(FILE)).not.toContain("generated_by");
  });

  it("stores note_id only when given and appends after existing records", async () => {
    seed();
    const res = await addResourceToFirestore("u1", {
      userId: "u1",
      title: "T",
      url: "u",
      description: "d",
      tags: ["x"],
      isFavorite: true,
      noteId: "note-9",
    });
    const stored = readList(FILE, "resources");
    expect(stored.slice(0, 2)).toEqual(STORED);
    expect(stored[2]).toMatchObject({ id: res.id, note_id: "note-9", favorite: true });
    expect(stored[2]).not.toHaveProperty("thumbnail_url");
  });

  it("updates only the passed fields, trims text and bumps updated", async () => {
    seed();
    await updateResourceInFirestore("u1", "resA", { title: " Nowy tytuł ", isFavorite: false });
    const [a, b] = readList(FILE, "resources");
    expect(a).toMatchObject({
      ...STORED[0],
      title: "Nowy tytuł",
      favorite: false,
      updated: expect.any(String),
    });
    expect(a.updated).not.toBe(STORED[0].updated);
    expect(Number.isNaN(Date.parse(String(a.updated)))).toBe(false);
    expect(a.created).toBe(STORED[0].created);
    expect(b).toEqual(STORED[1]);
  });

  it("update of a missing id is a 404 and leaves the file untouched", async () => {
    seed();
    const before = vault.read(FILE);
    await expect(updateResourceInFirestore("u1", "nope", { title: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(vault.read(FILE)).toBe(before);
  });

  it("deletes a resource; deleting a missing id does not touch the file", async () => {
    seed();
    await deleteResourceFromFirestore("u1", "resA");
    expect(readList(FILE, "resources").map((r) => r.id)).toEqual(["resB"]);
    const before = vault.read(FILE);
    await deleteResourceFromFirestore("u1", "nope");
    expect(vault.read(FILE)).toBe(before);
  });

  it("round-trips special characters and YAML 1.1 words as text", async () => {
    const title = 'Google&apos;s: "app" #1 — zażółć gęślą jaźń';
    const tags = ["yes", "no", "on", "off", "123"];
    const res = await addResourceToFirestore("u1", {
      userId: "u1",
      title,
      url: "https://x.dev",
      description: "yes",
      tags,
    });
    const [read] = await getResourcesFromFirestore("u1");
    expect(read).toMatchObject({ id: res.id, title, description: "yes", tags });
    expect(vault.read(FILE)).not.toMatch(/- yes\n/);
  });

  it("reads a hand-written unquoted favorite: yes as text, not as true", async () => {
    vault.write(
      FILE,
      "version: 1\nresources:\n  - id: h1\n    title: t\n    url: u\n    description: d\n    tags: []\n    favorite: yes\n"
    );
    expect((await getResourcesFromFirestore("u1"))[0].isFavorite).toBe(false);
    await updateResourceInFirestore("u1", "h1", { title: "t2" });
    const item = parseYamlList(vault.read(FILE)!, "resources").items[0];
    expect(item.favorite).toBe("yes");
  });
});
```

- [ ] **Step 4: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/nexus/repos/resources.test.ts`
Expected: FAIL (brak `@/lib/nexus/repos/resources`).

- [ ] **Step 5: Implementacja** (`lib/nexus/repos/resources.ts`)

```ts
import type { NoteResourceRecord } from "@/types/records";
import type { YamlRecord } from "../yaml-lists";
import { readList } from "../yaml-store";
import {
  appendRecord,
  generateId,
  nowIso,
  optStr,
  patchRecord,
  removeRecord,
  sortByCreated,
  str,
} from "./common";

const FILE = "Resources/resources.yaml";
const KEY = "resources";

function toResource(record: YamlRecord, userId: string): NoteResourceRecord {
  return {
    id: str(record.id),
    noteId: optStr(record.note_id),
    userId,
    description: str(record.description),
    url: str(record.url),
    title: str(record.title),
    thumbnailUrl: optStr(record.thumbnail_url),
    tags: Array.isArray(record.tags) ? record.tags.map((t) => str(t)) : [],
    isFavorite: record.favorite === true,
    createdAt: optStr(record.created),
    updatedAt: optStr(record.updated),
  };
}

export async function addResourceToFirestore(
  userId: string,
  data: Omit<NoteResourceRecord, "id" | "createdAt" | "updatedAt">
): Promise<NoteResourceRecord> {
  const now = nowIso();
  const record = await appendRecord(FILE, KEY, (taken) => ({
    id: generateId(taken),
    title: data.title,
    url: data.url,
    description: data.description,
    tags: data.tags ?? [],
    favorite: data.isFavorite ?? false,
    ...(data.thumbnailUrl != null ? { thumbnail_url: data.thumbnailUrl } : {}),
    ...(data.noteId != null ? { note_id: data.noteId } : {}),
    created: now,
    updated: now,
  }));
  return toResource(record, userId);
}

export async function getResourcesFromFirestore(userId: string): Promise<NoteResourceRecord[]> {
  const list = readList(FILE, KEY).map((record) => toResource(record, userId));
  return sortByCreated(list, (r) => r.createdAt, "desc");
}

export async function deleteResourceFromFirestore(
  _userId: string,
  resourceId: string
): Promise<void> {
  await removeRecord(FILE, KEY, resourceId);
}

export async function updateResourceInFirestore(
  _userId: string,
  resourceId: string,
  data: {
    title?: string;
    description?: string;
    url?: string;
    tags?: string[];
    isFavorite?: boolean;
  }
): Promise<void> {
  const patch: Record<string, unknown> = { updated: nowIso() };
  if (data.title !== undefined) patch.title = data.title.trim();
  if (data.description !== undefined) patch.description = data.description.trim();
  if (data.url !== undefined) patch.url = data.url.trim();
  if (data.tags !== undefined) patch.tags = Array.isArray(data.tags) ? data.tags : [];
  if (data.isFavorite !== undefined) patch.favorite = data.isFavorite;
  await patchRecord(FILE, KEY, resourceId, patch, "Resource not found");
}
```

- [ ] **Step 6: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/lib/nexus/repos/resources.test.ts`
Expected: PASS (10 testów).

- [ ] **Step 7: Commit**

```bash
git add types/records.ts tests/unit/components/resources/ResourceListItem.test.tsx lib/nexus/repos/resources.ts tests/unit/lib/nexus/repos/resources.test.ts
git commit -m "feat(nexus): add vault-backed resources repository; ISO time in tag, template and resource types"
```

---

### Task 5: Przepięcie barrela i usunięcie kodu Firestore

**Files:**

- Modify: `lib/firestore-db.ts`
- Modify: `lib/firestore/collections.ts`
- Delete: `lib/firestore/tags.ts`, `lib/firestore/taskTemplates.ts`, `lib/firestore/resources.ts`
- Test: `tests/unit/lib/nexus/repos-static.test.ts`

- [ ] **Step 1: Napisz czerwony test statyczny** (`tests/unit/lib/nexus/repos-static.test.ts`)

```ts
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const STORE = "lib/nexus/yaml-store.ts";
const REPOS = ["common", "tags", "taskTemplates", "resources"].map(
  (name) => `lib/nexus/repos/${name}.ts`
);
const FILES = [STORE, ...REPOS];

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

function hits(pattern: RegExp, files: string[] = FILES): string[] {
  const out: string[] = [];
  const global = new RegExp(pattern.source, pattern.flags.replace("g", "") + "g");
  for (const rel of files) {
    const text = read(rel);
    for (const m of text.matchAll(global))
      out.push(`${rel}:${lineOf(text, m.index ?? 0)} (${m[0]})`);
  }
  return out;
}

describe("0c-2 static guards", () => {
  it("scans existing sources", () => {
    for (const rel of FILES) expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
  });

  it("has no firebase, direct fs access, process.env or file mutations", () => {
    expect(hits(/firebase/i)).toEqual([]);
    expect(hits(/from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(\s*["'](?:node:)?fs/)).toEqual(
      []
    );
    expect(hits(/process\.env/)).toEqual([]);
    expect(
      hits(/writeFileSync|renameSync|rmSync|mkdirSync|appendFileSync|unlinkSync|createWriteStream/)
    ).toEqual([]);
  });

  it("writes only through yaml-store: repositories do not import vault-fs", () => {
    expect(hits(/vault-fs/, REPOS)).toEqual([]);
  });

  it("old Firestore repositories and collection helpers are gone", () => {
    for (const name of ["tags", "taskTemplates", "resources"]) {
      expect(fs.existsSync(path.join(ROOT, `lib/firestore/${name}.ts`)), name).toBe(false);
    }
    expect(read("lib/firestore/collections.ts")).not.toMatch(
      /userTagsCol|taskTemplatesCol|userResourcesCol/
    );
  });

  it("the barrel points the three groups at lib/nexus/repos", () => {
    const barrel = read("lib/firestore-db.ts");
    expect(barrel).not.toMatch(/lib\/firestore\/(tags|taskTemplates|resources)/);
    for (const name of ["tags", "taskTemplates", "resources"]) {
      expect(barrel).toContain(`@/lib/nexus/repos/${name}`);
    }
  });
});
```

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/nexus/repos-static.test.ts`
Expected: FAIL w testach „old Firestore repositories…” i „the barrel points…”; pozostałe zielone.

- [ ] **Step 3: Sprawdź, że nic poza barrelem nie importuje starych plików**

Run: `grep -rnE "lib/firestore/(tags|taskTemplates|resources)|from \"\./(tags|taskTemplates|resources)\"" --include=*.ts --include=*.tsx . --exclude-dir=node_modules --exclude-dir=.next`
Expected: wyłącznie trzy wiersze w `lib/firestore-db.ts` (oraz ewentualnie sam nowy test statyczny). Jeśli jest coś innego, przepnij to na `@/lib/firestore-db` przed dalszymi krokami.

- [ ] **Step 4: Przestaw barrel** (`lib/firestore-db.ts`): zamień ścieżki trzech eksportów

```ts
} from "@/lib/firestore/resources";
```

na `} from "@/lib/nexus/repos/resources";`, oraz

```ts
export { getUserTags, createUserTag, updateUserTag, deleteUserTag } from "@/lib/firestore/tags";
```

na

```ts
export { getUserTags, createUserTag, updateUserTag, deleteUserTag } from "@/lib/nexus/repos/tags";
```

oraz `} from "@/lib/firestore/taskTemplates";` na `} from "@/lib/nexus/repos/taskTemplates";`. Nazwy eksportowanych funkcji zostają bez zmian.

- [ ] **Step 5: Usuń stare pliki i helpery**

```bash
git rm lib/firestore/tags.ts lib/firestore/taskTemplates.ts lib/firestore/resources.ts
```

W `lib/firestore/collections.ts` usuń trzy funkcje w całości: `userResourcesCol`, `userTagsCol`, `taskTemplatesCol` (każda to blok `export function … { return userCollection(userId, "…"); }` wraz z pustą linią obok).

- [ ] **Step 6: Uruchom test statyczny i testy usług**

Run: `npx vitest run tests/unit/lib/nexus tests/unit/services/tagService.test.ts tests/unit/services/taskTemplateService.test.ts tests/unit/services/resourceService.test.ts`
Expected: PASS. Usługi mockują `lib/firestore-db`, więc nie zmieniają się.

- [ ] **Step 7: Commit**

```bash
git add lib/firestore-db.ts lib/firestore/collections.ts tests/unit/lib/nexus/repos-static.test.ts
git commit -m "refactor(firestore): serve tags, task templates and resources from the vault"
```

(`git rm` z kroku 5 jest już w indeksie.)

---

### Task 6: Test charakteryzujący `VaultConfigError` (P1)

**Files:**

- Modify: `tests/unit/lib/apiError.test.ts`

Bez zmiany kodu: `handleServiceError` obsługuje `VaultConfigError` w gałęzi końcowej (500 + `err.message`). To test charakteryzujący, więc od razu zielony.

- [ ] **Step 1: Dopisz import i test**

Pod ostatnim importem dodaj:

```ts
import { VaultConfigError } from "../../../lib/nexus/vault-path.js";
```

Wewnątrz `describe("lib/apiError", …)` dopisz:

```ts
it("maps VaultConfigError to 500 with its readable message", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const res = handleServiceError(
    new VaultConfigError("Brak vaulta: ustaw NEXUS_VAULT_PATH na bezwzględną ścieżkę.")
  );
  expect(res.status).toBe(500);
  expect(String((await res.json()).error)).toContain("NEXUS_VAULT_PATH");
});
```

- [ ] **Step 2: Uruchom**

Run: `npx vitest run tests/unit/lib/apiError.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/lib/apiError.test.ts
git commit -m "test(apiError): pin VaultConfigError mapping to 500 with readable message"
```

---

### Task 7: Weryfikacja zbiorcza (`cursor`) i review (`agy`)

**Files:** brak zmian (poprawki tylko, gdy coś wyjdzie).

- [ ] **Step 1: Typecheck, lint, pełny vitest przez `cursor`**

```bash
scripts/ask-helper.sh --role task --tier light --fresh cursor "W katalogu repo uruchom po kolei: (1) npx tsc --noEmit, (2) npm run lint, (3) npx vitest run. Nic nie edytuj. Odpowiedz: 'przeszło' albo lista plik:linia + przyczyna dla każdego błędu. Przy testach podaj nazwy nieprzechodzących."
```

Expected: „przeszło”. Typowe poprawki, gdyby `tsc` coś znalazł: komponent czytający `createdAt` zasobu jako `Timestamp` (spec twierdzi, że nie ma takich), literał `NoteResource` z `createdAt: null` w innym teście. Napraw ręcznie, uruchom ponownie.

- [ ] **Step 2: Sprawdź zakres zmian**

Run: `git diff --stat main...HEAD`
Expected: tylko pliki z tabeli „Struktura plików”. Żaden plik w `scripts/import-to-vault/` nie jest zmieniony.

- [ ] **Step 3 (opcjonalnie): niezależny review diffa przez `agy`**

```bash
scripts/ask-helper.sh --role review agy "Zrób review diffa 'git diff main...HEAD' w tym repo (tylko odczyt). Kontekst: zapisy tagów, szablonów i zasobów przeniesione z Firestore do plików YAML w vaulcie (lib/nexus/yaml-store.ts, lib/nexus/repos/*). Szukaj: utraty danych przy zapisie (nieznane klucze, kolejność, pola opcjonalne), wyścigów, błędów w ponawianiu updateList, różnic zachowania względem usuniętych lib/firestore/{tags,taskTemplates,resources}.ts (git show main:lib/firestore/tags.ts itd.). Odpowiedź: lista plik:linia + problem + dlaczego, bez pochwał."
```

Opinie traktuj jak hipotezy: zweryfikuj w kodzie, zanim cokolwiek zmienisz.

---

### Task 8: Ręczny przegląd UI

**Files:** brak.

Wymaga `NEXUS_VAULT_PATH` w `.env.local` (jest ustawione) i zaimportowanych plików z 0b w vaulcie (krok zerowy zrobiony).

- [ ] **Step 1: Uruchom aplikację**

Run: `npm run dev`

- [ ] **Step 2: Przejdź listę kontrolną** (zaloguj się jak zwykle, auth zostaje na Firebase)

- Tagi: widać 8 tagów; dodaj, zmień nazwę i kolor, usuń kolor, usuń tag; odśwież stronę po każdej operacji.
- Szablony zadań: widać 1 szablon; dodaj, edytuj, usuń; użyj szablonu przy tworzeniu zadania.
- Zasoby: widać 73 zasoby (najnowsze na górze); dodaj zasób, edytuj, przełącz ulubiony, usuń; odśwież.
- Po przeglądzie: `git -C ../NEXUS diff --stat Vault/Resources Vault/Tasks` pokazuje tylko oczekiwane zmiany; w plikach nie ma `generated_by`, `color: null` ani pola `userId`. Pamiętaj, że przegląd zmienił prawdziwe dane: zmiany testowe cofnij (`git -C ../NEXUS restore Vault/Resources Vault/Tasks`) albo zatwierdź świadomie.

Expected: bez regresji względem wersji na Firestore.

---

### Task 9: Dokumentacja formatu, spec, PR

**Files:**

- Create: `docs/nexus-vault-formaty-yaml.md`
- Modify: `docs/superpowers/specs/2026-11-12-etap-0c-2-tagi-szablony-zasoby-design.md`

- [ ] **Step 1: Napisz dokumentację formatu** (`docs/nexus-vault-formaty-yaml.md`)

```markdown
# Format plików YAML w vaulcie (tagi, szablony zadań, zasoby)

Aplikacja czyta i zapisuje trzy pliki w `NEXUS/Vault/` (ścieżka z `NEXUS_VAULT_PATH`). Kod: `lib/nexus/yaml-store.ts`, `lib/nexus/repos/`.

| Plik                       | Klucz listy | Pola rekordu (kolejność)                                                                                      |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `Resources/tags.yaml`      | `tags`      | `id`, `tag`, `title`, `color` (opcjonalne), `created`                                                         |
| `Tasks/templates.yaml`     | `templates` | `id`, `label`, `title`, `link`, `created`                                                                     |
| `Resources/resources.yaml` | `resources` | `id`, `title`, `url`, `description`, `tags`, `favorite`, `thumbnail_url`\*, `note_id`\*, `created`, `updated` |

\* opcjonalne: klucz jest pomijany, gdy brak wartości (nigdy `null`).

Struktura pliku: `version: 1`, lista rekordów pod kluczem. Czas to tekst ISO 8601 (UTC). `id`: 20 znaków alfanumerycznych.

## Zasady zapisu

- Aplikacja zapisuje atomowo i tylko wtedy, gdy plik nie zmienił się od odczytu (inaczej ponawia; po wyczerpaniu ponowień błąd 409).
- Nieznane klucze w rekordach i kolejność rekordów przeżywają zapis. **Komentarze YAML giną.**
- Po pierwszym zapisie aplikacji znika `generated_by`, więc ponowny import 0b zapisze pliki obok zamiast je nadpisać.
- Plik, który się nie parsuje, nie jest nadpisywany; operacja kończy się błędem z nazwą pliku.
- Odczyt jest posortowany niezależnie od kolejności w pliku: tagi i szablony rosnąco po `created`, zasoby malejąco po `created`; remisy po `id`.
- `userId` nie jest zapisywany (jedno-użytkownikowy vault do etapu 0d).
- Ręcznie wpisane `favorite: yes` jest czytane jako tekst (YAML 1.2), czyli nie jako „ulubiony”. Używaj `true`/`false`.
```

- [ ] **Step 2: Zaktualizuj spec 0c-2**

W nagłówku zmień `Status: projekt zatwierdzony w brainstormie; plan i implementacja jeszcze nie rozpoczęte` na `Status: zaimplementowany (plan: docs/superpowers/plans/2026-11-12-etap-0c-2-tagi-szablony-zasoby.md)`. W §8 dopisz rozstrzygnięcia: **P1** — `VaultConfigError` wychodzi z `handleServiceError` jako HTTP 500 z czytelnym komunikatem (test w `tests/unit/lib/apiError.test.ts`), bez zmian kodu; **P2** — `createdAt`/`updatedAt` w `NoteResourceRecord` są opcjonalne (`string`). W §3.2 dopisz zdanie: „Pominięcie zapisu realizuje wyjątek-wartownik w `mutate`, nie bajtowo identyczna treść.”

- [ ] **Step 3: Commit**

```bash
git add docs/nexus-vault-formaty-yaml.md docs/superpowers/specs/2026-11-12-etap-0c-2-tagi-szablony-zasoby-design.md
git commit -m "docs: document vault YAML formats; mark 0c-2 implemented"
```

- [ ] **Step 4: Wyłącz auto-deploy z Git na Vercelu PRZED mergem (człowiek)**

Po mergu `main` wymaga `NEXUS_VAULT_PATH`, a Vercel go nie ma (nadrzędny spec 0c §7). W panelu Vercela: Project → Settings → Git → wyłącz automatyczne wdrożenia z `main`. Podgląd PR na Vercelu nie ma dostępu do vaulta; tagi, szablony i zasoby w nim nie zadziałają (oczekiwane).

- [ ] **Step 5: Wypchnij gałąź i otwórz PR (po zgodzie użytkownika)**

```bash
git push -u origin feat/etap-0c-2-tagi-szablony-zasoby
gh pr create --base main --title "feat(nexus): tags, task templates and resources in the vault (0c-2)" --body "Przepina tagi, szablony zadań i zasoby z Firestore na pliki YAML w vaulcie. Spec: docs/superpowers/specs/2026-11-12-etap-0c-2-tagi-szablony-zasoby-design.md. Merge zwykłym merge commitem, po wyłączeniu auto-deployu na Vercelu."
```

Expected: URL PR. Merge: zwykły merge commit.

---

## Kryteria ukończenia (ze speca §6)

- `tsc`, lint i testy przechodzą; test statyczny (`repos-static.test.ts`) zielony (Zadanie 7).
- Ręczny przegląd UI bez regresji; 8 tagów, 1 szablon, 73 zasoby widoczne (Zadanie 8).
- Trzy pliki w `lib/firestore/` usunięte, helpery `*Col` usunięte z `collections.ts` (Zadanie 5).
- Format opisany w dokumentacji; commity na osobnej gałęzi, PR do `main` (Zadanie 9).
