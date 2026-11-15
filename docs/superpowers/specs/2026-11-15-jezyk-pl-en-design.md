# Język PL/EN w interfejsie

Data: 2026-11-15. Status: szkic do przeglądu. Wpis w `Vault/Projects/monolith/tasks.md` („Język PL/EN w całej aplikacji”, odłożony 2026-11-15, niski priorytet).

## 1. Cel i zakres

Użytkownik chce przełączać **interfejs** aplikacji między polskim a angielskim. Treści Vaulta (notatki, zadania, nazwy projektów, wpisy bugów, Inbox) **nie są tłumaczone**.

Stan dziś:

- Język to `useState<"en" | "pl">("pl")` w `src/App.tsx:27`; F5 wraca do PL, nie ma widocznego przycisku (jest tylko Ctrl+K → „Zmień język” i szufladka „Więcej” na mobile).
- Słownik `src/translations.ts` (507 linii, bloki `en` i `pl`) obsługuje tylko karty Planowania i jest wpięty propsami `t` i `lang` w ok. 30 plikach.
- Kokpit, Projekty, Mapa, Arsenał, Kodeks, Inbox, `CardRail` i `ShellStatusBar` mają polskie teksty wpisane na stałe (klucze `home*` w słowniku są martwe).
- `MobileNav` i `MobileMoreDrawer` mają własne wyrażenia `lang === "pl" ? labelPl : labelEn`.
- Ok. 16 miejsc formatuje daty z `pl-PL` na sztywno lub `toLocale…` bez locale.
- Rozpoznanie `agy` i `cursor` (2026-11-15, tylko odczyt): ok. 125 plików `src/` z polskimi znakami; przy EN UI pęknie ok. 25–30 plików testów warstwy feature i e2e.

Zadanie jest duże, więc ten spec opisuje **cały kierunek** (§2–§4) i **szczegółowo tylko etap 1** (§5). Każdy kolejny etap dostaje własny krótki wpis w specu lub planie, bo jego zakres to głównie lista tekstów do przeniesienia.

## 2. Decyzje (brainstorming 2026-11-15)

| ID  | Temat              | Decyzja                                                                                                                                                                                                                                            |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J1  | Zakres tłumaczenia | Tylko UI (etykiety, przyciski, puste stany, własne komunikaty klienta). Treści Vaulta, klucze YAML i nagłówki MD (`markdown.ts`, `context-pack.ts`) bez zmian (wybór użytkownika).                                                                 |
| J2  | Błędy z API        | Komunikaty serwera (zod, `DomainError`) zostają jak są, w jednym języku. Żadnych zmian w `contexts/bc_*`, `handleServiceError` ani API (wybór użytkownika).                                                                                        |
| J3  | Mechanizm          | Biblioteka: `i18next` + `react-i18next` (wybór użytkownika: podejście B). Odrzucone: własna cienka warstwa (rekomendowana, ale użytkownik wybrał bibliotekę), `next-intl` (związany z routingiem App Router; aplikacja jest SPA pod `/dashboard`). |
| J4  | Słowniki           | W TS, wbudowane w bundle; bez backendu HTTP i bez detektora języka. Jeden namespace na kartę. PL jest źródłem typów kluczy, EN musi mieć ten sam zestaw (test).                                                                                    |
| J5  | Zapis wyboru       | `localStorage["monolith.lang"]`, domyślnie `pl`; ustawia też `<html lang>`. To preferencja przeglądarki, nie dane projektu: nic nie trafia do Vaulta i nie dotyka `Work/`. Precedens: `DENSE_KEY` w `useResources.ts`, `boardViewport.ts`.         |
| J6  | Dostarczanie       | Etapami, po jednej karcie (osobny PR: spec/wpis → plan → wykonanie). Nie jeden duży PR.                                                                                                                                                            |
| J7  | Plural             | Przez wbudowany plural i18next (`one` / `few` / `many` / `other` dla PL, `one` / `other` dla EN). Dotyczy m.in. „zadań” w `CockpitSections.tsx:690`, `TasksSection.tsx:142`, `ProjectTasksBoard.tsx:368`, `CodexAlerts.tsx` (`plural`).            |
| J8  | Daty i liczby      | Jeden helper `src/i18n/format.ts` (`Intl` z locale wynikającym z aktualnego języka) zamiast `pl-PL` i `toLocale…` bez locale. Pozostałe miejsca migrują razem ze swoimi kartami.                                                                   |
| J9  | Testy              | `tests/setup.ts` inicjalizuje i18n w PL, więc istniejące testy z polskimi tekstami przechodzą bez zmian. Testy EN dodajemy tam, gdzie wnoszą wartość.                                                                                              |

## 3. Architektura

**Zależności:** `i18next` (27.x), `react-i18next` (18.x); zgodne z React 19 i Next 14 (peerDependencies sprawdzone przez `npm view`).

**`src/i18n/`:**

- `index.ts`: instancja i18next (`lng: "pl"`, `fallbackLng: "pl"`, zasoby z `locales/`), `setLanguage(lang)` (zapis do `localStorage`, `document.documentElement.lang`), odczyt zapisanego wyboru z walidacją (nieznana wartość lub wyjątek odczytu → `pl`).
- `I18nProvider.tsx`: provider kliencki w `app/layout.tsx`, obok `ThemeProvider`; wczytuje zapisany język po stronie klienta.
- `locales/pl/<ns>.ts`, `locales/en/<ns>.ts`: słowniki; `CustomTypeOptions` typuje klucze według PL.
- `format.ts`: `formatDate`, `formatTime` z locale z aktualnego języka.

**UI** importuje z `src/i18n/` (`useTranslation`, `format`); kontekstów `bc_*` ani API nie dotyka (reguła „UI importuje z kontekstu tylko `schemas`” bez zmian).

**Funkcje spoza Reacta** (np. `buildCardCommands`, `buildAppCommands` w `src/features/cards/`) dostają `t` jako argument albo wołają `i18n.t`; hook jest tylko w komponentach.

**Ryzyko do rozstrzygnięcia w planie etapu 1:** pierwszy render z SSR jest po polsku, więc użytkownik EN mógłby widzieć krótkie mignięcie PL po F5. Warianty: skrypt jak `ThemeScript` ustawiający język przed hydracją, albo bramka „render po odczycie języka”. Plan wybiera jeden i go testuje.

## 4. Etapy

1. **Fundament i powłoka** (§5).
2. Kokpit i Inbox (`src/features/home/`).
3. Projekty (tablica zadań, bugi, paczka kontekstu, teczka).
4. Planowanie: pełna migracja `translations.ts` do namespace `planning`/`common`, usunięcie propów `t` i `lang` (ok. 30 plików, ok. 12 testów), rozwiązanie miejsc z `toLocale…`.
5. Arsenał, Mapa, Kodeks, Notatki, Zasoby, Płótno.

Po etapie 4 plik `src/translations.ts` znika, a w repo nie zostaje drugi mechanizm tłumaczeń.

## 5. Etap 1: fundament i powłoka

**Zmiana względem wstępnego podziału:** słownik Planowania nie jest migrowany w etapie 1 (diff zbyt duży). Etap 1 zostawia **most**: `App.tsx` bierze język z i18next i dalej podaje `t = translations[lang]` oraz `lang` do `PlanowanieView`.

**Wchodzi:**

1. Zależności, `src/i18n/` (`index.ts`, `I18nProvider.tsx`, `format.ts`), namespace `common` i `shell`, setup w `tests/setup.ts` (i18n w PL), test zgodności kluczy PL/EN.
2. Powłoka przepisana na `useTranslation`: `CardRail` (aria-label „Karty” / „Cards”, tytuły, `⌘K`), etykiety kart z `cards.ts`, `appCommands.ts` i `CommandPalette` (w tym `buildCardCommands`, „Przejdź: …”), `ShellStatusBar`, `MobileNav`, `MobileMoreDrawer`, `FeedbackModal`. Znikają ternarne `labelPl/labelEn` i prop `lang` w tych komponentach.
3. Widoczny przycisk PL/EN w `CardRail`, tuż nad `⌘K`; przełączanie nadal działa też z Ctrl+K i szufladki „Więcej”.
4. Daty w powłoce przez `format.ts`.

**Etykiety kart po angielsku (nowe, dziś karty mają tylko PL):** Kokpit → Cockpit, Kalendarz → Calendar, Zadania → Tasks, Projekty → Projects, Notatki → Notes, Płótno → Canvas, Arsenał → Arsenal, Mapa → Map, Kodeks → Codex. Zakładki w `MobileNav` mają już `labelEn`; przenosimy je do słownika.

**Nie wchodzi:** karty (poza mostem Planowania), konteksty `bc_*`, API, `tests/unit/architecture.static.test.ts`. Pozostałe ok. 15 miejsc z `toLocale…` migruje razem z kartami.

**Przypadki testowe (oczekiwane wartości):**

- `setLanguage("en")` zapisuje `localStorage["monolith.lang"] === "en"` i ustawia `document.documentElement.lang === "en"`.
- Nieznana wartość w storage (np. `"de"`) albo wyjątek odczytu → język `pl`.
- Parytet kluczy: zestaw kluczy `en` równy zestawowi `pl` w każdym namespace.
- Plural PL: 1 → „1 zadanie”, 2 → „2 zadania”, 5 → „5 zadań”, 22 → „22 zadania”. Plural EN: 1 → „1 task”, 2 → „2 tasks”.
- `formatDate` dla 2026-11-16: PL „poniedziałek, 16 listopada”, EN „Monday, November 16”.
- `CardRail` w EN: `aria-label` „Cards”; w PL „Karty”. Etykiety kart jak w tabeli powyżej.
- Kliknięcie przycisku PL/EN zmienia teksty `CardRail`, `MobileNav` i `ShellStatusBar` bez przeładowania, a po ponownym zamontowaniu providera język jest zachowany.
- Istniejące testy `MobileNav`, `MobileMoreDrawer`, `appCommands` i `cardCommands` dostosowane do braku propa `lang`; reszta zestawu bez zmian (setup startuje w PL).

**Weryfikacja wykonawcy:** `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npm run build` oraz oględziny w przeglądarce na kopii vaulta (osobny port, nie 3100): przełączenie języka, F5, mobile.

## 6. Poza zakresem

- Tłumaczenie treści Vaulta, kluczy YAML, nagłówków MD (J1).
- Tłumaczenie komunikatów błędów API i kody błędów (J2).
- Więcej niż dwa języki; wykrywanie języka z przeglądarki.
- Zapis wyboru języka w Vaulcie.

## 7. Otwarte punkty

- Sposób uniknięcia mignięcia PL po F5 (§3), do rozstrzygnięcia w planie etapu 1.
- Szczegółowa lista tekstów `ShellStatusBar` i `FeedbackModal`: inwentaryzacja w planie etapu 1 (odczyt plików, bez budowania kodu).
