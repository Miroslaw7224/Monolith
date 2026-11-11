# Second Brain jako lokalny asystent pracy (połączenie z NEXUS) — projekt

Data: 2026-11-11
Status: szkic do przeglądu (brainstorm zakończony, bez implementacji)

## 1. Cel

Osobisty asystent do pracy z AI i programowaniem, który pomaga nie zgubić się przy równoległej pracy nad kilkoma projektami, etacie i kursach. Second Brain przestaje być produktem dla freelancerów, a staje się lokalnym narzędziem właściciela, zbudowanym na vaulcie NEXUS.

Cztery problemy, które system ma rozwiązać (wszystkie potwierdzone jako ważne):

1. **Przełączanie kontekstu.** Powrót do projektu po kilku dniach: na czym skończyłem, co dalej, co blokuje.
2. **Co robić dzisiaj.** Za dużo otwartych frontów, brak planu dnia i tygodnia z budżetem czasu (etat, projekty własne, kursy).
3. **Rozproszona wiedza.** Skille, prompty, linki, rozwiązania i notatki z kursów w różnych miejscach.
4. **Zależności między projektami.** Brak widoku, co od czego zależy i co da się przenieść.

Etat i projekty własne to ten sam typ obiektu, różniący się etykietą właściciela (`owner: work | personal`).

## 2. Podjęte decyzje

| #   | Decyzja                  | Wybór                                                                                                                                                    |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Źródło prawdy            | Pliki vaulta NEXUS (Markdown/YAML)                                                                                                                       |
| D2  | Gdzie działa             | Tylko lokalnie. Second Brain schodzi z Vercela, Firebase zostaje odpięty                                                                                 |
| D3  | Dane z etatu             | Pełne dane, tylko lokalnie, w ignorowanej przez git strefie `Vault/Work/`                                                                                |
| D4  | Magazyn danych aplikacji | Wszystko w plikach vaulta (bez SQLite i bez Firestore)                                                                                                   |
| D5  | Kopia zapasowa           | Prywatne repo GitHub `Miroslaw7224/NEXUS` dla danych poza `Vault/Work/`. Dla `Vault/Work/` osobny, lokalny backup                                        |
| D6  | Kierunek produktu        | Narzędzie osobiste. Landing, waitlista, regulamin i polityka prywatności są do usunięcia lub uśpienia                                                    |
| D7  | Kolejność prac           | Najpierw odpięcie Firebase i Vercela (etap 0), potem karta projektu, kokpit dnia, arsenał, mapa                                                          |
| D8  | Nazwa aplikacji          | **Monolith** (zamiast „Second Brain”): jedno prywatne, lokalne źródło prawdy dla etatu, projektów i wiedzy. Zmiana nazwy w kodzie i UI to osobne zadanie |

## 3. Stan obecny (wyjściowy)

- **Second Brain** (`Second_brain/`): Next.js 14, Firestore, Gemini, opcjonalnie lokalny agent Ollama. Moduły: kalendarz, zadania, notatki (TipTap), zasoby, mapy myśli, tablica/płótno, log sesji pracy. Firebase siedzi w 19 plikach: `lib/firestore/*` (agentLog, calendar, chunks, collections, documents, notes, resources, tags, taskTemplates, tasks), `services/mindMapService.ts`, auth (`lib/getAuth.ts`, `src/lib/auth/useAuth.ts`, `src/components/LoginScreen.tsx`, `app/(protected)/layout.tsx`, `src/lib/firebase-client.ts`, `lib/firebase-admin.ts`) oraz waitlista (`app/api/waitlist/*`). Warstwa `services/` stoi nad modułami Firestore.
- **NEXUS** (`~/projects/Brain_7224/NEXUS/`): vault Obsidiana (Markdown/YAML, bez frontendu, agent: Cursor/Claude Code). Rejestr `Vault/Projects/_registry.yaml`, per projekt `index.md`, `tasks.md`, `bugs.md`, hub `<id>.md`, plus `focus.md`, `tech-stack-wspolny.md`, `Knowledge/`. Repo ma remote na prywatnym GitHubie, a cały `Vault/` jest śledzony przez git.
- **Zaobserwowane problemy:** `focus.md` pokazuje tydzień z maja 2026 (stale dane ręczne). `local_path` w rejestrze to ścieżki Windows (`E:\...`), a aplikacja działa w WSL, więc potrzebne mapowanie ścieżek.

## 4. Architektura

### 4.1 Warstwa danych w plikach

Moduł serwerowy (`lib/nexus/`), który zastępuje `lib/firestore/*` pod niezmienionymi funkcjami warstwy `services/`:

- `vault-path.ts` — ścieżka vaulta z `NEXUS_VAULT_PATH`, mapowanie `E:\` na `/mnt/e/` (i odwrotnie) z `.env`.
- `registry.ts` — wczytuje i łączy `_registry.yaml` oraz `Work/_registry.work.yaml`, oznacza `owner`.
- `project.ts` — buduje obiekt projektu z `index.md`, `tasks.md`, `bugs.md`, `state.md`, `devlog.md` (frontmatter, daty modyfikacji, `state_confidence`).
- `markdown-edit.ts` — punktowy zapis (zmiana jednej linii checklisty, dopisanie wpisu), bez przepisywania pliku.
- repozytoria per typ danych: tasks, calendar, notes, mind-maps, resources, sessions, inbox, courses.

Przepływ: `Vault (pliki) <-> lib/nexus/ <-> API routes (/api/nexus/*) <-> UI`.

### 4.2 Zasady zapisu

- **Stabilne `id`** we frontmatterze lub polach wpisu. Zmiana nazwy pliku w Obsidianie niczego nie psuje.
- **Zadania** zostają listami `- [ ]` z polami inline w stylu Obsidiana, np. `- [ ] Smoke test [energy:: quick] [due:: 2026-11-12]`. Zmieniamy linię, nie plik.
- **Logi tylko dopisywane** (JSONL dla sesji, `inbox.md`). Brak konfliktów przy edycji w dwóch miejscach.
- **Zapis atomowy** (plik tymczasowy plus `rename`) i **kontrola `mtime`**: jeśli plik zmienił się w międzyczasie (Obsidian, Cursor), aplikacja nie nadpisuje, tylko prosi o decyzję.
- **Granica zapisu:** aplikacja zapisuje tylko w `Vault/`. Kod projektów może tylko czytać (np. `git log` w etapie późniejszym), zgodnie z regułą z `NEXUS/CLAUDE.md`.
- **Brak vaulta** (`NEXUS_VAULT_PATH` puste): moduł zgłasza błąd konfiguracji, aplikacja nie startuje w trybie częściowym.

### 4.3 Układ plików w vaulcie (`+` = nowe)

```
Vault/
├ Projects/_registry.yaml          + pola owner, type
├ Projects/<id>/                   index, tasks, bugs  + state, devlog, ai-context (opcjonalny)
├ Work/                            (gitignore) _registry.work.yaml, projekty etatu, calendar.yaml
├ + Calendar/2026-11.yaml          wydarzenia: tytuł, od–do, link, project, brief, action items
├ + Notes/<slug>.md                notatki (frontmatter: id, tags, project)
├ + MindMaps/<id>.json             mapy myśli
├ + Resources/resources.yaml       linki, tagi, ulubione
├ + Sessions/2026-11.jsonl         log sesji (jedna linia = jedna sesja)
├ + Inbox/inbox.md                 szybki inbox
├ + Courses/<slug>.md              kursy, postęp, akcje do projektów
└ Knowledge/, focus.md             bez zmian
```

Notatki są w Markdown (TipTap przez rozszerzenie Markdown). Przy migracji istniejące notatki są konwertowane z HTML, a straty formatowania są raportowane, a nie cicho gubione.

## 5. Prywatność i dane z etatu

Vault NEXUS jest śledzony przez git z remote na GitHubie, więc dane etatu nie mogą trafić do `Vault/Projects/`.

- `Vault/Work/` trafia do `.gitignore`. Zawiera `_registry.work.yaml`, foldery projektów etatu (ten sam format co zwykłe), `calendar.yaml`. Obsidian widzi ten folder w grafie, git nie.
- **Kontrola gita:** przy starcie most uruchamia `git check-ignore Vault/Work/`. Jeśli folder nie jest ignorowany, zapis i odczyt danych etatu są blokowane i pokazywany jest komunikat.
- **Brak wysyłki do zewnętrznego AI:** treści projektów `owner: work` nigdy nie idą do Gemini. Mogą trafić do lokalnej Ollamy albo nigdzie. Gdy Ollama jest wyłączona, funkcje AI dla tych projektów są wyszarzone.
- **Kontekst dla AI:** przycisk „kopiuj" działa także dla projektów etatu, ale pokazuje ostrzeżenie „dane z firmy: sprawdź, gdzie wklejasz".
- **Brak eksportu** (HTML, linki publiczne) dla projektów etatu.
- **Koszt wariantu:** brak automatycznej kopii dla `Vault/Work/`. Potrzebny osobny lokalny backup (np. szyfrowane repo lokalne lub kopia na dysk zewnętrzny).
- Spotkania z etatu są w `Vault/Work/calendar.yaml`. Kokpit łączy je z resztą kalendarza w pamięci.

## 6. Moduły (docelowy zakres funkcjonalny)

### 6.1 Karta projektu (etap 1)

Wspólny szablon dla etatu i projektów własnych.

- **Metryczka:** nazwa, typ (etat / własny / biblioteka), status (Active, On Hold, Blocked, Maintenance), pasek postępu kamienia milowego.
- **Save State** (`state.md`): ostatni branch i środowisko, ostatni bloker, następny mały krok (wejście w projekt w 2 minuty), ważne linki (repo, Jira/Trello, Figma, Dev/Prod, dokumentacja).
- **Tablica zadań** (`tasks.md`): Teraz / Następne / Icebox. Przy zadaniach z pracy pole na link lub ID ticketa.
- **Kontekst dla AI** (`ai-context.md` lub składany z `index.md`): architektura, stack, zasady kodowania, kopiowany jednym kliknięciem.
- **Paczka kontekstu dla agenta** (rozbudowa przycisku „kopiuj”): jednym kliknięciem składa w locie blok Markdown dla nowej sesji AI, z budżetem długości (ok. 4 tys. tokenów). Zawartość:
  1. zasady projektu (`ai-context.md` lub wyciąg z `index.md`),
  2. Save State ze `state.md` (branch, bloker, następny krok),
  3. zmiany w kodzie: `git status`, ostatnie 5 commitów, `git diff --stat` (nie pełny diff),
  4. sekcja „Teraz” z `tasks.md` i otwarte bugi z `bugs.md`,
  5. 2–3 ostatnie wpisy z `devlog.md`.

  Git jest tylko odczytywany. Dla `owner: work` obowiązuje ostrzeżenie z sekcji 5. Później (koszt M): szablony per rola (review / implementacja / debug) z innym zestawem sekcji i podglądem przed skopiowaniem.

- **Dziennik decyzji** (`devlog.md`): data, co ustalono i dlaczego.
- **Świeżość danych:** karta pokazuje `last_worked` i `state_confidence`, aby stale dane (jak `focus.md` z maja) były widoczne.

### 6.2 Kokpit Dnia (etap 2)

Ekran startowy.

- **Oś czasu spotkań:** godziny, tytuł, tag projektu, przycisk linku (Meet/Teams/Zoom/Discord), brief przed spotkaniem (2–3 punkty plus powiązane zadania), pole na action items po spotkaniu.
- **Aktywne punkty skupienia:** 2–3 rozgrzebane tematy, każdy z jednym zdaniem z Save State. Limit 2–3 aktywnych projektów naraz.
- **Kolejka zadań na dziś:** wspólna lista z wielu projektów, oznaczenie energii (Deep Work / Quick Win).
- **Szybki inbox:** jeden skrót, który łapie myśl, link, fragment kodu lub bug. Segregacja wieczorem do projektu lub kursu.
- **Przegląd tygodnia:** AI zestawia sesje, commity i zamknięte zadania, użytkownik wybiera focus (dla `owner: work` tylko lokalna Ollama).

### 6.3 Arsenał (etap 3)

- **Katalog skilli i narzędzi AI:** przy każdym zebrane prompty/reguły/snippety/konfiguracje agentów oraz powiązane projekty (praca i prywatne).
- **Kursy:** tytuł, link, postęp (moduł x z y), notatki z lekcji, **action items** powiązane z projektem („wdrożyć ten wzorzec w projekcie X"), możliwość dodania zadania do karty projektu bezpośrednio z widoku kursu.
- **Koszty AI** (opcjonalnie): tokeny i API per projekt.

### 6.4 Mapa projektów i zależności (etap 4)

- **Węzły:** aplikacje, systemy z etatu, biblioteki, skrypty, szablony, bazy danych.
- **Relacje:** twarda zależność (bloker), współdzielenie zasobów (komponent/prompt do ponownego użycia), przepływ danych. Wykorzystuje dane z `tech-stack-wspolny.md`.
- **Opcjonalnie: „agenci na żywo" z Herdr** (patrz sekcja 8).

### 6.5 Pomysły z burzy mózgów (backlog, 2026-11-11)

Propozycje z burzy mózgów z `agy` i `cursor`. Nie są jeszcze zatwierdzonym zakresem: każdy pomysł trafia do speca swojego etapu dopiero po decyzji. Koszt: S / M / L.

| Pomysł                              | Co robi                                                                                                                                                                                             | Etap | Koszt |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- |
| **Save State z gita**               | Przy wyjściu z projektu ostatni branch, commit i zmienione pliki same trafiają do `state.md`; ręcznie dopisuje się tylko „następny krok”. Ogranicza starzenie się danych ręcznych (jak `focus.md`). | 1    | S     |
| **Wykrywacz porzuconych projektów** | Projekt bez commitu i zmian w plikach przez ponad 14 dni (próg w konfiguracji) wymaga decyzji: Icebox albo domknięcie. Rozwija `state_confidence` z §6.1.                                           | 1    | S     |
| **Wyszukiwarka decyzji**            | Przeszukuje `devlog.md` we wszystkich projektach (data, tag, „dlaczego”).                                                                                                                           | 1    | S     |
| **Rytuał zamknięcia dnia**          | Wieczorem krótki zapis: co domknięte, co otwarte, jeden punkt zaczepienia na jutro (wpis w `Sessions/` i `Inbox/inbox.md`). Jutrzejszy kokpit pokazuje go na górze.                                 | 2    | S     |
| ~~**Przełącznik praca/życie**~~     | **Odrzucone 2026-11-11:** etat nie jest wykonywany na tym PC, więc praca i życie się nie mieszają.                                                                                                  | —    | —     |
| **Planer slotów**                   | Na podstawie kalendarza i pól `[energy::]` w `tasks.md` proponuje 1–3 okna Deep Work / Quick Win w wolnych godzinach dnia.                                                                          | 2    | M     |
| **Raport na daily / tygodniowy**    | Streszcza `devlog.md`, zamknięte zadania i commity do 3 punktów (dzień albo tydzień). Rozszerza przegląd tygodnia z §6.2; dla `owner: work` tylko lokalna Ollama.                                   | 2    | M     |
| **Wspólna baza rozwiązań bugów**    | Łączy wpisy z `bugs.md` z różnych projektów i podpowiada wcześniejsze rozwiązania przy powtarzających się problemach ze stackiem. Bez mieszania treści `owner: work` z zewnętrznym AI.              | 3    | M     |
| **Dziennik pracy agentów**          | Każde zadanie zlecone agentom (`ask-helper`, sesje Claude Code) zostawia wpis JSONL przy projekcie: kto, co, wynik. Uzupełnia stan na żywo z Herdr (§8) o historię.                                 | 3    | M     |
| **Radar blokad**                    | Szuka wspólnych blokerów w `state.md` / `bugs.md` wielu projektów (ta sama osoba, API, decyzja) i pokazuje, który jeden ruch odblokuje kilka projektów.                                             | 4    | M     |

### 6.6 Podział na karty (decyzja 2026-11-11)

Aplikacja dzieli się na 8 kart. Wzorcem wizualnym są makiety w `docs/mockups/karty/` (`index.html`, `STYLEGUIDE.md`, `tokens.css`); zestawienie z obecnym kodem jest w `docs/mockups/karty/STAN-W-KODZIE.md`.

| Skrót | Karta     | Zawartość                                                                      | Etap specu | Punkt wyjścia w kodzie                                 |
| ----- | --------- | ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------ |
| Alt+1 | Kokpit    | spotkania dnia, aktywne tematy z Save State, kolejka na dziś, inbox, rytuał    | 2          | `src/features/home/HomeView.tsx`                       |
| Alt+2 | Kalendarz | miesiąc / tydzień / agenda, planer slotów, brief i action items                | 2          | `src/components/CalendarView.tsx`                      |
| Alt+3 | Zadania   | wspólna lista z projektów, energia Deep / Quick, filtry, Teraz/Następne/Icebox | 1–2        | `src/components/TasksSection.tsx`, `useTasksBoard.ts`  |
| Alt+4 | Projekty  | rejestr, karta projektu z §6.1                                                 | 1          | brak (nowa, na `lib/nexus/`)                           |
| Alt+5 | Notatki   | notatki Markdown, [[wiki]], backlinks, wyszukiwarka decyzji                    | 0–1        | `src/components/NoteEditor.tsx`, `src/features/notes/` |
| Alt+6 | Płótno    | tablica (xyflow) i mapy myśli                                                  | 0          | `src/features/board/`, `src/features/mind-maps/`       |
| Alt+7 | Arsenał   | skille i prompty, zasoby, kursy, baza rozwiązań bugów                          | 3          | `src/components/ResourceSection.tsx`                   |
| Alt+8 | Mapa      | graf zależności, radar blokad, agenci z Herdr                                  | 4          | brak (nowa)                                            |

- **Szkielet** (wspólny dla kart): pasek kart po lewej z numerami 1–8 i akcentem aktywnej karty, `Alt+1…8` przełącza karty, `Ctrl+K` otwiera paletę poleceń. Pasek stanu (projekt, vault, branch) dochodzi, gdy istnieje `lib/nexus/`.
- **Szkielet nie zależy od danych.** Nie dotyka Firebase ani vaulta, więc można go wdrożyć przed etapem 0 albo po nim. Na start pasek kart steruje istniejącym stanem widoków (`appMode` / `planningTab`); karty bez kodu (Projekty, Mapa) pokazują zaślepkę z numerem etapu.
- **Przenoszenie kart pojedynczo.** Każda karta po kolei dostaje swój motyw (`data-card`, zmienne z `tokens.css`) i układ z makiety. Dopóki karta nie jest przeniesiona, wygląda jak dziś: globalne zmienne aplikacji (`--bg`, `--accent`) nie są nadpisywane, szkielet używa tylko akcentów `--c-<karta>`.
- **Stary pasek boczny i nawigacja mobilna** zostają do czasu przeniesienia wszystkich kart. Telefon jest poza zakresem (§10), więc pasek kart jest tylko na desktopie.
- **Skróty:** `Alt+cyfra` jest sprawdzane po `event.code` (niezależnie od układu klawiatury) i ignorowane przy wciśniętym Ctrl, aby nie łapać AltGr z polskiej klawiatury. Ryzyko: Chrome na Linuksie zajmuje `Alt+1…8` do przełączania kart przeglądarki; w przeglądarce z Windows (aplikacja w WSL) skrót jest wolny.

## 7. Etapy wdrożenia

Każdy etap dostaje osobny spec, plan i wdrożenie.

0. **Odpięcie Firebase i Vercela.**
   - Skrypt eksportu Firestore do plików, z liczeniem rekordów przed i po. **Eksport przed jakimkolwiek odpięciem.**
   - Warstwa plikowa `lib/nexus/` pod istniejącymi funkcjami `services/`.
   - Usunięcie auth, waitlisty, stron prawnych, zależności Firebase. Zdjęcie aplikacji z Vercela dopiero po weryfikacji migracji.
   - Dodanie `Vault/Work/` do `.gitignore` NEXUS i kontroli `git check-ignore`.
1. **Karta projektu** (Save State, kontekst dla AI z paczką kontekstu dla agenta, devlog, etykieta Firma/Moje).
2. **Kokpit Dnia.**
3. **Arsenał.**
4. **Mapa zależności** i opcjonalnie integracja z Herdr.

**Szkielet kart** (§6.6: pasek kart, `Alt+1…8`, `Ctrl+K`) nie zależy od danych i może wejść przed etapem 0 albo po nim. Plan: `docs/superpowers/plans/2026-11-11-karty-szkielet.md`.

Podejście do mostu: adapter plików w aplikacji (opcja A). Indeks z file watcherem (B) dokładany dopiero, gdy wydajność tego wymaga. Serwer MCP dla NEXUS (C) jako późniejsze opakowanie, aby UI i agenci zapisywali tym samym sposobem. Moduł `lib/nexus/` ma czyste granice, aby to umożliwić.

## 8. Herdr (do zbadania)

Herdr to multiplekser terminala dla agentów kodujących (workspace, taby, panele, stany agentów `idle/working/blocked/done`, CLI zwracające JSON). Pomysł: przy karcie projektu pokazywać, który agent działa i w jakim stanie (mapowanie `cwd` panelu na `local_path`), szczególnie stan `blocked`. Tylko odczyt i lokalnie, dla `owner: work` tylko nazwa i stan.

Źródło: oficjalne repo to `herdrdev/herdr` (Apache-2.0; stary adres `ogulcancelik/herdr` przekierowuje tam), strona herdr.dev. Wersja v0.9.5 (linux-x86_64) została zweryfikowana 2026-11-11: suma SHA-256 z manifestu herdr.dev (`14d9e8bc…929d`) zgadza się z sumą pobranego pliku i z digestem zasobu w wydaniu GitHub, a atestacja wydania GitHub wymienia ten plik z tą samą sumą. Nie zweryfikowano podpisu kryptograficznego ani zgodności binarki ze źródłem (brak budowy ze źródeł). Nie ustalono, czy Herdr sprawdza aktualizacje lub wysyła telemetrię w tle.

Otwarte: czy `herdr` da się odpytać spoza panelu Herdr (skill wymaga `HERDR_ENV=1`) oraz różnica Windows/WSL. Do rozstrzygnięcia po ustawieniu Herdr, zanim cokolwiek zaprojektujemy.

Uwaga: wklejony fragment „Regulamin stołu (Kodeks 9.3, bramka-nieodwracalna)" jest lokalnym dodatkiem do skilla i nie występuje w pliku `SKILL (2).md`.

## 9. Ryzyka i otwarte kwestie

- **Utrata danych z Firestore** przy odpięciu: wymaga eksportu, weryfikacji liczności i zachowania kopii przed usunięciem projektu Firebase.
- **Konwersja notatek HTML do Markdown** może gubić formatowanie.
- **Brak kopii dla `Vault/Work/`** do czasu ustalenia osobnego backupu.
- **Polityka firmy** wobec przechowywania danych etatu na prywatnym dysku nie została sprawdzona. Wariant „tylko szkielet" pozostaje bezpieczną alternatywą, jeśli zasady okażą się restrykcyjne (pole `owner: work` jest zaprojektowane tak, aby dało się zawęzić zakres danych).
- **Edycja współbieżna** (Obsidian, Cursor, aplikacja) obsługiwana przez kontrolę `mtime`, ale wymaga testów.
- **Mapowanie ścieżek Windows/WSL** (`E:\` na `/mnt/e/`) musi być konfigurowalne.

## 10. Poza zakresem

Synchronizacja wielourządzeniowa, dostęp z telefonu, tryb wieloużytkownikowy, publiczny produkt dla freelancerów, serwer MCP (jako osobny, późniejszy krok).
