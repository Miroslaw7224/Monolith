# Rozjazd karty z repozytorium projektu — projekt

Data: 2026-11-16
Status: do przeglądu
Nadrzędne: `2026-11-11-asystent-lokalny-nexus-design.md` (§6.1 karta projektu, „Save State z gita", „Wykrywacz porzuconych projektów"), `2026-11-12-etap-1-1-karta-projektu-odczyt-design.md` (freshness), `2026-11-13-etap-1-2-save-state-devlog-design.md` (`state.md`), `2026-11-13-etap-1-4-paczka-kontekstu-design.md` i `2026-11-14-paczka-kontekstu-role-design.md` (paczka i role)

## 1. Problem i cel

Karta projektu w vaulcie (opis „Gdzie skończyłem", zadania, `state_confidence`) starzeje się, gdy kod projektu idzie do przodu bez wiedzy aplikacji. Przykład z 2026-11-16: Tester AI miał w repo dwa commity (`8c107d7`, `eeb9481`) nowsze niż stan opisany w karcie (`deacad1` z 2026-11-07), a karta wyglądała na świeżą, bo `last_worked` ustawiono ręcznie na dziś.

Dziś `freshness` liczy się wyłącznie z dat (`last_worked` z `index.md` i `updated` z `state.md`; `effectiveLastWorked` w `contexts/bc_projects/services/index.ts`). Git jest czytany tylko w paczce kontekstu i licznikach aktywności. Pole `last_code_session` we frontmatterze nie jest nigdzie czytane.

**Cel:** aplikacja sama wykrywa, że repozytorium projektu ma commity, których karta nie zna, pokazuje to na liście projektów i w Kokpicie oraz daje gotową paczkę „odśwież kartę" dla agenta. Aplikacja niczego nie przepisuje sama: zadania i opis zmienia agent albo użytkownik.

**Poza zakresem:** automatyczne wołanie agenta; automatyczny zapis zadań, opisu i `state_confidence`; wykrywanie niezacommitowanych zmian (working tree); ostrzeżenie `state.branch` ≠ bieżąca gałąź; cache wyniku; wykrywacz porzuconych projektów (osobna pozycja ze specu nadrzędnego); zmiana `freshness` (zostaje datowy).

## 2. Decyzje

| #   | Decyzja                     | Wybór                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Punkt odniesienia           | Zapisany sha commita, nie data. Łapie commity z tego samego dnia i nie zależy od ręcznie ustawianego `last_worked`                                                                                                                                                                                                                                                                                                                                                  |
| D2  | Miejsce sha                 | Pole `code_commit` w `state.md` (plik aplikacji, zapis `saveState` już istnieje). Nie piszemy do `index.md`: jest pisany ręcznie w Obsidianie, a jedyny pomocnik (`formatFrontmatter`) serializuje YAML od nowa (zmiana kolejności kluczy, cudzysłowów, utrata komentarzy)                                                                                                                                                                                          |
| D3  | Zakres po wykryciu          | Znacznik na liście i w Kokpicie, paczka „odśwież kartę", przycisk „Oznacz jako zaktualizowaną". Zapis treści karty robi agent lub użytkownik                                                                                                                                                                                                                                                                                                                        |
| D4  | Koszt odczytu               | `listProjects` zostaje bez gita (woła go 8 miejsc w 5 kontekstach: Kokpit 4×, Mapa, Arsenał, dokumenty NEXUS, router listy). Git wołają tylko `getProject` oraz osobny odczyt `GET /api/projects/code-sync`. Projekt bez `code_commit` w ogóle nie dotyka gita                                                                                                                                                                                                      |
| D5  | Wykrywanie nieprzodka       | `git merge-base --is-ancestor <sha> HEAD` przed liczeniem. `rev-list --count sha..HEAD` dla sha z innej gałęzi lub sprzed rebase zwraca dodatni licznik bez błędu, co dałoby fałszywe „behind"                                                                                                                                                                                                                                                                      |
| D6  | Przycisk a `updated`        | `PUT …/code-sync` zmienia tylko `code_commit`; **nie** ustawia `updated`. Potwierdzenie sha nie jest „pracą nad projektem" i nie może maskować `stale` w freshness. Odświeżenie opisu przez Save State dalej podnosi `updated` jak dziś                                                                                                                                                                                                                             |
| D7  | Który sha zapisuje przycisk | Ten, który UI pokazał (`head` z DTO, pełny sha; UI skraca go do 7 znaków tylko w tekście), nie HEAD z chwili kliknięcia: commity, które wpadły w międzyczasie, nie mogą zostać oznaczone jako uwzględnione. Gdy DTO nie ma `head` (`no-baseline`, stan celowo bez gita), przycisk wysyła puste ciało, a serwer bierze HEAD z chwili zapisu i sprawdza go tą samą ścieżką (`readCodeSync`). Serwer sprawdza, że sha jest commitem w repo i przodkiem lub równym HEAD |
| D8  | Dane agenta                 | Paczka niesie instrukcję: po odświeżeniu opisu i zadań ustaw `code_commit: <HEAD>` w `state.md`. Przycisk jest awaryjną drogą dla tych, którzy sami niczego nie zmieniają                                                                                                                                                                                                                                                                                           |

## 3. Zmiany w `lib/git/project-git.ts`

Tylko odczyt, wzorzec jak `commitsSince` i `currentBranch` (przez `execGit`, nie przez rozszerzanie unii `GitCommand`). Każda funkcja przyjmująca sha waliduje go przed użyciem w argv: `^[0-9a-f]{7,40}$` po `toLowerCase()`. Brak powłoki (`execFileSync`), więc wstrzyknięcie opcji jest wykluczone; niepoprawny sha zwraca błąd bez wywołania gita.

```ts
export function headSha(repoDir: string): { ok: true; sha: string } | { ok: false };
// git rev-parse --verify --quiet HEAD ; puste repo (HEAD bez commitów) => ok:false

export type RelationToHead =
  | { kind: "ancestor"; ahead: number } // ahead = 0 => sha == HEAD
  | { kind: "diverged" } // obiekt istnieje, ale nie jest przodkiem HEAD
  | { kind: "missing" } // brak obiektu (rebase, shallow, force-push)
  | { kind: "error" }; // git niedostępny, timeout, niepoprawny sha
export function relationToHead(repoDir: string, sha: string): RelationToHead;
// 1) git merge-base --is-ancestor <sha> HEAD  (0 = przodek, 1 = nie, 128 = brak obiektu)
// 2) dla przodka: git rev-list --count <sha>..HEAD

export function commitsInRange(
  repoDir: string,
  sha: string,
  limit: number
): { ok: true; lines: string[]; total: number } | { ok: false };
// git log --oneline --no-decorate -n <limit> <sha>..HEAD ; total z rev-list --count
export function diffStatInRange(
  repoDir: string,
  sha: string
): { ok: true; stat: string } | { ok: false };
// git diff --stat <sha>..HEAD
```

Obowiązują te same limity co w reszcie pliku: timeout 5 s, brak powłoki, katalog po `resolveRepoPath`.

## 4. Kontekst `contexts/bc_projects/`

### 4.1 `models.ts`

- `ProjectState` dostaje `codeCommit?: string` (YAML: `code_commit`, spójnie z `next_step`, `milestone_due`).
- `CodeSync`:

```ts
type CodeSync =
  | { status: "current"; head: string }
  | { status: "behind"; ahead: number; head: string }
  | { status: "diverged"; head: string }
  | { status: "no-baseline" } // brak code_commit w state.md albo brak state.md
  | { status: "unknown-sha" } // sha poza repo (missing)
  | { status: "unavailable" }; // brak local_path, repo niedostępne, puste repo, błąd gita
```

`head` to pełny sha (40 znaków) bieżącego HEAD; UI skraca go do 7 znaków.

### 4.2 `repositories/markdown.ts` i `repositories/index.ts`

- `parseState`, `sameStateFields` i `serializeState*` obsługują `code_commit` (brak = `undefined`; nie zapisywany jako pusty ciąg). Pole przetrwa ręczną edycję pliku w Obsidianie.
- `readCodeSync(entry, codeCommit?)`: wrapper na `resolveRepoPath` + `headSha` + `relationToHead`; zwraca `CodeSync`. Brak `codeCommit` → `no-baseline` bez wywołania gita. Mapowanie: `ancestor` z `ahead` 0 → `current`, `ahead` > 0 → `behind`; `diverged` → `diverged`; `missing` → `unknown-sha`; reszta błędów → `unavailable`.
- `readGitRange(entry, codeCommit)`: `commitsInRange` (limit 30) + `diffStatInRange`, tylko dla paczki „odśwież kartę".
- Brak `fs` i `child_process` w `repositories` (reguła architektury): git wyłącznie przez `lib/git`.

### 4.3 `services/index.ts`

- **`saveState` zachowuje `codeCommit`.** Dziś buduje nowy obiekt i zachowuje tylko `notes` (`current?.notes`). Po zmianie: `codeCommit: current?.codeCommit`. Bez tego zwykły zapis formularza Save State kasowałby punkt odniesienia. `StateInput` (formularz) nie dostaje tego pola.
- `getCodeSync(id): CodeSync`: odczyt stanu projektu + `readCodeSync`.
- `listCodeSync(): Record<string, CodeSync>`: pętla po rejestrze; wyjątek pojedynczego projektu → `unavailable` dla niego. `listProjects` niezmieniony.
- `getProject` (`getProjectDetail`) dodaje `codeSync` do wyniku. Tematy Kokpitu idą przez `getProject`, więc dziedziczą pole.
- `markCodeSynced(id, commit, now?)`: waliduje sha (zod w `schemas`), wymaga `relationToHead` = `ancestor` (równy lub wcześniejszy niż HEAD), inaczej `DomainError` 422 (jak inne błędy zapisu w `repositories`); zły format sha w ciele PUT to 400 z walidacji zod. Czyta stan z tokenem wersji, ustawia tylko `codeCommit` (nie `updated`, zob. D6), zapisuje przez `writeProjectState` z tokenem; zmiana pliku w międzyczasie → `ConflictError` (409), jak w Save State. Brak `state.md` → tworzy plik z pustymi polami obowiązkowymi (`branch`, `env`, `blocker`, `nextStep`, `milestone` jako `""`, `links` jako `[]`) i `notes: ""`.
- `buildContextPack` z rolą `refresh` (zob. §4.5).

### 4.4 `router.ts`, `schemas.ts`, trasy

- `schemas.ts`: `CodeSyncDto` (unia jak `CodeSync`, bez `string` typu „behind(+N)"), `CodeSyncMapDto = Record<string, CodeSyncDto>`, `CodeSyncMarkInputSchema = z.object({ commit: z.string().regex(/^[0-9a-f]{7,40}$/i).optional() })` (bez `commit` serwer bierze HEAD), mapery model → DTO; `ProjectDetailDto` dostaje `codeSync`. `ProjectSummaryDto` **nie** dostaje `codeSync` (lista jest bez gita, D4).
- Trasy (`app/api/**/route.ts` tylko re-eksportują handler):
  - `GET /api/projects/code-sync` → `getCodeSyncMap` (odczyt całej mapy; statyczny segment obok `[id]`)
  - `PUT /api/projects/[id]/code-sync` → `markCodeSynced` (ciało: `{ commit }`)
- `handleServiceError` mapuje błędy jak w pozostałych handlerach (`NotFoundError` 404, walidacja 400, `ConflictError` 409).

### 4.5 Paczka „odśwież kartę" (`services/context-pack.ts`)

- Nowa rola `refresh` w `ContextPackRole` i `ROLE_PROFILES`, bez osobnego budżetu: budżet całej paczki zostaje `PACK_BUDGET_TOKENS` (4000). Rola ma `rulesMax: 1200`, limity 30 commitów i 40 linii diffu oraz własne kroki redukcji w `composeContextPack` (najpierw diff do 10 linii, potem 10 commitów).
- Kolejność sekcji: `rules`, `state`, `gitRange`, `tasks`, `bugs`. Nowa sekcja `gitRange`: nagłówek „Zmiany w repo od ostatniej karty (od `<sha>`)", lista `commitsInRange` (do 30; przy `total` > 30 dopisek „…i N starszych"), `diffStatInRange`. Zwykłe `snapshotRepo` nie jest używane w tej roli (pokazuje working tree, a nie zakres).
- Instrukcja dla agenta na końcu: „Na podstawie powyższych commitów zaproponuj poprawki w `Gdzie skończyłem` i zadaniach (nic nie usuwaj bez wskazania commita, który to zamyka). Po zatwierdzeniu ustaw `code_commit: <HEAD>` w `state.md`."
- Brak `code_commit` (`no-baseline`) → paczka `refresh` zawiera ostatnie 30 commitów i instrukcję ustawienia `code_commit` po pierwszym odświeżeniu.
- Wybór roli jak dziś: `GET /api/projects/[id]/context-pack?role=refresh` (`ContextPackRoleSchema` dostaje wartość `refresh`).
- Prywatność: strefa `Work/` i ostrzeżenie dla `owner: work` bez zmian (reguły z paczki nadrzędnej); nic nowego nie opuszcza maszyny.

## 5. UI (`src/features/…`)

- `src/features/projects/useCodeSync.ts`: hook pobierający `GET /api/projects/code-sync` po wyrenderowaniu listy, osobno od `useProjects` (lista nie czeka na git).
- `ProjectList.tsx`: znacznik przy projekcie: `behind` → „kod nowszy: N commitów", `diverged` → „historia repo zmieniona", `unknown-sha` → „sha poza repo". `current` i `no-baseline` bez znacznika (brak punktu odniesienia nie jest alarmem). Opcjonalny kafel „do odświeżenia" w `projectTiles.ts` (liczba projektów `behind`/`diverged`).
- Teczka projektu (`ProjectDossier`): blok „Stan względem kodu" z tekstem stanu, przyciskiem „Kopiuj paczkę »odśwież kartę«" (`ProjectContextPack.tsx`, rola `refresh`) i „Oznacz jako zaktualizowaną" (`PUT …/code-sync` z `head` z DTO). Informacja pod blokiem: „Wykrywamy tylko zacommitowane zmiany."
- Kokpit (`contexts/bc_cockpit/services.ts`, `toTopic`, ok. linii 63–72): `codeSync.status` `behind` lub `diverged` ustawia `confidence: "check"`, jak dziś `stale`.
- Napisy w obu językach (spec `2026-11-15-jezyk-pl-en-design.md`).
- Importy UI z kontekstu tylko z `schemas`.

## 6. Dokumentacja formatu

`docs/nexus-vault-formaty-yaml.md`: dopisać `state.md` z polem `code_commit` (sha 7–40 znaków szesnastkowych, pisany przez aplikację lub agenta po odświeżeniu karty). Dziś tego pliku w dokumencie brak.

## 7. Testy (Vitest, `tests/unit/…`)

`lib/git` na prawdziwym tymczasowym repo (`tests/unit/helpers/tempGit.ts`):

- 3 commity, sha pierwszego → `ancestor` z `ahead: 2`; sha równy HEAD → `ancestor` z `ahead: 0`.
- sha z osobnej gałęzi (nie przodek HEAD) → `diverged`; sha po `git commit --amend` poprzedniego (obiekt jeszcze w repo, nie jest przodkiem) → `diverged`.
- sha niestniejący (`deadbeef…`) → `missing`; shallow clone bez sha → `missing`.
- puste repo → `headSha` zwraca `ok: false`.
- niepoprawny sha (`--help`, `HEAD`, 6 znaków, znaki spoza `0-9a-f`) → `error` bez wywołania gita (asercja na mocku `execFileSync`); sha wielkimi literami jest normalizowany do małych i działa.
- `commitsInRange`: 35 commitów po sha → `lines.length` 30, `total` 35.

`contexts/bc_projects` (services, repozytoria zamockowane):

- `no-baseline` (brak `code_commit`, brak `state.md`) bez wywołania gita; `current`; `behind` (3); `diverged`; `unknown-sha`; `unavailable` (brak `local_path`, `resolveRepoPath` odmawia).
- `saveState` po `markCodeSynced` zachowuje `codeCommit`; `notes` bez zmian.
- `markCodeSynced`: zapisuje sha, nie zmienia `updated`; sha nie będący przodkiem HEAD → błąd walidacji; zmiana pliku w międzyczasie → `ConflictError`; brak `state.md` → utworzenie z pustymi polami.
- `listProjects` nie woła gita (asercja na mocku `lib/git`).
- parser `state.md` z `code_commit` i bez, serializacja round-trip.

Paczka: rola `refresh` zawiera sekcję `gitRange`, nie zawiera `snapshotRepo`, mieści się w budżecie roli, instrukcja jest obecna; przy `no-baseline` brak nagłówka „od `<sha>`".

UI (jsdom): znacznik dla `behind(3)`, brak znacznika dla `current` i `no-baseline`, przycisk wysyła `head` z DTO.

Kokpit: `behind` → `confidence: "check"`.

Test architektury (`tests/unit/architecture.static.test.ts`) bez zmian i musi przechodzić.

## 8. Ryzyka i uwagi

- Gałąź: porównujemy z HEAD aktualnie wyewidencjonowanej gałęzi. Praca na gałęzi funkcjonalnej daje `behind`; powrót na inną gałąź może dać `diverged`. To świadome uproszczenie (YAGNI): znacznik mówi „sprawdź kartę", a nie „karta jest zła".
- Zwiększone obciążenie dotyczy tylko `getProject` i jednej osobnej trasy; przy ok. 8 projektach to ok. 16 szybkich wywołań. W planie sprawdzić czas odpowiedzi `GET /api/projects/code-sync`; jeśli przekracza ok. 1 s, wykonać wywołania równolegle w `lib/git` (poza zakresem tego specu).
- Pole `last_code_session` w `index.md` zostaje nieużywane; nie usuwamy go (ręczne dane użytkownika).
