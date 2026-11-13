# ADR-015: Strategia testów aplikacji

## Status

Zaakceptowany

## Kontekst

W projekcie Second Brain nie ma zdefiniowanej strategii testów: brak runnera w `package.json`, brak plików testowych. ADR-014 (Separacja warstw i Service Layer) zakłada, że logika biznesowa w `services/` ma być testowana bez HTTP — serwisy wywołują wyłącznie moduły z `lib/` (Firestore, Gemini), więc testy jednostkowe z mockami infrastruktury są realne.

Potrzebujemy decyzji: jakie narzędzia, co testować w pierwszej kolejności, gdzie trzymać testy i jak traktować zależności zewnętrzne. Bez tego testy albo nie powstaną, albo będą niespójne.

## Decyzja

Wprowadzamy strategię testów opartą o **Vitest** i **testy jednostkowe warstwy serwisów**, z lustrzaną strukturą katalogów i jasnymi zasadami.

### 1. Runner i konfiguracja

- **Vitest** — runner testów (projekt używa Next.js i ESM; Vitest działa z konfiguracją w vitest.config.ts).
- W **vitest.config.ts** jawnie: **environment: 'node'** dla części serwerowej. Dla testów komponentów React w przyszłości — osobna konfiguracja z **environment: 'jsdom'**.
- **Izolacja mocków (krytyczne):** w `vitest.config.ts` ustawić `test: { clearMocks: true, resetMocks: true }`. Bez tego testy mogą się wzajemnie psuć.

### 2. Struktura katalogów

Lustrzana struktura pod `tests/`, nie „testy obok kodu”:

```
tests/
  unit/
    services/
    lib/
  integration/
    services/
  e2e/          ← testy Playwright (strona główna, flow w przeglądarce)
  security/     ← placeholder na przyszłość
  fixtures/
  smoke/        ← opcjonalnie
```

Struktura od razu przewiduje testy integracyjne i E2E bez późniejszej reorganizacji. Fixtures w jednym miejscu zamiast ad hoc w plikach testowych.

### 3. Testy E2E (Playwright)

Testy end-to-end w przeglądarce — uzupełnienie testów jednostkowych i integracyjnych; weryfikują widoczne zachowanie strony (np. ekran logowania, nawigacja).

- **Runner:** **Playwright** (`@playwright/test`). Oddzielny runner od Vitest; uruchamiany skryptami `test:e2e` i `test:e2e:ui`.
- **Przeglądarka:** tylko **Chromium** (Desktop Chrome). Konfiguracja w `playwright.config.ts`: projekt `chromium`, `devices['Desktop Chrome']`.
- **Aplikacja pod testem:** `baseURL: http://localhost:3100`. Serwer dev uruchamiany przez Playwright (`webServer`: `cross-env PORT=3100 npm run dev`) lub używany już działający serwer (`reuseExistingServer: true` poza CI).
- **Lokalizacja testów:** `tests/e2e/`. Pierwszy zestaw: strona główna — ładowanie, widoczność formularza logowania (tytuł, pola email/hasło, przyciski Google/Gość), przełączenie na rejestrację. Selektory oparte na `type` inputów lub rolach, bez polegania na accessible name (formularz nie ma `htmlFor`/`id`).
- **Skrypty:** `npm run test:e2e` (przebieg testów), `npm run test:e2e:ui` (tryb UI). Instalacja przeglądarki: `npx playwright install chromium` (jednorazowo).
- **Artefakty:** raport HTML, screenshot przy błędzie, trace przy retry. Katalogi `test-results/`, `playwright-report/`, `playwright/.cache/` w `.gitignore`.

E2E nie zastępują testów jednostkowych; testują „od góry" (UI), podczas gdy Vitest testuje warstwę serwisów i logikę.

### 4. Co testować i Definition of Done

- **Priorytet 1 — Service Layer:** testy w `tests/unit/services/` z mockami modułów z `lib/`.
- **Priorytet 2 — Logika czysta i narzędzia:** w `tests/unit/lib/` — bez mocków.
- **Priorytet 3 (opcjonalnie):** Cienkie testy Route Handlers Next.js (401 bez tokena, mapowanie błędów).

**Definition of Done:** Każdy nowy publiczny method w `services/` wymaga minimum: jednego testu happy path i jednego testu błędu domenowego (DomainError).

### 5. Szablon pliku testowego

Describe per metoda serwisu, GWT w ciele testu gdy setup jest nietrywialny. Struktura describe per metoda pozwala na **lokalny beforeEach specyficzny dla grupy testów danej metody** — bez duplikowania setupu; to uzasadnienie funkcjonalne, nie tylko estetyczne.

```typescript
describe("<NazwaSerwisu>", () => {
  describe("<nazwaMetody>", () => {
    beforeEach(() => {
      // setup mocków specyficzny dla tej metody
    });

    it("given <stan>, when <akcja>, then <rezultat>", async () => {
      // GIVEN
      // WHEN
      // THEN
    });
  });
});
```

### 6. Zasady mocków i typów

- **Zachowanie, nie implementacja:** testy weryfikują, co serwis zwraca i jakie błędy rzuca. `toHaveBeenCalledWith(...)` dopuszczalne tylko gdy argumenty są częścią kontraktu publicznego.
- **Typowanie:** serwisy mają jawnie zdefiniowane typy wejścia i wyjścia (interfaces). Mockowanie z `any` nie weryfikuje kontraktu między warstwami (zgodne z ADR-014).

### 7. Błędy odkryte przez testy

Nie usuwamy testu ani nie zmieniamy asercji, żeby test przechodził. Oznaczamy w Vitest: **it.skip** lub **it.fails** z komentarzem opisującym problem.

### 8. Zależności zewnętrzne

W testach jednostkowych **nie** używamy prawdziwego Firestore ani Gemini API. Serwisy testujemy z mockami; dane wejściowe i oczekiwane wyjścia — deterministyczne (fixtures z `tests/fixtures/`). Testy integracyjne „na żywo” — tylko za flagą (np. `RUN_INTEGRATION_TESTS=1`) i w osobnym jobie CI.

### 8a. Testowa baza dla testów integracyjnych

Testy jednostkowe nie łączą się z żadną bazą (tylko mocki `lib/firestore-db.js`). Testy integracyjne używają **dedykowanej** bazy testowej — **nie** produkcyjnego Firestore.

**Zaakceptowane podejście: emulator Firestore w Dockerze (historyczne, usunięte w etapie 0e; zob. ADR-020).** Przy uruchomieniu testów integracyjnych ustawiamy `FIRESTORE_EMULATOR_HOST=localhost:8080`. Emulator uruchamiany w kontenerze Docker (`docker-compose-test.yml`); na hoście wymagany tylko Docker. Opcjonalnie: `FIREBASE_PROJECT_ID` lub `GCLOUD_PROJECT` na projekt demo (np. `demo-secondbrain`). Tryb „emulator only” w `lib/firebase-admin.ts` (inicjalizacja bez credentials, gdy ustawiony `FIRESTORE_EMULATOR_HOST`). W CI: job uruchamia emulator w Dockerze, ustawia `FIRESTORE_EMULATOR_HOST`, potem wywołuje testy z `RUN_INTEGRATION_TESTS=1`. Szczegóły: [tests/integration/README.md](../../tests/integration/README.md), [ADR-016](016-firestore-emulator-docker.md).

### 8b. Coverage (pokrycie)

Pokrycie zbierane przez Vitest z providerem **v8** (`vitest run --coverage` lub skrypt `test:coverage`). Zakres: `coverage.include` dla `services/**/*.ts`, aby raport obejmował warstwę serwisów. **Coverage threshold** (opcjonalnie): minimalne progi dla `services/**/*.ts` (statements, lines, functions, branches) w `vitest.config.ts`, aby CI sygnalizował spadki; wartości ustalone na podstawie aktualnego wyniku. Raport w katalogu `coverage/` (w `.gitignore`). Skrypt w `package.json`: `npm run test:coverage`. Zależność: `@vitest/coverage-v8`.

### 9. Testy smoke (opcjonalnie)

Smoke = zdrowie infrastruktury, nie logika biznesowa. Nie wchodzą w `npm test`. Uruchomienie: `npm run test:smoke` lub `RUN_SMOKE=1 npm test`. W CI — osobny job za flagą RUN_SMOKE=1. Testy integracyjne pozostają za RUN_INTEGRATION_TESTS=1.

### 10. Bezpieczeństwo (wzmianka na przyszłość)

Gdy treść promptu do Gemini zależy od inputu użytkownika — warto mieć test, że złośliwy input jest sanitizowany (analogia do SQL injection). Docelowo w `tests/security/`. Na start — wzmianka, bez wymogu implementacji.

### 11. Priorytety wdrożenia

| Priorytet | Zmiana                                                      |
| --------- | ----------------------------------------------------------- |
| Krytyczne | Izolacja mocków (clearMocks, resetMocks)                    |
| Krytyczne | environment: 'node' w vitest.config.ts                      |
| Wysokie   | Struktura katalogów tests/, fixtures, DoD                   |
| Średnie   | GWT + describe per metoda, filozofia mocków, it.fails       |
| Średnie   | Testowa baza dla testów integracyjnych (emulator Firestore) |
| Średnie   | Coverage i opcjonalnie coverageThreshold dla services/      |
| Średnie   | Coverage i opcjonalnie coverageThreshold dla services/      |
| Niskie    | Testy smoke, testy prompt injection (security)              |
| Niskie    | Testy E2E (Playwright) — strona główna, krytyczne flow      |

## Rozważane alternatywy

- **Tylko testy E2E:** wolniejsze, mniej precyzyjne przy refaktoringu; dobre uzupełnienie, nie zamiennik testów jednostkowych — odrzucone jako jedyna warstwa.

## Konsekwencje

**Pozytywne:**

- Spójna strategia: jeden runner (Vitest), jasny priorytet (serwisy + czysta logika), actionable struktura i DoD.
- Zgodność z ADR-014: Service Layer jest miejscem testowanym w pierwszej kolejności, bez HTTP i bez prawdziwego Firestore/Gemini.
- Izolacja mocków i environment zapobiegają typowym błędom od pierwszego testu.

**Negatywne:**

- Czas na pisanie testów i przygotowanie mocków oraz fixtures. Refaktoring `lib/` wymaga aktualizacji mocków w testach — ograniczyć przez wąskie API między `services/` a `lib/`.

**Zależności:**

- ADR-014 (warstwy, Service Layer) — strategia testów opiera się na nim.
- ADR-011 (RAG) — pipeline RAG jest głównym kandydatem do testów w `ragService`.

## Stan aplikacji (luty 2026)

Wdrożone. Vitest w `devDependencies`, skrypty `test`, `test:run`, `test:coverage`, `test:integration`. Konfiguracja: `vitest.config.ts` (environment: node, clearMocks, resetMocks, passWithNoTests, exclude: tests/integration; coverage: provider v8, include: services/**/\*.ts, opcjonalnie thresholds dla services/). Zależność `@vitest/coverage-v8`. Struktura: `tests/unit/services/`, `tests/unit/lib/`, `tests/fixtures/`, `tests/integration/services/`, placeholdery: `tests/security/`, `tests/smoke/`. Testy jednostkowe: ragService, documentService, noteService, taskService, planService, tagService, calendarService, lib/errors. Testy integracyjne za flagą `RUN_INTEGRATION_TESTS=1` i skryptem `test:integration`; dokumentacja w `tests/integration/README.md`. **Testowa baza:** testy integracyjne przeciw emulatorowi Firestore w Dockerze (`docker-compose-test.yml`); `lib/firebase-admin.ts` obsługuje `FIRESTORE_EMULATOR_HOST` (tryb emulator-only bez credentials). **Coverage:\*\* `npm run test:coverage`, raport w `coverage/` (gitignore). Uwaga (etap 0e): emulator, `lib/firebase-admin.ts`, `getAuth` i testy integracyjne zostały usunięte; zob. ADR-020.

**Testy E2E:** Playwright (`@playwright/test`) w `devDependencies`. Konfiguracja: `playwright.config.ts` — jeden projekt Chromium, `baseURL` i `webServer.url`: `http://localhost:3100`, `webServer.command`: `cross-env PORT=3100 npm run dev`. Testy w `tests/e2e/` (np. `home.spec.ts` — strona główna, ekran logowania). Skrypty: `test:e2e`, `test:e2e:ui`. Przeglądarka: `npx playwright install chromium` (jednorazowo). Artefakty w `.gitignore`: `test-results/`, `playwright-report/`, `playwright/.cache/`, `blob-report/`.
