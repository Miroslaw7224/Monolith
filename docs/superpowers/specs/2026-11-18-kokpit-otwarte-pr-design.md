# Kokpit: kafelek „Otwarte PR” i zamiana kolumn

Data: 2026-11-18. Karta: Kokpit (`src/features/home/`), kontekst `bc_cockpit`.

## Cel

Widzieć w Kokpicie wszystkie własne, otwarte pull requesty ze wszystkich repo (prywatne i organizacji)
razem z linkami, tak jak „Do zrecenzowania” pokazuje cudze PR-y czekające na moje review.
Przy okazji zmiana kolejności kolumn, żeby PR-y i kolejka dnia były w środku, a punkty skupienia z boku.

## Układ

Trzy kolumny `.kok-grid`, od lewej:

1. bez zmian: Do zrecenzowania, Dziś · oś czasu, Review, commity, tydzień;
2. **Otwarte PR** (nowy kafelek), pod nim Kolejka · dziś, pod nią Inbox;
3. Punkty skupienia.

Zmiana: kolejność elementów w `CockpitSections.tsx` oraz `grid-template-columns` z `1.05fr 1.35fr 1fr`
na `1.05fr 1fr 1.35fr` (punkty skupienia dalej najszersze). Poniżej 1100 px jedna kolumna jak dotąd;
kolejność w jednej kolumnie wynika z kolejności w DOM.

## Kafelek „Otwarte PR”

- Dane: otwarte PR-y, których użytkownik jest **autorem**, ze wszystkich repo dostępnych dla konta w `gh`
  (publiczne, prywatne, organizacje). Bez PR-ów, w których jest tylko recenzentem lub assignee.
- Wiersz: `repo#numer tytuł` jako link (`target="_blank"`, `rel="noopener noreferrer"`), data ostatniej zmiany.
- Kolory: **draft na szaro** (`--muted`), **gotowy do review na zielono** (`--green`); kolor nosi
  odnośnik `repo#numer` oraz znacznik statusu („draft” / „gotowy”), żeby nie polegać wyłącznie na kolorze.
- Nagłówek z licznikiem (`total`), przy `total > items` linia „+N więcej”; limit 20 pozycji, najnowsze pierwsze.
- Stan błędu widoczny (jak w `ReviewRequests`): cichy brak listy ukryłby PR wymagający uwagi.
- Pusta lista: komunikat „Brak otwartych PR”.
- Odświeżanie co 5 min przy widocznej karcie i po powrocie do karty (jak `ReviewRequests`).

## Architektura

Kierunek: `app/api/cockpit/open-prs/route.ts` → `router` → `services` → `repositories` → `lib/github`.

- `lib/github/my-open-prs.ts`: `fetchMyOpenPrs()`, stała biała lista argumentów
  `gh search prs --author=@me --state=open --sort updated --order desc --limit 100 --json number,title,url,repository,updatedAt,isDraft`,
  wspólny `runGh`, walidacja `url` (`https://github.com/...`), `number`, `updatedAt`, `isDraft` (boolean).
  Walidację `isGithubUrl`, `asObject` i `ISO_DATE` wyciągam do wspólnego modułu w `lib/github/`, jeśli jest
  identyczna z `review-requests.ts` (bez kopiowania). Błąd `gh` albo zła odpowiedź to `ok: false`, nie wyjątek.
- `contexts/bc_cockpit/models.ts`: `OpenPr { repo, number, title, url, updatedAt, draft }`,
  `OpenPrs { available, total, items }`.
- `repositories.ts`: `loadOpenPrs()` (mapowanie z `lib/github`, błąd to `available: false`).
- `services.ts`: `getOpenPrs()`: sortowanie malejąco po `updatedAt`, `MAX_OPEN_PRS = 20`, `total` z pełnej listy.
- `schemas.ts`: `OpenPrDto`, `OpenPrsDto`, `toOpenPrsDto`.
- `router.ts`: `getOpenPrs` (200 z `available: false` przy niedostępnym `gh`).
- `app/api/cockpit/open-prs/route.ts`: `export { getOpenPrs as GET } ...` plus `export const dynamic = "force-dynamic"`.
- UI: `src/features/home/OpenPrs.tsx` wzorowany na `ReviewRequests.tsx`, importuje z kontekstu tylko `schemas`;
  style: reużycie `kok-reviews__*`, nowe modyfikatory `kok-reviews__ref--draft` / `--ready` w `home.css`.
- i18n: `home:openPrs.{aria,title,empty,error,more,draft,ready}` w `pl` i `en`.

## Dane i prywatność

Tylko odczyt z GitHuba; nic nie trafia do vaulta. Nie dotyczy `Work/` ani `owner: work`.
Tytuły i nazwy prywatnych repo pokazują się wyłącznie w lokalnym UI, nie są nigdzie zapisywane.

## Testy (Vitest, najpierw czerwone)

`tests/unit/lib/github/my-open-prs.test.ts` (mock `runGh`):

- poprawny wiersz → `{ repo: "o/r", number: 5, draft: false, … }`; `isDraft: true` → `draft: true`;
- odrzucone: `url` spoza `https://github.com/`, `number` ≤ 0 lub nie całkowity, zła data, brak `repository`, `isDraft` nie boolean;
- niepoprawny JSON i `gh-missing` / `gh-error` → `ok: false`.

`tests/unit/contexts/bc_cockpit/`: `getOpenPrs`: sortowanie malejąco; 25 PR-ów → 20 pozycji i `total: 25`;
niedostępny `gh` → `available: false, total: 0, items: []`.

Istniejący test „trasy GET bez argumentów są force-dynamic” obejmie nową trasę.
`architecture.static.test.ts` bez zmian. Test komponentu `OpenPrs` (jeśli `ReviewRequests` ma analogiczny):
kolor/etykieta draftu, stan błędu, „+N więcej”.

## Poza zakresem

PR-y, w których użytkownik jest tylko recenzentem lub assignee; akcje na PR-ach (merge, komentarze);
status CI; filtrowanie po repo.
