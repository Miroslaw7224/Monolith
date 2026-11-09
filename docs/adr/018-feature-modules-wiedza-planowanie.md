# ADR-018: Osobne moduły Wiedza i Planowanie (feature modules)

## Status

Częściowo unieważniony — moduł Wiedza został usunięty z aplikacji; Planowanie (kalendarz, zadania, tagi, notatki, zasoby, mapy myśli) pozostaje jako główny i jedyny moduł funkcjonalny obok Home. Dokument zachowany jako zapis historycznej decyzji o rozdzieleniu modułów.

## Kontekst

Obecnie jeden duży `App.tsx` (~1158 linii) łączy oba tryby aplikacji (Wiedza i Planowanie), sidebar zależny od trybu, header z przełącznikiem, auth, tłumaczenia, listę dokumentów w sidebarze (Wiedza), zakładki Planowanie (kalendarz / aktywność / zadania / tagi), chat, notatki, zasoby oraz pasek Plan AI. Trudniej to utrzymywać i testować — rozbudowa jednego trybu wymaga grzebania we wspólnym pliku.

Planowanie ma już wydzielone komponenty (CalendarView, ActivityLog, TasksSection, TagsSection) oraz `planService` po stronie backendu (`/api/plan/ask`). Wiedza pozostaje w dużej mierze w `App.tsx` (sidebar z dokumentami, chat, notatki, ResourceSection) bez wyraźnej granicy „moduł”. Brak spójnej architektury: jeden tryb jest już rozbity na komponenty i serwis, drugi — nie.

## Decyzja

Wprowadzamy **podział na moduły (features)** bez zmiany zachowania na start: nadal dwa przyciski w headerze (Wiedza / Planowanie), bez obowiązkowego React Router. **App.tsx** po refaktorze odpowiada tylko za: layout (header z przełącznikiem trybów, globalny sidebar), auth, stan `appMode` oraz render warunkowy:

- `appMode === 'wiedza'` → `<WiedzaView ... />`
- `appMode === 'planowanie'` → `<PlanowanieView ... />`

Dane współdzielone (user, apiFetch, lang, t, tagi) przekazujemy propsami lub kontekstem.

**Mapowanie na foldery:**

| Moduł      | Lokalizacja                | Zawartość                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wiedza     | `src/features/wiedza/`     | `WiedzaView.tsx` — cały content trybu Wiedza (sidebar: chat / notatki / zasoby / **mapy myśli**; main: `ChatPanel`, `NotesPanel`, `ResourceSection`, **`MindMapsTab`** z `src/features/mind-maps/`). Stan zakładek i danych: `useWiedzaData`, `WiedzaSidebarContent`.                                                                                                                                                                                       |
| Planowanie | `src/features/planowanie/` | `PlanowanieView.tsx` — content trybu Planowanie (sidebar z zakładkami, CalendarView / ActivityLog / TasksSection / TagsSection, pasek Plan AI). `components/` — opcjonalnie CalendarView, ActivityLog, TasksSection, TagsSection (albo pozostają w `src/components`, jeśli używane wyłącznie tutaj). Stan: planningTab, planAskInput, **messages** (historia konwersacji Plan AI — patrz niżej), planAskLoading w PlanowanieView lub hooku `usePlanowanie`. |

Backend bez zmian: Next.js Route Handlers w `app/api/` + services (ragService, planService itd.) zgodnie z ADR-014.

**Pamięć konwersacji Plan AI (frontend-only)**

Chat Plan AI (pasek pod kalendarzem/aktywnością) potrzebował kontekstu — bez niego każde wywołanie `/api/plan/ask` dostawało tylko bieżącą wiadomość i użytkownik tracił wątek (np. „dodaj to do kalendarza” bez odniesienia do wcześniejszej rozmowy). **Decyzja:** pamięć tylko w stanie React, bez zapisu do Firestore. W PlanowanieView tablica `messages` (pary user/assistant); przy wysłaniu wiadomości przekazujemy do API `history` (ostatnie 9 par, 18 elementów), po odpowiedzi dopisujemy wiadomość asystenta i przycinamy do 20 elementów (10 par). API odczytuje `history` z body i przekazuje do `planService.ask()`; serwis wplata `historyContext` (format „User: …” / „Assistant: …”) do promptu przed „User message: …”. Historia żyje do odświeżenia strony; limit 10 par ogranicza tokeny. Persystencja w Firestore odrzucona na MVP — użytkownik zwykle prowadzi jedno „posiedzenie planowania” na sesję.

**Edytor notatek (TipTap)**

Notatki w trybie Wiedza korzystają z komponentu **NoteEditor** (`src/components/NoteEditor.tsx`) opartego o **TipTap** (v3). Używane rozszerzenia: StarterKit, Underline, TextAlign, TextStyle, Color, FontFamily oraz własna rozszerzenie FontSize. Treść zapisywana jest w formacie TipTap (HTML/JSON) przez istniejące API notatek; persystencja w Firestore bez zmian. Decyzja o TipTap dotyczy wyłącznie warstwy UI w module Wiedza (zgodnie z ADR-014).

**Zalety podziału:**

- Mniejszy App.tsx; czytelność i utrzymanie — „wiedza = ten folder”, „planowanie = ten folder”; nowe funkcje w danym trybie dodaje się w jednym miejscu.
- Lepsze testy: moduły Wiedza i Planowanie można testować osobno, z mniejszym kontekstem i mockami.
- Możliwość lazy loadingu przy ewentualnym routingu (`/wiedza`, `/planowanie`) — React.lazy + Suspense, mniejszy pierwszy load.
- Spójna architektura: oba tryby w jednym wzorcu (moduł = folder z komponentami + stanem + ewentualnie serwisem po stronie klienta).

**Kiedy można zostać przy jednym pliku:**

- Aplikacja ma zostać mała i bez większych rozszerzeń.
- Zespół jest bardzo mały i nikt nie narzeka na rozmiar App.tsx.
- Nie planuje się osobnych ścieżek URL ani deep linków do Wiedzy/Planowania.

**Opcja na przyszłość:** React Router z trasami `/wiedza`, `/planowanie` oraz `Navigate` przy wyborze trybu — wtedy naturalnie wejście lazy loading dla każdego modułu (React.lazy + Suspense). Decyzja o wprowadzeniu routingu pozostaje oddzielna; na start wystarczy przełącznik `appMode` i dwa widoki.

## Rozważane alternatywy

- **Zostawienie jednego App.tsx** — szybsze na teraz, ale przy planowanej rozbudowie i już dużym pliku utrudnia utrzymanie i testy; odrzucone.
- **Pełny React Router od razu** — możliwe, ale nie wymagane na start; wystarczy przełącznik `appMode` i dwa widoki; routing i lazy loading można dodać później.

## Konsekwencje

**Pozytywne:**

- Wyraźne granice między trybami — łatwiejsze rozwijanie i onboardowanie (lub Cursor).
- Testowanie modułów osobno, z mniejszym kontekstem.
- Możliwość lazy loadingu po ewentualnym wprowadzeniu routingu.
- Jednolity wzorzec: każdy tryb = jeden folder z widokiem, komponentami i stanem.

**Negatywne:**

- Więcej plików; jednorazowy refaktor App.tsx (wyciągnięcie treści do WiedzaView i PlanowanieView).
- Trzeba przekazywać dane współdzielone (user, apiFetch, lang, t, tagi) — propsami lub kontekstem.

## Stan aplikacji (luty 2026, zaktualizowany marzec 2026 po ADR-019)

Refaktor wdrożony. Po refaktoryzacji dużych plików (ADR-019) struktura frontendu wygląda następująco:

- **App.tsx** — tylko layout: auth (loading, ekran logowania, handlery), stan `appMode`, `isSidebarOpen`, `lang`, `user`, `apiFetch`, `handleLogout` oraz warunkowy render `appMode === 'wiedza' ? <WiedzaView ... /> : <PlanowanieView ... />`.
- **src/lib/cn.ts** — wspólna utilita `cn` (clsx + tailwind-merge), używana w AppHeader, WiedzaView, PlanowanieView i komponentach feature’ów.
- **src/features/wiedza/** — `WiedzaView.tsx` (cienki kontener: useWiedzaData, stan zakładek), `useWiedzaData.ts`, `WiedzaSidebarContent.tsx` (zakładki: chat, notatki, zasoby, **mapy myśli**), `ChatPanel.tsx`, `NotesPanel.tsx`, `index.ts`. Main content: ChatPanel / ResourceSection / NotesPanel / **`MindMapsTab`** w zależności od zakładki.
- **src/features/mind-maps/** — `MindMapsTab.tsx`, `MindMapTree.tsx`, typy i eksport HTML (`mindMapExportHtml.ts`, `mindMapTypes.ts`, `mindMapUtils.ts`); integracja z API `/api/mind-maps` (CRUD, `ai-node`, **`import`**).
- **src/features/planowanie/** — `PlanowanieView.tsx` (sidebar + main content + pasek Plan AI), `PlanowanieSidebarContent.tsx` (zakładki Kalendarz/Aktywność/Zadania/Tagi), `index.ts` (re-eksport). Main: CalendarView, ActivityLog, TasksSection, TagsSection.
- **src/components/layout/** — `AppSidebar.tsx`, `AppHeader.tsx` (używają `cn` z `@/src/lib/cn`).

Komponenty współdzielone:

- **src/components/ResourceSection.tsx** — cienki wrapper: wywołuje `useResources` z `./resources/useResources`, renderuje layout z komponentami z `./resources/` (ResourceFilterSidebar, ResourceAddForm, ResourceFavoritesBar, ResourceListItem, ResourceEditModal). Typy i parsowanie w `src/components/resources/resourceTypes.ts`, `resourceParsing.ts`; testy w `tests/unit/components/resources/resourceParsing.test.ts`.
- **src/components/calendar/** — `calendarUtils.ts` (CalendarEvent, getDaysInMonth, assignLanes, getOverlapCounts, MONTH_NAMES, DAY_NAMES), `CalendarDayColumn.tsx` (kolumna dnia z inline paskami eventów).
- **src/components/CalendarView.tsx** — używa calendarUtils i CalendarDayColumn.
- **src/components/** — ActivityLog, **TasksSection** (+ **`TaskDetailModal`** — otwarcie zadania, edycja m.in. pola notatki zapisywanego jako `description` w API; **niebieski wskaźnik** na liście przy niepustym `description`), TagsSection, NoteEditor, CalendarEventForm, StartSessionModal, calendarConstants itd. — bez zmian w lokalizacji (poza ew. nowymi plikami przy rozbudowie).

Backend i API bez zmian.

### ResourceSection – zasoby, ulubione i wyszukiwarka

- **UI i UX** (`src/components/ResourceSection.tsx` + `src/components/resources/`; po ADR-019):
  - Zakładka **Zasoby** ma wspólny header z tytułem i wyszukiwarką po **tytule/opisie/URL**. Lewa kolumna: ResourceFilterSidebar („Filtruj po tagach”), ResourceAddForm (formularz linku + „Lub wklej w formacie blokowym”). Prawa: ResourceFavoritesBar (kafelki ulubionych), lista ResourceListItem, ResourceEditModal. Stan z hooka **useResources** (bez Providera), przekazywany przez props; typy w `resourceTypes.ts`, parsowanie w `resourceParsing.ts` (testy w `tests/unit/components/resources/resourceParsing.test.ts`).
  - Każdy element listy: **Ulubione | Open link | Copy URL | Delete**; klik w treść otwiera modal pełnej edycji.

- **Model i API**:
  - `NoteResource` / `NoteResourceRecord` rozszerzone o pole `isFavorite?: boolean`, przechowywane w kolekcji `users/{userId}/resources` w Firestore.
  - `GET /api/resources` zwraca pełny rekord zasobu łącznie z `isFavorite`.
  - `PUT /api/resources/[resourceId]` przyjmuje częściowy payload (`title`, `description`, `url`, `tags`, `isFavorite`) i aktualizuje zasób przez `resourceService.updateResource()` / `updateResourceInFirestore()`.
  - UI sortuje zasoby tak, aby ulubione (`isFavorite === true`) były **na górze listy**, przy zachowaniu dotychczasowej kolejności w ramach grupy.

- **Edycja zasobu**:
  - Zrezygnowaliśmy z inline edycji tytułu i tagów; zamiast tego cała edycja odbywa się w **modalu** (`editingResource`, `editForm` w `ResourceSection`), co upraszcza interakcję i umożliwia modyfikację wszystkich pól jednocześnie.
