# Etap 1-5: pole `owner` i ostrzeżenie dla projektów etatu

Data: 2026-11-13. Rozwija spec asystenta (`2026-11-11-asystent-lokalny-nexus-design.md`, §5 „Prywatność i dane z etatu”) i spec 1-4 (`2026-11-13-etap-1-4-paczka-kontekstu-design.md`, poza zakresem: `owner: work`).

## 1. Cel i zakres

Rejestr projektów dostaje pole `owner` (`personal` | `work`). Dla `work` paczka kontekstu i karta projektu pokazują ostrzeżenie „Dane z firmy: sprawdź, gdzie wklejasz”. To szkielet: mechanizm gotowy, zanim pojawią się dane etatu.

**Poza zakresem:** odczyt `Vault/Work/_registry.work.yaml` i scalanie projektów etatu z listą (osobny etap; `Work/` jeszcze nie istnieje); foldery projektów etatu, kalendarz etatu, backup `Work/`; blokady funkcji AI i eksportu (dziś nie ma takich funkcji: AI po API usunął etap A1, eksportu HTML i linków publicznych nie ma); jakakolwiek zmiana `lib/workGuard.ts`.

## 2. Decyzje

| #   | Decyzja              | Wybór                                                                                                                                                                                                                                                                                       |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Zakres               | Tylko szkielet (wybór użytkownika, 2026-11-13). Odrzucone: drugi rejestr (większy zakres, zależy od polityki firmy wobec danych etatu, zob. spec asystenta §9); samo pole bez ostrzeżenia w paczce.                                                                                         |
| D2  | Wartości `owner`     | Brak pola albo pusty tekst = `personal` (obecne 7 wpisów działa bez zmian). `personal` i `work` akceptowane. Każda inna wartość (np. `Work`, `firma`) = `work` plus ostrzeżenie rejestru. Przy ochronie prywatności literówka ma zawężać, nie rozluźniać.                                   |
| D3  | Rejestr w gicie      | `Projects/_registry.yaml` jest śledzony przez git, więc nie wpisujemy tam projektów etatu: sama nazwa projektu firmy byłaby ujawnieniem. Pole `owner: work` w tym pliku służy testom i przyszłemu wariantowi; docelowo projekty etatu trafią do `Work/_registry.work.yaml` (poza zakresem). |
| D4  | Ostrzeżenie w paczce | Dla `work` serwis dodaje do `warnings` jako pierwszy: „Dane z firmy: sprawdź, gdzie wklejasz”. Przycisk nadal kopiuje (spec asystenta §5). Markdown w schowku bez zmian: ostrzeżenie jest dla człowieka, nie dla agenta.                                                                    |
| D5  | `owner` a `type`     | Niezależne. `type` (`etat` / `wlasny` / `biblioteka`) to etykieta w `index.md`; `owner` to granica prywatności w rejestrze. Nie wyprowadzamy jednego z drugiego.                                                                                                                            |
| D6  | Blokady              | Brak funkcji do zablokowania, więc brak kodu blokad. Dodajemy `isWorkProject(entry)` w `services` jako jedno miejsce sprawdzenia dla przyszłych funkcji (AI lokalne, eksport) i wpis w Backlogu NEXUS.                                                                                      |

## 3. Zmiany w kodzie (ADR-021)

- `contexts/bc_projects/models.ts`: `export type Owner = "personal" | "work"`; `RegistryEntry.owner: Owner`.
- `contexts/bc_projects/repositories/index.ts`: `readRegistry` czyta `raw.owner` według D2; nieznana wartość dodaje do `warnings`: `Projects/_registry.yaml: pozycja N: nieznane owner "…", traktuję jako work`.
- `contexts/bc_projects/schemas.ts`: `Owner` dopisany do istniejącego bloku `import type { … } from "./models"` (nie `import { type Owner }`: test architektury traktuje taką składnię jak import runtime i łamie R3) i do `export type { Owner, ProjectType }`; `ProjectSummaryDto.owner: Owner`; `toSummaryDto` bez zmian logiki.
- `contexts/bc_projects/services/index.ts`: `isWorkProject(entry: Pick<RegistryEntry, "owner">)` (typ strukturalny, wygodny w testach); `buildContextPack` zaczyna od `warnings = isWorkProject(entry) ? [OWNER_WORK_WARNING] : []`, zanim dopisze ostrzeżenia gita i `pickRules`, więc komunikat jest pierwszy. `composeContextPack` bez zmian (przepisuje `input.warnings`, dopisuje tylko „ponad budżet” na końcu); stała `OWNER_WORK_WARNING` leży w `services/context-pack.ts` obok `REPO_REASON_TEXT`.
- UI `src/features/projects/`: znacznik „Dane z firmy” w nagłówku karty (`ProjectDossier.tsx`) dla `owner === "work"`; komunikat ostrzeżenia w `ProjectContextPack` pochodzi z `warnings` (bez nowej logiki).
- Test architektury nie jest zmieniany. Jeśli pęknie, naprawiamy kodem.

## 4. Testy (TDD, czerwony przed zielonym)

- `repositories.test.ts`: brak `owner` → `personal`; `owner: personal` → `personal`; `owner: work` → `work`; `owner: Work` → `work` plus ostrzeżenie; pusty `owner` → `personal` bez ostrzeżenia.
- `services.context-pack.test.ts`: `work` → `warnings[0]` = „Dane z firmy: sprawdź, gdzie wklejasz”, `markdown` identyczny jak dla `personal`; `personal` → brak tego ostrzeżenia. Przypadek `work` wymusza też drugie ostrzeżenie (git niedostępny), żeby test wykrył dopisanie komunikatu na końcu zamiast na początku.
- `services.test.ts`: `isWorkProject` dla obu wartości.
- `schemas.test.ts`: DTO przepuszcza `owner: "work"`.
- UI: `tests/unit/features/projects/ProjectsView.test.tsx` (teczka nie ma osobnego testu `ProjectDossier`): znacznik „Dane z firmy” tylko dla `work`.
- Istniejące fixtury z `owner: "personal"` zostają zgodne z nowym typem.

## 5. Po wykonaniu

W `../NEXUS/Vault/Projects/monolith/tasks.md` odhaczyć „Etap 1-5” (PR #NN, data) i dopisać do Backlogu: blokady `work` przy przyszłym eksporcie i AI (`isWorkProject`), odczyt `Work/_registry.work.yaml`. Commit tylko `tasks.md`, za zgodą użytkownika.
