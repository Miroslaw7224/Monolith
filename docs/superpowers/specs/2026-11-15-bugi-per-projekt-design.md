# Bugi per projekt (karta Projekty): design

Data: 2026-11-15. Karta: Projekty (Alt+4), kontekst `bc_projects`. Przekazane z Arsenału (spec `2026-11-14-karta-arsenal-design.md`, A8 i sekcja 8).

## 1. Cel i zasady

Pokazać w teczce projektu pełne wpisy z `Vault/Projects/<projekt>/bugs.md` i dopilnować, żeby dane nie gniły, **bez ręcznej pracy użytkownika**.

1. Źródłem prawdy zostaje `bugs.md` projektu. Aplikacja go **nie zapisuje** (tylko odczyt).
2. Bugi dodaje i zamyka **agent** według jednego przepisu (sekcja 7). Użytkownik nie przepisuje niczego ręcznie.
3. Widok ma dawać zwrot od razu: pełne pola buga trafiają do paczki kontekstu w roli debug.
4. Niezgodności (stary bug, bug i zadanie rozjechane) są sygnalizowane w UI, nie naprawiane automatycznie.

## 2. Decyzje

| #   | Temat             | Decyzja                                                                                                                                                          |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Zapis z aplikacji | Brak. Ani „Zamknij”, ani „Do zadań”, ani dodawanie/edycja. Odpada też przycisk bug → zadanie: robi to agent przy dodaniu buga                                    |
| B2  | Źródło prawdy     | `Projects/<p>/bugs.md` (nie Icebox, nie wspólna baza). Zbiorczy „Radar bugów” to kiedyś drugi widok tych samych plików, nie drugie źródło                        |
| B3  | Wiek buga         | Nowe opcjonalne pole `Otwarto: RRRR-MM-DD`. Bug bez daty nie ma wieku ani znaczka „stary” (bez zgadywania z mtime). Próg: `BUG_STALE_AFTER_DAYS = 14`            |
| B4  | Bug ↔ zadanie     | Zadanie projektu powiązane z bugiem to zadanie, w którego treści występuje ID buga jako osobny token (np. `(patrz GP-001)`). Agent dopisuje je przy dodaniu buga |
| B5  | `dashboard.md`    | Bez zmian po stronie aplikacji. Agent dalej synchronizuje tabelę Bugi (proces NEXUS). Podatne na zgnicie, ale poza zakresem                                      |

## 3. Format wpisu w `bugs.md`

Zgodny wstecz; wszystko poza nagłówkiem opcjonalne.

```
## Aktywne

### GP-001 — tytuł
- **Priorytet:** medium
- **Plik:** `start_v2.bat`
- **Otwarto:** 2026-11-10
- **Opis:** …
- **Naprawa:** …
- **Status:** otwarty

## Zamknięte

### EA-001 — tytuł
- **Priorytet:** high
- **Opis:** …
- **Rozwiązanie (2026-05-19):** …
- **Status:** zamknięty
```

Reguły parsera:

- Bugiem jest `### <ID> — <tytuł>` (myślnik zwykły, półpauza lub pauza) pod `## Aktywne`, pod `## Zamknięte` **albo przed pierwszym nagłówkiem `##`** (sekcja `""`, zgodnie z dotychczasowym testem). Nagłówki `###` pod innymi sekcjami (np. „Ostrzeżenia z builda”) są ignorowane (wzmocnienie; dziś w danych takich nie ma).
- Pole to linia `- **Etykieta:** wartość`. Linie ciągu dalszego (wcięte, bez etykiety) są doklejane do poprzedniego pola.
- Etykiety: `Priorytet`, `Plik`, `Otwarto`, `Opis`, `Naprawa`, `Rozwiązanie` (z opcjonalną datą w nawiasie = data zamknięcia), `Status`. Nieznane etykiety ignorowane.
- Data w złym formacie (inny niż `RRRR-MM-DD`) jest ignorowana bez błędu; pole dostaje `undefined`.

## 4. Model, DTO, serwis (`bc_projects`)

- `models.ts`: `BugEntry` zachowuje `id`, `title`, `section`, `priority?`, `status?` i dostaje `file?`, `opened?` (ISO), `description?`, `fix?`, `resolution?`, `closedOn?` (ISO).
- `repositories/markdown.ts`: `parseBugs` według sekcji 3.
- `services/index.ts`, przy składaniu szczegółów projektu, dopisuje pola pochodne: `ageDays?` (dni od `opened`, tylko aktywne z datą), `stale` (`ageDays > BUG_STALE_AFTER_DAYS`) i `task` (powiązanie z tablicą zadań projektu, patrz niżej). Stała `BUG_STALE_AFTER_DAYS = 14` obok `STALE_AFTER_DAYS`.
- `schemas.ts`: `BugEntryDto` przestaje być aliasem modelu; zawiera pola jawnie, mapper model → DTO tu.
- Powiązanie z zadaniem: wśród zadań `project.board` (wszystkie kolumny) szukamy tekstu zawierającego ID buga jako osobny token (`(?<![A-Za-z0-9-])ID(?![A-Za-z0-9-])`). `task` = `null` (brak), `{ column, done: false }` (jest niezakończone; przy kilku wybierz niezakończone) albo `{ column, done: true }` (są tylko zakończone).
- Konsumenci aktywnych bugów (`bc_cockpit/services.ts:78`, `projectTiles.ts:72`, `ProjectDossier.tsx`, `context-pack.ts`) filtrują `section !== "Zamknięte"`. Po wzmocnieniu parsera ten filtr jest poprawny bez zmian.

## 5. UI (`src/features/projects/ProjectBugs.tsx`)

Sekcja „Bugi” wychodzi z `ProjectDossier.tsx` do nowego komponentu (UI importuje z kontekstu tylko `schemas`).

- Wiersz aktywnego buga: ID, tytuł, priorytet, status, znaczek wieku „otwarty N d” (wyróżniony przy `stale`; bez znaczka, gdy brak `Otwarto`). Kliknięcie rozwija Plik, Opis, Naprawę.
- Znacznik powiązania: „w zadaniach: <kolumna>” gdy `task` niezakończone; **„zadanie zrobione, bug nadal otwarty”** gdy `task.done`; brak znacznika, gdy `task === null`.
- Zamknięte pod przełącznikiem „Zamknięte (N)”: tytuł, rozwiązanie, data zamknięcia; **„bug zamknięty, zadanie nadal otwarte”** gdy `task` niezakończone.
- Brak wpisów: „Brak bugów”.
- Makieta `04-projekty.html` zostaje bez zmian (klasy `prj-bugs` już istnieją); nowe elementy używają istniejących klas `prj-badge`.

## 6. Paczka kontekstu

- Rola `debug`: sekcja „Bugi (otwarte)” zawiera pełne pola (Plik, Opis, Naprawa, wiek) oraz na końcu instrukcję: „po naprawie zamknij bug w bugs.md według przepisu w docs/nexus-vault-formaty-yaml.md (Bugi)”.
- Pozostałe role: bez zmian (jedna linia na bug).
- Ryzyko: sekcje Zadania i Bugi nie są skracane przez budżet tokenów; długie opisy zwiększą paczkę. Przy kilku wpisach nieistotne.

## 7. Instrukcje dla agenta (cel: zero pracy ręcznej)

**a) `docs/nexus-vault-formaty-yaml.md`** (Monolith): nowa sekcja „Bugi: `Projects/<p>/bugs.md`” z formatem z sekcji 3 i kompletnym przepisem:

- **Dodaj bug:** wpis pod `## Aktywne` z kolejnym ID projektu (prefiks z `NEXUS/CLAUDE.md` „Format ID bugów”), `Otwarto: <dziś>`, `Status: otwarty`; wiersz w tabeli Bugi w `dashboard.md`; zadanie w `tasks.md` projektu z ID w treści.
- **Zadanie dla buga:** pod `## Next`; dla `Priorytet: high` z końcowym ` [now::]`, o ile w Teraz jest mniej niż 3 zadania (`NOW_LIMIT`). Format linii: `- [ ] **Tytuł** — opis (patrz <ID>)`.
- **Zamknij bug:** przenieś wpis pod `## Zamknięte`, ustaw `Status: zamknięty`, dodaj `- **Rozwiązanie (RRRR-MM-DD):** …`, usuń lub przekreśl wiersz w `dashboard.md`, odhacz zadanie z ID (`- [x] … — RRRR-MM-DD`).
- **Wpis z Inboxu typu `bug`:** jak „Dodaj bug”, `Otwarto` = data wpisu w Inboxie.

**b) `NEXUS/CLAUDE.md`** (repo NEXUS, **osobny commit**): reguły „Dodaj buga do X” i „Zamknij buga X w projekcie Y” (linie ok. 140–141) odsyłają do przepisu z (a) i dopisują `Otwarto`, zadanie i odhaczenie. `docs/_template/bugs.md` dostaje wzorcowy wpis z `Otwarto`.

**c) Nowy skill `bug-projektu`** (`.claude/skills/bug-projektu/SKILL.md`): przepis „Dodaj bug” i „Zamknij bug” z (a) w formie skilla, w tym tryb „wpis z Inboxu”. Skill sam zapisuje tylko `Projects/<p>/bugs.md` i `dashboard.md`; zadanie `[ID]` tworzy i zamyka wpis Inboxu istniejące `POST /api/inbox/<id>/move` (`target: project`, `column: next`, tekst z `(patrz <ID>)`), więc `tasks.md` nadal zapisuje wyłącznie aplikacja. `segreguj-inbox` **nie dostaje wyjątku** od reguły „nie edytujesz vaulta ręcznie”: przy wpisie `bug` ma tylko odnośnik do skilla `bug-projektu` (decyzja użytkownika 2026-11-15: osobny skill, żeby nie mieszać reguł).

## 8. Testy (Vitest, `tests/unit/...`)

`parseBugs`: wpis pełny; wpis z samym nagłówkiem; pole wieloliniowe; `Rozwiązanie (2026-05-19)` daje `closedOn`; zła data `Otwarto` → `undefined`; `###` pod sekcją „Ostrzeżenia z builda” ignorowany; plik z sekcjami Aktywne i Zamknięte (np. kopia `english-agent/bugs.md` i `gen-podsum-ai/bugs.md`).

Serwis: `ageDays` i `stale` na granicy 14/15 dni (stały „dziś”); brak `Otwarto` → bez wieku; powiązanie: brak zadania, zadanie niezakończone, tylko zakończone, ID jako część innego tokenu (`GP-0011` nie pasuje do `GP-001`), kilka zadań (wybór niezakończonego).

Paczka: rola debug zawiera Plik/Opis/Naprawę i instrukcję zamknięcia; rola review/implementation zostaje jednoliniowa.

UI (testy komponentu): rozwijanie wpisu, znaczek „stary”, trzy znaczniki spójności, przełącznik zamkniętych.

Test architektury (`architecture.static.test.ts`) bez zmian; przy pękaniu naprawia się kod.

## 9. Prywatność

Aplikacja niczego nie zapisuje (B1). Zawartość bugów projektów `owner: work` jest pokazywana tak jak inne pola teczki; ostrzeżenie o `Work/` z paczki kontekstu obowiązuje bez zmian.

## 10. Kolejność pracy

1. Parser, model, testy (sekcja 4).
2. Serwis: wiek i powiązanie z zadaniami.
3. DTO i `ProjectBugs.tsx`, makieta, CSS.
4. Paczka debug.
5. Instrukcje agenta: sekcja w `docs/nexus-vault-formaty-yaml.md` i skill `bug-projektu` i odnośnik w `segreguj-inbox` w Monolith; `NEXUS/CLAUDE.md` i szablon w repo NEXUS osobnym commitem.

## 11. Poza zakresem (przekazane dalej)

- Przycisk „Zamknij” i zapis `bugs.md` z aplikacji: wraca, jeśli po kilku tygodniach agent nie domyka wpisów.
- „Radar bugów” (wyszukiwanie wśród zamkniętych bugów wszystkich projektów): gdy uzbiera się kilkanaście zamkniętych wpisów (dziś tylko EA-001). Wymaga tylko drugiego widoku na tych samych plikach.
- Sprawdzenie formatu bugów w `NEXUS/tools/nexus_check.py` (np. poprawność `Otwarto`): osobny krok w NEXUS.
- Synchronizacja `dashboard.md` z `bugs.md`: proces NEXUS, bez zmian.
- Edge: zadanie powiązane z bugiem tylko ID w treści; bugi z innego prefiksu niż ID projektu nie są walidowane.
