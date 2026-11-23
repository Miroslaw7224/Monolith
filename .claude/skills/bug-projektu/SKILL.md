---
name: bug-projektu
description: Dodawanie i zamykanie bugów projektu w vaulcie NEXUS (bugs.md, dashboard.md, zadanie z ID). Użyj przy poleceniu „dodaj buga do X”, „zamknij buga X w projekcie Y”, po naprawie buga w trakcie pracy oraz gdy segreguj-inbox odsyła tu wpis typu bug.
---

# Bug projektu (Monolith + NEXUS)

Aplikacja Monolith **tylko czyta** `bugs.md` (karta Projekty, paczka kontekstu). Bugi dodajesz i zamykasz Ty, według tego skilla. Format pliku i pełny przepis: `docs/nexus-vault-formaty-yaml.md`, sekcja „Bugi”. Czytaj ją, zamiast wnioskować format z kodu. Vault leży w `../NEXUS/Vault/` (katalog dodatkowy sesji).

## Reguły

- Projekty z `owner: "work"` pomijasz (dane z firmy): bug o takim projekcie nie trafia do vaulta, powiedz o tym użytkownikowi.
- Zapisujesz bezpośrednio tylko `Projects/<id>/bugs.md` i `dashboard.md`. **Nie ruszaj** `Projects/_registry.yaml` ani plików spoza projektu.
- `tasks.md`: w trybie „z Inboxu” zadanie tworzy wyłącznie `POST /api/inbox/<id>/move` (aplikacja); w pozostałych trybach edytujesz `tasks.md` bezpośrednio, według przepisu.
- Pole `Otwarto` i data w `Rozwiązanie (…)` mają postać `RRRR-MM-DD`; dziś = data systemowa (`date +%F`).
- Nie wpisuj w komentarzach HTML linii zaczynających się od `###`: parser czyta linie.

## Dodaj bug

1. Odczytaj `Projects/<id>/bugs.md`. Gdy ma tylko „Brak znanych bugów.”, zastąp to sekcjami `## Aktywne` i `## Zamknięte`.
2. Wyznacz ID: `XX-NNN`, prefiks z istniejących ID projektu albo z `NEXUS/CLAUDE.md` § Format ID bugów, numer o 1 większy od największego w obu sekcjach.
3. Dopisz wpis pod `## Aktywne`: tytuł (do 120 znaków), `Priorytet` (low/medium/high), `Plik` (jeśli znany), `Otwarto: <dziś>`, `Opis`, `Naprawa` (jeśli jest plan), `Status: otwarty`.
4. W `Vault/dashboard.md` dodaj wiersz w tabeli „Bugi” i ID w kolumnie „Bugi” tabeli „Projekty — przegląd”.
5. Zadanie z ID w treści (aplikacja po nim łączy bug z zadaniem):
   - **tryb „z Inboxu”** (wpis `bug` z `segreguj-inbox`, po zatwierdzeniu tabeli przez użytkownika): `Otwarto` = data wpisu `at`. Po kroku 4 wywołaj `move` (nagłówek `X-Nexus-Client: 1`, ciało przez heredoc `<<'JSON'`): `{"target":"project","projectId":"<id>","column":"next","text":"**<tytuł>** — <krótki opis> (patrz <ID>)"}` (limit 300 znaków, bez `[now::]`, do „Teraz” nigdy). To tworzy zadanie i zamyka wpis Inboxu. Błąd `move` po zapisie bugu: **nie dopisuj bugu drugi raz**; `409` ponów raz, inny kod zgłoś razem z ID już zapisanego bugu.
   - **inny tryb**: dopisz w `Projects/<id>/tasks.md` pod `## Next`: `- [ ] **Tytuł** — krótki opis (patrz <ID>)`. Dla `Priorytet: high` dodaj na końcu linii ` [now::]`, o ile w „Teraz” jest mniej niż 3 niezakończone zadania.

## Zamknij bug

1. Przenieś cały wpis pod `## Zamknięte`, ustaw `Status: zamknięty`, dodaj `- **Rozwiązanie (RRRR-MM-DD):** co zrobiono; PR #N (albo commit <hash>); dowód: <linia dowodu>` (data = dziś). Linię dowodu (np. `tsc, vitest (412 testów), lint: exit 0`) bierz z opisu PR lub commit message i przepisz bez zmian; sam „zamknięty” nie jest dowodem (Kodeks DOWODY-2). Gdy nie ma PR ani commitu albo czegoś nie dało się uruchomić, napisz „brak dowodu: <powód>” (DOWODY-3), niczego nie wymyślaj; nie zamykaj buga w ciemno, zapytaj użytkownika o PR lub commit.
2. W `dashboard.md` usuń lub przekreśl wiersz w tabeli „Bugi” i zaktualizuj kolumnę „Bugi” w przeglądzie projektów.
3. Odhacz zadanie z tym ID w `tasks.md`: `- [x] … — PR #N (albo commit <hash>); <linia dowodu> — RRRR-MM-DD` (te same PR/commit i linia dowodu co w `Rozwiązanie`, data na końcu). Gdy zadania nie ma, nic nie dodawaj.

## Na koniec

Powiedz użytkownikowi, co zapisałeś: ID buga, pliki, zadanie. Rozjazdy (zadanie zrobione, a bug aktywny, albo bug zamknięty, a zadanie otwarte) aplikacja pokazuje w karcie Projekty: popraw brakującą stronę według kroków wyżej.
