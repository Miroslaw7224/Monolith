# Zadania: checklista testów, panel roboczy, zwijane kolumny

Data: 2026-11-16. Status: szkic do przeglądu. Rozwija tablicę zadań (`2026-11-13-etap-1-3-tablica-zadan-design.md`) i statusy (`2026-11-15-zadania-odlozone-design.md`).

## 1. Cel

Aplikacja ma pomagać w czasie i pracy, bez zbędnych bajerów (zasada projektu); rozwijamy ją pod realny ból.

Realny ból: użytkownik pracuje też jako tester manualny. Zadanie typu „Testy Manualne CG” (17.11, 8:30–11:30, werdykt GO/NO-GO o 12:00) ma ok. 15 punktów (T-01, T-02, T-04d, T-06 C i E z podpunktami, T-08, T-09, regresje R-01, R-03, R-05). Dziś opis zadania to jedno pole tekstowe w wąskim modalu: nie da się odhaczać punktów, dopisać uwag do punktu ani wysłać wyniku osobie sprawdzającej (wyniki zbiera inna osoba i wpisuje je do swojego planu). Takie zadania (testy, cudzy PR, review) zdarzają się regularnie.

Rozwiązanie w trzech częściach, jeden spec (decyzja użytkownika: „wszystko naraz”):

1. **Checklista w `desc`**: punkty ze statusem (do zrobienia / PASS / FAIL), komentarzem i podpunktami, plus „Kopiuj jako Markdown”.
2. **Panel roboczy** zamiast modala na komputerze: otwarte zadanie na szerokość 2 kolumn, kolumny Odłożone, W toku i Do sprawdzenia w jednej komórce.
3. **Zwijane kolumny i regulowana wysokość** list kart.

Burza mózgów z pomocnikami (`agy` na Hydrogenie, `cursor` na Composer 2.5): zgodni, że dane zostają w `desc` jako Markdown, bez zmian w `bc_tasks`; osobny plik `Tasks/<id>.md` odłożony. Opinie potraktowane jako hipotezy i zweryfikowane w kodzie.

## 2. Decyzje (brainstorming 2026-11-16)

| ID  | Temat           | Decyzja                                                                                                                                                                                                                                                  |
| --- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Zakres          | Jeden spec obejmuje checklistę, panel i zwijanie (użytkownik wybrał „wszystko naraz” zamiast dwóch etapów). Ryzyko terminu 8:30 łagodzi linia cięcia w §7.                                                                                               |
| D2  | Dane            | Checklista to Markdown w polu `desc` zadania. Bez zmian w `contexts/bc_tasks/` i `lib/nexus/task-line.ts`. Odrzucone: osobny plik `Tasks/<id>.md` (nowy format, osierocone pliki) i nowe pole inline (nieznane pola giną przy zapisie).                  |
| D3  | Status punktu   | Trzy stany: `[ ]` do zrobienia, `[x]` PASS, `[!]` FAIL (użytkownik wybrał; odrzucone: tylko odhaczone i cztery stany z „pominięty”).                                                                                                                     |
| D4  | Układ           | Od 1024 px panel po prawej, Zrobione zwinięte (wybór użytkownika). Poniżej 1024 px zostaje modal. Odrzucone: panel na środku i szeroki modal nakładany na tablicę.                                                                                       |
| D5  | Zapis           | Autozapis ok. 1,5 s po ostatniej zmianie (wybór użytkownika). Commit i push vaulta robi wyłącznie `nexus-sync.timer` co 5 min; aplikacja sama nie commituje (zweryfikowane: w `lib/` i `contexts/` nie ma commit/push poza odczytem gita w `workGuard`). |
| D6  | Zwijanie        | Kolumna zwija się w poziomie do paska ok. 3 rem z nazwą i liczbą; w stosie zwinięcie działa w pionie do samego nagłówka (wybór użytkownika).                                                                                                             |
| D7  | Wysokość        | Natywny uchwyt `resize: vertical` na liście kart, zakres 80–1200 px, przycisk ↺ przywraca automatyczną wysokość.                                                                                                                                         |
| D8  | Pamięć ustawień | `localStorage` (klucz `zad-board-layout-v1`), nie vault. Wzorzec jak `src/features/board/boardViewport.ts`.                                                                                                                                              |
| D9  | Prywatność      | Bez zmian: zapis tylko do `Vault/Tasks/tasks.md`, nie dotyka `Work/` ani `owner`.                                                                                                                                                                        |

## 3. Format checklisty w `desc`

```
Wstęp lub dowolny tekst, zostaje bez zmian.
- [ ] T-01: pobieranie PDF (iPhone i iPad)
- [x] T-02: CV między kontami w tej samej karcie
- [!] T-04d: nazwa firmy po angielsku
  > Kroki: ... Oczekiwany: ... Rzeczywisty: ...
- [ ] T-06 C i E
  - [ ] import CV 1 i „Zastosuj do formularza”
  - [x] okno o niezapisanych zmianach
    > Safari pokazuje okno tylko przy zamknięciu karty
```

- Punkt: linia `^(\s*)- \[( |x|!)\] (.*)$`. Poziom = liczba spacji wcięcia dzielona przez 2 (zaokrąglenie w dół; nieparzyste wcięcie nie jest błędem).
- Komentarz: linie `^(\s*)> ?(.*)$` bezpośrednio pod punktem; kilka kolejnych linii `>` to jeden komentarz (łączone `\n`). `>` bez punktu powyżej jest zwykłym tekstem.
- Wszystko inne to tekst i zostaje bez zmian. Zadanie bez punktów działa jak dotąd.
- Status rodzica nie jest wyliczany z dzieci; każdy punkt ma własny status i komentarz.
- Zmiana statusu zmienia wyłącznie znak w nawiasie; serializacja zachowuje resztę tekstu bajt w bajt (test round-trip).
- Zapis przez aplikację ucieczkuje `[`, `]`, `\`, nową linię (`\[`, `\]`, `\\`, `\n`; `docs/nexus-vault-formaty-yaml.md`); w surowym `tasks.md` opis jest więc długą, mało czytelną linią. Akceptowane; osobny plik zadania wraca dopiero, gdy to realnie przeszkadza.

**Eksport „Kopiuj jako Markdown”** (dla osoby sprawdzającej): tytuł zadania jako nagłówek, linia podsumowania „PASS 5 · FAIL 1 · pozostało 9”, potem punkty jako `✅ PASS` / `❌ FAIL` / `⬜ nie sprawdzono` z komentarzami pod punktami i zachowaniem wcięć; tekst poza punktami jako akapit wstępny. Bez znaczników vaulta. Pusty `desc` daje sam tytuł.

## 4. Zmiany w kodzie

Bez zmian: `contexts/bc_tasks/*`, `lib/nexus/*`, `app/api/**`, `tests/unit/architecture.static.test.ts`. Wszystko w `src/features/tasks/` i i18n; UI nie importuje z kontekstów nic poza `schemas`, jak dziś.

**Nowe pliki:**

- `taskChecklist.ts`: czyste funkcje `parseChecklist(desc)`, `serializeChecklist(model)`, `cycleStatus(status)`, `setItemStatus`, `setItemComment`, `summarize(model)`, `exportMarkdown(title, desc)`. Bez zależności od Reacta.
- `taskBoardLayout.ts`: `loadLayout()`, `saveLayout()` (try/catch, błędny JSON lub zablokowany magazyn dają ustawienia domyślne, wysokość przycinana do 80–1200, nieznane statusy pomijane), `boardColumns(tryb, zwinięte)` zwraca szablon siatki.
- `useTaskDraft.ts`: szkic pól tekstowych (tytuł, link, opis) z autozapisem (debounce 1,5 s, tylko przy zmianie względem ostatnio zapisanej wartości), stanem `idle | saving | saved | error`, `flush()` przy zmianie zadania i zamknięciu, wysyłaniem tylko zmienionych pól.
- `TaskWorkPanel.tsx`: panel zadania w siatce (od 1024 px).
- `TaskChecklist.tsx`: lista punktów (przycisk statusu, tekst, pole komentarza, wcięcia), przełącznik **Lista / Tekst** (Tekst to surowy Markdown, źródło prawdy), przycisk „Kopiuj jako Markdown”, licznik w nagłówku.

**Zmieniane pliki:**

- `TaskDetailModal.tsx`: wydzielona wspólna treść (pola + checklista) używana przez modal (poniżej 1024 px) i panel; bez przycisku „Zapisz”, z znacznikiem stanu zapisu i „Zamknij”.
- `useTasksBoard.ts`: `saveTaskDetail` zastąpiony zapisem częściowym `PUT /api/tasks/:id` (schemat `UpdateTaskBodySchema` ma wszystkie pola opcjonalne), błąd zapisu wraca do UI zamiast cichego `console.error`; status, termin i projekt zapisują się od razu jednopolowym `PUT`.
- `TasksSection.tsx`: gdy panel otwarty i szerokość ≥ 1024 px, układ `stos 1 | stos 2 | panel (2fr) | done`; stos 1 to `todo` nad `deferred`, stos 2 to `in_progress` nad `to_review` (zmiana z 2026-11-16 po uwagach użytkownika), każda kolumna nadal jest strefą upuszczenia swojego statusu i zwija się w pionie.
- `TaskColumn.tsx`: przycisk zwijania ◂/▸ w nagłówku, tryb zwinięty (pasek, upuszczanie nadal działa), przycisk ↺ wysokości, `ResizeObserver` zapisujący wysokość listy po 300 ms.
- `tasks.css`: siatka z szablonem z `boardColumns`, style panelu, stosu, zwiniętej kolumny i `resize: vertical`.
- `src/i18n/locales/pl/tasks.ts`, `en/tasks.ts`: teksty (statusy punktów, Lista/Tekst, kopiowanie, stany zapisu, zwijanie, ↺).

**Zachowanie:**

- Od 1024 px kliknięcie zadania otwiera panel; kliknięcie innej karty przełącza panel (najpierw `flush()`); zamknięcie przyciskiem X. Poniżej 1024 px modal z tą samą treścią.
- „Zrobione” w trybie roboczym jest domyślnie zwinięte, o ile użytkownik nie ma zapisanego własnego ustawienia.
- Poniżej 1024 px szerokość siatki się nie zmienia; zwinięcie chowa tylko karty i zostawia nagłówek.
- Istniejące „Pokaż więcej” (limit 15 kart w `taskOrderUtils.ts`) zostaje bez zmian i nie jest zwijaniem kolumny.
- Pusty tytuł nie jest zapisywany, pole pokazuje błąd. Niedostępny schowek: komunikat, bez cichej porażki. Limit długości `desc` po stronie `bc_tasks`, jeśli istnieje, sprawdzić w pierwszym czerwonym teście i pokazać w panelu.

## 5. Testy (Vitest, `tests/unit/features/tasks/`)

**`taskChecklist.test.ts`:**

- `- [ ] A` → jeden punkt, status `todo`, poziom 0; `- [x] A` → `pass`; `- [!] A` → `fail`.
- Wcięcie 2 spacji → poziom 1; wcięcie 3 spacji → poziom 1.
- `> uwaga` pod punktem → komentarz punktu; dwie linie `>` → `uwaga1\nuwaga2`; `>` bez punktu → zwykły tekst.
- Round-trip: `serializeChecklist(parseChecklist(x)) === x` dla opisu „Testy Manualne CG” i dla opisu bez punktów.
- `cycleStatus`: `todo → pass → fail → todo`; zmiana statusu zmienia tylko znak w nawiasie.
- `summarize` dla 5 PASS, 1 FAIL, 9 todo → „PASS 5 · FAIL 1 · pozostało 9”.
- `exportMarkdown`: `✅ PASS` / `❌ FAIL` / `⬜ nie sprawdzono`, komentarze pod punktami, pusty `desc` → sam tytuł.

**`useTaskDraft.test.ts`** (fake timers): kilka zmian w ciągu 1,4 s → jeden `PUT` po 1,5 s od ostatniej; brak zmiany treści → brak `PUT`; błąd serwera → stan `error` i ponowienie przy następnej zmianie; zmiana zadania → `flush()` przed przełączeniem; `PUT` zawiera tylko zmienione pola.

**`taskBoardLayout.test.ts`:** błędny JSON → domyślne; wysokość 5 → 80, 5000 → 1200; nieznany status pominięty; `boardColumns` dla (normalny, tryb roboczy) × (zwinięte lub nie) zwraca konkretne szablony (np. tryb roboczy, `done` zwinięte: `1fr 1fr 2fr 3rem`).

**Komponenty:** klik punktu przechodzi ` `→`x`→`!`→` `; komentarz zapisuje się pod właściwym punktem; przełączenie Lista ↔ Tekst nie traci zmian; zwinięta kolumna pokazuje nazwę i liczbę i nadal przyjmuje upuszczenie. Istniejący `TaskDetailModal.test.tsx` do aktualizacji (zniknięcie przycisku „Zapisz”, autozapis).

**e2e** (`tests/e2e/tasks.spec.ts`): otwórz zadanie z checklistą, odhacz punkt, zobacz „Zapisano”.

## 6. Ryzyka

- **Utrata notatek przy zamknięciu** (dziś modal zamyka się po kliknięciu w tło lub Esc bez zapisu): zamykane przez autozapis i `flush()`.
- **Nadpisanie statusu przez autozapis** przy jednoczesnym przeciąganiu: szkic obejmuje tylko pola tekstowe, status, termin i projekt idą jednopolowym `PUT`.
- **`description.trim()`** przy zapisie usuwa końcowe puste linie: bez wpływu na checklistę.
- **Ręczna edycja `tasks.md`**: nieucieczkowany `]` w polu rzuca `TaskLineError` i zadanie znika z aplikacji (`lib/nexus/task-line.ts`, `markdown-edit.ts`); zapis przez aplikację jest bezpieczny.
- **Termin 8:30**: pełny zakres jest duży; linia cięcia w §7.
- **Uchwyt wysokości** nie działa na dotyku (iPhone, iPad); tam zostaje modal.

## 7. Kolejność prac i linia cięcia

1. `taskChecklist.ts` z testami.
2. `useTaskDraft.ts` i wspólna treść modala (autozapis).
3. `TaskChecklist.tsx`: lista, komentarze, kopiowanie.
4. **Przepisanie opisu zadania „Testy Manualne CG” na checklistę** (przez aplikację; timer `nexus-sync` wypchnie zmianę).
5. Stos kolumn i panel 2fr.
6. Zwijanie kolumn i wysokość (`taskBoardLayout.ts`).

**Linia cięcia po kroku 4:** kroki 1–4 wystarczą na testy 17.11 (checklista w modalu); kroki 5–6 mogą dojść po testach. Plan implementacji (`writing-plans`) powinien to odzwierciedlić jako osobne zadania z osobnymi commitami.

## 8. Poza zakresem

- osobny plik zadania `Tasks/<id>.md` i nowe pole w linii zadania;
- eksport do pliku `.md` (wystarczy schowek);
- szablony checklist w `TaskTemplatesModal`, statystyki PASS/FAIL na kartach tablicy;
- więcej niż trzy stany punktu, status rodzica wyliczany z dzieci;
- zapamiętywanie ustawień układu w vaulcie lub synchronizacja między komputerami;
- panel roboczy poniżej 1024 px, uchwyt wysokości na dotyku.
