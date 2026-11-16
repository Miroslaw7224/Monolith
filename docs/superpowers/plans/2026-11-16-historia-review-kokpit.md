# Kokpit: panel „Review · ostatnie dni” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development lub superpowers:executing-plans. W tym repo wykonawcą jest Claude Code, a pomocnicy (`cursor`, `agy`) wykonują wskazane kroki (zob. plan `2026-11-16-review-requesty-kokpit.md`, sekcja „Podział pracy”).

**Goal:** Panel z liczbą zatwierdzeń i komentarzy review dzień po dniu (7 dni) na górze Kokpitu.

**Architecture:** `lib/github/gh.ts` (wspólny runner `gh`) → `lib/github/my-reviews.ts` (zapytanie GraphQL) → `bc_cockpit` (`repositories` → `services` → `router`) → `GET /api/cockpit/review-history` → `ReviewHistory.tsx`. Spec: `docs/superpowers/specs/2026-11-16-historia-review-kokpit-design.md` (zawiera sygnatury i reguły; plan poniżej to kolejność i przypadki testowe).

**Tech Stack:** Next.js 14, TypeScript, Vitest + Testing Library, i18next.

Zasady wykonania jak w poprzednim planie: TDD (czerwony → zielony → commit), mechaniczne sprawdzenia przez `cursor` (`--tier light --approve-allowed`), review przez `agy` (`AGY_DEEP_TAG=Hydrogen`), push tylko na prośbę.

## Task 1: Wydzielenie `lib/github/gh.ts` (refaktor bez zmiany zachowania)

- Create `lib/github/gh.ts`: `runGh(args)` przeniesiony z `review-requests.ts` (limit 8 s, `maxBuffer` jako opcjonalny parametr, domyślnie 256 KB).
- Modify `lib/github/review-requests.ts`: używa `runGh(GH_ARGS)`.
- Test: istniejący `tests/unit/lib/github/review-requests.test.ts` ma przejść bez zmian (zielony przed i po).
- Commit: `refactor(github): wspólny runner gh`.

## Task 2: `lib/github/my-reviews.ts`

- Test (czerwony): `tests/unit/lib/github/my-reviews.test.ts` (mock `node:child_process` jak w teście review-requests). Przypadki wg specu §4 (lib), z wartościami: JSON z `viewer.login = "me"`, dwoma PR-ami, review `{state:"APPROVED", author:"me"}`, `{state:"COMMENTED", author:"inny"}`, `{state:"PENDING", author:"me"}`, `{state:"DISMISSED", author:"me"}`, `{state:"APPROVED", author:"me", submittedAt: null}` → w wyniku tylko pierwszy; `updatedSince: "jutro"` → `{ ok: false, reason: "gh-error" }` i `execFile` nie wywołane; argumenty: `["api","graphql","-f","q=is:pr reviewed-by:@me updated:>=2026-11-09","-f","query=<stałe zapytanie>"]`.
- Implementacja wg specu §3. Commit: `feat(github): własne review z GitHuba (my-reviews)`.

## Task 3: Kontekst `bc_cockpit` i trasa

- Testy (czerwone) w `tests/unit/contexts/bc_cockpit/`: `reviews-repository.test.ts` (`loadMyReviews`: ok / `ok:false` → `available:false`), `services.test.ts` (`getReviewHistory`: przypadki ze specu §4, today = 2026-11-16, 7 dni od 2026-11-10; np. review APPROVED 2026-11-15T18:34Z → dzień 15.11), `schemas.test.ts` (`toReviewHistoryDto`), `router.test.ts` (`GET /api/cockpit/review-history`).
- Implementacja: `models.ts`, `repositories.ts`, `services.ts`, `schemas.ts`, `router.ts`, `app/api/cockpit/review-history/route.ts`.
- Weryfikacja: `npx vitest run tests/unit/contexts/bc_cockpit tests/unit/architecture.static.test.ts`, `npx tsc --noEmit`. Commit: `feat(cockpit): GET /api/cockpit/review-history`.

## Task 4: UI, teksty i pozycja

- Test (czerwony): `tests/unit/features/home/ReviewHistory.test.tsx` i `ReviewHistory.en.test.tsx`; w `HomeView.test.tsx` test kolejności („historia review stoi nad listą Do zrecenzowania”) i mock `/api/cockpit/review-history` w `respond` obu plików `HomeView*.test.tsx`.
- Implementacja: teksty PL/EN (`home.ts`, piszę sam), `ReviewHistory.tsx`, `CockpitSections.tsx`.
- Commit: `feat(home): panel „Review · ostatnie dni” na górze Kokpitu`.

## Task 5: Weryfikacja i review

- `cursor`: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build` (po jednym poleceniu).
- `agy` (read-only, `--role review --tier deep --fresh`): review diffa od commitu `9a4af45` (`git diff 9a4af45..HEAD`): zgodność ze specem, poprawność dnia lokalnego, walidacja wejścia GraphQL, luki w testach. Uzasadnione uwagi poprawiam z testem.
