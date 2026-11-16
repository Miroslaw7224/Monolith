# Kokpit: panel „Review · ostatnie dni” (zatwierdzone i komentarze)

Data: 2026-11-16. Status: zatwierdzony przez użytkownika. Rozwija spec `2026-11-16-review-requesty-kokpit-design.md` i wzoruje się na historii commitów (`GET /api/cockpit/commits`, `CommitHistory.tsx`).

## 1. Cel

Użytkownik chce widzieć na górze Kokpitu, ile review zrobił: ile zatwierdzeń i ile komentarzy, analogicznie do historii commitów (7 dni, dzień po dniu, słupki, chip z sumą). Wiszące teraz prośby widać w panelu „Do zrecenzowania” poniżej.

## 2. Decyzje

| ID  | Temat         | Decyzja                                                                                                                                                                                                                                   |
| --- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Okres i forma | 7 dni, dzień po dniu, dwa słupki na dzień (zatwierdzone, komentarze), chip z sumami; klasy `kok-history__*` jak w historii commitów (wybór użytkownika: „analogicznie do commitów”).                                                      |
| D2  | Miejsce       | Pierwszy element lewej kolumny Kokpitu, nad panelem „Do zrecenzowania”.                                                                                                                                                                   |
| D3  | Co liczymy    | Każde review użytkownika osobno: `APPROVED` → zatwierdzone, `COMMENTED` → komentarze. `CHANGES_REQUESTED` wchodzi tylko do liczby różnych PR-ów (bez słupka). Stany `PENDING` i `DISMISSED` ignorujemy. Dzień w strefie lokalnej serwera. |
| D4  | Źródło        | Jedno zapytanie `gh api graphql` (wyszukiwanie PR-ów `reviewed-by:@me`, w nich `reviews`); wbudowane statystyki `contributionsCollection` zwracają 0 dla prywatnych repozytoriów organizacji, więc odpadają.                              |
| D5  | Prywatność    | Same liczby, bez tytułów PR-ów; nic nie jest zapisywane na dysku. Nie dotyka `Work/` ani `owner`.                                                                                                                                         |

## 3. Zmiany w kodzie (ADR-021)

**`lib/github/gh.ts` (nowy, wydzielone z `review-requests.ts`):** `runGh(args: readonly string[]): Promise<RunResult>`: async `execFile("gh", args, …)` z limitem czasu 8 s, `maxBuffer` 256 KB (dla historii: 1 MB), środowiskiem `{ ...process.env, GH_PROMPT_DISABLED: "1", GH_PAGER: "cat", NO_COLOR: "1", GH_NO_UPDATE_NOTIFIER: "1" }`, bez wyjątków (`gh-missing` dla `ENOENT`, inaczej `gh-error`). `review-requests.ts` używa `runGh`; jego testy nie zmieniają się.

**`lib/github/my-reviews.ts` (nowy):** `fetchMyReviews(updatedSince: string): Promise<MyReviewsResult>`.

- `updatedSince` to `RRRR-MM-DD` (walidacja regexem; inaczej `gh-error`), trafia do kwalifikatora `updated:>=`.
- Wywołanie: `gh api graphql -f q=is:pr reviewed-by:@me updated:>=<data> -f query=<stałe zapytanie>`; zapytanie pobiera `viewer { login }` i `search(first: 100, type: ISSUE) { nodes { ... on PullRequest { number repository { nameWithOwner } reviews(last: 100) { nodes { state submittedAt author { login } } } } } }`.
- Wynik: `{ ok: true, reviews: MyReview[] }` albo `{ ok: false, reason }`. `MyReview = { repo: string; number: number; state: "APPROVED" | "COMMENTED" | "CHANGES_REQUESTED"; submittedAt: string }`. Zostają tylko review, których `author.login` równa się `viewer.login`, ze stanem z listy i poprawną datą ISO; reszta (inni autorzy, `PENDING`, `DISMISSED`, brak daty) jest pomijana.

**Kontekst `bc_cockpit`:**

- `models.ts`: `MyReview` (jak wyżej), `ReviewDay = { date; approved; comments }`, `ReviewHistory = { from; to; available; approved; comments; prs; days: ReviewDay[] }`.
- `repositories.ts`: `loadMyReviews(updatedSince): Promise<{ available: boolean; reviews: MyReview[] }>` (kopiuje wynik `lib`; błąd `gh` to `available: false`).
- `services.ts`: `getReviewHistory(days, today = new Date())`: walidacja `days` jak w `getCommitHistory` (1–`MAX_HISTORY_DAYS`, inaczej `DomainError`); lista dni lokalnych; `updatedSince` = dzień przed `from` (zapas na strefy czasowe); każde review przypisane do dnia lokalnego (`localDate(new Date(submittedAt))`), dni spoza zakresu odrzucone; `approved`/`comments` to sumy z `days`; `prs` to liczba różnych `repo#number` ze wszystkich review w zakresie (także `CHANGES_REQUESTED`); `available: false` zwraca puste `days`.
- `schemas.ts`: `ReviewHistoryDto`, `toReviewHistoryDto` (kopia pól).
- `router.ts`: `getReviewHistory(request)`: `?days=` (domyślnie 7, liczba całkowita 1–90, inaczej 400, jak `getCommits`); awaria `gh` to 200 z `available: false`.
- `app/api/cockpit/review-history/route.ts`: re-eksport `GET` + `dynamic = "force-dynamic"`.

**UI `src/features/home/ReviewHistory.tsx` (nowy):** props `{ apiFetch, day }` (jak `CommitHistory`). Pobiera `/api/cockpit/review-history?days=7` przy montowaniu i zmianie `day`. Panel `kok-panel kok-history` z legendą (zatwierdzone, komentarze), chipem `{{approved}} zatw. · {{comments}} kom. · {{prs}} PR · {{days}} dni` (EN: `approved`, `comments`, `PRs`, `days`) i słupkami dzień po dniu (układ jak w `CommitHistory`, wartości zatwierdzonych nad słupkiem akcentu, komentarzy nad jaśniejszym). Stany: przed odpowiedzią nic; `available: false`, HTTP ≠ 200 lub odrzucony `apiFetch` → „Nie można pobrać z GitHuba” (błąd widoczny, nie ukryty). Klasy `kok-history__*` bez nowego CSS (wariant słupka komentarzy to istniejący `kok-history__bar--pr`). `CockpitSections.tsx`: `<ReviewHistory apiFetch={apiFetch} day={data.date} />` jako pierwszy element lewej kolumny, przed `<ReviewRequests />`.

**i18n (`src/i18n/locales/{pl,en}/home.ts`):** sekcja `reviewHistory`: `aria`, `title` („Review”), `titleSuffix` („ · ostatnie dni”), `legendApproved`, `legendComments`, `chip`, `barEmpty` („{{date}}: brak review”), `barDay` („{{date}}: zatwierdzone {{approved}}, komentarze {{comments}}”), `error`. Bez kluczy z `count` (odmiana liczebnikowa).

## 4. Testy (Vitest)

- `lib/github/my-reviews`: poprawny JSON → `reviews` tylko użytkownika (obce loginy odpadają); pomijane: `PENDING`, `DISMISSED`, brak `submittedAt`, zła data, brak `repository`; `updatedSince` w złym formacie → `gh-error` bez wywołania `gh`; argumenty `gh` z białej listy; `ENOENT` → `gh-missing`; niepoprawny JSON → `gh-error`.
- `bc_cockpit` serwis: 7 dni z dziesięcioma review → poprawne `days`, sumy `approved`/`comments`, `prs` (różne PR-y, w tym `CHANGES_REQUESTED`); review spoza zakresu odrzucone; granica doby w strefie lokalnej (`submittedAt` 23:30 UTC wpada w poprawny dzień lokalny); `available: false`; `days` poza 1–90 → `DomainError`.
- Router: domyślnie 7, `?days=30`, 400 dla `0`/`abc`/`91`/`2.5`, 200 z `available: false` przy awarii.
- Schemat: kopiuje pola, odrzuca nadmiarowe.
- Komponent: słupki i chip (PL i EN), brak panelu przed odpowiedzią, komunikat błędu (`available: false`, HTTP 500, odrzucony `apiFetch`), ponowne pobranie po zmianie `day`; w `HomeView.test.tsx` panel jest pierwszy w lewej kolumnie (nad „Do zrecenzowania”); `HomeView*.test.tsx` mockują nowy URL.

## 5. Poza zakresem

Trzeci słupek `CHANGES_REQUESTED`; przełącznik okresu; liczba „dostałem próśb” (GitHub nie udostępnia jej historii, wiszące widać w panelu listy); tytuły PR-ów w panelu.

## 6. Ryzyka

- Zapytanie pobiera do 100 PR-ów zmienionych w oknie (`first: 100`) i do 100 ostatnich review na PR (`reviews(last: 100)`); przy skrajnej aktywności liczby byłyby zaniżone. Dziś w oknie 7 dni jest ok. 43 PR-y.
- Odpowiedź może być duża (stąd `maxBuffer` 1 MB dla tego zapytania); przekroczenie to `gh-error` i komunikat w panelu.
