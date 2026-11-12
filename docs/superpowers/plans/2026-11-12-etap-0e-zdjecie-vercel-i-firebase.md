# Etap 0e: zdjęcie z Vercela, wygaszenie projektu Firebase, usunięcie reszty kodu Firebase

> **Dla wykonawcy:** REQUIRED SUB-SKILL: superpowers:executing-plans. Kroki mają checkboxy (`- [ ]`). Tasks 0–5 to operacje na zewnętrznych usługach i nośnikach, **wykonuje je człowiek** (agent może przygotować komendy i sprawdzić wynik, ale nie klika w panelach, nie usuwa projektów i nie zatwierdza niczego za użytkownika). Task 6 to zwykły kod w TDD: komendy testów, tsc, lint i build uruchamia `cursor` (`scripts/ask-helper.sh --role task`, w prompcie „nie edytuj plików”, wynik: „przeszło” albo lista `plik:linia + przyczyna`), review diffa robi `agy --role review`. Plan powstał z odczytu kodu, bez uruchamiania czegokolwiek: weryfikacja należy do wykonawcy.
>
> **Ten dokument jest publiczny (repo na GitHubie).** Nie wpisuj do niego identyfikatora projektu Firebase, `uid` konta, kluczy ani ścieżek nośników. W komendach stoją placeholdery `<UID>` i `<NOŚNIK>`, które wykonawca podstawia lokalnie.

**Cel:** po tym etapie aplikacja nie jest nigdzie wdrożona, projekt Firebase przestaje istnieć (po okresie karencji), a w repo nie zostaje żaden kod, pakiet, skrypt, test, konfiguracja ani zmienna związana z Firebase, Firestore i Vercelem. Jedyną kopią starych danych jest zrzut na dysku i jego druga, zaszyfrowana kopia na osobnym nośniku.

**Architektura:** dwie osie. (1) **Oś czasu i bramek** (Tasks 0–5): obserwacja → bramka `--verify` → druga kopia → Vercel → zamknięcie Firebase → karencja → usunięcie projektu. Każdy nieodwracalny krok ma bramkę i potwierdzenie użytkownika. (2) **Sprzątanie kodu** (Task 6): jeden PR po usunięciu projektu, bo do ostatniego `--verify` i ewentualnego ponownego eksportu potrzebny jest `firebase-admin`. Test statyczny (czerwony przed, zielony po) pilnuje, żeby Firebase nie wrócił.

**Stos:** Node/npm, `tsx`, Vitest, Next 14.2, `gpg` (szyfrowanie kopii), panel Vercela i konsola Firebase (ręcznie).

**Stan wyjściowy (`main` po PR #16, 2026-11-12):** aplikacja działa na plikach vaulta, bez logowania; w repo zostają (odstępstwo 0d-2) `firebase-admin`, `lib/firebase-admin.ts`, `scripts/export-firestore*`, `scripts/migrate-sqlite-to-firestore.ts`, `scripts/cleanup-knowledge-collections.ts`, `tests/integration/`, `vitest.integration.config.ts`, `docker-compose-test.yml`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, serwerowe `FIREBASE_*` w `.env.example`, pakiety `better-sqlite3`, `dotenv`, `wait-on`, `cross-env`. Katalog `.vercel/` istnieje lokalnie (jest w `.gitignore`, więc nie jest śledzony). Na dysku, poza repo, w `~/backups/second-brain-firestore/` leżą trzy zrzuty: `2026-11-12T0915` (szerszy, status `needs-review`, archiwum), `2026-11-12T0931` (zawężony, `ok`) i `2026-11-12T0936` (zawężony, `ok`, ten, z którego zrobiono import do vaulta; zawiera też raporty importu).

---

## Decyzje (domyślne; użytkownik może je zmienić przed wykonaniem)

- **D1. Okres obserwacji: 7 dni** lokalnej pracy na plikach (spec O5). Licznik startuje w dniu merge'a PR #16 (2026-11-12), więc najwcześniejsza bramka to **2026-11-19**. Jeśli w tym czasie wyjdzie błąd warstwy plikowej, który zmusza do zmian w danych, licznik startuje od nowa po poprawce.
- **D2. Karencja: 30 dni** od zamknięcia dostępu do Firebase (Task 4) do usunięcia projektu (Task 5). Najwcześniej: data zamknięcia + 30 dni. Zamknięcie nie utrudnia ponownego eksportu: Admin SDK omija reguły, więc `--verify` i eksport działają do końca karencji.
- **D3. Kolejność: Vercel przed Firebase.** Wdrożenie na Vercelu trzyma kopię klucza konta serwisowego w zmiennych środowiskowych; zdejmujemy je pierwsze, żeby po zamknięciu Firebase nic zewnętrznego nie mogło się z nim łączyć.
- **D4. Czyszczenie kodu dopiero po usunięciu projektu** (Task 6 po Tasku 5). Powód: `firebase-admin` służy bramce (`--verify`) i ewentualnemu ponownemu eksportowi w okresie karencji. Po usunięciu projektu nie ma czego eksportować. Skutek uboczny, zaakceptowany: kryterium ze specu „aplikacja bez `FIREBASE_*` i bez pakietów Firebase w `package-lock.json`” spełnia się dopiero w Tasku 6.
- **D5. Nic z tego etapu nie dotyka szerszego zrzutu `2026-11-12T0915`** poza jego skopiowaniem. Po usunięciu projektu to jedyne źródło kalendarza, map myśli i reszty spoza zakresu 1.1 specu. Jego usunięcie z dysku to osobna, świadoma decyzja użytkownika, poza tym planem.
- **D6. Usuwamy też `tests/integration/` w całości**, razem z `mindMapService.integration.test.ts`. Ten test po 0c działa już na backendzie plikowym, nie na Firestore, więc uruchomiony z `RUN_INTEGRATION_TESTS=1` zapisałby do prawdziwego vaulta (tak samo ryzykowne jak e2e bez izolacji, zob. 0d-2 D7). Test jednostkowy `mindMapService` pokrywa tę logikę na mockach.
- **D7. `lib/firestore-db.ts` (barrel serwisów) zostaje z tą nazwą.** Nazwa jest myląca, ale zmiana nazwy dotyka ~12 serwisów i ich testów (mocki `@/lib/firestore-db`); to osobne, mechaniczne sprzątanie poza 0e. Odnotowane w „Poza zakresem”.
- **D8. `tsx` zostaje w `devDependencies`** (skrypt `import-to-vault` uruchamiany `npx tsx`). `scripts/import-to-vault*` i jego testy zostają: czytają zrzut z dysku, nie łączą się z Firebase, a są jedynym sposobem odtworzenia vaulta ze zrzutu.

## Pliki (tylko Task 6)

**Tworzone:** `tests/unit/etap-0e-cleanup.static.test.ts`.

**Modyfikowane:** `tests/unit/package-scripts.static.test.ts`, `tsconfig.json`, `package.json`, `package-lock.json` (przez `npm uninstall`), `.env.example`, `vitest.config.ts`, `README.md`, `docs/adr/016-firestore-emulator-docker.md`, `docs/adr/020-lokalne-pliki-zamiast-firestore.md`, `docs/adr/015-testing-strategy.md`, `docs/adr/014-layer-separation-and-service-layer.md`, `tests/docs_tech/test_workflow.md`, `docs/superpowers/specs/2026-11-12-etap-0-odpiecie-firebase-design.md`.

**Usuwane (`git rm`):** `lib/firebase-admin.ts`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `docker-compose-test.yml`, `vitest.integration.config.ts`, `scripts/export-firestore.ts`, `scripts/export-firestore/`, `scripts/migrate-sqlite-to-firestore.ts`, `scripts/cleanup-knowledge-collections.ts`, `tests/integration/`, `tests/unit/scripts/export-firestore/`.

**Zostają celowo:** `scripts/import-to-vault.ts`, `scripts/import-to-vault/`, `tests/unit/scripts/import-to-vault/` (D8), `lib/firestore-db.ts` (D7), wpis `firebase-service-account.json` w `.gitignore` (ochronny; zaszkodzić nie może), historyczne ADR-y w `docs/adr/archive/` i dawne plany/specy (dokumentacja historyczna).

---

## Task 0: obserwacja (2026-11-12 → 2026-11-19, człowiek)

**Cel:** przez tydzień pracować w aplikacji na plikach i zebrać dowody, że niczego nie brakuje w danych.

- [ ] **Step 1: Zrestartować serwer z nowym skryptem**

```bash
cd ~/projects/Brain_7224/Second_brain
git checkout main && git pull
npm run dev        # -H 127.0.0.1, port 3100
```

Oczekiwane: serwer nasłuchuje na `http://127.0.0.1:3100`; `/` przekierowuje do `/dashboard`.

- [ ] **Step 2: Codziennie używać modułów, które mają backend plikowy**

Minimum raz w tygodniu: dodać/edytować/usunąć notatkę, zadanie (ze zmianą statusu 4-stanowego), zasób z tagiem, szablon zadania, wydarzenie kalendarza, mapę myśli, widok tablicy. Po każdej sesji `git -C ../NEXUS status` pokazuje zmiany w `Vault/` jako oczekiwane pliki `.md`/`.yaml`.

- [ ] **Step 3: Prowadzić listę odchyleń**

Każda rzecz, której brakuje względem tego, co było w Firestore (brakujące notatki, zadanie bez tagu, zły status, utracone formatowanie notatki), idzie na listę z datą. Lista pusta na koniec tygodnia = bramka może przejść. Niepusta = naprawa w kodzie (osobny plan/PR) i licznik z D1 startuje od nowa.

---

## Task 1: bramka (najwcześniej 2026-11-19, człowiek + agent sprawdza wynik)

**Warunek wejścia:** Task 0 zamknięty bez otwartych odchyleń. **Bez zielonej bramki nie wolno robić Tasków 2–5.**

- [ ] **Step 1: `--verify` zawężonego zrzutu przeciw żywemu Firestore**

Uruchamiać przy zatrzymanej aplikacji (nic nie pisze do Firestore, a i tak jest już od niego odcięta).

```bash
cd ~/projects/Brain_7224/Second_brain
npx tsx --env-file=.env scripts/export-firestore.ts --verify ~/backups/second-brain-firestore/2026-11-12T0936
echo "exit=$?"
```

Oczekiwane: `Weryfikacja …: OK (pliki zgodne z manifestem i z Firestore).` i `exit=0`. Każde `NIEPOWODZENIE` lub `exit≠0` zatrzymuje etap: wykonawca opisuje różnicę (nowe dane w Firestore po eksporcie albo uszkodzony plik) i wraca do 0a (`--resume`/nowy eksport z `--uid <UID> --only notes,tasks,resources,user_tags,task_templates`), potem do 0b i obserwacji.

- [ ] **Step 2: `--verify` szerszego zrzutu (informacyjnie)**

```bash
npx tsx --env-file=.env scripts/export-firestore.ts --verify ~/backups/second-brain-firestore/2026-11-12T0915
echo "exit=$?"
```

Wynik zapisać w notatce wykonania (kopia do sekcji „Zapis wykonania” w specu, Task 6). Ten zrzut ma status `needs-review`, więc niezgodność **nie blokuje** bramki, ale wykonawca ma zrozumieć jej przyczynę (np. kolekcje nieznane w chwili eksportu), bo po 0e to jedyna kopia tych danych.

- [ ] **Step 3: Import (0b) w trybie próbnym nie zgłasza nic nowego**

```bash
npx tsx --env-file=.env scripts/import-to-vault.ts --dump ~/backups/second-brain-firestore/2026-11-12T0936 --uid <UID>
```

(bez `--write` to `--dry-run`; vault z `NEXUS_VAULT_PATH` wczytanego z `.env` przez `--env-file`, bo skrypt sam `.env` nie ładuje). Oczekiwane: raport „0 do utworzenia”, wszystkie rekordy już istnieją (idempotencja po `id`), bez rekordów pominiętych z błędem. Ręczne zmiany z tygodnia obserwacji nie są nadpisywane, bo dry-run niczego nie zapisuje.

- [ ] **Step 4: Zapis decyzji**

Użytkownik potwierdza w rozmowie z agentem: „bramka 0e zielona, data D”. Agent zapisuje datę do notatki wykonania. Bez tego potwierdzenia dalej nie idziemy.

---

## Task 2: druga kopia zrzutu na osobnym nośniku (człowiek)

Zrzut zawiera dane osobiste, więc kopia jest **szyfrowana** i nie trafia do chmury. Obejmuje wszystkie trzy katalogi (w tym szerszy, D5).

- [ ] **Step 1: Zaszyfrować i zapisać na nośniku**

```bash
cd ~/backups
tar -czf - second-brain-firestore | gpg --symmetric --cipher-algo AES256 -o <NOŚNIK>/second-brain-firestore-2026-11.tar.gz.gpg
```

Hasło ustawić w menedżerze haseł, nie w pliku ani w historii powłoki.

- [ ] **Step 2: Sprawdzić, że kopia się odszyfrowuje i zgadza z oryginałem**

```bash
gpg -d <NOŚNIK>/second-brain-firestore-2026-11.tar.gz.gpg | tar -tzf - | sort > /tmp/kopia.lst
( cd ~/backups && find second-brain-firestore -type f | sort ) > /tmp/oryg.lst
diff <(grep -v '/$' /tmp/kopia.lst) /tmp/oryg.lst && echo "LISTY ZGODNE"
```

Oczekiwane: `LISTY ZGODNE`. Następnie wybrany plik (np. `manifest.json` z `2026-11-12T0936`) porównać z oryginałem przez `sha256sum` po wypakowaniu do katalogu tymczasowego, który po sprawdzeniu usunąć (`rm -rf` tylko tego jednego katalogu tymczasowego).

- [ ] **Step 3: Potwierdzić**

Użytkownik: „kopia na nośniku sprawdzona”. Agent nie przechodzi do Tasku 3 bez tego.

---

## Task 3: zdjęcie wdrożenia z Vercela (człowiek; nieodwracalne)

**Potwierdzenie przed krokiem:** agent pyta użytkownika wprost, czy usunąć projekt Vercel `second-brain`. Samo „tak, rób plan” nie wystarcza.

- [ ] **Step 1: Zrzut ekranu ustawień do zapisu wykonania (bez sekretów)**

W panelu Vercela: projekt → Settings → Domains (zanotować, jakie domeny były podpięte, żeby wiedzieć, co zwolnić), Git (repo GitHub do rozłączenia).

- [ ] **Step 2: Usunąć projekt**

Panel: Settings → General → Delete Project. Alternatywa bez pakietu `vercel` w repo (został usunięty w 0d-2): `npx vercel@latest remove second-brain` po `npx vercel@latest login`. Usunięcie projektu usuwa też jego zmienne środowiskowe, a więc kopię klucza Firebase.

- [ ] **Step 3: Zweryfikować**

Otworzyć dawny adres produkcyjny: oczekiwane 404 `DEPLOYMENT_NOT_FOUND` albo brak domeny. Na GitHubie repo → Settings → Integrations: aplikacja Vercel nie ma już dostępu do `Second_brain` (jeśli ma, odpiąć).

- [ ] **Step 4: Usunąć lokalny katalog `.vercel/`**

`.vercel/` jest w `.gitignore`, więc nie ma czego commitować; usuwamy tylko plik lokalny.

```bash
cd ~/projects/Brain_7224/Second_brain
git ls-files .vercel        # oczekiwane: pusto (nie jest śledzony)
rm -r .vercel
git status --short          # oczekiwane: bez zmian
```

---

## Task 4: zamknięcie dostępu do Firebase i start karencji (człowiek; odwracalne)

- [ ] **Step 1: Reguły Firestore zamykające wszystko**

Konsola Firebase → Firestore → Rules, wkleić i opublikować:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Reguły nie dotyczą Admin SDK, więc `--verify` i ponowny eksport nadal działają (D2).

- [ ] **Step 2: Wyłączyć logowanie**

Konsola Firebase → Authentication → Sign-in method: wyłączyć wszystkich dostawców (e-mail/hasło, Google). Konta zostają (ich lista jest w `auth-users.json` zrzutu).

- [ ] **Step 3: Odciąć klienta webowego**

Konsola Firebase → Project settings → General → Your apps: zanotować, że aplikacja webowa istnieje (nic jej już nie używa; klucz webowy nie jest sekretem, ale reguły z Step 1 chronią dane). Klucza konta serwisowego **nie** unieważniamy jeszcze: potrzebny do `--verify` w Tasku 5.

- [ ] **Step 4: Zapisać datę zamknięcia i obliczyć datę usunięcia**

Data zamknięcia + 30 dni (D2) = najwcześniejszy dzień Tasku 5. Zapis w notatce wykonania. Przykład: zamknięcie 2026-11-19 → usunięcie nie wcześniej niż 2026-12-19.

- [ ] **Step 5: Sprawdzić, że aplikacja nadal działa**

```bash
npm run dev      # pracować normalnie kilka minut
```

Oczekiwane: żadnej zmiany, bo aplikacja nie ma już żadnego połączenia z Firebase. Jeśli coś przestanie działać, to znaczy, że zostało ukryte użycie Firebase w kodzie: otworzyć przyczynę (nie otwierać reguł z powrotem bez analizy) i naprawić przed Taskiem 6.

---

## Task 5: koniec karencji i usunięcie projektu Firebase (człowiek; nieodwracalne)

**Warunek wejścia:** minęło 30 dni od Tasku 4, przez ten czas nikt nie zgłosił potrzeby danych z Firestore.

- [ ] **Step 1: Ostatni `--verify`**

```bash
cd ~/projects/Brain_7224/Second_brain
npx tsx --env-file=.env scripts/export-firestore.ts --verify ~/backups/second-brain-firestore/2026-11-12T0936
echo "exit=$?"
```

Oczekiwane: `OK`, `exit=0`. Jeśli niezgodność: stop (ktoś zapisał dane mimo zamkniętych reguł, np. przez Admin SDK z innego miejsca); rozpoznać przyczynę, wyeksportować ponownie, powtórzyć Task 2.

- [ ] **Step 2: Potwierdzenie użytkownika**

Agent pyta: „Wszystkie kopie istnieją (dysk + nośnik zaszyfrowany), `--verify` zielony, karencja minęła. Usunąć projekt Firebase?”. Dalej tylko na jednoznaczne „tak”.

- [ ] **Step 3: Usunąć projekt**

Konsola Firebase → Project settings → General → Delete project (lub Google Cloud Console → IAM i administracja → Ustawienia → Zamknij). Google przechowuje zamknięty projekt 30 dni i pozwala go przywrócić w tym oknie: zanotować datę, po której jest to nieodwracalne.

- [ ] **Step 4: Usunąć lokalne poświadczenia**

Z lokalnego `.env` usunąć `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` i ewentualnie `GOOGLE_APPLICATION_CREDENTIALS`; usunąć plik klucza konta serwisowego (np. `firebase-service-account.json`), jeśli leży na dysku; sprawdzić menedżer haseł i ustawienia CI/innych maszyn. Po tym kroku `--verify` przestaje działać, co jest zamierzone.

---

## Task 6: sprzątanie kodu (PR, TDD; po Tasku 5)

**Pliki:** zob. sekcja „Pliki”.

### 6.0 Gałąź i stan wyjściowy

- [ ] **Step 1: Gałąź**

```bash
cd ~/projects/Brain_7224/Second_brain
git checkout main && git pull
git checkout -b chore/etap-0e-sprzatanie-firebase
```

- [ ] **Step 2: Stan wyjściowy (cursor)**

Prompt do `cursor`: „W `Second_brain` uruchom `npx tsc --noEmit`, `npm run lint`, `npx vitest run`. Nie edytuj plików. Odpowiedz: przeszło albo lista `plik:linia + przyczyna`, oraz liczby testów/plików.” Oczekiwane: `tsc` czysty, 3 znane ostrzeżenia `react-hooks`, wszystkie testy zielone (po PR #16: 860+ testów).

### 6.1 Czerwony test: Firebase nie ma prawa wrócić

- [ ] **Step 1: Napisać `tests/unit/etap-0e-cleanup.static.test.ts`**

```ts
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const REMOVED_PATHS = [
  "lib/firebase-admin.ts",
  "firebase.json",
  "firestore.rules",
  "firestore.indexes.json",
  "docker-compose-test.yml",
  "vitest.integration.config.ts",
  "scripts/export-firestore.ts",
  "scripts/export-firestore",
  "scripts/migrate-sqlite-to-firestore.ts",
  "scripts/cleanup-knowledge-collections.ts",
  "tests/integration",
  "tests/unit/scripts/export-firestore",
  ".vercel",
];

describe("0e: po usunięciu projektów Firebase i Vercel", () => {
  it.each(REMOVED_PATHS)("nie istnieje %s", (rel) => {
    expect(exists(rel)).toBe(false);
  });

  it("zostają narzędzia importu ze zrzutu (D8)", () => {
    expect(exists("scripts/import-to-vault.ts")).toBe(true);
    expect(exists("tests/unit/scripts/import-to-vault")).toBe(true);
  });

  it(".env.example nie ma zmiennych Firebase", () => {
    expect(read(".env.example")).not.toMatch(/FIREBASE|FIRESTORE/i);
  });

  it("package-lock.json nie zawiera pakietów Firebase ani Firestore", () => {
    const lock = read("package-lock.json");
    expect(lock).not.toMatch(/"node_modules\/firebase(-admin)?"/);
    expect(lock).not.toMatch(/"node_modules\/@google-cloud\/firestore"/);
    expect(lock).not.toMatch(/"node_modules\/@firebase\//);
  });
});
```

- [ ] **Step 2: Odwrócić asercję w `tests/unit/package-scripts.static.test.ts`**

W ostatnim bloku `describe` zamienić test „firebase-admin zostaje do etapu 0e” i dodać nowe, tak żeby blok wyglądał:

```ts
describe("0e: pakiety i skrypty po usunięciu Firebase, Firestore i emulatora", () => {
  const all = { ...pkg.dependencies, ...pkg.devDependencies };

  it.each([
    "firebase",
    "firebase-admin",
    "vercel",
    "better-sqlite3",
    "dotenv",
    "wait-on",
    "cross-env",
  ])("nie ma pakietu %s", (name) => {
    expect(all).not.toHaveProperty(name);
  });

  it("zostaje tsx (uruchamia scripts/import-to-vault.ts)", () => {
    expect(all).toHaveProperty("tsx");
  });

  it.each([
    "vercel",
    "vercel:prod",
    "migrate:sqlite-to-firestore",
    "emulator:docker",
    "test:integration",
    "test:integration:local",
    "test:integration:docker",
  ])("nie ma skryptu %s", (name) => {
    expect(pkg.scripts).not.toHaveProperty(name);
  });
});
```

(poprzedni blok „0d-2: pakiety i skrypty po odpięciu Firebase i Vercela” zastąpić całym blokiem powyżej; blok „package.json scripts bind to loopback only” zostaje bez zmian).

- [ ] **Step 3: Uruchomić (cursor) i potwierdzić czerwone**

Prompt: „`npx vitest run tests/unit/etap-0e-cleanup.static.test.ts tests/unit/package-scripts.static.test.ts`, nie edytuj plików; lista nazw testów, które FAIL.” Oczekiwane: FAIL dla wszystkich ścieżek z `REMOVED_PATHS` poza `.vercel` (usunięty w Tasku 3), dla `.env.example`, `package-lock.json` i pakietów/skryptów z listy. Zielone: `zostaje tsx`, `zostają narzędzia importu`.

- [ ] **Step 4: Commit czerwonych testów** (jedyny commit z celowo czerwonym stanem; kolejne commity zostawiają zielony)

```bash
git add tests/unit/etap-0e-cleanup.static.test.ts tests/unit/package-scripts.static.test.ts
git commit -m "test(0e): testy statyczne wymagające usunięcia Firebase i Firestore"
```

### 6.2 Usunięcie plików

- [ ] **Step 1: Sprawdzić, że nic poza listą nie importuje usuwanych modułów**

```bash
grep -rnE "lib/firebase-admin|export-firestore|migrate-sqlite|cleanup-knowledge|tests/integration|vitest.integration|docker-compose-test" \
  --include=*.ts --include=*.tsx --include=*.json --include=*.mjs --include=*.yml --include=*.sh \
  app src lib services types scripts tests package.json playwright.config.ts .husky 2>/dev/null
```

Oczekiwane: trafienia wyłącznie w plikach z listy usuwanych (skrypty i testy eksportu) oraz w `package.json` (skrypty, naprawiane w 6.3) i `tests/unit/etap-0e-cleanup.static.test.ts`. Trafienie gdziekolwiek indziej (np. `src/`, `services/`) = stop, najpierw zrozumieć zależność.

- [ ] **Step 2: Usunąć**

```bash
git rm -r lib/firebase-admin.ts firebase.json firestore.rules firestore.indexes.json docker-compose-test.yml \
  vitest.integration.config.ts scripts/export-firestore.ts scripts/export-firestore \
  scripts/migrate-sqlite-to-firestore.ts scripts/cleanup-knowledge-collections.ts \
  tests/integration tests/unit/scripts/export-firestore
```

- [ ] **Step 3: Uporządkować `vitest.config.ts`**

W `test.exclude` usunąć element `"**/tests/integration/**"` (katalog nie istnieje). Wynik:

```ts
exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**", "**/.worktrees/**"],
```

W `tsconfig.json` (linia `exclude`) usunąć `"vitest.integration.config.ts"` (plik już nie istnieje). Wynik:

```json
"exclude": ["node_modules", "vitest.config.ts"]
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(0e): usunięcie kodu eksportu, migracji, emulatora i konfiguracji Firebase"
```

(Testy statyczne w tym momencie nadal czerwone przez `package.json` i `.env.example`; to naprawia 6.3, w tym samym PR. `tsc` musi już być czysty, bo `tsconfig.json` poprawiony w Step 3. Jeśli reguły repo wymagają zielonego każdego commita, połączyć 6.2–6.4 w jeden commit.)

### 6.3 Zależności, skrypty, zmienne

- [ ] **Step 1: Potwierdzić, że `dotenv`, `cross-env`, `wait-on`, `better-sqlite3` nie mają już użytkowników**

```bash
grep -rnwE "dotenv|cross-env|wait-on|better-sqlite3" \
  --include=*.ts --include=*.tsx --include=*.mjs --include=*.js --include=*.json --include=*.sh \
  app src lib services types scripts tests playwright.config.ts next.config.mjs .husky package.json
```

Oczekiwane: tylko wpisy w `package.json` (zależności i skrypty do usunięcia). Każde inne trafienie = stop, pakiet zostaje, a odpowiadający test w `package-scripts.static.test.ts` poprawić (usunąć ten pakiet z listy `it.each`).

- [ ] **Step 2: Usunąć skrypty z `package.json`**

Usunąć wpisy: `migrate:sqlite-to-firestore`, `test:integration`, `test:integration:local`, `emulator:docker`, `test:integration:docker`.

- [ ] **Step 3: Odinstalować pakiety**

```bash
npm uninstall firebase-admin better-sqlite3 dotenv wait-on cross-env
```

Oczekiwane: `package.json` bez tych pięciu, `package-lock.json` bez drzewa `firebase-admin`, `@google-cloud/*`, `@firebase/*` i bez natywnego `better-sqlite3`. Commit zawiera oba pliki.

- [ ] **Step 4: Usunąć blok Firebase z `.env.example`**

Usunąć linie od komentarza `# Firebase Admin SDK: tylko do eksportu danych…` do `FIREBASE_PRIVATE_KEY=""` włącznie. Zostają `PORT`, `APP_URL` i `NEXUS_VAULT_PATH`. (`APP_URL`: bez zmian, poza zakresem.)

- [ ] **Step 5: Uruchomić testy statyczne (cursor) i potwierdzić zielone**

Prompt: „`npx vitest run tests/unit/etap-0e-cleanup.static.test.ts tests/unit/package-scripts.static.test.ts`; nie edytuj plików; przeszło albo lista FAIL.” Oczekiwane: przeszło.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example tests/unit/package-scripts.static.test.ts
git commit -m "chore(0e): usunięcie firebase-admin i pakietów pomocniczych, zmiennych FIREBASE_*"
```

### 6.4 Dokumentacja

- [ ] **Step 1: `README.md`**

W sekcji konfiguracji (okolice linii 12) usunąć punkt o `FIREBASE_*`. W liście skryptów (okolice linii 24) usunąć `npm run migrate:sqlite-to-firestore`. W sekcji „Bezpieczeństwo lokalne” (linia 28) zdanie o Vercelu zmienić na: „Aplikacja nie jest nigdzie wdrażana.” W opisie modułu zasobów (okolice linii 44–45) zamienić „Lista linków w Firestore (`users/{userId}/resources`)” na „Lista linków w plikach vaulta (`Resources/`)” oraz „zapisywane w Firestore” na „zapisywane w pliku zasobu”. Dokładny katalog zasobów sprawdzić w `lib/nexus/` (`grep -rn "Resources" lib/nexus | head`) przed zapisem.

- [ ] **Step 2: ADR-016 i ADR-020**

W `docs/adr/016-firestore-emulator-docker.md` sekcję `## Status` zastąpić: „Zastąpiony przez [ADR-020](020-lokalne-pliki-zamiast-firestore.md). Emulator i testy integracyjne usunięte w etapie 0e (data merge'a tego PR).” W `docs/adr/020-lokalne-pliki-zamiast-firestore.md` w sekcji „Konsekwencje” zastąpić punkt o `firebase-admin` i skryptach: „Etap 0e zakończony: `firebase-admin`, skrypty eksportu i migracji, emulator i testy integracyjne usunięte; projekt Vercel i projekt Firebase zamknięte. Jedyną kopią starych danych jest zrzut poza repo (dysk + zaszyfrowana kopia na osobnym nośniku); `scripts/import-to-vault.ts` odtwarza z niego vault.”

- [ ] **Step 3: ADR-014, ADR-015, `test_workflow.md`**

W ADR-014 (linia „Wdrożone…”) i ADR-015 (linie „Zaakceptowane podejście: emulator…” i „Wdrożone…”) dopisać na końcu akapitu zdanie „Uwaga (etap 0e): emulator, `lib/firebase-admin.ts`, `getAuth` i testy integracyjne zostały usunięte; zob. ADR-020.” Nie przepisywać historycznej treści. W `tests/docs_tech/test_workflow.md` usunąć sekcje „Testy integracyjne (Firestore)” (emulator w Dockerze i „Bez emulatora”), zostawić testy jednostkowe i e2e; zdanie „Baza: brak — używane są tylko mocki (`lib/firestore-db.js`).” zostaje. W sekcji „Testy E2E (Playwright)” poprawić opis: testy działają na własnym serwerze na porcie **3199** z tymczasowym vaultem (`tests/e2e/global-setup.ts`), bez ekranu logowania i bez użycia działającego dev serwera na 3100. Usunąć odwołanie do `tests/integration/README.md` na końcu pliku.

- [ ] **Step 4: Spec etapu 0**

W `docs/superpowers/specs/2026-11-12-etap-0-odpiecie-firebase-design.md`: w nagłówku „Status” zmienić „kroki 0e–0f w planowaniu” na „0e zaplanowany (`2026-11-12-etap-0e-zdjecie-vercel-i-firebase.md`), 0f w planowaniu”, a po wykonaniu na „0e wykonany”. Dodać na końcu §7 krótką sekcję „Zapis wykonania 0e” z datami: start obserwacji, bramka `--verify` (wynik), druga kopia (bez ścieżki nośnika), usunięcie projektu Vercel, zamknięcie Firebase, koniec karencji, usunięcie projektu Firebase (data, po której jest nieodwracalne). **Bez identyfikatorów projektu, `uid`, nazw nośników** (repo publiczne).

- [ ] **Step 5: Commit**

```bash
git add README.md docs tests/docs_tech
git commit -m "docs(0e): README, ADR i spec po usunięciu Firebase i Vercela"
```

### 6.5 Weryfikacja końcowa, review, PR

- [ ] **Step 1: Szukanie resztek (agent samodzielnie jednym grepem)**

```bash
git ls-files | grep -vE "^docs/|^\.claude/|package-lock.json" | xargs grep -nIiE "firebase|firestore" 2>/dev/null
```

Oczekiwane trafienia i tylko one: nazwa `lib/firestore-db.ts` i importy `@/lib/firestore-db` w `services/`, `tests/` (D7), reguły w testach statycznych (`no-firebase-client`, `repos-static`, `lib/nexus/static`, `import-to-vault/static`, `etap-0e-cleanup`, `package-scripts`), nazwy funkcji `*ResourceToFirestore`/`*ResourcesFromFirestore` w `lib/nexus/repos/resources.ts` i komentarze w `lib/nexus/repos/{common,board}.ts` (D7: nazewnictwo poza 0e), zabytkowa migawka `.playwright-cli/page-2026-04-11T12-48-38-462Z.yml` (śledzony zrzut starego landingu, nieszkodliwy; usunięcie opcjonalne, decyzja użytkownika), nazwa `export-firestore` w `scripts/import-to-vault/read-dump.ts` (sprawdzenie pola `manifest.tool` zrzutu) i `tests/unit/scripts/import-to-vault/helpers.ts` (kształt `Timestamp` w danych testowych), wpis `firebase-service-account.json` w `.gitignore`. Każde inne trafienie poza `docs/` = poprawić.

- [ ] **Step 2: Pełna weryfikacja (cursor)**

Prompt: „W `Second_brain` uruchom po kolei `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, `npm run test:e2e`. Nie edytuj plików. Dla każdego: przeszło albo lista `plik:linia + przyczyna`; podaj liczby testów.” Oczekiwane: `tsc` czysty, lint tylko 3 znane ostrzeżenia, testy zielone (liczba plików spada o testy eksportu i integracyjne, to zamierzone), `build` przechodzi, e2e zielone na tymczasowym vaulcie.

- [ ] **Step 3: Aplikacja startuje bez zmiennych Firebase i bez pakietów**

```bash
env -u FIREBASE_PROJECT_ID -u FIREBASE_CLIENT_EMAIL -u FIREBASE_PRIVATE_KEY npm run dev
```

Oczekiwane: serwer startuje, `/dashboard` się ładuje, dane z vaulta widoczne. To kryterium ze specu „po 0e”.

- [ ] **Step 4: Review diffa**

`scripts/ask-helper.sh --role review agy "<cel: usunięcie Firebase/Firestore/emulatora, lista usuwanych ścieżek, co zostaje celowo (D7, D8); pytanie: czy coś w kodzie nadal zależy od usuniętych modułów, czy testy statyczne są wystarczające, czy w dokumentacji zostały nieaktualne instrukcje uruchamiania emulatora; ścieżki: git diff main...HEAD>"`. Opinie traktować jak hipotezy i weryfikować w kodzie.

- [ ] **Step 5: PR**

```bash
git push -u origin chore/etap-0e-sprzatanie-firebase
gh pr create --title "chore(0e): usunięcie kodu Firebase i Firestore po wygaszeniu projektów" --body "<podsumowanie, lista usuniętych ścieżek, co zostaje celowo (D7, D8), wyniki weryfikacji, link do planu>"
```

Opis PR bez identyfikatorów projektu i `uid`. Merge robi użytkownik.

---

## Poza zakresem

- **0f (`Vault/Work/`).** Stan zbadany przy pisaniu planu: w repo NEXUS `.gitignore` **nie ma** wpisu `Work/`, a w aplikacji nie ma kontroli `git check-ignore`. Wpis w `.gitignore` NEXUS powinien wejść przed utworzeniem pierwszego pliku etatu. Osobny, mały plan. Uwaga projektowa na ten plan: `lib/nexus/` ma test statyczny zabraniający `child_process`, więc kontrola `git check-ignore` nie może tam trafić bez zmiany tej reguły albo umieszczenia kontroli poza `lib/nexus/`.
- **Zmiana nazwy `lib/firestore-db.ts`** na neutralną (D7).
- **Usunięcie szerszego zrzutu `2026-11-12T0915`** z dysku (D5).
- **Usunięcie lokalnego pliku `brain.db`** (stara baza SQLite poza gitem): dane użytkownika, decyzja użytkownika.
- **Przepisywanie historycznych ADR-ów i planów** wspominających Firebase.

## Ryzyka i ograniczenia

- **Nieodwracalna utrata danych spoza zakresu 1.1** (kalendarz, mapy myśli, historia agenta): po Tasku 5 istnieją tylko w szerszym zrzucie. Ograniczenie: Task 2 kopiuje wszystkie trzy katalogi; Task 5 ma okno przywrócenia projektu przez Google (30 dni).
- **Zrzut z danymi osobistymi na nośniku:** tylko szyfrowany (gpg AES256), bez chmury.
- **Ukryte użycie Firebase w kodzie** ujawnione dopiero po zamknięciu reguł (Task 4 Step 5): dlatego zamknięcie jest odwracalne i na początku karencji, a nie na końcu.
- **Rozjazd z kryterium ze specu** (aplikacja bez pakietów Firebase) do Tasku 6 (D4).
- **Usunięcie `tests/integration/` zmniejsza liczbę testów:** zamierzone (D6); regresję pilują testy jednostkowe serwisów i e2e.

## Samokontrola planu względem specu §7 0e i §10

- Bramka `--verify` + 0b zgodne + tydzień pracy → Task 0, Task 1.
- Druga kopia na osobnym nośniku, szyfrowana, z szerszym zrzutem → Task 2.
- Zdjęcie wdrożenia, usunięcie projektu Vercel i `.vercel/` → Task 3.
- Reguły zamykające, karencja, usunięcie projektu Firebase, zrzut zostaje → Tasks 4–5.
- „Aplikacja uruchamia się bez `FIREBASE_*` i bez pakietów Firebase w `package-lock.json`” → Task 6 (6.1 test, 6.3, 6.5 Step 3).
- „Aplikacja nie jest wdrożona na Vercelu; projekt Firebase zamknięty po karencji; zrzut w dwóch miejscach” → Tasks 2, 3, 5.
- Lista rzeczy odłożonych z 0d (`firebase-admin`, `lib/firebase-admin.ts`, skrypty eksportu i migracji, `better-sqlite3`, `cleanup-knowledge-collections.ts`, testy integracyjne, emulator, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, skrypty npm, `FIREBASE_*` w `.env.example`) → Task 6.2–6.3, każdy element jest w `REMOVED_PATHS` albo w teście pakietów.
- 0f → świadomie poza zakresem, ze stanem faktycznym.
