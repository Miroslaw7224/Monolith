# Aplikacja „desktopowa": skrót Monolith na pulpicie i szybszy start

Status: projekt do przeglądu użytkownika (2026-11-16). Zakres: skrót i skrypty startowe oraz przyspieszenie wczytywania.

## Cel

Uruchamiać Monolith jak zwykły program (ikona „Monolith" na pulpicie Windows, okno bez paska przeglądarki) i skrócić czas wczytywania.

## Ustalenia

- **Nie robimy Electrona ani Tauri.** Serwer Node i tak musi działać w WSL (vault w WSL, `git`, `gh`, `hc` przez `child_process`: `lib/git`, `lib/github`, `lib/herdr`), więc powłoka na Windows niczego nie upraszcza, a kosztuje RAM i integrację procesów.
- **`output: export` odpada:** 49 route handlerów `app/api/**` wymaga serwera Node.
- **„Instalka":** skrót na pulpicie, bez instalatora `.exe`.
- **Serwer startuje dopiero ze skrótu** (bez autostartu w tle) i kończy się razem z oknem.
- **Ikona zawsze pokazuje `main`.** Dane z vaulta nie wymagają przebudowy (API czyta pliki przy każdym żądaniu); zmiana kodu trafia do ikony po merge'u do `main`.

## Dwa tryby, dwa katalogi, dwa porty

| Tryb                      | Do czego                | Katalog                                          | Port | Start                         |
| ------------------------- | ----------------------- | ------------------------------------------------ | ---- | ----------------------------- |
| Ikona (`next start`)      | codzienne używanie      | `~/projects/Brain_7224/Monolith-prod` (worktree) | 3101 | klik w ikonę                  |
| `npm run dev` (bez zmian) | zmiany w kodzie na żywo | `~/projects/Brain_7224/Monolith`                 | 3100 | ręcznie w terminalu, jak dziś |

`Monolith-prod` to `git worktree` repozytorium Monolith, ustawiony w trybie detached na `main`, z własnym `node_modules` i własnym `.next`. Leży obok `Monolith` i `NEXUS`, nie wewnątrz repo (worktree w środku zaśmiecałby lint, testy i narzędzia agentów). Dysk ma ponad 900 GB wolnego, więc dodatkowy 1,3 GB nie przeszkadza.

### Czy oba tryby się gryzą?

- **Artefakty builda:** nie. Osobne katalogi (`.next` w każdym worktree), więc `next build` ikony nie rusza dev i odwrotnie. Dev na gałęzi roboczej nie wpływa na ikonę, bo ta czyta tylko `main`.
- **Pliki konfiguracyjne:** build w worktree prod modyfikuje śledzony `tsconfig.json` (Next dopisuje `.next-<hash>/types` i przeformatowuje plik), ale nie dotyka katalogu dev. Dlatego skrypt robi `git checkout -f --detach main` i decyzja „czy przebudować" opiera się na katalogu builda, nie na stanie plików.
- **Vault:** oba procesy czytają i piszą te same pliki, tak jak dwie karty przeglądarki dziś. Brak blokad, ostatni zapis wygrywa. Akceptowalne dla jednego użytkownika. Gdyby w przyszłości powstał cache w pamięci (np. przy `/api/cockpit`), nie może przeżywać zapisu z drugiego procesu; dlatego cache ma mieć krótki czas życia (sekundy).
- **Zasoby:** dwa procesy Node (RAM). Akceptowalne.

## Start ze skrótu

Skrót Windows `Monolith.lnk` ma jedną, cienką komendę: `wsl.exe` wchodzi do `Monolith-prod`, wykonuje tylko `cd '<Monolith-prod>' && exec bash scripts/prod/start-prod.sh`. Cała logika żyje w repo (kontrola wersji), skrót się nie starzeje. `git checkout -q -f --detach main` robi sam `start-prod.sh` (`-f`, bo build zmienia śledzone pliki), tylko w katalogu `Monolith-prod`, pod blokadą `flock` (drugie kliknięcie w czasie builda czeka, a potem tylko otwiera okno); po checkoutcie uruchamia się od nowa, bo skrypt mógł się zmienić na dysku.

`scripts/prod/start-prod.sh` (funkcje pomocnicze w `scripts/prod/lib.sh`):

1. Liczy nazwę katalogu builda `.next-<12 znaków HEAD>`; znacznikiem udanego builda jest plik `.monolith-ok` w tym katalogu (nieudany build nie niszczy poprzedniej wersji; zostają 2 ostatnie udane).
2. Zmienił się `package-lock.json` (hash w `node_modules/.monolith-lock-hash`, służy tylko do tej decyzji): `npm ci --ignore-scripts` (bez hooków husky, żeby nie ruszać wspólnej konfiguracji git).
3. Jest `.monolith-ok` dla bieżącego HEAD: pomija build. Brak: `next build` do `NEXT_DIST_DIR` (w konsoli „Buduję…"), po sukcesie zapis znacznika i prune.
4. Port 3101: jeśli już odpowiada Monolith, tylko otwiera okno. Jeśli zajęty przez coś innego, kończy z komunikatem.
5. Startuje `next start -p 3101 -H 127.0.0.1`, czeka na odpowiedź, wysyła jedno `GET /api/cockpit` (prewarm), dopiero potem otwiera okno.
6. Gdy okno się zamknie, zatrzymuje serwer.

### Okno i konsola

- **Podczas budowania i startu** widać konsolę z logiem („Buduję…", „Startuję…"). Skrót startuje konsolę zminimalizowaną (`WindowStyle = 7`), żeby nie wyskakiwała na pierwszy plan i nie dało się jej łatwo zamknąć przez pomyłkę; log jest w niej dostępny z paska zadań. Zamknięcie konsoli zatrzymuje serwer. Błędy startu (zajęty port, nieudany build bez poprzedniej wersji) `start-prod.sh` pokazuje w oknie Windows (MessageBox z PowerShella), bo ukryta konsola nie zostałaby zauważona.
- **Błąd builda:** konsola zostaje otwarta z komunikatem błędu. Jeśli istnieje poprzedni udany build, start z nim (z ostrzeżeniem w konsoli); jeśli nie, koniec po naciśnięciu klawisza.
- **Okno aplikacji:** `msedge.exe --app=http://127.0.0.1:3101` z dedykowanym profilem (`--user-data-dir` w `%LOCALAPPDATA%\Monolith`). Dzięki temu proces Edge jest osobny (skrypt może poczekać na jego zakończenie i wtedy wyłączyć serwer), a Monolith ma własną ikonę na pasku zadań. Skutek uboczny: `localStorage` nowego origin (127.0.0.1:3101) jest pusty, więc motyw i język trzeba ustawić raz.

### Nazwa i ikona

Skrót nazywa się **Monolith**, tytuł okna również (do sprawdzenia w `app/layout.tsx`). Ikona `.ico` powstaje jednorazowo z `app/apple-icon.png` (`scripts/prod/make-ico.ts`) i leży w repo.

### Konfiguracja (`NEXUS_VAULT_PATH`)

Zmienne są w `.env` (poza gitem). Skrypt `setup-prod.sh` tworzy w `Monolith-prod` dowiązanie do `.env` z `Monolith`, więc ikona i dev używają tego samego vaulta bez kopiowania.

### Jednorazowa instalacja

`scripts/prod/setup-prod.sh` (uruchamiany raz, z `Monolith` po merge'u do `main`): tworzy worktree, `npm ci --ignore-scripts`, dowiązanie `.env`, pierwszy build. Skrót `.lnk` na pulpicie tworzy się osobno (PowerShell z Windows); komenda w planie.

## Przyspieszenie (hipotezy do zmierzenia)

1. **Produkcja zamiast dev:** brak kompilacji tras w locie (najpewniejszy zysk).
2. **Lazy loading widoków:** `src/App.tsx:10-25` importuje statycznie `PlanowanieView`, `ProjectsView`, `MapView`, `CodexView`, więc ciężkie biblioteki (`@xyflow/react`, `recharts`, `tiptap`) trafiają do pierwszego bundla. `next/dynamic` (`ssr: false`) dla tych widoków; Kokpit startuje z samym `HomeView`.
3. **Szybszy `/api/cockpit` (warunkowo, tylko po pomiarze):** `getCockpit` woła `listGitActivity` przez `execFileSync` (`lib/git/project-git.ts:23`), a `hc ls` też jest synchroniczne (`lib/herdr/hc-ls.ts:51`). Opcje: asynchroniczny `execFile` wołany równolegle, krótki cache wyniku. Dotyka `lib/git`, `lib/herdr`, `contexts/bc_projects`.
4. **Prewarm** po starcie serwera (patrz wyżej).

Warstwa 3 nie wchodzi do planu, dopóki pomiar nie pokaże, że API jest wąskim gardłem. Pomiar (`docs/superpowers/plans/2026-11-16-aplikacja-desktopowa-pomiary.md`): TTFB `/api/cockpit` po rozgrzaniu 57-85 ms, więc warstwa 3 jest niepotrzebna. Lazy loading: `/dashboard` First Load JS 436 kB -> 205 kB. Pierwszy build trwa ok. 8 minut (zimny cache), kolejne ok. pół minuty.

## Pomiar bazowy (pierwszy krok planu)

Zlecić `cursorowi`: czas `next build`, zimny `next start` do pierwszej odpowiedzi, TTFB `GET /api/cockpit`, rozmiar pierwszego bundla (np. `@next/bundle-analyzer`). Powtórzyć po zmianach 1-2.

## Testy

Logika skryptów (znacznik builda, wybór: build / pomiń / fallback, zajęty port) w małych funkcjach testowalnych Vitestem, jak `scripts/approve-check.py` (testy w `tests/unit/scripts/`). Lazy loading: test statyczny (`tests/unit/desktop-shell.static.test.ts`, regex po `src/App.tsx`), nie test renderujący `App`. Reszta (skrót, okno Edge) to ręczny przegląd po instalacji.

## Poza zakresem

Instalator `.exe`, autostart w tle, telefon, Electron/Tauri.
