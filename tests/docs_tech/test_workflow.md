# Workflow testów – komendy i uruchomienie

## Testy jednostkowe

| Cel                  | Skrypt                  | Ręcznie                     |
| -------------------- | ----------------------- | --------------------------- |
| Uruchom (watch)      | `npm test`              | —                           |
| Jednorazowy przebieg | `npm run test:run`      | `npx vitest run`            |
| Z pokryciem          | `npm run test:coverage` | `npx vitest run --coverage` |

Baza: brak. Repozytoria testuje się na tymczasowym vaulcie (`tests/unit/helpers/tempVault.ts`), serwisy mockami `repositories` własnego kontekstu.

---

## Testy integracyjne (Firestore)

### Emulator w Dockerze (zalecane)

Wymagany tylko Docker (Docker Compose V2). W starszym środowisku użyj `docker-compose` zamiast `docker compose`.

| Cel                                  | Komenda                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Uruchom emulator                     | `docker compose -f docker-compose-test.yml up -d` lub `npm run emulator:docker`                         |
| Testy (drugi terminal, Unix/Mac)     | `FIRESTORE_EMULATOR_HOST=localhost:8080 RUN_INTEGRATION_TESTS=1 npm run test:integration`               |
| Testy (drugi terminal, PowerShell)   | `$env:FIRESTORE_EMULATOR_HOST="localhost:8080"; $env:RUN_INTEGRATION_TESTS=1; npm run test:integration` |
| Zatrzymaj emulator                   | `docker compose -f docker-compose-test.yml down`                                                        |
| Pełny cykl (emulator → testy → down) | `npm run test:integration:docker`                                                                       |

Przy błędzie testów kontener nie jest gaszony — ręcznie: `docker compose -f docker-compose-test.yml down`. Na Windows jedna komenda `test:integration:docker` może wymagać WSL2 lub skryptu .ps1.

### Bez emulatora (prawdziwy Firestore z .env)

**Bez emulatora:** uruchom testy przeciw Firestore z konfiguracji `.env` (użyj projektu testowego, nie produkcji):

```bash
npm run test:integration:local
```

| Sposób               | Komenda                                                  |
| -------------------- | -------------------------------------------------------- |
| Skrypt               | `npm run test:integration:local`                         |
| Ręcznie (Unix/Mac)   | `RUN_INTEGRATION_TESTS=1 npm run test:integration`       |
| Ręcznie (PowerShell) | `$env:RUN_INTEGRATION_TESTS=1; npm run test:integration` |

Bez zmiennej `RUN_INTEGRATION_TESTS=1` testy wymagające Firestore są pomijane (skip).

---

## Testy E2E (Playwright)

Testy w przeglądarce Chromium — strona główna, ekran logowania. Serwer dev uruchamiany automatycznie na porcie **3100** (lub używany już działający).

| Cel                               | Komenda                           |
| --------------------------------- | --------------------------------- |
| Uruchom testy E2E                 | `npm run test:e2e`                |
| Tryb UI (debug)                   | `npm run test:e2e:ui`             |
| Instalacja Chromium (jednorazowo) | `npx playwright install chromium` |

Konfiguracja: `playwright.config.ts`. Raport HTML po przebiegu (np. `playwright-report/`). Zob. [ADR-015](../../docs/adr/015-testing-strategy.md) sekcja 3 (Testy E2E).

---

Szczegóły: [tests/integration/README.md](../integration/README.md), [ADR-015](../../docs/adr/015-testing-strategy.md), [ADR-016](../../docs/adr/016-firestore-emulator-docker.md).
