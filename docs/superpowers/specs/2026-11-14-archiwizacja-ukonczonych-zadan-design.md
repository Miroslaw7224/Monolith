# Archiwizacja ukończonych zadań projektu i kolejność „otwarte przed ukończonymi” — projekt

Data: 2026-11-14
Status: do review
Powiązane: `2026-11-12-struktura-kontekstow-design.md` (siatka plików, reguły), etap 1-3 tablicy zadań (`contexts/bc_projects/repositories/tasks-file.ts`), `2026-11-11-asystent-lokalny-nexus-design.md` (paczka kontekstu)

## 1. Cel

Odhaczone zadania w `Projects/<id>/tasks.md` tylko się kumulują: w `monolith/tasks.md` 45 z 66 linii jest ukończonych, a odhaczenie zostawia linię w miejscu, więc ukończone przeplatają się z otwartymi. Spec rozwiązuje to dwiema rzeczami:

1. **Kolejność:** w każdej sekcji otwarte zadania leżą przed ukończonymi.
2. **Archiwizacja:** akcja „Archiwizuj ukończone” przenosi ukończone zadania starsze niż N dni (N wybiera użytkownik: 3, 5 albo 7) do `Projects/<id>/changelog.md`.

**Wymóg nadrzędny:** archiwum nie może rozbudowywać kontekstu agenta. `changelog.md` nie jest czytany przez żaden istniejący czytnik (parser tablicy, paczka kontekstu, `readProjectContent`).

## 2. Zakres

**W zakresie:** zadania projektów w `tasks.md` (`bc_projects`): zmiana kolejności przy `toggle`/`add`/`move`, nowa akcja archiwizacji (trasa, serwis, repozytorium, UI), nowy plik `changelog.md`.

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

Sekcja bez otwartych zadań: blok trafia na jej początek (pod nagłówek i ewentualną prozę, placeholder `Brak…` znika jak dziś). „Ukończ” z Kokpitu przechodzi przez `toggle`, więc zachowuje się tak samo.

Implementacja w `repositories/tasks-file.ts`: nowe wyliczenie punktu wstawienia „za ostatnim otwartym zadaniem sekcji” obok istniejącego `insertBlock`; `toggle` zmienia się z edycji w miejscu na usunięcie bloku i wstawienie w punkcie z tabeli. Indeksy zadań w kolumnach są liczone po każdej operacji od nowa (odpowiedź zwraca świeży stan projektu), więc UI nie wymaga zmian.

## 4. Archiwizacja do `changelog.md`

### 4.1 Wybór zadań

Ukończone (`- [x]`) zadania ze wszystkich sekcji, których data końcowa (`— RRRR-MM-DD`) jest **starsza niż N dni kalendarzowych** od dnia serwera (`localDate(now)`). Wiek = liczba dni między datą ukończenia a dniem serwera; archiwizowane, gdy wiek > N. Przykład (N = 3, dziś 2026-11-14): `2026-11-10` jest archiwizowane, `2026-11-11` zostaje. Zadania ukończone **bez daty** są archiwizowane zawsze (nie da się ich zakwalifikować inaczej). Otwarte zadania nigdy.

`N` to liczba całkowita 1–30, wybierana przez użytkownika; UI oferuje 3, 5 i 7 (domyślnie 7). Walidacja zakresu jest w zod po stronie serwera, więc agent też może wywołać akcję z innym progiem.

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

Sekcje miesięcy `## RRRR-MM`, **najnowszy miesiąc na górze**, w środku linie od najnowszej (wcięte linie bloku zostają). `## Bez daty` zawsze na samym dole. Linie już obecne w pliku (identyczny tekst linii i ten sam miesiąc) nie są dopisywane ponownie, więc powtórne uruchomienie jest idempotentne.

### 4.3 Zapis (dwa kroki)

1. Dopisanie do `changelog.md` (`updateVaultFile`, zmiana lokalna, ponawiana po konflikcie).
2. Usunięcie tych samych bloków z `tasks.md` z kontrolą wersji (`expected`): niezgodność to `ConflictError` (409).

Awaria po kroku 1 zostawia duplikaty w changelogu (nigdy utratę zadań); ponowne uruchomienie je domyka. Blokada zapisu dla projektów `owner: work` jak przy pozostałych zapisach (`assertWritable`).

### 4.4 Izolacja od kontekstu agenta

Paczka kontekstu (`services/context-pack.ts`) bierze z tablicy wyłącznie otwarte zadania z `Blokery` i `Teraz`, więc ukończone i tak w niej nie ma. `changelog.md` nie jest otwierany przez `readProjectContent`, `readProjectBoard`, `readDevlog` ani paczkę. Wymóg jest pilnowany testem (§7).

## 5. Struktura kodu (`contexts/bc_projects/`)

| Plik                         | Zmiana                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `schemas.ts`                 | `ArchiveDoneInputSchema` (`version`, `olderThanDays` 1–30), DTO odpowiedzi `{ archived: number, project }` |
| `models.ts`                  | typ wyniku archiwizacji (liczba i lista zarchiwizowanych bloków)                                           |
| `repositories/tasks-file.ts` | reguła kolejności w `toggle`/`add`/`move` (§3); czysta `extractArchivable(text, today, olderThanDays)`     |
| `repositories/markdown.ts`   | `mergeChangelog(text \| null, blocks, projectName)`                                                        |
| `repositories/index.ts`      | `archiveDoneTasks(entry, expected, ctx)`: kroki z §4.3                                                     |
| `services/index.ts`          | `archiveDone(id, version, olderThanDays, now)`                                                             |
| `router.ts`                  | `postTasksArchive`; `app/api/projects/[id]/tasks/archive/route.ts` tylko re-eksportuje (reguła 4)          |

Trasa: `POST /api/projects/[id]/tasks/archive`, ciało `{ "version": …, "olderThanDays": 7 }`, odpowiedź `{ archived, project }`. Każdy `POST` z `curl` wymaga nagłówka `X-Nexus-Client: 1` (strażnik `lib/http/localGuard.ts`).

Test architektury (`tests/unit/architecture.static.test.ts`): bez zmian; gdyby wymagał zmiany, idzie osobnym commitem, nie razem z kodem.

## 6. UI (`src/features/projects/`)

- Nad kolumnami: „Archiwizuj ukończone (N)” z polem wyboru „starsze niż: 3 / 5 / 7 dni” (domyślnie 7). `N` przelicza się po zmianie progu, tymi samymi regułami co serwer (data lokalna przeglądarki i serwera pochodzi z tej samej maszyny).
- Przy `N = 0` przycisk jest ukryty.
- Klik otwiera potwierdzenie w miejscu („Przenieść N zadań do changelog.md?” + Tak/Anuluj), jak `confirmRemove`.
- `ProjectTasksBoard` dostaje prop `onArchive(version, olderThanDays)`; `mutation.ts` (`ProjectActions`) dostaje `archiveDone`, a `useProjects` woła trasę. Wynik to `MutationResult`: `busy`, błąd i konflikt (`CONFLICT_MESSAGE` + `onReload`) działają jak dla `run`. Po sukcesie komunikat „Przeniesiono N zadań do changelog.md”.
- UI importuje z kontekstu tylko `schemas` (zod wejścia i DTO).

## 7. Błędy i testy

**Błędy:** 409 przy niezgodnej wersji albo zmianie `tasks.md` między krokami; 400 przy `olderThanDays` poza 1–30 (generyczne „Validation failed” zod); brak `tasks.md` albo `N = 0` → `archived: 0` bez zapisu; uszkodzony `changelog.md` → błąd z nazwą pliku, nic nie jest zmieniane (pliku, który się nie parsuje, nie nadpisujemy).

**Testy (Vitest, TDD, czerwone przed kodem)**, pliki w `tests/unit/contexts/bc_projects/` i `tests/unit/features/projects/`:

- _Kolejność_ (`tasks-file.test.ts`): odhaczenie zadania w środku `Next` ląduje za ostatnim otwartym i przed starszymi ukończonymi; odznaczenie wraca za ostatnie otwarte; `add` ląduje przed ukończonymi; `move` do sekcji z ogonem ukończonych (otwarte przed, ukończone na górę ogona); blok z wciętymi liniami przenosi się w całości; sekcja bez otwartych: blok na początku; reszta pliku bajt w bajt.
- _Wybór_ (`tasks-file.test.ts`): przy dziś 2026-11-14 i N = 3: `2026-11-10` zarchiwizowane, `2026-11-11` zostaje; N = 7: `2026-11-06` zarchiwizowane, `2026-11-07` zostaje; linia bez daty zarchiwizowana; otwarte nigdy; ukończone ze wszystkich sekcji.
- _Format_ (`repositories.markdown.test.ts`): nowy plik; dopisanie do istniejącego miesiąca; nowy miesiąc na górze; `## Bez daty` na dole; idempotencja; uszkodzony plik daje błąd.
- _Kontekst_ (`services.context-pack.test.ts`): paczka dla projektu z `changelog.md` identyczna jak bez niego.
- _Serwis i router_ (`services.test.ts`, `router.test.ts`): 409 przy złej wersji, 400 przy `olderThanDays` 0 i 31, `archived: 0` przy pustym wyniku, blokada `owner: work`, kolejność zapisów (changelog przed `tasks.md`).
- _UI_ (`ProjectTasksBoard.test.tsx`): przycisk ukryty przy `N = 0`; `N` zmienia się z progiem; potwierdzenie → `onArchive` z wersją i progiem; konflikt wywołuje `onReload`.

## 8. Kolejność commitów i weryfikacja

Jeden PR: (1) kolejność w `tasks-file.ts` z testami; (2) `extractArchivable` i `mergeChangelog` z testami; (3) repozytorium, serwis, trasa; (4) UI. Po każdym `npx tsc --noEmit` i `npx vitest run`; na końcu `npm run lint` i `npm run build` przez `cursor`. Ręcznie w przeglądarce: karta Projekty → tablica `monolith` (próg 3 dni, potwierdzenie, odświeżenie, `changelog.md` w vaulcie).

## 9. Ryzyka

- **Dwa pliki, brak transakcji:** zgodnie z §4.3 awaria zostawia duplikaty, nie utratę; idempotencja je domyka.
- **Wymieszane stare pliki:** reguła kolejności nie naprawia ich naraz; archiwizacja i dotykanie zadań robią to stopniowo (świadomie, §2).
- **Zmiana zachowania `toggle`:** odhaczenie przesuwa linię w pliku (do tej pory zostawała); testy kolejności to pokrywają, a `completeNowTask` z Kokpitu (`services/index.ts:209`) idzie tą samą ścieżką.
