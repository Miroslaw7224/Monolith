# Nowy wygląd kart (wdrożenie makiet) Implementation Plan

**Cel:** Karty aplikacji dostają wygląd z makiet `docs/mockups/karty/cards/` (Kokpit, Kalendarz, Zadania, Notatki, Płótno, Arsenał); makieta Kodeksu zostaje dokończona. Jeden PR, **jeden commit na kartę**.

**Zakres (założenie, do zmiany na życzenie):** wyłącznie wygląd istniejących funkcji. Funkcje, których jeszcze nie ma w kodzie (lista w `docs/mockups/karty/STAN-W-KODZIE.md`: energia Deep/Quick, planer slotów, inbox, filtry zadań itd.), **nie** są dodawane; elementy makiety bez danych w kodzie pomijamy albo pokazujemy w pustym stanie, bez fikcyjnych danych. Projekty są już odmalowane (etap 1-1…1-5).

**Wzorzec:** `src/features/projects/projects.css` (klasy z prefiksem karty, motyw w bloku `[data-card="<id>"] .<prefiks>` ze zmiennymi z `docs/mockups/karty/tokens.css`, import CSS w widoku karty). Bez nowych bibliotek, bez zmian logiki i API, istniejące testy mają zostać zielone (zmieniać wolno selektory/teksty tylko tam, gdzie testy sprawdzają stare klasy).

## Podział pracy

| Kto                                           | Co                                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| agy (`--role task`, `--fresh` na każdą kartę) | implementacja karty: CSS + zmiany klas/struktury w komponentach karty według makiety (jedna karta na zlecenie) |
| cursor (`--role task`, `--tier light`)        | `npx tsc --noEmit`, `npx vitest run`, `npm run lint` po karcie; mechaniczne poprawki testów                    |
| Claude (zarządzanie)                          | brief dla agy, przegląd `git diff`, poprawki, gdy pomocnicy nie dają rady, commit                              |

## Zadania (każde = jeden commit)

0. Makieta Kodeksu `docs/mockups/karty/cards/09-kodeks.html` (spec Kodeksu §4.7), samo HTML/CSS makiety.
1. Kokpit: `src/features/home/` (`HomeView`, `CockpitSections`, `PinPicker`) wg `01-kokpit.html`.
2. Kalendarz: `src/features/calendar/` wg `02-kalendarz.html`.
3. Zadania: `src/features/tasks/` wg `03-zadania.html`.
4. Notatki: `src/features/notes/`, `src/components/note-editor/` wg `05-notatki.html`.
5. Płótno: `src/features/board/` wg `06-plotno.html`.
6. Arsenał: `src/features/resources/` wg `07-arsenal.html`.
7. Weryfikacja końcowa (`tsc`, `vitest run`, `lint`, `build`), przegląd diffu przez agy (`--role review`), aktualizacja `STAN-W-KODZIE.md`, PR.

**Poza zakresem:** Mapa (w aplikacji zaślepka „etap 4”, makieta opisuje graf, którego nie ma), Kodeks część B (czytnik i checklisty; kod po etapach 0c/0f), nowe funkcje z makiet.

## Reguły dla każdej karty

- Dostęp do `fs`/vaulta bez zmian; `contexts/**` nie są ruszane (UI importuje z kontekstów tylko `schemas`).
- `tests/unit/architecture.static.test.ts` bez zmian.
- Po karcie: `npx tsc --noEmit`, `npx vitest run`, `npm run lint` przechodzą; commit `feat(karty): nowy wygląd karty <nazwa>`.
- Nowa karta = nowy kontekst agy (`--fresh`); poprawki tej samej karty `--keep`.
