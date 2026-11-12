# Etap 0a: eksport Firestore — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skrypt `scripts/export-firestore.ts`, który tylko czyta Firestore i zapisuje wierny, zweryfikowany zrzut (JSONL + `manifest.json`) poza repozytorium, z trybami `--count-only`, pełny eksport (`--resume`) i `--verify`.

**Architecture:** Cienki plik CLI (`scripts/export-firestore.ts`) wywołuje małe moduły w `scripts/export-firestore/`: `serialize` (kodowanie typów Firestore), `guard` (odmowa zapisu w repo gita, uprawnienia), `args`, `discover` (wykrywanie kolekcji i liczenie), `exporter` (stronicowany zapis do `.part` + `rename`), `manifest`, `auth-export`, `run` (orkiestracja), `verify`. Moduły przyjmują instancję `Firestore` jako parametr, więc testy integracyjne używają emulatora, a CLI dostarcza `getFirestore()` z `lib/firebase-admin.ts`.

**Tech Stack:** TypeScript (tsx), firebase-admin 13.6, Vitest 3 (testy jednostkowe `tests/unit`, integracyjne `tests/integration` na emulatorze Firestore w Dockerze), Node `fs`/`crypto`/`util.parseArgs`.

**Spec:** `docs/superpowers/specs/2026-11-12-etap-0-odpiecie-firebase-design.md`, sekcja 4 (krok 0a). To jedyny krok tego planu; 0b–0f dostaną osobne plany.

**Zasady przekrojowe (obowiązują w każdym zadaniu):**

- Kod skryptu **nie zapisuje** do Firestore ani Auth. Zabronione w `scripts/export-firestore*`: `.set(`, `.update(`, `.delete(`, `.add(`, `.create(`, `.batch(`, `.bulkWriter(`, `.runTransaction(`, `.recursiveDelete(`, `.createUser(`, `.deleteUser(`, `.updateUser(`. Wymusza to test statyczny (Task 8). (Wyjątek: `createHash(...).update(...)` z `node:crypto`, który test pomija.) Dlatego w modułach nie używaj `Map.set`/`Set.add` (użyj zwykłych obiektów i tablic) i nie pisz tych nazw z nawiasem w komentarzach.
- Każdy plik testowy `tests/unit/**` zaczyna się od `// @vitest-environment node` (domyślne środowisko to jsdom, a `Buffer`/`fs` mają działać natywnie).
- Testy integracyjne czyszczą **wyłącznie emulator** (adres z `FIRESTORE_EMULATOR_HOST`) i same się wyłączają, gdy zmiennej brak.
- Komendy ciężkie w outputcie (`npx tsc --noEmit`, `npm run lint`, pełne `npm run test:run`) zleca się pomocnikowi `cursor` zgodnie z `CLAUDE.md` (`scripts/ask-helper.sh --role task cursor "..."`); w planie podane są jako zwykłe komendy.
- Commity: dopisz trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hook `lint-staged` uruchomi prettier przy commicie. Nie pushuj (PR #6 jest otwarty i publiczny).

---

## File Structure

| Plik                                                             | Odpowiedzialność                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `scripts/export-firestore.ts`                                    | CLI: parsowanie argumentów, wybór trybu, kody wyjścia                   |
| `scripts/export-firestore/types.ts`                              | Typy `Manifest`, `CollectionEntry`, lista `KNOWN_COLLECTIONS`, stałe    |
| `scripts/export-firestore/serialize.ts`                          | `encodeValue` / `decodeValue` (znaczniki typów Firestore)               |
| `scripts/export-firestore/guard.ts`                              | `defaultOutDir`, `assertOutsideGitWorkTree`, `prepareOutDir`            |
| `scripts/export-firestore/args.ts`                               | `parseCliArgs`                                                          |
| `scripts/export-firestore/discover.ts`                           | `discoverCollections` (rekurencja, duchy), `countDocs`                  |
| `scripts/export-firestore/exporter.ts`                           | `fileFor`, `exportCollection`, `truncateToLastFullLine`, `describeFile` |
| `scripts/export-firestore/manifest.ts`                           | `isKnownCollection`, `computeStatus`, zapis/odczyt manifestu            |
| `scripts/export-firestore/auth-export.ts`                        | `exportAuthUsers` (uid, e-mail, daty; bez haszy)                        |
| `scripts/export-firestore/run.ts`                                | `runExport`, `countReport`, `formatCountReport`                         |
| `scripts/export-firestore/verify.ts`                             | `verifyDump`                                                            |
| `tests/unit/scripts/export-firestore/*.test.ts`                  | testy jednostkowe (bez Firestore)                                       |
| `tests/integration/scripts/export-helpers.ts`                    | wspólne: czyszczenie emulatora, `seed`, `readJsonl`, `tmpDir`           |
| `tests/integration/scripts/export-firestore.integration.test.ts` | eksport + resume + count-only                                           |
| `tests/integration/scripts/verify-firestore.integration.test.ts` | `--verify`                                                              |

Format zrzutu (zgodnie ze specem 4.2, z jedną doprecyzowaną regułą dla zagnieżdżeń):

```
<katalog>/
├ manifest.json
├ auth-users.json                          (gdy nie podano --skip-auth)
├ users/<uid>/<kolekcja>.jsonl             kolekcje pod users/<uid> i głębsze (users/<uid>/board/main/history.jsonl)
└ root/<ścieżka kolekcji>.jsonl            kolekcje główne (root/users.jsonl, root/waitlist.jsonl, root/mystery.jsonl)
```

Linia JSONL: `{"_id":"…","_path":"users/u1/tasks/t-a","data":{…}}`.

---

### Task 0: Emulator i sonda możliwości

Sprawdzamy na emulatorze rzeczy, od których zależy projekt: `count()`, `listDocuments()` z dokumentami-widmami, `orderBy(FieldPath.documentId())` + `startAfter(id)`.

**Files:** brak zmian w repo (sonda jednorazowa).

- [ ] **Step 1: Uruchom emulator**

```bash
cd ~/projects/Brain_7224/Second_brain
npm run emulator:docker
npx wait-on tcp:localhost:8080 && echo "emulator gotowy"
```

Expected: `emulator gotowy`. (Docker jest dostępny; obraz `ghcr.io/178inaba/firestore-emulator` zostanie pobrany przy pierwszym uruchomieniu.)

- [ ] **Step 2: Uruchom sondę**

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx -e '
import admin from "firebase-admin";
import { FieldPath } from "firebase-admin/firestore";
admin.initializeApp({ projectId: "demo-probe" });
const db = admin.firestore();
await db.doc("probe/a/sub/x").set({ n: 1 });
await db.doc("probe/b").set({ n: 2 });
const col = db.collection("probe");
console.log("count:", (await col.count().get()).data().count);
console.log("listDocuments:", (await col.listDocuments()).map((d) => d.path));
console.log("subcollections of ghost a:", (await db.doc("probe/a").listCollections()).map((c) => c.path));
const page = await col.orderBy(FieldPath.documentId()).limit(1).get();
console.log("page1:", page.docs.map((d) => d.id));
const next = await col.orderBy(FieldPath.documentId()).startAfter("a").limit(5).get();
console.log("after a:", next.docs.map((d) => d.id));
'
```

Expected (kolejność linii jak niżej):

```
count: 1
listDocuments: [ 'probe/a', 'probe/b' ]
subcollections of ghost a: [ 'probe/a/sub' ]
page1: [ 'b' ]
after a: [ 'b' ]
```

`count: 1` (liczy tylko istniejące dokumenty, widmo `a` nie), a `listDocuments` zwraca także widmo `a`. Jeśli `count()` rzuci błędem `UNIMPLEMENTED`, plan przewiduje to w `countDocs` (Task 5, zapasowe `select()`), więc nie blokuje.

- [ ] **Step 3: Wyczyść sondę**

```bash
curl -s -X DELETE "http://localhost:8080/emulator/v1/projects/demo-probe/databases/(default)/documents" && echo " wyczyszczone"
```

Expected: `{} wyczyszczone` (lub sam komunikat o powodzeniu). Nic nie commitujemy.

---

### Task 1: Typy i serializacja wartości Firestore

**Files:**

- Create: `scripts/export-firestore/types.ts`
- Create: `scripts/export-firestore/serialize.ts`
- Test: `tests/unit/scripts/export-firestore/serialize.test.ts`

Uwaga projektowa: nazwy pól `__.*__` są w Firestore zarezerwowane, więc dane użytkownika nie mogą zawierać klucza `__type`; nie potrzeba mechanizmu ucieczki. Gdyby jednak taki klucz się pojawił, kodowanie ma głośno przerwać.

- [ ] **Step 1: Napisz test (failing)**

Utwórz `tests/unit/scripts/export-firestore/serialize.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { GeoPoint, Timestamp } from "firebase-admin/firestore";
import {
  decodeValue,
  encodeValue,
  UnsupportedValueError,
} from "@/scripts/export-firestore/serialize";

describe("encodeValue", () => {
  it("passes primitives, arrays and plain objects through unchanged", () => {
    const input = { a: 1, b: "x", c: true, d: null, e: [1, "two", { f: 3 }] };
    expect(encodeValue(input)).toEqual(input);
  });

  it("tags a Timestamp with seconds, nanos and an ISO string", () => {
    const ts = new Timestamp(1767323045, 678000000);
    expect(encodeValue({ createdAt: ts })).toEqual({
      createdAt: {
        __type: "timestamp",
        iso: "2026-01-02T03:04:05.678Z",
        seconds: 1767323045,
        nanos: 678000000,
      },
    });
  });

  it("tags GeoPoint, bytes and non-finite numbers", () => {
    expect(encodeValue(new GeoPoint(52.1, 21.0))).toEqual({
      __type: "geopoint",
      latitude: 52.1,
      longitude: 21.0,
    });
    expect(encodeValue(Buffer.from("hi"))).toEqual({ __type: "bytes", base64: "aGk=" });
    expect(encodeValue(NaN)).toEqual({ __type: "number", value: "NaN" });
    expect(encodeValue(Infinity)).toEqual({ __type: "number", value: "Infinity" });
    expect(encodeValue(-Infinity)).toEqual({ __type: "number", value: "-Infinity" });
  });

  it("fails loudly on integers that JS cannot hold exactly", () => {
    expect(() => encodeValue({ big: 2 ** 60 }, "doc")).toThrow(UnsupportedValueError);
    expect(() => encodeValue({ big: 2 ** 60 }, "doc")).toThrow(/doc\.big/);
  });

  it("fails loudly on unknown class instances and undefined", () => {
    class Weird {}
    expect(() => encodeValue({ w: new Weird() })).toThrow(/Weird/);
    expect(() => encodeValue({ u: undefined })).toThrow(UnsupportedValueError);
  });

  it("fails on a reserved __type key in user data", () => {
    expect(() => encodeValue({ __type: "x" })).toThrow(UnsupportedValueError);
  });
});

describe("decodeValue", () => {
  it("restores a Timestamp to the nanosecond", () => {
    const ts = new Timestamp(1767323045, 678901234);
    const back = decodeValue(encodeValue({ t: ts })) as { t: Timestamp };
    expect(back.t.isEqual(ts)).toBe(true);
  });

  it("restores GeoPoint, bytes, NaN and nested structures", () => {
    const input = {
      g: new GeoPoint(1, 2),
      b: Buffer.from([1, 2, 3]),
      n: NaN,
      nested: [{ t: new Timestamp(10, 20) }],
    };
    const back = decodeValue(encodeValue(input)) as typeof input;
    expect(back.g.isEqual(input.g)).toBe(true);
    expect(Buffer.compare(back.b, input.b)).toBe(0);
    expect(Number.isNaN(back.n)).toBe(true);
    expect(back.nested[0].t.isEqual(input.nested[0].t)).toBe(true);
  });

  it("leaves reference tags untouched (a path, not a live reference)", () => {
    const tagged = { r: { __type: "reference", path: "users/u1/tasks/t" } };
    expect(decodeValue(tagged)).toEqual(tagged);
  });
});
```

- [ ] **Step 2: Uruchom test i potwierdź, że pada**

Run: `npx vitest run tests/unit/scripts/export-firestore/serialize.test.ts`
Expected: FAIL (`Failed to resolve import "@/scripts/export-firestore/serialize"`).

- [ ] **Step 3: Napisz `types.ts`**

Utwórz `scripts/export-firestore/types.ts`:

```ts
/** Kolekcje, które aplikacja zna (spec 4.3). Wszystko inne jest raportowane jako nieznane. */
export const KNOWN_COLLECTIONS = [
  "users",
  "documents",
  "notes",
  "mindMaps",
  "board",
  "resources",
  "chunks",
  "calendar_events",
  "tasks",
  "user_tags",
  "task_templates",
  "agent_log",
  "waitlist",
] as const;

export const MANIFEST_FILE = "manifest.json";
export const AUTH_USERS_FILE = "auth-users.json";
export const DEFAULT_PAGE_SIZE = 500;

export type ManifestStatus = "ok" | "mismatch" | "needs-review";

export type CollectionEntry = {
  /** Pełna ścieżka kolekcji, np. users/u1/tasks. */
  path: string;
  /** Ścieżka pliku względem katalogu zrzutu. */
  file: string;
  /** Czy ostatni segment ścieżki jest na liście KNOWN_COLLECTIONS. */
  known: boolean;
  /** count() przed eksportem. */
  before: number;
  /** Liczba linii w pliku. */
  lines: number;
  /** count() po eksporcie. */
  after: number;
  sha256: string;
};

export type AuthExport =
  | { skipped: true }
  | { ok: true; users: number; file: string }
  | { ok: false; error: string };

export type Manifest = {
  version: 1;
  tool: "export-firestore";
  exportedAt: string;
  projectId: string | null;
  pageSize: number;
  status: ManifestStatus;
  collections: CollectionEntry[];
  /** Ścieżki dokumentów, które nie istnieją, ale mają podkolekcje (np. users/ghost). */
  ghosts: string[];
  auth: AuthExport;
  totals: { collections: number; documents: number };
};
```

- [ ] **Step 4: Napisz `serialize.ts`**

Utwórz `scripts/export-firestore/serialize.ts`:

```ts
import { DocumentReference, GeoPoint, Timestamp } from "firebase-admin/firestore";

const TYPE_KEY = "__type";

export class UnsupportedValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedValueError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function encodeEntries(obj: Record<string, unknown>, at: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === TYPE_KEY) {
      throw new UnsupportedValueError(`${at}: pole "${TYPE_KEY}" jest zarezerwowane przez eksport`);
    }
    out[key] = encodeValue(val, `${at}.${key}`);
  }
  return out;
}

/**
 * Koduje wartość odczytaną z Firestore do postaci JSON bez utraty informacji o typie.
 * Wartości, których nie umiemy zapisać wiernie, powodują błąd zamiast cichej straty.
 */
export function encodeValue(value: unknown, at = "$"): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;

  if (typeof value === "number") {
    if (Number.isNaN(value)) return { [TYPE_KEY]: "number", value: "NaN" };
    if (value === Infinity) return { [TYPE_KEY]: "number", value: "Infinity" };
    if (value === -Infinity) return { [TYPE_KEY]: "number", value: "-Infinity" };
    // Liczby całkowite poza zakresem bezpiecznym JS mogły być int64 w Firestore: nie zgadujemy.
    if (
      Number.isInteger(value) &&
      Math.abs(value) > Number.MAX_SAFE_INTEGER &&
      Math.abs(value) < 2 ** 63
    ) {
      throw new UnsupportedValueError(`${at}: liczba całkowita poza zakresem bezpiecznym JS`);
    }
    return value;
  }

  if (value instanceof Timestamp) {
    return {
      [TYPE_KEY]: "timestamp",
      iso: value.toDate().toISOString(),
      seconds: value.seconds,
      nanos: value.nanoseconds,
    };
  }
  if (value instanceof GeoPoint) {
    return { [TYPE_KEY]: "geopoint", latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof DocumentReference) {
    return { [TYPE_KEY]: "reference", path: value.path };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { [TYPE_KEY]: "bytes", base64: Buffer.from(value).toString("base64") };
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => encodeValue(item, `${at}[${index}]`));
  }
  if (isPlainObject(value)) {
    return encodeEntries(value, at);
  }

  const kind =
    value === undefined ? "undefined" : ((value as object).constructor?.name ?? typeof value);
  throw new UnsupportedValueError(`${at}: nieobsługiwany typ wartości (${kind})`);
}

function decodeEntries(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) out[key] = decodeValue(val);
  return out;
}

/**
 * Odwraca encodeValue. Używane w testach i przy konwersji (krok 0b).
 * Znacznik "reference" zostaje jako obiekt ze ścieżką (żywa referencja wymaga instancji Firestore).
 */
export function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value === null || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  switch (obj[TYPE_KEY]) {
    case "timestamp":
      return new Timestamp(obj.seconds as number, obj.nanos as number);
    case "geopoint":
      return new GeoPoint(obj.latitude as number, obj.longitude as number);
    case "bytes":
      return Buffer.from(obj.base64 as string, "base64");
    case "number":
      return Number(obj.value);
    case "reference":
      return obj;
    default:
      return decodeEntries(obj);
  }
}
```

- [ ] **Step 5: Uruchom test i potwierdź, że przechodzi**

Run: `npx vitest run tests/unit/scripts/export-firestore/serialize.test.ts`
Expected: PASS (wszystkie testy `encodeValue` i `decodeValue`).

- [ ] **Step 6: Commit**

```bash
git add scripts/export-firestore/types.ts scripts/export-firestore/serialize.ts tests/unit/scripts/export-firestore/serialize.test.ts
git commit -m "feat(export): typed value serialization for the Firestore dump" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Strażnik katalogu wyjściowego

**Files:**

- Create: `scripts/export-firestore/guard.ts`
- Test: `tests/unit/scripts/export-firestore/guard.test.ts`

- [ ] **Step 1: Napisz test (failing)**

Utwórz `tests/unit/scripts/export-firestore/guard.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertOutsideGitWorkTree,
  defaultOutDir,
  prepareOutDir,
} from "@/scripts/export-firestore/guard";

const made: string[] = [];
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsx-guard-"));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("defaultOutDir", () => {
  it("lives under ~/backups and is stamped with date and time", () => {
    const dir = defaultOutDir(new Date("2026-11-12T14:30:45Z"));
    expect(dir).toBe(
      path.join(os.homedir(), "backups", "second-brain-firestore", "2026-11-12T1430")
    );
  });
});

describe("assertOutsideGitWorkTree", () => {
  it("accepts a directory outside any git work tree, even if it does not exist yet", () => {
    const base = tmp();
    expect(() => assertOutsideGitWorkTree(path.join(base, "not", "yet", "created"))).not.toThrow();
  });

  it("rejects a directory inside this repository (existing or not)", () => {
    const inside = path.join(process.cwd(), "tests", "does-not-exist-yet", "dump");
    expect(() => assertOutsideGitWorkTree(inside)).toThrow(/drzewie roboczym gita/);
    expect(() => assertOutsideGitWorkTree(process.cwd())).toThrow(/drzewie roboczym gita/);
  });
});

describe("prepareOutDir", () => {
  it("creates the directory with mode 0700", () => {
    const out = path.join(tmp(), "dump");
    prepareOutDir(out, { resume: false });
    expect(fs.statSync(out).mode & 0o777).toBe(0o700);
  });

  it("refuses a non-empty directory unless resuming", () => {
    const out = tmp();
    fs.writeFileSync(path.join(out, "x"), "1");
    expect(() => prepareOutDir(out, { resume: false })).toThrow(/niepusty/);
    expect(() => prepareOutDir(out, { resume: true })).not.toThrow();
  });
});
```

- [ ] **Step 2: Uruchom test i potwierdź, że pada**

Run: `npx vitest run tests/unit/scripts/export-firestore/guard.test.ts`
Expected: FAIL (brak modułu `guard`).

- [ ] **Step 3: Napisz `guard.ts`**

Utwórz `scripts/export-firestore/guard.ts`:

```ts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function defaultOutDir(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace(":", "");
  return path.join(os.homedir(), "backups", "second-brain-firestore", stamp);
}

function nearestExistingDir(target: string): string {
  let current = path.resolve(target);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return fs.realpathSync(current);
}

/**
 * Zrzut zawiera pełną treść notatek i dokumentów, a repozytoria projektu są śledzone przez git.
 * Odmawiamy zapisu w jakimkolwiek drzewie roboczym gita.
 */
export function assertOutsideGitWorkTree(outDir: string): void {
  const dir = nearestExistingDir(outDir);
  let inside: string;
  try {
    inside = execFileSync("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return; // nie jest repozytorium (albo brak gita): bezpiecznie
  }
  if (inside === "true") {
    throw new Error(
      `Katalog wyjściowy ${outDir} leży w drzewie roboczym gita. ` +
        `Wskaż katalog poza repozytoriami, np. ~/backups/second-brain-firestore/...`
    );
  }
}

export function prepareOutDir(outDir: string, opts: { resume: boolean }): void {
  assertOutsideGitWorkTree(outDir);
  if (fs.existsSync(outDir)) {
    if (!opts.resume && fs.readdirSync(outDir).length > 0) {
      throw new Error(`Katalog ${outDir} jest niepusty. Użyj --resume albo wskaż nowy katalog.`);
    }
  } else {
    fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  }
  fs.chmodSync(outDir, 0o700);
}
```

- [ ] **Step 4: Uruchom test i potwierdź, że przechodzi**

Run: `npx vitest run tests/unit/scripts/export-firestore/guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/export-firestore/guard.ts tests/unit/scripts/export-firestore/guard.test.ts
git commit -m "feat(export): refuse to write the dump inside a git work tree" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Argumenty CLI

**Files:**

- Create: `scripts/export-firestore/args.ts`
- Test: `tests/unit/scripts/export-firestore/args.test.ts`

- [ ] **Step 1: Napisz test (failing)**

Utwórz `tests/unit/scripts/export-firestore/args.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseCliArgs } from "@/scripts/export-firestore/args";

describe("parseCliArgs", () => {
  it("defaults to a full export", () => {
    expect(parseCliArgs([])).toEqual({
      mode: "export",
      out: undefined,
      resume: false,
      skipAuth: false,
      pageSize: 500,
    });
  });

  it("parses --count-only", () => {
    expect(parseCliArgs(["--count-only"])).toEqual({ mode: "count-only" });
  });

  it("parses --verify <dir>", () => {
    expect(parseCliArgs(["--verify", "/tmp/dump"])).toEqual({ mode: "verify", dir: "/tmp/dump" });
  });

  it("parses --out, --skip-auth and --page-size", () => {
    expect(parseCliArgs(["--out", "/tmp/d", "--skip-auth", "--page-size", "100"])).toEqual({
      mode: "export",
      out: "/tmp/d",
      resume: false,
      skipAuth: true,
      pageSize: 100,
    });
  });

  it("requires --out together with --resume", () => {
    expect(() => parseCliArgs(["--resume"])).toThrow(/--resume wymaga --out/);
    expect(parseCliArgs(["--resume", "--out", "/tmp/d"])).toMatchObject({ resume: true });
  });

  it("rejects mixing --count-only or --verify with other flags", () => {
    expect(() => parseCliArgs(["--count-only", "--out", "/tmp/d"])).toThrow(/osobno/);
    expect(() => parseCliArgs(["--verify", "/tmp/d", "--resume"])).toThrow(/osobno/);
    expect(() => parseCliArgs(["--count-only", "--verify", "/tmp/d"])).toThrow(/osobno/);
  });

  it("validates --page-size", () => {
    expect(() => parseCliArgs(["--page-size", "0"])).toThrow(/--page-size/);
    expect(() => parseCliArgs(["--page-size", "abc"])).toThrow(/--page-size/);
    expect(() => parseCliArgs(["--page-size", "5000"])).toThrow(/--page-size/);
  });

  it("rejects unknown flags", () => {
    expect(() => parseCliArgs(["--wat"])).toThrow();
  });
});
```

- [ ] **Step 2: Uruchom test i potwierdź, że pada**

Run: `npx vitest run tests/unit/scripts/export-firestore/args.test.ts`
Expected: FAIL (brak modułu `args`).

- [ ] **Step 3: Napisz `args.ts`**

Utwórz `scripts/export-firestore/args.ts`:

```ts
import { parseArgs } from "node:util";
import { DEFAULT_PAGE_SIZE } from "./types";

export type CliArgs =
  | { mode: "count-only" }
  | { mode: "verify"; dir: string }
  | {
      mode: "export";
      out: string | undefined;
      resume: boolean;
      skipAuth: boolean;
      pageSize: number;
    };

export function parseCliArgs(argv: string[]): CliArgs {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      "count-only": { type: "boolean" },
      verify: { type: "string" },
      out: { type: "string" },
      resume: { type: "boolean" },
      "skip-auth": { type: "boolean" },
      "page-size": { type: "string" },
    },
  });

  const countOnly = values["count-only"] === true;
  const verifyDir = values.verify;
  const others =
    values.out !== undefined ||
    values.resume === true ||
    values["skip-auth"] === true ||
    values["page-size"] !== undefined;

  if (countOnly && verifyDir !== undefined) {
    throw new Error("--count-only i --verify uruchamia się osobno.");
  }
  if (countOnly) {
    if (others) throw new Error("--count-only uruchamia się osobno, bez innych flag.");
    return { mode: "count-only" };
  }
  if (verifyDir !== undefined) {
    if (others) throw new Error("--verify uruchamia się osobno, bez innych flag.");
    return { mode: "verify", dir: verifyDir };
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  if (values["page-size"] !== undefined) {
    pageSize = Number(values["page-size"]);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
      throw new Error("--page-size musi być liczbą całkowitą od 1 do 1000.");
    }
  }
  if (values.resume === true && values.out === undefined) {
    throw new Error("--resume wymaga --out <katalog istniejącego, niedokończonego eksportu>.");
  }

  return {
    mode: "export",
    out: values.out,
    resume: values.resume === true,
    skipAuth: values["skip-auth"] === true,
    pageSize,
  };
}
```

- [ ] **Step 4: Uruchom test i potwierdź, że przechodzi**

Run: `npx vitest run tests/unit/scripts/export-firestore/args.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/export-firestore/args.ts tests/unit/scripts/export-firestore/args.test.ts
git commit -m "feat(export): CLI argument parsing" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Eksport kolekcji (stronicowanie, `.part`, wznawianie)

Czyste pomocniki (`fileFor`, `truncateToLastFullLine`, `describeFile`) dostają testy jednostkowe. `exportCollection` (rozmowa z Firestore) dostaje własny test integracyjny na emulatorze, napisany i uruchomiony na czerwono przed implementacją. Wspólne pomocniki testów integracyjnych (`export-helpers.ts`) powstają tutaj i są używane też w Task 5–7.

**Files:**

- Create: `scripts/export-firestore/exporter.ts`
- Create: `tests/integration/scripts/export-helpers.ts`
- Test: `tests/unit/scripts/export-firestore/exporter.test.ts`
- Test: `tests/integration/scripts/exporter.integration.test.ts`

- [ ] **Step 1: Napisz test (failing)**

Utwórz `tests/unit/scripts/export-firestore/exporter.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describeFile, fileFor, truncateToLastFullLine } from "@/scripts/export-firestore/exporter";

const made: string[] = [];
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsx-exp-"));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("fileFor", () => {
  it("puts per-user collections under users/<uid>/", () => {
    expect(fileFor("users/u1/tasks")).toBe("users/u1/tasks.jsonl");
    expect(fileFor("users/u1/board/main/history")).toBe("users/u1/board/main/history.jsonl");
  });

  it("puts root collections under root/", () => {
    expect(fileFor("users")).toBe("root/users.jsonl");
    expect(fileFor("waitlist")).toBe("root/waitlist.jsonl");
    expect(fileFor("mystery/m1/sub")).toBe("root/mystery/m1/sub.jsonl");
  });
});

describe("truncateToLastFullLine", () => {
  it("returns nothing for an empty or missing-newline file and clears it", () => {
    const file = path.join(tmp(), "a.part");
    fs.writeFileSync(file, '{"_id":"brok');
    expect(truncateToLastFullLine(file)).toEqual({ lastId: null, lines: 0 });
    expect(fs.readFileSync(file, "utf8")).toBe("");
  });

  it("cuts a half-written trailing line and reports the last complete id", () => {
    const file = path.join(tmp(), "b.part");
    fs.writeFileSync(
      file,
      '{"_id":"a","_path":"x/a","data":{}}\n{"_id":"b","_path":"x/b","data":{}}\n{"_id":"c'
    );
    expect(truncateToLastFullLine(file)).toEqual({ lastId: "b", lines: 2 });
    expect(fs.readFileSync(file, "utf8")).toBe(
      '{"_id":"a","_path":"x/a","data":{}}\n{"_id":"b","_path":"x/b","data":{}}\n'
    );
  });

  it("leaves a clean file untouched", () => {
    const file = path.join(tmp(), "c.part");
    const content = '{"_id":"a","_path":"x/a","data":{}}\n';
    fs.writeFileSync(file, content);
    expect(truncateToLastFullLine(file)).toEqual({ lastId: "a", lines: 1 });
    expect(fs.readFileSync(file, "utf8")).toBe(content);
  });
});

describe("describeFile", () => {
  it("counts lines and computes sha256", () => {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, "root"), { recursive: true });
    const content = "one\ntwo\nthree\n";
    fs.writeFileSync(path.join(dir, "root", "x.jsonl"), content);
    const result = describeFile("x", dir, "root/x.jsonl");
    expect(result).toEqual({
      path: "x",
      file: "root/x.jsonl",
      lines: 3,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
    });
  });
});
```

- [ ] **Step 2: Pomocniki testów integracyjnych i test integracyjny `exportCollection` (failing)**

Utwórz `tests/integration/scripts/export-helpers.ts`:

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

export const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
export const integrationEnabled = !!process.env.RUN_INTEGRATION_TESTS && !!emulatorHost;

/** Czyści WYŁĄCZNIE emulator (URL budowany z FIRESTORE_EMULATOR_HOST). */
export async function wipeEmulator(): Promise<void> {
  if (!emulatorHost) throw new Error("FIRESTORE_EMULATOR_HOST nie jest ustawiony");
  const project = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "demo-nexus";
  const res = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${project}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Czyszczenie emulatora nie powiodło się: ${res.status}`);
}

export const SEED_TIMESTAMP = new Timestamp(1767323045, 678901234);

/** withUnknown dodaje kolekcję mystery i podkolekcję board/main/history (obie nieznane). */
export async function seed(db: Firestore, opts: { withUnknown: boolean }): Promise<void> {
  await db.doc("users/u1").set({ email: "a@example.test" });
  for (const id of ["t-a", "t-b", "t-c"]) {
    await db
      .doc(`users/u1/tasks/${id}`)
      .set({ title: id, createdAt: SEED_TIMESTAMP, tags: ["x", { n: 1 }], priority: null });
  }
  await db
    .doc("users/u1/notes/n1")
    .set({ title: "n", content: "<p>hi</p>", createdAt: SEED_TIMESTAMP });
  await db.doc("users/u1/board/main").set({ nodes: [] });
  await db.doc("users/ghost/tasks/t1").set({ title: "ghost" });
  await db.doc("waitlist/w1").set({ email: "w@example.test" });
  if (opts.withUnknown) {
    await db.doc("users/u1/board/main/history/h1").set({ at: SEED_TIMESTAMP });
    await db.doc("mystery/m1").set({ a: 1 });
  }
}

export function readJsonl(file: string): Array<{ _id: string; _path: string; data: unknown }> {
  const text = fs.readFileSync(file, "utf8");
  return text === ""
    ? []
    : text
        .slice(0, -1)
        .split("\n")
        .map((line) => JSON.parse(line));
}

export function tmpDir(created: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsx-int-"));
  created.push(dir);
  return dir;
}
```

Utwórz `tests/integration/scripts/exporter.integration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getFirestore } from "../../../lib/firebase-admin.js";
import { exportCollection } from "../../../scripts/export-firestore/exporter.js";
import { decodeValue } from "../../../scripts/export-firestore/serialize.js";
import {
  integrationEnabled,
  readJsonl,
  SEED_TIMESTAMP,
  seed,
  tmpDir,
  wipeEmulator,
} from "./export-helpers.js";

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!integrationEnabled)("exportCollection (emulator)", () => {
  beforeEach(async () => {
    await wipeEmulator();
    await seed(getFirestore(), { withUnknown: false });
  });

  it.each([1, 2, 3, 500])("pages through a collection with page size %i", async (pageSize) => {
    const col = getFirestore().collection("users/u1/tasks");
    const outDir = tmpDir(created);

    const result = await exportCollection(col, outDir, { pageSize, resume: false });

    expect(result).toMatchObject({
      path: "users/u1/tasks",
      file: "users/u1/tasks.jsonl",
      lines: 3,
    });
    expect(readJsonl(path.join(outDir, result.file)).map((row) => row._id)).toEqual([
      "t-a",
      "t-b",
      "t-c",
    ]);
    expect(fs.existsSync(path.join(outDir, `${result.file}.part`))).toBe(false);
  });

  it("writes full-fidelity documents (path and timestamps)", async () => {
    const col = getFirestore().collection("users/u1/tasks");
    const outDir = tmpDir(created);
    const result = await exportCollection(col, outDir, { pageSize: 500, resume: false });

    const [first] = readJsonl(path.join(outDir, result.file));
    expect(first._path).toBe("users/u1/tasks/t-a");
    const data = decodeValue(first.data) as { createdAt: typeof SEED_TIMESTAMP; priority: null };
    expect(data.createdAt.isEqual(SEED_TIMESTAMP)).toBe(true);
    expect(data.priority).toBeNull();
  });

  it("with resume, skips a collection whose final file already exists", async () => {
    const col = getFirestore().collection("users/u1/tasks");
    const outDir = tmpDir(created);
    fs.mkdirSync(path.join(outDir, "users/u1"), { recursive: true });
    fs.writeFileSync(path.join(outDir, "users/u1/tasks.jsonl"), "sentinel\n");

    const result = await exportCollection(col, outDir, { pageSize: 500, resume: true });

    expect(result.lines).toBe(1);
    expect(fs.readFileSync(path.join(outDir, "users/u1/tasks.jsonl"), "utf8")).toBe("sentinel\n");
  });

  it("with resume, continues from a truncated .part file and matches a fresh export", async () => {
    const col = getFirestore().collection("users/u1/tasks");
    const fresh = tmpDir(created);
    const freshResult = await exportCollection(col, fresh, { pageSize: 1, resume: false });
    const freshText = fs.readFileSync(path.join(fresh, freshResult.file), "utf8");

    const resumed = tmpDir(created);
    fs.mkdirSync(path.join(resumed, "users/u1"), { recursive: true });
    fs.writeFileSync(
      path.join(resumed, "users/u1/tasks.jsonl.part"),
      `${freshText.split("\n")[0]}\n{"_id":"t-b","_pa`
    );

    const result = await exportCollection(col, resumed, { pageSize: 1, resume: true });

    expect(fs.readFileSync(path.join(resumed, result.file), "utf8")).toBe(freshText);
    expect(result.sha256).toBe(freshResult.sha256);
    expect(fs.existsSync(path.join(resumed, `${result.file}.part`))).toBe(false);
  });
});
```

- [ ] **Step 3: Uruchom testy i potwierdź, że padają**

```bash
npx vitest run tests/unit/scripts/export-firestore/exporter.test.ts
FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npx vitest run --config vitest.integration.config.ts tests/integration/scripts/exporter.integration.test.ts
```

Expected: oba FAIL (brak modułu `exporter`).

- [ ] **Step 4: Napisz `exporter.ts`**

Utwórz `scripts/export-firestore/exporter.ts`:

```ts
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { FieldPath, type CollectionReference } from "firebase-admin/firestore";
import { encodeValue } from "./serialize";

export type ExportedCollection = {
  path: string;
  file: string;
  lines: number;
  sha256: string;
};

export type ExportOptions = { pageSize: number; resume: boolean };

/** Ścieżka pliku zrzutu dla kolekcji (spec 4.2). */
export function fileFor(collectionPath: string): string {
  const segments = collectionPath.split("/");
  if (segments[0] === "users" && segments.length >= 3) return `${collectionPath}.jsonl`;
  return `root/${collectionPath}.jsonl`;
}

/**
 * Po przerwanym zapisie odcina plik do ostatniej kompletnej linii.
 * Zwraca id ostatniego dokumentu (kursor wznowienia) i liczbę zachowanych linii.
 */
export function truncateToLastFullLine(partPath: string): { lastId: string | null; lines: number } {
  const text = fs.readFileSync(partPath, "utf8");
  const end = text.lastIndexOf("\n");
  const complete = end === -1 ? "" : text.slice(0, end + 1);
  if (complete.length !== text.length) fs.writeFileSync(partPath, complete, { mode: 0o600 });
  if (complete === "") return { lastId: null, lines: 0 };
  const rows = complete.slice(0, -1).split("\n");
  const last = JSON.parse(rows[rows.length - 1]) as { _id: string };
  return { lastId: last._id, lines: rows.length };
}

export function describeFile(
  collectionPath: string,
  outDir: string,
  rel: string
): ExportedCollection {
  const buffer = fs.readFileSync(path.join(outDir, rel));
  let lines = 0;
  for (const byte of buffer) if (byte === 0x0a) lines += 1;
  return {
    path: collectionPath,
    file: rel,
    lines,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

/**
 * Czyta kolekcję stronami (orderBy documentId + startAfter) i zapisuje do <plik>.part,
 * a po zakończeniu zmienia nazwę na <plik>. Istniejący gotowy plik przy --resume jest pomijany.
 */
export async function exportCollection(
  col: CollectionReference,
  outDir: string,
  opts: ExportOptions
): Promise<ExportedCollection> {
  const rel = fileFor(col.path);
  const finalPath = path.join(outDir, rel);
  const partPath = `${finalPath}.part`;
  fs.mkdirSync(path.dirname(finalPath), { recursive: true, mode: 0o700 });

  if (opts.resume && fs.existsSync(finalPath)) return describeFile(col.path, outDir, rel);

  let lastId: string | null = null;
  if (opts.resume && fs.existsSync(partPath)) {
    lastId = truncateToLastFullLine(partPath).lastId;
  } else if (fs.existsSync(partPath)) {
    fs.rmSync(partPath);
  }

  const fd = fs.openSync(partPath, "a", 0o600);
  try {
    for (;;) {
      let query = col.orderBy(FieldPath.documentId()).limit(opts.pageSize);
      if (lastId !== null) query = query.startAfter(lastId);
      const snap = await query.get();
      if (snap.empty) break;
      const chunk = snap.docs
        .map(
          (doc) =>
            JSON.stringify({
              _id: doc.id,
              _path: doc.ref.path,
              data: encodeValue(doc.data(), doc.ref.path),
            }) + "\n"
        )
        .join("");
      fs.writeSync(fd, chunk);
      lastId = snap.docs[snap.docs.length - 1].id;
      if (snap.size < opts.pageSize) break;
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(partPath, finalPath);
  return describeFile(col.path, outDir, rel);
}
```

- [ ] **Step 5: Uruchom testy i potwierdź, że przechodzą**

```bash
npx vitest run tests/unit/scripts/export-firestore/exporter.test.ts
FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npx vitest run --config vitest.integration.config.ts tests/integration/scripts/exporter.integration.test.ts
```

Expected: jednostkowe PASS; integracyjne PASS (7 przypadków: 4 rozmiary strony + 3 pozostałe). Jeśli któryś pada, napraw kod, nie oczekiwania.

- [ ] **Step 6: Commit**

```bash
git add scripts/export-firestore/exporter.ts tests/unit/scripts/export-firestore/exporter.test.ts tests/integration/scripts
git commit -m "feat(export): paged collection export with .part files and resume" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Wykrywanie kolekcji, manifest i orkiestracja `runExport`

**Files:**

- Create: `scripts/export-firestore/discover.ts`
- Create: `scripts/export-firestore/manifest.ts`
- Create: `scripts/export-firestore/auth-export.ts`
- Create: `scripts/export-firestore/run.ts`
- Test: `tests/unit/scripts/export-firestore/manifest.test.ts`
- Test: `tests/unit/scripts/export-firestore/auth-export.test.ts`
- Test: `tests/integration/scripts/export-firestore.integration.test.ts`

- [ ] **Step 1: Napisz test jednostkowy manifestu (failing)**

Utwórz `tests/unit/scripts/export-firestore/manifest.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeStatus, isKnownCollection } from "@/scripts/export-firestore/manifest";
import type { CollectionEntry } from "@/scripts/export-firestore/types";

function entry(over: Partial<CollectionEntry>): CollectionEntry {
  return {
    path: "users/u1/tasks",
    file: "users/u1/tasks.jsonl",
    known: true,
    before: 3,
    lines: 3,
    after: 3,
    sha256: "x",
    ...over,
  };
}

describe("isKnownCollection", () => {
  it("looks at the last path segment", () => {
    expect(isKnownCollection("users/u1/tasks")).toBe(true);
    expect(isKnownCollection("waitlist")).toBe(true);
    expect(isKnownCollection("mystery")).toBe(false);
    expect(isKnownCollection("users/u1/board/main/history")).toBe(false);
  });
});

describe("computeStatus", () => {
  it("is ok when before == lines == after and nothing unknown holds data", () => {
    expect(
      computeStatus([
        entry({}),
        entry({ path: "mystery", known: false, before: 0, lines: 0, after: 0 }),
      ])
    ).toBe("ok");
  });

  it("is mismatch when any count disagrees", () => {
    expect(computeStatus([entry({ lines: 2 })])).toBe("mismatch");
    expect(computeStatus([entry({ before: 2 })])).toBe("mismatch");
    expect(computeStatus([entry({ after: 4 })])).toBe("mismatch");
  });

  it("is needs-review when an unknown collection has documents", () => {
    expect(computeStatus([entry({ path: "mystery", known: false })])).toBe("needs-review");
  });

  it("mismatch wins over needs-review", () => {
    expect(computeStatus([entry({ path: "mystery", known: false, lines: 1 })])).toBe("mismatch");
  });
});
```

- [ ] **Step 2: Napisz test jednostkowy `exportAuthUsers` (failing)**

Utwórz `tests/unit/scripts/export-firestore/auth-export.test.ts` (atrapa `Auth`, bez emulatora; mocki tworzone wewnątrz testów, bo `vitest.config.ts` ma `resetMocks: true`):

```ts
// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Auth } from "firebase-admin/auth";
import { exportAuthUsers } from "@/scripts/export-firestore/auth-export";

const made: string[] = [];
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsx-auth-"));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function user(uid: string) {
  return {
    uid,
    email: `${uid}@example.test`,
    disabled: false,
    metadata: { creationTime: "2026-01-01T00:00:00Z", lastSignInTime: "2026-02-01T00:00:00Z" },
    providerData: [{ providerId: "password" }],
    passwordHash: "SECRET-HASH",
    passwordSalt: "SECRET-SALT",
  };
}

describe("exportAuthUsers", () => {
  it("follows page tokens and writes only account metadata (no hashes)", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ users: [user("u1")], pageToken: "next" })
      .mockResolvedValueOnce({ users: [user("u2")], pageToken: undefined });
    const dir = tmp();

    const result = await exportAuthUsers({ listUsers } as unknown as Auth, dir);

    expect(result).toEqual({ ok: true, users: 2, file: "auth-users.json" });
    expect(listUsers).toHaveBeenNthCalledWith(1, 1000, undefined);
    expect(listUsers).toHaveBeenNthCalledWith(2, 1000, "next");
    const file = path.join(dir, "auth-users.json");
    const text = fs.readFileSync(file, "utf8");
    expect(JSON.parse(text)).toEqual([
      {
        uid: "u1",
        email: "u1@example.test",
        disabled: false,
        createdAt: "2026-01-01T00:00:00Z",
        lastSignInAt: "2026-02-01T00:00:00Z",
        providers: ["password"],
      },
      {
        uid: "u2",
        email: "u2@example.test",
        disabled: false,
        createdAt: "2026-01-01T00:00:00Z",
        lastSignInAt: "2026-02-01T00:00:00Z",
        providers: ["password"],
      },
    ]);
    expect(text).not.toContain("SECRET");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it("reports a failure instead of throwing, and writes no file", async () => {
    const listUsers = vi.fn().mockRejectedValue(new Error("boom"));
    const dir = tmp();

    const result = await exportAuthUsers({ listUsers } as unknown as Auth, dir);

    expect(result).toEqual({ ok: false, error: "boom" });
    expect(fs.existsSync(path.join(dir, "auth-users.json"))).toBe(false);
  });
});
```

- [ ] **Step 3: Napisz test integracyjny eksportu (failing)**

Utwórz `tests/integration/scripts/export-firestore.integration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getFirestore } from "../../../lib/firebase-admin.js";
import { runExport } from "../../../scripts/export-firestore/run.js";
import { decodeValue } from "../../../scripts/export-firestore/serialize.js";
import {
  integrationEnabled,
  readJsonl,
  SEED_TIMESTAMP,
  seed,
  tmpDir,
  wipeEmulator,
} from "./export-helpers.js";

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!integrationEnabled)("runExport (emulator)", () => {
  beforeEach(async () => {
    await wipeEmulator();
  });

  it("exports every collection, flags unknown ones and lists ghost documents", async () => {
    const db = getFirestore();
    await seed(db, { withUnknown: true });
    const outDir = path.join(tmpDir(created), "dump");

    const manifest = await runExport({ db, outDir, pageSize: 2, resume: false });

    expect(manifest.status).toBe("needs-review");
    const byPath = Object.fromEntries(manifest.collections.map((c) => [c.path, c]));
    expect(Object.keys(byPath).sort()).toEqual(
      [
        "mystery",
        "users",
        "users/ghost/tasks",
        "users/u1/board",
        "users/u1/board/main/history",
        "users/u1/notes",
        "users/u1/tasks",
        "waitlist",
      ].sort()
    );
    expect(byPath["users/u1/tasks"]).toMatchObject({ before: 3, lines: 3, after: 3, known: true });
    expect(byPath["users"]).toMatchObject({ before: 1, lines: 1, after: 1 }); // duch users/ghost nie jest liczony
    expect(byPath["mystery"]).toMatchObject({ known: false, lines: 1 });
    expect(manifest.ghosts).toEqual(["users/ghost"]);
    expect(manifest.auth).toEqual({ skipped: true });

    const tasks = readJsonl(path.join(outDir, "users/u1/tasks.jsonl"));
    expect(tasks.map((t) => t._id)).toEqual(["t-a", "t-b", "t-c"]);
    expect(tasks[0]._path).toBe("users/u1/tasks/t-a");
    const restored = decodeValue(tasks[0].data) as {
      createdAt: typeof SEED_TIMESTAMP;
      tags: unknown[];
    };
    expect(restored.createdAt.isEqual(SEED_TIMESTAMP)).toBe(true);
    expect(restored.tags).toEqual(["x", { n: 1 }]);

    expect(fs.statSync(path.join(outDir, "users/u1/tasks.jsonl")).mode & 0o777).toBe(0o600);
    expect(fs.statSync(outDir).mode & 0o777).toBe(0o700);
    expect(fs.existsSync(path.join(outDir, "manifest.json"))).toBe(true);
  });

  it("is ok when no unknown collection holds data", async () => {
    const db = getFirestore();
    await seed(db, { withUnknown: false });
    const outDir = path.join(tmpDir(created), "dump");
    const manifest = await runExport({ db, outDir, pageSize: 500, resume: false });
    expect(manifest.status).toBe("ok");
    expect(manifest.totals.documents).toBe(1 + 3 + 1 + 1 + 1 + 1); // users, tasks, notes, board, ghost task, waitlist
  });

  it("resumes after a crash without duplicating documents", async () => {
    const db = getFirestore();
    await seed(db, { withUnknown: false });

    const full = path.join(tmpDir(created), "full");
    const fullManifest = await runExport({ db, outDir: full, pageSize: 1, resume: false });
    const fullTasks = fs.readFileSync(path.join(full, "users/u1/tasks.jsonl"), "utf8");
    const firstLine = fullTasks.split("\n")[0];

    const resumed = path.join(tmpDir(created), "resumed");
    fs.mkdirSync(path.join(resumed, "users/u1"), { recursive: true });
    fs.writeFileSync(
      path.join(resumed, "users/u1/tasks.jsonl.part"),
      `${firstLine}\n{"_id":"t-b","_pa`
    );

    const manifest = await runExport({ db, outDir: resumed, pageSize: 1, resume: true });

    expect(fs.readFileSync(path.join(resumed, "users/u1/tasks.jsonl"), "utf8")).toBe(fullTasks);
    expect(fs.existsSync(path.join(resumed, "users/u1/tasks.jsonl.part"))).toBe(false);
    expect(manifest.status).toBe("ok");
    const sha = (m: typeof manifest) =>
      m.collections.find((c) => c.path === "users/u1/tasks")?.sha256;
    expect(sha(manifest)).toBe(sha(fullManifest));
  });

  it("refuses to write inside this repository", async () => {
    const db = getFirestore();
    const inside = path.join(process.cwd(), "tests", "tmp-dump-should-not-exist");
    await expect(runExport({ db, outDir: inside, pageSize: 500, resume: false })).rejects.toThrow(
      /drzewie roboczym gita/
    );
    expect(fs.existsSync(inside)).toBe(false);
  });
});
```

- [ ] **Step 4: Uruchom testy i potwierdź, że padają**

```bash
npx vitest run tests/unit/scripts/export-firestore/manifest.test.ts tests/unit/scripts/export-firestore/auth-export.test.ts
FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npx vitest run --config vitest.integration.config.ts tests/integration/scripts/export-firestore.integration.test.ts
```

Expected: oba polecenia FAIL (brak modułów `manifest`, `auth-export` i `run`).

- [ ] **Step 5: Napisz `discover.ts`**

Utwórz `scripts/export-firestore/discover.ts`:

```ts
import type { CollectionReference, Firestore } from "firebase-admin/firestore";

export type Discovery = {
  /** Wszystkie kolekcje (także zagnieżdżone), posortowane po ścieżce. */
  collections: CollectionReference[];
  /** Dokumenty, które nie istnieją, ale mają podkolekcje (np. users/ghost). */
  ghosts: string[];
};

/**
 * Znajduje kolekcje bez zakładania ich listy. listDocuments zwraca także dokumenty-widma,
 * czyli takie, które nie istnieją, ale mają podkolekcje (get na kolekcji ich nie pokaże).
 * Koszt: jeden odczyt na dokument (uwzględnia go count-only).
 */
export async function discoverCollections(db: Firestore): Promise<Discovery> {
  const collections: CollectionReference[] = [];

  async function walk(col: CollectionReference): Promise<void> {
    collections.push(col);
    for (const docRef of await col.listDocuments()) {
      for (const sub of await docRef.listCollections()) await walk(sub);
    }
  }

  for (const col of await db.listCollections()) await walk(col);
  collections.sort((a, b) => a.path.localeCompare(b.path));

  const parentPaths: string[] = [];
  for (const col of collections) {
    const parent = col.parent;
    if (parent && !parentPaths.includes(parent.path)) parentPaths.push(parent.path);
  }
  const ghosts: string[] = [];
  for (const parentPath of parentPaths) {
    const snap = await db.doc(parentPath).get();
    if (!snap.exists) ghosts.push(parentPath);
  }
  ghosts.sort();

  return { collections, ghosts };
}

/** Liczność kolekcji. Zapasowo (gdy emulator/serwer nie wspiera count) czyta same id dokumentów. */
export async function countDocs(col: CollectionReference): Promise<number> {
  try {
    const snap = await col.count().get();
    return snap.data().count;
  } catch {
    const snap = await col.select().get();
    return snap.size;
  }
}
```

- [ ] **Step 6: Napisz `manifest.ts`**

Utwórz `scripts/export-firestore/manifest.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import {
  KNOWN_COLLECTIONS,
  MANIFEST_FILE,
  type CollectionEntry,
  type Manifest,
  type ManifestStatus,
} from "./types";

export function isKnownCollection(collectionPath: string): boolean {
  const last = collectionPath.split("/").pop() ?? "";
  return (KNOWN_COLLECTIONS as readonly string[]).includes(last);
}

export function computeStatus(entries: CollectionEntry[]): ManifestStatus {
  if (entries.some((e) => !(e.before === e.lines && e.lines === e.after))) return "mismatch";
  if (entries.some((e) => !e.known && e.lines > 0)) return "needs-review";
  return "ok";
}

export function writeManifest(outDir: string, manifest: Manifest): void {
  fs.writeFileSync(path.join(outDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + "\n", {
    mode: 0o600,
  });
}

export function readManifest(dir: string): Manifest {
  return JSON.parse(fs.readFileSync(path.join(dir, MANIFEST_FILE), "utf8")) as Manifest;
}
```

- [ ] **Step 7: Napisz `auth-export.ts`**

Utwórz `scripts/export-firestore/auth-export.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import type { Auth } from "firebase-admin/auth";
import { AUTH_USERS_FILE, type AuthExport } from "./types";

/** Zapisuje tylko metadane kont (bez haszy haseł i tokenów). Błąd nie przerywa eksportu danych. */
export async function exportAuthUsers(auth: Auth, outDir: string): Promise<AuthExport> {
  try {
    const users: Array<Record<string, unknown>> = [];
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      for (const user of page.users) {
        users.push({
          uid: user.uid,
          email: user.email ?? null,
          disabled: user.disabled,
          createdAt: user.metadata.creationTime,
          lastSignInAt: user.metadata.lastSignInTime,
          providers: user.providerData.map((p) => p.providerId),
        });
      }
      pageToken = page.pageToken;
    } while (pageToken);
    fs.writeFileSync(path.join(outDir, AUTH_USERS_FILE), JSON.stringify(users, null, 2) + "\n", {
      mode: 0o600,
    });
    return { ok: true, users: users.length, file: AUTH_USERS_FILE };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
```

- [ ] **Step 8: Napisz `run.ts` (na razie `runExport`)**

Utwórz `scripts/export-firestore/run.ts`:

```ts
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { exportAuthUsers } from "./auth-export";
import { countDocs, discoverCollections } from "./discover";
import { exportCollection, type ExportedCollection } from "./exporter";
import { prepareOutDir } from "./guard";
import { computeStatus, isKnownCollection, writeManifest } from "./manifest";
import type { CollectionEntry, Manifest } from "./types";

export type RunExportParams = {
  db: Firestore;
  auth?: Auth;
  outDir: string;
  pageSize: number;
  resume: boolean;
  now?: Date;
  log?: (message: string) => void;
};

export async function runExport(params: RunExportParams): Promise<Manifest> {
  const log = params.log ?? (() => {});
  prepareOutDir(params.outDir, { resume: params.resume });

  const { collections, ghosts } = await discoverCollections(params.db);
  log(`Wykryto kolekcji: ${collections.length}, dokumentów-widm: ${ghosts.length}`);

  const before: Record<string, number> = {};
  for (const col of collections) before[col.path] = await countDocs(col);

  const exported: ExportedCollection[] = [];
  for (const col of collections) {
    log(`Eksport ${col.path} (${before[col.path]} dok.)`);
    exported.push(
      await exportCollection(col, params.outDir, {
        pageSize: params.pageSize,
        resume: params.resume,
      })
    );
  }

  const entries: CollectionEntry[] = [];
  for (const item of exported) {
    const col = collections.find((c) => c.path === item.path);
    if (!col) throw new Error(`Brak kolekcji ${item.path}`);
    entries.push({
      path: item.path,
      file: item.file,
      known: isKnownCollection(item.path),
      before: before[item.path],
      lines: item.lines,
      after: await countDocs(col),
      sha256: item.sha256,
    });
  }

  const auth = params.auth
    ? await exportAuthUsers(params.auth, params.outDir)
    : ({ skipped: true } as const);

  const manifest: Manifest = {
    version: 1,
    tool: "export-firestore",
    exportedAt: (params.now ?? new Date()).toISOString(),
    projectId: process.env.FIREBASE_PROJECT_ID ?? null,
    pageSize: params.pageSize,
    status: computeStatus(entries),
    collections: entries,
    ghosts,
    auth,
    totals: {
      collections: entries.length,
      documents: entries.reduce((sum, e) => sum + e.lines, 0),
    },
  };
  writeManifest(params.outDir, manifest);
  return manifest;
}
```

- [ ] **Step 9: Uruchom testy i potwierdź, że przechodzą**

```bash
npx vitest run tests/unit/scripts/export-firestore/manifest.test.ts tests/unit/scripts/export-firestore/auth-export.test.ts
FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npx vitest run --config vitest.integration.config.ts tests/integration/scripts/export-firestore.integration.test.ts
```

Expected: testy jednostkowe PASS (manifest i auth-export); integracyjne PASS (4 testy). Jeśli któryś test pada, napraw **kod**. Nie zmieniaj oczekiwań w teście, żeby przeszedł. Gdy oczekiwanie wygląda na błędne założenie o danych (np. inna lista kolekcji, niż wynika ze specu §4.3), zatrzymaj się i zgłoś rozbieżność zamiast ją maskować.

- [ ] **Step 10: Commit**

```bash
git add scripts/export-firestore tests/unit/scripts/export-firestore/manifest.test.ts tests/unit/scripts/export-firestore/auth-export.test.ts tests/integration/scripts
git commit -m "feat(export): collection discovery, manifest and runExport orchestration" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Weryfikacja zrzutu (`--verify`)

**Files:**

- Create: `scripts/export-firestore/verify.ts`
- Test: `tests/integration/scripts/verify-firestore.integration.test.ts`

- [ ] **Step 1: Napisz test integracyjny (failing)**

Utwórz `tests/integration/scripts/verify-firestore.integration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getFirestore } from "../../../lib/firebase-admin.js";
import { runExport } from "../../../scripts/export-firestore/run.js";
import { verifyDump } from "../../../scripts/export-firestore/verify.js";
import { integrationEnabled, seed, tmpDir, wipeEmulator } from "./export-helpers.js";

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!integrationEnabled)("verifyDump (emulator)", () => {
  let outDir: string;

  beforeEach(async () => {
    await wipeEmulator();
    const db = getFirestore();
    await seed(db, { withUnknown: false });
    outDir = path.join(tmpDir(created), "dump");
    await runExport({ db, outDir, pageSize: 500, resume: false });
  });

  it("passes for an untouched dump", async () => {
    expect(await verifyDump(outDir, getFirestore())).toEqual({ ok: true, problems: [] });
  });

  it("fails when a document was added to Firestore after the export", async () => {
    const db = getFirestore();
    await db.doc("users/u1/tasks/t-new").set({ title: "late" });
    const result = await verifyDump(outDir, db);
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toMatch(/users\/u1\/tasks.*4.*3/);
  });

  it("fails when a new collection appeared after the export", async () => {
    const db = getFirestore();
    await db.doc("fresh/f1").set({ a: 1 });
    const result = await verifyDump(outDir, db);
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toMatch(/nowa kolekcja fresh/);
  });

  it("fails when a dump file was tampered with", async () => {
    const file = path.join(outDir, "users/u1/tasks.jsonl");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("t-a", "t-X"));
    const result = await verifyDump(outDir, getFirestore());
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toMatch(/users\/u1\/tasks\.jsonl.*sha256/);
  });

  it("fails when a dump file is missing", async () => {
    fs.rmSync(path.join(outDir, "users/u1/notes.jsonl"));
    const result = await verifyDump(outDir, getFirestore());
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toMatch(/brak pliku users\/u1\/notes\.jsonl/);
  });

  it("fails when manifest.json is missing", async () => {
    fs.rmSync(path.join(outDir, "manifest.json"));
    const result = await verifyDump(outDir, getFirestore());
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatch(/manifest\.json/);
  });
});
```

- [ ] **Step 2: Uruchom test i potwierdź, że pada**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npx vitest run --config vitest.integration.config.ts tests/integration/scripts/verify-firestore.integration.test.ts`
Expected: FAIL (brak modułu `verify`).

- [ ] **Step 3: Napisz `verify.ts`**

Utwórz `scripts/export-firestore/verify.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import type { Firestore } from "firebase-admin/firestore";
import { countDocs, discoverCollections } from "./discover";
import { describeFile } from "./exporter";
import { readManifest } from "./manifest";
import { MANIFEST_FILE } from "./types";

export type VerifyResult = { ok: boolean; problems: string[] };

/**
 * Niezależna weryfikacja istniejącego zrzutu: pliki vs manifest (sha256, linie)
 * oraz manifest vs bieżący stan Firestore (liczności, nowe kolekcje).
 */
export async function verifyDump(dir: string, db: Firestore): Promise<VerifyResult> {
  let manifest;
  try {
    manifest = readManifest(dir);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, problems: [`nie można wczytać ${MANIFEST_FILE}: ${reason}`] };
  }

  const problems: string[] = [];
  if (manifest.status !== "ok") {
    problems.push(`status eksportu to "${manifest.status}", a nie "ok"`);
  }

  const { collections } = await discoverCollections(db);

  for (const entry of manifest.collections) {
    if (!fs.existsSync(path.join(dir, entry.file))) {
      problems.push(`brak pliku ${entry.file}`);
      continue;
    }
    const actual = describeFile(entry.path, dir, entry.file);
    if (actual.sha256 !== entry.sha256) {
      problems.push(`${entry.file}: sha256 różni się od manifestu`);
    }
    if (actual.lines !== entry.lines) {
      problems.push(`${entry.file}: ${actual.lines} linii w pliku, ${entry.lines} w manifeście`);
    }
    const col = collections.find((c) => c.path === entry.path);
    const now = col ? await countDocs(col) : 0;
    if (now !== entry.before) {
      problems.push(
        `${entry.path}: w Firestore jest teraz ${now} dok., a w eksporcie było ${entry.before}`
      );
    }
  }

  for (const col of collections) {
    if (!manifest.collections.some((e) => e.path === col.path)) {
      problems.push(`nowa kolekcja ${col.path} (nie ma jej w eksporcie)`);
    }
  }

  return { ok: problems.length === 0, problems };
}
```

- [ ] **Step 4: Uruchom test i potwierdź, że przechodzi**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npx vitest run --config vitest.integration.config.ts tests/integration/scripts/verify-firestore.integration.test.ts`
Expected: PASS (6 testów).

- [ ] **Step 5: Commit**

```bash
git add scripts/export-firestore/verify.ts tests/integration/scripts/verify-firestore.integration.test.ts
git commit -m "feat(export): --verify checks a dump against its manifest and live Firestore" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Raport `--count-only`

**Files:**

- Modify: `scripts/export-firestore/run.ts` (dopisz `countReport`, `formatCountReport`)
- Test: `tests/unit/scripts/export-firestore/report.test.ts`
- Test: `tests/integration/scripts/export-firestore.integration.test.ts` (nowy `it`)

- [ ] **Step 1: Napisz test jednostkowy formatowania (failing)**

Utwórz `tests/unit/scripts/export-firestore/report.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatCountReport, type CountReport } from "@/scripts/export-firestore/run";

const base: CountReport = {
  rows: [
    { path: "users/u1/tasks", count: 3, known: true },
    { path: "mystery", count: 1, known: false },
  ],
  ghosts: ["users/ghost"],
  total: 4,
  estimatedReads: 8,
};

describe("formatCountReport", () => {
  it("lists collections, ghosts, totals and flags unknown collections", () => {
    const text = formatCountReport(base);
    expect(text).toContain("users/u1/tasks");
    expect(text).toContain("3");
    expect(text).toMatch(/NIEZNANA.*mystery/s);
    expect(text).toContain("users/ghost");
    expect(text).toMatch(/Razem dokumentów: 4/);
    expect(text).toMatch(/odczytów.*8/);
  });

  it("warns when estimated reads exceed 40k", () => {
    const text = formatCountReport({ ...base, total: 25000, estimatedReads: 50000 });
    expect(text).toMatch(/UWAGA.*limit/);
  });

  it("does not warn for small datasets", () => {
    expect(formatCountReport(base)).not.toMatch(/UWAGA/);
  });
});
```

- [ ] **Step 2: Dopisz test integracyjny `countReport`**

W `tests/integration/scripts/export-firestore.integration.test.ts` zmień import `run.js` na `import { countReport, runExport } from "../../../scripts/export-firestore/run.js";` i dodaj wewnątrz `describe` nowy test:

```ts
it("count-only reports counts without writing any file", async () => {
  const db = getFirestore();
  await seed(db, { withUnknown: true });

  const report = await countReport(db);

  const row = (p: string) => report.rows.find((r) => r.path === p);
  expect(row("users/u1/tasks")).toMatchObject({ count: 3, known: true });
  expect(row("mystery")).toMatchObject({ count: 1, known: false });
  expect(report.ghosts).toEqual(["users/ghost"]);
  expect(report.total).toBe(1 + 3 + 1 + 1 + 1 + 1 + 1 + 1); // users, tasks, notes, board, ghost task, waitlist, history, mystery
  expect(report.estimatedReads).toBe(report.total * 2);
});
```

- [ ] **Step 3: Uruchom testy i potwierdź, że padają**

```bash
npx vitest run tests/unit/scripts/export-firestore/report.test.ts
FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npx vitest run --config vitest.integration.config.ts tests/integration/scripts/export-firestore.integration.test.ts
```

Expected: FAIL (brak eksportów `formatCountReport`, `countReport`).

- [ ] **Step 4: Dopisz do `run.ts`**

Na końcu `scripts/export-firestore/run.ts` dodaj:

```ts
export type CountRow = { path: string; count: number; known: boolean };

export type CountReport = {
  rows: CountRow[];
  ghosts: string[];
  total: number;
  /** Discovery czyta listę dokumentów, eksport czyta je drugi raz: ~2 odczyty na dokument. */
  estimatedReads: number;
};

export async function countReport(db: Firestore): Promise<CountReport> {
  const { collections, ghosts } = await discoverCollections(db);
  const rows: CountRow[] = [];
  for (const col of collections) {
    rows.push({ path: col.path, count: await countDocs(col), known: isKnownCollection(col.path) });
  }
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return { rows, ghosts, total, estimatedReads: total * 2 };
}

const READS_WARNING_THRESHOLD = 40_000;

export function formatCountReport(report: CountReport): string {
  const width = Math.max(10, ...report.rows.map((r) => r.path.length));
  const lines = ["Kolekcje:"];
  for (const row of report.rows) {
    const flag = row.known ? "" : "   <-- NIEZNANA kolekcja";
    lines.push(`  ${row.path.padEnd(width)}  ${String(row.count).padStart(7)}${flag}`);
  }
  if (report.ghosts.length > 0) {
    lines.push("", "Dokumenty-widma (nie istnieją, ale mają podkolekcje):");
    for (const ghost of report.ghosts) lines.push(`  ${ghost}`);
  }
  lines.push("", `Razem dokumentów: ${report.total}`);
  lines.push(`Szacowana liczba odczytów przy pełnym eksporcie: ${report.estimatedReads}`);
  if (report.estimatedReads > READS_WARNING_THRESHOLD) {
    lines.push(
      "UWAGA: blisko dziennego limitu 50 000 odczytów. Eksport może wymagać --resume następnego dnia."
    );
  }
  return lines.join("\n");
}
```

- [ ] **Step 5: Uruchom testy i potwierdź, że przechodzą**

```bash
npx vitest run tests/unit/scripts/export-firestore/report.test.ts
FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npx vitest run --config vitest.integration.config.ts tests/integration/scripts/export-firestore.integration.test.ts
```

Expected: PASS (jednostkowe 3, integracyjne 5).

- [ ] **Step 6: Commit**

```bash
git add scripts/export-firestore/run.ts tests/unit/scripts/export-firestore/report.test.ts tests/integration/scripts/export-firestore.integration.test.ts
git commit -m "feat(export): --count-only report with read estimate" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Punkt wejścia CLI i test „tylko odczyt"

**Files:**

- Create: `scripts/export-firestore.ts`
- Test: `tests/unit/scripts/export-firestore/read-only.test.ts`

- [ ] **Step 1: Napisz test statyczny (failing, bo skrypt jeszcze nie istnieje, a test wymaga jego obecności)**

Utwórz `tests/unit/scripts/export-firestore/read-only.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FORBIDDEN =
  /\.(set|update|delete|add|create|batch|bulkWriter|runTransaction|recursiveDelete|createUser|deleteUser|updateUser)\s*\(/;

function exportSources(): string[] {
  const root = path.join(process.cwd(), "scripts");
  const files = [path.join(root, "export-firestore.ts")];
  const dir = path.join(root, "export-firestore");
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".ts")) files.push(path.join(dir, name));
  }
  return files;
}

describe("export script is read-only", () => {
  it("has sources to check", () => {
    const files = exportSources();
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const file of files) expect(fs.existsSync(file)).toBe(true);
  });

  it("contains no Firestore or Auth write calls", () => {
    for (const file of exportSources()) {
      // createHash(...).update(...) to funkcja skrótu z node:crypto, a nie zapis do Firestore.
      const text = fs
        .readFileSync(file, "utf8")
        .replace(/createHash\([^)]*\)\.update\(/g, "createHash(...).feed(");
      const hit = text.split("\n").findIndex((line) => FORBIDDEN.test(line));
      expect(
        hit,
        `${path.relative(process.cwd(), file)}:${hit + 1} zawiera wywołanie zapisujące`
      ).toBe(-1);
    }
  });
});
```

- [ ] **Step 2: Uruchom test i potwierdź, że pada**

Run: `npx vitest run tests/unit/scripts/export-firestore/read-only.test.ts`
Expected: FAIL w pierwszym teście (brak `scripts/export-firestore.ts`).

- [ ] **Step 3: Napisz `scripts/export-firestore.ts`**

Utwórz `scripts/export-firestore.ts`:

```ts
/**
 * Eksport Firestore do plików (etap 0a). Tylko odczyt.
 *
 *   npx tsx --env-file=.env scripts/export-firestore.ts --count-only
 *   npx tsx --env-file=.env scripts/export-firestore.ts [--out <katalog>] [--skip-auth]
 *   npx tsx --env-file=.env scripts/export-firestore.ts --resume --out <katalog>
 *   npx tsx --env-file=.env scripts/export-firestore.ts --verify <katalog>
 *
 * Poświadczenia jak w aplikacji (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * albo GOOGLE_APPLICATION_CREDENTIALS). Z FIRESTORE_EMULATOR_HOST działa na emulatorze.
 *
 * Kody wyjścia: 0 ok, 1 błąd lub niezgodność liczności, 2 nieznana kolekcja z danymi (do decyzji).
 */
import { getAuth, getFirestore } from "@/lib/firebase-admin";
import { parseCliArgs } from "./export-firestore/args";
import { defaultOutDir } from "./export-firestore/guard";
import { countReport, formatCountReport, runExport } from "./export-firestore/run";
import { verifyDump } from "./export-firestore/verify";

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2));
  const db = getFirestore();

  if (args.mode === "count-only") {
    console.log(formatCountReport(await countReport(db)));
    return 0;
  }

  if (args.mode === "verify") {
    const result = await verifyDump(args.dir, db);
    if (result.ok) {
      console.log(`Weryfikacja ${args.dir}: OK (pliki zgodne z manifestem i z Firestore).`);
      return 0;
    }
    console.error(`Weryfikacja ${args.dir}: NIEPOWODZENIE`);
    for (const problem of result.problems) console.error(`  - ${problem}`);
    return 1;
  }

  const outDir = args.out ?? defaultOutDir();
  console.log(`Katalog wyjściowy: ${outDir}`);
  const manifest = await runExport({
    db,
    auth: args.skipAuth ? undefined : getAuth(),
    outDir,
    pageSize: args.pageSize,
    resume: args.resume,
    log: (message) => console.log(message),
  });

  console.log("");
  for (const c of manifest.collections) {
    const same = c.before === c.lines && c.lines === c.after;
    console.log(
      `${same ? "OK  " : "ROZJAZD"} ${c.path}: przed=${c.before} plik=${c.lines} po=${c.after}${c.known ? "" : "  (NIEZNANA)"}`
    );
  }
  if (manifest.ghosts.length > 0) console.log(`Dokumenty-widma: ${manifest.ghosts.join(", ")}`);
  if ("ok" in manifest.auth && manifest.auth.ok === false) {
    console.warn(`Uwaga: nie wyeksportowano kont Auth: ${manifest.auth.error}`);
  }
  console.log(`\nStatus: ${manifest.status}  (dokumentów: ${manifest.totals.documents})`);

  if (manifest.status === "mismatch") return 1;
  if (manifest.status === "needs-review") {
    console.error(
      "Wykryto nieznane kolekcje z danymi. Przejrzyj je, zanim przejdziesz do kroku 0b."
    );
    return 2;
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
```

- [ ] **Step 4: Uruchom test i potwierdź, że przechodzi**

Run: `npx vitest run tests/unit/scripts/export-firestore/read-only.test.ts`
Expected: PASS. Jeśli drugi test wskaże `plik:linia`, usuń lub przepisz tę linię (np. zamień `Map.set` na obiekt), nie osłabiaj wyrażenia `FORBIDDEN`.

- [ ] **Step 5: Test ręczny CLI na emulatorze**

Zasiej dane i uruchom wszystkie tryby (skrypt `tsx -e` poniżej zapisuje dane testowe do **emulatora**, nie do produkcji, bo ma ustawione `FIRESTORE_EMULATOR_HOST`):

```bash
export FIRESTORE_EMULATOR_HOST=localhost:8080
npx tsx -e '
import admin from "firebase-admin";
admin.initializeApp({ projectId: "demo-nexus" });
const db = admin.firestore();
await db.doc("users/u1/tasks/a").set({ title: "a" });
await db.doc("users/u1/tasks/b").set({ title: "b" });
await db.doc("users/u1/notes/n1").set({ title: "n" });
'
npx tsx scripts/export-firestore.ts --count-only
OUT=$(mktemp -d)/dump
npx tsx scripts/export-firestore.ts --out "$OUT" --skip-auth; echo "exit=$?"
npx tsx scripts/export-firestore.ts --verify "$OUT"; echo "exit=$?"
npx tsx scripts/export-firestore.ts --out ./tmp-should-fail --skip-auth; echo "exit=$?"
unset FIRESTORE_EMULATOR_HOST
```

Expected:

- `--count-only`: tabela z `users/u1/notes 1`, `users/u1/tasks 2`, `users/ghost`-podobne widma tylko jeśli istnieją; `Razem dokumentów: 3`.
- eksport: wiersze `OK` dla każdej kolekcji, `Status: ok`, `exit=0`.
- `--verify`: `Weryfikacja …: OK`, `exit=0`.
- eksport do `./tmp-should-fail`: komunikat `leży w drzewie roboczym gita`, `exit=1`, katalog nie powstał (`ls tmp-should-fail` → brak).

Po teście wyczyść emulator: `curl -s -X DELETE "http://localhost:8080/emulator/v1/projects/demo-nexus/databases/(default)/documents"`.

- [ ] **Step 6: Commit**

```bash
git add scripts/export-firestore.ts tests/unit/scripts/export-firestore/read-only.test.ts
git commit -m "feat(export): CLI entry point and read-only guard test" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Pełna weryfikacja kodu

**Files:** brak zmian (chyba że sprawdzenia coś wykryją).

- [ ] **Step 1: Wszystkie testy jednostkowe nowych modułów**

Run: `npx vitest run tests/unit/scripts`
Expected: PASS (serialize, guard, args, exporter, manifest, auth-export, report, read-only).

- [ ] **Step 2: Cały zestaw jednostkowy (czy nic innego nie pękło)**

Run: `npm run test:run`
Expected: PASS jak przed zmianami (stan bazowy: wszystkie testy przechodziły przed tym planem; jeśli któryś pada, sprawdź `git stash` i porównaj, zanim cokolwiek poprawisz).

- [ ] **Step 3: Testy integracyjne skryptu na emulatorze**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npx vitest run --config vitest.integration.config.ts tests/integration/scripts`
Expected: PASS (7 przypadków `exportCollection`, 5 testów `runExport`/count-only i 6 testów weryfikacji).

- [ ] **Step 4: Typecheck i lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: brak błędów w `scripts/export-firestore*` i `tests/**/export*`. Błędy spoza tych plików, istniejące przed planem, zignoruj i odnotuj. (Zgodnie z `CLAUDE.md` można zlecić to `cursor`: „przeszło” albo lista `plik:linia + przyczyna”.)

- [ ] **Step 5: Zatrzymaj emulator**

```bash
docker compose -f docker-compose-test.yml down
```

- [ ] **Step 6: Commit poprawek (tylko jeśli były)**

```bash
git status --short
# jeśli coś zmieniono:
git add -A scripts tests
git commit -m "fix(export): address typecheck and lint findings" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Pierwszy prawdziwy przebieg (ręcznie, z użytkownikiem)

To jest operacja na produkcyjnym Firestore (tylko odczyt) i na danych osobistych, więc **wykonuje ją użytkownik lub agent na jego wyraźne polecenie**, z poświadczeniami z `.env`. Agent nie wypisuje kluczy ani zawartości zrzutu.

- [ ] **Step 1: Przygotowanie**

```bash
node --version    # wymagane >= 20.6 (flaga --env-file)
```

Zatrzymaj serwer aplikacji (`npm run dev`), żeby nic nie zapisywało do Firestore w trakcie. Upewnij się, że `.env` ma `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` i że **nie** ma ustawionego `FIRESTORE_EMULATOR_HOST` (inaczej skrypt trafi w emulator).

- [ ] **Step 2: Liczenie (zero plików)**

```bash
npx tsx --env-file=.env scripts/export-firestore.ts --count-only
```

Odczytaj z raportu: ile jest użytkowników w `users` (odpowiedź na pytanie **O6**), czy są kolekcje oznaczone `NIEZNANA`, ile dokumentów-widm, szacowana liczba odczytów. Gdy `UWAGA` przy limicie, podziel pracę na dwa dni z `--resume`.

- [ ] **Step 3: Pełny eksport**

```bash
npx tsx --env-file=.env scripts/export-firestore.ts
```

Expected: `Status: ok`, exit 0. Dla `Status: needs-review` (exit 2) zdecyduj, co zrobić z nieznanymi kolekcjami, zanim ruszysz 0b. Dla `mismatch` (exit 1) ustal przyczynę (dane zapisywane w trakcie?) i powtórz eksport do nowego katalogu.

- [ ] **Step 4: Weryfikacja zrzutu**

```bash
npx tsx --env-file=.env scripts/export-firestore.ts --verify ~/backups/second-brain-firestore/<katalog z kroku 3>
```

Expected: `Weryfikacja …: OK`.

- [ ] **Step 5: Druga kopia**

Skopiuj katalog zrzutu na osobny nośnik (zrzut zawiera dane osobiste, nie wysyłaj go do chmury bez szyfrowania). Zweryfikuj kopię: `diff -r` albo porównanie `sha256sum` plików z `manifest.json`.

- [ ] **Step 6: Zapisz wynik w specu**

Dopisz do `docs/superpowers/specs/2026-11-12-etap-0-odpiecie-firebase-design.md` w §8 rozstrzygnięcie **O6** (liczba użytkowników) i ewentualne nieznane kolekcje, bez identyfikatorów i danych (repo jest publiczne). Commit lokalny, bez pusha.

---

## Self-Review (wykonany po napisaniu planu)

**1. Pokrycie specu (§4):**

| Wymóg specu                                                           | Zadanie                                                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 tylko odczyt, test statyczny                                      | Task 8 (test), reguła przekrojowa                                                                                                                             |
| 4.1 pełna wierność                                                    | Task 1 (serialize), Task 4 (zapis bez konwersji)                                                                                                              |
| 4.1 wyjście poza repo, odmowa w drzewie gita, 0700/0600               | Task 2, Task 4 (tryb 0o600), Task 5 (testy trybów)                                                                                                            |
| 4.2 format JSONL, znaczniki typów, manifest z sha256                  | Task 1, 4, 5                                                                                                                                                  |
| 4.2 `auth-users.json` bez haszy                                       | Task 5 (`auth-export.ts`, test jednostkowy na atrapie `Auth`: paginacja, brak haszy, błąd bez wyjątku); działanie na prawdziwym Auth sprawdza dopiero Task 10 |
| 4.3 dynamiczne wykrywanie, nieznane, widma                            | Task 5 (`discover.ts`), Task 0 (sonda)                                                                                                                        |
| 4.4 count przed/po, niezgodność ≠ 0                                   | Task 5 (`computeStatus`), Task 8 (kody wyjścia)                                                                                                               |
| 4.5 `--count-only`, pełny, `--verify`                                 | Task 7, 5, 6; CLI w Task 8                                                                                                                                    |
| 4.6 koszt odczytów, `--resume`, ostrzeżenie 40 tys.                   | Task 7 (ostrzeżenie), Task 4/5 (resume)                                                                                                                       |
| 4.7 testy na emulatorze, odmowa w gicie, niezgodność, uszkodzony plik | Task 5, 6                                                                                                                                                     |

Rozbieżność względem specu: spec 4.2 mówił `root/<kolekcja>.jsonl` i `users/<uid>/<kolekcja>.jsonl`; plan doprecyzowuje reguły dla głębszych zagnieżdżeń (`fileFor`, Task 4). Po zakończeniu planu warto jednym zdaniem zsynchronizować spec 4.2.

**2. Skan placeholderów:** brak „TBD/TODO”; każdy krok kodowy ma pełny kod, każde uruchomienie ma komendę i oczekiwany wynik.

**3. Spójność nazw i typów:** `exportCollection`, `fileFor`, `describeFile`, `truncateToLastFullLine` (Task 4) są używane w Task 5 i 6 pod tymi samymi nazwami; `CollectionEntry`, `Manifest`, `ManifestStatus` zdefiniowane w Task 1 i użyte w Task 5–7; `runExport`, `countReport`, `formatCountReport`, `CountReport` (Task 5/7) zgodne z użyciem w CLI (Task 8); `discoverCollections` zwraca `{ collections, ghosts }` konsekwentnie w Task 5, 6, 7; `countDocs` zdefiniowane w `discover.ts` i importowane z niego w `run.ts`/`verify.ts`.

**Znane ograniczenia (świadome):** liczby całkowite poza ±2^53 przerywają eksport zamiast zostać zapisane z utratą precyzji; typ `VectorValue` i inne nieznane klasy też przerywają (głośny błąd, nie cicha strata). Gdyby produkcyjne dane takie wartości miały, `--count-only` tego nie wykryje, dopiero eksport, i wtedy trzeba rozszerzyć `serialize.ts` osobnym zadaniem.
