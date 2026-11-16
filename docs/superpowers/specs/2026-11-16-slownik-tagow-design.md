# Słownik tagów: jeden słownik dla kalendarza i zasobów — projekt

Data: 2026-11-16
Status: projekt zatwierdzony w rozmowie (sekcje 1–3), do przeglądu przed planem
Powiązane: `2026-11-14-karta-arsenal-design.md` (§5, słownik tagów odłożony), `docs/nexus-vault-formaty-yaml.md`

Dokument jest publiczny (repo na GitHubie). Nie zawiera danych z etatu ani identyfikatorów kont.

## 1. Cel i stan wyjściowy

Dziś są dwa rozłączne światy tagów:

- `Resources/tags.yaml` (8 rekordów: `id`, `tag`, `title`, `color`, `created`) obsługuje `bc_tags`, a czyta go tylko kalendarz (`CalendarView.tsx`). Żaden z 8 tagów nie występuje w danych.
- Wydarzenia (`Calendar/*.yaml`) i zasoby (`Resources/resources.yaml`) trzymają `tags` jako listę **nazw**, bez weryfikacji ze słownikiem. Kalendarz używa dwóch tagów (`Career Guide` ×7, `Crait` ×7, ten drugi bez wpisu w słowniku). Zasoby mają 24 własne tagi (144 przypisania na 74 rekordach), z których 23 nie ma w słowniku.
- Zasoby scalają warianty zaszytą mapą `TAG_MERGE_MAP` (`contexts/bc_resources/models.ts`, 4 wpisy), niezwiązaną ze słownikiem.
- Kolizje nazw: `Agent AI` (4 zasoby) i `Agenci AI` (słownik), `Projekty` (3 zasoby) i `Praca własna` (słownik, tytuł „Moje projekty”).

Cel: jeden słownik, w którym tag znaczy to samo na wydarzeniu i na zasobie, bez zmiany formatu `tags: string[]` w plikach danych.

## 2. Podjęte decyzje

| #   | Decyzja            | Wybór                                                                                                                                                                                                                                                       |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Pojęcie tagu       | Jedno: ten sam tag na wydarzeniu i na zasobie. Bez pól `kind` i `scope` (brak dowodu na ból; wrócimy, jeśli podpowiedzi w kalendarzu zaczną przeszkadzać)                                                                                                   |
| T2  | Charakter słownika | Podpowiada, nie wymusza. Nowy tag można wpisać dowolnie i dopisuje się do słownika automatycznie (bez koloru). Synonimy zastępują zaszyty `TAG_MERGE_MAP`                                                                                                   |
| T3  | Migracja           | Jednorazowa, wykonana przez agenta jako osobne zadanie z kontrolą `git diff` w repo NEXUS, po wdrożeniu kodu. Bez kodu migracyjnego w aplikacji                                                                                                             |
| T4  | Kolizje nazw       | `Agent AI` → `Agenci AI`; `Projekty` i `moje projekty` → `Praca własna`; `kurs`, `kursy`, `nauka` → `Learning` (dotychczasowa mapa zasobów); rekord `Kursy` ze słownika scalony w `Learning` (jego kolor przechodzi na `Learning`, `Kursy` zostaje aliasem) |
| T5  | Kolory             | Opcjonalne i tylko w słowniku. Tagi dopisane z zasobów bez koloru, w UI neutralne. Kolor wydarzenia zostaje osobnym polem wydarzenia                                                                                                                        |
| T6  | Edycja synonimów   | Tylko poza UI (agent lub ręcznie w `tags.yaml`). Sekcja Tagi aliasy pokazuje, ale ich nie edytuje                                                                                                                                                           |

## 3. Dane (`Resources/tags.yaml`)

Rekord słownika dostaje jedno nowe pole opcjonalne `aliases: string[]` (synonimy; porównanie bez względu na wielkość liter). Brak pola znaczy brak synonimów, więc starsze pliki działają bez zmian. Pozostałe pola bez zmian. Klucz `aliases` jest pomijany, gdy lista jest pusta (nigdy `null`).

Pliki danych (`Calendar/*.yaml`, `Resources/resources.yaml`) nie zmieniają formatu: `tags` to dalej lista nazw kanonicznych. Zapis zostaje w `Resources/`; nic z `Work/` ani z `owner: work`, więc nie ma osobnej decyzji o prywatności.

## 4. Kod

Kontekst `bc_tags` (pięć plików wg ADR-021) i dwaj klienci:

- **`bc_tags/models.ts`, `schemas.ts`, `repositories.ts`:** `aliases` w modelu, DTO i mapowaniu plik ↔ model (normalizacja: przycięcie, bez pustych, bez duplikatów, bez nazwy kanonicznej).
- **`bc_tags/services.ts`:** nowa funkcja `resolveTags(names: readonly string[]): Promise<string[]>`:
  1. przycina nazwy i pomija puste;
  2. szuka tagu po nazwie kanonicznej lub aliasie, bez względu na wielkość liter, i zamienia na nazwę kanoniczną;
  3. usuwa duplikaty z zachowaniem kolejności pierwszego wystąpienia;
  4. każdy nieznany tag dopisuje do słownika (`title` = nazwa, bez koloru) i zwraca jego nazwę bez zmian.
- **`bc_resources/services.ts`:** `normalizeTags` woła `bc_tags/services.resolveTags` zamiast `TAG_MERGE_MAP`. Mapa jest usuwana z `models.ts`, a jej wpisy trafiają do `aliases` w migracji.
- **`bc_calendar/services.ts`:** tworzenie i edycja wydarzenia przechodzą przez `resolveTags`.
- **UI:** kalendarz już podpowiada tagi ze słownika. Pola tagów w formularzach zasobów (`ResourceAddForm`, `ResourceEditModal`) to zwykły tekst rozdzielany przecinkami, więc podpowiedzi w nich są poza zakresem (synonimy i tak scala serwer). Sekcja Tagi (`TagsSection`) pokazuje aliasy tylko do odczytu. Znak `#` na początku nazwy jest przy dopasowaniu pomijany (jak w `bc_tags`).

Zgodność z architekturą: wołanie `services` innego kontekstu jest dozwolone, UI importuje tylko `schemas`, test architektury nie jest zmieniany. Błąd zapisu słownika przerywa cały zapis (ten sam kod błędu co dziś, 409 po wyczerpaniu ponowień), bo zapis wydarzenia lub zasobu z niedopisanym tagiem zostawiłby niespójny stan.

## 5. Migracja danych (po wdrożeniu kodu)

Osobne zadanie agenta w repo NEXUS, z kontrolą `git diff`, zgodnie z `docs/nexus-vault-formaty-yaml.md`:

1. Dopisać do `Resources/tags.yaml` wszystkie tagi użyte w zasobach oraz `Crait`.
2. Scalić: `Agent AI` → `Agenci AI` (4 zasoby); `Projekty` → `Praca własna` (3 zasoby); `kurs`, `kursy`, `nauka` → `Learning`.
3. Uzupełnić `aliases` zgodnie z punktem 2 (`Agenci AI`: `Agent AI`; `Praca własna`: `Projekty`, `moje projekty`; `Learning`: `Kursy`, `kurs`, `nauka`; rekord `Kursy` usunięty, kolor `#00ffee` przejęty przez `Learning`).
4. Tytuł tagu `Career Guide` („QA Tester”) pozostaje bez zmian.
5. Zaktualizować opis formatu w `docs/nexus-vault-formaty-yaml.md` (pole `aliases`, zasada „nowy tag dopisuje się sam”).

## 6. Testy

Vitest, `tests/unit/` (konkretne przypadki):

- `resolveTags(["agent ai"])` przy aliasie `Agent AI` dla `Agenci AI` zwraca `["Agenci AI"]`;
- `resolveTags(["AI", "ai", " AI "])` zwraca `["AI"]` (jedno wystąpienie);
- nieznany tag (`Nowy`) trafia do słownika raz, bez `color`, z `title` = `Nowy`; drugie wywołanie nie tworzy duplikatu;
- puste i białe nazwy są pomijane;
- ten sam wejściowy tag daje ten sam wynik dla zasobu i wydarzenia;
- `tags.yaml` bez `aliases` jest czytany jak dotąd, a zapis rekordu bez aliasów nie dodaje klucza;
- alias identyczny z nazwą kanoniczną lub zduplikowany jest przy odczycie odfiltrowany.

## 7. Poza zakresem i ryzyka

**Poza zakresem:** podpowiedzi tagów w formularzach zasobów, pola `kind` i `scope`, edycja aliasów w UI, wymuszanie słownika (walidacja odrzucająca nieznane tagi), kolor wydarzenia wynikający z tagu, kolory dla tagów z zasobów.

**Ryzyko przyjęte świadomie (wyścig):** dwa równoległe żądania z tym samym nowym tagiem mogą dopisać go do słownika dwa razy (`createUserTag` nie sprawdza unikalności); vault jest jednoużytkownikowy, a odczyt słownika przy duplikacie wybiera pierwszy wpis, więc skutek jest kosmetyczny.

**Ryzyko przyjęte świadomie:** po migracji podpowiedzi tagów w kalendarzu pokażą ponad 25 tagów, w tym tematyczne (`Backend`, `RAG`). Jeśli to zacznie przeszkadzać, dodamy filtr w UI albo `scope`; do tego czasu bez rozbudowy.
