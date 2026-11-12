# Etap 0c-2: tagi, szablony zadań, zasoby w vaulcie — projekt

Data: 2026-11-12
Status: projekt zatwierdzony w brainstormie; plan i implementacja jeszcze nie rozpoczęte
Nadrzędne specy: `2026-11-12-etap-0c-warstwa-plikowa-design.md` (§3.2, §3.3, §5, §7), `2026-11-12-etap-0-odpiecie-firebase-design.md` (§6), `2026-11-12-etap-0b-import-do-vaultu-design.md` (formaty plików)

Ten dokument jest publiczny (repo na GitHubie). Nie zawiera identyfikatorów projektu Firebase, kluczy ani danych użytkownika, i tak ma zostać.

## 1. Cel i zakres

Przepiąć trzy kolekcje, `tags` (`user_tags`), `task_templates` i `resources`, z Firestore na pliki YAML w vaulcie NEXUS. To pierwsze realne zapisy aplikacji do vaulta. Serwisy (`tagService`, `taskTemplateService`, `resourceService`), route handlery i UI działają bez zmian zachowania.

Poza zakresem: `tasks` i `calendar_events` (0c-3), `notes`, `documents`, `mindMaps`, `board`, `agent_log` (0c-4), usunięcie `userId` (0d), sanityzacja slugów (P3 z nadrzędnego specu; dotyczy `notes`/`documents`, więc 0c-4).

Stan wyjściowy (zweryfikowany): import 0b został wykonany na prawdziwym zrzucie (raporty `write`, liczności zgodne: tagi 8/8, szablony 1/1, zasoby 73/73, zadania 37/37, notatki 6/6). Pliki `Resources/tags.yaml`, `Resources/resources.yaml`, `Tasks/templates.yaml` istnieją w vaulcie, ale w momencie pisania speca są nieśledzone w gicie NEXUS.

## 2. Decyzje (brainstorm 2026-11-12)

| Id  | Decyzja                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Krok zerowy planu: commit zaimportowanych plików w repo NEXUS (robi człowiek lub agent poza aplikacją), żeby każdy zapis aplikacji był widoczny w `git diff` i odwracalny. Aplikacja nie zapisuje przed tym. |
| D2  | Ręczne zmiany w Obsidianie: nieznane klucze w rekordach i kolejność rekordów przeżywają zapis aplikacji, komentarze YAML giną. Bez edycji węzłów YAML Document API.                                          |
| D3  | Podejście A: wspólny `lib/nexus/yaml-store.ts` plus trzy cienkie repozytoria. Ten sam store posłuży w 0c-3 dla `Calendar/RRRR-MM.yaml`.                                                                      |
| D4  | Nieistniejące id: `update` rzuca `DomainError(404)`, `delete` jest idempotentny (bez zapisu pliku). Dziś Firestore rzuca na `update` surowy błąd; to świadoma zmiana na lepszą.                              |
| D5  | Czas jako tekst ISO w typach rekordów; `Timestamp` znika z `UserTagRecord`, `TaskTemplateRecord`, `NoteResourceRecord`.                                                                                      |

## 3. Architektura

### 3.1 Układ kodu

```
lib/nexus/
├ yaml-store.ts              nowy: odczyt i zmiana listy rekordów w pliku YAML
└ repos/
   ├ tags.ts                 nowy
   ├ taskTemplates.ts        nowy
   └ resources.ts            nowy
lib/firestore-db.ts          eksporty tych trzech grup wskazują na lib/nexus/repos/*
lib/firestore/{tags,taskTemplates,resources}.ts   usunięte
lib/firestore/collections.ts usunięte helpery userTagsCol, taskTemplatesCol, userResourcesCol
types/records.ts             pola czasu jako ISO (§3.4)
```

Nazwy i sygnatury funkcji w barrelu bez zmian (`getUserTags`, `createUserTag`, `updateUserTag`, `deleteUserTag`, `getTaskTemplates`, `createTaskTemplate`, `updateTaskTemplate`, `deleteTaskTemplate`, `addResourceToFirestore`, `getResourcesFromFirestore`, `deleteResourceFromFirestore`, `updateResourceInFirestore`). Serwisy się nie zmieniają. Konsumenci tagów poza serwisami (`planService.ts`, `calendarTools.ts`) idą przez `tagService`, więc też bez zmian.

### 3.2 `yaml-store.ts`

- `readList(rel, listKey): YamlRecord[]`: odczyt przez `readVaultFile`. Brak pliku, pusty tekst i tekst złożony z białych znaków dają `[]` bez wołania parsera (`YAML.parse("")` zwraca `null`, a `parseYamlList` odrzuca takie wejście). W pozostałych przypadkach `parseYamlList`.
- `updateList(rel, listKey, fn)`: `updateVaultFile` z `mutate`, które parsuje świeżą treść (jak wyżej), woła `fn(items)` i zwraca `formatYamlList(listKey, nowe, undefined)`. `fn` zwraca nową listę albo `null`, gdy nic się nie zmieniło; wtedy `mutate` zwraca bajtowo identyczną treść, a `updateList` pomija zapis (idempotentny `delete`). Wynik operacji (np. utworzony rekord) repozytorium przekazuje przez zmienną przypisywaną wewnątrz `fn`; przy ponowieniu `fn` wykonuje się od nowa na świeżej liście, więc wynik odpowiada zapisanej wersji.
- Nieznane klucze rekordów i kolejność rekordów zostają, bo `fn` operuje na obiektach z pliku (D2).
- Przepisany plik **nie** ma `generated_by` (nadrzędny spec 0c §7: ponowny import 0b zapisze wtedy obok zamiast nadpisać).
- Plik, który się nie parsuje, **nigdy nie jest nadpisywany**: błąd odczytu przerywa operację przed zapisem, a komunikat zawiera ścieżkę względną pliku.
- Brak `NEXUS_VAULT_PATH` to `VaultConfigError` z 0c-1 (status HTTP sprawdza plan na podstawie `handleServiceError`).

### 3.3 Repozytoria

Pliki: `Resources/tags.yaml` (klucz `tags`), `Tasks/templates.yaml` (klucz `templates`), `Resources/resources.yaml` (klucz `resources`). Formaty są te z 0b (`scripts/import-to-vault/plan.ts`: `TAG_KEYS`, `TEMPLATE_KEYS`, `RESOURCE_KEYS`).

Mapowanie plik ↔ typ aplikacji:

| Kolekcja         | Plik (snake_case)                                                                                         | Typ aplikacji                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `tags`           | `id`, `tag`, `title`, `color`, `created`                                                                  | `id`, `tag`, `title`, `color?`, `created_at?`                                                                             |
| `task_templates` | `id`, `label`, `title`, `link`, `created`                                                                 | `id`, `label`, `title`, `link`, `created_at?`                                                                             |
| `resources`      | `id`, `title`, `url`, `description`, `tags`, `favorite`, `thumbnail_url`, `note_id`, `created`, `updated` | `id`, `title`, `url`, `description`, `tags`, `isFavorite`, `thumbnailUrl?`, `noteId?`, `createdAt`, `updatedAt`, `userId` |

Reguły:

- `userId` nie jest zapisywane w pliku; repozytorium dopisuje przekazane `userId` przy odczycie (do 0d).
- Normalizacja jak w obecnych wersjach Firestore: usunięcie wiodącego `#` z tagu, `trim`, pusty kolor znaczy brak.
- Pola opcjonalne puste (`color`, `thumbnail_url`, `note_id`) są **usuwane z rekordu**, a nie zapisywane jako `null`. Dotyczy to też usunięcia koloru przez `updateUserTag(…, { color: null })`.
- `update*` zapisuje wyłącznie pola przekazane w żądaniu (nadrzędny spec 0c §3.2, „Realny zakres ochrony C5”) i nakłada je na rekord ze świeżej treści pliku. `updateResourceInFirestore` ustawia `updated` na bieżący czas ISO.
- Sortowanie przy odczycie, niezależnie od kolejności w pliku: tagi i szablony rosnąco po `created` (brak daty = 0), zasoby malejąco po `createdAt`; remisy po `id`.
- Nowe id: 20 znaków alfanumerycznych z `crypto` (kształt jak id z Firestore), sprawdzenie kolizji z listą w pliku, w ramach `fn`. Czas utworzenia: bieżący ISO.
- Domyślne wartości przy tworzeniu zasobu jak dziś: `tags: []`, `favorite: false`; `thumbnail_url` i `note_id` tylko gdy podane.
- `update`/`delete` po `id`: brak rekordu w `update` to `DomainError("<encja> not found", 404)` (D4); brak rekordu w `delete` nie zapisuje pliku.

### 3.4 Typy

W `types/records.ts`:

- `UserTagRecord` i `TaskTemplateRecord`: usunąć `createdAt?: Timestamp`; zostaje `created_at?: string`.
- `NoteResourceRecord`: `createdAt` i `updatedAt` z `Timestamp` na tekst ISO. Wprowadzenie ich jako opcjonalne albo wymagane ustala plan na podstawie testów komponentów (`ResourceListItem.test.tsx` przekazuje dziś `createdAt: null`).
- Typ `Timestamp` pozostaje w pliku dla pozostałych kolekcji do końca 0c-4. Zweryfikowane, że żaden komponent UI nie czyta `createdAt` tych trzech typów jako `Timestamp` (`TagsSection.tsx` używa `Omit<UserTagRecord, "createdAt">`), a `.toDate()`/`.toMillis()` występują tylko w usuwanych plikach `lib/firestore/*`.
- Skrypt `scripts/import-to-vault/` nie używa typów aplikacji (operuje na znacznikach ze zrzutu), więc zmiana typów go nie dotyka.

## 4. Testy

- **Repozytoria** na tymczasowym vaulcie (`mkdtemp`), `NEXUS_VAULT_PATH` ustawiany w teście, bez emulatora.
- **Zgodność z 0b:** fixture w formacie 0b (kilka rekordów wzorowanych na prawdziwych plikach, bez danych użytkownika) wczytuje się bez strat; nieznany klucz w rekordzie przeżywa zapis; po „pustej” aktualizacji rekordy są takie same, jedyna różnica w pliku to brak `generated_by`.
- **CRUD** dla każdej kolekcji. Brak pliku i pusty plik dają `[]`, pierwszy `create` zakłada plik.
- **Nieistniejące id:** `update` daje 404, `delete` nie zmienia pliku (ta sama wersja i treść).
- **Znaki specjalne** w tytułach i opisach (`&apos;`, dwukropek, cudzysłów, `#`, polskie litery) przechodzą round-trip; `favorite: false` i `tags: []` nie znikają; wartości YAML 1.1 w cudzysłowie (`"yes"`, `"no"`) zostają tekstem.
- **Usunięcie koloru** usuwa klucz z pliku (brak `color: null`).
- **Sortowanie:** zasoby malejąco, tagi i szablony rosnąco, niezależnie od kolejności w pliku.
- **Zmiana zewnętrzna** między odczytem a zapisem: `mutate` zadziała na świeżej treści i nie zgubi rekordu dodanego z zewnątrz; wyczerpanie ponowień daje `ConflictError` (409).
- **Plik niepoprawny** (zepsuty YAML) nie jest nadpisywany: operacja kończy się błędem, plik bajtowo bez zmian.
- **Testy usług** (`tagService`, `taskTemplateService`, `resourceService`) zostają; mockują `lib/firestore-db`, nie SDK.
- **Test statyczny:** w `lib/nexus/repos/` i `yaml-store.ts` brak importów `firebase*` i bezpośrednich modułów `fs`; zapisy tylko przez `vault-fs`.
- **Ręczny przegląd UI:** tagi, szablony zadań, zasoby (dodaj, edytuj, ulubione, usuń, odśwież stronę).

## 5. Kolejność w planie

1. Krok zerowy (człowiek): commit zaimportowanych plików w repo NEXUS (D1).
2. `yaml-store` z testami (TDD).
3. Repozytoria po kolei: tagi, szablony, zasoby; każde z testami.
4. Typy bez `Timestamp`, przestawienie barrela, usunięcie trzech plików i helperów `*Col`, poprawka `ResourceListItem.test.tsx`.
5. `tsc`, lint i vitest (przez pomocnika `cursor`). Review diffa przez `agy` opcjonalnie (nadrzędny spec 0c wymaga go po 0c-1 i 0c-3).
6. Ręczny przegląd UI.
7. Dokumentacja formatu, wyłączenie auto-deployu z Git na Vercelu **przed** mergem, PR (zwykły merge commit).

## 6. Kryteria ukończenia

- `tsc`, lint i testy przechodzą; test statyczny z §4 zielony.
- Ręczny przegląd UI bez regresji; dane z 0b widoczne w aplikacji (8 tagów, 1 szablon, 73 zasoby na obecnym vaulcie).
- Trzy pliki w `lib/firestore/` usunięte, helpery `*Col` usunięte z `collections.ts`.
- Format opisany w dokumentacji; commit(y) na osobnej gałęzi, PR do `main`.

## 7. Ryzyka

- **Zapis do jedynej kopii danych:** mitigacja kroku zerowego (D1) i zrzutu 0a. Po pierwszym zapisie aplikacji plik nie ma `generated_by`, więc ponowny import 0b go nie odtworzy, tylko zapisze obok.
- **Utrata komentarzy YAML przy zapisie:** zaakceptowana (D2).
- **Ręcznie wpisane `yes`/`no`/`on`/`off` bez cudzysłowu:** `parseYamlList` czyta jako YAML 1.2 (tekst), a `formatYamlList` zapisuje jako 1.1 (z cudzysłowami przy wartościach dwuznacznych). Zapis aplikacji jest bezpieczny; ryzyko dotyczy tylko ręcznego `favorite: yes`. Parsera z 0b nie zmieniamy; przypadek jest w testach.
- **Stan mieszany:** w trakcie 0c reszta kolekcji jest nadal na Firestore. Pierwszy merge 0c-2 wymaga `NEXUS_VAULT_PATH` na każdym uruchomieniu aplikacji i wyłączonego auto-deployu z Git na Vercelu (zob. nadrzędny spec 0c §7).
- **Podgląd PR na Vercelu** dla 0c-2 nie ma dostępu do vaulta, więc tagi, szablony i zasoby w nim nie zadziałają; to oczekiwane.
- **Usunięcie `chunks` i `addChunks`:** nie dotyczy 0c-2 (0c-4).

## 8. Otwarte pytania

- **P1.** Status HTTP dla `VaultConfigError` w `handleServiceError`: do sprawdzenia w planie. Jeśli zwraca 500 z ogólnym komunikatem, plan decyduje, czy dodać czytelniejszy komunikat.
- **P2.** `createdAt`/`updatedAt` w `NoteResourceRecord` jako opcjonalne czy wymagane: ustala plan po przejrzeniu testów komponentów.
