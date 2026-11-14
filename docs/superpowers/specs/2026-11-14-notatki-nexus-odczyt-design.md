# Notatki: baza wiedzy NEXUS w trybie tylko do odczytu

Data: 2026-11-14. Rozwija kartę Notatki (Alt+5) i makietę `docs/mockups/karty/cards/05-notatki.html` (drzewo z `Projects/`, karta frontmattera, wikilinki).

## 1. Cel i zakres

Panel Notatki pokazuje dziś wyłącznie `Vault/Notes/` (swobodne notatki, pełna edycja). Dokumenty NEXUS leżą obok, w tym samym vaulcie, ale panel ich nie widzi. Celu nie osiągnie ani mieszanie ich z notatkami (pliki projektów mają ścisły format, a źródłem prawdy jest NEXUS), ani edycja z poziomu panelu.

W zakresie:

1. Druga, wyraźnie oddzielona sekcja panelu **Baza wiedzy NEXUS** obok sekcji **Notatki**.
2. Odczyt: drzewo plików `.md` z `Vault/Knowledge/` i z wybranych plików `Vault/Projects/<id>/` (D2), podgląd z kartą frontmattera i klikalnymi wikilinkami do innych widocznych dokumentów NEXUS.
3. Gwarancja strukturalna: żadna ścieżka kodu tej funkcji nie zapisuje do vaulta.

**Poza zakresem:** edycja plików NEXUS, nowe notatki zapisywane do NEXUS, wyróżnienia `<mark>` z makiety, backlinki, przejście z wikilinku do karty Projekty (link do pliku obsługiwanego przez kartę jest zwykłym tekstem), Inbox, Sessions, Documents, Board, Calendar (mają własne karty albo są puste).

## 2. Decyzje

| #   | Decyzja                | Wybór                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Tryb                   | Tylko odczyt. Wybór użytkownika, 2026-11-14.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D2  | Zakres plików          | `Knowledge/` w całości (rekurencyjnie, ok. 225 plików) oraz z `Projects/<id>/` tylko pliki nieobsługiwane przez kartę Projekty. Wybór użytkownika, 2026-11-14 (zawężenie po sprawdzeniu zdublowania z kartą Projekty). Szczegóły kształtu ścieżek i projektów: D3 i D9.                                                                                                                                                                                                                                                                                                      |
| D3  | Pliki wyłączone        | Z `Projects/<id>/`: `index.md`, `tasks.md`, `bugs.md`, `state.md`, `ai-context.md`, `devlog.md` (lista z kodu `bc_projects`, `bc_tasks`, `bc_cockpit`, potwierdzona recenzją 2026-11-14). Wszędzie: pliki `_*` (np. `Knowledge/_index.md`, `_tags.md`) i katalogi `attachments/`, jak w `bc_map` (`contexts/bc_map/repositories.ts`). Kształt w `Projects/`: dokładnie `Projects/<id>/<plik>.md` (bez plików luzem w `Projects/` i bez podkatalogów). Zostają swobodne dokumenty, np. `<id>.md`, decyzje. Wyłączenie dotyczy też odczytu po ścieżce: 404, jak nieistniejący. |
| D9  | Projekty `owner: work` | Z `Projects/` pokazujemy tylko projekty znane karcie Projekty (`id` z `projectsServices.listProjects()`), **bez** `owner: work` (`isWorkProject`; dane etatu nie opuszczają `Work/`). Rejestr czytamy wyłącznie przez `services` kontekstu `bc_projects`, zgodnie z regułą „kontekst woła tylko `services` innego kontekstu”. Folder spoza rejestru nie jest listowany.                                                                                                                                                                                                      |
| D8  | Test architektury      | `VAULT_FS_IMPORTERS` w `tests/unit/architecture.static.test.ts` dopuszcza runtime'owy import `vault-fs` tylko wymienionym plikom (lista jest dziś „zapisową”). Dopisujemy `contexts/bc_nexus_docs/repositories` **osobnym commitem testu, przed kodem**. Ponieważ lista zapisowa pozwoli wtedy też na zapis, gwarancję „tylko odczyt” daje dodatkowy test statyczny z §7 pkt 8.                                                                                                                                                                                              |
| D4  | Architektura           | Nowy kontekst `contexts/bc_nexus_docs/` bez żadnej funkcji zapisu. Odrzucone: rozszerzenie `bc_notes` o `source` (miesza modele, ryzyko, że zapis notatki trafi w `Projects/*`), wykorzystanie `bc_projects` / `bc_resources` (panel zależałby od cudzych kontekstów).                                                                                                                                                                                                                                                                                                       |
| D5  | Wikilinki              | Rozwiązywane po ścieżce w vaulcie (z i bez `.md`, bez `\|alias` i `#nagłówka`), z fallbackiem: `Projects/` i `Knowledge/` jako prefiks. Cel musi być na liście widocznych dokumentów. Inaczej wynik to zwykły, wyszarzony tekst. Bez dopasowania po samej nazwie pliku.                                                                                                                                                                                                                                                                                                      |
| D6  | Rendering              | `markdown-it` zostaje, `html: false` bez zmian. Wikilinki jako mała wtyczka `lib/markdown/wikilinks.ts`, parametryzowana funkcją `resolve(target) → ścieżka \| null`. Resolver D5 jest czystą funkcją po stronie klienta w `src/features/notes/nexusLinks.ts` i działa na liście ścieżek z `GET /api/nexus-docs`. Ekstrakcji linków z `bc_map` nie reużywamy: kontekst jest niedostępny z `lib/` i `src/` (R1–R3), a regex tam omija tylko bloki kodu.                                                                                                                       |
| D7  | Lista i treść          | Lista (ścieżka, tytuł, tagi) w jednym zapytaniu, bez paginacji (ok. 250 pozycji). Treść pliku dopiero po otwarciu.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## 3. Architektura

Zgodnie z ADR-021 i `CLAUDE.md` (kierunek `app/api` → `router` → `services` → `repositories` → `lib/nexus`):

- `models.ts`: `NexusDocSummary { path, area: "Knowledge" | "Projects", group, title, tags }` oraz `NexusDoc = NexusDocSummary + frontmatter + body`, gdzie `frontmatter` to lista par `{ key, value }` z wartościami już zamienionymi na tekst (tablica YAML jako `[a, b]`), gotowa dla karty `.not-frontmatter`. `tags` to tablica napisów z pola `tags` (tablica YAML albo napis rozdzielony przecinkami; reszta daje `[]`). `path` jest względna wobec korzenia vaulta, np. `Knowledge/alembic.md`; `group` to podkatalog (`ai-security`) albo id projektu.
- `repositories.ts`: jedyny dostęp do vaulta, wyłącznie `listVaultFilesRecursive` i `readVaultFile` z `lib/nexus/vault-fs` (walidacja ścieżek, `resolveInsideVault`, blokada `Work/` zostaje domyślna). Parsowanie frontmattera przez `lib/nexus/frontmatter`. **Brak importu** `writeVaultFile`, `updateVaultFile`, `deleteVaultFile`, `createEntry`, `updateEntry`, `deleteEntry`.
- `services.ts`: reguły domeny: dozwolone obszary (`Knowledge`, `Projects`), lista wyłączeń z D3, zbiór widocznych projektów z D9 (z `bc_projects/services`), walidacja ścieżki (rzuca `DomainError` 400, bo `schemas.ts` nie może importować `lib/errors`), `group` (podkatalog w `Knowledge/`, `id` w `Projects/`, pusty dla plików luzem w `Knowledge/`), rozwiązywanie tytułu (frontmatter `title`, inaczej `name` (używane w notatkach projektów), inaczej pierwszy `# nagłówek`, inaczej nazwa pliku), limit odpowiedzi (treść dłuższa niż 1 MB po odczycie daje `413`; `readVaultFile` czyta cały plik, więc limit chroni odpowiedź, nie pamięć serwera, co przy lokalnym vaulcie wystarcza). **Odczyt pliku jest dozwolony tylko wtedy, gdy jego ścieżka należy do listy widocznych dokumentów** (ta sama funkcja, która buduje listę). Dzięki temu jedna reguła obejmuje wyłączenia z D3, dowiązania (lista je pomija), katalogi `Work` na dowolnej głębokości (`resolveInsideVault` sprawdza `Work` tylko jako pierwszy segment, więc sam nie wystarczy dla `Projects/p/work/x.md`) i wielkość liter w prefiksie.
- `schemas.ts`: DTO bezpieczne dla klienta (UI importuje tylko ten plik; zgodnie z regułą R3 importuje wyłącznie `lib/schema/**` i `import type` z `./models`). Zod dla parametru ścieżki (tablica segmentów catch-all); właściwa walidacja i błędy 400 są w `services.ts`: segmenty łączone przez `/`, a segment zawierający `/`, `\` lub `\0` (np. po zdekodowaniu `%2F`) jest odrzucany.
- `router.ts`: dwa handlery `GET`, błędy przez `handleServiceError`.
- `app/api/nexus-docs/route.ts` i `app/api/nexus-docs/[...path]/route.ts`: wyłącznie pojedynczy `export { GET } from ".../router"` (reguła R4). Brak eksportu `PUT`/`POST`/`DELETE`, więc Next zwraca 405.

Test `tests/unit/architecture.static.test.ts` wymaga **jednej zmiany** (D8): wpis `contexts/bc_nexus_docs/repositories` w `VAULT_FS_IMPORTERS`, osobnym commitem przed kodem (`CLAUDE.md`: zmiany testu nigdy razem z kodem). Reguły R1–R7 poza tym przechodzą bez zmian.

## 4. API

| Metoda i adres                  | Odpowiedź                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /api/nexus-docs`           | `NexusDocSummary[]`, posortowane po `area`, `group`, `title`. Bez treści.                          |
| `GET /api/nexus-docs/<ścieżka>` | `NexusDoc` (frontmatter + treść). `<ścieżka>` względem vaulta, np. `Knowledge/ai-security/foo.md`. |

Błędy: 400 (ścieżka pusta, bez `.md`, z `..`, absolutna, ze znakami z §3 w segmencie, prefiks inny niż dokładnie `Knowledge/` lub `Projects/`, wielkość liter rozróżniana), 404 (ścieżka poprawna, ale spoza listy widocznych dokumentów: brak pliku, plik wyłączony wg D3, dowiązanie, katalog `Work`), 413 (plik większy niż limit), 500 (reszta, przez `handleServiceError`). Kolejność: najpierw sprawdzenie składni i prefiksu (400), potem lista (404). Dlatego `Work/x.md` jako pierwszy segment kończy się 400 przez prefiks, zanim `WorkAreaBlockedError` (403) zdąży się pojawić. Komunikaty błędów, które tworzy ten kontekst, nie zawierają ścieżek systemowych. Istniejące zachowanie `handleServiceError` dla błędów konfiguracji vaulta (`VaultConfigError`) zostaje bez zmian i jest poza zakresem.

## 5. UI

- Dziś `NotesPanel` dostaje notatki i wybór (`selectedNote`, `setSelectedNote`) z `PlanowanieView` i ma układ trzech kolumn (`.not-layout`: lista, edytor, kolumna metadanych). Zmiana jest ograniczona do `NotesPanel`: **bez przenoszenia stanu notatek wyżej**.
- Logika NEXUS trafia do nowych plików w `src/features/notes/`: `NexusDocsSection.tsx` (drzewo w lewej kolumnie pod sekcją Notatki, wyszukiwanie, tagi), `NexusDocView.tsx` (podgląd z kartą frontmattera) i `useNexusDocs.ts` (fetch listy i dokumentu). `NotesPanel.tsx` tylko je składa i nie rośnie o tę logikę.
- Stan wyboru NEXUS (`nexusPath: string | null`) jest lokalny w `NotesPanel`. Wybór dokumentu NEXUS wywołuje `setSelectedNote(null)` i wychodzi z trybu edycji, a wybór notatki zeruje `nexusPath`. Kolumna środkowa renderuje albo edytor notatki, albo `NexusDocView`; kolumna metadanych pokazuje ścieżkę i tagi dokumentu.
- Frontmatter NEXUS pochodzi z DTO (parsowanie po stronie serwera przez `lib/nexus/frontmatter`), UI nie używa `splitFrontmatter` z `noteMeta.ts` (to format notatek).
- Dla dokumentu NEXUS: nagłówek ze ścieżką, plakietka „tylko odczyt”, **tylko zakładka Podgląd** (Edycja i Split niewidoczne), brak zapisu, usuwania i zmiany tytułu. Karta frontmattera jak w makiecie (`.not-frontmatter`).
- Wikilink ze znanym celem zmienia wybór na ten dokument (bez przeładowania), nieznany albo wyłączony cel to wyszarzony tekst z podpowiedzią „poza bazą NEXUS w tym panelu”.
- Wyszukiwanie po tytule i ścieżce oraz filtr tagów działają osobno w każdej sekcji. Lista tagów NEXUS pochodzi z pola `tags` frontmattera.
- Teksty UI po polsku w `src/translations.ts`, zgodnie z istniejącymi etykietami panelu. UI importuje z kontekstu wyłącznie `schemas`.

## 6. Bezpieczeństwo

- Każda ścieżka z URL przechodzi `resolveInsideVault`. Dodatkowo serwis wymaga prefiksu `Knowledge/` lub `Projects/` i rozszerzenia `.md`, a repozytorium nie ma żadnej operacji zapisu.
- `Work/` pozostaje zablokowany (`allowWork` domyślnie wyłączone). Lista pomija katalogi `Work` na dowolnej głębokości, a odczyt wymaga obecności na liście (§3).
- Markdown renderowany z `html: false`; wartość `data-nexus-path` w linku jest escapowana, a cel wikilinku nie trafia do `href` wprost (kliknięcie obsługuje UI po ścieżce z listy).
- Treść dokumentów NEXUS to dane, nie instrukcje: aplikacja ich nie wykonuje i nie przekazuje agentom.

## 7. Testy

Jednostkowe, wg istniejącego układu `tests/unit/contexts/` i `tests/unit/features/`:

1. Repozytorium i serwis (vault tymczasowy): lista zawiera `Knowledge/**.md` (w tym pliki luzem, `group` pusty) i swobodne pliki z `Projects/<id>/`; pomija `index.md`, `tasks.md`, `bugs.md`, `state.md`, `ai-context.md`, `devlog.md`, pliki `_*`, katalogi `attachments/`, pliki luzem w `Projects/`, podkatalogi `Projects/<id>/sub/`, foldery spoza rejestru, projekty `owner: work`, dowiązania (także do `Notes/x.md` i do wyłączonego `state.md`) i katalogi `Work`; odczyt każdego z nich po ścieżce daje 404 (w tym `Projects/p/work/x.md`).
2. Ścieżki (400): `../`, `Projects/id/../../Knowledge/x.md`, absolutna, `Notes/x.md`, `Work/x.md`, `knowledge/x.md` (wielkość liter), `Knowledge/x.txt`, pusta, segment z `/`, `\` lub `\0`. Test w `schemas`/routerze na wejściu po dekodowaniu (`%2e%2e`, `%2F`, wielokrotne `//`). Plik większy niż 1 MB daje 413, niepoprawny UTF-8 nie wywraca odczytu.
3. Tytuł i frontmatter: frontmatter `title` > pierwszy `#` > nazwa pliku. Plik bez frontmattera albo z błędnym YAML (`parseFrontmatter` zwraca `null`) daje `tags: []`, pusty frontmatter i całą treść jako `body`.
4. Router: `GET` listy i `GET [...path]` (przez wywołanie handlera z parametrami catch-all); brak eksportów `PUT`/`POST`/`DELETE` w obu plikach `route.ts` (test statyczny w nowym pliku, nie w `architecture.static.test.ts`).
5. Resolver wikilinków (D5), osobny `describe`: ścieżka z i bez `.md`, `[[id/id]]` przez fallback `Projects/`, `|alias` i `#nagłówek` tylko w renderze, cel wyłączony wg D3 lub nieznany daje `null`, brak dopasowania po samej nazwie pliku.
6. Wtyczka wikilinków (inline rule, więc tekst w code span i bloku kodu zostaje nietknięty): `[[Knowledge/a]]`, `[[a#h]]`, `[[` bez zamknięcia, wstrzyknięcie `"><script>` w celu, wikilink w komórce tabeli (działa), w bloku kodu i code span (bez zmian), w tekście zwykłego linku `[...](...)` (zwykły tekst, bez zagnieżdżonego `<a>`).
7. UI: `NexusDocsSection.test.tsx` (mock `fetch`): lista, wyszukiwanie i tagi osobno dla sekcji, klik w wikilink zmienia wybór. `NotesPanel.test.tsx`: po wyborze dokumentu NEXUS widać plakietkę „tylko odczyt”, nie ma zakładek Edycja i Split ani przycisków zapisu i usuwania; wybór notatki zeruje wybór NEXUS i odwrotnie. Istniejące testy panelu muszą przejść bez zmian.
8. Statyczny (nowy plik testu): w `contexts/bc_nexus_docs/` brak importów `writeVaultFile`, `updateVaultFile`, `deleteVaultFile`, `createEntry`, `updateEntry`, `deleteEntry` oraz modułów `markdown-dir` i `yaml-store`. To uzupełnia `VAULT_FS_IMPORTERS` (D8), które samo nie odróżnia odczytu od zapisu.

## 8. Ryzyka

- Lista wyłączeń (D3) jest zapisana w serwisie, więc nowy plik obsługiwany przez kartę Projekty trzeba tam dopisać. Test z punktu 1 pilnuje obecnej listy.
- Zależność od `bc_projects` (D9): zmiana kształtu `listProjects()` dotknie też tego kontekstu; zależność idzie tylko przez `services`.
- Wpis w `VAULT_FS_IMPORTERS` (D8) jest szerszy niż potrzeba (pozwala też na zapis); granicę pilnuje test statyczny z §7 pkt 8.
- Wikilinki w prawdziwych notatkach mogą mieć formę `[[<id>/<id>]]` (bez prefiksu `Projects/`): rozwiązuje je fallback z D5.
- Rozmiar `Knowledge/` rośnie: przy kilku tysiącach plików lista wymagałaby paginacji lub drzewa ładowanego leniwie (poza zakresem).
