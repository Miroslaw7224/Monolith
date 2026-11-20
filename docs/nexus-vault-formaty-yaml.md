# Format plików w vaulcie (tagi, szablony, zasoby, zadania, kalendarz, notatki, mapy myśli, tablica)

Aplikacja czyta i zapisuje pliki w `NEXUS/Vault/` (ścieżka z `NEXUS_VAULT_PATH`). Kod: `lib/nexus/yaml-store.ts`, repozytoria w `contexts/*/repositories*`.

| Plik                       | Klucz listy | Pola rekordu (kolejność)                                                                                         |
| -------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `Resources/tags.yaml`      | `tags`      | `id`, `tag`, `title`, `color` (opcjonalne), `aliases`\*, `created`                                               |
| `Tasks/templates.yaml`     | `templates` | `id`, `label`, `title`, `link`, `created`                                                                        |
| `Resources/resources.yaml` | `resources` | `id`, `title`, `url`, `description`, `tags`, `favorite`, `thumbnail_url`\*, `note_id`\*, `created`, `updated`    |
| `Arsenal/courses.yaml`     | `courses`   | `id`, `title`, `url`, `provider`\*, `status`, `completed`\*, `certificate_url`\*, `certificate_file`\*, `note`\* |
| `Arsenal/agents.yaml`      | `items`     | `id`, `kind`, `name`, potem pola rodzaju (niżej)                                                                 |

\* opcjonalne: klucz jest pomijany, gdy brak wartości (nigdy `null`).

Struktura pliku: `version: 1`, lista rekordów pod kluczem. Czas to tekst ISO 8601 (UTC). `id`: 20 znaków alfanumerycznych.

## Zasady zapisu

- Aplikacja zapisuje atomowo i tylko wtedy, gdy plik nie zmienił się od odczytu (inaczej ponawia; po wyczerpaniu ponowień błąd 409).
- Nieznane klucze w rekordach i kolejność rekordów przeżywają zapis. **Komentarze YAML giną**, podobnie jak ewentualne klucze najwyższego poziomu pliku inne niż `version` i lista.
- Po pierwszym zapisie aplikacji znika `generated_by`, więc ponowny import 0b zapisze pliki obok zamiast je nadpisać.
- Plik, który się nie parsuje, nie jest nadpisywany; operacja kończy się błędem z nazwą pliku.
- Odczyt jest posortowany niezależnie od kolejności w pliku: tagi i szablony rosnąco po `created`, zasoby malejąco po `created`; remisy po `id`.
- Vault jest jednoużytkownikowy; `userId` nie istnieje (usunięty w 0d-1).
- Ręcznie wpisane `favorite: yes` jest czytane jako tekst (YAML 1.2), czyli nie jako „ulubiony”. Używaj `true`/`false`.

## Tagi: słownik i synonimy

- `aliases` to lista synonimów nazwy `tag`, porównywanych bez względu na wielkość liter; klucz jest pomijany, gdy brak synonimów.
- Kalendarz (`Calendar/*.yaml`) i zasoby (`Resources/resources.yaml`) trzymają w `tags` **nazwy kanoniczne**.
- Zapis przez API sprowadza synonimy do nazw kanonicznych, usuwa duplikaty i dopisuje nieznane tagi do `tags.yaml` (bez `color`, `title` = nazwa); ręczny zapis plików tego **nie** robi, więc dopisz tag do słownika sam.
- Synonimy dopisuje się ręcznie lub przez agenta, UI ich nie edytuje.

## Kursy: `Arsenal/courses.yaml`

Karta Arsenał, zakładka Kursy. Zapis z aplikacji (`lib/nexus/yaml-store.ts`), plik można też edytować ręcznie.

- `status`: `plan`, `w-trakcie` albo `ukonczony`. `completed` (RRRR-MM-DD) ma sens tylko przy `ukonczony`; aplikacja dopisuje dzisiejszą datę, gdy jej brak, i kasuje ją przy innym statusie.
- `url` i `certificate_url`: tylko `http://` lub `https://`.
- `certificate_file`: ścieżka względem `Vault/Documents/` (np. `certyfikaty/mcp.pdf`), bez `..`, bez `/` na początku. PDF wrzucasz ręcznie; brak pliku to ostrzeżenie w UI, nie błąd.
- Wpis bez `id`, `title`, poprawnego `status`, poprawnego `url` albo z niedozwoloną ścieżką certyfikatu jest pomijany (licznik „pominięto N” w nagłówku zakładki); reszta listy się ładuje.
- Kolejność w UI: `w-trakcie`, `plan`, `ukonczony`, w grupie po tytule. Kolejność w pliku nie ma znaczenia.

## Agenci i polecenia: `Arsenal/agents.yaml`

Karta Arsenał, zakładka „Agenci i polecenia”. Zapis z aplikacji (`lib/nexus/yaml-store.ts`), plik można też edytować ręcznie. Jedna lista `items`; rodzaj wpisu w polu `kind`:

| `kind`   | Wymagane          | Opcjonalne               | Znaczenie                                                  |
| -------- | ----------------- | ------------------------ | ---------------------------------------------------------- |
| `agent`  | `name`, `role`    | `model`, `when`          | kto do czego: rola, model lub tier, kiedy używać           |
| `preset` | `name`, `command` | `description`            | szablon polecenia `ask-helper`; tylko do kopiowania        |
| `script` | `name`, `path`    | `description`, `example` | skrypt z `scripts/` i przykład użycia; tylko do kopiowania |

- Kolejność w UI: sekcje agenci, presety, skrypty; w sekcji kolejność z pliku (lista jest redagowana ręcznie).
- Wpis bez `id`, `name`, z nieznanym `kind` albo bez pola wymaganego jest pomijany (licznik „pominięto N”); reszta się ładuje.
- Aplikacja niczego nie uruchamia: `command` i `example` tylko trafiają do schowka.
- Dane początkowe pochodzą z `CLAUDE.md` (tabela agentów, `ask-helper`) i `scripts/`; aplikacja nie parsuje `CLAUDE.md`, więc przy zmianie tamtych reguł zaktualizuj wpisy tu.

## Zadania: `Tasks/tasks.md`

Frontmatter (po pierwszym zapisie aplikacji bez `generated_by`), nagłówek `# Zadania`, potem jedna linia na zadanie:

`- [ ] Tytuł [id:: …] [status:: todo] [due:: RRRR-MM-DD] [priority:: n] [project:: id] [order:: n] [link:: …] [desc:: …] [created:: ISO] [updated:: ISO]`

- Pola `due`, `priority`, `project`, `link`, `desc` są pomijane, gdy puste. `project` to id projektu z `Projects/_registry.yaml` (małe litery, cyfry, `-`, `_`, do 64 znaków): zadanie z projektem dostaje w aplikacji kolor i znacznik rodzaju tego projektu (spec `2026-11-15-zadania-ogolne-projekt-design.md`); nieznane id nie daje koloru i niczego nie psuje. `status`: `deferred` (odłożone: nie trafia do kolejki Kokpitu, terminów w kalendarzu ani liczników terminów), `todo`, `in_progress`, `to_review`, `done`; pole wyboru `[x]` oznacza `done`, a `deferred` ma `[ ]`.
- W tytule i wartościach pól ucieczki: `\[`, `\]`, `\\`, `\n`. Parser: `lib/nexus/task-line.ts`, edycja: `lib/nexus/markdown-edit.ts`.
- Aplikacja zmienia **tylko** linię zadania, którego dotyczy żądanie; reszta pliku (nagłówki, notatki, inne linie) zostaje bajtowo. Dodane zadanie trafia na koniec pliku.
- Linie bez `id` lub z uszkodzonymi polami nie pojawiają się w aplikacji i nie są zmieniane. Przy duplikacie `id` obowiązuje pierwsza linia.
- Edytowana linia jest formatowana od nowa: **nieznane pola inline w tej linii giną** (np. `[foo:: x]`; znane: `id`, `status`, `due`, `priority`, `project`, `order`, `link`, `desc`, `created`, `updated`). Dodatkowe informacje wpisuj w `desc`.
- Przeciąganie zadań (`reorder`) zmienia tylko `order` i tylko w liniach, w których wartość się zmienia; edycja zmienia `updated`.
- **Checklista testów w `desc`** (spec `2026-11-16-zadania-checklista-panel-design.md`): linie `- [ ] tekst` (do zrobienia), `- [x] tekst` (PASS), `- [!] tekst` (FAIL); wcięcie 2 spacji = podpunkt; linie `> uwaga` bezpośrednio pod punktem to jego komentarz. Reszta tekstu zostaje bez zmian. Aplikacja zapisuje `desc` ucieczkowany (`\n`, `\[`, `\]`), więc zmieniaj go przez aplikację lub API, nie ręcznie w `tasks.md`.

## Kalendarz: `Calendar/RRRR-MM.yaml`

Jeden plik na miesiąc **daty początku** wydarzenia. Struktura: `version: 1`, lista pod kluczem `events`. Przykład (prawdziwy rekord):

```yaml
version: 1
events:
  - id: VAWXDPL63fvELI75LKT4
    date: "2026-11-18"
    start_minutes: 1200
    duration_minutes: 60
    title: Career Guide
    tags:
      - Career Guide
    color: "#00802b"
    type: meeting
    created: "2026-11-13T20:27:15.954Z"
    link: https://meet.google.com/gon-fztr-zrn
    updated: "2026-11-13T20:40:04.823Z"
```

| Pole               | Wymagane | Znaczenie                                                                                                                    |
| ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`               | tak      | 20 znaków alfanumerycznych, unikalne w całym katalogu `Calendar/` (nie tylko w pliku)                                        |
| `date`             | tak      | `"RRRR-MM-DD"` **w cudzysłowie**, data lokalna użytkownika (bez przesunięcia UTC)                                            |
| `start_minutes`    | tak      | minuty od północy czasu lokalnego, liczba: 09:00 = `540`, 19:00 = `1140`, 20:00 = `1200`                                     |
| `duration_minutes` | tak      | minuty, **wielokrotność 15** (inaczej API odrzuca; ręczny zapis to omija, więc pilnuj sam)                                   |
| `title`            | tak      | tekst; brak = pusty                                                                                                          |
| `tags`             | tak      | lista nazw kanonicznych tagów (może być `[]`); to nazwy, nie id tagów z `Resources/tags.yaml`                                |
| `color`            | tak      | `"#RRGGBB"`; domyślnie `"#3B82F6"`                                                                                           |
| `type`             | tak      | `work` albo `meeting`; każda inna wartość jest czytana jako `work`                                                           |
| `created`          | tak      | ISO 8601 UTC (`2026-11-13T20:27:15.954Z`)                                                                                    |
| `updated`          | nie      | ISO 8601 UTC; ustawiane przy edycji, rozstrzyga duplikaty `id`                                                               |
| `link`             | nie      | adres spotkania, tylko `http(s)://…` bez spacji, do 500 znaków; inne schematy (np. `javascript:`) są przy odczycie odrzucane |
| `brief`            | nie      | notatka przed spotkaniem, do 1000 znaków, wiele linii, każda linia = punkt                                                   |

Pola opcjonalne (`link`, `brief`, `updated`) są pomijane, gdy brak wartości (nigdy `null`, nigdy pusty tekst).

### Jak dodawać wydarzenia (agent)

Zapisuj **przez API** działającej aplikacji (`http://127.0.0.1:3100`), nie ręczną edycją YAML: API generuje `id`, ustawia `created`, wybiera plik miesiąca, waliduje `link`/`brief`/15 minut i zapisuje atomowo.

- `GET /api/calendar/events?startDate=RRRR-MM-DD&endDate=RRRR-MM-DD`: lista, razem z wirtualnymi `task_deadline` (`id` = `task:<id zadania>`, 23:30, 30 min, `#6B7280`; **nie są w pliku** i nie da się ich edytować przez kalendarz).
- `POST /api/calendar/events`: ciało JSON `{date, start_minutes, duration_minutes, title, tags, color, type, link?, brief?}`; wymagane tylko `date` i `duration_minutes`, reszta ma wartości domyślne (`start_minutes` 0, `tags` `[]`, `color` `#3B82F6`, `type` `work`). Odpowiedź: zapisane wydarzenie.
- `PUT /api/calendar/events/<id>`: częściowa zmiana (tylko podane pola). `link` albo `brief` równe `""` usuwa pole. Zmiana `date` na inny miesiąc przenosi rekord do pliku tego miesiąca. Odpowiedź: `{"success": true}`.
- `DELETE /api/calendar/events/<id>`: usuwa. Odpowiedź: `{"success": true}`.
- Każdy `POST`/`PUT`/`DELETE` z `curl` wymaga nagłówka `X-Nexus-Client: 1` (strażnik `lib/http/localGuard.ts`, inaczej 403). Ciało podawaj przez heredoc `<<'JSON'`, jak w skillu `segreguj-inbox`.
- Błędy: 400 zła data, `duration_minutes` niebędące wielokrotnością 15, zły `link`, za długi `brief`; 404 brak wydarzenia przy `PUT`; 409 plik zmienił się w trakcie zapisu.
- Przed dodaniem pokaż użytkownikowi, co zapiszesz (data, godzina, czas, tytuł), i dopiero po zgodzie wołaj `POST`.

### Zasady odczytu i zapisu

- Wydarzenie przechodzące przez północ lub granicę miesiąca jest jednym rekordem w pliku miesiąca początku. Aplikacja czyta wszystkie pliki miesięcy (`RRRR-MM.yaml`); pliki o innych nazwach są ignorowane.
- Ten sam `id` w dwóch miesiącach: wygrywa rekord z późniejszym `updated` (brak = `created`), przy remisie późniejszy plik.
- Zmiana `date` na inny miesiąc przenosi rekord do pliku tego miesiąca.
- Zasady zapisu jak w pozostałych plikach YAML (nieznane klucze rekordu przeżywają, komentarze giną, uszkodzony plik nie jest nadpisywany).
- Terminy zadań (`due`) nie są zapisywane w kalendarzu: aplikacja dolicza je w locie.

## Focus tygodnia: `Cockpit/weeks.yaml`

Jedno zdanie na tydzień, zapisywane z panelu „Przegląd tygodnia” w Kokpicie. Plik zapisuje aplikacja.

```yaml
version: 1
weeks:
  - week_start: "2026-11-16" # poniedziałek tygodnia ISO
    text: Domknąć słownik tagów
```

- Jeden rekord na `week_start`; ponowny zapis w tym samym tygodniu nadpisuje wpis.
- Kokpit pokazuje tylko rekord bieżącego tygodnia; starsze zostają w pliku.
- Wpisy bez poprawnej daty `RRRR-MM-DD` albo bez tekstu są pomijane.

## Notatki: `Notes/<slug>.md`

Frontmatter (`id`, `title`, `created`, `updated`, `tags`), pusta linia, potem treść w **Markdownie**. Przykład:

```
---
id: gmuXuPubwth2cvHDJiNy
title: Pomysły
created: "2026-11-10T21:26:56.494Z"
updated: "2026-11-12T08:00:00.000Z"
tags:
  - praca
---

Treść z **pogrubieniem** i listą:

- punkt
```

- Nazwa pliku (`slug`) powstaje z tytułu przy tworzeniu i **nie zmienia się** po zmianie tytułu. Kolizja daje sufiks `-2`, `-3` (bez rozróżniania wielkości liter); pusty tytuł daje `bez-tytulu.md`. W slugu zostają tylko `a-z`, `0-9` i `-`.
- Aplikacja szuka notatki po `id` z frontmattera. Plik `.md` bez frontmattera albo bez tekstowego `id` nie pojawia się w aplikacji i nie jest zmieniany. Przy duplikacie `id` obowiązuje pierwszy plik w kolejności nazw.
- Zapis zmienia `title`, treść i `updated`; **pozostałe klucze frontmattera (np. `tags`, wpisy z Obsidiana) i ich kolejność zostają**. Komentarze w frontmatterze giną.
- Edytor notatek zapisuje Markdown: zostaje pogrubienie, kursywa, przekreślenie, nagłówki, listy, cytaty i kod. Kolor, krój i rozmiar czcionki, wyrównanie, podkreślenie, tabele, listy zadań i zakreślenie nie mają odpowiednika; oryginał HTML starych notatek jest w `Notes/.html/<id>.html` i **aplikacja go nie rusza** (także przy usuwaniu notatki).
- Surowy HTML w treści jest w widoku notatki pokazywany jako tekst.
- Odczyt: `created` malejąco; brak `title` daje nazwę pliku.

## Mapy myśli: `MindMaps/<id>.json`

Jeden plik na mapę; `id` (20 znaków alfanumerycznych) to nazwa pliku. JSON z wcięciem 2 spacje i końcowym `\n`:

```
{ "title": "…", "rootNode": { "id": "root", "label": "…", "note": "<p>…</p>", "collapsed": false, "children": [] },
  "colWidths": { "0": 200 }, "createdAt": "ISO", "updatedAt": "ISO" }
```

- Vault jest jednoużytkownikowy; `userId` nie istnieje. Notatki węzłów (`note`) zostają w HTML (inny edytor niż notatki).
- Uszkodzony plik JSON jest pomijany na liście map, a przy otwarciu tej mapy aplikacja zgłasza błąd z nazwą pliku.
- `id` z adresu spoza `[A-Za-z0-9_-]{1,64}` jest traktowany jak nieistniejący.

## Tablica: `Board/board.json`

Jeden plik: `{ "tiles": […], "frames": […], "edges": […], "updatedAt": "ISO" }`. Brak pliku to pusta tablica. Zapis zawsze nadpisuje plik (ostatni zapis wygrywa).

## Opis projektu: `Projects/<projekt>/index.md`, sekcja „Po co i dlaczego”

Pierwsza sekcja `index.md` po frontmatterze i linii nawigacji, przed `## O projekcie`: 2–3 zdania, po co projekt istnieje i dlaczego powstał. Aplikacja **tylko czyta** ją (karta Projekty, tuż pod kafelkiem z nazwą i linkami, przed Save State); edycja ręczna lub przez agenta. Brak sekcji albo sama biała treść = brak karty. Nagłówek dokładnie `## Po co i dlaczego` (wielkość liter ma znaczenie), pierwsza taka sekcja wygrywa. W treści nie używaj linii zaczynających się od `## ` (parser kończy sekcję na każdej takiej linii, także w bloku kodu). Tekst jest surowy, bez Markdown; łamanie linii zostaje. Motywacji („dlaczego”) agent nie zgaduje: gdy nie wynika ze źródeł, wpisuje „Motywacja: do uzupełnienia”.

## Save State: `Projects/<projekt>/state.md`

Plik aplikacji (formularz „Save State” w karcie Projekty); frontmatter YAML + treść jako notatki.

```yaml
---
branch: main
env: lokalnie
blocker: ""
next_step: Uruchomić testy
links: []
milestone: ""
milestone_due: 2026-12-01 # opcjonalnie
updated: 2026-11-16T20:45 # ustawia aplikacja przy Save State
code_commit: 8c107d7a… # opcjonalnie: sha commita repo, z którym zgadza się karta
---
```

- `code_commit`: pełny (zalecany) lub skrócony sha, 7–40 znaków szesnastkowych. Aplikacja porównuje go z HEAD repo z `local_path` i pokazuje „kod nowszy: N commitów”, gdy repo poszło dalej. Zapisuje go przycisk „Oznacz jako zaktualizowaną” albo agent po odświeżeniu karty (paczka kontekstu w roli „Odśwież kartę” zawiera tę instrukcję).
- Zapis formularza Save State zachowuje `code_commit`; przycisk „Oznacz jako zaktualizowaną” zmienia tylko to pole (nie rusza `updated`).
- Bez `code_commit` (albo bez pliku) karta ma stan „brak punktu odniesienia” i rozjazd nie jest zgłaszany.

## Bugi: `Projects/<projekt>/bugs.md`

Aplikacja **tylko czyta** ten plik (karta Projekty, paczka kontekstu); bugi dodaje i zamyka agent według przepisu poniżej (skill `bug-projektu`). Pole `Otwarto` daje w UI wiek buga i znaczek „stary” po 14 dniach.

```
## Aktywne

### GP-001 — Tytuł buga
- **Priorytet:** medium
- **Plik:** `ścieżka/do/pliku`
- **Otwarto:** 2026-11-10
- **Opis:** Co się dzieje. Kolejne linie wcięte o 2 spacje należą do tego samego pola.
- **Naprawa:** Plan naprawy (opcjonalnie).
- **Status:** otwarty

## Zamknięte

### EA-001 — Tytuł buga
- **Priorytet:** high
- **Opis:** …
- **Rozwiązanie (2026-05-19):** Co zrobiono.
- **Status:** zamknięty
```

Reguły formatu:

- Bug to `### <ID> — <tytuł>` (myślnik, półpauza lub pauza) pod `## Aktywne` albo `## Zamknięte` (albo przed pierwszym `##`). `###` pod inną sekcją (np. „Ostrzeżenia z builda”) nie jest bugiem.
- ID to `XX-NNN` (prefiks projektu z `NEXUS/CLAUDE.md` § Format ID bugów, numer o 1 większy od największego w pliku, w obu sekcjach).
- Pole to linia `- **Etykieta:** wartość`. Znane etykiety: `Priorytet`, `Plik`, `Otwarto`, `Opis`, `Naprawa`, `Rozwiązanie`, `Status`. Data w `Otwarto` i w nawiasie `Rozwiązanie (…)` musi mieć dokładnie postać `RRRR-MM-DD` (inna jest ignorowana). Wszystko poza nagłówkiem jest opcjonalne.
- Nie wpisuj przykładów `### …` w komentarzach HTML od początku linii: parser czyta linie.
- Gdy plik ma tylko zdanie „Brak znanych bugów.” (nowy projekt), zastąp je sekcjami `## Aktywne` i `## Zamknięte`.

**Dodaj bug** (polecenie „Dodaj buga do X”, ustalenie podczas pracy, wpis z Inboxu typu `bug`):

1. Wpis pod `## Aktywne` według formatu; `Otwarto: <dziś>` (dla wpisu z Inboxu: data wpisu), `Status: otwarty`.
2. Wiersz w tabeli „Bugi” w `Vault/dashboard.md` oraz ID w kolumnie „Bugi” tabeli „Projekty — przegląd”.
3. Zadanie w `Projects/<projekt>/tasks.md` pod `## Next`: `- [ ] **Tytuł** — krótki opis (patrz <ID>)`. ID musi być w treści (aplikacja po nim łączy bug z zadaniem). Dla `Priorytet: high` dopisz na końcu linii ` [now::]`, o ile w „Teraz” jest mniej niż 3 niezakończone zadania; inaczej bez znacznika.

**Zamknij bug** (polecenie „Zamknij buga X w projekcie Y”, naprawa w trakcie pracy):

1. Przenieś cały wpis pod `## Zamknięte`, ustaw `Status: zamknięty`, dodaj `- **Rozwiązanie (RRRR-MM-DD):** co zrobiono` (data = dziś).
2. Usuń lub przekreśl wiersz w tabeli „Bugi” w `Vault/dashboard.md` i zaktualizuj kolumnę „Bugi” w przeglądzie projektów.
3. Odhacz zadanie z tym ID w `tasks.md`: `- [x] … — RRRR-MM-DD` (data zakończenia na końcu linii). Gdy zadania nie ma, nic nie dodawaj.

Rozjazdy (zadanie zrobione, a bug nadal aktywny, albo bug zamknięty, a zadanie otwarte) aplikacja sygnalizuje przy wpisie w karcie Projekty; popraw wtedy brakującą stronę według powyższych kroków.
