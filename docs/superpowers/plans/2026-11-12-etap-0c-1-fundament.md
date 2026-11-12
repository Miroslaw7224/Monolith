# Etap 0c-1: fundament warstwy plikowej i domknięcie szwu — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać do `lib/nexus/` fundament zapisu do vaulta (`vault-path`, `vault-fs`, `ConflictError`) i domknąć szew `lib/firestore-db.ts` dla map myśli i tablicy, bez zmiany zachowania aplikacji (nadal Firestore).

**Architecture:** `vault-fs` daje odczyt z wersją (skrót treści), zapis atomowy i `updateVaultFile` (odczyt, zmiana, zapis z ponowieniem przy zmianie zewnętrznej). Mapy myśli i tablica dostają funkcje repozytoryjne w `lib/firestore/` wystawione przez barrel; serwisy tracą importy `firebase-admin`; pola czasu map myśli stają się tekstem ISO. Nic w aplikacji jeszcze nie czyta z vaulta.

**Tech Stack:** TypeScript, Next.js 14, Vitest (`// @vitest-environment node` dla testów plikowych), `node:fs`, `yaml` (już w projekcie).

Spec: `docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md` (§3, §5 0c-1). Zasady wykonania: TDD (czerwony test, zielony test), commity po każdym zadaniu, testy/lint/typecheck deleguj do `cursor` (CLAUDE.md).

## Odstępstwa od speca (zatwierdzone w tym planie, spec zaktualizowany w Zadaniu 0)

1. **`markdown-edit.ts` przesunięty do 0c-3**, `append` w `vault-fs` do 0c-4: w 0c-1 nikt by ich nie używał (YAGNI), a pierwszy konsument najlepiej wyznaczy ich kształt.
2. **Czas jako ISO w typach tylko dla map myśli** (`MindMap`). Pozostałe kolekcje zmieniają pola czasu przy własnym przepięciu w 0c-2…0c-4; globalna zmiana typów w 0c-1 zepsułaby `tsc` w siedmiu starych repozytoriach (uwaga z review). `Timestamp` znika z `types/records.ts` po 0c-4.
3. **`scripts/import-to-vault/write.ts` zostaje nietknięty.** Jego testy statyczne wymagają `rmSync`/`rename`/`writeFileSync` wyłącznie w tym pliku. `vault-fs` ma więc własną, krótką implementację `resolveInsideVault` i zapisu atomowego (świadome powtórzenie ok. 40 linii).

## Struktura plików

| Plik                                                     | Akcja       | Odpowiedzialność                                                      |
| -------------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `lib/errors.ts`                                          | modyfikacja | dodać `ConflictError` (409)                                           |
| `lib/nexus/vault-path.ts`                                | nowy        | `NEXUS_VAULT_PATH` → ścieżka bezwzględna, mapowanie `E:\` ↔ `/mnt/e/` |
| `lib/nexus/vault-fs.ts`                                  | nowy        | odczyt z wersją, zapis atomowy, `updateVaultFile`, ochrona ścieżek    |
| `lib/firestore/time.ts`                                  | nowy        | `toIso(value)`: Timestamp/Date/tekst/liczba → ISO                     |
| `lib/firestore/mindMaps.ts`                              | nowy        | repozytorium map myśli (Firestore)                                    |
| `lib/firestore/board.ts`                                 | nowy        | repozytorium tablicy (Firestore)                                      |
| `lib/firestore/collections.ts`                           | bez zmian   | `mindMapsCol`, `boardDoc` zostają, ale tylko dla repozytoriów         |
| `lib/firestore-db.ts`                                    | modyfikacja | usunąć eksport `mindMapsCol`/`boardDoc`, dodać funkcje repozytoryjne  |
| `types/records.ts`                                       | modyfikacja | `MindMap.createdAt/updatedAt` → `string` (opcjonalne), typ `BoardDoc` |
| `services/mindMapService.ts`, `services/boardService.ts` | modyfikacja | tylko logika domenowa, bez `firebase-admin`                           |
| `.env.example`                                           | modyfikacja | wpis `NEXUS_VAULT_PATH`                                               |
| `tests/unit/lib/errors.test.ts`                          | modyfikacja | przypadki `ConflictError`                                             |
| `tests/unit/lib/nexus/vault-path.test.ts`                | nowy        | testy mapowania ścieżek                                               |
| `tests/unit/lib/nexus/vault-fs.test.ts`                  | nowy        | testy odczytu/zapisu/konfliktów                                       |
| `tests/unit/lib/nexus/static.test.ts`                    | nowy        | testy statyczne dla `lib/nexus/vault-*`                               |
| `tests/unit/lib/firestore/time.test.ts`                  | nowy        | testy `toIso`                                                         |
| `tests/unit/services/mindMapService.test.ts`             | przepisany  | mock `firestore-db` zamiast SDK                                       |
| `tests/unit/services/boardService.test.ts`               | przepisany  | mock `firestore-db` zamiast SDK                                       |

---

### Task 0: Gałąź i aktualizacja speca

**Files:**

- Modify: `docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md` (§5, wiersz 0c-1; §3.1)

- [ ] **Step 1: Załóż gałąź implementacji z gałęzi ze specem**

```bash
git switch docs/etap-0c-spec && git switch -c feat/etap-0c-1-fundament
```

Expected: `Switched to a new branch 'feat/etap-0c-1-fundament'`.

- [ ] **Step 2: Zaktualizuj wiersz 0c-1 i §3.1 w specu**

W tabeli §5, wiersz 0c-1: zamień `Fundament: `vault-path`, `vault-fs`, `markdown-edit`;` na `Fundament: `vault-path`, `vault-fs`(bez`append`), `ConflictError`;` oraz `czas jako ISO w typach, a stare repozytoria Firestore mapują `Timestamp`na ISO na swojej granicy (inaczej`tsc`pęka, np.`lib/firestore/resources.ts`)` na `czas jako ISO w typie `MindMap` (pozostałe kolekcje zmieniają typy czasu przy własnym przepięciu)`. W §3.1 przy `markdown-edit.ts` dopisz `(powstaje w 0c-3)`; w §3.2 przy `append` dopisz `(powstaje w 0c-4)`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md
git commit -m "docs: narrow stage 0c-1 scope (markdown-edit, append, ISO types)"
```

---

### Task 1: `ConflictError`

**Files:**

- Modify: `lib/errors.ts`
- Test: `tests/unit/lib/errors.test.ts`

- [ ] **Step 1: Dopisz czerwony test** (na końcu pliku, w nowym `describe`)

```ts
import { ConflictError } from "../../../lib/errors.js";

describe("ConflictError", () => {
  it("is a DomainError with name ConflictError and statusCode 409", () => {
    const err = new ConflictError("File changed");
    expect(err).toBeInstanceOf(DomainError);
    expect(err.name).toBe("ConflictError");
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe("File changed");
  });
});
```

(Import dołącz do istniejącej linii importu z `lib/errors.js`, jeśli plik ma już taki import.)

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/errors.test.ts`
Expected: FAIL (`ConflictError` nie jest wyeksportowane).

- [ ] **Step 3: Implementacja** (dopisz do `lib/errors.ts`)

```ts
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409);
    this.name = "ConflictError";
  }
}
```

- [ ] **Step 4: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/lib/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/errors.ts tests/unit/lib/errors.test.ts
git commit -m "feat(errors): add ConflictError (409)"
```

---

### Task 2: `vault-path.ts`

**Files:**

- Create: `lib/nexus/vault-path.ts`
- Test: `tests/unit/lib/nexus/vault-path.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Napisz czerwony test**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { VaultConfigError, resolveVaultRoot } from "@/lib/nexus/vault-path";

const linux = { platform: "linux" as const };
const win = { platform: "win32" as const };

describe("resolveVaultRoot", () => {
  it("throws VaultConfigError when NEXUS_VAULT_PATH is missing or blank", () => {
    expect(() => resolveVaultRoot({}, linux)).toThrow(VaultConfigError);
    expect(() => resolveVaultRoot({ NEXUS_VAULT_PATH: "   " }, linux)).toThrow(/NEXUS_VAULT_PATH/);
  });

  it("returns an absolute posix path unchanged on linux (trailing slash trimmed)", () => {
    expect(resolveVaultRoot({ NEXUS_VAULT_PATH: "/home/u/NEXUS/Vault/" }, linux)).toBe(
      "/home/u/NEXUS/Vault"
    );
  });

  it("maps a Windows drive path to /mnt/<drive>/ on linux", () => {
    expect(resolveVaultRoot({ NEXUS_VAULT_PATH: "E:\\NEXUS\\Vault" }, linux)).toBe(
      "/mnt/e/NEXUS/Vault"
    );
    expect(resolveVaultRoot({ NEXUS_VAULT_PATH: "e:/NEXUS/Vault" }, linux)).toBe(
      "/mnt/e/NEXUS/Vault"
    );
  });

  it("maps /mnt/<drive>/ to a Windows drive path on win32", () => {
    expect(resolveVaultRoot({ NEXUS_VAULT_PATH: "/mnt/e/NEXUS/Vault" }, win)).toBe(
      "E:\\NEXUS\\Vault"
    );
  });

  it("keeps a Windows drive path on win32", () => {
    expect(resolveVaultRoot({ NEXUS_VAULT_PATH: "E:\\NEXUS\\Vault" }, win)).toBe(
      "E:\\NEXUS\\Vault"
    );
  });

  it("rejects a relative path", () => {
    expect(() => resolveVaultRoot({ NEXUS_VAULT_PATH: "NEXUS/Vault" }, linux)).toThrow(
      /bezwzględn/
    );
    expect(() => resolveVaultRoot({ NEXUS_VAULT_PATH: "~/NEXUS/Vault" }, linux)).toThrow(
      /bezwzględn/
    );
  });
});
```

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/nexus/vault-path.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Implementacja `lib/nexus/vault-path.ts`**

```ts
export class VaultConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultConfigError";
  }
}

type Options = { platform?: NodeJS.Platform };

const WIN_DRIVE = /^([A-Za-z]):[\\/]*(.*)$/;
const MNT_DRIVE = /^\/mnt\/([a-z])(?:\/(.*))?$/;

/** Ścieżka vaulta z `NEXUS_VAULT_PATH` w formie właściwej dla platformy. */
export function resolveVaultRoot(
  env: Record<string, string | undefined>,
  options: Options = {}
): string {
  const platform = options.platform ?? process.platform;
  const raw = (env.NEXUS_VAULT_PATH ?? "").trim();
  if (raw === "") {
    throw new VaultConfigError(
      "Brak vaulta: ustaw NEXUS_VAULT_PATH na bezwzględną ścieżkę do katalogu Vault."
    );
  }

  const win = WIN_DRIVE.exec(raw);
  const mnt = MNT_DRIVE.exec(raw);

  if (platform === "win32") {
    if (mnt) {
      const rest = (mnt[2] ?? "").replace(/\//g, "\\").replace(/\\+$/, "");
      return `${mnt[1].toUpperCase()}:\\${rest}`;
    }
    if (win) return raw.replace(/[\\/]+$/, "");
  } else if (win) {
    const rest = win[2].replace(/\\/g, "/").replace(/\/+$/, "");
    return `/mnt/${win[1].toLowerCase()}/${rest}`;
  } else if (raw.startsWith("/")) {
    return raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  }

  throw new VaultConfigError(
    `NEXUS_VAULT_PATH musi być ścieżką bezwzględną (bez "~" i ścieżek względnych): ${raw}`
  );
}

/** Odczyt z `process.env`; błąd konfiguracji, gdy zmienna jest pusta. */
export function getVaultRoot(): string {
  return resolveVaultRoot(process.env);
}
```

- [ ] **Step 4: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/lib/nexus/vault-path.test.ts`
Expected: PASS (6 testów).

- [ ] **Step 5: Dopisz `NEXUS_VAULT_PATH` do `.env.example`** (nowa sekcja na końcu pliku)

```
# Vault NEXUS (pliki Markdown/YAML) - bezwzględna ścieżka do katalogu Vault.
# Linux/WSL: /home/<user>/projects/Brain_7224/NEXUS/Vault, Windows: E:\NEXUS\Vault (mapowane na /mnt/e/ w WSL)
NEXUS_VAULT_PATH=""
```

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/vault-path.ts tests/unit/lib/nexus/vault-path.test.ts .env.example
git commit -m "feat(nexus): resolve vault root from NEXUS_VAULT_PATH"
```

---

### Task 3: `vault-fs.ts`

> **Stan po review (commit `0be0858`):** kod poniżej to wersja pierwotna. Po recenzji usunięto blokadę per plik (`withLock`; sekcja synchroniczna, nic by nie chroniła), `PathOutsideVaultError` dziedziczy po `DomainError` (400), odczyt jest ścisłym UTF-8 ze zdjęciem BOM, ścieżka jest rozwiązywana raz na wywołanie (`readAt`/`writeAt`), a typ opcji to wyeksportowane `VaultFsOptions`. Obowiązuje kod w repozytorium, nie ten blok.

**Files:**

- Create: `lib/nexus/vault-fs.ts`
- Test: `tests/unit/lib/nexus/vault-fs.test.ts`

Reguły: wszystkie funkcje biorą ścieżkę względną (`rel`) i `root` (domyślnie `getVaultRoot()`); każda ścieżka przechodzi przez `resolveInsideVault`. Odczyt normalizuje `\r\n` do `\n`, a wersja (`size`, `hash` SHA-256 hex) liczona jest z tekstu po normalizacji. Zapis jest atomowy (plik tymczasowy `wx` + `rename`), zawsze `\n`. `writeVaultFile` z `expected` sprawdza tuż przed zapisem, czy bieżąca wersja (skrót i rozmiar) jest równa `expected` (`null` = plik ma nie istnieć); niezgodność → `ConflictError`. `updateVaultFile` trzyma blokadę per plik (kolejka obietnic w module), czyta plik, woła `mutate(text | null)` i zapisuje z `expected` = wersja z odczytu; przy `ConflictError` z zapisu (zmiana zewnętrzna) czyta ponownie i powtarza, maks. `retries` (domyślnie 3) razy, potem `ConflictError`. Wyjątek z `mutate` nie jest ponawiany. Pozostały po nieudanym zapisie plik tymczasowy jest usuwany (jedyne `rmSync` w pliku).

- [ ] **Step 1: Napisz czerwony test** (`// @vitest-environment node`, `mkdtemp` w `os.tmpdir()`; root = katalog `vault` w tmp)

Przypadki (każdy jako osobny `it`, oczekiwania dokładne):

```ts
// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError } from "@/lib/errors";
import {
  PathOutsideVaultError,
  readVaultFile,
  resolveInsideVault,
  updateVaultFile,
  writeVaultFile,
} from "@/lib/nexus/vault-fs";

let tmp: string;
let root: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-fs-"));
  root = path.join(tmp, "vault");
  fs.mkdirSync(root);
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("resolveInsideVault", () => {
  it("rejects traversal, absolute paths, empty path and NUL", () => {
    for (const bad of ["../x", "a/../../x", "/etc/passwd", "C:\\x", "", "a\0b"]) {
      expect(() => resolveInsideVault(root, bad), bad).toThrow(PathOutsideVaultError);
    }
  });
  it("rejects a symlink that points outside the vault", () => {
    const outside = path.join(tmp, "outside");
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(root, "link"));
    expect(() => resolveInsideVault(root, "link/file.md")).toThrow(PathOutsideVaultError);
  });
  it("accepts a nested path that does not exist yet", () => {
    expect(resolveInsideVault(root, "Tasks/tasks.md")).toBe(
      path.join(fs.realpathSync(root), "Tasks", "tasks.md")
    );
  });
});

describe("readVaultFile / writeVaultFile", () => {
  it("returns null for a missing file", () => {
    expect(readVaultFile("Tasks/tasks.md", { root })).toBeNull();
  });
  it("creates directories and writes with LF, reading back the same text and a stable version", () => {
    const v = writeVaultFile("Tasks/tasks.md", "a\nb\n", { root, expected: null });
    const f = readVaultFile("Tasks/tasks.md", { root })!;
    expect(f.text).toBe("a\nb\n");
    expect(f.version).toEqual(v);
    expect(f.version.size).toBe(4);
    expect(f.version.hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("normalizes CRLF on read and gives CRLF and LF files the same hash", () => {
    fs.writeFileSync(path.join(root, "a.md"), "x\r\ny\r\n");
    fs.writeFileSync(path.join(root, "b.md"), "x\ny\n");
    const a = readVaultFile("a.md", { root })!;
    const b = readVaultFile("b.md", { root })!;
    expect(a.text).toBe("x\ny\n");
    expect(a.version.hash).toBe(b.version.hash);
  });
  it("throws ConflictError when expected is null but the file exists", () => {
    fs.writeFileSync(path.join(root, "a.md"), "x\n");
    expect(() => writeVaultFile("a.md", "y\n", { root, expected: null })).toThrow(ConflictError);
    expect(fs.readFileSync(path.join(root, "a.md"), "utf8")).toBe("x\n");
  });
  it("throws ConflictError when the file changed after the expected read", () => {
    const v = writeVaultFile("a.md", "x\n", { root, expected: null });
    fs.writeFileSync(path.join(root, "a.md"), "changed\n");
    expect(() => writeVaultFile("a.md", "y\n", { root, expected: v })).toThrow(ConflictError);
    expect(fs.readFileSync(path.join(root, "a.md"), "utf8")).toBe("changed\n");
  });
  it("leaves no temporary files behind after a conflict or a success", () => {
    writeVaultFile("a.md", "x\n", { root, expected: null });
    try {
      writeVaultFile("a.md", "y\n", { root, expected: null });
    } catch {
      /* oczekiwany konflikt */
    }
    expect(fs.readdirSync(root)).toEqual(["a.md"]);
  });
  it("refuses to write outside the vault", () => {
    expect(() => writeVaultFile("../evil.md", "x", { root, expected: null })).toThrow(
      PathOutsideVaultError
    );
  });
});

describe("updateVaultFile", () => {
  it("creates a missing file from mutate(null)", async () => {
    await updateVaultFile("n.md", (cur) => `${cur ?? "new"}\n`, { root });
    expect(fs.readFileSync(path.join(root, "n.md"), "utf8")).toBe("new\n");
  });
  it("applies mutate to fresh content when an external write happens between read and write", async () => {
    fs.writeFileSync(path.join(root, "t.md"), "one\n");
    let calls = 0;
    await updateVaultFile(
      "t.md",
      (cur) => {
        calls += 1;
        if (calls === 1) fs.writeFileSync(path.join(root, "t.md"), "one\nexternal\n");
        return `${cur}mine\n`;
      },
      { root }
    );
    expect(calls).toBe(2);
    expect(fs.readFileSync(path.join(root, "t.md"), "utf8")).toBe("one\nexternal\nmine\n");
  });
  it("throws ConflictError when the file keeps changing beyond the retry limit", async () => {
    fs.writeFileSync(path.join(root, "t.md"), "0\n");
    let n = 0;
    await expect(
      updateVaultFile(
        "t.md",
        (cur) => {
          n += 1;
          fs.writeFileSync(path.join(root, "t.md"), `${n}\n`);
          return `${cur}x\n`;
        },
        { root, retries: 2 }
      )
    ).rejects.toThrow(ConflictError);
    expect(n).toBe(3);
  });
  it("does not retry when mutate throws", async () => {
    fs.writeFileSync(path.join(root, "t.md"), "a\n");
    let calls = 0;
    await expect(
      updateVaultFile(
        "t.md",
        () => {
          calls += 1;
          throw new Error("boom");
        },
        { root }
      )
    ).rejects.toThrow("boom");
    expect(calls).toBe(1);
  });
  it("serializes concurrent updates of the same file (no lost updates)", async () => {
    fs.writeFileSync(path.join(root, "c.md"), "");
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        updateVaultFile("c.md", (cur) => `${cur ?? ""}${i}\n`, { root })
      )
    );
    const lines = fs.readFileSync(path.join(root, "c.md"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(20);
    expect(new Set(lines).size).toBe(20);
  });
});
```

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/nexus/vault-fs.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Implementacja `lib/nexus/vault-fs.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ConflictError } from "@/lib/errors";
import { getVaultRoot } from "./vault-path";

export class PathOutsideVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathOutsideVaultError";
  }
}

export type FileVersion = { size: number; hash: string };
export type VaultFile = { text: string; version: FileVersion };
type Opts = { root?: string };

function isInside(realRoot: string, abs: string): boolean {
  const relative = path.relative(realRoot, abs);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/** Najbliższy istniejący przodek (po realpath); wiszące dowiązanie traktujemy jako naruszenie. */
function realpathOfNearestAncestor(abs: string): string {
  let current = abs;
  for (;;) {
    try {
      return fs.realpathSync(current);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      let exists = true;
      try {
        fs.lstatSync(current);
      } catch (lerr) {
        if ((lerr as NodeJS.ErrnoException).code !== "ENOENT") throw lerr;
        exists = false;
      }
      if (exists) throw new PathOutsideVaultError(`Dangling symlink in path: ${abs}`);
      const parent = path.dirname(current);
      if (parent === current) return current;
      current = parent;
    }
  }
}

export function resolveInsideVault(vaultRoot: string, rel: string): string {
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(vaultRoot);
  } catch {
    throw new Error(`Vault root does not exist: ${vaultRoot}`);
  }
  if (!fs.statSync(realRoot).isDirectory()) {
    throw new Error(`Vault root is not a directory: ${vaultRoot}`);
  }
  if (typeof rel !== "string" || rel === "") throw new PathOutsideVaultError("Empty path");
  if (path.isAbsolute(rel) || path.win32.isAbsolute(rel) || rel.includes("\0")) {
    throw new PathOutsideVaultError(`Absolute path not allowed: ${rel}`);
  }
  if (rel.split(/[\\/]/).some((segment) => segment === "..")) {
    throw new PathOutsideVaultError(`Path traversal not allowed: ${rel}`);
  }
  const abs = path.resolve(realRoot, rel);
  if (!isInside(realRoot, abs)) throw new PathOutsideVaultError(`Path outside vault: ${rel}`);
  const ancestor = realpathOfNearestAncestor(abs);
  if (ancestor !== realRoot && !isInside(realRoot, ancestor)) {
    throw new PathOutsideVaultError(`Path resolves outside vault: ${rel}`);
  }
  return abs;
}

function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function versionOf(text: string): FileVersion {
  return {
    size: Buffer.byteLength(text, "utf8"),
    hash: createHash("sha256").update(text, "utf8").digest("hex"),
  };
}

function sameVersion(a: FileVersion | null, b: FileVersion | null): boolean {
  if (a === null || b === null) return a === b;
  return a.size === b.size && a.hash === b.hash;
}

function rootOf(opts?: Opts): string {
  return opts?.root ?? getVaultRoot();
}

export function readVaultFile(rel: string, opts?: Opts): VaultFile | null {
  const abs = resolveInsideVault(rootOf(opts), rel);
  let raw: string;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const text = normalizeEol(raw);
  return { text, version: versionOf(text) };
}

/**
 * Zapis atomowy. `expected` = wersja z ostatniego odczytu (`null` = plik nie ma istnieć).
 * Niezgodność wersji tuż przed zapisem daje `ConflictError`. Między sprawdzeniem a `rename`
 * zostaje wąskie okno wyścigu z procesem zewnętrznym (świadomie akceptowane).
 */
export function writeVaultFile(
  rel: string,
  text: string,
  opts: Opts & { expected: FileVersion | null }
): FileVersion {
  const abs = resolveInsideVault(rootOf(opts), rel);
  const current = readVaultFile(rel, opts)?.version ?? null;
  if (!sameVersion(current, opts.expected)) {
    throw new ConflictError(`Plik zmienił się w międzyczasie: ${rel}`);
  }
  const body = normalizeEol(text);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = path.join(
    path.dirname(abs),
    `.${path.basename(abs)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`
  );
  try {
    fs.writeFileSync(tmp, body, { encoding: "utf8", flag: "wx" });
    fs.renameSync(tmp, abs);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
  return versionOf(body);
}

const locks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}

/**
 * Odczyt, zmiana, zapis pod blokadą per plik. Zmiana zewnętrzna między odczytem a zapisem
 * powoduje ponowny odczyt i ponowne zastosowanie `mutate` (maks. `retries` razy).
 */
export async function updateVaultFile(
  rel: string,
  mutate: (current: string | null) => string,
  opts: Opts & { retries?: number } = {}
): Promise<FileVersion> {
  const abs = resolveInsideVault(rootOf(opts), rel);
  const retries = opts.retries ?? 3;
  return withLock(abs, async () => {
    for (let attempt = 0; ; attempt += 1) {
      const file = readVaultFile(rel, opts);
      const next = mutate(file?.text ?? null);
      try {
        return writeVaultFile(rel, next, { ...opts, expected: file?.version ?? null });
      } catch (err) {
        if (!(err instanceof ConflictError) || attempt >= retries) throw err;
      }
    }
  });
}
```

Uwaga o teście "keeps changing": `retries: 2` oznacza 3 wywołania `mutate` (próby 0, 1, 2), potem `ConflictError`, stąd `n === 3`.

- [ ] **Step 4: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/lib/nexus/vault-fs.test.ts`
Expected: PASS (wszystkie przypadki). Jeśli test blokady jest niestabilny, nie zmieniaj testu na `sleep`; popraw `withLock`.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/vault-fs.ts tests/unit/lib/nexus/vault-fs.test.ts
git commit -m "feat(nexus): atomic vault writes with conflict check and per-file lock"
```

---

### Task 4: Testy statyczne `lib/nexus/vault-*`

**Files:**

- Create: `tests/unit/lib/nexus/static.test.ts`

Wzorzec: `tests/unit/scripts/import-to-vault/static.test.ts` (funkcje `read`, `hits`, `lineOf`). Pliki pod nadzorem: `lib/nexus/vault-path.ts`, `lib/nexus/vault-fs.ts`.

- [ ] **Step 1: Napisz test**

Przypadki:

1. Żaden z plików nie zawiera (regex, bez rozróżniania wielkości liter): `firebase`, `child_process`, `execSync`, `spawn`, `node:os`, `homedir`, `backups`.
2. `node:fs` importowany tylko w `vault-fs.ts` (`vault-path.ts` bez `fs`).
3. `writeFileSync`, `renameSync`, `rmSync`, `mkdirSync`, `appendFileSync`, `createWriteStream` występują tylko w `vault-fs.ts`; w `vault-fs.ts` jest dokładnie jedno `rmSync(` i brak `unlinkSync`/`rmdirSync`.
4. W `vault-fs.ts` każde wywołanie `writeFileSync`/`renameSync`/`mkdirSync` leży w pliku, w którym jest `resolveInsideVault(` użyte co najmniej raz w `readVaultFile` i `writeVaultFile` (sprawdź regexem, że w ciele `writeVaultFile` występuje `resolveInsideVault(`: `/export function writeVaultFile[\s\S]*?resolveInsideVault\(/`).
5. `process.env` występuje tylko w `vault-path.ts`.

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PATH_TS = "lib/nexus/vault-path.ts";
const FS_TS = "lib/nexus/vault-fs.ts";
const FILES = [PATH_TS, FS_TS];

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

function hits(pattern: RegExp, allowed: string[] = []): string[] {
  const out: string[] = [];
  const global = new RegExp(pattern.source, pattern.flags.replace("g", "") + "g");
  for (const rel of FILES) {
    if (allowed.includes(rel)) continue;
    const text = read(rel);
    for (const m of text.matchAll(global))
      out.push(`${rel}:${lineOf(text, m.index ?? 0)} (${m[0]})`);
  }
  return out;
}

describe("lib/nexus vault-* static guards", () => {
  it("scans existing sources", () => {
    for (const rel of FILES) expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
  });
  it("1. has no forbidden words or process APIs", () => {
    expect(hits(/firebase|child_process|execSync|spawn|node:os|homedir|backups/i)).toEqual([]);
  });
  it("2. imports node:fs only in vault-fs", () => {
    expect(
      hits(/from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(\s*["'](?:node:)?fs/, [FS_TS])
    ).toEqual([]);
    expect(read(FS_TS)).toMatch(/from\s+["']node:fs["']/);
  });
  it("3. mutates the file system only in vault-fs, with a single rmSync", () => {
    expect(
      hits(
        /writeFileSync|renameSync|rmSync|mkdirSync|appendFileSync|unlinkSync|createWriteStream/,
        [FS_TS]
      )
    ).toEqual([]);
    const text = read(FS_TS);
    expect(text.match(/rmSync\(/g) ?? []).toHaveLength(1);
    expect(text).not.toMatch(/unlinkSync|rmdirSync/);
  });
  it("4. resolves every path inside the vault before reading or writing", () => {
    const text = read(FS_TS);
    expect(text).toMatch(/export function readVaultFile[\s\S]*?resolveInsideVault\(/);
    expect(text).toMatch(/export function writeVaultFile[\s\S]*?resolveInsideVault\(/);
    expect(text).toMatch(/export async function updateVaultFile[\s\S]*?resolveInsideVault\(/);
  });
  it("5. reads process.env only in vault-path", () => {
    expect(hits(/process\.env/, [PATH_TS])).toEqual([]);
  });
});
```

- [ ] **Step 2: Uruchom**

Run: `npx vitest run tests/unit/lib/nexus/static.test.ts`
Expected: PASS (kod z Task 2–3 spełnia reguły; jeśli któraś reguła pada, popraw kod, a nie test).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/lib/nexus/static.test.ts
git commit -m "test(nexus): static guards for vault path and fs modules"
```

---

### Task 5: `toIso` i typ czasu map myśli

**Files:**

- Create: `lib/firestore/time.ts`
- Test: `tests/unit/lib/firestore/time.test.ts`
- Modify: `types/records.ts` (`MindMap`, nowy `BoardDoc`)

- [ ] **Step 1: Napisz czerwony test**

```ts
import { describe, expect, it } from "vitest";
import { toIso } from "@/lib/firestore/time";

describe("toIso", () => {
  it("converts a Firestore-like Timestamp (toDate)", () => {
    const ts = { toDate: () => new Date("2026-11-12T10:00:00.000Z") };
    expect(toIso(ts)).toBe("2026-11-12T10:00:00.000Z");
  });
  it("converts a Date", () => {
    expect(toIso(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
  });
  it("normalizes an ISO-like string and passes through a valid ISO string", () => {
    expect(toIso("2026-11-12T10:00:00.000Z")).toBe("2026-11-12T10:00:00.000Z");
    expect(toIso("2026-11-12")).toBe("2026-11-12T00:00:00.000Z");
  });
  it("converts epoch milliseconds", () => {
    expect(toIso(1_000)).toBe("1970-01-01T00:00:01.000Z");
  });
  it("returns undefined for null, undefined, garbage and invalid dates", () => {
    expect(toIso(null)).toBeUndefined();
    expect(toIso(undefined)).toBeUndefined();
    expect(toIso("not a date")).toBeUndefined();
    expect(toIso({})).toBeUndefined();
    expect(toIso({ toDate: () => new Date("x") })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Uruchom, ma paść**

Run: `npx vitest run tests/unit/lib/firestore/time.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Implementacja `lib/firestore/time.ts`**

```ts
/** Timestamp Firestore / Date / tekst / liczba (ms) → ISO 8601 (UTC) albo `undefined`. */
export function toIso(value: unknown): string | undefined {
  let date: Date | undefined;
  if (value instanceof Date) date = value;
  else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  else if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    date = (value as { toDate: () => Date }).toDate();
  }
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
```

- [ ] **Step 4: Uruchom, ma przejść**

Run: `npx vitest run tests/unit/lib/firestore/time.test.ts`
Expected: PASS.

- [ ] **Step 5: Zmień typy w `types/records.ts`**

W interfejsie `MindMap` zamień `createdAt: unknown; updatedAt: unknown;` na `createdAt?: string; updatedAt?: string; // ISO 8601`. Na końcu pliku dodaj:

```ts
/** Zapisany dokument tablicy (surowe, jeszcze nieprzetworzone przez parseBoard). */
export type BoardDoc = { tiles: unknown; frames: unknown; edges: unknown };
```

Nie ruszaj `Timestamp` i pozostałych typów (patrz odstępstwo 2).

- [ ] **Step 6: Commit**

```bash
git add lib/firestore/time.ts tests/unit/lib/firestore/time.test.ts types/records.ts
git commit -m "feat(firestore): toIso helper and ISO time on MindMap"
```

(Na tym etapie `tsc` może zgłaszać błędy w `services/mindMapService.ts`, bo przypisuje `Timestamp`; naprawia je Task 6. Nie uruchamiaj typecheck przed Taskiem 6.)

---

### Task 6: Repozytoria map myśli i tablicy, barrel, serwisy

**Files:**

- Create: `lib/firestore/mindMaps.ts`, `lib/firestore/board.ts`
- Modify: `lib/firestore-db.ts`, `services/mindMapService.ts`, `services/boardService.ts`
- Test: `tests/unit/services/mindMapService.test.ts`, `tests/unit/services/boardService.test.ts` (przepisane)

**Sygnatury repozytoriów** (eksportowane przez barrel `lib/firestore-db.ts`; wszystkie przyjmują `userId` jako pierwszy argument, jak reszta):

```ts
// lib/firestore/mindMaps.ts
getMindMaps(userId: string): Promise<MindMap[]>                          // nieposortowane
getMindMap(userId: string, mapId: string): Promise<MindMap | null>       // null, gdy dokument nie istnieje
createMindMap(userId: string, data: { title: string; rootNode: MindMapNode }): Promise<MindMap>
saveMindMap(userId: string, mapId: string, patch: { title?: string; rootNode?: MindMapNode; colWidths?: Record<number, number> }): Promise<void>
deleteMindMap(userId: string, mapId: string): Promise<void>

// lib/firestore/board.ts
getBoard(userId: string): Promise<BoardDoc | null>                       // null, gdy dokumentu brak
saveBoard(userId: string, board: { tiles: unknown; frames: unknown; edges: unknown }): Promise<void>
```

**Reguły repozytoriów (przeniesione 1:1 z dzisiejszych serwisów):**

- `createMindMap`: nowy dokument `mindMapsCol(userId).doc()`; zapisuje `{ userId, title, rootNode, colWidths: {}, createdAt, updatedAt }` z `FieldValue.serverTimestamp()`; po zapisie odczytuje dokument i zwraca `MindMap` z `createdAt`/`updatedAt` przepuszczonymi przez `toIso`.
- `getMindMaps`: `userId: data.userId ?? userId`, `title: data.title ?? ""`, `colWidths: data.colWidths ?? {}`, czasy przez `toIso`.
- `getMindMap`: `userId: data.userId ?? ""` (dokument bez `userId` nie przejdzie kontroli właściciela w serwisie, jak dziś), `title: data.title ?? ""`, `colWidths: data.colWidths ?? {}`.
- `saveMindMap`: `update({ updatedAt: serverTimestamp(), ...patch })` — tylko klucze obecne w `patch` (nie `undefined`).
- `saveBoard`: `boardDoc(userId).set({ tiles, frames, edges, updatedAt: serverTimestamp() })` (cały dokument, jak dziś).
- Żaden inny plik poza `lib/firestore/*` nie importuje `firebase-admin`.

**Barrel `lib/firestore-db.ts`:** usuń linię `export { mindMapsCol, boardDoc } from "@/lib/firestore/collections";`; dodaj:

```ts
export {
  getMindMaps,
  getMindMap,
  createMindMap,
  saveMindMap,
  deleteMindMap,
} from "@/lib/firestore/mindMaps";
export { getBoard, saveBoard } from "@/lib/firestore/board";
```

**Reguły serwisów** (importują `import * as firestoreDb from "@/lib/firestore-db"`, jak `tagService`; zero importów `firebase*`):

- `createMindMap(userId, title)`: `label = (title ?? "").trim() || "Nowa mapa"`; `rootNode = { id: "root", label, note: "", collapsed: false, children: [] }`; zwraca `firestoreDb.createMindMap(userId, { title: label, rootNode })`.
- `getMindMaps(userId)`: wynik repozytorium posortowany malejąco po `Date.parse(updatedAt ?? "") || 0`.
- `getMindMap(userId, mapId)`: gdy repo zwróci `null` → `DomainError("Mind map not found", 404)`; gdy `map.userId !== userId` → ten sam błąd (zachowaj `ensureOwnMap`).
- `saveMindMap(userId, mapId, data)`: najpierw `getMindMap` (404/własność), potem `firestoreDb.saveMindMap(userId, mapId, patch)`, gdzie `patch` zawiera `title` (po `trim`) tylko gdy `data.title !== undefined`, `rootNode` tylko gdy zdefiniowany, `colWidths: data.colWidths ?? {}` tylko gdy `data.colWidths !== undefined`.
- `deleteMindMap(userId, mapId)`: `getMindMap` (404/własność), potem `firestoreDb.deleteMindMap`.
- `boardService.getBoard(userId)`: `doc = await firestoreDb.getBoard(userId)`; `doc === null` → `EMPTY_BOARD`; inaczej `parseBoard({ tiles: doc.tiles, frames: doc.frames, edges: doc.edges })`.
- `boardService.saveBoard(userId, input)`: `board = parseBoard(input)` (błąd walidacji `DomainError` jak dziś), `await firestoreDb.saveBoard(userId, board)`, zwraca `board`.

- [ ] **Step 1: Przepisz testy serwisów (czerwone)**

`tests/unit/services/mindMapService.test.ts`: zamiast `mindMapsCol` i `firebase-admin/firestore` mockuj `../../../lib/firestore-db.js` jednym obiektem z fake'ami funkcji repozytorium na `Map<string, MindMap>` (klucz `${userId}:${id}`). Fake `createMindMap` nadaje `id = "m1"`, `"m2"`…, `userId`, `colWidths: {}`, `createdAt`/`updatedAt` = `"2026-11-12T10:00:00.000Z"`; fake `getMindMaps` zwraca wartości dla `userId`; fake `getMindMap` zwraca wartość albo `null`; `saveMindMap` scala patch; `deleteMindMap` usuwa. Zachowaj dokładnie te przypadki i oczekiwania co dziś:

- `createMindMap`: `"  My map  "` → `title "My map"`, `userId "u1"`, `rootNode.label "My map"`, `id` pasuje do `/^m/`; `"   "` → `title` i `rootNode.label` równe `"Nowa mapa"`.
- `getMindMaps` sortuje malejąco po `updatedAt`: wiersze `Old` (`updatedAt: "2026-11-12T10:00:00.000Z"`) i `New` (`"2026-11-12T11:00:00.000Z"`) → tytuły `["New", "Old"]`; wiersz bez `updatedAt` ląduje na końcu.
- `getMindMap`: brak → odrzuca `DomainError` z `message: "Mind map not found"`, `statusCode: 404`; `userId` dokumentu `"other"` przy zapytaniu `u1` → `statusCode: 404`; własny → `title "OK"`, `colWidths { 0: 120 }`.
- `saveMindMap`: `{ title: " T2 ", rootNode: newRoot }` → zapisany `title "T2"`, `rootNode` równe `newRoot`; wywołanie bez `title` nie zmienia tytułu; `colWidths: undefined` nie zeruje istniejących szerokości (patch bez klucza `colWidths`).
- `deleteMindMap` usuwa wiersz; dla cudzej mapy → 404 i wiersz zostaje.

`tests/unit/services/boardService.test.ts`: mock `lib/firestore-db.js` z `getBoard`/`saveBoard` na jednej zmiennej `stored`. Przypadki bez zmian względem dziś: pusty dokument → `{ tiles: [], frames: [], edges: [] }`; zapis i odczyt kafla `t1` (`title "A"`, `frame: null`); nieznana ramka `"nope"` → odrzuca `DomainError`. Dodatkowo: `saveBoard` przekazuje do repozytorium już sparsowaną tablicę (kafel z `tiles[0].id === "t1"`) i nie wywołuje repozytorium, gdy walidacja padła.

- [ ] **Step 2: Uruchom, mają paść**

Run: `npx vitest run tests/unit/services/mindMapService.test.ts tests/unit/services/boardService.test.ts`
Expected: FAIL (serwisy wciąż wołają `mindMapsCol`/`boardDoc` i `firebase-admin`).

- [ ] **Step 3: Zaimplementuj repozytoria, barrel i serwisy** wg reguł powyżej. Kod repozytoriów to przeniesienie dzisiejszych zapytań Firestore z serwisów (`mindMapsCol(userId).doc(...)`, `.set/.get/.update/.delete`) za interfejs z sygnatur.

- [ ] **Step 4: Uruchom testy serwisów i typecheck**

Run: `npx vitest run tests/unit/services/mindMapService.test.ts tests/unit/services/boardService.test.ts && npx tsc --noEmit`
Expected: testy PASS; `tsc` bez błędów. Jeśli `tsc` zgłasza `MindMapList.tsx`/inne miejsca czytające `createdAt`/`updatedAt` mapy, popraw je na `string | undefined` (`formatDateLike` w `src/features/mind-maps/MindMapList.tsx` już obsługuje tekst, więc zmiana nie powinna być potrzebna).

- [ ] **Step 5: Upewnij się, że szew jest szczelny**

Run: `grep -rn "mindMapsCol\|boardDoc\|firebase-admin" services src app --include=*.ts --include=*.tsx | grep -v "app/api/waitlist\|lib/getAuth"`
Expected: brak trafień (`mindMapsCol` i `boardDoc` występują już tylko w `lib/firestore/*`). Jeśli `src/App.tsx`/`src/features/mind-maps/*` coś zwracają, zbadaj trafienie przed edycją.

- [ ] **Step 6: Commit**

```bash
git add lib/firestore/mindMaps.ts lib/firestore/board.ts lib/firestore-db.ts services/mindMapService.ts services/boardService.ts tests/unit/services/mindMapService.test.ts tests/unit/services/boardService.test.ts
git commit -m "refactor(firestore): close the seam for mind maps and board"
```

---

### Task 7: Weryfikacja końcowa i dokumentacja

**Files:**

- Modify: `docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md` (status)

- [ ] **Step 1: Pełna weryfikacja (deleguj do `cursor`, `--tier light`)**

Prompt: `Uruchom w ~/projects/Brain_7224/Second_brain: npx tsc --noEmit, npm run lint, npx vitest run. Odpowiedz „przeszło” albo listą plik:linia + przyczyna. Niczego nie edytuj.`
Expected: „przeszło”. Testy integracyjne z emulatorem (`npm run test:integration:docker`) są opcjonalne w tym kroku; `mindMapService.integration.test.ts` używa serwisu bez zmian sygnatur.

- [ ] **Step 2: Ręczny przegląd w UI**

`npm run dev` (port 3100), zalogować się, w module Mapy myśli: utworzyć mapę, zmienić tytuł i węzły, zapisać, odświeżyć, usunąć; w module Tablica: dodać kafel, zapisać, odświeżyć. Na liście map data „Aktualizacja: …” ma się wyświetlać (ISO zamiast Timestamp). Zanotować wynik w opisie PR.

- [ ] **Step 3: Niezależny review diffa (`agy`, `--role review`)**

Prompt (z podaniem plików): `Zrób review diffa gałęzi feat/etap-0c-1-fundament względem main (git diff main...HEAD): lib/nexus/vault-fs.ts, lib/nexus/vault-path.ts, lib/firestore/{mindMaps,board,time}.ts, services/{mindMapService,boardService}.ts. Szukaj błędów w blokadzie per plik, kontroli konfliktu, ochronie ścieżek, regresji zachowania serwisów. Lista: waga, plik:linia, problem, propozycja. Max 30 linii.` Opinie traktuj jak hipotezy: zweryfikuj w kodzie przed zmianą.

- [ ] **Step 4: Zaktualizuj status w specu 0c** — w nagłówku „Status:” wpisz, że 0c-1 jest zaimplementowany na gałęzi `feat/etap-0c-1-fundament`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-11-12-etap-0c-warstwa-plikowa-design.md
git commit -m "docs: mark stage 0c-1 as implemented"
```

---

## Samoprzegląd planu względem speca

- **§3.1/§3.2 (vault-path, vault-fs, atomowość, `mtime`/skrót, blokada, CRLF, `ConflictError` = `DomainError` 409):** Task 1–4. Kontrola konfliktu używa rozmiaru i skrótu treści (bez `mtimeMs`): skrót rozstrzyga także przy zgrubnej rozdzielczości `mtime` na `/mnt/e/`, więc `mtime` jest zbędny; spec mówi „`mtimeMs`, rozmiar i skrót”, plan zawęża do tego, co faktycznie decyduje.
- **§5 0c-1 (domknięcie szwu, ISO dla map myśli, przepisanie testów):** Task 5–6. Funkcje barrela zgodne z serwisami (`getMindMap`, `saveMindMap`).
- **Poza 0c-1 (świadomie):** `markdown-edit.ts` (0c-3), `append` (0c-4), czas ISO pozostałych kolekcji (przy ich przepięciu), reguła nakładania dla zadań (0c-3).
- **Spójność nazw:** `resolveVaultRoot`/`getVaultRoot`/`VaultConfigError` (Task 2) są użyte w `vault-fs` jako `getVaultRoot`; `FileVersion`, `VaultFile`, `readVaultFile`, `writeVaultFile`, `updateVaultFile`, `resolveInsideVault`, `PathOutsideVaultError` (Task 3) są użyte w teście statycznym (Task 4) pod tymi nazwami; `toIso` (Task 5) jest używane przez repozytoria (Task 6); `BoardDoc` (Task 5) przez `board.ts` (Task 6).
