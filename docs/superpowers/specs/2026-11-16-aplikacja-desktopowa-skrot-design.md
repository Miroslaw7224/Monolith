# Aplikacja „desktopowa": skrót na pulpicie i szybszy start (szkic)

Status: wersja skrócona po brainstormingu (2026-11-16). Szczegóły skrótu i skryptu do uzupełnienia w kolejnej wersji.

## Cel

Uruchamiać Monolith jak zwykły program (ikona na pulpicie Windows, okno bez paska przeglądarki) i skrócić czas wczytywania.

## Ustalenia

- **Nie robimy Electrona ani Tauri.** Serwer Node i tak musi działać w WSL (vault w WSL, `git`, `gh`, `hc` przez `child_process`: `lib/git`, `lib/github`, `lib/herdr`), więc powłoka na Windows niczego nie upraszcza, a kosztuje RAM i integrację procesów.
- **`output: export` odpada:** 49 route handlerów `app/api/**` wymaga serwera Node.
- **Wariant „instalka":** skrót na pulpicie + okno `msedge.exe --app=http://127.0.0.1:3101`. Bez instalatora `.exe`.
- **Serwer startuje dopiero ze skrótem** (bez autostartu w tle).
- Dane z vaulta nie wymagają przebudowy (API czyta pliki przy każdym żądaniu). Kod wymaga `next build`.

## Dwa tryby, dwa porty

| Tryb                            | Do czego                | Start                         | Port | Katalog builda                       |
| ------------------------------- | ----------------------- | ----------------------------- | ---- | ------------------------------------ |
| Ikona (produkcja, `next start`) | codzienne używanie      | klik w ikonę                  | 3101 | `.next-prod` (przez `NEXT_DIST_DIR`) |
| `npm run dev`                   | zmiany w kodzie na żywo | ręcznie w terminalu, jak dziś | 3100 | `.next`                              |

Oba mogą działać równolegle. Aktualizacja wersji z ikony: zamknąć okno i kliknąć ikonę ponownie, bez ręcznych komend.

## Start ze skrótu (wariant A: auto-przebudowa)

1. Skrypt liczy stan kodu: hash `HEAD` + hash niezacommitowanych zmian (`git diff HEAD`).
2. Porównuje ze znacznikiem zapisanym po ostatnim buildzie (w `.next-prod`).
3. Zgodny: od razu `next start`. Różny: `next build` (komunikat „Buduję…"), zapis znacznika, `next start`.
4. Po starcie serwera jedno `GET /api/cockpit` (prewarm), dopiero potem otwarcie okna `--app`.

Skutek uboczny: skrót buduje kod bieżącej gałęzi w katalogu, nie zawsze `main`. Wariant „zawsze main" (worktree z osobnym `node_modules`) odrzucony jako zbyt kosztowny na start.

## Przyspieszenie (hipotezy do zmierzenia)

1. **Produkcja zamiast dev:** brak kompilacji tras w locie (najpewniejszy zysk).
2. **Lazy loading widoków:** `src/App.tsx:10-25` importuje statycznie `PlanowanieView`, `ProjectsView`, `MapView`, `CodexView`, więc ciężkie biblioteki (`@xyflow/react`, `recharts`, `tiptap`) trafiają do pierwszego bundla. `next/dynamic` (`ssr: false`) dla tych widoków; Kokpit startuje z samym `HomeView`.
3. **Szybszy `/api/cockpit` (warunkowo, tylko po pomiarze):** `getCockpit` woła `listGitActivity` przez `execFileSync` (`lib/git/project-git.ts:23`), a `hc ls` też jest synchroniczne (`lib/herdr/hc-ls.ts:51`). Opcje: asynchroniczny `execFile` wołany równolegle, krótki cache wyniku. Dotyka `lib/git`, `lib/herdr`, `contexts/bc_projects`.
4. **Prewarm** po starcie serwera (patrz wyżej).

Warstwa 3 nie wchodzi do planu, dopóki pomiar nie pokaże, że API jest wąskim gardłem.

## Pomiar bazowy (pierwszy krok planu)

Zlecić `cursorowi`: czas `next build`, zimny `next start` do pierwszej odpowiedzi, TTFB `GET /api/cockpit`, rozmiar pierwszego bundla (np. `@next/bundle-analyzer`). Powtórzyć po zmianach 1-2.

## Do ustalenia w szczegółach

- Gdzie leży skrypt startowy i jak ikona woła WSL (`wsl.exe`, ukryte okno vs konsola z logiem).
- Wygląd okna w czasie budowania i obsługa błędu builda.
- Zamykanie serwera po zamknięciu okna; obsługa zajętego portu 3101.
- Ikona i nazwa skrótu.
- Zmienna `NEXUS_VAULT_PATH` dla trybu produkcyjnego.

## Poza zakresem

Instalator `.exe`, autostart w tle, worktree „zawsze main", telefon.
