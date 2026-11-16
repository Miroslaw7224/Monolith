# Kokpit: lista „Do zrecenzowania” (review requesty z GitHuba)

Data: 2026-11-16. Status: szkic do przeglądu. Rozwija spec Kokpitu 2-1 (`2026-11-13-etap-2-1-kokpit-odczyt-design.md`) i korzysta ze wzorca historii commitów (`GET /api/cockpit/commits`, `CommitHistory.tsx`).

## 1. Cel

Aplikacja ma pomagać zarządzać czasem i pracą, bez zbędnych bajerów (wypowiedź użytkownika, 2026-11-15).

Realny ból: prośba o review cudzego PR-a przychodzi na GitHubie, a Monolith o niej nie wie, więc łatwo ją przegapić. Rozwiązanie: w Kokpicie sekcja **„Do zrecenzowania (N)”** z otwartymi PR-ami, w których użytkownik jest wskazany jako recenzent. Bez zapisu do vaulta.

## 2. Decyzje (brainstorming 2026-11-16)

| ID  | Temat            | Decyzja                                                                                                                                                                                                                                                                                                                                      |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Forma            | Lista z licznikiem w Kokpicie (wybór użytkownika: opcja 1). Odrzucone: wpis do Inboxu (zapis do vaulta, duplikaty), powiadomienie systemowe lub dźwięk (działa tylko przy otwartej aplikacji; poza nią wystarczą powiadomienia GitHuba).                                                                                                     |
| D2  | Prywatność       | Pokazujemy wszystko: repo, numer, tytuł, autora, link (wybór użytkownika: A). Także PR-y z organizacji pracowych. Dane pochodzą z konta użytkownika, nic nie jest zapisywane na dysku ani wysyłane dalej. Nie dotyka `Work/` ani `owner`.                                                                                                    |
| D3  | Źródło           | Komenda `gh` (GitHub CLI), już zalogowana na koncie użytkownika; bez nowego tokena i sekretu. Odrzucone: REST API z tokenem w `.env` (nowy sekret, więcej kodu).                                                                                                                                                                             |
| D4  | Miejsce w kodzie | Osobny endpoint `GET /api/cockpit/reviews` i osobny komponent, nie pole w głównym `GET /api/cockpit`: zapytanie sieciowe nie może spowalniać Kokpitu ani psuć go przy błędzie.                                                                                                                                                               |
| D5  | Zakres zapytania | Prośby bezpośrednie (`--review-requested=@me`), **otwarte i zmergowane** PR-y (zmiana 2026-11-16: zmergowany, zanim użytkownik zdążył zrecenzować, nadal wymaga review po fakcie). Prośba znika, gdy użytkownik zostawi review na GitHubie. PR-y zamknięte bez merge'a pomijamy. Prośby do zespołów (`team-review-requested`) poza zakresem. |
| D6  | Odświeżanie      | Przy wejściu do Kokpitu i co 5 minut, tylko gdy karta przeglądarki jest widoczna. Bez przycisku „odśwież” w pierwszej wersji.                                                                                                                                                                                                                |
| D7  | Zaległości       | Bez limitu wieku: dziś wisi 39 próśb (38 zmergowanych, najstarsza z czerwca). Chip pokazuje pełną liczbę (`total`), lista 20 najnowszych, pod nią „+N starszych”. Zmergowane mają znacznik „scalony”.                                                                                                                                        |

## 3. Zmiany w kodzie (ADR-021)

**`lib/github/review-requests.ts` (nowy plik infrastruktury, jedyne miejsce z `child_process` dla GitHuba):**

- `fetchReviewRequests(): Promise<ReviewRequestsResult>`, asynchronicznie przez `execFile` (nie `execFileSync`: zapytanie sieciowe nie może blokować serwera Node).
- Biała lista: jedyne wywołanie to `gh search prs --review-requested=@me --sort updated --order desc --limit 100 --json number,title,url,author,repository,updatedAt,state` (sortowanie jest konieczne: domyślna kolejność wyszukiwania gubiła świeże PR-y poza limitem), bez powłoki, bez argumentów z zewnątrz.
- Środowisko: `{ ...process.env, GH_PROMPT_DISABLED: "1", GH_PAGER: "cat", NO_COLOR: "1", GH_NO_UPDATE_NOTIFIER: "1" }` (bez `...process.env` `gh` straciłby `PATH`, `HOME` i sesję logowania; wzór: `execGit` w `lib/git/project-git.ts`). Limit czasu 8 s, `maxBuffer` 256 KB (przekroczenie → `gh-error`).
- Wynik: `{ ok: true, items }` albo `{ ok: false, reason }`, gdzie `reason` to `"gh-missing"` (`ENOENT`) lub `"gh-error"` (kod wyjścia ≠ 0, limit czasu, nieczytelny JSON). `items` są już spłaszczone: `repo` (z `repository.nameWithOwner`), `author` (z `author.login` albo `null`). Funkcja nie rzuca wyjątków.
- Walidacja wyjścia: JSON → tablica (`SyntaxError` lub inny kształt → `gh-error`); pozycja bez `number`, `title`, `url` lub `repository.nameWithOwner` jest pomijana, tak samo z `updatedAt`, którego `Date.parse` nie daje liczby skończonej (chroni sortowanie i UI przed `NaN`). `author` może być pusty (`null`/brak `login`). Pozycje ze `state` innym niż `open`/`merged` są pomijane; `state` trafia do wyniku.
- `url` trafia do `href`, więc przepuszczamy tylko adresy, dla których `new URL(url)` daje `protocol === "https:"` i `hostname === "github.com"`; inne pozycje pomijamy.
- Test architektury nie wymaga zmiany: żadna reguła R1–R7 nie wylicza katalogów `lib/` oprócz `lib/nexus`, `lib/http`, `lib/schema`.

**Kontekst `bc_cockpit`:**

- `models.ts`: `ReviewRequest = { repo: string; number: number; title: string; author: string | null; url: string; updatedAt: string; state: "open" | "merged" }` oraz `ReviewRequests = { available: boolean; total: number; items: ReviewRequest[] }`.
- `repositories.ts`: `loadReviewRequests()` woła `lib/github` i kopiuje wynik do modelu. Błąd `gh` daje `available: false`, `items: []`.
- `services.ts`: `getReviewRequests()` sortuje po `updatedAt` malejąco i przycina do `MAX_REVIEW_REQUESTS = 20` (`total` zostaje pełny).
- `schemas.ts`: `ReviewRequestDto`, `ReviewRequestsDto` (`available`, `total`, `items`) i maper `toReviewRequestsDto` (model → DTO). Plik zostaje bezpieczny dla klienta.
- `router.ts`: `getReviewRequests()` zwraca zawsze 200; niedostępność GitHuba to `available: false`, nie 500 (jak `available: false` w historii commitów).
- `app/api/cockpit/reviews/route.ts`: `export { getReviewRequests as GET } from "@/contexts/bc_cockpit/router";` oraz `export const dynamic = "force-dynamic";`.

**UI `src/features/home/`:**

- `ReviewRequests.tsx` (nowy; szkielet pobierania jak w `CommitHistory.tsx`: `apiFetch`, flaga `cancelled`, import z kontekstu tylko `schemas`). W odróżnieniu od `CommitHistory` nie ma propa `day`, a odświeża się cyklicznie: pobiera `/api/cockpit/reviews` przy montowaniu i co 5 min (`setInterval`, tick pomijany przy `document.visibilityState !== "visible"`), a po powrocie karty do widoczności (`visibilitychange`, wzór: `useCodex.ts`) robi jedno odświeżenie od razu. Przy odmontowaniu: `clearInterval`, zdjęcie nasłuchu `visibilitychange`, `cancelled = true`.
- Wygląd: panel `kok-panel` z nagłówkiem „Do zrecenzowania” i chipem `kok-chip` z pełną liczbą `total` (tylko gdy lista się wczytała). Zmergowane PR-y mają znacznik `kok-badge` „scalony”, a pod listą pojawia się „+N starszych”, gdy `total` przekracza liczbę pozycji. Panel stoi **nad** osią dnia (wybór użytkownika, 2026-11-16). Pozycja: `repo#numer`, tytuł (link `target="_blank" rel="noopener noreferrer"`), autor oraz data i godzina ostatniej zmiany z `updatedAt` istniejącymi `formatShortDate` i `formatTime` z `src/i18n/format.ts` (bez nowych helperów i kluczy z odmianą; „godz. temu” odpada, bo `relativeDays` liczy tylko pełne dni).
- Stany: 0 PR-ów → „Brak próśb o review”; `available: false`, błąd HTTP ≠ 200 albo odrzucony `apiFetch` → „Nie można pobrać z GitHuba” (inaczej niż `CommitHistory`, które w razie błędu ukrywa panel: tu cichy brak listy to dokładnie ten ból, który spec ma usunąć; reszta Kokpitu działa); przed pierwszą odpowiedzią → nic nie pokazujemy (bez migania).
- `CockpitSections.tsx`: `<ReviewRequests apiFetch={apiFetch} />` jako pierwszy element lewej kolumny, nad panelem osi dnia.
- `src/i18n/locales/{pl,en}/home.ts`: nowa sekcja `reviews` (jak `history`): `aria`, `title` (bez parametrów: klucz z `count` uruchamia odmianę liczebnikową), `empty`, `error`, `merged`, `more` (z `{{n}}`, nie `count`). Parytet PL/EN pilnuje `tests/unit/i18n/parity.test.ts`.
- `home.css`: style listy w konwencji `kok-*`.

**Dokumentacja:** `docs/nexus-vault-formaty-yaml.md` bez zmian (brak zapisu do vaulta). Wzmianka w `CLAUDE.md` o `lib/github/` w liście infrastruktury (`lib/git/`, …).

## 4. Testy (Vitest)

`tests/unit/lib/github/review-requests.test.ts` (z mockiem `execFile`, bez sieci):

- poprawny JSON z 2 PR-ami → `ok: true`, 2 pozycje z polami `repo`, `number`, `title`, `author`, `url`, `updatedAt`;
- pozycja bez `url` lub z `url` spoza `https://github.com/` → pominięta;
- `author: null` → pozycja zostaje, `author: null`;
- `ENOENT` → `{ ok: false, reason: "gh-missing" }`;
- kod wyjścia 1, timeout, JSON niebędący tablicą → `{ ok: false, reason: "gh-error" }`;
- `url` jak `https://github.com.evil.example/x` lub `http://github.com/x` → pominięty; `updatedAt: "nie-data"` → pominięty;
- niepoprawny JSON (`SyntaxError`) i przekroczony `maxBuffer` → `gh-error`;
- wywołanie ma dokładnie argumenty z białej listy, `GH_PROMPT_DISABLED=1` i dziedziczy `PATH` z `process.env`.
- Mock: `vi.hoisted` + `vi.mock("node:child_process")` z `execFile` wywołującym callback (w repo nie ma jeszcze takiego mocka).

`tests/unit/contexts/bc_cockpit/`:

- `services.getReviewRequests`: 25 pozycji w losowej kolejności → 20 najnowszych, malejąco po `updatedAt`; `available: false` przechodzi bez zmian;
- `router.getReviewRequests` (`tests/unit/contexts/bc_cockpit/router.test.ts`, wzór: testy `commits`): błąd `gh` → status 200 i `available: false`;
- `repositories.loadReviewRequests`: kopiowanie pól; wynik `ok: false` → `available: false`;
- `schemas.toReviewRequestsDto`: mapowanie pól.

`tests/unit/features/home/ReviewRequests.test.tsx`:

- przed pierwszą odpowiedzią: brak panelu i komunikatów;
- lista z 2 PR-ami: link ma `href`, `target="_blank"`, `rel="noopener noreferrer"`; nagłówek „Do zrecenzowania” i chip „2”;
- pusta lista → „Brak próśb o review”;
- `available: false`, odpowiedź HTTP 500 i odrzucony `apiFetch` → komunikat o błędzie;
- odświeżanie: fake timers wg wzoru `HomeView.test.tsx` (`vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"], now })`, `afterEach` → `vi.useRealTimers()`): po 5 min drugie wywołanie `apiFetch`; przy `visibilityState = "hidden"` tick nie woła; zdarzenie `visibilitychange` na `visible` woła od razu;
- odmontowanie w trakcie zapytania: brak aktualizacji stanu, interwał i nasłuch zdjęte;
- zmergowany PR ma znacznik „scalony”, otwarty nie; chip pokazuje `total` (np. 39), pod listą „+37 starszych”, a gdy wszystko się mieści, tego wiersza nie ma; w `HomeView.test.tsx` panel stoi nad osią dnia;
- osobny plik `ReviewRequests.en.test.tsx` (wzór: `HomeView.en.test.tsx`, `setLanguage("en")`): teksty angielskie.

Testy statyczne (`architecture.static.test.ts`, `no-model-api`, `allow-work`) muszą przechodzić bez zmian.

## 5. Poza zakresem (YAGNI)

Powiadomienia systemowe i dźwięk; wpis do Inboxu; pamiętanie „już widziałem”; prośby do zespołów; przycisk „odśwież”; filtrowanie po organizacji; komentarze, status CI i liczba zmian w PR-ze. Każde z nich można dodać osobno, gdy pojawi się realny ból.

## 6. Ryzyka i uwagi

- `gh search` korzysta z limitu API wyszukiwania GitHuba (30 zapytań/min); odświeżanie co 5 min z jednej karty mieści się z dużym zapasem. Otwarcie wielu kart Kokpitu naraz mnoży zapytania, ale nadal jest w limicie.
- Brak `gh` lub wygasła sesja (`gh auth login`) kończy się komunikatem „Nie można pobrać z GitHuba”, bez szczegółów błędu w UI.
- Tytuły PR-ów z pracy są widoczne na ekranie Kokpitu (decyzja D2); jeśli to zacznie przeszkadzać (np. przy pokazywaniu ekranu), wróć do opcji B/C z brainstormingu.
- Dziś wisi 39 próśb, prawie wszystkie zmergowane i zaległe od tygodni. Znikają po review na GitHubie (wystarczy review typu „Comment”). Do tego czasu panel pokazuje je jako zaległość (decyzja D7: bez limitu wieku, żeby nie gubić PR-a zmergowanego przed review).
