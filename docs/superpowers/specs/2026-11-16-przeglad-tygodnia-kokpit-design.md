# Kokpit: przegląd tygodnia (zestawienie i prompt dla agenta, focus na tydzień)

Data: 2026-11-16. Status: do akceptacji. Realizuje część §6.2 specu asystenta (`2026-11-11-asystent-lokalny-nexus-design.md`): „Przegląd tygodnia: AI zestawia sesje, commity i zamknięte zadania, użytkownik wybiera focus”. Druga część §6.2 (action items po spotkaniu) jest poza tym specem, zob. §7.

## 1. Cel

Raz w tygodniu użytkownik chce zobaczyć, co zrobił w ostatnich 7 dniach, i wybrać focus na kolejny. Aplikacja nie ma żadnego modelu AI (Gemini wycięty, lokalna Ollama odpada). Zestawia więc dane sama, składa z nich gotowy prompt i oddaje go do schowka, a streszcza agent w terminalu (Claude Code, `agy`). Wynik agenta nie wraca do aplikacji. Użytkownik zapisuje w aplikacji tylko własny focus: jedno zdanie na tydzień.

## 2. Decyzje

| ID  | Temat                | Decyzja                                                                                                                                                                                                               |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Rola AI              | Bez modelu w aplikacji: aplikacja zbiera dane i składa prompt do skopiowania (wybór użytkownika, 2026-11-16). Zero kluczy API i zero wysyłki z aplikacji; spójne z paczką kontekstu i Arsenałem.                      |
| D2  | Cel przeglądu        | Retrospektywa i focus dla użytkownika, nie raport dla innych (wybór użytkownika). Wariant „raport na daily/tygodniowy” z §8 specu asystenta zostaje w backlogu.                                                       |
| D3  | Focus                | Jedno zdanie na tydzień w nowym `Cockpit/weeks.yaml` plus istniejące „Zmień aktywne” (`pinned.yaml`, maks. 3). Tematy mają dalej jedno źródło, `weeks.yaml` ich nie dubluje (wybór użytkownika).                      |
| D4  | Miejsce i widoczność | Panel w Kokpicie, domyślnie zwinięty, bez przypomnień i znaczników „brak focusu” (wybór użytkownika). Zapisany focus widać u góry Kokpitu do końca tygodnia.                                                          |
| D5  | Okno                 | Ostatnie 7 dni łącznie z dziś. Focus jest przypisany do tygodnia ISO bieżącego dnia (`week_start` = poniedziałek).                                                                                                    |
| D6  | Prywatność `work`    | Dla projektów `owner: work` do promptu i do panelu idą tylko nazwa i liczby (commity, PR-y). Bez tematów commitów, bez treści zadań i bez treści zamknięć dnia. Ostrzeżenie „dane z firmy” jak przy paczce kontekstu. |
| D7  | Język promptu        | Zawsze po polsku (treści Vaulta i commity są po polsku; wybór agenta nie zależy od języka interfejsu). Etykiety panelu przez `i18next` w PL i EN.                                                                     |

## 3. Zawartość zestawienia

Źródła (wszystko tylko do odczytu poza `weeks.yaml`):

1. **Commity i PR-y per projekt** (git): liczby z istniejącego `listGitHistory`, tematy commitów z nowej funkcji (zob. §4). Maks. 15 tematów na projekt, reszta jako „… i N więcej”.
2. **Zamknięte zadania** w `tasks.md` projektów (`status: done`), których tekst zawiera datę `RRRR-MM-DD` z okna (liczy się ostatnia data w tekście). Daty nie ma w polu, tylko w tekście wpisu, więc w prompcie lista jest opisana jako „przybliżenie”. Zadania ogólne (`Tasks/tasks.md`) są poza zakresem.
3. **Zamknięcia dnia** (`Cockpit/closing.yaml`) z okna: data, zdanie, projekt.
4. **Review z GitHuba**: zatwierdzone, komentarze i liczba PR-ów z istniejącego `getReviewHistory(7)`. Brak `gh` to `available: false`, bez błędu.
5. **Spotkania** z kalendarza (`type: meeting`): sama liczba i łączny czas. Bez tytułów, bo wydarzenia nie mają `owner` i tytuł mógłby zawierać dane firmy.

Brak dostępu do gita to sekcja pominięta, a w prompcie jedno zdanie „dane z gita niedostępne”.

## 4. Zmiany w kodzie (ADR-021)

**`lib/git/project-git.ts`:** `commitSubjects(repoDir, from, to)`: `{ ok: true; subjects: string[] } | { ok: false }`. Ten sam wzorzec co `commitsByDay` (walidacja `RRRR-MM-DD`, `--branches --no-merges`, dedupe po hashu, czas lokalny), format `%H %s`. Git z białej listy, bez nowych poleceń.

**Kontekst `bc_projects` (`services/`):**

- `listGitSubjects(from, to): { projectId; name; owner; subjects: string[] }[]`, wołane tylko przez `bc_cockpit/services`.
- `listDoneTasksInWindow(from, to): { projectId; name; owner; tasks: string[] }[]`: zadania `done` z datą w oknie (reguła z §3 pkt 2).

**Kontekst `bc_calendar` (`services`):** istniejące `getCalendarEvents` wystarcza (okno dat, filtr `type === "meeting"` po stronie `bc_cockpit/services`).

**Kontekst `bc_cockpit`:**

- `models.ts`: `WeekFocus = { weekStart: string; text: string }`; `WeekReviewProject = { projectId; name; work: boolean; commits; prs; subjects: string[]; doneTasks: string[] }` (dla `work` tablice puste); `WeekReview = { from; to; weekStart; git: { available; total; prs }; projects: WeekReviewProject[]; closings: { date; text: string | null; projectId: string | null }[]; reviews: { available; approved; comments; prs }; meetings: { count; minutes }; containsWork: boolean; prompt: string }` (`text: null` dla zamknięć projektu `work`). `Cockpit` dostaje pole `weekFocus: WeekFocus | null` dla bieżącego tygodnia.
- `repositories.ts`: `readWeekFocuses(): WeekFocus[]`, `upsertWeekFocus(focus): Promise<void>` na `Cockpit/weeks.yaml` (`version: 1`, `weeks: [{ week_start, text }]`; zapis przez `yaml-store`, jeden rekord na `week_start`).
- `services.ts`: `weekStart(date: string): string` (poniedziałek tygodnia ISO), `getWeekReview(today = new Date())` (zbiera dane z §3, maskuje `work`, składa `prompt`), `setWeekFocus(text, today = new Date())` (przycinanie, walidacja: niepusty, maks. `MAX_FOCUS_TEXT` = 300 jak `MAX_CLOSING_TEXT`, inaczej `DomainError`), rozszerzenie `getCockpit` o `weekFocus`. Składanie promptu to osobna, czysta funkcja `composeWeekPrompt(review)` w `services.ts` (do wydzielenia do folderu `services/`, gdyby plik urósł ponad rozsądek).
- `schemas.ts`: `WeekFocusInputSchema` (`{ text: string }`), `WeekReviewDto`, `WeekFocusDto`, mapery.
- `router.ts`: `getWeekReview(request)` (bez parametrów), `putWeekFocus(request)`; błędy przez `handleServiceError`. Awaria gita lub `gh` to 200 z `available: false`.
- `app/api/cockpit/week-review/route.ts` (`GET`, `dynamic = "force-dynamic"`) i `app/api/cockpit/week-focus/route.ts` (`PUT`): tylko re-eksport handlerów.

Architektura: `bc_cockpit/services` woła tylko `services` innych kontekstów (`bc_projects`, `bc_calendar`); `fs` i `child_process` tylko w `lib/`. Test `architecture.static.test.ts` nie wymaga zmian (gdyby wymagał, osobny commit przed kodem).

## 5. UI

**`src/features/home/WeekReview.tsx` (nowy):** panel `kok-panel` w lewej kolumnie Kokpitu pod historią commitów, domyślnie zwinięty (nagłówek „Przegląd tygodnia” i chip z liczbą commitów). Po rozwinięciu pobiera `GET /api/cockpit/week-review` i pokazuje: wiersze projektów (nazwa, commity, PR-y, zamknięte zadania; projekty `work` ze znacznikiem „Dane z firmy” i samymi liczbami), zamknięcia dnia, review, spotkania. Niżej:

- przycisk **„Kopiuj prompt dla agenta”** (kopiuje `prompt`; przy `containsWork` pod przyciskiem ostrzeżenie „dane z firmy: sprawdź, gdzie wklejasz”, kopiowanie nie jest blokowane);
- pole **„Focus na ten tydzień”** (jedno zdanie, licznik znaków) i **„Zapisz”**; po zapisie przycisk otwiera istniejące okno „Zmień aktywne”.

Props: `{ apiFetch, day, focus, onFocusSaved }`; `focus` przychodzi z `Cockpit.weekFocus`. Po zapisie Kokpit odświeża się tym samym mechanizmem co po zamknięciu dnia. Zapisany focus wyświetla się u góry Kokpitu jedną linią („Focus tygodnia: …”) i znika od poniedziałku następnego tygodnia (brak rekordu dla bieżącego `week_start`).

**i18n:** `src/i18n/locales/{pl,en}/home.ts`, sekcja `weekReview` (`title`, `chip`, `copyPrompt`, `copied`, `workWarning`, `focusLabel`, `focusSave`, `focusLine`, etykiety sekcji i stany puste); test parytetu kluczy PL/EN już istnieje.

## 6. Prompt (kształt)

```
# Przegląd tygodnia 2026-11-10 – 2026-11-16

Zrób retrospektywę: co zostało domknięte, co wisi bez ruchu, na czym straciłem czas.
Zaproponuj 1–3 tematy focusu na tydzień od 2026-11-16 (jedno zdanie każdy).
Dane poniżej pochodzą z mojego vaulta i gita; zadania z datą w tekście to przybliżenie.

## Commity i PR-y
- Monolith: 42 commity, 6 PR
  - feat(tags): …
  - … i 27 więcej
- Projekt etatowy (dane z firmy): 12 commitów, 1 PR

## Zamknięte zadania (przybliżenie)
## Zamknięcia dnia
## Review
## Spotkania
```

Sekcje bez danych są pomijane. Przy `containsWork` na końcu dopisuje się linię „Uwaga: projekty etatowe tylko jako liczby”.

## 7. Poza zakresem

- **Action items po spotkaniu** (`CalendarEvent` ma dziś tylko `brief`): osobny wpis w backlogu i osobny cykl.
- Zapis wyniku agenta (streszczenia) w vaulcie; wywołanie jakiegokolwiek modelu z aplikacji.
- Przypomnienia o przeglądzie, znacznik „brak focusu”, rozwijanie panelu w poniedziałek (D4).
- Zadania ogólne (`Tasks/tasks.md`) i tytuły spotkań w zestawieniu.
- Wariant „raport na daily/tygodniowy” dla innych odbiorców.

## 8. Testy (Vitest, `tests/unit/...`)

Konkretne przypadki z oczekiwanymi wartościami:

- `weekStart`: `2026-11-16` (poniedziałek) → `2026-11-16`; `2026-11-22` (niedziela) → `2026-11-16`; `2026-11-23` → `2026-11-23`; `2027-01-01` (piątek) → `2026-12-28`.
- Okno: dla `today = 2026-11-16` `from = 2026-11-10`, `to = 2026-11-16`.
- `listDoneTasksInWindow`: wpis `… — 2026-11-10` wchodzi; `… — 2026-11-09` nie; wpis bez daty nie; wpis z dwiema datami (`2026-11-03` … `2026-11-12`) liczy się po ostatniej (`2026-11-12`, wchodzi); zadanie niezamknięte z datą w oknie nie.
- Maskowanie: projekt `owner: work` z 10 commitami i 2 zadaniami daje `commits: 10`, `subjects: []`, `doneTasks: []`, `work: true`; jego zamknięcie dnia ma `text: null`; `containsWork: true`; prompt zawiera linię z liczbami, a nie zawiera żadnego tematu commitu ani treści zadania tego projektu.
- Prompt: 20 tematów commitów → 15 wypisanych i „… i 5 więcej”; sekcje bez danych pominięte; brak gita → zdanie „dane z gita niedostępne”, bez sekcji commitów.
- Spotkania: 3 wydarzenia `meeting` po 60 min i 1 `work` → `count: 3`, `minutes: 180`.
- `setWeekFocus`: pusty tekst lub same spacje → `DomainError`; 301 znaków → `DomainError`; 300 znaków przechodzi; drugi zapis w tym samym tygodniu zastępuje pierwszy (jeden rekord); zapis w innym tygodniu dopisuje drugi rekord.
- `getCockpit`: `weekFocus` to rekord bieżącego `week_start` albo `null` (focus z poprzedniego tygodnia nie jest pokazywany).
- Router: `PUT /api/cockpit/week-focus` z pustym ciałem → 400; `GET /api/cockpit/week-review` przy braku gita i `gh` → 200 z `available: false`.
- UI (`WeekReview.test.tsx`): zwinięty panel nie pobiera danych; rozwinięcie pobiera raz; ostrzeżenie widać tylko przy `containsWork`; „Kopiuj prompt” kopiuje `prompt` do schowka; zapis focusu wysyła `PUT` i woła `onFocusSaved`.
- i18n: parytet kluczy PL/EN (istniejący test), `weekReview` w obu językach.

## 9. Ryzyka i odłożone

- **Daty zadań w tekście** są konwencją, nie polem: zadanie bez daty w tekście nie trafi do zestawienia. Świadomie przyjęte (przybliżenie opisane w prompcie); jeśli zacznie przeszkadzać, osobna zmiana formatu zadań.
- **Tematy commitów** to treść repozytoriów `personal`; trafiają do schowka użytkownika, nie wychodzą z aplikacji.
- **Jeden zapis na tydzień**: brak historii zmian focusu; poprzednie tygodnie zostają w `weeks.yaml` bez widoku (do ewentualnej retrospektywy później).
