# Save State: widok bez pustych pól

## Cel

W karcie Projekty widok „Save State” pokazuje pięć kafli (Aktywny branch, Środowisko, Bloker, Następny krok, Linki), nawet gdy są puste (wtedy „—”). Dziś wypełniony `state.md` ma tylko Tester AI; u pozostałych sześciu projektów widok to pięć pustych kafli. Pola mają zostać w formacie i w formularzu „Edytuj”; widok czytania pokazuje tylko to, co wypełnione.

## Decyzje

| ID  | Decyzja                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Widok czytania (`ProjectSaveState`, gałąź `state !== null`) renderuje kafel tylko dla niepustego pola: `branch`, `env`, `blocker`, `nextStep` (po `trim() !== ""`), `links` (`length > 0`). Kafel „Gdzie skończyłem” bez zmian (tylko gdy `whereIStopped`). |
| D2  | Gdy nie ma żadnego kafla (wszystkie pola puste i brak `whereIStopped`), widok pokazuje jedną przygaszoną linię `projects:saveState.allEmpty` („Brak zapisanych pól. Kliknij „Edytuj”, aby je uzupełnić.”) zamiast pustej siatki.                            |
| D3  | Bez zmian: format `state.md`, DTO, router, services, repositories, formularz (wszystkie pola), przycisk „Edytuj”, nagłówek z datą, gałąź `state === null`. Brak zmian w `contexts/` i w teście architektury.                                                |
| D4  | `milestone` nadal nie jest wyświetlane w widoku czytania (jak dziś); poza zakresem.                                                                                                                                                                         |

## Zmiany

- `src/features/projects/ProjectSaveState.tsx`: w gałęzi czytania warunkowe renderowanie kafli wg D1; linia z D2. Funkcja pomocnicza `dash` przestaje być potrzebna (usunąć).
- `src/i18n/locales/pl/projects.ts` i `src/i18n/locales/en/projects.ts`: klucz `saveState.allEmpty` (pl: „Brak zapisanych pól. Kliknij „Edytuj”, aby je uzupełnić.”; en: „No saved fields. Click “Edit” to fill them in.”). Sprawdzić, jak `en` nazywa przycisk edycji, i użyć tej samej nazwy.
- `tests/unit/features/projects/ProjectSaveState.test.tsx`: testy poniżej; istniejące, które zakładają „—” w pustych kaflach, dostosować (zob. wynik `npx vitest run tests/unit/features/projects/ProjectSaveState.test.tsx`).

## Testy (wartości oczekiwane)

1. state z samym `branch: "main"`: widać „main” i etykietę „Aktywny branch”; brak etykiet „Środowisko”, „Bloker”, „Następny krok”, „Linki” i brak „—”.
2. state ze wszystkimi polami wypełnionymi: wszystkie pięć etykiet (jak dziś).
3. state z wszystkimi polami pustymi i bez `whereIStopped`: widać `allEmpty` i przycisk „Edytuj”; brak jakiejkolwiek z pięciu etykiet.
4. state z pustymi polami, ale z `whereIStopped = "tu skończyłem"`: widać „Gdzie skończyłem (z index.md)”, brak `allEmpty`, brak pustych kafli.
5. `blocker: "   "` (same spacje) liczy się jako pusty: brak kafla „Bloker”.
6. Formularz po kliknięciu „Edytuj” nadal zawiera pola Branch, Środowisko, Bloker, Następny krok, Milestone, Linki.

## Poza zakresem

Czytanie brancha z gita, usuwanie pól z formatu, wyświetlanie `milestone`.
