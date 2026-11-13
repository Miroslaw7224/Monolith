# Etap 1-2: Save State, devlog i typ projektu (zapis) — projekt

Data: 2026-11-13
Status: wykonany (2026-11-13)
Nadrzędne: `2026-11-11-asystent-lokalny-nexus-design.md` (§6.1 karta projektu, §7 etap 1), `2026-11-12-etap-1-1-karta-projektu-odczyt-design.md` (podetapy, `bc_projects` w trybie odczytu), `2026-11-12-struktura-kontekstow-design.md` (siatka kontekstu, reguły importów)

## 1. Cel i zakres

Podetap 1-2 daje karcie Projekty pierwszy **zapis do vaulta**: Save State (`state.md`), dziennik decyzji (`devlog.md`) i pole `type` projektu. Całość w jednym PR.

**W zakresie:**

- `Projects/<id>/state.md` (nowy plik): `branch`, `env`, `blocker`, `next_step`, `links[]`, `updated`, `milestone`, `milestone_due`; tworzenie i edycja formularzem na karcie.
- `Projects/<id>/devlog.md` (nowy plik): dopisywanie wpisów na górze; bez edycji i usuwania w UI.
- `type` projektu (`etat` / `wlasny` / `biblioteka`) w frontmatterze `index.md`; zmiana jednej linii.
- Odczyt: `GET /api/projects/[id]` zwraca `type`, `state` (lub `null`), `stateVersion`, `devlog`.
- Świeżość liczona także z `state.updated`.
- Kamień milowy jako nazwa i opcjonalny termin, **bez paska procentowego**.

**Poza zakresem:** edycja i usuwanie wpisów devlogu, procent postępu kamienia, migracja akapitu „Gdzie skończyłem” z `index.md`, edycja zadań (1-3), paczka kontekstu i git (1-4), `owner` i `Work/` (1-5), kafle statystyk z makiety, renderowanie Markdownu w teczce.

**Warunek wstępny:** 1-1 zmergowane (PR #23).

## 2. Decyzje

| #   | Temat               | Decyzja                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Format `state.md`   | Frontmatter YAML + opcjonalna treść (notatka, zachowywana przy zapisie). Aplikacja jest właścicielem pliku: zapis przepisuje frontmatter przez `formatFrontmatter`.                                                                                                                                                                           |
| D2  | Kamień milowy       | Tylko `milestone` (nazwa) i `milestone_due` (`YYYY-MM-DD`, opcjonalnie). Brak `progress`: postęp w rozwijanej aplikacji trudno ocenić rzetelnie. Procent może wrócić w 1-3 jako liczony z zadań powiązanych z kamieniem.                                                                                                                      |
| D3  | Format `devlog.md`  | Wpis = `## YYYY-MM-DD — tytuł` + akapit „Dlaczego”. Nowy wpis ląduje na górze (przed pierwszym `##`). Tylko dopisywanie. Brak pliku: tworzymy z nagłówkiem `# Devlog`. Dwa wpisy tego samego dnia są dozwolone (kolejność = kolejność w pliku).                                                                                               |
| D4  | `type` w `index.md` | Zapis tylko linii `type:` edycją tekstową w bloku frontmattera (bez `formatFrontmatter`, żeby nie gubić komentarzy i kolejności kluczy). Brak klucza: wstawiamy `type: <v>` przed zamykającym `---`. Brak frontmattera: `DomainError` 422, nic nie zapisujemy. Wartości: `etat`, `wlasny`, `biblioteka`; nakładanie z `owner` rozstrzyga 1-5. |
| D5  | Fallback            | Brak `state.md`: karta pokazuje akapit „Gdzie skończyłem” z `index.md` i przycisk „Utwórz Save State”. Bez migracji i bez zapisu do `index.md` poza `type`.                                                                                                                                                                                   |
| D6  | Konflikty           | Wersji (`FileVersion`) wymaga tylko `PUT state` (nadpisanie całego formularza). Dopisanie do devlogu i zmiana `type` idą przez `updateVaultFile` z ponowieniem (zmiana lokalna, nie kasuje cudzych zmian). `ConflictError` → 409.                                                                                                             |
| D7  | Świeżość            | `freshness` liczona z **nowszej** daty z `last_worked` i `state.updated` (pierwsze 10 znaków). Zapis Save State odznacza „stale” bez zapisu do `index.md`. Zepsuta data jest pomijana.                                                                                                                                                        |
| D8  | `updated`           | Ustawia serwer przy każdym zapisie `state.md` (czas lokalny `YYYY-MM-DDTHH:mm`); klient go nie wysyła.                                                                                                                                                                                                                                        |
| D9  | Odpowiedzi zapisów  | Każdy zapis zwraca pełny `ProjectDetailDto` (jak GET). UI podmienia dane z odpowiedzi, nie dopisuje lokalnie.                                                                                                                                                                                                                                 |
| D10 | Ścieżki             | Jak w 1-1: ścieżka budowana z `folder` rejestru, nigdy z `id`; `resolveInsideVault` i strażnik `Work/` z `lib/nexus/vault-fs.ts` zostają.                                                                                                                                                                                                     |
| D11 | Blokery i bugi      | Pole `blocker` w `state.md` jest osobnym tekstem; sekcja Blokery z `tasks.md` i bugi z `bugs.md` zostają jak w 1-1 (odczyt).                                                                                                                                                                                                                  |

## 3. Kontekst `contexts/bc_projects/`

Bez nowych plików poziomu kontekstu (te same pięć); parsery rosną w `repositories/markdown.ts`.

### 3.1 `models.ts`

```ts
export type ProjectType = "etat" | "wlasny" | "biblioteka";
export type ProjectState = {
  branch: string;
  env: string;
  blocker: string;
  nextStep: string;
  links: string[];
  milestone: string;
  milestoneDue?: string;
  updated?: string; // ustawia serwer
  notes: string; // treść pliku pod frontmatterem
};
export type DevlogEntry = { date: string | null; title: string; why: string };
```

`ProjectIndex` dostaje `type?: ProjectType`. `ProjectWithContent` dostaje `state: ProjectState | null`, `stateVersion: FileVersion | null`, `devlog: DevlogEntry[]`.

### 3.2 `repositories/markdown.ts` (czysty tekst)

- `parseState(text): ProjectState`: frontmatter przez `parseFrontmatter`; brak pola → `""` / `[]`; `links` nie-tablica → `[]`; elementy niebędące tekstem pomijane; zły frontmatter rzuca błąd z nazwą pliku. Daty czytane jako tekst.
- `serializeState(state): string`: `formatFrontmatter`; puste `milestoneDue` i `updated` pomijane. `formatFrontmatter` serializuje w YAML 1.1 i cytuje wartości podobne do dat, a parser (YAML 1.2) czyta je z powrotem jako tekst: obowiązuje test round-trip.
- `parseDevlog(text): DevlogEntry[]`: wpis od nagłówka `## ` (dokładnie drugi poziom); nagłówek `YYYY-MM-DD — tytuł` (separator `—`, `–` albo `-`) daje `date` i `title`; inny nagłówek daje `date: null`, `title` = cały nagłówek; `why` = treść do następnego `##`, przycięta. Tekst przed pierwszym `##` ignorowany.
- `prependDevlogEntry(text | null, entry): string`: `null` → `# Devlog\n\n` + wpis; inaczej wpis wstawiany przed pierwszym `## ` (brak `## `: na końcu pliku). Reszta pliku bajtowo bez zmian (poza normalizacją końców linii z `vault-fs`).
- `setFrontmatterType(text, type): string`: w bloku frontmattera zamienia linię `^type:[ \t]*.*$` (klucz w kolumnie 0); brak klucza → wstawia przed zamykającym `---`; brak frontmattera → `DomainError` 422. Treść i pozostałe pola bez zmian.

### 3.3 `repositories/index.ts` (jedyny zapis do vaulta)

- `readProjectIndex` czyta dodatkowo `type` (nieznana wartość → pominięta).
- `readProjectState(entry): { state: ProjectState | null; version: FileVersion | null }`, `readDevlog(entry): DevlogEntry[]` (brak pliku → `[]`).
- `writeProjectState(entry, state, expected: FileVersion | null): FileVersion` przez `writeVaultFile` (`ConflictError` leci dalej).
- `appendDevlogEntry(entry, devlogEntry): Promise<void>` i `writeProjectType(entry, type): Promise<void>` przez `updateVaultFile` (brak `index.md` → `NotFoundError`).

### 3.4 `services.ts`

- `getProject(id, today)`: dokłada `state`, `stateVersion`, `devlog`, `type`; `freshness` z nowszej daty (D7).
- `saveState(id, input, now = new Date()): Promise<ProjectWithContent>`: składa `ProjectState` (`updated` z `now`, `notes` zachowane z poprzedniego pliku), zapis z `input.version`, zwraca odświeżone dane.
- `addDevlogEntry(id, input, now)`: data wpisu z `now` (lokalna `YYYY-MM-DD`), dopisanie, zwraca odświeżone dane.
- `setProjectType(id, type)`: jak wyżej.
- Nieznany `id` → `NotFoundError` we wszystkich trzech. Funkcje zapisu są asynchroniczne.

### 3.5 `schemas.ts`

Zod wejścia (UI importuje tylko ten plik, więc DTO i typy zostają w nim):

- `StateInputSchema`: `branch`, `env` ≤ 200 znaków; `blocker`, `nextStep` ≤ 500; `links` ≤ 10 pozycji, każda `http(s)://`, ≤ 300; `milestone` ≤ 200; `milestoneDue` puste albo `YYYY-MM-DD` będące istniejącą datą; `version` = `null` albo `"<size>:<hash>"`. Teksty przycinane, pola jednowierszowe bez nowych linii.
- `DevlogInputSchema`: `title` 1–200 znaków, jedna linia, bez początkowego `#`; `why` ≤ 2000, bez linii zaczynającej się od `# ` lub `## ` (żeby nie rozbić parsera); CRLF → LF.
- `TypeInputSchema`: `{ type: "etat" | "wlasny" | "biblioteka" }`.
- DTO: `ProjectDetailDto` rozszerzone o `type?`, `state: ProjectStateDto | null`, `stateVersion: string | null`, `devlog: DevlogEntryDto[]` (najnowsze 50). Mapery model → DTO; `folder` nadal poza DTO.

### 3.6 `router.ts` i trasy

`parseBody` z `lib/http` (400 przy złym JSON/zod), `handleServiceError` (409 dla `ConflictError`, 404, 422).

| Trasa                       | Metoda | Body               | Odpowiedź              |
| --------------------------- | ------ | ------------------ | ---------------------- |
| `/api/projects/[id]`        | PATCH  | `{ type }`         | 200 `ProjectDetailDto` |
| `/api/projects/[id]/state`  | PUT    | `StateInputSchema` | 200 `ProjectDetailDto` |
| `/api/projects/[id]/devlog` | POST   | `{ title, why }`   | 201 `ProjectDetailDto` |

Pliki `app/api/projects/**/route.ts` tylko re-eksportują handlery.

## 4. UI (`src/features/projects/`)

Wzorzec wizualny: `docs/mockups/karty/cards/04-projekty.html` (sekcje metryczka, Save State, devlog). UI importuje z kontekstu tylko `schemas.ts`.

| Plik                   | Rola                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ProjectSaveState.tsx` | kafle Save State (tryb odczytu) + formularz edycji; bez `state` fallback „Gdzie skończyłem” + „Utwórz Save State” |
| `ProjectDevlog.tsx`    | lista wpisów (data, tytuł, „Dlaczego”) + formularz dopisania                                                      |
| `ProjectDossier.tsx`   | składa sekcje; select `type` w metryczce; kamień milowy jako nazwa i termin (bez paska)                           |
| `useProjects.ts`       | dochodzą `saveState`, `addDevlogEntry`, `setType`: wołają `apiFetch`, podmieniają szczegóły z odpowiedzi          |

- Linki ze `state.links`: `<a>` tylko dla http(s), inne jako tekst (jak `isHttpUrl` w 1-1; wspólny helper).
- Zapis w toku: przyciski wyłączone (brak podwójnego submitu). Odpowiedź po zmianie wybranego projektu jest ignorowana (ochrona przed spóźnioną odpowiedzią, wzór: test stale response w `useProjects`).
- 409: komunikat „state.md zmienił się poza aplikacją” i przycisk „Wczytaj aktualną wersję” (odświeża szczegóły i resetuje formularz do wersji z dysku; szkic jest tracony, komunikat o tym mówi). Inne błędy: komunikat z body odpowiedzi.
- Walidacja po stronie klienta tylko pomocnicza (limity i `http(s)`); źródłem prawdy jest zod w `schemas.ts`.
- Drobne: pusta sekcja „Blokery” w zadaniach pokazuje „Brak” zamiast samego nagłówka.
- Dostępność: etykiety pól (`<label>`), błędy w `role="alert"`.

## 5. Testy

Testy powstają w kroku wykonania (czerwony → zielony). Środowisko `node` dla kontekstu i tras, `jsdom` dla komponentów. Wzorce: pliki testów z 1-1 w `tests/unit/contexts/bc_projects/` i `tests/unit/features/projects/`; vault tymczasowy przez `useTempVault` (`tests/unit/lib/nexus/repos/helpers.ts`).

| Plik testu                                                      | Przypadek                                                                                                      | Oczekiwanie                                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `…/repositories.markdown.test.ts`                               | `parseState`: pełny frontmatter                                                                                | wszystkie pola; `links` jako tablica                                                        |
| 〃                                                              | `parseState`: pusty frontmatter, `links: foo`, brak pól                                                        | `""`, `[]`, bez wyjątku                                                                     |
| 〃                                                              | `parseState`: zepsuty YAML                                                                                     | błąd z nazwą pliku                                                                          |
| 〃                                                              | `serializeState` → `parseState`                                                                                | te same wartości, daty jako tekst (round-trip YAML 1.1/1.2), `notes` zachowane              |
| 〃                                                              | `parseDevlog`: dwa wpisy, `—` / `-`, nagłówek bez daty, tekst przed pierwszym `##`                             | kolejność pliku; `date: null` dla nagłówka bez daty; wstęp pominięty                        |
| 〃                                                              | `prependDevlogEntry`: `null`, plik z wpisami, plik bez `##`                                                    | `# Devlog` + wpis; wpis przed starymi, reszta bez zmian; wpis na końcu                      |
| 〃                                                              | `setFrontmatterType`: z `type: x`, bez klucza, cytowany, z komentarzem YAML, CRLF, bez frontmattera            | zamiana jednej linii, wstawienie przed `---`, komentarze i kolejność zachowane, 422         |
| `…/repositories.test.ts` (vault tymczasowy)                     | `writeProjectState`: nowy plik, edycja ze zgodną wersją, stara wersja                                          | plik utworzony; zapis; `ConflictError`, plik niezmieniony                                   |
| 〃                                                              | `appendDevlogEntry`: brak pliku, istniejący                                                                    | utworzony z nagłówkiem; wpis na górze                                                       |
| 〃                                                              | `writeProjectType`: treść i pozostałe pola `index.md`                                                          | tylko linia `type` zmieniona (porównanie bajtowe reszty); brak `index.md` → `NotFoundError` |
| 〃                                                              | `folder: Work/x/`, `../x` przy zapisie                                                                         | `WorkAreaBlockedError` / `PathOutsideVaultError`, nic nie zapisane                          |
| `…/services.test.ts`                                            | `freshness` z `last_worked` 20 dni i `state.updated` wczoraj; zepsuta `updated`                                | `fresh`; wartość z `last_worked`                                                            |
| 〃                                                              | `saveState`: `updated` z wstrzykniętego `now`, `notes` zachowane, nieznany `id`                                | pole ustawione; treść bez zmian; `NotFoundError`                                            |
| 〃                                                              | `addDevlogEntry`: data z `now`                                                                                 | `## 2026-11-13 — …`                                                                         |
| `…/schemas.test.ts`                                             | `StateInputSchema`: `javascript:` w linku, 11 linków, zła `milestoneDue` (`2026-02-30`), nowa linia w `branch` | odrzucone                                                                                   |
| 〃                                                              | `DevlogInputSchema`: `title` z `\n`, `why` z linią `## x`, pusty `title`, `why` > 2000                         | odrzucone; CRLF zamieniony na LF                                                            |
| 〃                                                              | `toDetailDto`                                                                                                  | brak `folder`; `stateVersion` jako `"<size>:<hash>"`; devlog ≤ 50                           |
| `…/router.test.ts` (mock `services`)                            | PUT/POST/PATCH poprawne; zły JSON; `ConflictError`; `NotFoundError`; `DomainError` 422                         | 200/201/200; 400; 409; 404; 422                                                             |
| `tests/unit/features/projects/*.test.tsx`                       | fallback bez `state`; kafle ze `state`; link `javascript:`                                                     | „Gdzie skończyłem” + przycisk; kafle; tekst zamiast `<a>`                                   |
| 〃                                                              | zapis w toku, podwójny klik, 409, zmiana projektu w trakcie zapisu                                             | jedno wywołanie; komunikat i przycisk wczytania; spóźniona odpowiedź zignorowana            |
| 〃                                                              | dopisanie wpisu devlogu                                                                                        | lista z odpowiedzi (bez lokalnego prepend), formularz wyczyszczony                          |
| `tests/unit/contexts/bc_projects/write-boundary.static.test.ts` | pliki kontekstu wołają `writeVaultFile` / `updateVaultFile` / `deleteVaultFile` / `node:fs`                    | tylko `repositories/` woła zapis; żaden plik nie importuje `node:fs`                        |
| `tests/unit/architecture.static.test.ts`                        | cały kontekst i `src/features/projects`                                                                        | przechodzi bez nowych wyjątków w baseline                                                   |

**Bramka:** `npx vitest`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (zlecane `cursor`), review diffa przez `agy --role review`, smoke test na prawdziwym vaulcie (zapis Save State i wpisu devlogu dla `monolith`, zmiana `type`, sprawdzenie `git diff` w vaulcie: zmienione tylko oczekiwane pliki i linie).

## 6. Zadania planu

Kolejność = commity, każdy się kompiluje i przechodzi testy.

1. **Osobny commit samego testu** (reguła CLAUDE.md): `readonly.static.test.ts` → `write-boundary.static.test.ts` (zapis dozwolony tylko w `repositories/`, `node:fs` nadal zakazany).
2. `models.ts`, `repositories/markdown.ts` (parsery i serializery) + testy.
3. `repositories/index.ts` (odczyt `type`/`state`/`devlog`, zapisy) + testy na vaulcie tymczasowym.
4. `services.ts` (świeżość, `saveState`, `addDevlogEntry`, `setProjectType`) + testy.
5. `schemas.ts` (zod, DTO) + `router.ts` + trasy `app/api/projects/**` + testy.
6. UI: `ProjectSaveState`, `ProjectDevlog`, `ProjectDossier`, `useProjects` + testy; drobna poprawka „Blokery”.
7. Dokumentacja: `STAN-W-KODZIE.md` §4, tabela podetapów w specu 1-1 (1-2 wykonany), README; odhaczenie zadań w `NEXUS/Vault/Projects/monolith/tasks.md`.
8. Bramka (sekcja 5), smoke test, review, PR.
