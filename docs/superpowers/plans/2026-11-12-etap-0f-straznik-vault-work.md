# Etap 0f: `Vault/Work/` poza gitem i strażnik dostępu do danych etatu

> **Dla wykonawcy:** REQUIRED SUB-SKILL: superpowers:executing-plans. Kroki mają checkboxy (`- [ ]`). Komendy testów, tsc, lint, build i e2e uruchamia `cursor` (`scripts/ask-helper.sh --role task`, w prompcie „nie edytuj plików”, wynik: „przeszło” albo lista `plik:linia + przyczyna`), review diffa robi `agy --role review`. Plan powstał z odczytu kodu, bez uruchamiania czegokolwiek: weryfikacja należy do wykonawcy (czerwony test, zielony test). Task 1 zmienia **inne repo** (NEXUS), więc wymaga jednoznacznej zgody użytkownika; Tasks 2–5 to zwykły kod w repo Second_brain.

**Cel:** dane etatu (`Vault/Work/`) nie mogą trafić do prywatnego repo NEXUS na GitHubie ani przypadkiem zostać odczytane/zapisane przez aplikację, gdy ochrona gita nie działa. Po tym etapie: (1) repo NEXUS ignoruje `/Vault/Work/`, (2) warstwa plikowa aplikacji **domyślnie odmawia** dostępu do `Work/` (zamknięte z założenia), (3) jedyna droga do `Work/` prowadzi przez strażnika, który sprawdza `git check-ignore` i brak śledzonych plików.

**Architektura:** dwie warstwy, bo `lib/nexus/vault-fs.ts` ma test statyczny zabraniający `child_process`. Warstwa A (`vault-fs.ts`, czysta): `resolveInsideVault` odrzuca ścieżki, których pierwszy człon to `Work` (bez rozróżniania wielkości liter, także po rozwiązaniu dowiązań), chyba że wywołujący poda `allowWork: true`. Warstwa B (`lib/workGuard.ts`, poza `lib/nexus/`): uruchamia `git` i dopiero po pozytywnym wyniku zwraca opcje z `allowWork: true`. Test statyczny pilnuje, że nikt inny nie ustawia `allowWork`.

**Stos:** Next 14.2, TypeScript, Vitest (jsdom domyślnie, `@vitest-environment node` w tych testach), `git` 2.x w PATH.

**Stan wyjściowy (zweryfikowany w kodzie, 2026-11-12):** w repo NEXUS `.gitignore` **nie ma** wpisu o `Work/`, folder `Vault/Work/` nie istnieje, `git check-ignore` na nim zwraca „nie ignorowany”. W aplikacji nic nie odwołuje się do `Work/` (`grep` po `app`, `src`, `lib`, `services`), nie ma też żadnej funkcji etatu. Cała aplikacja czyta i pisze pliki vaulta wyłącznie przez `lib/nexus/vault-fs.ts` (5 wywołań `resolveInsideVault` w liniach 153, 168, 183, 201, 224). Osobna kopia `resolveInsideVault` w `scripts/import-to-vault/write.ts` obsługuje tylko ustalone katalogi (`Notes/`, `Tasks/`, `Resources/` itd.) i nie dotyka `Work/`.

---

## Decyzje (domyślne; użytkownik może je zmienić przed wykonaniem)

- **D1. Wzorzec w `.gitignore` NEXUS: `/Vault/Work/`** (zakotwiczony w korzeniu repo), a nie sam `Work/` ze specu §7. Powód: niezakotwiczone `Work/` ignorowałoby też każdy folder `Work` zagnieżdżony głębiej (np. `Vault/Projects/<id>/Work/`), a to są zwykłe, śledzone dane. Spec mówi „wpis `Work/`”; to doprecyzowanie, nie zmiana celu.
- **D2. Zamknięte z założenia (fail-closed).** Dziś nie ma funkcji etatu, więc strażnik nie ma jeszcze użytkownika. Mimo to blokadę w `vault-fs.ts` wprowadzamy teraz: od tej chwili nic w aplikacji nie może dotknąć `Work/` przypadkiem, a przyszła funkcja etatu musi świadomie przejść przez `assertWorkAccess`.
- **D3. Tylko `Work` na poziomie korzenia vaulta** jest strefą chronioną (pierwszy człon ścieżki, bez rozróżniania wielkości liter: vault bywa na `/mnt/e` czyli na systemie plików bez rozróżniania wielkości liter). Człon porównujemy po obcięciu końcowych kropek i spacji (Windows/drvfs traktuje `Work.` i `Work ` jak `Work`) oraz z krótką nazwą 8.3 (`WORK~1`). `Workshop/`, `Work.md`, `Notes/Work/…` nie są blokowane.
- **D4. Strażnik sprawdza trzy rzeczy** (wszystkie przez `git`, bez powłoki, `execFile` z limitem czasu 5 s): (a) vault leży w repozytorium git, (b) `git check-ignore -q --no-index -- Work/.nexus-ignore-probe` kończy się kodem 0, (c) `git ls-files -- Work` nic nie zwraca (plik już śledzony trafiłby do GitHuba mimo reguły). Każdy inny wynik, w tym brak gita lub błąd uruchomienia, **blokuje**.
- **D5. Sprawdzenie przy każdym wejściu do strefy etatu, bez cache.** Koszt to kilka milisekund, a cache utrzymywałby dostęp po usunięciu wpisu z `.gitignore` w trakcie sesji. „Przy starcie” ze specu §5 realizujemy jako „przed każdym otwarciem strefy”, co jest ścisłe i prostsze. **Świadome odroczenie:** `assertWorkAccess` nie jest w tym etapie wpięty w żaden kod uruchomieniowy (nie ma funkcji etatu); jego wpięcie to część etapu 1, a do tego czasu `Work/` jest po prostu zamknięte.
- **D6. Bez zmiany w UI i bez nowych tras API.** Nie ma funkcji etatu, więc nie ma czego pokazywać. Błąd `WorkAccessBlockedError` (403, po polsku) przejdzie przez istniejące `handleServiceError`, gdy funkcja etatu powstanie.
- **D7. Poza zakresem:** kopia zapasowa `Vault/Work/` (spec §5: osobny, lokalny backup), sprawdzenie polityki firmy, `_registry.work.yaml`, kalendarz etatu, blokada wysyłki do AI. To etapy 1 i dalsze.

## Pliki

**Tworzone:** `lib/workGuard.ts`, `tests/unit/lib/workGuard.test.ts`, `tests/unit/allow-work.static.test.ts`.

**Modyfikowane:** `lib/nexus/vault-fs.ts`, `tests/unit/lib/nexus/vault-fs.test.ts`, `README.md`, `docs/superpowers/specs/2026-11-12-etap-0-odpiecie-firebase-design.md`, `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md`. W repo NEXUS: `.gitignore`.

---

## Task 0: gałąź i stan wyjściowy

- [ ] **Step 1: Gałąź**

```bash
cd ~/projects/Brain_7224/Second_brain
git status -sb | head -3        # upewnić się, na której gałęzi jesteśmy i że drzewo czyste
git checkout main && git pull
git checkout -b feat/etap-0f-straznik-vault-work
```

- [ ] **Step 2: Stan wyjściowy (cursor)**

Prompt do `cursor`: „W `Second_brain` uruchom `npx tsc --noEmit`, `npm run lint`, `npx vitest run`. Nie edytuj plików. Odpowiedz: przeszło albo lista `plik:linia + przyczyna`, oraz liczby testów i plików.” Oczekiwane: `tsc` czysty, 3 znane ostrzeżenia `react-hooks`, testy zielone.

---

## Task 1: wpis w `.gitignore` repo NEXUS (inne repo, wymaga zgody)

**Zasada:** to jedyna zmiana poza `Second_brain`. Robi ją człowiek lub agent poza aplikacją (aplikacja pisze tylko w `Vault/`). Agent **pyta użytkownika** o zgodę na edycję i commit w repo NEXUS, a o push pyta osobno.

- [ ] **Step 1: Potwierdzić stan przed zmianą**

```bash
cd ~/projects/Brain_7224/NEXUS
git status -sb | head -3                          # czyste drzewo, gałąź main
ls Vault/Work 2>&1 | head -1                      # oczekiwane: "No such file or directory"
git check-ignore -v Vault/Work/_registry.work.yaml; echo "rc=$?"   # oczekiwane: rc=1 (nie ignorowany)
git ls-files Vault/Work                           # oczekiwane: puste
```

Jeśli `Vault/Work` już istnieje lub `git ls-files` coś wypisuje, **stop**: dane etatu mogły już trafić do repo; zgłosić użytkownikowi, nie naprawiać samodzielnie.

- [ ] **Step 2: Dopisać wpis na końcu `.gitignore` NEXUS**

```
# Dane etatu: tylko lokalnie, nigdy w repo (Second_brain: docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md, §5)
/Vault/Work/
```

- [ ] **Step 3: Zweryfikować regułę**

```bash
git check-ignore -v Vault/Work/_registry.work.yaml   # oczekiwane: linia z .gitignore:<n>:/Vault/Work/ i ścieżką
git check-ignore -v Vault/Work/                      # j.w.
git check-ignore -v Vault/Projects/x/Work/a.md; echo "rc=$?"   # oczekiwane: rc=1 (zagnieżdżone Work NIE jest ignorowane, D1)
git status --short                                   # oczekiwane: tylko " M .gitignore"
```

- [ ] **Step 4: Commit w repo NEXUS (po zgodzie)**

```bash
git add .gitignore
git commit -m "chore: Vault/Work/ poza gitem (dane etatu tylko lokalnie)"
```

Push do prywatnego remote tylko na wyraźne polecenie użytkownika.

---

## Task 2: `vault-fs.ts` odmawia dostępu do `Work/` (TDD)

**Pliki:** `lib/nexus/vault-fs.ts`, `tests/unit/lib/nexus/vault-fs.test.ts`.

- [ ] **Step 1: Napisać czerwone testy**

W `tests/unit/lib/nexus/vault-fs.test.ts` dodać `WorkAreaBlockedError` do importu z `@/lib/nexus/vault-fs` i na końcu pliku dopisać blok (zmienne `tmp`, `root` i `beforeEach/afterEach` już istnieją w pliku):

```ts
describe("strefa Work/ (dane etatu) jest zamknięta z założenia", () => {
  const BLOCKED = ["Work/a.yaml", "work/a.yaml", "WORK/sub/a.md", "./Work/a.yaml", "Work"];
  const anyVersion = { size: 0, hash: "" };

  it.each(BLOCKED)("odrzuca %s dla odczytu, zapisu, listy i usunięcia", (rel) => {
    expect(() => readVaultFile(rel, { root })).toThrow(WorkAreaBlockedError);
    expect(() => writeVaultFile(rel, "x", { root, expected: null })).toThrow(WorkAreaBlockedError);
    expect(() => listVaultFiles(rel, { root })).toThrow(WorkAreaBlockedError);
    expect(() => deleteVaultFile(rel, { root, expected: anyVersion })).toThrow(
      WorkAreaBlockedError
    );
  });

  it("odrzuca updateVaultFile", async () => {
    await expect(updateVaultFile("Work/a.yaml", () => "x", { root })).rejects.toThrow(
      WorkAreaBlockedError
    );
  });

  it("błąd to DomainError 403 z czytelnym komunikatem", () => {
    try {
      readVaultFile("Work/a.yaml", { root });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).statusCode).toBe(403);
      expect((err as Error).message).toContain("Work/");
    }
  });

  it("po odmowie nie tworzy nic na dysku", () => {
    expect(() => writeVaultFile("Work/a.yaml", "x", { root, expected: null })).toThrow();
    expect(fs.existsSync(path.join(root, "Work"))).toBe(false);
  });

  it("odrzuca dowiązanie z innego katalogu do Work/", () => {
    fs.mkdirSync(path.join(root, "Work"));
    fs.writeFileSync(path.join(root, "Work", "a.yaml"), "x");
    fs.mkdirSync(path.join(root, "Notes"));
    fs.symlinkSync(path.join(root, "Work"), path.join(root, "Notes", "alias"));
    expect(() => readVaultFile("Notes/alias/a.yaml", { root })).toThrow(WorkAreaBlockedError);
  });

  it("odrzuca dowiązanie do korzenia vaulta, gdy Work/ jeszcze nie istnieje", () => {
    fs.symlinkSync(root, path.join(root, "alias"));
    expect(() => readVaultFile("alias/Work/a.yaml", { root })).toThrow(WorkAreaBlockedError);
    expect(() => writeVaultFile("alias/Work/a.yaml", "x", { root, expected: null })).toThrow(
      WorkAreaBlockedError
    );
    expect(fs.existsSync(path.join(root, "Work"))).toBe(false);
  });

  it.each(["Work./a.yaml", "Work /a.yaml", "WORK~1/a.yaml"])(
    "odrzuca warianty nazwy z Windows/drvfs: %s",
    (rel) => {
      expect(() => readVaultFile(rel, { root })).toThrow(WorkAreaBlockedError);
    }
  );

  it("przepuszcza z allowWork: true", () => {
    writeVaultFile("Work/a.yaml", "x", { root, expected: null, allowWork: true });
    expect(readVaultFile("Work/a.yaml", { root, allowWork: true })?.text).toBe("x");
    expect(listVaultFiles("Work", { root, allowWork: true })).toEqual(["a.yaml"]);
  });

  it("resolveInsideVault: blokuje bez opcji, przepuszcza z allowWork", () => {
    expect(() => resolveInsideVault(root, "Work/a")).toThrow(WorkAreaBlockedError);
    expect(resolveInsideVault(root, "Work/a", { allowWork: true })).toBe(
      path.join(fs.realpathSync(root), "Work", "a")
    );
  });

  it.each(["Workshop/a.md", "Work.md", "Notes/Work/a.md", "Projects/work/a.md"])(
    "nie blokuje podobnej ścieżki %s",
    (rel) => {
      writeVaultFile(rel, "x", { root, expected: null });
      expect(readVaultFile(rel, { root })?.text).toBe("x");
    }
  );
});
```

- [ ] **Step 2: Uruchomić (cursor) i potwierdzić czerwone**

Prompt: „`npx vitest run tests/unit/lib/nexus/vault-fs.test.ts`, nie edytuj plików; lista nazw testów FAIL.” Oczekiwane: FAIL w całym nowym bloku (brak eksportu `WorkAreaBlockedError`), pozostałe testy pliku zielone.

- [ ] **Step 3: Zaimplementować w `lib/nexus/vault-fs.ts`**

Pod klasą `PathOutsideVaultError` dodać:

```ts
export class WorkAreaBlockedError extends DomainError {
  constructor(rel: string) {
    super(`Dostęp do Work/ (dane etatu) jest zablokowany: ${rel}`, 403);
    this.name = "WorkAreaBlockedError";
  }
}

/** `Work`, także jako `Work.` / `Work ` (Windows/drvfs obcina końcowe kropki i spacje) oraz `WORK~1`. */
function isWorkSegment(segment: string | undefined): boolean {
  const name = (segment ?? "").replace(/[. ]+$/, "").toLowerCase();
  return name === "work" || /^work~\d+$/.test(name);
}

/**
 * Ścieżka kanoniczna: `realpath` najbliższego istniejącego przodka plus nieistniejący ogon.
 * Wyłapuje dowiązanie do korzenia vaulta (`alias -> .`, a potem `alias/Work/x`), gdy `Work/` jeszcze nie istnieje.
 */
function canonicalPath(abs: string): string {
  const tail: string[] = [];
  let current = abs;
  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...[...tail].reverse());
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    tail.push(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) return abs;
    current = parent;
  }
}

/** Pierwszy człon ścieżki (rozdzielacze `/` i `\`), z pominięciem `.` i pustych członów. */
function firstSegment(relative: string): string | undefined {
  return relative.split(/[\\/]/).find((segment) => segment !== "" && segment !== ".");
}
```

Zmienić typ opcji i sygnaturę (zachować kolejność: `VaultFsOptions` jest eksportowany i używany przez repozytoria):

```ts
export type VaultFsOptions = { root?: string; allowWork?: boolean };

export function resolveInsideVault(
  vaultRoot: string,
  rel: string,
  opts?: { allowWork?: boolean }
): string {
```

W treści `resolveInsideVault`, **tuż przed końcowym `return abs;`** (po bloku sprawdzającym `ancestor`), dodać:

```ts
if (!opts?.allowWork) {
  const viaPath = firstSegment(path.relative(realRoot, abs));
  const viaCanonical = firstSegment(path.relative(realRoot, canonicalPath(abs)));
  if (isWorkSegment(firstSegment(rel)) || isWorkSegment(viaPath) || isWorkSegment(viaCanonical)) {
    throw new WorkAreaBlockedError(rel);
  }
}
return abs;
```

We wszystkich pięciu wywołaniach w tym pliku (linie ok. 153, 168, 183, 201, 224) przekazać opcje: `resolveInsideVault(rootOf(opts), rel, opts)` (w `listVaultFiles`: `relDir`). `opts` bywa `undefined` w `readVaultFile` i `listVaultFiles`, co sygnatura dopuszcza.

Sprawdzić regułą słów z `tests/unit/lib/nexus/static.test.ts` (test 1): w `vault-fs.ts` nie wolno użyć słów `firebase`, `child_process`, `execSync`, `spawn`, `node:os`, `homedir`, `backups`. Podany kod ich nie zawiera.

- [ ] **Step 4: Uruchomić (cursor) i potwierdzić zielone**

Prompt: „`npx vitest run tests/unit/lib/nexus tests/unit/scripts/import-to-vault`, `npx tsc --noEmit`; nie edytuj plików; przeszło albo lista FAIL/błędów.” Oczekiwane: przeszło (m.in. istniejące testy `vault-fs` i statyczne `lib/nexus` bez zmian).

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/vault-fs.ts tests/unit/lib/nexus/vault-fs.test.ts
git commit -m "feat(nexus): vault-fs odmawia dostępu do Work/ bez allowWork"
```

---

## Task 3: strażnik `lib/workGuard.ts` (TDD)

**Pliki:** `lib/workGuard.ts`, `tests/unit/lib/workGuard.test.ts`, `tests/unit/allow-work.static.test.ts`.

- [ ] **Step 1: Napisać czerwony test jednostkowy z atrapą gita**

`tests/unit/lib/workGuard.test.ts`:

```ts
// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WorkAccessBlockedError,
  assertWorkAccess,
  checkWorkIgnored,
  defaultGitRunner,
  type GitRunner,
} from "@/lib/workGuard";

/** Atrapa gita: odpowiedzi wg pierwszego argumentu polecenia. */
function fakeGit(answers: Record<string, { status: number; stdout?: string }>): GitRunner {
  return (args) => {
    const answer = answers[args[0]] ?? { status: -1 };
    return { status: answer.status, stdout: answer.stdout ?? "" };
  };
}

const ALL_OK = {
  "rev-parse": { status: 0, stdout: "true\n" },
  "check-ignore": { status: 0 },
  "ls-files": { status: 0, stdout: "" },
};

describe("checkWorkIgnored (atrapa gita)", () => {
  it("ok, gdy vault w repo, Work/ ignorowany i nic nie jest śledzone", () => {
    expect(checkWorkIgnored("/v", fakeGit(ALL_OK))).toEqual({ ok: true });
  });

  it("no-git, gdy vault nie jest w repozytorium", () => {
    const r = checkWorkIgnored("/v", fakeGit({ ...ALL_OK, "rev-parse": { status: 128 } }));
    expect(r).toMatchObject({ ok: false, reason: "no-git" });
  });

  it("no-git, gdy rev-parse wypisuje false (wnętrze katalogu .git)", () => {
    const r = checkWorkIgnored(
      "/v",
      fakeGit({ ...ALL_OK, "rev-parse": { status: 0, stdout: "false\n" } })
    );
    expect(r).toMatchObject({ ok: false, reason: "no-git" });
  });

  it("no-git, gdy git jest niedostępny (kod -1)", () => {
    expect(checkWorkIgnored("/v", fakeGit({}))).toMatchObject({ ok: false, reason: "no-git" });
  });

  it("not-ignored, gdy check-ignore zwraca 1", () => {
    const r = checkWorkIgnored("/v", fakeGit({ ...ALL_OK, "check-ignore": { status: 1 } }));
    expect(r).toMatchObject({ ok: false, reason: "not-ignored" });
    expect((r as { message: string }).message).toContain("/Vault/Work/");
  });

  it("no-git (niepewność), gdy check-ignore zwraca błąd 128", () => {
    const r = checkWorkIgnored("/v", fakeGit({ ...ALL_OK, "check-ignore": { status: 128 } }));
    expect(r).toMatchObject({ ok: false, reason: "no-git" });
  });

  it("tracked, gdy w repo są śledzone pliki z Work/", () => {
    const r = checkWorkIgnored(
      "/v",
      fakeGit({ ...ALL_OK, "ls-files": { status: 0, stdout: "Work/x.yaml\n" } })
    );
    expect(r).toMatchObject({ ok: false, reason: "tracked" });
  });

  it("no-git (niepewność), gdy ls-files kończy się błędem", () => {
    const r = checkWorkIgnored("/v", fakeGit({ ...ALL_OK, "ls-files": { status: 128 } }));
    expect(r).toMatchObject({ ok: false, reason: "no-git" });
  });
});

describe("assertWorkAccess", () => {
  it("zwraca opcje z allowWork i rootem po pozytywnym sprawdzeniu", () => {
    expect(assertWorkAccess({ root: "/v", run: fakeGit(ALL_OK) })).toEqual({
      root: "/v",
      allowWork: true,
    });
  });

  it("rzuca WorkAccessBlockedError (403) po negatywnym", () => {
    try {
      assertWorkAccess({ root: "/v", run: fakeGit({ ...ALL_OK, "check-ignore": { status: 1 } }) });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(WorkAccessBlockedError);
      expect((err as WorkAccessBlockedError).statusCode).toBe(403);
    }
  });
});

describe("defaultGitRunner", () => {
  it("zwraca -1 dla nieistniejącego katalogu roboczego", () => {
    expect(defaultGitRunner(["status"], "/nie/ma/takiego/katalogu").status).toBe(-1);
  });
});

const hasGit = (() => {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasGit)("checkWorkIgnored (prawdziwy git w katalogu tymczasowym)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "work-guard-"));
    // Wynik nie może zależeć od globalnej konfiguracji gita użytkownika ani od repo nad /tmp.
    vi.stubEnv("GIT_CONFIG_GLOBAL", "/dev/null");
    vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
    // Domyślny globalny plik ignorowania gita (~/.config/git/ignore) też nie może wpływać na wynik.
    vi.stubEnv("HOME", tmp);
    vi.stubEnv("XDG_CONFIG_HOME", tmp);
    vi.stubEnv("GIT_CEILING_DIRECTORIES", os.tmpdir());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  /** Repo w `tmp`, vault w `tmp/Vault` (jak NEXUS), `.gitignore` o podanej treści. */
  function makeRepo(gitignore: string | null): string {
    execFileSync("git", ["init", "-q"], { cwd: tmp });
    if (gitignore !== null) fs.writeFileSync(path.join(tmp, ".gitignore"), gitignore);
    fs.mkdirSync(path.join(tmp, "Vault"));
    return path.join(tmp, "Vault");
  }

  it("ok przy regule /Vault/Work/", () => {
    expect(checkWorkIgnored(makeRepo("/Vault/Work/\n"))).toEqual({ ok: true });
  });

  it("not-ignored bez reguły", () => {
    expect(checkWorkIgnored(makeRepo(null))).toMatchObject({ ok: false, reason: "not-ignored" });
  });

  it("not-ignored, gdy reguła dotyczy innego katalogu", () => {
    expect(checkWorkIgnored(makeRepo("/Vault/Other/\n"))).toMatchObject({
      ok: false,
      reason: "not-ignored",
    });
  });

  it("tracked, gdy plik z Work/ został dodany do indeksu mimo reguły", () => {
    const vault = makeRepo("/Vault/Work/\n");
    fs.mkdirSync(path.join(vault, "Work"));
    fs.writeFileSync(path.join(vault, "Work", "x.yaml"), "a: 1\n");
    execFileSync("git", ["add", "-f", "Vault/Work/x.yaml"], { cwd: tmp });
    expect(checkWorkIgnored(vault)).toMatchObject({ ok: false, reason: "tracked" });
  });

  it("no-git, gdy vault leży poza repozytorium", () => {
    const vault = path.join(tmp, "Vault");
    fs.mkdirSync(vault);
    expect(checkWorkIgnored(vault)).toMatchObject({ ok: false, reason: "no-git" });
  });
});
```

- [ ] **Step 2: Napisać test statyczny „nikt poza strażnikiem nie ustawia `allowWork`”**

`tests/unit/allow-work.static.test.ts`:

```ts
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIRS = ["app", "src", "lib", "services", "scripts", "types"];
const ALLOWED = ["lib/nexus/vault-fs.ts", "lib/workGuard.ts"];

function collect(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
  };
  for (const dir of DIRS) walk(dir);
  return out;
}

describe("0f static guard: allowWork tylko w vault-fs i workGuard", () => {
  it("scans existing sources", () => {
    const files = collect();
    expect(files).toContain("lib/nexus/vault-fs.ts");
    expect(files).toContain("lib/workGuard.ts");
  });

  it("żaden inny plik nie ustawia ani nie przekazuje allowWork", () => {
    const hits: string[] = [];
    for (const rel of collect()) {
      if (ALLOWED.includes(rel)) continue;
      fs.readFileSync(path.join(ROOT, rel), "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/allowWork/.test(line)) hits.push(`${rel}:${i + 1} (${line.trim()})`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("strażnik sprawdza git, a vault-fs nie wywołuje procesów", () => {
    const guard = fs.readFileSync(path.join(ROOT, "lib/workGuard.ts"), "utf8");
    expect(guard).toMatch(/check-ignore/);
    expect(guard).toMatch(/ls-files/);
    expect(guard).toMatch(/allowWork: true/);
    expect(fs.readFileSync(path.join(ROOT, "lib/nexus/vault-fs.ts"), "utf8")).not.toMatch(
      /child_process/
    );
  });
});
```

- [ ] **Step 3: Uruchomić (cursor) i potwierdzić czerwone**

Prompt: „`npx vitest run tests/unit/lib/workGuard.test.ts tests/unit/allow-work.static.test.ts`, nie edytuj plików; lista FAIL.” Oczekiwane: oba pliki FAIL (brak `lib/workGuard.ts`).

- [ ] **Step 4: Zaimplementować `lib/workGuard.ts`**

```ts
import { execFileSync } from "node:child_process";
import { DomainError } from "@/lib/errors";
import type { VaultFsOptions } from "@/lib/nexus/vault-fs";
import { getVaultRoot } from "@/lib/nexus/vault-path";

export type GitResult = { status: number; stdout: string };
/** Uruchamia `git <args>` w katalogu `cwd`; status -1 oznacza brak gita, limit czasu lub inny błąd uruchomienia. */
export type GitRunner = (args: string[], cwd: string) => GitResult;

export type WorkAccess =
  | { ok: true }
  | { ok: false; reason: "no-git" | "not-ignored" | "tracked"; message: string };

export class WorkAccessBlockedError extends DomainError {
  constructor(message: string) {
    super(message, 403);
    this.name = "WorkAccessBlockedError";
  }
}

/** Ścieżka sondy względem korzenia vaulta; plik nie musi istnieć. */
const PROBE = "Work/.nexus-ignore-probe";

export const defaultGitRunner: GitRunner = (args, cwd) => {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { status: 0, stdout };
  } catch (err) {
    const status = (err as { status?: number | null }).status;
    return { status: typeof status === "number" ? status : -1, stdout: "" };
  }
};

function blocked(reason: "no-git" | "not-ignored" | "tracked", detail: string): WorkAccess {
  return { ok: false, reason, message: `Dane etatu (Work/) zablokowane: ${detail}` };
}

/**
 * Czy `Work/` w vaulcie jest bezpieczne dla danych etatu: vault w repo git, folder ignorowany
 * i żaden plik z niego nie jest śledzony. Każda niepewność (brak gita, błąd) blokuje.
 */
export function checkWorkIgnored(vaultRoot: string, run: GitRunner = defaultGitRunner): WorkAccess {
  const inside = run(["rev-parse", "--is-inside-work-tree"], vaultRoot);
  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    return blocked("no-git", "vault nie jest w repozytorium git albo git jest niedostępny.");
  }
  const ignored = run(["check-ignore", "-q", "--no-index", "--", PROBE], vaultRoot).status;
  if (ignored === 1) {
    return blocked(
      "not-ignored",
      "folder Work/ nie jest ignorowany przez git. Dodaj `/Vault/Work/` do .gitignore repozytorium NEXUS."
    );
  }
  if (ignored !== 0) return blocked("no-git", "nie udało się sprawdzić reguł .gitignore.");
  const tracked = run(["ls-files", "--", "Work"], vaultRoot);
  if (tracked.status !== 0) return blocked("no-git", "nie udało się sprawdzić śledzonych plików.");
  if (tracked.stdout.trim() !== "") {
    return blocked(
      "tracked",
      "git śledzi już pliki z Work/ (usuń je z indeksu: `git rm --cached`)."
    );
  }
  return { ok: true };
}

/**
 * Jedyna droga do `Work/`: po pozytywnym sprawdzeniu zwraca opcje dla funkcji `vault-fs`
 * z `allowWork: true`; w przeciwnym razie rzuca `WorkAccessBlockedError` (403).
 */
export function assertWorkAccess(
  options: { root?: string; run?: GitRunner } = {}
): VaultFsOptions & { root: string; allowWork: true } {
  const root = options.root ?? getVaultRoot();
  const result = checkWorkIgnored(root, options.run);
  if (!result.ok) throw new WorkAccessBlockedError(result.message);
  return { root, allowWork: true };
}
```

- [ ] **Step 5: Uruchomić (cursor) i potwierdzić zielone**

Prompt: „`npx vitest run tests/unit/lib/workGuard.test.ts tests/unit/allow-work.static.test.ts`, `npx tsc --noEmit`; nie edytuj plików; przeszło albo lista FAIL/błędów.” Oczekiwane: przeszło, w tym 5 testów z prawdziwym gitem (jeśli któryś jest `skipped`, `git` nie jest w PATH: zgłosić, nie ignorować).

- [ ] **Step 6: Commit**

```bash
git add lib/workGuard.ts tests/unit/lib/workGuard.test.ts tests/unit/allow-work.static.test.ts
git commit -m "feat(nexus): strażnik workGuard sprawdza git check-ignore przed dostępem do Work/"
```

---

## Task 4: dokumentacja

- [ ] **Step 1: `README.md`**

Pod sekcją „Bezpieczeństwo lokalne” dopisać:

```md
## Dane etatu (`Vault/Work/`)

Folder `Work/` w vaulcie jest przeznaczony na dane etatu i nie może trafić do repozytorium NEXUS: wpis `/Vault/Work/` w jego `.gitignore`. Warstwa plikowa (`lib/nexus/vault-fs.ts`) odmawia dostępu do `Work/`, chyba że wywołujący przejdzie przez `assertWorkAccess()` z `lib/workGuard.ts`, który sprawdza `git check-ignore` i brak śledzonych plików.
```

- [ ] **Step 2: Spec etapu 0**

W `docs/superpowers/specs/2026-11-12-etap-0-odpiecie-firebase-design.md`: w nagłówku „Status” zmienić „0f w planowaniu” na „0f zaplanowany (`2026-11-12-etap-0f-straznik-vault-work.md`)”, a po wykonaniu na „0f wykonany”. W §7 pod „### 0f: `Vault/Work/`” dopisać akapit „Stan 0f”: wzorzec `/Vault/Work/` (zakotwiczony, D1 planu), dwie warstwy (`vault-fs` fail-closed + `lib/workGuard.ts` poza `lib/nexus/` z powodu zakazu `child_process`), kontrola przy każdym wejściu do strefy (bez cache), brak funkcji etatu do czasu etapu 1.

- [ ] **Step 3: Spec nadrzędny**

W `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md` §5, pod punktem „Kontrola gita”, dodać zdanie: „Stan (2026-11-12): zaimplementowane jako `lib/workGuard.ts` (sprawdzenie przy każdym wejściu do strefy) i blokada `Work/` w `lib/nexus/vault-fs.ts`; zob. plan 0f.”

- [ ] **Step 4: Commit**

```bash
git add README.md docs
git commit -m "docs(0f): README i specy po wprowadzeniu strażnika Work/"
```

---

## Task 5: weryfikacja końcowa, review, PR

- [ ] **Step 1: Pełna weryfikacja (cursor)**

Prompt: „W `Second_brain` uruchom po kolei `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`. Nie edytuj plików. Dla każdego: przeszło albo lista `plik:linia + przyczyna`; podaj liczby testów.” Oczekiwane: `tsc` czysty, lint tylko 3 znane ostrzeżenia, testy zielone, `build` przechodzi, e2e zielone (żadna ścieżka e2e nie wchodzi do `Work/`).

- [ ] **Step 2: Ręczna kontrola z prawdziwym vaultem (człowiek lub agent, tylko odczyt)**

```bash
cd ~/projects/Brain_7224/Second_brain
npx tsx --env-file=.env -e "Promise.all([import('./lib/workGuard'), import('./lib/nexus/vault-path')]).then(([g, p]) => console.log(g.checkWorkIgnored(p.getVaultRoot())))"
```

Oczekiwane po Tasku 1: `{ ok: true }`. Przed Taskiem 1: `reason: 'not-ignored'`. Komenda tylko czyta (nie tworzy `Work/`); `getVaultRoot()` zamienia ścieżkę z `.env` (także w formie `E:\\…`) na właściwą dla platformy, więc działa też w WSL.

- [ ] **Step 3: Review diffa**

`scripts/ask-helper.sh --role review agy "<cel: strażnik Work/ w dwóch warstwach (vault-fs fail-closed + lib/workGuard.ts); pytania: czy da się ominąć blokadę (wielkość liter, dowiązania, ./, \\, ścieżki z NUL), czy komendy git są poprawne i odporne (--no-index, sonda, ls-files), czy testy z prawdziwym gitem są deterministyczne; ścieżki: git diff main...HEAD>"`. Opinie traktować jak hipotezy i weryfikować w kodzie.

- [ ] **Step 4: PR**

```bash
git push -u origin feat/etap-0f-straznik-vault-work
gh pr create --base main --head feat/etap-0f-straznik-vault-work --title "feat(0f): Vault/Work/ poza gitem i strażnik dostępu do danych etatu" --body "<podsumowanie, decyzje D1–D7, wyniki weryfikacji, link do planu; uwaga, że zmiana w .gitignore NEXUS jest w osobnym repo>"
```

---

## Poza zakresem

- Kopia zapasowa `Vault/Work/` (spec §5), polityka firmy wobec danych etatu, `_registry.work.yaml`, `calendar.yaml` etatu, blokada wysyłki do zewnętrznego AI dla `owner: work`: etap 1 i dalsze.
- Funkcje UI/API dla etatu i komunikat w interfejsie (D6).
- Zabezpieczenie osobnej kopii `resolveInsideVault` w `scripts/import-to-vault/write.ts`: pisze wyłącznie do ustalonych katalogów, nie do `Work/`.
- Wymuszenie, żeby inny proces (Obsidian, ręczne `git add -f`) nie zapisał danych etatu poza aplikacją: częściowo pokrywa `ls-files` w strażniku, ale tylko w momencie wejścia do strefy.

## Ryzyka i ograniczenia

- **Wyciek przed wpisem w `.gitignore`:** Task 1 jest pierwszy i nie zależy od kodu; pierwszy plik w `Work/` nie powinien powstać przed jego wykonaniem (dziś nie istnieje).
- **Fałszywe poczucie bezpieczeństwa:** strażnik chroni ścieżkę przez aplikację. Ręczne `git add -f Vault/Work/...` omija regułę ignorowania; wykrywa to dopiero kolejne wejście do strefy (`tracked`).
- **Niedostępny `git` (np. inna maszyna, PATH):** strażnik blokuje (D4), więc funkcje etatu nie działają, ale nic nie wycieka.
- **Test z prawdziwym gitem** zależy od wersji gita (testowane 2.53) i jest pomijany bez gita; stąd weryfikacja w Tasku 3 Step 5, że nie jest `skipped`.
- **Wydajność:** 3 wywołania `git` na każde wejście do strefy (D5), czyli rzędu kilkunastu milisekund; do zaakceptowania, bo dostęp do etatu jest rzadki.

## Samokontrola planu względem specu §7 0f i §5

- Wpis w `.gitignore` NEXUS przed pierwszym plikiem → Task 1 (z doprecyzowaniem D1).
- `git check-ignore Vault/Work/` blokuje zapis i odczyt etatu, gdy folder nie jest ignorowany → Task 3 (`checkWorkIgnored`) + Task 2 (blokada bez `allowWork`).
- Komunikat przy blokadzie → `WorkAccessBlockedError.message` (po polsku, z poprawką do wykonania).
- Zasada „zapisy aplikacji tylko w `Vault/`” → Task 1 wykonywany poza aplikacją i za zgodą.
- Brak backupu `Vault/Work/` → świadomie poza zakresem, zapisany w „Poza zakresem”.
