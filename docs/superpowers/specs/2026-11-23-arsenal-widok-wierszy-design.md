# Arsenał: widok wierszy zamiast kafelków (zakładka Skille i prompty)

Data: 2026-11-23
Status: projekt zatwierdzony w rozmowie (makieta C, filtry i kafelki statystyk bez zmian)
Nadrzędny spec: `2026-11-14-karta-arsenal-design.md` (§3.3 Widok)

Dokument jest publiczny (repo na GitHubie). Nie zawiera danych z etatu ani identyfikatorów kont.

## 1. Cel

Lista wpisów zakładki „Skille i prompty” to dziś siatka kafelków (4 w rzędzie na szerokim ekranie) z wąskim panelem
podglądu (380 px). Zamiast tego: lista wierszy na szerokość 3 kafelków i podgląd (np. `brainstorming`) na szerokość
2 kafelków. Wiersz w stylu karty Kodeks: nagłówek ze znaczkiem rodzaju, opis, stopka.

## 2. Zakres

Tylko UI: `src/features/arsenal/`. Bez zmian w `contexts/bc_arsenal/`, API i vaulcie. Pasek filtrów
(`ArsenalFilterBar`), kafelki statystyk (`asv-tiles`) i treść panelu `ArsenalDetail` bez zmian (zmienia się tylko jego
szerokość).

## 3. Projekt

- **Układ** (`arsenal.css`): `.asv-layout` ma kolumny `minmax(0, 3fr) minmax(0, 2fr)` (było
  `minmax(0, 1fr) 380px`). Panel nadal przylega do góry (sticky) i przewija się wewnętrznie. Poniżej 1100 px jedna
  kolumna, jak dotąd.
- **Lista** (`arsenal.css`): `.asv-grid` jest jedną kolumną wierszy (`grid-template-columns: 1fr`), nie siatką
  `auto-fill`. Zostają: pasek koloru rodzaju z góry wiersza, hover i podświetlenie wybranego.
- **Wiersz** (`ArsenalSkillsView.tsx`, `EntryCard`): nagłówek (nazwa, znaczek rodzaju), opis, stopka. Chipy projektów
  przechodzą z przycisku wyboru do stopki: chipy po lewej, stan (`wdrożony w N` / model promptu) i „Kopiuj” po prawej.
  Przycisk wyboru obejmuje nagłówek i opis, więc jego nazwa dostępna to nazwa, znaczek i opis (bez chipów).
- **Stan wyboru, kopiowanie i klawiatura** bez zmian: `data-kind`, `data-selected`, `aria-pressed`, przyciski „Kopiuj
  wywołanie” / „Kopiuj prompt”.

## 4. Testy

Istniejące testy (`tests/unit/features/arsenal/ArsenalSkillsView*.test.tsx`) odwołują się do ról i nazw, nie do klas,
i mają przejść bez zmian. Nowy test: chipy projektów leżą w stopce wiersza (poza przyciskiem wyboru), a przycisk wyboru
ich nie zawiera. Test jest czerwony przed zmianą znaczników (TDD-1).

## 5. Weryfikacja widoku (DOWODY-6)

Po implementacji: aplikacja uruchomiona na kopii vaulta (osobny port), zrzuty przeglądarką sterowaną skryptem:
szerokość 1887 px (jak na zrzucie z rozmowy), szerokość poniżej 1100 px (jedna kolumna), pusty wynik filtrów.
Nazwane granice dowodu (DOWODY-3): wersja mobilna poza zakresem, jeśli zrzut jej nie obejmie.

## 6. Poza zakresem

Zmiana makiety `docs/mockups/karty/cards/07-arsenal.html`, pozostałe zakładki Arsenału (Zasoby, Kursy, Agenci),
nowe filtry, zmiana treści panelu.
