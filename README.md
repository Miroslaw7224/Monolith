# Monolith (Freelancer Edition)

Aplikacja do planowania i organizacji pracy freelancera (zadania, kalendarz, notatki, zasoby, mapy myśli). Stack: Next.js 14 (App Router); dane w plikach Markdown/YAML w vaultcie NEXUS (bez logowania, jeden lokalny użytkownik; zob. [ADR-020](docs/adr/020-lokalne-pliki-zamiast-firestore.md)).

## Uruchomienie lokalne

**Wymagania:** Node.js 18+

1. Zainstaluj zależności: `npm install --legacy-peer-deps`
2. Skopiuj [.env.example](.env.example) do `.env` i uzupełnij:
   - `NEXUS_VAULT_PATH` — bezwzględna ścieżka do katalogu `Vault` (wymagane)
3. Uruchom: `npm run dev` — aplikacja pod adresem http://127.0.0.1:3100 (otwiera się od razu na `/dashboard`, bez logowania)
4. Build: `npm run build`; produkcja: `npm start`

## Skrypty

- `npm run dev` — serwer deweloperski Next.js
- `npm run build` — build produkcyjny
- `npm start` — uruchomienie zbudowanej aplikacji
- `npm run lint` — lint (Next.js)
- `npm run test` — testy jednostkowe (Vitest)
- `npm run test:e2e` — testy E2E (Playwright) na własnym serwerze (port 3199) i tymczasowym vaulcie, bez dotykania prawdziwych danych

## Bezpieczeństwo lokalne

Serwer wiąże się tylko z `127.0.0.1`, a `middleware.ts` odrzuca obce nagłówki `Host` i obce żądania zmieniające stan. Narzędzia spoza przeglądarki (curl, skrypty) muszą wysyłać nagłówek `X-Nexus-Client: 1`. Aplikacja nie jest nigdzie wdrażana.

## Dane etatu (`Vault/Work/`)

Folder `Work/` w vaulcie jest przeznaczony na dane etatu i nie może trafić do repozytorium NEXUS: wpis `/Vault/Work/` w jego `.gitignore`. Warstwa plikowa (`lib/nexus/vault-fs.ts`) odmawia dostępu do `Work/`, chyba że wywołujący przejdzie przez `assertWorkAccess()` z `lib/workGuard.ts`, który sprawdza `git check-ignore` i brak śledzonych plików.

## Moduły i kluczowe funkcje

Struktura repo i reguły importów: [ADR-021](docs/adr/021-struktura-kontekstow-wg-vaulta-nexus.md) (logika domen w `contexts/bc_*/`, trasy `app/api/**/route.ts` tylko re-eksportują handlery, UI w `src/features/<moduł>/`, wspólne komponenty w `src/components/`). Podział dużych plików frontendu: ADR-019. Wspólna utilita klas CSS: `src/lib/cn.ts`.

> Moduł "Wiedza" (chat RAG na dokumentach użytkownika, opisany dawniej w ADR-018/ADR-011) został usunięty z aplikacji. Notatki, zasoby i mapy myśli funkcjonują dziś jako samodzielne zakładki w module Planowanie.

- **Konteksty domenowe** (`contexts/`): `bc_projects`, `bc_tags`, `bc_tasks`, `bc_calendar`, `bc_notes`, `bc_resources`, `bc_board`, `bc_mind_maps`. Każdy ma siatkę `router` / `schemas` / `models` / `services` / `repositories`; zapis do vaulta wyłącznie w `repositories`, UI importuje z kontekstu tylko `schemas`. Test `tests/unit/architecture.static.test.ts` pilnuje kierunku zależności.
- **API projektów:** `GET /api/projects` — lista + ostrzeżenia; `GET /api/projects/[id]` — teczka projektu (z `type`, `state`, `stateVersion`, `devlog`); `PATCH /api/projects/[id]` — zmiana `type`; `PUT /api/projects/[id]/state` — zapis Save State (`state.md`, z kontrolą wersji, 409 przy konflikcie); `POST /api/projects/[id]/devlog` — dopisanie wpisu do `devlog.md`. Trasy w `app/api/projects/**` re-eksportują handlery z kontekstu.
- **Home** (`src/features/home/`): pulpit startowy — statystyki dnia (zadania, wydarzenia, notatki, zasoby, mapy myśli), lista zadań na dziś, nadchodzące wydarzenia, szybkie akcje i log aktywności/sesji pracy.

- **Projekty** (`src/features/projects/`): karta Alt+4 — rejestr i teczka projektu z vaulta NEXUS, Save State (`state.md`), dziennik decyzji (`devlog.md`, tylko dopisywanie) i typ projektu (zapis do vaulta); UI zna tylko DTO i zod z `contexts/bc_projects/schemas`.
- **Planowanie** (`src/features/planowanie/`):
  - Kalendarz (`src/features/calendar/CalendarView.tsx`): zdarzenia przechodzące przez północ są **dzielone na segmenty dni** (`expandEventToSegments` w `calendarUtils.ts`), żeby paski nie wychodziły poza siatkę godzin.
  - Log aktywności (`src/components/sessions/`), **zadania** (`src/features/tasks/`; lista + modal szczegółów `TaskDetailModal`: edycja tytułu, statusu, terminu i **notatki** zapisywanej w polu `description`; niebieska kropka na liście, gdy notatka jest wypełniona), tagi (`src/features/tags/`).
  - Notatki z edytorem TipTap — `src/features/notes/NotesPanel.tsx`.
  - **Mapy myśli** (`src/features/mind-maps/`): drzewo poziome, notatki per węzeł (TipTap), eksport do samodzielnego HTML, przeciąganie węzła na inny węzeł w celu **zagnieżdżenia** pod rodzicem.
  - **Tablica** (`src/features/board/`): płótno z kafelkami, ramkami i strzałkami; zapis w vaulcie (`Board/board.json`, `contexts/bc_board`).
  - **Zasoby** (`src/features/resources/`):
    - Lista linków w vaulcie (`Resources/resources.yaml`), filtr po tagach + wyszukiwarka (tytuł, opis, URL).
    - Pasek **Ulubionych stron** (kafelki z faviconami), akcje: **Ulubione | Open link | Copy URL | Delete**, modal edycji. Ulubione (`favorite`) zapisywane w vaulcie, sortowane na górę.

## AI

Aplikacja nie łączy się z żadnym modelem po API i nie wymaga kluczy. Uzupełnianie danych i zarządzanie vaultem prowadzą agenci CLI (Claude Code, Cursor, agy) w terminalu, przez kolejkę zleceń w vaulcie i serwer MCP. Zob. `docs/superpowers/specs/2026-11-12-agent-przez-cli-bez-api-design.md`.
