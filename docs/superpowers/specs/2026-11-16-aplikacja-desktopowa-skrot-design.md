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
- **Pliki konfiguracyjne:** build w worktree nie modyfikuje `tsconfig.json` ani `next-env.d.ts` w katalogu roboczym dev. Dzięki temu znacznik „czy przebudować" nie zależy od niezacommitowanych zmian.
- **Vault:** oba procesy czytają i piszą te same pliki, tak jak dwie karty przeglądarki dziś. Brak blokad, ostatni zapis wygrywa. Akceptowalne dla jednego użytkownika. Gdyby w przyszłości powstał cache w pamięci (np. przy `/api/cockpit`), nie może przeżywać zapisu z drugiego procesu; dlatego cache ma mieć krótki czas życia (sekundy).
- **Zasoby:** dwa procesy Node (RAM). Akceptowalne.

## Start ze skrótu

Skrót Windows `Monolith.lnk` ma jedną, cienką komendę: `wsl.exe` wchodzi do `Monolith-prod`, ustawia worktree na `main` (`git checkout --detach main`) i uruchamia `scripts/start-prod.sh` z już zaktualizowanego worktree. Cała logika żyje w repo (kontrola wersji), skrót się nie starzeje.

`scripts/start-prod.sh`:

1. Liczy znacznik: `git rev-parse HEAD` + hash `package-lock.json`.
2. Zmienił się `package-lock.json`: `npm ci --ignore-scripts` (bez hooków husky, żeby nie ruszać wspólnej konfiguracji git).
3. Porównuje znacznik z zapisanym po ostatnim udanym buildzie. Zgodny: pomija build. Różny: `next build` (w konsoli „Buduję…"), po sukcesie zapis znacznika.
4. Port 3101: jeśli już odpowiada Monolith, tylko otwiera okno. Jeśli zajęty przez coś innego, kończy z komunikatem.
5. Startuje `next start -p 3101 -H 127.0.0.1`, czeka na odpowiedź, wysyła jedno `GET /api/cockpit` (prewarm), dopiero potem otwiera okno.
6. Gdy okno się zamknie, zatrzymuje serwer.

### Okno i konsola

- **Podczas budowania i startu** widać konsolę z logiem („Buduję…", „Startuję…"). Po otwarciu okna konsola zostaje zminimalizowana.
- **Błąd builda:** konsola zostaje otwarta z komunikatem błędu. Jeśli istnieje poprzedni udany build, start z nim (z ostrzeżeniem w konsoli); jeśli nie, koniec po naciśnięciu klawisza.
- **Okno aplikacji:** `msedge.exe --app=http://127.0.0.1:3101` z dedykowanym profilem (`--user-data-dir` w `%LOCALAPPDATA%\Monolith`). Dzięki temu proces Edge jest osobny (skrypt może poczekać na jego zakończenie i wtedy wyłączyć serwer), a Monolith ma własną ikonę na pasku zadań. Skutek uboczny: `localStorage` nowego origin (127.0.0.1:3101) jest pusty, więc motyw i język trzeba ustawić raz.

### Nazwa i ikona

Skrót nazywa się **Monolith**, tytuł okna również (do sprawdzenia w `app/layout.tsx`). Ikona `.ico` powstaje jednorazowo z `app/icon.svg` i leży w repo.

### Konfiguracja (`NEXUS_VAULT_PATH`)

Zmienne są w `.env` (poza gitem). Skrypt `setup-prod.sh` tworzy w `Monolith-prod` dowiązanie do `.env` z `Monolith`, więc ikona i dev używają tego samego vaulta bez kopiowania.

### Jednorazowa instalacja

`scripts/setup-prod.sh` (uruchamiany raz): tworzy worktree, `npm ci --ignore-scripts`, dowiązanie `.env`, pierwszy build. Skrót `.lnk` na pulpicie tworzy się osobno (PowerShell z Windows); komenda w planie.

## Przyspieszenie (hipotezy do zmierzenia)

1. **Produkcja zamiast dev:** brak kompilacji tras w locie (najpewniejszy zysk).
2. **Lazy loading widoków:** `src/App.tsx:10-25` importuje statycznie `PlanowanieView`, `ProjectsView`, `MapView`, `CodexView`, więc ciężkie biblioteki (`@xyflow/react`, `recharts`, `tiptap`) trafiają do pierwszego bundla. `next/dynamic` (`ssr: false`) dla tych widoków; Kokpit startuje z samym `HomeView`.
3. **Szybszy `/api/cockpit` (warunkowo, tylko po pomiarze):** `getCockpit` woła `listGitActivity` przez `execFileSync` (`lib/git/project-git.ts:23`), a `hc ls` też jest synchroniczne (`lib/herdr/hc-ls.ts:51`). Opcje: asynchroniczny `execFile` wołany równolegle, krótki cache wyniku. Dotyka `lib/git`, `lib/herdr`, `contexts/bc_projects`.
4. **Prewarm** po starcie serwera (patrz wyżej).

Warstwa 3 nie wchodzi do planu, dopóki pomiar nie pokaże, że API jest wąskim gardłem.

## Pomiar bazowy (pierwszy krok planu)

Zlecić `cursorowi`: czas `next build`, zimny `next start` do pierwszej odpowiedzi, TTFB `GET /api/cockpit`, rozmiar pierwszego bundla (np. `@next/bundle-analyzer`). Powtórzyć po zmianach 1-2.

## Testy

Logika skryptów (znacznik builda, wybór: build / pomiń / fallback, zajęty port) w małych funkcjach testowalnych Vitestem, jak `scripts/approve-check.py` (testy w `tests/unit/scripts/`). Lazy loading: test, że `App` renderuje Kokpit bez importu `MapView`/`CodexView` (przypadki w planie). Reszta (skrót, okno Edge) to ręczny przegląd po instalacji.

## Poza zakresem

Instalator `.exe`, autostart w tle, telefon, Electron/Tauri.
