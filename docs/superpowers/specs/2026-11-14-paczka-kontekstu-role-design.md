# Paczka kontekstu: szablony per rola (review / implementacja / debug) — projekt

Data: 2026-11-14
Status: zatwierdzony przez użytkownika (brainstorming 2026-11-14); do planu implementacji
Powiązane: `2026-11-13-etap-1-4-paczka-kontekstu-design.md` (paczka, budżet, redukcja), `2026-11-11-asystent-lokalny-nexus-design.md` (§6.1: „szablony per rola … z innym zestawem sekcji i podglądem przed skopiowaniem”), `2026-11-12-struktura-kontekstow-design.md` (siatka plików)

## 1. Cel

Paczka kontekstu (przycisk „Kopiuj paczkę kontekstu”, karta Projekty, Alt+4) jest dziś jedna i zawiera wszystko. Agent do review nie potrzebuje devlogu i bugów, agent do debugowania potrzebuje bugów i gita przed zasadami. Spec dodaje cztery role paczki, które różnią się **wyłącznie zestawem i kolejnością sekcji** oraz priorytetem przy cięciu do budżetu, plus wybór roli w karcie.

**Podgląd przed skopiowaniem już istnieje** (przycisk „Podgląd Markdown” w karcie „Paczka kontekstu”, dodany wg makiety 04); po wyborze roli pokazuje dokładnie to, co trafi do schowka, więc osobnej pracy nad podglądem nie ma.

**Poza zakresem:** tekst instrukcji dla agenta w paczce i etykieta roli w markdownie (użytkownik wybrał „tylko zestaw sekcji”); szablony edytowalne w vaulcie; zapamiętywanie wybranej roli; paczka Kokpitu (`CockpitSections.tsx` woła `/context-pack` bez roli, czyli `full`, bez zmian).

## 2. Role i skład

Nagłówek (`# Kontekst projektu: …` + linia statusu) jest zawsze pierwszy. Kolejność sekcji poniżej jest kolejnością w paczce.

| Rola              | Sekcje                                         | Szczegóły                                                                                                                                                            |
| ----------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full` (domyślna) | Zasady, Save State, Kod, Zadania, Bugi, Devlog | dokładnie jak dziś (bajt w bajt)                                                                                                                                     |
| `review`          | Zasady, Save State, Kod, Zadania               | Zadania: tylko „Teraz” (bez Blokerów); `diff --stat` chroniony przy cięciu do budżetu (tną się: log, potem zasady); bez Bugów i Devlogu                              |
| `implementation`  | Zasady, Save State, Zadania, Kod, Bugi         | Zadania: Blokery + Teraz; Kod: status i log, **bez** `diff --stat`; bez Devlogu                                                                                      |
| `debug`           | Bugi, Save State, Kod, Devlog, Zasady          | Kod z pełnym `diff --stat`; Devlog 3 wpisy; Zasady skrócone na starcie do 1200 znaków (wybór roli, nie cięcie do budżetu, więc **bez** flagi `truncated`); bez Zadań |

Zawartość pojedynczych sekcji (formaty, `Gdzie skończyłem` zamiast Save State, ostrzeżenia) bez zmian względem specu 1-4. Budżet bez zmian (ok. 4 tys. tokenów, `znaki / 4`); Save State, Zadania i Bugi nadal nigdy nie są skracane. Kroki redukcji z 1-4 (D6) działają jak dotąd, z jednym wyjątkiem: dla roli, która nie pokazuje `diff --stat` albo go chroni (`implementation`, `review`), kroki dotyczące `diff` są pomijane (nie ustawiają `truncated`). Dla roli bez Devlogu (`review`, `implementation`) kroki devlogu też są pomijane.

## 3. Architektura (`contexts/bc_projects/`, bez nowego kontekstu)

| Plik                       | Zmiana                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `models.ts`                | `CONTEXT_PACK_ROLES` i typ `ContextPackRole`                                                                                                                                                                                                     |
| `schemas.ts`               | `ContextPackRoleSchema` (zod; lista zgodna z `CONTEXT_PACK_ROLES`, pilnuje test), `PACK_ROLES` (klucz + etykieta dla UI), re-eksport typu `ContextPackRole`; `ContextPackDto` **bez zmian** (UI zna rolę, o którą prosił)                        |
| `services/context-pack.ts` | profile ról (`ROLE_PROFILES`: kolejność sekcji, zadania, `diff`, liczba wpisów devlogu, limit zasad, ochrona `diff`), `renderPack` składa sekcje wg profilu; `ContextPackInput.role?` (brak = `full`), `composeContextPack` bez zmiany sygnatury |
| `services/index.ts`        | `buildContextPack(id, today = new Date(), role = "full")`: `role` jest **ostatnim** parametrem, żeby istniejące wywołania `buildContextPack(id, today)` działały bez zmian                                                                       |
| `router.ts`                | `getContextPack` czyta `?role=` (brak = `full`, nieznana wartość = 400 `{ error: "Nieznana rola paczki" }`); trasa w `app/api` bez zmian (re-eksport)                                                                                            |

Odczyty vaulta i gita bez zmian (profil tylko wybiera, co trafi do markdownu). **Brak zapisów** do vaulta. Ostrzeżenie „Dane z firmy” dla `owner: work` działa dla każdej roli (to `warnings`, nie markdown). Test architektury bez zmian.

## 4. API

`GET /api/projects/[id]/context-pack[?role=full|review|implementation|debug]`. Odpowiedź: `ContextPackDto` jak dziś. Dla `full` klient **nie dodaje** zapytania (URL jak dotąd, co pilnuje istniejący test `useProjects` i Kokpit).

## 5. UI (`src/features/projects/`)

- `useContextPack(projectId, load)`: `load` przyjmuje rolę (`(role: ContextPackRole) => Promise<ContextPackResult>`); hook trzyma wybraną rolę (`role`, `setRole`) powiązaną z projektem: po zmianie projektu rola wraca do `full` bez dodatkowego pobrania. Zmiana roli ponownie pobiera paczkę (stan `loading` → `ready`), czyści komunikat o kopiowaniu; `copy` składa paczkę wybranej roli.
- `ContextPackModel` dostaje `role` i `setRole`. Karta „Paczka kontekstu” (`ProjectContextPack.tsx`): grupa przycisków `role="group"` `aria-label="Rola paczki"` (Pełna / Review / Implementacja / Debug, `aria-pressed`) pod nagłówkiem karty. Budżet, chipy sekcji i „Podgląd Markdown” odzwierciedlają wybraną rolę. Przycisk „Kopiuj paczkę kontekstu” w nagłówku teczki i w karcie kopiuje paczkę wybranej roli (tekst przycisków bez zmian).
- Kafel „Paczka kontekstu” (`projectTiles.ts`) pokazuje rozmiar paczki wybranej roli (czyli tego, co skopiuje przycisk); bez zmian w kodzie kafla.
- `useProjects.loadContextPack(role = "full")`: URL z `?role=…` tylko dla ról innych niż `full`; typ w `mutation.ts`: `loadContextPack: (role?: ContextPackRole) => Promise<ContextPackResult>`.
- UI importuje z kontekstu tylko `schemas`.

## 6. Błędy

Nieznana rola w zapytaniu: 400 (`{ error: "Nieznana rola paczki" }`), bez wywołania serwisu. Pozostałe błędy jak w 1-4 (404 dla nieznanego `id`, brak źródeł nie wywala paczki).

## 7. Testy (Vitest, TDD, czerwone przed kodem)

- _Kompozytor_ (`tests/unit/contexts/bc_projects/context-pack.roles.test.ts`, nowy): brak `role` = `full` (wynik `toEqual` z `role: "full"`); `review`: sekcje Zasady, Save State, Kod, Zadania w tej kolejności, brak Bugów i Devlogu, w Zadaniach „Teraz” bez „Blokery”, w Kodzie `diff --stat`; `implementation`: kolejność Zasady, Save State, Zadania, Kod, Bugi, Zadania z Blokerami i „Teraz”, Kod bez `diff --stat`, brak Devlogu; `debug`: kolejność Bugi, Save State, Kod, Devlog, Zasady, brak Zadań, sekcja Zasad nie dłuższa niż 1200 znaków treści i kończy się `…`, `truncated: false` przy dużym budżecie; ochrona `diff` w `review`: przy budżecie pomniejszonym o 100 tokenów względem pełnego rozmiaru `review` ostatnia linia `diff --stat` zostaje, a `truncated: true`, natomiast `full` przy analogicznym budżecie przycina `diff` (jego ostatniej linii nie ma).
- _Schematy_ (`schemas.pack-role.test.ts`, nowy): lista z `ContextPackRoleSchema` zgodna z `CONTEXT_PACK_ROLES`; `PACK_ROLES` ma te same klucze, każdy z niepustą etykietą.
- _Router_ (`router.test.ts`): `?role=review` → `buildContextPack("a", <Date>, "review")`; brak `role` → `"full"` (istniejąca asercja zaktualizowana); `?role=zly` → 400 `{ error: "Nieznana rola paczki" }` bez wywołania serwisu.
- _UI_ (`ProjectContextPack.test.tsx`, `useProjects.test.tsx`): cztery przyciski roli, „Pełna” wciśnięta; kliknięcie „Review” woła `load("review")` i przestawia `aria-pressed`; „Kopiuj” po wyborze „Debug” woła `load("debug")` i kopiuje markdown tej paczki; zmiana projektu przywraca „Pełna”; `loadContextPack("review")` pobiera `/api/projects/a/context-pack?role=review`, a bez argumentu dokładnie `/api/projects/a/context-pack` (istniejący test).
- Ręcznie po implementacji: karta Projekty, projekt `monolith`: przełączenie czterech ról, porównanie podglądu i skopiowanego tekstu, rozmiary tokenów w kaflu.

## 8. Commity i weryfikacja

Implementacja w **pięciu commitach**, po jednym na zadanie planu (typ i schemat roli, profile w kompozytorze, serwis i trasa, UI, dokumentacja); spec i plan w osobnych commitach dokumentów. Po każdym commicie testy dotknięte zmianą i `tsc` są zielone. Po zmianie: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` przez `cursor`; review diffa przez `agy`.

## 9. Ryzyka

- **Zmiana kolejności sekcji w `debug`** (Bugi przed Save State) łamie założenie „Save State pierwszy”, ale tylko w tej roli; `full` jest chroniony testem regresji.
- **Kafel paczki zależy od roli:** po wyborze `debug` kafel pokazuje inny rozmiar niż „Pełna”; zamierzone (kafel = to, co skopiuje przycisk), ale może zaskoczyć.
- **Limit zasad 1200 znaków w `debug`** jest stały; jeśli zasady projektu będą zbyt ucięte, wartość trzeba będzie przestroić (stała w `ROLE_PROFILES`).
