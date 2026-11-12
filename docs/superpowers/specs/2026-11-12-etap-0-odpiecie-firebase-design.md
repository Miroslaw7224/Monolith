# Etap 0: odpięcie Firebase i Vercela — projekt

Data: 2026-11-12
Status: krok 0a zaimplementowany i uruchomiony na produkcji (tylko odczyt), krok 0b zmergowany do `main` (PR #7) i uruchomiony na prawdziwym zrzucie (2026-11-12, liczności zgodne), krok 0c zaprojektowany (`2026-11-12-etap-0c-warstwa-plikowa-design.md`, cztery podkroki 0c-1…0c-4; 0c-1 zmergowany, PR #8; 0c-2 ma spec `2026-11-12-etap-0c-2-tagi-szablony-zasoby-design.md`), krok 0d podzielony na 0d-1 (zabezpieczenie lokalne, serwer bez auth i `userId`; plan `2026-11-12-etap-0d-1-lokalny-serwer-bez-auth-i-userid.md`, zaimplementowany) i 0d-2 (klient, waitlista, `firebase`, e2e, dokumentacja), kroki 0e–0f w planowaniu. Zakres migracji danych zawężony decyzją użytkownika (§1.1); moduły aplikacji zostają.
Nadrzędny spec: `2026-11-11-asystent-lokalny-nexus-design.md` (decyzje D1–D8, §7 etap 0)

Ten dokument jest publiczny (repo na GitHubie). Nie zawiera identyfikatorów projektu Firebase, kluczy ani danych użytkownika, i tak ma zostać.

## 1. Cel i zakres

Przenieść dane aplikacji z Firestore do plików vaulta NEXUS, a potem usunąć Firebase (Firestore, Auth) i hosting na Vercelu. Zasada nadrzędna: **żadne usunięcie nie następuje przed zweryfikowanym eksportem**, a Firestore pozostaje nietknięty (tylko odczyt) aż do końca weryfikacji.

W zakresie: eksport, konwersja do plików, warstwa plikowa `lib/nexus/` pod `services/`, usunięcie auth/waitlisty/stron prawnych/zależności, zabezpieczenie lokalnego serwera, zdjęcie z Vercela, wygaszenie projektu Firebase.

Poza zakresem: nowe moduły (karta projektu, kokpit, arsenał, mapa), zmiana nazwy na Monolith (D8), serwer MCP, indeks z watcherem.

### 1.1 Zakres danych (decyzja użytkownika, 2026-11-12)

- **Migrujemy:** `notes`, `tasks`, `resources`, `user_tags`, `task_templates` jednego użytkownika, czyli jedynego prawdziwego konta. Dwa pozostałe konta z danymi są testowe i są pomijane, razem z kolekcją `waitlist` i metadanymi kont Auth innych użytkowników.
- **Nie migrujemy i nie ma ich w zawężonym zrzucie:** `calendar_events`, `mindMaps`, `board`, `documents` (konto prawdziwe nie ma tej kolekcji), `chunks`, `agent_log` oraz historyczne `knowledgeNodes` i `knowledgeEdges`. Widok „Moja praca” (`ActivityLog`) nie jest osobną kolekcją, tylko widokiem na zadaniach i kalendarzu.
- **Skutek:** to wyłącznie decyzja o danych, nie o funkcjach. Kalendarz, mapy myśli, „Moja praca”, planowanie, tablica i asystent AI **zostają w aplikacji** i działają dalej; po odpięciu Firebase dostają backend plikowy i startują puste, bez starych danych. Założenia aplikacji pozostają aktualne (O7 rozstrzygnięte).
- **Szerszy zrzut:** pełniejszy zrzut konta (z kalendarzem i mapami myśli) istnieje lokalnie poza repozytoriami i na wniosek użytkownika zostaje, jako archiwum. Nie jest wejściem do żadnego kroku. Po 0e będzie jedyną kopią tych danych, więc jego usunięcie wymaga osobnej, świadomej decyzji.

## 2. Stan wyjściowy (zweryfikowany w kodzie)

- Dane użytkownika leżą w `users/{uid}/…`, kolekcje (`lib/firestore/collections.ts`): `documents`, `notes`, `mindMaps`, `board/main`, `resources`, `chunks`, `calendar_events`, `tasks`, `user_tags`, `task_templates`, `agent_log`.
- Poza `users/` jest kolekcja główna `waitlist` (używana w bramce dostępu `lib/getAuth.ts`).
- Na produkcji istnieją dane historycznych kolekcji `knowledgeNodes` i `knowledgeEdges` (pozostałość po usuniętym module Wiedza/RAG z maja 2026; nic w aplikacji ich nie czyta, a `scripts/cleanup-knowledge-collections.ts` nigdy nie został uruchomiony na produkcji). Eksport nie może zakładać, że lista kolekcji jest kompletna (patrz 4.3).
- Produkcyjny Firestore ma trzy konta z danymi (jedno prawdziwe, dwa testowe) jako dokumenty-widma pod `users/<uid>`; dokument `users/<uid>` istnieje tylko dla innego konta, bez danych. W Auth są cztery konta (rozstrzygnięcie O6).
- `lib/firestore-db.ts` jest barrelem eksportującym całe API danych. To naturalny szew do podmiany backendu.
- Rekordy mają pola czasu w dwóch formach: tekst (`created_at`) i `Timestamp` (`createdAt`). Eksport musi zachować oba.
- `firestore.rules` zabrania odczytu `agent_log` z klienta (tylko Admin SDK).
- Hosting: `.vercel/` w repo, brak `vercel.json`.

## 3. Podział na kroki

Każdy krok kończy się commitem, działającą aplikacją i bramką weryfikacji. Kolejność jest obowiązkowa.

| Krok | Treść                                                                                  | Zmienia aplikację? | Zmienia Firestore?                   |
| ---- | -------------------------------------------------------------------------------------- | ------------------ | ------------------------------------ |
| 0a   | Skrypt eksportu i weryfikacji (tylko odczyt)                                           | nie                | nie                                  |
| 0b   | Konwersja eksportu do plików vaulta                                                    | nie                | nie                                  |
| 0c   | Warstwa `lib/nexus/` podmieniana kolekcja po kolekcji                                  | tak                | nie                                  |
| 0d   | Usunięcie auth, waitlisty, stron prawnych, zależności Firebase; zabezpieczenie lokalne | tak                | nie                                  |
| 0e   | Zdjęcie z Vercela, wygaszenie projektu Firebase                                        | nie                | tak (usunięcie), po okresie karencji |
| 0f   | `Vault/Work/` w `.gitignore` NEXUS i kontrola `git check-ignore`                       | w NEXUS            | nie                                  |

Stan: 0a jest wykonane. Zrzut zawężony do zakresu z 1.1 powstał, przeszedł `--verify` i ma zgodne liczności przed, w pliku i po. Krok 0b jest zmergowany do `main` (PR #7) i uruchomiony na prawdziwym zrzucie (liczności zgodne). Krok 0c ma zatwierdzony projekt w osobnym specu (podział na 0c-1…0c-4); 0c-1 jest zmergowany (PR #8), 0c-2 ma spec, reszta bez implementacji. Kroki 0d–0f bez zmian.

0f jest niezależny i może wejść w dowolnym momencie przed pierwszym zapisem danych etatu. Zmianę `.gitignore` w repo NEXUS robi człowiek lub agent poza aplikacją (aplikacja zapisuje tylko w `Vault/`).

## 4. Krok 0a: eksport Firestore

### 4.1 Zasady

- **Tylko odczyt.** Skrypt nie wywołuje `set`, `update`, `delete`, `add`, `batch`. Test sprawdza to statycznie (brak tych wywołań w pliku skryptu).
- **Pełna wierność.** Zapisujemy dokument takim, jaki jest, bez konwersji formatu. Konwersja do vaulta to krok 0b na kopii.
- **Miejsce wyjścia poza repo i poza vaultem**, domyślnie `~/backups/second-brain-firestore/<RRRR-MM-DDTGGMM>/`. Powód: oba repo są śledzone przez git, a zrzut zawiera pełną treść notatek i dokumentów. Skrypt odmawia zapisu, jeśli katalog docelowy leży w drzewie roboczym gita (`git rev-parse --is-inside-work-tree`). Katalog 0700, pliki 0600.
- **Zakres na życzenie.** `--uid` ogranicza zrzut do jednego konta (`users/<uid>/…`, bez kolekcji głównych i innych kont, a Auth pobiera przez `getUser` tylko to konto), `--only` do kolekcji o podanych nazwach (pominięte nie są pobierane, liczone ani sprawdzane przez `--verify`; skrypt nie schodzi w ich podkolekcje). Zakres trafia do manifestu.
- **Brak zapisów w trakcie.** Aplikacja nie pisze do Firestore w czasie eksportu (jedyny użytkownik, zatrzymać serwer). Skrypt sprawdza spójność drugim przebiegiem liczenia (4.4).

### 4.2 Format wyjścia

```
<katalog>/
├ manifest.json
├ users/<uid>/<kolekcja>.jsonl      jedna linia = jeden dokument {"_id","_path","data":{…}}
├ root/<ścieżka kolekcji>.jsonl     kolekcje główne i zagnieżdżone poza users/<uid> (np. root/users.jsonl, root/waitlist.jsonl)
└ auth-users.json                   uid, e-mail, daty (bez haszy haseł i tokenów)
```

- Typy Firestore są kodowane znacznikami, aby dało się je odtworzyć bez strat: `Timestamp` jako `{"__type":"timestamp","iso":"…","seconds":N,"nanos":N}`, `GeoPoint`, `DocumentReference` (jako ścieżka), `Bytes` (base64). Liczby całkowite i zmiennoprzecinkowe zostają liczbami JSON.
- Podkolekcje dokumentów (np. pod `board/main`) są eksportowane rekurencyjnie, ścieżka dokumentu jest w `_path`.
- `manifest.json`: czas eksportu, `uid` i `only` (zakres, albo `null`), rozmiar strony, status (`ok`, `mismatch`, `needs-review`), liczność per kolekcja (przed, linie w pliku, po), SHA-256 każdego pliku, znacznik kolekcji nieznanych, lista dokumentów-widm, wynik eksportu Auth i sumy.
- Eksport kont Auth zawiera uid, e-mail, daty i dostawców logowania; nie zawiera haszy ani tokenów. Błąd Auth nie przerywa eksportu danych (zapisuje się w manifeście).

### 4.3 Wykrywanie kolekcji

Skrypt nie ma na sztywno listy kolekcji. Wywołuje `listCollections()` na korzeniu i na każdym dokumencie `users/{uid}` (oraz rekurencyjnie na dokumentach podkolekcji). Kolekcje spoza znanego zbioru (`documents`, `notes`, `mindMaps`, `board`, `resources`, `chunks`, `calendar_events`, `tasks`, `user_tags`, `task_templates`, `agent_log`, `waitlist`) też są eksportowane i wypisane w raporcie jako **nieznane**. Nieznana kolekcja z danymi wstrzymuje przejście do 0b do decyzji użytkownika. Kolekcje oznaczone przez użytkownika jako **historyczne** (`knowledgeNodes`, `knowledgeEdges`, `HISTORICAL_COLLECTIONS`) są traktowane jak znane: eksportowane wiernie, ale bez wstrzymania i bez migracji.

Dokumenty „widmo” (brak dokumentu `users/{uid}`, ale istnieją podkolekcje) są wykrywane tą samą drogą, bo `listCollections()` na referencji działa bez istnienia dokumentu. W przeciwieństwie do `.get()` na kolekcji `users`, która ich nie zwróci, dlatego uid-y zbieramy też z `listDocuments()`.

### 4.4 Liczenie przed i po

1. **Przed:** `count()` (zapytanie agregujące, tanie w odczytach) dla każdej kolekcji, osobno dla każdej ścieżki `users/<uid>/<kolekcja>` i dla każdej wykrytej podkolekcji. `count()` liczy tylko dokumenty bezpośrednio w danej kolekcji, więc podkolekcje muszą mieć własne wpisy w bilansie.
2. Odczyt stronami po 500, `orderBy(FieldPath.documentId())` z `startAfter`, dopisywanie do pliku tymczasowego `.jsonl.part`, po zakończeniu kolekcji `rename` na `.jsonl`.
3. **Po:** liczba linii w każdym pliku i ponowne `count()` z Firestore.
4. Wynik zgodny, gdy `przed == linie == po` dla każdej kolekcji. Każda różnica kończy skrypt kodem ≠ 0 i nie zapisuje `manifest.json` ze statusem `ok`.

### 4.5 Polecenia

```
npx tsx scripts/export-firestore.ts --count-only            # tylko liczność i wykryte kolekcje, zero plików
npx tsx scripts/export-firestore.ts [--out <katalog>]       # pełny eksport
npx tsx scripts/export-firestore.ts --verify <katalog>      # niezależna weryfikacja istniejącego zrzutu
# opcje eksportu: --resume (z --out), --skip-auth, --page-size N,
#   --uid <uid>               tylko jedno konto
#   --only notes,tasks,...    tylko kolekcje o tych nazwach
```

Zrzut zgodny z zakresem 1.1: `--uid <uid prawdziwego konta> --only notes,tasks,resources,user_tags,task_templates`.

`--verify` czyta zrzut z dysku, przelicza SHA-256 i linie, porównuje z manifestem oraz z bieżącym `count()` Firestore, w zakresie zapisanym w manifeście (`uid`, `only`). Status liczy od nowa z bieżącej listy znanych i historycznych kolekcji, a nie z wartości zapisanej w manifeście. Uruchamiany tuż przed krokiem 0e, aby wykryć dane zapisane po eksporcie.

Poświadczenia jak w aplikacji (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` lub `GOOGLE_APPLICATION_CREDENTIALS`). Wsparcie emulatora (`FIRESTORE_EMULATOR_HOST`) działa tą samą ścieżką `getFirestore()`.

### 4.6 Koszt odczytów

Darmowy limit Firestore to 50 tys. odczytów dziennie. `--count-only` pokazuje, ile dokumentów jest do przeczytania; skrypt ostrzega, gdy suma przekracza 40 tys., i pozwala wznowić eksport następnego dnia (`--resume`: wznawia od ostatniego przeczytanego id; gotowe kolekcje są pomijane, a niedokończony plik `.part` jest odcinany do ostatniej pełnej linii, żeby nie powstały duplikaty). Kolekcja `chunks` (indeks pod wyszukiwanie) jest zwykle największa.

### 4.7 Testy

- Test na emulatorze Firestore (ADR-016, docker): zasiać dane (w tym `Timestamp`, zagnieżdżone tablice, dokument widmo, nieznaną kolekcję), wyeksportować, sprawdzić liczności i wierność wartości, w tym `Timestamp` po odczycie z zrzutu.
- Test odmowy zapisu wewnątrz drzewa gita.
- Test statyczny: brak wywołań zapisujących w skrypcie.
- Test niezgodności: ręcznie uszkodzony plik zrzutu daje `--verify` ≠ 0.

## 5. Krok 0b: konwersja do plików vaulta

Osobny skrypt `scripts/import-to-vault.ts`, wejście: katalog zrzutu z 0a. Tryb domyślny `--dry-run` (raport bez zapisu), zapis dopiero z `--write`. Idempotentny po stabilnym `id` (ponowne uruchomienie nie duplikuje). Zapis tylko w `Vault/` (atomowo, zgodnie z §4.2 nadrzędnego specu). Wszystkie pliki z tej konwersji trafiają do vaulta, który jest śledzony przez prywatne repo, więc nie dotyczy to `Vault/Work/` (nic z Firestore tam nie trafia).

Wejściem jest zrzut zawężony (1.1). Proponowane mapowanie (otwarte punkty w 8):

| Firestore                          | Plik w vaulcie                                | Uwagi                                                                                              |
| ---------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `notes`                            | `Notes/<slug>.md`                             | frontmatter: `id`, `title`, `created`, `tags`; treść HTML → Markdown, **raport strat** per notatka |
| `documents`                        | nie migrujemy                                 | konto prawdziwe nie ma tej kolekcji (O2 rozstrzygnięte)                                            |
| `chunks`                           | nie migrujemy                                 | to pochodny indeks wyszukiwania; odtwarzany z treści, jeśli będzie potrzebny                       |
| `calendar_events`                  | nie migrujemy                                 | decyzja użytkownika (1.1); moduł zostaje, kalendarz startuje pusty; stare dane tylko w archiwum    |
| `tasks`                            | do ustalenia (O1)                             | status 4-stanowy zapisany polem inline `[status:: in_progress]`, nie samą kratką `- [ ]`           |
| `user_tags`, `task_templates`      | `Resources/tags.yaml`, `Tasks/templates.yaml` | konfiguracja                                                                                       |
| `resources`                        | `Resources/resources.yaml`                    | linki, tagi, ulubione                                                                              |
| `mindMaps`                         | nie migrujemy                                 | decyzja użytkownika (1.1); moduł zostaje, startuje pusty; stare dane tylko w archiwum              |
| `board/main`                       | nie migrujemy                                 | decyzja użytkownika (1.1); moduł zostaje, startuje pusty; konto prawdziwe nie ma danych tablicy    |
| `agent_log`                        | nie migrujemy                                 | decyzja użytkownika (1.1), O3 rozstrzygnięte; log startuje pusty; stare dane tylko w archiwum      |
| `knowledgeNodes`, `knowledgeEdges` | nie migrujemy                                 | historyczne (maj 2026), moduł usunięty, wektory osadzeń; tylko w szerszym zrzucie                  |
| `waitlist`                         | nie migrujemy                                 | dane innych osób, zostają wyłącznie w zrzucie                                                      |

Bramka 0b: raport porównuje liczbę rekordów po stronie zrzutu i po stronie plików (per typ), wylicza notatki ze stratami konwersji i zakończy się kodem ≠ 0, gdy jakiś rekord nie został ani zapisany, ani świadomie pominięty (z powodem).

## 6. Krok 0c: warstwa `lib/nexus/`

Szczegółowy projekt, podział na podkroki 0c-1…0c-4, formaty plików i testy: `2026-11-12-etap-0c-warstwa-plikowa-design.md`. Poniżej ustalenia nadrzędne.

- **Decyzje z brainstormu 0c (2026-11-12):** podmiana w miejscu, **bez przełącznika backendów** (Firestore i Vercel znikają z projektu, więc nie utrzymujemy dwóch implementacji); `chunks` wypadają (martwy indeks, nic go nie czyta); `documents` dostają backend plikowy `Documents/<slug>.md`; edytor notatek (TipTap) przechodzi na Markdown (z toolbara znikają kolor, krój czcionki, wyrównanie i podkreślenie).
- `lib/firestore-db.ts` pozostaje jedynym szwem. Funkcje o tych samych nazwach i sygnaturach dostają implementację plikową w `lib/nexus/repos/`, a plik kolekcji w `lib/firestore/` jest usuwany po jej przepięciu. Szew nie jest jednak szczelny, więc 0c zaczyna się od jego domknięcia (patrz niżej).
- **Zakres 0c:** wszystkie kolekcje, które aplikacja używa (poza `chunks`, które są usuwane), dostają backend plikowy. Dane migrują tylko `tags`, `task_templates`, `resources`, `tasks` i `notes` (1.1); `calendar_events`, `mindMaps`, `board` i `agent_log` startują puste, ale ich moduły muszą w pełni działać, więc ich implementacje plikowe i domknięcie szwu poniżej obowiązują.
- **Domknięcie szwu (pierwszy podkrok 0c, bez zmiany zachowania).** Zweryfikowane w kodzie: `services/mindMapService.ts` i `services/boardService.ts` importują `FieldValue` z `firebase-admin/firestore` i używają bezpośrednio `mindMapsCol`/`boardDoc` (z `.doc()`, `.get()`, `.update()`), a `src/App.tsx`, `src/features/mind-maps/*` i `types/records.ts` (typ `Timestamp`) też dotykają Firebase. Trzeba dodać do `firestore-db.ts` funkcje repozytoryjne (`getMindMaps`, `createMindMap`, `updateMindMap`, `deleteMindMap`, `getBoard`, `saveBoard`), przenieść do nich `serverTimestamp()`, a pola czasu w typach zamienić na ISO string.
- **Zależności między serwisami:** `calendarService` czyta zadania (`getTasks`, `services/calendarService.ts:36`), a `planService` odpytuje kalendarz i tworzy wydarzenia bezpośrednio przez `firestoreDb`. Kolejność podmiany to: `tags` → `task_templates` → `resources` → **`tasks` → `calendar_events`** → `notes` / `documents` → `mindMaps` → `board` → `agent_log`; `planService` przechodzi przez API `calendarService`, a nie przez `firestoreDb`. Kolekcje bez migrowanych danych (`calendar_events`, `mindMaps`, `board`, `agent_log`) są podmieniane w tej samej kolejności, tylko bez kroku importu.
- Po każdej kolekcji: testy usługi, ręczny przegląd w UI, commit.
- **`agent_log`:** `agentService` zapisuje do niego w każdym przebiegu (`services/agentService.ts`), więc backend plikowy musi mieć implementację (dopisywany JSONL w `Sessions/`) albo jawny no-op. Stare dane nie są migrowane (O3), log startuje pusty. Brak implementacji zatrzymałby asystenta AI.
- Pojedynczy użytkownik: `userId` staje się stałą lokalną. Parametr zostaje w sygnaturach do końca kroku (mniej zmian), usuwany w 0d.
- Moduły zgodnie z §4.1 nadrzędnego specu: `vault-path.ts` (w tym mapowanie `E:\` ↔ `/mnt/e/`, błąd konfiguracji przy braku `NEXUS_VAULT_PATH`), `markdown-edit.ts`, zapis atomowy z kontrolą `mtime`.
- Testy: testy usług zostają jedne (bez drugiego backendu); repozytoria plikowe są testowane na tymczasowym vaulcie. Zweryfikowane: `tests/unit/services/boardService.test.ts` i `mindMapService.test.ts` mockują wprost `firebase-admin` i `FieldValue`, więc po domknięciu szwu trzeba je przepisać tak, by mockowały `firestore-db` (lub interfejs repozytorium), a nie SDK. Szczegóły w planie.

## 7. Kroki 0d–0f

### 0d: usunięcie

**Podział (decyzja przy planowaniu 0d).** 0d-1: zabezpieczenie lokalnego serwera (`lib/localGuard.ts`, `middleware.ts`, nagłówek `X-Nexus-Client` dla narzędzi spoza przeglądarki, `-H 127.0.0.1`) oraz usunięcie auth i `userId` z route'ów, serwisów, repozytoriów i typów. 0d-2: wszystko, co dotyczy klienta, waitlisty, pakietu `firebase`, e2e i dokumentacji (lista niżej). Między nimi aplikacja działa: klient nadal loguje się Firebase i woła `/api/waitlist/check`, a pozostałe route'y ignorują token.

**Odstępstwo od listy niżej: `firebase-admin`, `lib/firebase-admin.ts`, `scripts/export-firestore/`, `scripts/migrate-sqlite-to-firestore.ts`, `scripts/cleanup-knowledge-collections.ts` i testy integracyjne eksportu zostają do 0e.** `--verify` zrzutu (bramka 0e krok 1) i ewentualny ponowny eksport potrzebują `firebase-admin`, a zrzut jest jedyną siatką bezpieczeństwa przed usunięciem projektu Firebase. Usuwamy je po bramce 0e.

- Route handlery: `getAuthUserId` jest użyty w 27 plikach `app/api/**`; każdy dostaje stałego lokalnego użytkownika zamiast weryfikacji tokenu (mechaniczna zmiana, nadaje się do `--role task` z kontrolą `git diff`).
- Routing: usunięcie `app/(protected)/layout.tsx` wymaga zdecydowania o `app/(protected)/dashboard` i `notes` (zostawić grupę z prostym layoutem bez auth albo spłaszczyć trasy).
- Auth: `lib/getAuth.ts`, `lib/waitlistCheckEmail.ts`, `src/lib/auth/useAuth.ts`, `src/components/LoginScreen.tsx`, `app/(protected)/layout.tsx`, `src/lib/firebase-client.ts`, `lib/firebase-admin.ts`, `app/api/auth`, testy `getAuth`.
- Waitlista: `app/api/waitlist/*` i jej testy.
- Strony prawne i landing: `app/regulamin`, `app/politika-prywatnosci`, `app/cookies`, `app/auth`, oraz `app/page.tsx` do zastąpienia wejściem w aplikację (O4).
- Zależności: `firebase`, `firebase-admin`; pliki `firebase.json`, `firestore.rules`; zmienne `FIREBASE_*` i `NEXT_PUBLIC_FIREBASE_*` z `.env.example`; skrypty `migrate-sqlite-to-firestore.ts`, `cleanup-knowledge-collections.ts`; `docker-compose-test.yml` i skrypty `emulator:docker`, `migrate:sqlite-to-firestore`, `vercel`, `vercel:prod` z `package.json`; pakiety `vercel` i `better-sqlite3` (po sprawdzeniu, że nic innego ich nie używa); tło emulatora z testów integracyjnych.
- Testy e2e (Playwright): `tests/e2e/auth.setup.ts`, `auth-login-logout.spec.ts`, `public-pages.spec.ts` i specyfikacje `*.authenticated.spec.ts` zależą od logowania; trzeba je przepisać na uruchomienie bez auth albo usunąć.
- Dokumentacja: nowe ADR „lokalne pliki zamiast Firestore” oznacza ADR-002, 003, 016 jako zastąpione; poprawka README.

### Zabezpieczenie lokalnego serwera (wymóg, nie opcja)

Po usunięciu auth każdy proces z dostępem do portu może pisać do vaulta. Dlatego w 0d, jeszcze przed usunięciem logowania:

- serwer wiąże się tylko z `127.0.0.1` (`next dev -p 3100 -H 127.0.0.1`, `next start -H 127.0.0.1`; port dev to 3100 w `package.json`),
- middleware odrzuca żądania, których nazwa hosta z nagłówka `Host` (bez portu) nie jest jedną z `localhost`, `127.0.0.1`, `[::1]` (ochrona przed DNS rebinding),
- żądania zmieniające stan (POST/PUT/PATCH/DELETE) wymagają zgodnego `Origin` (lub `Sec-Fetch-Site: same-origin`) albo nagłówka własnego (ochrona przed zapisem z cudzej strony otwartej w tej samej przeglądarce),
- test pokrywa trzy powyższe przypadki.

Stan: zaimplementowane w 0d-1 (`lib/localGuard.ts` z testami, `middleware.ts`, skrypty `dev`/`start`/`preview` z `-H 127.0.0.1`). Przeglądarka sama wysyła `Origin` i `Sec-Fetch-Site` przy `fetch` na ten sam origin, więc kod UI się nie zmienia; curl i skrypty wysyłają `X-Nexus-Client: 1`. Reguły: obcy `Host` → 403 dla każdej metody; metody zmieniające stan wymagają `Sec-Fetch-Site: same-origin`, a bez tego nagłówka zgodnego `Origin` lub `X-Nexus-Client: 1` (nagłówek nie przebija obcego `Origin`).

### 0e: Vercel i Firebase

1. Bramka: `--verify` zrzutu (4.5) kończy się zgodnie, 0b zgodne, aplikacja lokalnie działa na plikach co najmniej tydzień (okres obserwacji do potwierdzenia, O5).
2. Druga kopia zrzutu na osobnym nośniku (zrzut zawiera dane osobiste, nie wysyłać do chmury bez szyfrowania). Kopia obejmuje także szerszy zrzut z 1.1, bo po usunięciu projektu Firebase jest jedynym źródłem pominiętych danych.
3. Zdjęcie wdrożenia z Vercela, usunięcie projektu Vercel i katalogu `.vercel/` z repo.
4. Projekt Firebase: najpierw wyłączenie dostępu (reguły zamykające), karencja (O5), potem usunięcie projektu. Zrzut zostaje.

### 0f: `Vault/Work/`

W repo NEXUS: wpis `Work/` w `.gitignore` (zrobić przed utworzeniem pierwszego pliku). W aplikacji: kontrola `git check-ignore Vault/Work/` przy starcie, blokująca zapis i odczyt etatu, gdy folder nie jest ignorowany (§5 nadrzędnego specu).

## 8. Otwarte pytania (do rozstrzygnięcia przed planem)

- **O1. Dokąd idą zadania z Firestore?** Są płaskie (bez projektu), a w vaulcie zadania żyją w `Projects/<id>/tasks.md`. Propozycja: `Tasks/tasks.md` jako lista ogólna, przypisywanie do projektów później (w etapie 1).
- **O2. ~~Dokąd idą `documents`?~~** Rozstrzygnięte: konto prawdziwe nie ma tej kolekcji, nic do migracji.
- **O3. ~~Czy `agent_log` ma wartość?~~** Rozstrzygnięte decyzją użytkownika (1.1): nie migrujemy, dane tylko w szerszym zrzucie.
- **O4. Co zastępuje landing (`app/page.tsx`)?** Propozycja: przekierowanie do głównego widoku aplikacji.
- **O5. Okres obserwacji i karencji** przed 0e (propozycja: 7 dni lokalnej pracy na plikach, 30 dni od zamknięcia reguł do usunięcia projektu Firebase).
- **O6. ~~Ilu użytkowników jest w Firestore?~~** Rozstrzygnięte: jedno prawdziwe konto i dwa testowe, trzy konta z danymi (a cztery w Auth). Testowe pomijamy, bez ich danych w zawężonym zrzucie.
- **O7. ~~Co z kodem modułów bez migrowanych danych?~~** Rozstrzygnięte decyzją użytkownika: wszystkie moduły (kalendarz, mapy myśli, „Moja praca”, planowanie, tablica, asystent AI) zostają i będą używane. Nie migrujemy tylko starych danych; założenia aplikacji są nadal aktualne. Konsekwencja: żaden kod modułów nie jest usuwany w 0d, a backend plikowy musi pokryć wszystkie kolekcje (0c).

## 9. Ryzyka

- **Utrata danych przez błąd eksportu.** Ograniczenie: liczenie przed/po, `--verify`, SHA-256, druga kopia, karencja przed usunięciem projektu.
- **Strata formatowania HTML → Markdown.** Ograniczenie: raport strat, oryginał HTML w zrzucie.
- **Pominięta kolekcja.** Ograniczenie: dynamiczne wykrywanie (4.3) i wstrzymanie na nieznanych.
- **Otwarty lokalny port bez auth.** Ograniczenie: sekcja o zabezpieczeniu lokalnym w 0d, wymóg przed usunięciem logowania.
- **Zrzut z danymi osobistymi w złym miejscu.** Ograniczenie: zapis poza gitem z twardą odmową, uprawnienia 0600.
- **Limit odczytów.** Ograniczenie: `--count-only`, ostrzeżenie, `--resume`.
- **Nieodwracalna utrata pominiętych danych.** Stare dane kalendarza, map myśli i reszty spoza 1.1 istnieją po 0e tylko w archiwalnym szerszym zrzucie (użytkownik ich nie potrzebuje, ale usunięcie jest nieodwracalne). Ograniczenie: szerszy zrzut zostaje, trafia do drugiej kopii (0e.2) i nie jest usuwany bez osobnej decyzji użytkownika.

## 10. Kryteria ukończenia etapu 0

- Zrzut przechodzi `--verify`, liczności zgodne w obu kierunkach (0a).
- Raport 0b bez rekordów nieuwzględnionych; straty konwersji zaakceptowane przez użytkownika.
- Po 0e (nie po 0d, bo `firebase-admin` służy bramce 0e): aplikacja uruchamia się bez zmiennych `FIREBASE_*` i bez pakietów Firebase w `package-lock.json`.
- Testy jednostkowe i integracyjne przechodzą, w tym testy zabezpieczenia lokalnego.
- Aplikacja nie jest wdrożona na Vercelu; projekt Firebase zamknięty po karencji; zrzut zachowany w dwóch miejscach.
- `git check-ignore Vault/Work/` zwraca ścieżkę w NEXUS, a aplikacja blokuje dostęp do `Work/`, gdy tak nie jest.
