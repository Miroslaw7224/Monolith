# Etap 0c: warstwa plikowa `lib/nexus/` — projekt

Data: 2026-11-12
Status: projekt zatwierdzony w brainstormie; krok 0c-1 zaimplementowany i zmergowany do `main` (PR #8); krok 0c-2 ma osobny spec (`2026-11-12-etap-0c-2-tagi-szablony-zasoby-design.md`); plany 0c-3 i 0c-4 jeszcze nie napisane
Nadrzędne specy: `2026-11-11-asystent-lokalny-nexus-design.md` (§4.1–4.3), `2026-11-12-etap-0-odpiecie-firebase-design.md` (§6), `2026-11-12-etap-0b-import-do-vaultu-design.md` (formaty plików)

Ten dokument jest publiczny (repo na GitHubie). Nie zawiera identyfikatorów projektu Firebase, kluczy ani danych użytkownika, i tak ma zostać.

## 1. Cel i zakres

Dać każdej kolekcji, którą używa aplikacja, backend plikowy w vaulcie NEXUS, tak aby `services/`, route handlery i UI działały bez zmian zachowania. Firestore przestaje być czytany i zapisywany przez aplikację; jego dane zostają nietknięte do 0e.

Zasada nadrzędna etapu 0 się nie zmienia: Firestore i Vercel znikają z projektu. Dlatego **nie budujemy przełącznika backendów** i nie utrzymujemy testów kontraktowych na dwóch implementacjach.

W zakresie: wszystkie kolekcje z `lib/firestore/*` (`tags`, `task_templates`, `resources`, `tasks`, `calendar_events`, `notes`, `documents`, `mindMaps`, `board`, `agent_log`), domknięcie szwu, przejście edytora notatek na Markdown, usunięcie `chunks`.

Poza zakresem (kroki 0d–0f): usunięcie auth i `userId`, zmiana nazwy barrela, zabezpieczenie lokalnego serwera, usunięcie zależności `firebase*`, zdjęcie z Vercela.

## 2. Decyzje (brainstorm 2026-11-12)

| Id  | Decyzja                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Podmiana w miejscu, bez przełącznika. Po przepięciu kolekcji jej plik w `lib/firestore/` jest usuwany.                                                                               |
| C2  | `chunks` wypadają: martwy indeks, zapisywany, ale nigdzie nieczytany. Odtworzymy go, gdy wróci wyszukiwanie.                                                                         |
| C3  | `documents` dostają backend plikowy `Documents/<slug>.md` (konto prawdziwe nie ma danych, więc bez importu). Panel Zasobów i upload działają dalej.                                  |
| C4  | Edytor notatek (TipTap) przechodzi na Markdown. Z toolbara znikają kolor, krój czcionki, wyrównanie i podkreślenie. Oryginał HTML starych notatek zostaje w `Notes/.html/<id>.html`. |
| C5  | Konflikt zapisu: plik jest wczytywany ponownie i zmiana nakładana, jeśli ta sama linia/rekord nie zmienił się w międzyczasie. Jeśli zmienił się, zapis kończy się błędem 409.        |
| C6  | Podział na cztery podkroki 0c-1 … 0c-4, każdy z własnym planem, TDD i commitem (§5).                                                                                                 |

## 3. Architektura

### 3.1 Układ kodu

```
lib/nexus/
├ vault-path.ts     ścieżka vaulta z NEXUS_VAULT_PATH, mapowanie E:\ <-> /mnt/e/, błąd konfiguracji
├ vault-fs.ts       odczyt z metadanymi, zapis atomowy, kontrola konfliktu
├ markdown-edit.ts  punktowa zmiana jednej linii listy zadań po id (powstaje w 0c-3)
├ frontmatter.ts, task-line.ts, yaml-lists.ts   (istnieją z 0b)
└ repos/<kolekcja>.ts   implementacja funkcji z lib/firestore-db.ts dla danej kolekcji
```

- `lib/firestore-db.ts` zostaje barrelem z tymi samymi nazwami i sygnaturami funkcji. Eksporty kolejnych kolekcji przestawiamy z `lib/firestore/*` na `lib/nexus/repos/*`. Nazwę barrela i parametr `userId` zmienia dopiero 0d.
- W trakcie 0c aplikacja działa „mieszanie”: część kolekcji na plikach, część jeszcze na Firestore. Kolejność podmiany (§5) ogranicza stany mieszane do odczytów: np. w 0c-2 `planService` czyta tagi z plików i wydarzenia kalendarza jeszcze z Firestore, a w 0c-3 przechodzi na API `calendarService`.
- Brak `NEXUS_VAULT_PATH` jest błędem konfiguracji dla kolekcji przepiętych na pliki (nadrzędny spec §4.2).

### 3.2 Zasady zapisu

- **Zapis atomowy** (plik tymczasowy i `rename`) przez jedną funkcję `vault-fs`. Odmowa zapisu poza `Vault/`; ścieżki są normalizowane i sprawdzane po rozwiązaniu dowiązań.
- **Kontrola konfliktu** przy zapisie: porównanie rozmiaru i skrótu treści (SHA-256) z ostatniego odczytu. `mtime` nie bierze udziału, bo jego rozdzielczość na dysku Windows przez WSL (`/mnt/e/`) bywa zbyt gruba, a skrót rozstrzyga sam.
- **Końce linii.** Odczyt normalizuje `\r\n` do `\n` przed parsowaniem i liczeniem skrótu (Obsidian na Windowsie może zapisać CRLF); zapis używa `\n`.
- **Brak blokady w procesie.** Odczyt, zmiana i zapis w `updateVaultFile` są synchroniczne, więc w jednym procesie Node nic się nie przeplata, a blokada per plik niczego by nie chroniła (wykazała to recenzja kodu 0c-1). Ochroną przed procesami zewnętrznymi jest kontrola wersji i ponawianie. Gdyby `mutate` musiało kiedyś być asynchroniczne, blokadę dodajemy wtedy, razem z testem, który faktycznie ją wymusza.
- **Reguła nakładania (C5).** Przy niezgodności kontroli: wczytaj plik ponownie, zastosuj zmianę do świeżej treści. Zadania: gdy linia o danym `id` jest bajtowo taka sama jak w odczycie początkowym, zapis przechodzi; w przeciwnym razie `ConflictError` (podklasa `DomainError` z `statusCode: 409` w `lib/errors.ts`; `handleServiceError` w `lib/apiError.ts` zwraca status z `DomainError`, a `inferHttpStatus` nie jest tu używany). Pliki YAML i notatki: ta sama reguła na poziomie rekordu (wpis o danym `id`) lub całego pliku notatki.
- **Realny zakres ochrony C5.** UI nie przekazuje wersji (ETag), więc C5 chroni tylko okno odczyt-zmiana-zapis pojedynczego żądania. Zmiana zrobiona w Obsidianie przed żądaniem jest stanem początkowym i nie jest wykrywana jako konflikt. Dlatego aktualizacje zapisują wyłącznie pola przekazane w żądaniu (zadania: tylko zmienione pola inline w linii), a nie cały rekord z klienta.
- **Dopisywanie.** `vault-fs` dostanie w 0c-4 osobną operację `append` dla logów (`Sessions/*.jsonl`): `O_APPEND` bez przepisywania pliku, bez `rename`. Atomowość pojedynczej linii zapewnia jeden `write` z końcem linii.
- **Czas** to tekst ISO w plikach i w typach. Typ `Timestamp` znika z `types/records.ts`.

### 3.3 Formaty per kolekcja

| Kolekcja          | Plik                       | Zapis                                                                                                                                                                                                                |
| ----------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tasks`           | `Tasks/tasks.md`           | punktowo po `id`; `reorderTasks` zmienia tylko pole `order` linii z podanych `id` (reszta pliku bez zmian, w tym zadania dopisane w Obsidianie), jednym zapisem atomowym                                             |
| `task_templates`  | `Tasks/templates.yaml`     | rekord YAML po `id`, plik przepisywany w całości z kontrolą konfliktu                                                                                                                                                |
| `tags`            | `Resources/tags.yaml`      | jak wyżej                                                                                                                                                                                                            |
| `resources`       | `Resources/resources.yaml` | jak wyżej                                                                                                                                                                                                            |
| `calendar_events` | `Calendar/RRRR-MM.yaml`    | miesiąc wg daty początku wydarzenia; zmiana daty przenosi rekord między plikami; `updateCalendarEvent`, `deleteCalendarEvent` i odczyt bez zakresu dat (`calendarTools`) wymagają skanu wszystkich `Calendar/*.yaml` |
| `notes`           | `Notes/<slug>.md`          | wyszukiwanie po `id` we frontmatterze (skan katalogu); slug stały po utworzeniu; kolizja slugu daje sufiks                                                                                                           |
| `documents`       | `Documents/<slug>.md`      | frontmatter `id`, `name`, `type`, `created`; treść jako Markdown/tekst                                                                                                                                               |
| `mindMaps`        | `MindMaps/<id>.json`       | plik per mapa                                                                                                                                                                                                        |
| `board`           | `Board/board.json`         | jeden plik                                                                                                                                                                                                           |
| `agent_log`       | `Sessions/RRRR-MM.jsonl`   | tylko dopisywanie; jedna linia = jeden wpis                                                                                                                                                                          |

Formaty `tasks`, `task_templates`, `tags`, `resources` i `notes` są te z 0b (jedno źródło parserów w `lib/nexus/`). Pola `resources` w YAML są w snake_case (`favorite`, `thumbnail_url`), a rekordy aplikacji w camelCase; `repos/resources.ts` mapuje w obie strony. Kolekcje, których 0b nie zapisuje, dostają formaty z tabeli powyżej; ich opis trafia do dokumentacji po wdrożeniu danego podkroku.

## 4. Testy

- **Repozytoria** na tymczasowym vaulcie (`mkdtemp`), bez emulatora i Dockera. Wspólny zestaw przypadków: CRUD, kolejność, pola puste, znaki specjalne w tytułach (ucieczki z `task-line.ts`).
- **Zgodność z 0b w obie strony:** fixture w formatach z 0b wczytuje się bez strat; to, co zapisze repozytorium, odczytuje ten sam parser.
- **Konflikty:** zmiana innej linii w międzyczasie (nałożenie), zmiana tej samej linii (409), dwa równoległe zapisy do jednego pliku (brak utraconych aktualizacji), zapis przerwany przed `rename` (plik docelowy bez zmian).
- **Testy usług** zostają; `mindMapService` i `boardService` mockują `firestore-db` zamiast SDK `firebase-admin`.
- **Testy statyczne** jak w 0b: w `lib/nexus/` brak importów `firebase*`; każda ścieżka zapisu przechodzi przez `vault-fs`; nic nie zapisuje poza `Vault/`.
- **Ręczny przegląd w UI** po każdej przepiętej kolekcji.

## 5. Podział na podkroki

| Krok | Treść                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Uwagi                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 0c-1 | Fundament: `vault-path`, `vault-fs` (bez `append`), `ConflictError`; domknięcie szwu (funkcje repozytoryjne w barrelu odpowiadające dzisiejszym operacjom serwisów: `getMindMaps`, `getMindMap`, `createMindMap`, `saveMindMap`, `deleteMindMap`, `getBoard`, `saveBoard`; sygnatury wyprowadzone z `services/mindMapService.ts` i `services/boardService.ts`; `serverTimestamp()` przeniesione za barrel); czas jako ISO w typie `MindMap` (pozostałe kolekcje zmieniają typy czasu przy własnym przepięciu, `Timestamp` znika z `types/records.ts` po 0c-4); przepisanie testów `mindMapService` i `boardService` | zachowanie bez zmian; nadal Firestore                                              |
| 0c-2 | `tags`, `task_templates`, `resources`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | pierwsze realne zapisy do vaulta przez aplikację; dane z 0b muszą być już wczytane |
| 0c-3 | `tasks` + `calendar_events`; `planService` przez API `calendarService` (wraz z aktualizacją mocków w `tests/unit/services/planService.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | razem, bo `calendarService` czyta zadania                                          |
| 0c-4 | `notes` (+ edytor na Markdown), `documents`, `mindMaps`, `board`, `agent_log`; usunięcie `chunks` (w tym wywołania `addChunks` w `services/documentService.ts` i zapisy w `lib/firestore/notes.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                 | kolekcje bez migrowanych danych startują puste                                     |

0c-4 jest największym podkrokiem; plan może go rozbić na 0c-4a (repozytoria backendowe) i 0c-4b (edytor notatek na Markdown), jeśli przekroczy rozmiar jednego PR-a.

Niezależny review diffa przez pomocnika po 0c-1 i 0c-3 (logika zapisu). Przed uruchomieniem 0c-2 import 0b musi być wykonany na prawdziwym zrzucie (wykonany 2026-11-12, liczności zgodne).

## 6. Kryteria ukończenia podkroku

- `tsc`, lint i testy przechodzą; testy statyczne z §4 zielone.
- Ręczny przegląd przepiętej kolekcji w UI bez regresji.
- Przepięta kolekcja nie ma już pliku w `lib/firestore/`.
- Nowy lub zmieniony format jest opisany w dokumentacji.
- Commit(y) na osobnej gałęzi i PR do `main`.

## 7. Ryzyka

- **Rozdzielczość `mtime` na `/mnt/e/`:** mitigacja skrótem treści (§3.2).
- **`reorderTasks`:** wiele linii naraz; jeden zapis atomowy, ale zmieniane jest tylko pole `order` linii z podanych `id`, więc zadania spoza listy nie giną (jak w wersji Firestore, która aktualizuje tylko wskazane dokumenty).
- **Stan mieszany w trakcie 0c:** `tasks` i `calendar_events` idą razem (0c-3); pozostałe stany mieszane (np. `planService` w 0c-2: tagi z plików, kalendarz z Firestore) dotyczą tylko odczytu i znikają w 0c-3.
- **Ponowny import po 0c:** plik przepisany przez aplikację nie ma `generated_by: import-to-vault`, więc 0b zapisze obok zamiast nadpisać. Import na prawdziwym zrzucie robimy przed 0c-2.
- **Strata formatowania notatek (C4):** oryginał HTML starych notatek zostaje w `Notes/.html/`, a 0c-4 nie usuwa tego katalogu.
- **Auto-deploy na Vercelu:** 0c-1 nie zmienia backendu, ale już 0c-2 wymaga vaulta. Przed mergem 0c-2 wyłączyć auto-deploy z Git (odwracalne); projekt Vercel usuwa dopiero 0e.
- **Kolizje slugów notatek i dokumentów:** sufiks, `id` stabilny.
- **Skan katalogu `Notes/` przy każdym wyszukaniu po `id`:** akceptowalne przy obecnej liczbie notatek; indeks w pamięci dopiero, gdy pomiar pokaże potrzebę.

## 8. Otwarte pytania

- **P1.** Dokładny schemat `Calendar/RRRR-MM.yaml` (wydarzenia wielodniowe przechodzące przez granicę miesiąca): do ustalenia w planie 0c-3.
- **P2.** Zakres zmian w toolbarze edytora (które przyciski zostają): do ustalenia w planie 0c-4.
- **P3.** Sanityzacja slugów notatek i dokumentów (0c-4): `vault-fs` odrzuca `..` i ścieżki bezwzględne, ale ukośnik wsteczny w nazwie na Linuksie tworzy plik z dosłownym `\\` w nazwie, więc generator slugów musi go usuwać.
