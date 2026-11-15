# Opis projektu „Po co i dlaczego” w karcie Projekty — projekt

Data: 2026-11-15
Status: do akceptacji
Nadrzędne: `2026-11-12-etap-1-1-karta-projektu-odczyt-design.md` (karta projektu, parsowanie `index.md`)

## 1. Cel i zakres

Karta projektu (Alt+4) nie mówi, po co projekt istnieje. Po kafelku z nazwą i linkami od razu idzie Save State. Dodajemy krótki opis (2–3 zdania: po co i dlaczego) tuż pod kafelkiem, przed Save State.

**W zakresie:** nowa sekcja `## Po co i dlaczego` w `index.md` projektu, odczyt w `bc_projects`, pole w DTO, karta tylko do odczytu w `ProjectDossier`, PL/EN, testy, opis formatu w dokumentach vaulta, wypełnienie karty Code Sensei.

**Poza zakresem:** edycja z UI (zapis do vaulta), opis na kafelkach listy, opis w paczce kontekstu dla AI. Można dodać osobnym podetapem.

## 2. Decyzje

| #   | Decyzja           | Wybór                                                                                                                                                                    |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Miejsce w vaulcie | Sekcja `## Po co i dlaczego` w `index.md` projektu, pierwsza po frontmatterze (zaraz przed `## O projekcie`). Aplikacja nic nie zapisuje; edycja ręczna lub przez agenta |
| D2  | Odczyt            | Przez istniejące `parseSections`, tak jak „Gdzie skończyłem”; treść jako surowy tekst, przycięta (`trim`); pusta sekcja = `null`                                         |
| D3  | Brak sekcji       | Karty opisu nie renderujemy (bez placeholdera). Projekty bez sekcji wyglądają jak dotąd                                                                                  |
| D4  | Treść „dlaczego”  | Pisze ją autor projektu. Agent wypełniający kartę nie zgaduje motywacji: gdy brak w źródłach, wpisuje jawną lukę „Motywacja: do uzupełnienia”                            |
| D5  | Test architektury | Bez zmian (`tests/unit/architecture.static.test.ts` nietknięty)                                                                                                          |

## 3. Zmiany w kodzie

### 3.1 `contexts/bc_projects/`

- `models.ts`: `ProjectIndex` dostaje `purpose: string | null` (obok `whereIStopped`).
- `repositories/index.ts`, `readProjectIndex`: obok `whereSection` szuka sekcji o nagłówku `Po co i dlaczego`; `purpose = body === "" ? null : body`. Gałąź „brak pliku `index.md`” zwraca `purpose: null`.
- `services/index.ts`: gałąź awaryjna po błędzie odczytu (obecnie `whereIStopped: null`) dostaje `purpose: null`.
- `schemas.ts`: `ProjectDetailDto` dostaje `purpose: string | null`; mapper `toDetailDto` przepisuje `p.purpose`. Pola nie dodajemy do `ProjectSummaryDto` (lista go nie potrzebuje).
- `router.ts`, `app/api/**`: bez zmian (pole jedzie w istniejącym GET szczegółów).

### 3.2 UI (`src/features/projects/`)

- `ProjectDossier.tsx`: między `<article className="prj-card">` z nagłówkiem a `<ProjectSaveState>` renderujemy `<article className="prj-card prj-purpose">` z tytułem `t("projects:dossier.purposeTitle")` i tekstem (zachowane łamanie linii), tylko gdy `project.purpose !== null`.
- `projects.css`: styl `.prj-purpose` spójny z sąsiednimi kartami (bez nowych kolorów).
- `src/i18n/locales/pl/projects.ts` i `en/projects.ts`: klucz `dossier.purposeTitle` („Po co i dlaczego” / „Why this exists”).

### 3.3 Vault i dokumentacja

- `docs/nexus-vault-formaty-yaml.md` oraz `../NEXUS/CLAUDE.md` (sekcja „Format index.md”): dopisać `## Po co i dlaczego — 2–3 zdania: po co projekt istnieje i dlaczego powstał (pierwsza sekcja)`.
- `../NEXUS/Vault/Projects/code-sensei/index.md`: dopisać sekcję z tekstem z audytu pomocników (agy, cursor): „po co” z README i `app.py`, „dlaczego” jako jawna luka do uzupełnienia przez autora. Zmiany w NEXUS: commit i push od razu (reguła NEXUS).

## 4. Testy (Vitest, `tests/unit/...`)

| Przypadek                                                             | Oczekiwanie                                                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `readProjectIndex`: `index.md` z sekcją `## Po co i dlaczego` + tekst | `purpose` = przycięty tekst sekcji, bez następnej sekcji                |
| `readProjectIndex`: `index.md` bez tej sekcji                         | `purpose === null`                                                      |
| `readProjectIndex`: sekcja z samym nagłówkiem / białymi znakami       | `purpose === null`                                                      |
| `readProjectIndex`: brak pliku `index.md`                             | `purpose === null`                                                      |
| `toDetailDto`                                                         | `dto.purpose` równe `purpose` modelu                                    |
| `ProjectDossier` z `purpose: "Tekst"`                                 | widoczna karta z tytułem i tekstem, przed „Save State” w kolejności DOM |
| `ProjectDossier` z `purpose: null`                                    | brak karty „Po co i dlaczego”                                           |
| `ProjectDossier` po zmianie języka na EN                              | tytuł „Why this exists”                                                 |

## 5. Ryzyka

- Fixtury `Project`/`ProjectDetailDto` w ok. 10 plikach testów (grep `whereIStopped` w `tests/`, m.in. `useProjects`, `ProjectSaveState`, `router`, `repositories`, `context-pack.roles`, `bc_cockpit/services`) muszą dostać `purpose` (nowe wymagane pole): dopisać `purpose: null`, nie osłabiać typów.
- Nagłówek sekcji jest porównywany dosłownie (jak „Gdzie skończyłem”); literówka w `index.md` = brak karty. Opis formatu w dokumentach to zabezpiecza.
