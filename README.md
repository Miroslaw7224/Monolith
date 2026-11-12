# Monolith (Freelancer Edition)

Aplikacja do planowania i organizacji pracy freelancera (zadania, kalendarz, notatki, zasoby, mapy myśli). Stack: Next.js 14 (App Router); dane w plikach Markdown/YAML w vaultcie NEXUS (bez logowania, jeden lokalny użytkownik; zob. [ADR-020](docs/adr/020-lokalne-pliki-zamiast-firestore.md)).

## Uruchomienie lokalne

**Wymagania:** Node.js 18+

1. Zainstaluj zależności: `npm install --legacy-peer-deps`
2. Skopiuj [.env.example](.env.example) do `.env` i uzupełnij:
   - `NEXUS_VAULT_PATH` — bezwzględna ścieżka do katalogu `Vault` (wymagane)
   - `FIREBASE_*` — tylko do skryptów eksportu danych z Firestore, do etapu 0e; aplikacja ich nie używa
3. Uruchom: `npm run dev` — aplikacja pod adresem http://127.0.0.1:3100 (otwiera się od razu na `/dashboard`, bez logowania)
4. Build: `npm run build`; produkcja: `npm start`

## Skrypty

- `npm run dev` — serwer deweloperski Next.js
- `npm run build` — build produkcyjny
- `npm start` — uruchomienie zbudowanej aplikacji
- `npm run lint` — lint (Next.js)
- `npm run test` — testy jednostkowe (Vitest)
- `npm run test:e2e` — testy E2E (Playwright) na własnym serwerze (port 3199) i tymczasowym vaulcie, bez dotykania prawdziwych danych
- `npm run migrate:sqlite-to-firestore` — migracja SQLite → Firestore (skrypt)

## Bezpieczeństwo lokalne

Serwer wiąże się tylko z `127.0.0.1`, a `middleware.ts` odrzuca obce nagłówki `Host` i obce żądania zmieniające stan. Narzędzia spoza przeglądarki (curl, skrypty) muszą wysyłać nagłówek `X-Nexus-Client: 1`. Aplikacja nie jest wdrażana (usunięcie z Vercela: etap 0e).

## Dane etatu (`Vault/Work/`)

Folder `Work/` w vaulcie jest przeznaczony na dane etatu i nie może trafić do repozytorium NEXUS: wpis `/Vault/Work/` w jego `.gitignore`. Warstwa plikowa (`lib/nexus/vault-fs.ts`) odmawia dostępu do `Work/`, chyba że wywołujący przejdzie przez `assertWorkAccess()` z `lib/workGuard.ts`, który sprawdza `git check-ignore` i brak śledzonych plików.

## Moduły i kluczowe funkcje

Struktura frontendu (komponenty, hooki, podfoldery `resources/` i `calendar/`) jest opisana w **ADR-019** (refaktoryzacja dużych plików). Wspólna utilita klas CSS: `src/lib/cn.ts`.

> Moduł "Wiedza" (chat RAG na dokumentach użytkownika, opisany dawniej w ADR-018/ADR-011) został usunięty z aplikacji. Notatki, zasoby i mapy myśli funkcjonują dziś jako samodzielne zakładki w module Planowanie.

- **Home** (`src/features/home/`): pulpit startowy — statystyki dnia (zadania, wydarzenia, notatki, zasoby, mapy myśli), lista zadań na dziś, nadchodzące wydarzenia, szybkie akcje i log aktywności/sesji pracy.

- **Planowanie** (`src/features/planowanie/`):
  - Kalendarz (`src/components/CalendarView.tsx` + `src/components/calendar/`): zdarzenia przechodzące przez północ są **dzielone na segmenty dni** (`expandEventToSegments` w `calendarUtils.ts`), żeby paski nie wychodziły poza siatkę godzin.
  - Log aktywności, **zadania** (lista + modal szczegółów `TaskDetailModal`: edycja tytułu, statusu, terminu i **notatki** zapisywanej w polu `description`; niebieska kropka na liście, gdy notatka jest wypełniona), tagi.
  - Notatki z edytorem TipTap — `src/features/notes/NotesPanel.tsx`.
  - **Mapy myśli** (`src/features/mind-maps/`): drzewo poziome, notatki per węzeł (TipTap), eksport do samodzielnego HTML, przeciąganie węzła na inny węzeł w celu **zagnieżdżenia** pod rodzicem.
  - **Zasoby** (`src/components/ResourceSection.tsx` + `src/components/resources/`):
    - Lista linków w Firestore (`users/{userId}/resources`), filtr po tagach + wyszukiwarka (tytuł, opis, URL).
    - Pasek **Ulubionych stron** (kafelki z faviconami), akcje: **Ulubione | Open link | Copy URL | Delete**, modal edycji. Ulubione (`isFavorite`) zapisywane w Firestore, sortowane na górę.

## AI

Aplikacja nie łączy się z żadnym modelem po API i nie wymaga kluczy. Uzupełnianie danych i zarządzanie vaultem prowadzą agenci CLI (Claude Code, Cursor, agy) w terminalu, przez kolejkę zleceń w vaulcie i serwer MCP. Zob. `docs/superpowers/specs/2026-11-12-agent-przez-cli-bez-api-design.md`.
