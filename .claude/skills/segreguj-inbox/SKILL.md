---
name: segreguj-inbox
description: Segregacja wpisów z Inboxu Kokpitu Monolith do zadań projektów, zadań ogólnych i notatek. Użyj, gdy użytkownik prosi o segregację inboxu (np. wieczorem, /segreguj-inbox).
---

# Segregacja inboxu (Monolith)

Wpisy leżą w `Inbox/inbox.md` vaulta. **Nie edytujesz vaulta ręcznie** i nie czytasz go z dysku: wszystko idzie przez API działającej aplikacji (`http://127.0.0.1:3100`). Aplikacja nie ma modelu AI; propozycje robisz Ty.

## Reguły

- Wołaj tylko `GET /api/inbox`, `GET /api/projects` i `POST /api/inbox/<id>/move`. **Każdy POST wymaga nagłówka `X-Nexus-Client: 1`**: strażnik aplikacji (`lib/http/localGuard.ts`) bez niego odpowiada 403 „Niedozwolone żądanie spoza aplikacji”.
- **Pomijaj projekty z `owner: "work"`**: nie proponuj ich i nie przenoś do nich wpisów (dane z firmy). Wpis, który pasuje tylko do takiego projektu, zostaje w inboxie, a użytkownik przenosi go sam w UI.
- Bez zatwierdzenia użytkownika nie wołaj `move`.
- Nie ruszaj `Projects/_registry.yaml`, `tasks.md` ani innych plików bezpośrednio.

## Kroki

1. Pobierz otwarte wpisy: `curl -sS http://127.0.0.1:3100/api/inbox`. Odpowiedź: `{ "items": [{ "id", "text", "type", "at" }], "open", "closed" }`.
   - curl kończy się błędem połączenia (aplikacja nie działa): napisz „Uruchom aplikację (`npm run dev`, port 3100) i wywołaj mnie ponownie” i **zakończ**.
   - odpowiedź ma pole `error` zamiast `items` (aplikacja działa, ale zwróciła błąd): pokaż komunikat i **zakończ**.
   - `open` = 0: napisz „Inbox jest pusty” i zakończ.
2. Pobierz projekty: `curl -s http://127.0.0.1:3100/api/projects` (pole `projects[]` z `id`, `name`, `owner`). Odrzuć `owner: "work"`.
3. Dla każdego wpisu zaproponuj cel:
   - **zadanie w projekcie** (`target: "project"`, `projectId`, `column`: `next` albo `icebox` = Backlog): konkretna, krótka rzecz do zrobienia w jednym z projektów. Tekst jedna linia, **do 300 znaków**, bez `[now::]`, bez końcowej daty `— RRRR-MM-DD`. Do „Teraz” nigdy nie przenosisz.
   - **zadanie ogólne** (`target: "task"`): rzecz do zrobienia bez projektu. Tekst jedna linia, **do 500 znaków**.
   - **notatka** (`target: "note"`, `title` do 120 znaków, `text` **do 500 znaków**): link, snippet, wiedza do zachowania.
   - **zostaw w inboxie**: gdy cel jest niejasny albo pasuje tylko projekt z firmy.

   Przy każdym celu popraw tekst, jeśli to ma sens (skrót, wielka litera), ale nie zmieniaj sensu. Wpis dłuższy niż limit celu skróć albo zostaw w inboxie.

   Pole `type` wpisu jest podpowiedzią, nie regułą: `link` i `snippet` to zwykle notatka, `bug` dotyczy konkretnego projektu (cel: zadanie w projekcie, ale zapis robi osobny skill `bug-projektu`, patrz krok 5a), a `myśl` oceń po treści.

4. Pokaż użytkownikowi **jedną tabelę** (wpis → cel, projekt/kolumna lub tytuł, tekst po poprawce). Zapytaj: „Zatwierdzasz całość, wybrane numery, czy poprawiasz?”. Czekaj na odpowiedź.
5. Dla zatwierdzonych wierszy, po jednym (`<id>` w URL to `id` wpisu z kroku 1, wstawiane bez zmian):

   ```bash
   curl -s -w '\n%{http_code}\n' -X POST "http://127.0.0.1:3100/api/inbox/<id>/move" \
     -H 'X-Nexus-Client: 1' \
     -H 'Content-Type: application/json' \
     --data-binary @- <<'JSON'
   {"target":"project","projectId":"<id projektu>","column":"next","text":"<tekst>"}
   JSON
   ```

   Warianty ciała: `{"target":"task","text":"…"}` oraz `{"target":"note","title":"…","text":"…"}`. Ciało zawsze podawaj przez heredoc `<<'JSON'` (nie przez `-d '…'`): apostrof albo `$` w tekście nie psują wtedy polecenia. W samym JSON escapuj `"` i `\`.

5a. Zatwierdzony wiersz typu `bug` (w tabeli z kroku 4 oznacz go „bug projektu”) **nie idzie przez `move` z kroku 5**: przekaż go skillowi `bug-projektu` (tryb „z Inboxu”: id wpisu, `projectId`, tytuł, opis, priorytet, data `at`). Ten skill zapisuje bug i sam wywołuje `move`; tu tylko dolicz jego wynik do podsumowania. Reguła „nie edytujesz vaulta ręcznie” dotyczy tego skilla bez wyjątków.

6. Obsługa odpowiedzi (ostatnia linia wyniku curla to kod HTTP). Najpierw sprawdź `warning`, bo taka odpowiedź też zawiera `ref`:
   - `200` z `warning` = cel zapisany, ale wpis pozostał otwarty. Zgłoś i **nie ponawiaj**, bo powstałby duplikat.
   - `200` bez `warning` = zrobione (`ref` to id projektu, zadania albo notatki).
   - `404` = wpis albo projekt nie istnieje: pomiń wiersz.
   - `409` = plik zadań zmienił się: ponów **raz**.
   - `400` = zły kształt albo reguły tekstu: zgłoś i pomiń wiersz. Komunikat to ogólne „Validation failed”, więc sprawdź kolumnę (`next`/`icebox`), długość (300 znaków w projekcie, 500 w zadaniu ogólnym i notatce, 120 w tytule notatki), brak `[now::]` i końcowej daty. „Invalid JSON” = źle escapowane ciało.
   - `403` = brak nagłówka `X-Nexus-Client: 1`.
   - każdy inny kod (np. `500`) = zgłoś z komunikatem, pomiń wiersz, nie ponawiaj.
7. Na koniec podsumuj: ile przeniesiono (`200` bez `warning`), które wpisy pozostały otwarte mimo zapisu (`warning`), co zawiodło (kod i komunikat), co zostało w inboxie.
