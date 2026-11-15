# Karta Kodeks (dziewiąta karta Monolith) — projekt

Data: 2026-11-12
Status: zatwierdzony kierunek (część A i B), do przeglądu przed planem
Nadrzędny spec: `2026-11-11-asystent-lokalny-nexus-design.md` (§4.2 zasady zapisu, §5 prywatność, §6.6 podział na karty)

Dokument jest publiczny (repo na GitHubie). Nie zawiera danych z etatu ani identyfikatorów kont.

## 1. Cel

Dodać do aplikacji dziewiątą kartę **Kodeks**: uniwersalny zbiór zasad pracy nad kodem (TDD z czerwonym testem najpierw, jakość asercji, testowanie wielopoziomowe, dowody przed twierdzeniami, zakres zmian i inne), który nie jest związany z żadnym projektem i służy człowiekowi oraz agentom AI. Karta ma być **czytnikiem kodeksu z checklistami** używanymi przy zadaniach.

Podział prac:

| Część | Zakres                                                                    | Zależy od                                                                                               | Kiedy                                  |
| ----- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| A     | Karta w szkielecie kart: rejestr, `Alt+9`, pasek, paleta, motyw, zaślepka | nic (szkielet nie zależy od danych)                                                                     | teraz, na gałęzi `feat/karty-szkielet` |
| B     | Czytnik kodeksu i checklisty (odczyt pliku, dziennik uruchomień)          | warstwa plikowa `lib/nexus/` (0c); dla uruchomień `owner: work` także `Work/` w `.gitignore` NEXUS (0f) | po etapach 0c i 0f, osobny spec i plan |
| C     | Treść kodeksu (tekst reguł), tor niekodowy                                | nic                                                                                                     | równolegle                             |

## 2. Podjęte decyzje

| #   | Decyzja               | Wybór                                                                                                             |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| K1  | Rola karty            | Czytnik pliku **plus** interaktywne checklisty (nie edytor w aplikacji)                                           |
| K2  | Kolejność             | Zaślepka teraz (część A), treść po etapie 0c (część B). Bez tymczasowych rozwiązań i bez dublowania `lib/nexus/`  |
| K3  | Źródło kodeksu        | Jeden plik `Vault/Knowledge/kodeks.md` w NEXUS (prywatne repo, kopia wg D5). Aplikacja go tylko czyta             |
| K4  | Dowody w checklistach | **Poza zakresem pierwszej wersji.** Wystarczy odhaczanie z krótką jednolinijkową notatką                          |
| K5  | Skrót                 | `Alt+9`, jak dla pozostałych kart (po `event.code`, bez Ctrl)                                                     |
| K6  | Akcent karty          | Zieleń `#3ddc84` (wybór użytkownika po porównaniu odległości odcieni; pomarańcz odrzucony, bo leży 9° od Kokpitu) |

## 3. Część A: karta w szkielecie

| Miejsce                                  | Zmiana                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/cards/cards.ts`            | `CardId` dostaje `"kodeks"`. `CARDS` dostaje `{ id: "kodeks", label: "Kodeks", hotkey: 9, target: { kind: "placeholder", stage: "po etapie 0c" } }`. Karta jest dziewiąta i ostatnia                                                                                                                                                        |
| `src/features/cards/useCardHotkeys.ts`   | wyrażenie `Digit([1-8])` zmienia się na `Digit([1-9])`                                                                                                                                                                                                                                                                                      |
| `src/features/cards/cards.css`           | nowy akcent `--c-kodeks: #3ddc84` (zieleń; odcień 147°, co najmniej 41° od każdego z ośmiu istniejących akcentów, najbliższy jest cyjan Płótna; K6). Uwaga: leży blisko zielonych tokenów statusu `--ok`, więc w motywie Kodeksu `--ok` dostaje odcień odróżnialny od akcentu albo odznaka sukcesu ma dodatkowy znak (ikona), nie sam kolor |
| `docs/mockups/karty/tokens.css`          | ten sam akcent oraz blok motywu `[data-card="kodeks"]` (grafit wspólny dla kart, akcent zielony)                                                                                                                                                                                                                                            |
| `src/features/cards/CardPlaceholder.tsx` | bez zmian. Ścieżka makiety `0${hotkey}-${id}.html` daje `09-kodeks.html`                                                                                                                                                                                                                                                                    |
| Paleta `Ctrl+K`                          | komenda „Przejdź: Kodeks” z hintem `Alt+9` powstaje automatycznie z `buildCardCommands`                                                                                                                                                                                                                                                     |
| Spec §6.6, `STYLEGUIDE.md`               | „8 kart” → „9 kart”; nowy wiersz tabeli (skrót `Alt+9`, karta Kodeks); skróty `Alt+1…9`; opis `tokens.css` na „9 motywów”                                                                                                                                                                                                                   |
| `docs/mockups/karty/shell.js`            | tablica kart dostaje 9. wpis (`09-kodeks.html`), regex `Digit[1-8]` → `Digit[1-9]`, napis paska stanu `Alt+1…9` (pliki makiet mają własną kopię logiki szkieletu)                                                                                                                                                                           |
| `docs/mockups/karty/index.html`          | statyczna siatka kart dostaje kafelek 9. karty linkujący do `cards/09-kodeks.html`                                                                                                                                                                                                                                                          |
| `docs/mockups/karty/STAN-W-KODZIE.md`    | wiersz „Ctrl+K i Alt+1…8” → `Alt+1…9`; karta Kodeks jako „brak” do części B                                                                                                                                                                                                                                                                 |

Testy (czerwone najpierw): `cards.test.ts` (dziewięć kart, klawisz 9, `cardByHotkey(10)` i `cardByHotkey(0)` dają `undefined`, `cardFromHash("#kodeks")`), `useCardHotkeys.test.ts` (`Alt+9` wybiera Kodeks, `Alt+0` nie), `CardRail.test.tsx` (dziewięć kart zamiast ośmiu, Kodeks ostatni), `cardCommands.test.ts` (dziś `toHaveLength(8)`: dziewięć komend, ostatnia `go-kodeks` z hintem `Alt+9`), `useCardNavigation.test.ts` (przejście placeholder → placeholder, np. Projekty → Kodeks, ustawia poprawną kartę i adres), `CardPlaceholder.test.tsx` (Kodeks pokazuje etap i ścieżkę `09-kodeks.html`).

Pasek `.card-rail` jest kolumną flex bez przewijania (`src/features/cards/cards.css`). Przy dziewięciu przyciskach w niskim oknie ostatni może wypaść poza ekran, więc w tej części dochodzi `overflow-y: auto` dla paska (sprawdzone ręcznie w oknie ok. 600 px wysokości). Nawigacja mobilna (`MobileNav`) opiera się na `PlanningTab`, nie na rejestrze kart, więc część A jej nie dotyka (telefon jest poza zakresem, §10 nadrzędnego specu). Plan szkieletu `2026-11-11-karty-szkielet.md` zostaje bez zmian jako zapis historyczny.

Ryzyko: `Alt+9` w Chrome na Linuksie przełącza na ostatnią kartę przeglądarki, tak jak `Alt+1…8` przełączają karty. W przeglądarce z Windows (aplikacja w WSL) skrót jest wolny. To jest to samo ograniczenie, które spec §6.6 już opisuje.

Część A nic nie zapisuje w Firestore ani w vaulcie.

## 4. Część B: czytnik i checklisty (po etapie 0c)

Ta część dostaje osobny spec i plan, gdy istnieje `lib/nexus/`. Poniżej obowiązujący kierunek.

### 4.1 Źródło i format

Plik `Vault/Knowledge/kodeks.md`. Reguła to punkt listy z identyfikatorem i poziomem:

```
- **[TDD-1] MUST** Brak kodu produkcyjnego bez czerwonego testu (komenda, exit ≠ 0, powód).
```

Formalny wzorzec reguły (jedna linia, początek listy najwyższego poziomu):

```
^- \*\*\[([A-Z][A-Z0-9]*-[0-9]+)\] (MUST|SHOULD)\*\*[ \t]+(.+)$
```

- Identyfikator: wielkie litery i cyfry, myślnik, numer (`TDD-1`, `ASERCJE-3`). Treść może mieć polskie znaki i Markdown inline.
- Kontynuacja: następne linie wcięte co najmniej dwiema spacjami należą do tej samej reguły. Zagnieżdżone punkty listy są częścią treści reguły rodzica, nie osobnymi regułami.
- Odwołania w checklistach mają postać `- [ ] [TDD-1] krótki opis`. Odwołanie do nieistniejącego identyfikatora daje ostrzeżenie w UI.
- Czytnik z identyfikatorów i poziomów buduje odznaki MUST/SHOULD, filtr, linkowalne kotwice i spis treści z nagłówków. Linia, która nie pasuje do wzorca, jest renderowana jako zwykły tekst; żadna treść nie ginie. Zduplikowany identyfikator jest zgłaszany ostrzeżeniem w UI, a nie błędem, który blokuje czytanie.

Plik stosuje konwencje notatek z `Knowledge/` (frontmatter: `name`, `slug`, `type`, `categories`, `status`, itd.) i ma wpis w `Knowledge/_index.md`. W `Knowledge/` jest już `ai-coding-guardrails.md` (wiedza o strażnicach i pętli zwrotnej w AI-codingu). Kodeks jest od niego **normatywny** (MUST/SHOULD) i odwołuje się do niego przez `[[ai-coding-guardrails]]`, nie kopiuje treści.

### 4.2 Checklisty

Definicje (np. „Definition of Done”, „Przed PR”) są w tym samym pliku, w sekcji `## Checklisty`, jako punkty `- [ ]` z odwołaniem do identyfikatorów reguł (`[TDD-1]`).

Uruchomienie checklisty przy zadaniu zapisuje się jako **dziennik zdarzeń dopisywany do** `Vault/Checklists/RRRR-MM.jsonl`. Jedna linia to jedno zdarzenie:

```
{ "run": "<id>", "ts": "…", "type": "start" | "toggle" | "note" | "end", "owner": "work" | "personal", "projectId": "…", … }
```

Pola zależne od typu: `start` ma nazwę checklisty i opis zadania, `toggle` ma id punktu i stan, `note` ma id punktu i jedną linię tekstu, `end` (przycisk „Zapisz sesję” w makiecie) ma liczbę odhaczonych i wszystkich punktów (`done`, `total`) i zamyka uruchomienie: kolejna interakcja zaczyna nowe. `owner` jest **wymagane** w każdym zdarzeniu.

Uruchomienie powstaje przy pierwszej interakcji: makieta nie ma przycisku „Rozpocznij”, więc klient przy pierwszym odhaczeniu albo notatce wysyła najpierw `start` (`run` i `ts` nadaje serwer), potem właściwe zdarzenie.

Zasady zapisu (doprecyzowanie względem §4.2 nadrzędnego specu):

- **Dziennik jest tylko dopisywany.** Zdarzenie to jeden zapis jednej linii zakończonej `\n` w trybie dopisywania. Zapis atomowy przez plik tymczasowy i `rename` oraz kontrola `mtime` dotyczą plików nadpisywanych, nie tego dziennika (przepisanie całego `.jsonl` zaprzeczałoby „tylko dopisywane”). Wykorzystujemy pomocnik dopisywania z `lib/nexus/` (etap 0c), nie drugi model I/O.
- **Współbieżność:** zapisy w obrębie procesu serializuje kolejka (jedna linia naraz). Dopisywanie z dwóch procesów na lokalnym systemie plików jest atomowe dla krótkich linii (zdarzenia mają rozmiar rzędu setek bajtów), ale vault na dysku Windows widocznym w WSL (`/mnt/...`) może dawać słabsze gwarancje, więc podstawą jest kolejka w procesie, a dopisywanie z drugiego procesu (Obsidian, agent) jest traktowane jako rzadkie i objęte pomijaniem uszkodzonych linii.
- **Odtwarzanie stanu:** kolejność zdarzeń to kolejność w pliku (`ts` informacyjnie, remis rozstrzyga pozycja w pliku). Dla pary (uruchomienie, punkt) obowiązuje ostatnie zdarzenie `toggle`. Linia uszkodzona (niepoprawny JSON) jest pomijana i liczona w ostrzeżeniu w UI. Ostatnia linia bez `\n` jest ignorowana, dopóki nie zostanie dokończona.

### 4.3 Prywatność

Ścieżka zapisu wynika wyłącznie z pola `owner`: `personal` do `Vault/Checklists/`, `work` do `Vault/Work/Checklists/` (strefa ignorowana przez git, §5). Zdarzenie bez `owner` jest odrzucane (domyślnie nic nie trafia do strefy śledzonej przez git). Opis zadania i notatki dla projektu `work` zapisują się tylko w pliku ze strefy `Work/`. Przed pierwszym zapisem do `Vault/Work/` obowiązuje kontrola `git check-ignore Vault/Work/` (§5 nadrzędnego specu). W repo NEXUS `.gitignore` nie ma dziś wpisu `Work/` (to krok 0f etapu 0), dlatego **część B startuje po 0c i 0f**. Sam kodeks jest uniwersalny i nie zawiera danych etatu.

### 4.4 Warstwy

- `contexts/bc_codex/` (pięć plików wg ADR-021): `repositories.ts` czyta `kodeks.md` i dopisuje do dziennika, `services.ts` zawiera parser reguł, odtwarzanie stanu z dziennika i kolejkę zapisów (spec pierwotnie przewidywał `lib/nexus/codex.ts` i `lib/nexus/checklists.ts`; reguły domeny leżą w `services` od ADR-021).
- `lib/nexus/vault-fs.ts` dostaje dwa małe prymitywy I/O, których nie było w etapie 0c: `appendVaultLine` (dopisanie jednej linii, w razie potrzeby poprzedzone `\n`) i `vaultFileMtimeMs`.
- Trasy `/api/nexus/codex` (GET) i `/api/nexus/checklists` (GET, POST).
- Interfejs w `src/features/codex/`.
- `CardTarget` w `cards.ts` dostaje nowy wariant `{ kind: "codex" }`, bo Kodeks nie jest zakładką `PlanningTab`; wpis karty zmienia się z `placeholder` na ten wariant, a `App.tsx` renderuje widok Kodeksu.
- Nadrzędny spec §4.3 (układ plików vaulta) dostaje katalogi `Checklists/` i `Work/Checklists/` oraz `Knowledge/kodeks.md`, przy specu części B.
- Renderer Markdowna tylko do odczytu: istniejący `markdown-it` przez `lib/markdown/html-markdown.ts` (`html: false`, jak w `NexusDocView`). Bez nowej zależności (pierwotnie `react-markdown` z `remark-gfm`).

### 4.5 Obsługa błędów

- Brak vaulta (`NEXUS_VAULT_PATH` puste): błąd konfiguracji, jak w §4.2 nadrzędnego specu.
- Brak pliku kodeksu: pusty stan z instrukcją utworzenia pliku.
- Zmiana pliku w trakcie sesji: karta tylko czyta, więc nie ma konfliktu zapisu. Widok sprawdza `mtime` przy powrocie na kartę i co kilkanaście sekund oraz odświeża się bez okna rozstrzygania konfliktu.

### 4.6 Testy

Zgodnie z samym kodeksem, czerwone najpierw. Parser reguł: wzorzec poprawny, zniekształcone linie, zduplikowane identyfikatory, polskie znaki. Dziennik: odtwarzanie stanu, dopisywanie jednej linii, kolejność zdarzeń i remis `ts`, uszkodzona linia JSON i niedokończona ostatnia linia, równoległe dopisywanie z kolejki. Prywatność: zdarzenie bez `owner` odrzucone, `owner: work` trafia tylko do `Vault/Work/Checklists/`, brak śladu zdarzeń `work` w `Vault/Checklists/`, odmowa zapisu do `Work/`, gdy `git check-ignore` go nie obejmuje. Komponenty: filtr MUST/SHOULD, odhaczanie, notatka. Trasy API: błąd konfiguracji, brak pliku.

### 4.7 Makieta

Przed kodem powstaje `docs/mockups/karty/cards/09-kodeks.html`, według tego samego procesu co pozostałe karty (nowa karta makiety to osobny kontekst `agy`).

Odstępstwa kodu od makiety (decyzja 2026-11-14): pominięty pasek trybów demo (tylko makieta) oraz chipy „Projekt/Gałąź” w pasku pliku (pokazuje je `ShellStatusBar` pod każdą kartą). `projectId` w zdarzeniach jest opcjonalny i w pierwszej wersji interfejs go nie ustawia. Wszystko inne z makiety wchodzi do pierwszej wersji; elementy zbędne usuwamy po obejrzeniu w przeglądarce. Plan: `docs/superpowers/plans/2026-11-14-karta-kodeks-czesc-b.md`.

## 5. Część C: treść kodeksu

Tor niekodowy. Punkt wyjścia: opinie `agy` i `cursor` z 2026-11-12 (rozdziały: zakres i hierarchia, TDD i dowód czerwieni, jakość asercji, warstwy testów, dowody przed twierdzeniami, zakres zmian i małe commity, bezpieczeństwo i dane, praca z agentami, egzekucja, anty-wzorce). Zasady przekrojowe: język MUST/SHOULD, krótko, kodeks jako kontrakt z odwołaniami zamiast duplikowania treści (do skilli oraz do istniejących notatek, np. `[[ai-coding-guardrails]]` w `Knowledge/`), każda reguła weryfikowalna. **Rdzeń `kodeks.md` ma rzędu 100 linii**; rozdziały wymagające szerszego omówienia (np. strategia testów wielopoziomowych) są osobnymi notatkami w `Knowledge/` linkowanymi z rdzenia, żeby limit nie zmuszał do płytkich reguł.

Reguły zgłoszone przez użytkownika do włączenia do rdzenia (rozdział „praca z agentami”), gotowe w formacie z 4.1:

```
- **[AGENT-1] MUST** Plan (spec → plan implementacji) powstaje z odczytu istniejącego kodu i rozumowania. Nie buduję kodu, scratch projektu ani środowiska testowego po to, by plan napisać: implementacja powstaje raz, w kroku wykonania, w TDD.
  Plan zawiera ścieżki, interfejsy, reguły działania, przypadki testowe z oczekiwanymi wartościami i komendy; pełny kod tylko dla małych współdzielonych formatów, napisany bez uruchamiania.
  Weryfikacja kodu należy do wykonawcy planu (czerwony test, zielony test), nie do autora planu.
```

Reguła z sesji 2026-11-14, **włączona do rdzenia 2026-11-15** (`kodeks.md`, rozdział 5 „Współpraca z agentami AI”, z pozycją w Definition of Done):

```
- **[ZAPIS-1] MUST** Próbne zapisy (testowy POST, skrypt, eksperyment) nie trafiają do prawdziwych danych użytkownika (vault, baza). Używam tymczasowego vaulta albo kopii (w Monolith: `setupTempVault`).
  Po każdym zapisie, który mógł dotknąć prawdziwych danych, sprawdzam `git diff` repozytorium danych i cofam wszystko, co nie było zamierzone.
```

Powód: w sesji 2026-11-14 próbny POST ze zdaniem „test krótki” trafił do prawdziwego `tasks.md` w NEXUS. Wpis usunięto od razu i `git diff` potwierdził czysty stan, ale ochroną był przypadek i diff, a nie zasada.

Powód reguły AGENT-1: w sesji 2026-11-12 przy planie kroku 0b zbudowano i przetestowano kod poza repo tylko po to, by plan miał „sprawdzony” kod. Kod i tak trzeba było napisać drugi raz przy wykonaniu, więc tokeny poszły na pracę podwójną. Operacyjnie reguła obowiązuje już w `CLAUDE.md` tego repo (sekcja „Pisanie planów”).

Do rozstrzygnięcia przy pisaniu: język dokumentu (polski dla czytelności vs angielski dla skuteczności reguł u agentów) oraz sposób podlinkowania z projektowych `CLAUDE.md` jedną linią.

## 6. Poza zakresem pierwszej wersji

Edycja kodeksu w aplikacji, wymagany dowód (komenda, exit code) per punkt checklisty (K4), integracja z kartami Projekty i Kokpit, wymuszanie reguł hookami lub CI (osobna decyzja po napisaniu kodeksu).

## 7. Ryzyka

- **Rozjazd formatu reguł.** Konwencja `[ID] MUST` musi być prosta, bo plik edytuje człowiek. Ograniczenie: łagodny parser (nierozpoznane linie zostają tekstem).
- **Zależność od etapów 0c i 0f.** Część B nie ruszy przed `lib/nexus/` (0c) ani, dla uruchomień `owner: work`, przed wpisem `Work/` w `.gitignore` NEXUS (0f). Ograniczenie: część A jest samodzielna, a B ma jawny warunek wejścia.
- **Wyciek danych etatu przez zdarzenia.** Ograniczenie: wymagane `owner`, routing ścieżki tylko z `owner`, kontrola `git check-ignore`, testy prywatności (§4.6).
- **Duplikacja wiedzy z `Knowledge/`.** Ograniczenie: kodeks jest normatywny i linkuje do notatek, a nie ich kopiuje.
- **Kolizja skrótu `Alt+9`** z przeglądarką (opisane w części A).
- **Rozrost kodeksu.** Ograniczenie: limit długości w części C i podział na MUST/SHOULD.

## 8. Kryteria ukończenia

- Część A: dziewięć kart w pasku, `Alt+9` i paleta przechodzą do Kodeksu, adres kończy się `#kodeks`, testy z §3 zielone, spec §6.6 i `STYLEGUIDE.md` zaktualizowane.
- Część B: karta czyta `Vault/Knowledge/kodeks.md`, pokazuje reguły z filtrem, uruchamia i odhacza checklisty z notatką, a zdarzenia trafiają do `Vault/Checklists/` (lub `Vault/Work/Checklists/`), testy z §4.6 zielone.
- Część C: istnieje kodeks po przeglądzie `agy` i `cursor`, z regułami w formacie z §4.1.
