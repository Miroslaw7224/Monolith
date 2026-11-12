# Testy integracyjne

Testy w tym katalogu korzystają z **prawdziwego** Firestore. Nie są uruchamiane w ramach `npm test` / `npm run test:run`.

## Testowa baza: emulator Firestore w Dockerze (zalecane)

Aby nie używać produkcyjnej bazy, uruchamiaj testy przeciw **emulatorowi Firestore w kontenerze Docker**. Wymagany tylko **Docker** (Docker Compose V2). W starszym środowisku użyj `docker-compose` zamiast `docker compose` w poniższych komendach.

**Uruchomienie emulatora (jedna komenda):**

```bash
docker compose -f docker-compose-test.yml up -d
```

lub:

```bash
npm run emulator:docker
```

**Testy w drugim terminalu:**

| Środowisko | Komenda                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| Unix/Mac   | `FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npm run test:integration`               |
| PowerShell | `$env:FIRESTORE_EMULATOR_HOST="localhost:8080"; $env:RUN_INTEGRATION_TESTS=1; npm run test:integration` |

**Zatrzymanie emulatora:**

```bash
docker compose -f docker-compose-test.yml down
```

**Pełny cykl w jednym wywołaniu (emulator → testy → down):**

```bash
npm run test:integration:docker
```

Na Windows długie łańcuchy z `&&` mogą nie działać w jednej komendzie — wtedy uruchom emulator i testy w dwóch terminalach jak wyżej, albo użyj WSL2 / skryptu .ps1.

**Znane ograniczenie:** Przy błędzie testów (exit code 1) skrypt `test:integration:docker` przerywa wykonanie przed `down`, więc kontener pozostaje uruchomiony. Ręcznie zatrzymaj: `docker compose -f docker-compose-test.yml down`. Na CI zwykle nie ma to znaczenia (runner efemeryczny); na maszynie deweloperskiej może być uciążliwe.

**Czyszczenie danych emulatora:** Ten sam endpoint co przy emulatorze działa z Dockerem. Użyj tego samego projektu co przy testach (`FIREBASE_PROJECT_ID` lub domyślnie `demo-nexus`):

- **Unix/Mac:**  
  `curl -X DELETE "http://localhost:8080/emulator/v1/projects/${FIREBASE_PROJECT_ID:-demo-nexus}/databases/(default)/documents"`
- **PowerShell:**  
  `$proj = if ($env:FIREBASE_PROJECT_ID) { $env:FIREBASE_PROJECT_ID } else { "demo-nexus" }; Invoke-RestMethod -Method Delete -Uri "http://localhost:8080/emulator/v1/projects/$proj/databases/(default)/documents"`

Opcjonalnie wywołaj przed testami (w beforeAll lub skrypcie) dla powtarzalności.

Podsumowanie: to emulator (tymczasowa baza w kontenerze), nie druga prawdziwa baza i nie drugi projekt Firebase. Zob. [ADR-016](../../docs/adr/016-firestore-emulator-docker.md).

## Uruchomienie bez emulatora (prawdziwy Firestore)

Jeśli nie używasz emulatora, uruchom testy integracyjne przeciw **prawdziwemu** Firestore z `.env`:

```bash
npm run test:integration:local
```

Użyj osobnego projektu Firebase tylko do testów (np. w `.env`: `FIREBASE_PROJECT_ID=nexus-test` + credentials testowe), żeby nie dotykać produkcji.

- **Z flagą (ręcznie):**  
  `RUN_INTEGRATION_TESTS=1 npm run test:integration`  
  (PowerShell: `$env:RUN_INTEGRATION_TESTS=1; npm run test:integration`)

  Uwaga: bez `FIRESTORE_EMULATOR_HOST` aplikacja łączy się z Firestore z konfiguracji env (np. .env) — ustaw projekt testowy, żeby uniknąć produkcji.

- **Bez flagi:**  
  `npm run test:integration` — testy wymagające Firestore są pomijane (skip).

## Wymagania

- Dla emulatora (zalecane): tylko Docker (Docker Compose V2) — zob. sekcja „Testowa baza: emulator Firestore w Dockerze” powyżej.
- Bez emulatora: skonfigurowane zmienne środowiskowe (np. konfiguracja Firebase/Firestore).
- W CI — osobny job: uruchom emulator w Dockerze, ustaw `FIRESTORE_EMULATOR_HOST` i `RUN_INTEGRATION_TESTS=1`, potem `npm run test:integration`.

Źródła: [ADR-015 Testing Strategy](../../docs/adr/015-testing-strategy.md), [ADR-016 Firestore Emulator Docker](../../docs/adr/016-firestore-emulator-docker.md).
