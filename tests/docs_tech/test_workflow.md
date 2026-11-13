# Workflow testów – komendy i uruchomienie

## Testy jednostkowe

| Cel                  | Skrypt                  | Ręcznie                     |
| -------------------- | ----------------------- | --------------------------- |
| Uruchom (watch)      | `npm test`              | —                           |
| Jednorazowy przebieg | `npm run test:run`      | `npx vitest run`            |
| Z pokryciem          | `npm run test:coverage` | `npx vitest run --coverage` |

Baza: brak. Repozytoria testuje się na tymczasowym vaulcie (`tests/unit/helpers/tempVault.ts`), serwisy mockami `repositories` własnego kontekstu.

---

## Testy E2E (Playwright)

Testy w przeglądarce Chromium. Działają na własnym serwerze na porcie **3199** z tymczasowym vaultem (`tests/e2e/global-setup.ts`), bez ekranu logowania i bez użycia działającego serwera dev na 3100.

| Cel                               | Komenda                           |
| --------------------------------- | --------------------------------- |
| Uruchom testy E2E                 | `npm run test:e2e`                |
| Tryb UI (debug)                   | `npm run test:e2e:ui`             |
| Instalacja Chromium (jednorazowo) | `npx playwright install chromium` |

Konfiguracja: `playwright.config.ts`. Raport HTML po przebiegu (np. `playwright-report/`). Zob. [ADR-015](../../docs/adr/015-testing-strategy.md) sekcja 3 (Testy E2E).

---

Szczegóły: [ADR-015](../../docs/adr/015-testing-strategy.md).
