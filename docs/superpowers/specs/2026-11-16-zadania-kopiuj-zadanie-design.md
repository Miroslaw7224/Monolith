# Zadania: kopiowanie zadania z dopiskiem

Data: 2026-11-16. Status: zatwierdzony ustnie przez użytkownika. Rozwija `2026-11-16-zadania-checklista-panel-design.md`.

## 1. Cel

Zadanie testowe („Testy Manualne CG”) trzeba przejść osobno na iPhonie i iPadzie. Zamiast przepisywać checklistę, użytkownik kopiuje zadanie z dopiskiem (np. „iPhone”) i dostaje świeżą checklistę do odhaczania.

## 2. Zachowanie

- W panelu i modalu zadania (`TaskDetailContent`) jest przycisk **„Kopiuj zadanie”**. Klik rozwija wiersz: pole „Dopisek (np. iPhone)”, „Utwórz kopię”, „Anuluj”. Pusty dopisek (po przycięciu) blokuje „Utwórz kopię”; Enter w polu to samo co przycisk.
- Kopia: tytuł `Tytuł (dopisek)`, status `todo` (domyślny dla nowych zadań), na początku listy jak każde nowe zadanie. Oryginał i otwarty panel zostają bez zmian; po sukcesie wiersz znika, a pod nim widać „Utworzono kopię: Tytuł (dopisek)”.
- Kopiowane pola: `link`, `project`, `due_date`, `priority`, opis. Tag energii `#deep`/`#quick` jest częścią tytułu i przechodzi razem z nim.
- Opis kopii: checklista z wyzerowanymi punktami (wszystkie `[ ]`), komentarze `>` usunięte, reszta tekstu bajt w bajt. Opis bez punktów kopiuje się bez zmian.
- Kopia bierze **bieżące wartości pól tekstowych z panelu** (tytuł, link, opis), także jeszcze niezapisane przez autozapis. Pusty tytuł w polu: kopia używa ostatniego zapisanego tytułu zadania.
- Błąd POST: komunikat w wierszu, pole z dopiskiem zostaje wypełnione, można ponowić.
- Oryginał przemianowuje użytkownik ręcznie; zmiana jego tytułu nie jest częścią funkcji.

## 3. Zmiany w kodzie

Bez zmian: `contexts/bc_tasks/*`, `lib/nexus/*`, `app/api/**`, `tests/unit/architecture.static.test.ts`. Zapis idzie istniejącym `POST /api/tasks` (`CreateTaskBodySchema` przyjmuje `title`, `link`, `description`, `status`, `due_date`, `priority`, `project`) do `Vault/Tasks/tasks.md`.

- `taskChecklist.ts`: `resetChecklist(desc: string): string`: parsuje, ustawia każdy punkt na `todo`, czyści `commentRaw`, serializuje.
- `useTasksBoard.ts`: `duplicateTask(sourceId, suffix, current: { title; link; description }): Promise<Task>`. Pola `due_date`, `project`, `priority` bierze z zadania w stanie; wysyła POST, normalizuje pola jak `addTask` i dokłada zadanie na początek `tasks`. Błąd (`res.ok === false` albo wyjątek) leci do wywołującego.
- `TaskDetailContent.tsx`: prop `onDuplicate: (suffix: string, current: { title; link; description }) => Promise<Task>`; wiersz kopiowania ze stanem (`closed | open | busy`), błędem i komunikatem sukcesu.
- `TaskWorkPanel.tsx`, `TaskDetailModal.tsx`: przekazują `onDuplicate`; `TasksSection.tsx` podpina `duplicateTask`.
- `tasks.css`, `src/i18n/locales/{pl,en}/tasks.ts`: wiersz kopiowania i teksty.

## 4. Testy (Vitest, `tests/unit/features/tasks/`)

- `taskChecklist.test.ts`: `resetChecklist("W\n- [x] A\n  > ok\n- [!] B")` → `"W\n- [ ] A\n- [ ] B"`; opis bez punktów i pusty bez zmian; zagnieżdżone punkty zachowują wcięcia.
- `TaskDetailModal.test.tsx`: dopisek „iPhone” + „Utwórz kopię” wywołuje `onDuplicate("iPhone", { title, link, description })` z bieżącymi wartościami pól; pusty dopisek blokuje przycisk; po sukcesie widać „Utworzono kopię”; po błędzie komunikat błędu i wypełnione pole.
- `TasksSection.panel.test.tsx` (lub osobny plik): POST `/api/tasks` ma `title: "Alpha (iPhone)"`, bez `status`, opis z wyzerowanymi punktami, `priority`, `project` i `due_date` skopiowane; nowa karta pojawia się w „Do zrobienia”.

## 5. Ryzyka

- Dwa zadania o prawie tym samym tytule: dopisek je rozróżnia, ale oryginał trzeba przemianować samemu (świadoma decyzja).
- `desc` kopii przechodzi przez ten sam zapis z ucieczkami co każde zadanie, więc długa checklista jest bezpieczna (limitu długości nie ma).

## 6. Poza zakresem

Podział na wiele kopii naraz; kopiowanie z karty na tablicy; automatyczna zmiana tytułu oryginału; szablony checklist.
