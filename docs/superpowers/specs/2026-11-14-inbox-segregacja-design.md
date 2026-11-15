# Inbox: segregacja wpisów do projektu, zadań i notatek

Data: 2026-11-14. Rozwija spec asystenta (`2026-11-11-asystent-lokalny-nexus-design.md`, §6.2 „Szybki inbox: segregacja wieczorem do projektu lub kursu”) i uzupełnia etap 2-2 Kokpitu (`bc_inbox`, K3). Kanał agenta wynika ze specu `2026-11-12-agent-przez-cli-bez-api-design.md` (G3, G4).

## 1. Cel i zakres

Wpis z `Vault/Inbox/inbox.md` da się dziś tylko oznaczyć jako „Gotowe” (`[x]`) albo usunąć. Ten etap dodaje trzecią akcję: **przeniesienie wpisu** do zadania projektu, zadania ogólnego albo notatki. Robi to użytkownik w oknie wpisu albo agent CLI (np. Claude Code na subskrypcji) przez to samo API aplikacji.

**Poza zakresem:** cel „kurs” (Arsenał etapy 3–4 jeszcze nie istnieją), cel „bug w `bugs.md`” (rozstrzygnięte 2026-11-15: bez zapisu z aplikacji, zob. spec bugów B1; bug z Inboxu zapisuje agent przez skill `bug-projektu`, a okno „Przenieś do…” tylko o tym przypomina), pole propozycji w `inbox.md`, zlecenia z przycisku w UI, kolejka `Vault/Agent/queue/` i serwer MCP (G1), jakiekolwiek wywołanie modelu przez aplikację (G3, pilnuje tego `tests/unit/no-model-api.static.test.ts`).

## 2. Decyzje

| #   | Decyzja                   | Wybór                                                                                                                                                                                                                                                                                              |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Cele w pierwszej wersji   | Zadanie projektu, zadanie ogólne, notatka: trzy cele, które mają już zapis (`bc_projects.applyTaskOp`, `bc_tasks.createTask`, `bc_notes.createNote`). Wybór użytkownika, 2026-11-14.                                                                                                               |
| D2  | Miejsce w UI              | Akcja „Przenieś do…” w `InboxItemDialog`. Tryb wieczornej kolejki w aplikacji odłożony. Wybór użytkownika.                                                                                                                                                                                         |
| D3  | AI                        | Bez klucza API i bez wywołań modeli w aplikacji. Segregację proponuje agent CLI w terminalu przez skillę `/segreguj-inbox`; użytkownik zatwierdza w terminalu; agent woła API działającej aplikacji. Odrzucone: propozycje zapisane w `inbox.md` (rozszerzenie formatu i UI) oraz czekanie na MCP. |
| D4  | Jeden mechanizm           | UI i agent używają tej samej trasy `move`. Reguły (limity, wersja `tasks.md`, kolejność zapisów) są po stronie serwera, więc agent nie edytuje plików vaulta ręcznie i nie obchodzi ich.                                                                                                           |
| D5  | Kolumny projektu          | Tylko `next` i `icebox` („Backlog”), domyślnie `next`. Nigdy `now`: `[now::]` zasila kolejkę Kokpitu, a ustawienie go ma być świadomą decyzją, nie skutkiem segregacji (i omija limit `NOW_LIMIT` bez potrzeby).                                                                                   |
| D6  | Kolejność i awarie zapisu | Najpierw zapis w celu, potem `resolve` wpisu (`[x]`). Awaria zapisu w celu zostawia wpis otwarty i nietknięty. Awaria `resolve` po udanym zapisie: odpowiedź z `warning`, wpis zostaje otwarty (lepszy duplikat niż zgubiony wpis).                                                                |
| D7  | Prywatność `owner: work`  | W UI wolno przenieść wpis do projektu `owner: work`; okno pokazuje znacznik „Dane z firmy” (jak karta projektu i Kokpit). API nie rozróżnia wołającego, więc ograniczenie dla agenta jest regułą skilli: nie proponuje i nie przenosi wpisów do projektów `owner: work` (G4).                      |
| D8  | Domyślny cel z typu wpisu | Tylko podpowiedź w UI, regułowa, bez AI: `link` i `snippet` → notatka; `bug` i `myśl` → zadanie projektu. Użytkownik zmienia wybór. API typu nie interpretuje.                                                                                                                                     |

## 3. Zmiany w kodzie (ADR-021)

**`contexts/bc_inbox/`** (bez nowych plików):

- `schemas.ts`: `MoveInboxItemSchema` (zod, `z.discriminatedUnion("target", …)`):
  - `{ target: "project", projectId: string, column: "next" | "icebox", text }`;
  - `{ target: "task", text }`;
  - `{ target: "note", title, text }`.
    `text`: po `trim` 1–500 znaków (limit jak `CreateInboxItemSchema`; zgodność z `MAX_INBOX_TEXT` pilnuje test, jak dotąd), nowe linie zamieniane na spację, jak w `addItem`. `title`: po `trim` 1–120 znaków. Dla `target: "project"` dodatkowo reguły zadania w `tasks.md` (kopia `taskText` z `bc_projects/schemas`, bo `schemas` nie importuje innego kontekstu, a `applyTaskOp` wywołany z serwisu niczego nie waliduje): maks. 300 znaków, bez `[now::]`, bez końcowej daty ukończenia `— RRRR-MM-DD`. Kolumna `now` i każda inna wartość odrzucane. DTO: `MoveResultDto = { ok: true; target; ref: string; warning?: string }`.
- `services.ts`: `moveItem(id, input)`:
  1. sprawdza, że otwarty wpis `id` istnieje (inaczej `NotFoundError`, bez zapisu w celu);
  2. zapis w celu przez `services` innego kontekstu:
     - `project`: `bc_projects.getProject(projectId).board.version`, potem `applyTaskOp(projectId, { op: "add", column, text }, version)`; `ref` = `projectId`;
     - `task`: `bc_tasks.createTask({ title: text })`; `ref` = id zadania;
     - `note`: `bc_notes.createNote({ title, content: text })`; `ref` = id notatki;
  3. `resolve(id)`; wyjątek tutaj jest łapany i zamieniany na `warning` w wyniku (D6).
     `bc_inbox/services` woła tylko `services` innych kontekstów (reguła ADR-021); `repositories` i `lib/nexus` w `bc_inbox` się nie zmieniają.
- `router.ts`: `moveItem(request, ctx)` przez `parseBody`, `services.moveItem`, `handleServiceError`.
- `app/api/inbox/[id]/move/route.ts`: tylko re-eksport (`POST`).
- Test architektury nie jest zmieniany. Gdyby pękł, naprawiamy kodem.

**Błędy:** wpis nieznany lub już posegregowany → 404; nieznany `projectId` → 404; zły kształt, pusty tekst, 501 znaków, `column: "now"` → 400; zmiana `tasks.md` między odczytem wersji a zapisem → 409 (`ConflictError` z `applyTaskOp`); błąd zapisu w celu → odpowiedni kod z `handleServiceError`, wpis bez zmian.

**UI `src/features/home/`:** `InboxItemDialog.tsx` dostaje przycisk „Przenieś do…”, który otwiera formularz celu (osobny komponent `InboxMoveForm.tsx`):

- wybór celu (projekt / zadanie ogólne / notatka) z domyślnym wg typu wpisu (D8);
- dla projektu: lista z istniejącego `GET /api/projects` (znacznik „Dane z firmy” przy `owner: work`) i kolumna `next` / `icebox`;
- dla notatki: pole tytułu (domyślnie pierwsze zdanie wpisu, do 120 znaków);
- pole tekstu wypełnione treścią wpisu, edytowalne;
- po sukcesie okno się zamyka, lista i kafel inboxu odświeżają się; `409` pokazuje komunikat „Plik zadań zmienił się, spróbuj ponownie”; `warning` jest wyświetlany.

UI importuje z `bc_inbox` tylko `schemas`.

**Skilla agenta `.claude/skills/segreguj-inbox/SKILL.md`** (opis po polsku; wywołanie `/segreguj-inbox`):

1. Sprawdza, czy aplikacja odpowiada (`GET /api/inbox`); gdy nie, prosi o jej uruchomienie i kończy; niczego nie edytuje w vaulcie ręcznie.
2. Czyta `GET /api/inbox` i `GET /api/projects`, pomija projekty `owner: work` (D7).
3. Pokazuje tabelę propozycji: wpis → cel (projekt / zadanie ogólne / notatka), kolumna lub tytuł, poprawiony tekst. Wpisy bez dobrego celu zostawia w inboxie.
4. Czeka na zatwierdzenie użytkownika w terminalu (całość, wybrane wiersze albo z poprawkami).
5. Dla zatwierdzonych woła `POST /api/inbox/<id>/move` (z nagłówkiem `X-Nexus-Client: 1`, bo strażnik `lib/http/localGuard.ts` odrzuca zapisy spoza przeglądarki bez niego) po jednym, na końcu raportuje: co przeniesiono (`ref`), co zawiodło (kod błędu), co zostało.
   Skilla nie zapisuje niczego poza wywołaniami `move`.

## 4. Testy (TDD, czerwony przed zielonym)

- `tests/unit/contexts/bc_inbox/services.test.ts` (wirtualny vault z fixtur; nigdy prawdziwy rejestr):
  - `project`, `next`: wiersz dopisany do sekcji Next w `tasks.md` projektu, wpis `[x]` w `inbox.md`, `ref` = id projektu;
  - `project`, `icebox`: wiersz w sekcji Backlog;
  - `task`: zadanie ogólne powstaje z tytułem = tekst, wpis `[x]`;
  - `note`: notatka z tytułem i treścią, wpis `[x]`;
  - nieznany `projectId` → 404, wpis nadal otwarty;
  - wpis nieznany albo już `[x]` → 404, bez zapisu w celu;
  - `tasks.md` zmieniony między odczytem wersji a zapisem (wstrzyknięty konflikt) → 409, wpis otwarty;
  - `resolve` rzuca po udanym zapisie → wynik z `warning`, wpis otwarty, zadanie istnieje;
  - nowe linie w tekście → spacja; tekst 501 znaków → 400.
- `schemas.test.ts`: odrzucenie `column: "now"`, `column: "backlog"`, pustego tekstu, 501 znaków, braku `title` dla notatki, braku `projectId` dla projektu; poprawne kształty trzech wariantów; zgodność limitu 500 z `MAX_INBOX_TEXT`.
- `router.test.ts`: 200 (trzy cele), 400, 404, 409; zapisy przechodzą przez `services`.
- UI `tests/unit/features/home/` (rozszerzenie testów okna wpisu): domyślny cel wg typu (`link` → notatka, `bug` → zadanie projektu); wysłanie `move` z poprawnym ciałem; odświeżenie listy po sukcesie; komunikat przy 409; znacznik „Dane z firmy” przy projekcie `owner: work`; formularz bez projektów (pusty rejestr) blokuje cel „projekt”.
- Skilli nie testuję automatycznie. Po wdrożeniu: ręczne przejście `/segreguj-inbox` na kopii vaulta ze scratchpada (kopia NEXUS, bez dotykania prawdziwych `Inbox/inbox.md` i `Projects/_registry.yaml`); okno „Przenieś do…” w przeglądarce (Playwright) na tej samej kopii. Jeśli niesprawdzone, napisać to w opisie PR.

## 5. Po wykonaniu

W `../NEXUS/Vault/Projects/monolith/tasks.md` dopisać wpis „Inbox: segregacja” (PR #NN, data) i przenieść do Backlogu: cel „bug” (z widokiem Bugów per projekt), cel „kurs” (po Arsenale etap 3–4), tryb wieczornej kolejki w UI, zlecenia z przycisku (po kolejce i MCP, G1). Commit tylko `tasks.md`, za zgodą użytkownika.
