# Archiwizacja ukończonych zadań projektu i kolejność „otwarte przed ukończonymi” — projekt

Data: 2026-11-14
Status: po review (agy, cursor); do planu implementacji
Powiązane: `2026-11-12-struktura-kontekstow-design.md` (siatka plików, reguły), etap 1-3 tablicy zadań (`contexts/bc_projects/repositories/tasks-file.ts`), `2026-11-11-asystent-lokalny-nexus-design.md` (paczka kontekstu)

## 1. Cel

Odhaczone zadania w `Projects/<id>/tasks.md` tylko się kumulują: w `monolith/tasks.md` 45 z 78 linii jest ukończonych, a odhaczenie zostawia linię w miejscu, więc ukończone przeplatają się z otwartymi. Spec rozwiązuje to trzema rzeczami:

1. **Kolejność:** w każdej sekcji otwarte zadania leżą przed ukończonymi.
2. **Archiwizacja:** akcja „Archiwizuj ukończone” przenosi ukończone zadania starsze niż N dni (N wybiera użytkownik: 3, 5 albo 7) do `Projects/<id>/changelog.md`.
3. **Filtr widoku:** przełącznik „Wszystkie / Otwarte / Ukończone” nad tablicą zadań projektu (tylko UI, bez zmian w plikach).

**Wymóg nadrzędny:** archiwum nie może rozbudowywać kontekstu agenta. `changelog.md` nie jest czytany przez żaden istniejący czytnik kontekstu agenta (parser tablicy, paczka kontekstu, `readProjectContent`); panel Notatki go wyklucza, a Mapa skanuje go jak pozostałe pliki projektu (§4.4).

## 2. Zakres

**W zakresie:** zadania projektów w `tasks.md` (`bc_projects`): zmiana kolejności przy `toggle`/`add`/`move`, nowa akcja archiwizacji (trasa, serwis, repozytorium, UI), nowy plik `changelog.md` (wraz z jednym wpisem w `PROJECT_EXCLUDED_FILES` w `bc_nexus_docs`); filtr otwartych/ukończonych w widoku tablicy (`ProjectTasksBoard`).

**Poza zakresem (osobne specy lub decyzje):**

- zadania ogólne (`bc_tasks`, `Tasks/tasks.md`): etap 2, po zmergowaniu tego wzorca (inny format linii, kafelek „zrobione w tygodniu” czyta `updated`, więc próg i plik wymagają osobnej decyzji);
- automatyczna archiwizacja przy „Zamknij dzień”;
- masowe porządkowanie istniejących, już wymieszanych plików (reguła kolejności działa tylko na dotykany blok);
- zapisywanie kolumny źródłowej w changelogu;
- skill `nexus-session` (`NEXUS/.claude/skills/nexus-session/SKILL.md:45`: „Przenieś zrobione do `## Backlog` lub usuń”) powinien po wdrożeniu wskazywać changelog; to zmiana w repozytorium NEXUS, robiona osobno.

## 3. Kolejność: otwarte przed ukończonymi

Reguła dotyczy każdej sekcji znanej parserowi (`Blokery`, `Next`, `Backlog`). Przenoszony albo dodawany jest zawsze cały blok (linia zadania z wciętymi liniami pod nią); reszta pliku zostaje bajt w bajt.

| Operacja                                | Gdzie ląduje blok                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `toggle` otwartego (odhaczenie)         | tuż za ostatnim otwartym zadaniem sekcji (góra „ogona” ukończonych: ostatnio zrobione pierwsze) |
| `toggle` ukończonego (odznaczenie)      | tuż za ostatnim otwartym zadaniem sekcji                                                        |
| `add`                                   | za ostatnim otwartym, przed ukończonymi (dziś: na końcu sekcji)                                 |
| `move` między sekcjami                  | otwarte: za ostatnim otwartym celu; ukończone: na górę ogona ukończonych celu                   |
| `move` `next` ↔ `now`, `edit`, `remove` | bez zmiany pozycji                                                                              |

Sekcja bez otwartych zadań: blok trafia przed pierwsze zadanie sekcji (gdy są w niej tylko ukończone), a gdy sekcja nie ma żadnych zadań, na jej początek pod nagłówek i ewentualną prozę (placeholder `Brak…` znika jak dziś). W sekcji wymieszanej (ukończone między otwartymi) „za ostatnim otwartym” i „góra ogona ukończonych” to ten sam punkt: ogon to zadania po ostatnim otwartym. „Ukończ” z Kokpitu przechodzi przez `toggle`, więc zachowuje się tak samo.

Implementacja w `repositories/tasks-file.ts`: nowe wyliczenie punktu wstawienia „za ostatnim otwartym zadaniem sekcji” obok istniejącego `insertBlock`; `toggle` zmienia się z edycji w miejscu na usunięcie bloku i wstawienie w punkcie z tabeli, przy czym **punkt wstawienia liczy się po wycięciu przenoszonego bloku** (inaczej przesunąłby się o jego długość). Indeksy zadań w kolumnach są liczone po każdej operacji od nowa (odpowiedź zwraca świeży stan projektu), więc API i indeksy w żądaniach nie wymagają zmian; UI zmienia się tylko o §6 i §6.1.

## 4. Archiwizacja do `changelog.md`

### 4.1 Wybór zadań

**Data ukończenia do archiwizacji** to `doneDate` z parsera, a gdy go brak, pierwsze wystąpienie `— RRRR-MM-DD` w tekście linii, po którym jest koniec linii albo jeden ze znaków ` ` `;` `:` `,` `.` `)` (w `monolith/tasks.md` 15 z 45 ukończonych zadań ma dopisek po dacie, np. `— 2026-11-13; sprawdzone…`, więc parser, który wymaga daty na końcu linii, uznaje je za bezdatne; parser i format linii zostają bez zmian). Funkcja `archiveDateOf({ text, doneDate })` jest czysta i leży w `schemas.ts`, żeby UI liczyło `N` i `K` tą samą regułą co serwer (§5, §6).

Ukończone (`- [x]`) zadania ze wszystkich sekcji, których data ukończenia jest **starsza niż N dni kalendarzowych** od dnia serwera (`localDate(now)`). Wiek = liczba dni między datą ukończenia a dniem serwera, liczona wyłącznie z dat kalendarzowych `RRRR-MM-DD` (np. przez `Date.UTC(r, m - 1, d)` obu dat i dzielenie różnicy przez 86 400 000 ms), **nie** przez odejmowanie lokalnych `Date`, bo zmiana czasu (DST) przesunęłaby wynik o dzień; archiwizowane, gdy wiek > N. Przykład (N = 3, dziś 2026-11-14): `2026-11-10` jest archiwizowane, `2026-11-11` zostaje. Zadania ukończone **bez żadnej daty** (`archiveDateOf` zwraca `null`) są archiwizowane zawsze (nie da się ich zakwalifikować inaczej); potwierdzenie w UI podaje ich liczbę osobno (§6). Otwarte zadania nigdy.

`N` (w całym specu: próg w dniach; liczbę zadań do przeniesienia oznaczamy `M`, a zadań bez daty `K`) to liczba całkowita 1–30, wybierana przez użytkownika; UI oferuje 3, 5 i 7 (domyślnie 7). Walidacja zakresu jest w zod po stronie serwera, więc agent też może wywołać akcję z innym progiem.

### 4.2 Format pliku

`Projects/<id>/changelog.md`, tworzony przy pierwszej archiwizacji:

```
# Changelog — <nazwa projektu>

## 2026-11

- [x] Karta Mapa (Alt+8) … — 2026-11-14
- [x] Planer slotów … — 2026-11-13

## 2026-10

- [x] Etap 0c-4 … — 2026-10-29

## Bez daty

- [x] Stare zadanie bez daty
```

Sekcje miesięcy `## RRRR-MM` (miesiąc z `archiveDateOf`), **najnowszy miesiąc na górze**, w środku linie malejąco po dacie ukończenia (wcięte linie bloku zostają; przy równej dacie nowo dopisane leżą za już istniejącymi). `## Bez daty` zawsze na samym dole.

**Bez deduplikacji:** każdy zarchiwizowany blok jest dopisywany, także gdy w changelogu leży identyczna linia. Dwa różne zadania o tym samym tekście i dacie (albo ten sam tekst bez daty w dwóch osobnych archiwizacjach) są różnymi zadaniami; zwykła deduplikacja, a nawet deduplikacja z licznością, gubiłaby je (usunięcie z `tasks.md` bez zapisu). Ceną są możliwe duplikaty po awarii (§4.3).

**Uszkodzony `changelog.md`:** plik jest niepoprawny, gdy zawiera nagłówek `## ` inny niż `RRRR-MM` i `Bez daty` albo powtórzony nagłówek. Proza i linie spoza nagłówków `##` zostają bajt w bajt. Błąd to `DomainError` 422 z nazwą pliku (`changelog.md ma nieznany nagłówek „…”`), nic nie jest zapisywane.

### 4.3 Zapis (kroki 0–2)

0. Przed zapisem (asynchronicznie, `archiveDoneTasks` jest `async` jak `updateVaultFile`): odczyt `tasks.md` i porównanie wersji z `expected`; niezgodność to `ConflictError` (409) jeszcze **przed** dotknięciem `changelog.md`. Brak `tasks.md` (`version: null`) → `archived: 0` bez zapisu.
1. Dopisanie do `changelog.md` (`updateVaultFile`, zmiana lokalna, ponawiana po konflikcie).
2. Usunięcie tych samych bloków z `tasks.md` z kontrolą wersji (`expected`): niezgodność (zmiana pliku między krokami) to `ConflictError` (409).

Awaria po kroku 1 zostawia duplikaty w changelogu (nigdy utratę zadań); ponowne uruchomienie dopisze je jeszcze raz (§4.2: bez deduplikacji), więc nadmiarowe linie usuwa się ręcznie. Blokada zapisu dla projektów `owner: work` jak przy pozostałych zapisach (`assertWritable`).

### 4.4 Izolacja od kontekstu agenta

Paczka kontekstu (`services/context-pack.ts`) bierze z tablicy wyłącznie otwarte zadania z `Blokery` i `Teraz`, więc ukończone i tak w niej nie ma. `changelog.md` nie jest otwierany przez `readProjectContent`, `readProjectBoard`, `readDevlog` ani paczkę. Wymóg jest pilnowany testem (§7).

Dwa inne czytniki skanują cały `Projects/<id>/` i bez zmiany pokazałyby changelog:

- **Notatki** (`bc_nexus_docs`): `changelog.md` trafia do `PROJECT_EXCLUDED_FILES` (`bc_nexus_docs/models.ts`), jak `tasks.md` i `devlog.md`; test w `bc_nexus_docs`.
- **Mapa** (`bc_map/repositories.ts`): skanuje wszystkie pliki `.md` projektu, także `tasks.md` i `devlog.md`, więc changelog byłby kolejną notatką-węzłem. Zmian nie robimy (spójnie z tymi plikami; to nie jest kontekst agenta); wpisujemy do decyzji odłożonych razem z Mapą.

## 5. Struktura kodu (`contexts/bc_projects/`)

| Plik                         | Zmiana                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemas.ts`                 | `ArchiveDoneInputSchema` (`version` jako `nullableVersion`, `olderThanDays` 1–30), czyste `archiveDateOf({ text, doneDate })` i `isArchivable(task, today, olderThanDays)` (wspólne dla serwera i UI, §4.1), DTO odpowiedzi: `ProjectDetailDto` + pole `archived: number` |
| `models.ts`                  | typ wyniku archiwizacji (liczba i lista zarchiwizowanych bloków; lista tylko wewnątrz kontekstu, DTO ma samo `archived`)                                                                                                                                                  |
| `repositories/tasks-file.ts` | reguła kolejności w `toggle`/`add`/`move` (§3); `extractArchivable(text, today, olderThanDays)` woła `isArchivable` ze `schemas.ts`                                                                                                                                       |
| `repositories/markdown.ts`   | `mergeChangelog(text \| null, blocks, projectName)` (gramatyka i błąd: §4.2)                                                                                                                                                                                              |
| `repositories/index.ts`      | `async archiveDoneTasks(entry, expected, ctx)`: kroki z §4.3                                                                                                                                                                                                              |
| `services/index.ts`          | `archiveDone(id, version, olderThanDays, now)`                                                                                                                                                                                                                            |
| `router.ts`                  | `postTasksArchive`; `app/api/projects/[id]/tasks/archive/route.ts` tylko re-eksportuje (reguła 4)                                                                                                                                                                         |
| `bc_nexus_docs/models.ts`    | `changelog.md` w `PROJECT_EXCLUDED_FILES` (§4.4)                                                                                                                                                                                                                          |

Trasa: `POST /api/projects/[id]/tasks/archive`, ciało `{ "version": …, "olderThanDays": 7 }`, odpowiedź: to samo co `postTasks` (`toDetailDto(project)`) z dodatkowym polem `archived`. Dzięki temu `mutateProject` w `useProjects.ts` (parsuje całe body jako `ProjectDetailDto`) działa bez przebudowy, a nadmiarowe pole nie szkodzi. Każdy `POST` z `curl` wymaga nagłówka `X-Nexus-Client: 1` (strażnik `lib/http/localGuard.ts`).

Test architektury (`tests/unit/architecture.static.test.ts`): bez zmian; gdyby wymagał zmiany, idzie osobnym commitem, nie razem z kodem.

## 6. UI (`src/features/projects/`)

- Nad kolumnami: „Archiwizuj ukończone (M)” z polem wyboru „starsze niż: 3 / 5 / 7 dni” (domyślnie 7). `M` przelicza się po zmianie progu `N`, tą samą funkcją co serwer (`isArchivable` ze `schemas.ts`, UI nie importuje `repositories`; data lokalna przeglądarki i serwera pochodzi z tej samej maszyny).
- Przy `M = 0` przycisk jest ukryty.
- Klik otwiera potwierdzenie w miejscu („Przenieść M zadań do changelog.md?” + Tak/Anuluj), jak `confirmRemove`. Gdy wśród nich są zadania bez daty: „Przenieść M zadań do changelog.md (w tym K bez daty)?”; `K` to ukończone, dla których `archiveDateOf` daje `null`, a które archiwizacja zawsze obejmuje (§4.1).
- `ProjectTasksBoard` dostaje prop `onArchive(version, olderThanDays)`. Zmiany w plikach: `ProjectTasksBoard.tsx`, `ProjectDossier.tsx` (przekazanie propa), `ProjectsView.tsx` (podpięcie akcji), `mutation.ts` (`ProjectActions.archiveDone`), `useProjects.ts` (wywołanie trasy). Wynik to `MutationResult` rozszerzony o opcjonalne `archived?: number` (ustawiane z pola `archived` odpowiedzi): `busy`, błąd i konflikt (`CONFLICT_MESSAGE` + `onReload`) działają jak dla `run` (wspólny stan `busy`/`error`, jedna mutacja naraz). Po sukcesie komunikat „Przeniesiono M zadań do changelog.md” (`M` z pola `archived` odpowiedzi).
- UI importuje z kontekstu tylko `schemas` (zod wejścia i DTO).

### 6.1 Filtr: otwarte / ukończone

- Nad kolumnami przełącznik „Wszystkie / Otwarte / Ukończone” (domyślnie „Wszystkie”). Stan lokalny komponentu: nie trafia do vaulta ani do URL i wraca do „Wszystkie” po zmianie projektu. Zmiana filtra zamyka otwartą edycję i potwierdzenie usunięcia (`editing`, `confirming` są trzymane po pozycji).
- Filtr tylko ukrywa wiersze. **Indeksy zadań zostają oryginalne** (z pełnej kolumny `board[key]`): `toggle`, `edit`, `remove` i przeciąganie nadal wskazują właściwy blok, a nie pozycję na przefiltrowanej liście.
- Liczniki: nagłówek kolumny pokazuje liczbę widocznych zadań. `Teraz` zachowuje `n/NOW_LIMIT` liczone z pełnych danych (limit dotyczy otwartych), a `M` przycisku archiwizacji i `nowFull` też liczą się z pełnej tablicy, nie z widoku.
- „Ukończone”: kolumna `Teraz` jest zawsze pusta (ukończone nie trafiają do `Teraz`); formularze „Dodaj zadanie” są ukryte, bo nowe zadanie jest otwarte i od razu znikałoby z widoku.
- Pusta kolumna w widoku filtrowanym: „Brak otwartych” / „Brak ukończonych” (zamiast „Brak”, które sugeruje pustą kolumnę w pliku).
- Odhaczenie zadania przy filtrze „Otwarte” (albo odznaczenie przy „Ukończone”) usuwa je z widoku, bo zmienia grupę; to oczekiwane, nie błąd.
- Zakres: tablica zadań (`ProjectTasksBoard`). Lista projektów (`ProjectList`) i błędy (sekcja `Zamknięte`) bez zmian.

## 7. Błędy i testy

**Błędy:** 409 przy niezgodnej wersji (sprawdzanej przed zapisem do changelogu, §4.3) albo zmianie `tasks.md` między krokami; 400 przy `olderThanDays` poza 1–30 (generyczne „Validation failed” zod); brak `tasks.md` (`version: null`) albo zero kwalifikujących się zadań → `archived: 0` bez zapisu; uszkodzony `changelog.md` → `DomainError` 422 z nazwą pliku (gramatyka w §4.2), nic nie jest zmieniane (pliku, który się nie parsuje, nie nadpisujemy).

**Testy (Vitest, TDD, czerwone przed kodem)**, pliki w `tests/unit/contexts/bc_projects/` i `tests/unit/features/projects/`:

- _Kolejność_ (`tasks-file.test.ts`): odhaczenie zadania w środku `Next` ląduje za ostatnim otwartym i przed starszymi ukończonymi; odznaczenie wraca za ostatnie otwarte; `add` ląduje przed ukończonymi; `move` do sekcji z ogonem ukończonych (otwarte przed, ukończone na górę ogona); odhaczenie zadania `[now::]` w `## Next` (znika z `now`, ląduje za ostatnim otwartym); blok z wciętymi liniami przenosi się w całości; sekcja wymieszana (ukończone między otwartymi): punkt wstawienia liczony po wycięciu bloku; sekcja z samymi ukończonymi: blok przed pierwszym z nich; sekcja bez zadań: blok pod nagłówkiem; `move` `next` ↔ `now` bez zmiany pozycji (regresja); reszta pliku bajt w bajt.
- _Wybór_ (`tasks-file.test.ts`): przy dziś 2026-11-14 i N = 3: `2026-11-10` zarchiwizowane, `2026-11-11` zostaje; N = 7: `2026-11-06` zarchiwizowane, `2026-11-07` zostaje; przejście zmiany czasu (np. dziś `2026-03-30`, N = 1: `2026-03-28` zarchiwizowane, `2026-03-29` zostaje); linia bez daty zarchiwizowana; linia z dopiskiem po dacie (`— 2026-11-13; sprawdzone…`, `— 2026-11-14: …`, `— 2026-11-13 (…)`) dostaje datę z dopiska i podlega progowi, a nie trafia do „bez daty”; `archiveDateOf` bierze pierwsze `— RRRR-MM-DD`; otwarte nigdy; ukończone ze wszystkich sekcji. Test na kopii prawdziwego `monolith/tasks.md`: żadne z 15 zadań z dopiskiem nie liczy się jako „bez daty”.
- _Format_ (`repositories.markdown.test.ts`): nowy plik; dopisanie do istniejącego miesiąca; nowy miesiąc na górze; `## Bez daty` na dole; sortowanie malejąco po dacie w miesiącu; **bez deduplikacji**: dwie identyczne linie (ten sam tekst i data) w jednej archiwizacji trafiają obie, a identyczna linia już obecna w changelogu jest dopisywana ponownie (żadne zadanie nie ginie); uszkodzony plik (nieznany albo powtórzony nagłówek `##`) daje `DomainError` 422, proza poza nagłówkami zostaje bajt w bajt.
- _Kontekst i czytniki_ (`services.context-pack.test.ts`, test `bc_nexus_docs`): paczka dla projektu z `changelog.md` identyczna jak bez niego; `changelog.md` nie wchodzi do listy Notatek (`isVisiblePath`).
- _Serwis i router_ (`services.test.ts`, `router.test.ts`): 409 przy złej wersji **bez zapisu do `changelog.md`** (krok 0), 409 przy zmianie `tasks.md` między krokami (changelog już zapisany, `tasks.md` nietknięty), 400 przy `olderThanDays` 0 i 31, `archived: 0` przy pustym wyniku i przy braku `tasks.md` (`version: null`), uszkodzony `changelog.md` w pełnej ścieżce (żaden plik nie zmieniony), blokada `owner: work`, kolejność zapisów (changelog przed `tasks.md`), odpowiedź = `ProjectDetailDto` + `archived`.
- _UI_ (`ProjectTasksBoard.test.tsx`): przycisk ukryty przy `M = 0`; `M` zmienia się z progiem `N`; potwierdzenie podaje „w tym K bez daty” tylko gdy `K > 0`; potwierdzenie → `onArchive` z wersją i progiem; sukces pokazuje „Przeniesiono M zadań do changelog.md” (z `archived` z wyniku); konflikt wywołuje `onReload`; `makeApi` w teście i `useProjects` dostają obsługę `/tasks/archive` przed testami tej akcji.
- _Filtr_ (`ProjectTasksBoard.test.tsx`): „Otwarte” ukrywa ukończone, „Ukończone” ukrywa otwarte, „Wszystkie” pokazuje oba; `toggle`, `edit`, `remove` i `move` (przeciągnięcie) pod filtrem „Otwarte” wysyłają **oryginalny** indeks (zadanie za ukończonym albo za ukrytym); zmiana filtra zamyka otwartą edycję i potwierdzenie usunięcia; `M` archiwizacji i `n/NOW_LIMIT` nie zmieniają się po przełączeniu filtra; „Ukończone” ukrywa formularze dodawania; komunikat „Brak otwartych/ukończonych”.

## 8. Kolejność commitów i weryfikacja

Jeden PR: (1) kolejność w `tasks-file.ts` z testami; (2) `archiveDateOf`/`isArchivable` (`schemas.ts`), `extractArchivable` i `mergeChangelog` z testami; (3) repozytorium, serwis, trasa, `PROJECT_EXCLUDED_FILES` w `bc_nexus_docs`; (4) UI: najpierw filtr (6.1, niezależny od API), potem przycisk archiwizacji. Po każdym `npx tsc --noEmit` i `npx vitest run`; na końcu `npm run lint` i `npm run build` przez `cursor`. Ręcznie w przeglądarce: karta Projekty → tablica `monolith` (próg 3 dni, potwierdzenie, odświeżenie, `changelog.md` w vaulcie).

## 9. Ryzyka

- **Dwa pliki, brak transakcji:** zgodnie z §4.3 awaria po kroku 1 zostawia duplikaty w changelogu, nie utratę zadań; duplikaty usuwa się ręcznie (świadomie nie deduplikujemy, §4.2).
- **Data w środku linii:** reguła `archiveDateOf` (§4.1) zgaduje datę ukończenia z pierwszego `— RRRR-MM-DD`; linia z inną datą wcześniej w tekście dostanie złą. Akceptowane (zgodne z konwencją zapisu w vaulcie), a pierwsza archiwizacja na `monolith` jest sprawdzana ręcznie (§8).
- **Wymieszane stare pliki:** reguła kolejności nie naprawia ich naraz; archiwizacja i dotykanie zadań robią to stopniowo (świadomie, §2).
- **Zmiana zachowania `toggle`:** odhaczenie przesuwa linię w pliku (do tej pory zostawała); testy kolejności to pokrywają, a `completeNowTask` z Kokpitu (`services/index.ts:209`) idzie tą samą ścieżką.
