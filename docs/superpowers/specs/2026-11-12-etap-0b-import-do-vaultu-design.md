# Etap 0b: import zrzutu Firestore do vaulta — projekt

Data: 2026-11-12
Status: zaimplementowane na gałęzi `feat/etap-0b-import-do-vaultu`, testy zielone, jeszcze nieuruchomione na prawdziwym zrzucie (robi to użytkownik).
Nadrzędne specy: `2026-11-12-etap-0-odpiecie-firebase-design.md` (§1.1 zakres danych, §5 krok 0b), `2026-11-11-asystent-lokalny-nexus-design.md` (§4.2 zasady zapisu)

Ten dokument jest publiczny (repo na GitHubie). Nie zawiera danych użytkownika ani identyfikatorów projektu Firebase, i tak ma zostać. Dotyczy to też testów: korzystają wyłącznie z danych syntetycznych.

## 1. Cel i zakres

Zamienić zrzut zawężony z kroku 0a (`notes`, `tasks`, `resources`, `user_tags`, `task_templates` jednego konta) na pliki vaulta w `Vault/`. Krok nie zmienia aplikacji ani Firestore. Skrypt jest jednorazowy (może dwa uruchomienia), ale kod formatów w `lib/nexus/` zostaje i będzie używany przez warstwę plikową w 0c.

Poza zakresem (YAGNI): wczytywanie do Firestore z powrotem, tryb inkrementalny, GUI.

## 2. Mapowanie i formaty

Mapowanie kolekcji na pliki jest w §5 nadrzędnego specu etapu 0:

- `notes` → `Notes/<slug>.md` (frontmatter `id`, `title`, `created`, `tags`; treść HTML → Markdown),
- `tasks` → plik zadań, status 4-stanowy polem inline `[status:: …]` (miejsce docelowe: O1 w nadrzędnym specu),
- `resources` → `Resources/resources.yaml`, `user_tags` → `Resources/tags.yaml`, `task_templates` → `Tasks/templates.yaml`.

Formaty przyjęte w implementacji (kod wspólny w `lib/nexus/`):

| Co                             | Format                                                                                                                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linia zadania                  | `- [ ] Tytuł [id:: …] [status:: in_progress] [due:: …] [priority:: …] [order:: …] [link:: …] [desc:: …] [created:: …] [updated:: …]`. Kratka `[x]` tylko dla `done`; źródłem prawdy jest pole `status`. Pola puste (`null`, `""`) są pomijane. Jedna linia = jedno zadanie |
| Ucieczka w liniach zadań       | `\\`, `\[`, `\]`, `\n`, `\r` w tytule i wartościach pól. `::` w wartości nie wymaga ucieczki                                                                                                                                                                               |
| Zadania                        | `Tasks/tasks.md`: frontmatter `generated_by: import-to-vault`, nagłówek `# Zadania`, potem linie zadań. Kolejność: `order` (brak na końcu), `created`, `id`                                                                                                                |
| Zasoby, tagi, szablony         | `Resources/resources.yaml` (klucz `resources`), `Resources/tags.yaml` (`tags`), `Tasks/templates.yaml` (`templates`); każdy plik: `version: 1`, `generated_by: import-to-vault`, lista map. Klucze rekordów w snake_case                                                   |
| Notatki                        | `Notes/<slug>.md`, frontmatter w kolejności `id`, `title`, `created`, `updated`, `tags` (`tags: []` gdy brak), potem treść Markdown. Oryginał HTML: `Notes/.html/<id>.html`                                                                                                |
| Czas                           | jedno pole `created`/`updated` jako tekst ISO. Źródło: `created_at` (tekst), a gdy brak, `createdAt` (Timestamp z zrzutu)                                                                                                                                                  |
| Własność plików „pojedynczych” | plik jest „nasz”, gdy ma `generated_by: import-to-vault`. Istniejący plik bez znacznika dostaje obok wersję z sufiksem (`tasks-2.md`) i ostrzeżenie. Skutek uboczny: po przepisaniu pliku przez aplikację (0c) ponowny import nie nadpisze go, tylko zapisze obok          |
| Nieznany status zadania        | zamieniany na `todo` z ostrzeżeniem w raporcie (zadanie nie ginie); round-trip porównuje ze statusem po normalizacji                                                                                                                                                       |

Pliki tworzone przez ten krok kończą się znakiem nowej linii, używają `\n` i nie zawierają znaczników czasu importu (inaczej drugi przebieg zmieniałby pliki).

Dwie decyzje zaobserwowane w implementacji:

- **Rekordy YAML** (zasoby, tagi, szablony) pomijają tylko pola `undefined`; puste `""`, `[]` i `false` zostają w pliku. Pomijanie pustych pól dotyczy wyłącznie linii zadań.
- **Wybór konta.** Bez `--uid` używane jest konto z manifestu (a gdy manifest go nie ma i zrzut zawiera jedno konto, to ono). Gdy manifest nie wskazuje konta, a zrzut zawiera obsługiwane kolekcje więcej niż jednego konta, `--uid` jest wymagane (inaczej kod 2). Zrzut zawężony zgodnie z §1.1 nadrzędnego specu ma jedno konto, więc `--uid` zwykle nie jest potrzebne.

## 3. Bezpieczeństwo zapisu

- **Dry-run domyślnie.** Bez `--write` skrypt nie dotyka vaultu, tylko drukuje, co by zapisał.
- **Zapis tylko w `Vault/`.** Ścieżka każdego pliku jest sprawdzana, czy leży w katalogu vaultu (zasada z nadrzędnego specu, §4.2). Zapis atomowy: plik tymczasowy i `rename`.
- **Idempotencja po `id`.** Ponowne uruchomienie aktualizuje te same pliki, nie dubluje ich. Zadania i zasoby to pojedyncze pliki przepisywane w całości; notatki są rozpoznawane po `id` we frontmatterze.
- **Ochrona przed nadpisaniem.** Plik o tej samej nazwie, ale z innym `id` (czyli coś napisanego ręcznie), nie jest ruszany, tylko dostaje sufiks, a w raporcie pojawia się ostrzeżenie.
- **Bez commitów.** Skrypt niczego nie commituje. Vault jest w prywatnym repo i o tym, co do niego wchodzi, decyduje użytkownik.

## 4. Bramka po zapisie (round-trip)

Skrypt czyta zapisane pliki z powrotem i porównuje je ze zrzutem:

- liczba rekordów per typ,
- zestaw `id`,
- pola kluczowe: tytuł, status, `order`, `url`.

Kod wyjścia ≠ 0, gdy jakiś rekord nie został ani zapisany, ani świadomie pominięty (z powodem).

## 5. Raport

- **Na ekran:** same liczby (zrzut / zapisane / pominięte per typ) oraz lista notatek ze stratami konwersji, bez treści.
- **Szczegółowy:** do katalogu zrzutu (uprawnienia 0700), nie do repo.
- **Straty konwersji per notatka**, np. „kolor czcionki, wyrównanie, krój czcionki, podkreślenie”. Oryginał HTML każdej notatki jest zapisywany w vaulcie jako `Notes/.html/<id>.html` (katalog ukryty dla Obsidiana) i porównywany z zrzutem w round-trip, więc nic nie ginie.

## 6. Podział kodu

Małe jednostki, testowalne bez zrzutu.

| Plik                                                       | Odpowiedzialność                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `scripts/import-to-vault.ts`                               | tylko CLI i kody wyjścia                                                                    |
| `scripts/import-to-vault/read-dump.ts`                     | wczytanie zrzutu i weryfikacja SHA-256                                                      |
| `scripts/import-to-vault/notes.ts`                         | HTML → Markdown przez `turndown`, raport strat                                              |
| `scripts/import-to-vault/slug.ts`                          | nazwy plików z tytułów                                                                      |
| `scripts/import-to-vault/write.ts`                         | atomowy zapis i ochrona ścieżki                                                             |
| `scripts/import-to-vault/verify.ts`                        | round-trip (§4)                                                                             |
| `scripts/import-to-vault/report.ts`                        | raport ekranowy i szczegółowy (§5)                                                          |
| `lib/nexus/task-line.ts`                                   | serializer i parser linii zadania, jedna para funkcji                                       |
| `lib/nexus/yaml-lists.ts`                                  | odczyt i zapis list YAML (zasoby, tagi, szablony)                                           |
| `lib/nexus/frontmatter.ts`                                 | odczyt i zapis frontmattera notatek (wspólny z 0c, używany też przez indeks `id`)           |
| `scripts/import-to-vault/{types,args,records,plan,run}.ts` | typy i kody wyjścia, argumenty CLI, normalizacja rekordów zrzutu, plan zapisu, orkiestracja |

`task-line.ts` i `yaml-lists.ts` leżą w `lib/nexus/`, bo ten sam format będzie czytać warstwa plikowa z 0c. Dzięki temu round-trip testuje dokładnie ten kod, który potem działa w aplikacji.

## 7. Zależności

- **HTML → Markdown:** nowy pakiet `turndown` (wraz z typami).
- **YAML:** `yaml` i `js-yaml` są w `node_modules` tylko jako zależności pośrednie, nie są zapisane w `package.json`. Przed implementacją wybieramy jedną z nich i dodajemy jako zależność bezpośrednią; drugiej nie dokładamy. Rozstrzygnięcie w planie (kryterium: zachowanie kolejności kluczy i cytowania polskich znaków oraz `:` w wartościach).
- **Property test:** wymaga biblioteki property-based (np. `fast-check`), której w projekcie nie ma; do dodania jako zależność deweloperska.

## 8. Testy

- **Jednostkowe** na danych syntetycznych (prawdziwych nie wolno wkładać do repo). Przypadki: polskie znaki, duplikaty tytułów, pusty tytuł, `]` i `::` w polach, opis wielowierszowy, HTML ze stylami, listami i nagłówkami.
- **Property test:** `parse(format(x)) == x` dla linii zadania.
- **Integracyjny:** pełny przebieg na zrzucie syntetycznym do tymczasowego vaultu; drugi przebieg nie zmienia plików; zapis poza vaultem jest odrzucony.
- **Statyczny:** skrypt nie zawiera ścieżek do `~/backups` ani innych zaszytych ścieżek i nie czyta niczego poza katalogiem zrzutu (`--dump`) i vaultem (`--vault`, tylko odczyt indeksu `id` potrzebnego do idempotencji).

## 9. Polecenia

```
npx tsx scripts/import-to-vault.ts --dump <katalog zrzutu>                                    # dry-run (domyślnie)
npx tsx scripts/import-to-vault.ts --dump <katalog zrzutu> [--vault <katalog Vault>] [--uid <uid>] [--write]
```

`--dump` jest wymagane. `--vault` domyślnie z `NEXUS_VAULT_PATH` (zgodnie z nadrzędnym specem); brak obu to błąd użycia. `--uid` wskazuje konto, gdy zrzut zawiera kilka (patrz §2). Bez `--write` jest dry-run.

## 10. Kody wyjścia

| Kod | Znaczenie                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------- |
| 0   | sukces (dry-run: raport bez błędów; zapis: round-trip zgodny)                                            |
| 1   | błędne użycie: argumenty, brak lub niepoprawny katalog vaulta                                            |
| 2   | błąd zrzutu: manifest, status ≠ ok, SHA lub liczba linii, struktura, wybór konta                         |
| 3   | ścieżka poza vaultem                                                                                     |
| 4   | bilans rekordów lub round-trip niezgodny (jakiś rekord nie został ani zapisany, ani świadomie pominięty) |

Raport szczegółowy (`import-report-<RRRR-MM-DDTGGMMSS>.json`, uprawnienia 0600) trafia do katalogu zrzutu także w dry-run i przy kodzie 4.

## 11. Ryzyka

- **Strata formatowania HTML → Markdown.** Ograniczenie: raport strat per notatka, oryginał HTML w zrzucie.
- **Nadpisanie ręcznej pracy w vaulcie.** Ograniczenie: ochrona po `id` z sufiksem i ostrzeżeniem (§3).
- **Zapis poza vaultem.** Ograniczenie: sprawdzenie ścieżki każdego pliku, test integracyjny odrzucenia.
- **Dane osobiste w repo.** Ograniczenie: testy tylko na danych syntetycznych, raport szczegółowy w katalogu zrzutu (0700), na ekranie bez treści.
- **Rozjazd formatu z warstwą plikową 0c.** Ograniczenie: wspólny kod w `lib/nexus/`.

## 12. Kryteria ukończenia

- Dry-run na zrzucie zawężonym kończy się bez błędów i pokazuje oczekiwane liczby.
- Zapis do vaulta przechodzi round-trip; drugi przebieg nie zmienia żadnego pliku.
- Raport nie zawiera rekordów nieuwzględnionych; straty konwersji zaakceptowane przez użytkownika.
- Testy z §8 przechodzą.
- Nic nie zostało scommitowane w vaulcie przez skrypt.
