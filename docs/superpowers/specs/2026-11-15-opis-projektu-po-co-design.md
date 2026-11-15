# Opis projektu „Po co i dlaczego” w karcie Projekty — projekt

Data: 2026-11-15
Status: do akceptacji (po review pomocników: agy, cursor; poprawki zweryfikowane w kodzie)
Nadrzędne: `2026-11-12-etap-1-1-karta-projektu-odczyt-design.md` (karta projektu, parsowanie `index.md`)

## 1. Cel i zakres

Karta projektu (Alt+4) nie mówi, po co projekt istnieje. Po kafelku z nazwą i linkami od razu idzie Save State. Dodajemy krótki opis (2–3 zdania: po co i dlaczego) tuż pod kafelkiem, przed Save State.

**W zakresie:** nowa sekcja `## Po co i dlaczego` w `index.md` projektu, odczyt w `bc_projects`, pole w DTO, karta tylko do odczytu w `ProjectDossier`, PL/EN, testy, opis formatu w dokumentach vaulta, wypełnienie karty Code Sensei.

**Poza zakresem:** edycja z UI (zapis do vaulta), opis na kafelkach listy, opis w paczce kontekstu dla AI. Można dodać osobnym podetapem.

## 2. Decyzje

| #   | Decyzja                    | Wybór                                                                                                                                                                                                                                        |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Miejsce w vaulcie          | Sekcja `## Po co i dlaczego` w `index.md` projektu, pierwsza po frontmatterze (zaraz przed `## O projekcie`). Aplikacja nic nie zapisuje; edycja ręczna lub przez agenta                                                                     |
| D2  | Odczyt                     | Przez istniejące `parseSections`, tak jak „Gdzie skończyłem”; treść jako surowy tekst, przycięta (`trim`); pusta sekcja = `null`                                                                                                             |
| D3  | Brak sekcji                | Karty opisu nie renderujemy (bez placeholdera). Projekty bez sekcji wyglądają jak dotąd                                                                                                                                                      |
| D4  | Treść „dlaczego”           | Pisze ją autor projektu. Agent wypełniający kartę nie zgaduje motywacji: gdy brak w źródłach, wpisuje jawną lukę „Motywacja: do uzupełnienia”                                                                                                |
| D5  | Test architektury          | Bez zmian (`tests/unit/architecture.static.test.ts` nietknięty)                                                                                                                                                                              |
| D6  | Szablon nowego projektu    | `renderNewProjectFiles` (`repositories/markdown.ts:346-350`) **bez zmian**: projekt utworzony z UI nie ma sekcji, więc nie ma karty, dopóki autor jej nie doda. Zgodne z D3 (placeholder „_Do uzupełnienia._” pokazałby się w UI jako treść) |
| D7  | Długi tekst i formatowanie | Opis ma być krótki (2–3 zdania), więc bez limitu wysokości. Tekst surowy, bez Markdown (jak „Gdzie skończyłem”); łamanie linii przez `white-space: pre-wrap`                                                                                 |

## 3. Zmiany w kodzie

### 3.1 `contexts/bc_projects/`

- `models.ts`: `ProjectIndex` dostaje `purpose: string | null` (obok `whereIStopped`).
- `repositories/index.ts`, `readProjectIndex`: obok `whereSection` szuka sekcji o nagłówku `Po co i dlaczego`; `purpose = body === "" ? null : body`. Gałąź „brak pliku `index.md`” zwraca `purpose: null`.
- `services/index.ts`: gałąź awaryjna po błędzie odczytu (obecnie `whereIStopped: null`) dostaje `purpose: null`.
- `schemas.ts`: `ProjectDetailDto` dostaje `purpose: string | null`; mapper `toDetailDto` przepisuje `p.purpose`. Pola nie dodajemy do `ProjectSummaryDto` (lista go nie potrzebuje).
- `router.ts`, `app/api/**`: bez zmian (pole jedzie w istniejącym GET szczegółów).

### 3.2 UI (`src/features/projects/`)

- `ProjectDossier.tsx`: między `<article className="prj-card">` z nagłówkiem a `<ProjectSaveState>` renderujemy `<article className="prj-card prj-purpose">` z tytułem `t("projects:dossier.purposeTitle")` i `<p className="prj-purpose__text">{project.purpose}</p>` (tekst jako dziecko Reacta, bez `dangerouslySetInnerHTML`), tylko gdy `project.purpose !== null`.
- `projects.css`: `.prj-purpose__text { margin: 0; white-space: pre-wrap; }` (wzorzec `.prj-savestate .prj-where`, linie 1124–1128, bez `max-height`); reszta spójna z sąsiednimi kartami, bez nowych kolorów.
- `src/i18n/locales/pl/projects.ts` i `en/projects.ts`: klucz `dossier.purposeTitle` („Po co i dlaczego” / „Why this exists”).

### 3.3 Vault i dokumentacja

- `docs/nexus-vault-formaty-yaml.md` oraz `../NEXUS/CLAUDE.md` (sekcja „Format index.md”): dopisać `## Po co i dlaczego — 2–3 zdania: po co projekt istnieje i dlaczego powstał (pierwsza sekcja)`, z regułą: w treści sekcji nie używać linii zaczynających się od `## ` (parser kończy sekcję na każdej takiej linii, także w bloku kodu).
- `../NEXUS/Vault/Projects/code-sensei/index.md`: dopisać sekcję z tekstem z audytu pomocników (agy, cursor): „po co” z README i `app.py`, „dlaczego” jako jawna luka do uzupełnienia przez autora. Zmiany w NEXUS: commit i push od razu (reguła NEXUS).

## 4. Testy (Vitest, `tests/unit/...`)

| Przypadek                                                                                  | Oczekiwanie                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `readProjectIndex`: `index.md` z sekcją `## Po co i dlaczego` + tekst                      | `purpose` = przycięty tekst sekcji, bez następnej sekcji                 |
| `readProjectIndex`: `index.md` bez tej sekcji                                              | `purpose === null`                                                       |
| `readProjectIndex`: sekcja z samym nagłówkiem / białymi znakami                            | `purpose === null`                                                       |
| `readProjectIndex`: brak pliku `index.md`                                                  | `purpose === null`                                                       |
| `toDetailDto`                                                                              | `dto.purpose` równe `purpose` modelu                                     |
| `parseSections`/`readProjectIndex`: dwie sekcje `## Po co i dlaczego`                      | wygrywa pierwsza (`.find`)                                               |
| `readProjectIndex`: nagłówek `## po co i dlaczego` (inna wielkość liter)                   | `purpose === null` (porównanie dosłowne, jak „Gdzie skończyłem”)         |
| `readProjectIndex`: treść sekcji z linią `## coś` w środku                                 | tekst obcięty przed tą linią (znane ograniczenie, udokumentowane w §3.3) |
| `toSummaryDto`                                                                             | `"purpose" in dto === false`                                             |
| `ProjectsView` (`tests/unit/features/projects/ProjectsView.test.tsx`) z `purpose: "Tekst"` | widoczna karta z tytułem i tekstem, przed „Save State” w kolejności DOM  |
| `ProjectsView` z `purpose: "linia1\nlinia2"`                                               | tekst zawiera oba wiersze, element ma klasę `prj-purpose__text`          |
| `ProjectsView` z `purpose: '<img src=x onerror=alert(1)>'`                                 | wyświetlony jako tekst (`textContent`), bez elementu `img`               |
| `ProjectsView` z `purpose: null`                                                           | brak karty „Po co i dlaczego”                                            |
| `ProjectsView.en` (`ProjectsView.en.test.tsx`, `setLanguage`)                              | tytuł „Why this exists”                                                  |

## 5. Ryzyka

- Nowe wymagane pole psuje istniejące testy: `whereIStopped` występuje w 21 plikach w `tests/` (fixtury `Project`/`ProjectDetailDto`), a `mockReadProjectIndex.mockReturnValue` w `services.test`, `services.archive.test`, `services.complete-now.test` i `services.context-pack.test` oraz asercje `toEqual` w `repositories.test` wymagają `purpose: null`. Dopisać `purpose: null`, nie osłabiać typów.
- Nagłówek sekcji jest porównywany dosłownie (jak „Gdzie skończyłem”); literówka w `index.md` = brak karty. Opis formatu w dokumentach to zabezpiecza.
