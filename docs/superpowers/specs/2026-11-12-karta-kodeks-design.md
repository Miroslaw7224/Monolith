# Karta Kodeks (dziewiąta karta Monolith) — projekt

Data: 2026-11-12
Status: zatwierdzony kierunek (część A i B), do przeglądu przed planem
Nadrzędny spec: `2026-11-11-asystent-lokalny-nexus-design.md` (§4.2 zasady zapisu, §5 prywatność, §6.6 podział na karty)

Dokument jest publiczny (repo na GitHubie). Nie zawiera danych z etatu ani identyfikatorów kont.

## 1. Cel

Dodać do aplikacji dziewiątą kartę **Kodeks**: uniwersalny zbiór zasad pracy nad kodem (TDD z czerwonym testem najpierw, jakość asercji, testowanie wielopoziomowe, dowody przed twierdzeniami, zakres zmian i inne), który nie jest związany z żadnym projektem i służy człowiekowi oraz agentom AI. Karta ma być **czytnikiem kodeksu z checklistami** używanymi przy zadaniach.

Podział prac:

| Część | Zakres                                                                    | Zależy od                               | Kiedy                                  |
| ----- | ------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------- |
| A     | Karta w szkielecie kart: rejestr, `Alt+9`, pasek, paleta, motyw, zaślepka | nic (szkielet nie zależy od danych)     | teraz, na gałęzi `feat/karty-szkielet` |
| B     | Czytnik kodeksu i checklisty (odczyt pliku, dziennik uruchomień)          | warstwa plikowa `lib/nexus/` z etapu 0c | po etapie 0c, osobny spec i plan       |
| C     | Treść kodeksu (tekst reguł), tor niekodowy                                | nic                                     | równolegle                             |

## 2. Podjęte decyzje

| #   | Decyzja               | Wybór                                                                                                            |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| K1  | Rola karty            | Czytnik pliku **plus** interaktywne checklisty (nie edytor w aplikacji)                                          |
| K2  | Kolejność             | Zaślepka teraz (część A), treść po etapie 0c (część B). Bez tymczasowych rozwiązań i bez dublowania `lib/nexus/` |
| K3  | Źródło kodeksu        | Jeden plik `Vault/Knowledge/kodeks.md` w NEXUS (prywatne repo, kopia wg D5). Aplikacja go tylko czyta            |
| K4  | Dowody w checklistach | **Poza zakresem pierwszej wersji.** Wystarczy odhaczanie z krótką jednolinijkową notatką                         |
| K5  | Skrót                 | `Alt+9`, jak dla pozostałych kart (po `event.code`, bez Ctrl)                                                    |

## 3. Część A: karta w szkielecie

| Miejsce                                  | Zmiana                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `src/features/cards/cards.ts`            | `CardId` dostaje `"kodeks"`. `CARDS` dostaje `{ id: "kodeks", label: "Kodeks", hotkey: 9, target: { kind: "placeholder", stage: "po etapie 0c" } }`. Karta jest dziewiąta i ostatnia |
| `src/features/cards/useCardHotkeys.ts`   | wyrażenie `Digit([1-8])` zmienia się na `Digit([1-9])`                                                                                                                               |
| `src/features/cards/cards.css`           | nowy akcent `--c-kodeks: #2ee6a8` (miętowy; z dziewięciu barw najmniej zlewa się z istniejącymi, a limonkowa zieleń `--c-zadania` jest wyraźnie inna)                                |
| `docs/mockups/karty/tokens.css`          | ten sam akcent oraz blok motywu `[data-card="kodeks"]` (grafit wspólny dla kart, akcent miętowy)                                                                                     |
| `src/features/cards/CardPlaceholder.tsx` | bez zmian. Ścieżka makiety `0${hotkey}-${id}.html` daje `09-kodeks.html`                                                                                                             |
| Paleta `Ctrl+K`                          | komenda „Przejdź: Kodeks” z hintem `Alt+9` powstaje automatycznie z `buildCardCommands`                                                                                              |
| Spec §6.6, `STYLEGUIDE.md`               | „8 kart” → „9 kart”; wiersz `Alt+9                                                                                                                                                   | Kodeks`; skróty `Alt+1…9`; opis `tokens.css` na „9 motywów” |

Testy (czerwone najpierw): `cards.test.ts` (dziewięć kart, klawisz 9, `cardByHotkey(10)` i `cardByHotkey(0)` dają `undefined`, `cardFromHash("#kodeks")`), `useCardHotkeys.test.ts` (`Alt+9` wybiera Kodeks, `Alt+0` nie), `CardRail.test.tsx` (dziewięć kart zamiast ośmiu, Kodeks ostatni), `CardPlaceholder.test.tsx` (Kodeks pokazuje etap i ścieżkę `09-kodeks.html`).

Ryzyko: `Alt+9` w Chrome na Linuksie przełącza na ostatnią kartę przeglądarki, tak jak `Alt+1…8` przełączają karty. W przeglądarce z Windows (aplikacja w WSL) skrót jest wolny. To jest to samo ograniczenie, które spec §6.6 już opisuje.

Część A nic nie zapisuje w Firestore ani w vaulcie.

## 4. Część B: czytnik i checklisty (po etapie 0c)

Ta część dostaje osobny spec i plan, gdy istnieje `lib/nexus/`. Poniżej obowiązujący kierunek.

### 4.1 Źródło i format

Plik `Vault/Knowledge/kodeks.md`. Reguła to punkt listy z identyfikatorem i poziomem:

```
- **[TDD-1] MUST** Brak kodu produkcyjnego bez czerwonego testu (komenda, exit ≠ 0, powód).
```

Czytnik z identyfikatorów i poziomów buduje odznaki MUST/SHOULD, filtr, linkowalne kotwice i spis treści z nagłówków. Linia, która nie pasuje do wzorca, jest renderowana jako zwykły tekst; żadna treść nie ginie. Zduplikowany identyfikator jest zgłaszany ostrzeżeniem w UI, a nie błędem, który blokuje czytanie.

### 4.2 Checklisty

Definicje (np. „Definition of Done”, „Przed PR”) są w tym samym pliku, w sekcji `## Checklisty`, jako punkty `- [ ]` z odwołaniem do identyfikatorów reguł (`[TDD-1]`).

Uruchomienie checklisty przy zadaniu zapisuje się jako **dziennik zdarzeń dopisywany do** `Vault/Checklists/RRRR-MM.jsonl`. Jedna linia to jedno zdarzenie: `{ "run": "<id>", "ts": "…", "type": "start" | "toggle" | "note", … }` z polami: nazwa checklisty, identyfikator zadania lub tekst, id punktu, stan, notatka (jedna linia tekstu). Stan bieżący odtwarza się ze zdarzeń. Zgodność z §4.2 nadrzędnego specu: logi tylko dopisywane, stabilne `id`, zapis atomowy, brak konfliktów przy edycji w dwóch miejscach.

### 4.3 Prywatność

Uruchomienia dla projektów `owner: work` trafiają do `Vault/Work/Checklists/`, strefy ignorowanej przez git (§5). Sam kodeks jest uniwersalny i nie zawiera danych etatu.

### 4.4 Warstwy

- `lib/nexus/codex.ts`: odczyt i parsowanie pliku, `mtime`.
- `lib/nexus/checklists.ts`: dopisywanie zdarzeń i odtwarzanie stanu.
- Trasy `/api/nexus/codex` (GET) i `/api/nexus/checklists` (GET, POST).
- Interfejs w `src/features/codex/`.
- Zależność: renderer Markdowna (`react-markdown` z `remark-gfm`). W `package.json` nie ma dziś żadnej biblioteki do renderowania Markdowna.

### 4.5 Obsługa błędów

- Brak vaulta (`NEXUS_VAULT_PATH` puste): błąd konfiguracji, jak w §4.2 nadrzędnego specu.
- Brak pliku kodeksu: pusty stan z instrukcją utworzenia pliku.
- Zmiana pliku w trakcie sesji: wykrywana po `mtime`, widok się odświeża.

### 4.6 Testy

Zgodnie z samym kodeksem, czerwone najpierw. Parser reguł: wzorzec poprawny, zniekształcone linie, zduplikowane identyfikatory, polskie znaki. Dziennik: odtwarzanie stanu, atomowy zapis, kolejność zdarzeń, uruchomienia dla `owner: work` we właściwej strefie. Komponenty: filtr MUST/SHOULD, odhaczanie, notatka. Trasy API: błąd konfiguracji, brak pliku.

### 4.7 Makieta

Przed kodem powstaje `docs/mockups/karty/cards/09-kodeks.html`, według tego samego procesu co pozostałe karty (nowa karta makiety to osobny kontekst `agy`).

## 5. Część C: treść kodeksu

Tor niekodowy. Punkt wyjścia: opinie `agy` i `cursor` z 2026-11-12 (rozdziały: zakres i hierarchia, TDD i dowód czerwieni, jakość asercji, warstwy testów, dowody przed twierdzeniami, zakres zmian i małe commity, bezpieczeństwo i dane, praca z agentami, egzekucja, anty-wzorce). Zasady przekrojowe: język MUST/SHOULD, krótko (rzędu 80–100 linii na plik, bez rozrostu), kodeks jako kontrakt z odwołaniami do skilli zamiast duplikowania ich treści, każda reguła weryfikowalna.

Do rozstrzygnięcia przy pisaniu: język dokumentu (polski dla czytelności vs angielski dla skuteczności reguł u agentów) oraz sposób podlinkowania z projektowych `CLAUDE.md` jedną linią.

## 6. Poza zakresem pierwszej wersji

Edycja kodeksu w aplikacji, wymagany dowód (komenda, exit code) per punkt checklisty (K4), integracja z kartami Projekty i Kokpit, wymuszanie reguł hookami lub CI (osobna decyzja po napisaniu kodeksu).

## 7. Ryzyka

- **Rozjazd formatu reguł.** Konwencja `[ID] MUST` musi być prosta, bo plik edytuje człowiek. Ograniczenie: łagodny parser (nierozpoznane linie zostają tekstem).
- **Zależność od etapu 0c.** Część B nie ruszy przed `lib/nexus/`. Ograniczenie: część A jest samodzielna, a B ma jawny warunek wejścia.
- **Kolizja skrótu `Alt+9`** z przeglądarką (opisane w części A).
- **Rozrost kodeksu.** Ograniczenie: limit długości w części C i podział na MUST/SHOULD.

## 8. Kryteria ukończenia

- Część A: dziewięć kart w pasku, `Alt+9` i paleta przechodzą do Kodeksu, adres kończy się `#kodeks`, testy z §3 zielone, spec §6.6 i `STYLEGUIDE.md` zaktualizowane.
- Część B: karta czyta `Vault/Knowledge/kodeks.md`, pokazuje reguły z filtrem, uruchamia i odhacza checklisty z notatką, a zdarzenia trafiają do `Vault/Checklists/` (lub `Vault/Work/Checklists/`), testy z §4.6 zielone.
- Część C: istnieje kodeks po przeglądzie `agy` i `cursor`, z regułami w formacie z §4.1.
