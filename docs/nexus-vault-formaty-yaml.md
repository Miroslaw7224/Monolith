# Format plików w vaulcie (tagi, szablony, zasoby, zadania, kalendarz, notatki, dokumenty, mapy myśli, tablica)

Aplikacja czyta i zapisuje pliki w `NEXUS/Vault/` (ścieżka z `NEXUS_VAULT_PATH`). Kod: `lib/nexus/yaml-store.ts`, `lib/nexus/repos/`.

| Plik                       | Klucz listy | Pola rekordu (kolejność)                                                                                      |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `Resources/tags.yaml`      | `tags`      | `id`, `tag`, `title`, `color` (opcjonalne), `created`                                                         |
| `Tasks/templates.yaml`     | `templates` | `id`, `label`, `title`, `link`, `created`                                                                     |
| `Resources/resources.yaml` | `resources` | `id`, `title`, `url`, `description`, `tags`, `favorite`, `thumbnail_url`\*, `note_id`\*, `created`, `updated` |

\* opcjonalne: klucz jest pomijany, gdy brak wartości (nigdy `null`).

Struktura pliku: `version: 1`, lista rekordów pod kluczem. Czas to tekst ISO 8601 (UTC). `id`: 20 znaków alfanumerycznych.

## Zasady zapisu

- Aplikacja zapisuje atomowo i tylko wtedy, gdy plik nie zmienił się od odczytu (inaczej ponawia; po wyczerpaniu ponowień błąd 409).
- Nieznane klucze w rekordach i kolejność rekordów przeżywają zapis. **Komentarze YAML giną**, podobnie jak ewentualne klucze najwyższego poziomu pliku inne niż `version` i lista.
- Po pierwszym zapisie aplikacji znika `generated_by`, więc ponowny import 0b zapisze pliki obok zamiast je nadpisać.
- Plik, który się nie parsuje, nie jest nadpisywany; operacja kończy się błędem z nazwą pliku.
- Odczyt jest posortowany niezależnie od kolejności w pliku: tagi i szablony rosnąco po `created`, zasoby malejąco po `created`; remisy po `id`.
- `userId` nie jest zapisywany (jednoużytkownikowy vault do etapu 0d).
- Ręcznie wpisane `favorite: yes` jest czytane jako tekst (YAML 1.2), czyli nie jako „ulubiony”. Używaj `true`/`false`.

## Zadania: `Tasks/tasks.md`

Frontmatter (po pierwszym zapisie aplikacji bez `generated_by`), nagłówek `# Zadania`, potem jedna linia na zadanie:

`- [ ] Tytuł [id:: …] [status:: todo] [due:: RRRR-MM-DD] [priority:: n] [order:: n] [link:: …] [desc:: …] [created:: ISO] [updated:: ISO]`

- Pola `due`, `priority`, `link`, `desc` są pomijane, gdy puste. `status`: `todo`, `in_progress`, `to_review`, `done`; pole wyboru `[x]` oznacza `done`.
- W tytule i wartościach pól ucieczki: `\[`, `\]`, `\\`, `\n`. Parser: `lib/nexus/task-line.ts`, edycja: `lib/nexus/markdown-edit.ts`.
- Aplikacja zmienia **tylko** linię zadania, którego dotyczy żądanie; reszta pliku (nagłówki, notatki, inne linie) zostaje bajtowo. Dodane zadanie trafia na koniec pliku.
- Linie bez `id` lub z uszkodzonymi polami nie pojawiają się w aplikacji i nie są zmieniane. Przy duplikacie `id` obowiązuje pierwsza linia.
- Edytowana linia jest formatowana od nowa: **nieznane pola inline w tej linii giną** (np. `[project:: x]`). Dodatkowe informacje wpisuj w `desc`.
- Przeciąganie zadań (`reorder`) zmienia tylko `order` i tylko w liniach, w których wartość się zmienia; edycja zmienia `updated`.

## Kalendarz: `Calendar/RRRR-MM.yaml`

Jeden plik na miesiąc **daty początku** wydarzenia. Klucz listy `events`, pola rekordu: `id`, `date` (`RRRR-MM-DD`), `start_minutes`, `duration_minutes` (wielokrotność 15), `title`, `tags` (lista), `color`, `type` (`work` lub `meeting`), `created`, `updated` (opcjonalne, ustawiane przy edycji).

- Wydarzenie przechodzące przez północ lub granicę miesiąca jest jednym rekordem w pliku miesiąca początku. Aplikacja czyta wszystkie pliki miesięcy; pliki o innych nazwach są ignorowane.
- Zmiana `date` na inny miesiąc przenosi rekord do pliku tego miesiąca.
- Zasady zapisu jak w pozostałych plikach YAML (nieznane klucze rekordu przeżywają, komentarze giną, uszkodzony plik nie jest nadpisywany).
- Terminy zadań (`due`) nie są zapisywane w kalendarzu: aplikacja dolicza je w locie.

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

## Dokumenty: `Documents/<slug>.md`

Frontmatter (`id`, `name`, `type`, `created`), potem treść wgranego pliku jako tekst. Slug z `name` (`raport.txt` → `raport-txt.md`), reguły kolizji jak w notatkach. Dokumentów się nie edytuje, tylko dodaje i usuwa. Białe znaki na początku i końcu treści są obcinane.

## Mapy myśli: `MindMaps/<id>.json`

Jeden plik na mapę; `id` (20 znaków alfanumerycznych) to nazwa pliku. JSON z wcięciem 2 spacje i końcowym `\n`:

```
{ "title": "…", "rootNode": { "id": "root", "label": "…", "note": "<p>…</p>", "collapsed": false, "children": [] },
  "colWidths": { "0": 200 }, "createdAt": "ISO", "updatedAt": "ISO" }
```

- `userId` nie jest zapisywany. Notatki węzłów (`note`) zostają w HTML (inny edytor niż notatki).
- Uszkodzony plik JSON jest pomijany na liście map, a przy otwarciu tej mapy aplikacja zgłasza błąd z nazwą pliku.
- `id` z adresu spoza `[A-Za-z0-9_-]{1,64}` jest traktowany jak nieistniejący.

## Tablica: `Board/board.json`

Jeden plik: `{ "tiles": […], "frames": […], "edges": […], "updatedAt": "ISO" }`. Brak pliku to pusta tablica. Zapis zawsze nadpisuje plik (ostatni zapis wygrywa).
