# CLAUDE.md

Monolith (Next.js 14; dawniej Second Brain; katalog repo: `Monolith`) wchodzi w skład ekosystemu NEXUS: vault Markdown/YAML w `~/projects/Brain_7224/NEXUS/`
(źródło prawdy o projektach). Kierunek: lokalny asystent pracy,
zob. `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md`.
Kod projektów wolno tylko czytać; zapisy aplikacji idą wyłącznie do `Vault/`.

## Struktura kodu

Nowy kod domeny leży w `contexts/bc_<nazwa>/` (ADR-021, spec `docs/superpowers/specs/2026-11-12-struktura-kontekstow-design.md`).
Każdy kontekst ma te same pięć plików (plik urósł → folder o tej samej nazwie z `index.ts`):

- `router.ts`: handlery HTTP (parsowanie przez `schemas`, wywołanie `services`, mapowanie model → DTO, `handleServiceError`);
- `schemas.ts`: zod wejścia, typy DTO, mapery model → DTO; bezpieczny dla klienta (UI wolno importować tylko ten plik);
- `models.ts`: typy wewnętrzne domeny;
- `services.ts`: reguły domeny; jedyne miejsce, które woła inny kontekst (i to tylko jego `services`);
- `repositories.ts`: jedyny dostęp do vaulta (`lib/nexus`), mapowanie plik ↔ model.

Kierunek: `app/api/**/route.ts` (tylko re-eksport handlera) → `router` → `services` → `repositories` → `lib/nexus`.
Infrastruktura wspólna: `lib/nexus/`, `lib/http/`, `lib/schema/`, `lib/errors.ts`. UI (`src/**`) importuje z kontekstu tylko `schemas`.
Test `tests/unit/architecture.static.test.ts` pilnuje reguł 1–9; **zmiany testu i listy wyjątków (baseline) zawsze osobnym commitem,
nigdy razem z kodem**, a pękający test naprawia się kodem, nie testem. Stary kod (`services/`, `lib/nexus/repos/`, `lib/validation/`)
jest migrowany po jednej domenie na PR.

## Współpraca wielu agentów (herdr-core / `hc`)

Trzy agenty działają w terminalach tego samego workspace `hc` („Brain_7224"):

| Rola                 | Agent                   | Zadania                                                               |
| -------------------- | ----------------------- | --------------------------------------------------------------------- |
| **Główny wykonawca** | Claude Code             | planowanie, implementacja, decyzje, commity, końcowa odpowiedzialność |
| Pomocnik             | `agy` (Antigravity)     | wyszukiwanie i pytania o kod (tylko odczyt), review, doradztwo        |
| Pomocnik             | `cursor` (Cursor Agent) | testy / lint / build z podsumowaniem, drobne edycje (`--role task`)   |

### Ekonomia tokenów (zasada nadrzędna przy delegowaniu)

Deleguj to, co zalałoby mój kontekst dużą ilością tekstu, a wraca jako krótki wniosek:

- **Wyszukiwanie i czytanie wielu plików** tylko po to, by coś znaleźć („gdzie jest X", „co używa Y",
  „jak działa moduł Z w skrócie") → `agy`. Sam czytam tylko pliki, które zaraz zmieniam.
- **Testy, lint, typecheck, build** (`npx vitest`, `npx tsc`, `npm run lint`, `npm run build`) → `cursor`
  z prośbą: „przeszło" albo lista `plik:linia + przyczyna`. Pełny output czytam tylko, gdy podsumowanie nie wystarcza.
- **Długie logi i stack trace'y** → pomocnik streszcza przyczynę.
- **Review diffa** → pomocnik zamiast moich podagentów (podagenci zużywają tokeny Claude).
- **Mechaniczne edycje w wielu plikach** → `cursor --role task`; potem sprawdzam `git diff --stat` i testy.

Nie deleguj drobnych pytań, które sprawdzę jednym `grep`/`Read`: prompt + odpowiedź kosztują więcej.

**Dobór modeli (nie używaj mocnych modeli na darmo):**

| Kto                             | Domyślnie                                                 | Mocniejszy, tylko gdy trzeba                                       |
| ------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| Claude Code (limity Claude Pro) | Sonnet 5.5                                                | Opus 5.5: architektura, trudne bugi, duże zmiany bez jasnego planu |
| `agy` (limit Google AI Pro)     | `--tier light` = Gemini 3.8 Flash: szukanie, streszczenia | `--tier deep` = Gemini 4 Argon: review, doradztwo                  |
| `cursor` (abonament Cursor)     | `--tier light` = Composer 2.5: testy, lint, drobne edycje | `--tier deep` = Auto                                               |

- `ask-helper.sh` dobiera tier automatycznie (`--role review` → deep, reszta → light) i wysyła `/model` tylko,
  gdy pasek pomocnika pokazuje inny model. `--tier none` zostawia model bez zmian.
- Modelu Claude Code nie zmieniam sam: gdy zadanie wymaga Opusa (albo wystarczy Sonnet, a działa Opus),
  mówię o tym użytkownikowi, a on przełącza `/model`.
- Ciężkie review można zlecić `agy` z modelem Claude (np. `AGY_DEEP=claude-opus-5-5-medium`):
  liczy się do limitu Google, nie Claude Pro.

**Czyszczenie kontekstu pomocników** (`/clear` przed zadaniem, robi to `ask-helper.sh`):

- domyślnie automatycznie: przy `--role review` (niezależna opinia bez starego kontekstu), co 5 zadań
  (`CLEAR_EVERY`) albo gdy pasek pomocnika pokazuje zajętość kontekstu ≥ 40% (`CLEAR_PCT`, odczyt działa dla Cursora);
- `--fresh`: nowy, niezwiązany temat → zawsze czyść;
- `--keep`: dopytanie / kontynuacja poprzedniego zadania → nie czyść (wtedy w prompcie nie powtarzaj kontekstu).
  Odpowiedzi są domyślnie ucinane do 40 linii (`--max-lines`); pełną wersję daje `--max-lines 0`.

### Pisanie planów (zakaz budowania kodu „na próbę")

Plan (`docs/superpowers/plans/`) piszę z samego rozumowania i odczytu istniejącego kodu. **Nie buduję kodu
ani środowiska testowego (scratch projekt, instalacja pakietów, uruchamianie testów) po to, by plan napisać**:
to spalanie tokenów, a implementacja i tak powstanie w kroku wykonania, w TDD.

- W planie: ścieżki plików, interfejsy (sygnatury), reguły działania, konkretne przypadki testowe z oczekiwanymi
  wartościami i komendy. Pełny kod tylko dla małych, współdzielonych formatów (np. `lib/nexus/`), i to napisany
  bez uruchamiania.
- Wolno sprawdzić fakty potrzebne do planu jednym `grep`/`Read` (typy rekordów, format zrzutu, wersje pakietów).
  Nie wolno prototypować całych modułów ani fuzzować ich „dla pewności".
- Weryfikacja kodu należy do wykonawcy planu (czerwony test, zielony test), nie do autora planu.

### Jak wołać pomocników

```bash
scripts/ask-helper.sh [--role review|advice|task] [--timeout S] <agy|cursor> "prompt"
```

- `--role advice` (domyślnie) i `review`: pomocnik **tylko czyta** i odpowiada. Używaj do weryfikacji i opinii.
- `--role task`: pomocnik może edytować pliki, wyłącznie przy drobnej, jasno opisanej pracy.
- Kody wyjścia: 0 ok, 1 nie znaleziono pomocnika, 2 pomocnik czeka na zgodę (`blocked`), 3 timeout.
- Komenda `/consult <agy|cursor|both> <zadanie>` robi to samo.
- NIE używaj `agy -p ...` ani `cursor-agent -p ...` przez Basha: to osobne procesy bez kontekstu sesji.
- Pomocnicy działają w `~/projects/Brain_7224/Monolith`; w prompcie podawaj ścieżki względem tego katalogu,
  a do NEXUS przez `../NEXUS/...` (oba mają odczyt NEXUS). Uprawnienia komend cursora są w globalnym
  `~/.cursor/cli-config.json` (`Brain_7224/.cursor/cli.json` nie jest wczytywany z tego katalogu).
- Pomocnicy nie widzą tej rozmowy: w prompcie podawaj cel, ścieżki, ograniczenia i oczekiwany format odpowiedzi.
- Jeśli pomocnik jest `blocked` (czeka na zgodę), przeczytaj prośbę w panelu (`hc read <terminal>`).
  **Zgoda użytkownika (2026-11-13):** wolno mi zatwierdzić (`hc keys <terminal> enter` = „Yes, run command”, jednorazowo)
  polecenia wyłącznie do odczytu, które nic nie zmieniają w kodzie ani w vaulcie: `head`, `cat`, `ls`, `grep`, `rg`, `find`
  (bez `-exec`/`-delete`), `git show|diff|log|status`, `wc`, `sed -n`. Nie wybieram opcji „always allow” (2 i 3).
  **Zgoda użytkownika (2026-11-13):** wolno mi też zatwierdzać (jednorazowo, `hc keys <terminal> enter`) polecenia
  testów i sprawdzeń, o które sam poprosiłem pomocnika, gdy działają zgodnie z moim poleceniem i nie modyfikują kodu:
  `npx tsc --noEmit`, `npx vitest run [ścieżki]`, `npm run lint`, `npm run build` (zapisuje tylko `.next/`), a także
  poprzedzające je `cd` do katalogu Monolith oraz doklejone przez pomocnika `2>&1` (samo łączenie stderr ze stdout,
  bez zapisu do pliku; inne przekierowania nadal nie). Przed zatwierdzeniem czytam panel (`hc read <terminal>`) i sprawdzam,
  że polecenie jest dokładnie tym, o co prosiłem. Nie zatwierdzam wariantów zapisujących: `--fix`, `-u`/`--update`,
  `--write`, `prettier`, `npm install`/`ci`, `npx` pobierającego pakiety spoza projektu, przekierowań, ani nic poza
  poleceniem z mojej prośby.
  Wszystko inne (zapis, `rm`/`mv`/`cp`, przekierowania `>`/`>>`, `tee`, `git add|commit|push|checkout|reset`,
  `npm`/`npx`/`node`/`tsx` poza wymienionymi wyżej, instalacje, sieć, pipe do interpretera) nadal wymaga kliknięcia
  użytkownika: wtedy nie zatwierdzam, tylko go proszę.

### Kiedy delegować

- **Weryfikacja:** po większej zmianie (refaktor, logika zapisu do vaulta, migracje) poproś jednego pomocnika
  o niezależny review diffa; drugi może sprawdzić inny aspekt (testy / edge-case'y). Opinie traktuj jak hipotezy:
  zweryfikuj w kodzie, zanim zmienisz cokolwiek.
- **Doradztwo:** gdy są dwa równie dobre podejścia lub nie ma pewności co do biblioteki/API, zapytaj pomocnika
  o drugą opinię (krótko, z konkretnym pytaniem).
- **Drobne prace (`--role task`):** mechaniczne, dobrze określone zmiany (zmiana nazw, literówki, drobne
  testy, formatowanie, szkielety plików), które nie wymagają mocnego modelu. Wskaż dokładnie pliki.
- **Nie deleguj:** projektowania architektury, zmian w auth/uprawnieniach/zapisie danych, commitów i pushy,
  kasowania czegokolwiek, decyzji produktowych. Nie zlecaj dwóm agentom edycji tych samych plików równolegle.
- Po `--role task` zawsze sprawdź wynik (`git diff`, testy) przed uznaniem za zrobione.
- Nie deleguj tylko po to, by delegować: proste rzeczy zrób sam. Pomocnik ma sens, gdy daje niezależne spojrzenie
  albo oszczędza mocny model.

### Rezerwa: sesja herdr

Starsza sesja herdr (`herdr agent list/prompt/read`) widzi tylko panele w swoim workspace `w1`;
agenci z `hc` w niej nie występują.
