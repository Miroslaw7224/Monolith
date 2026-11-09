# Tablica: płótno i lista

**Data:** 2026-11-08  
**Status:** Zatwierdzony

## Cel

Nowa zakładka z płótnem w stylu tablicy TesterAI: kafelki, ramki i strzałki, plus lista tych samych kart. Karty należą do tej aplikacji i są zapisane w Firestore. Jedna tablica na użytkownika.

## Poza zakresem

- Pokrycie testów, owner, luki, funkcje, dziennik, wyniki przebiegów.
- Szkice, konflikty zapisu, synchronizacja z repozytorium git.
- Tablica startowa budowana z rejestru modułów.
- Rodzaj i etykieta strzałki, przełącznik koloru kafelka.
- Osobna karta na stronie głównej i licznik tablic.
- Test przeglądarkowy, który przeciąga kafelki po płótnie.

## Miejsce w aplikacji

Nowa wartość `board` w `PlanningTab`. Etykiety: „Tablica” i „Board”, w `translations.ts`.

Pozycja w menu:

- Pasek boczny planowania (widoczny też z poziomu strony głównej), obok map myśli. Wybór przełącza aplikację w tryb planowania i otwiera zakładkę.
- Szuflada „Więcej” na wąskim ekranie, obok map myśli. Dolny pasek zostaje bez nowej ikony.

Widok zajmuje ten sam obszar treści co mapy myśli: kolumna nad paskiem czatu, płótno wypełnia pozostałą wysokość.

## Dane

Dokument `users/{uid}/board/main`.

```typescript
interface BoardTile {
  id: string;
  title: string;
  note: string;
  x: number;
  y: number;
  w: number;
  h: number;
  frame: string | null;
}

interface BoardFrame {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BoardEdge {
  id: string;
  source: string;
  target: string;
}

interface Board {
  tiles: BoardTile[];
  frames: BoardFrame[];
  edges: BoardEdge[];
  updatedAt?: Timestamp;
}
```

Identyfikatory generuje klient. W jednym dokumencie są unikalne. Pusta tablica to trzy puste listy. Brak dokumentu przy odczycie oznacza pustą tablicę i nie tworzy dokumentu.

Kolejność `frames` jest kolejnością rysowania: późniejsza ramka leży wyżej. Środek kafelka (`x + w / 2`, `y + h / 2`) decyduje o ramce. Brzeg ramki wlicza się do niej. Przy kilku trafieniach wygrywa ramka późniejsza na liście. Środek poza wszystkimi ramkami daje `frame: null`.

Minimum rozmiaru: kafelek 160×72, ramka 200×120. Nowy kafelek ma 240×120 i tytuł z tłumaczenia („Nowy kafelek” / „New tile”). Nowa ramka ma 520×180. Oba powstają na środku widocznego obszaru.

Tytuł kafelka i ramki ma co najwyżej 200 znaków po obcięciu spacji. Notatka ma co najwyżej 10 000 znaków i może być pusta. Pusty tytuł ramki nie przechodzi przez okno nazwy. Współrzędne są skończonymi liczbami.

Zmiana położenia lub rozmiaru mniejsza niż pół piksela nie jest zapisem.

## API

Pod tym samym logowaniem co mapy myśli.

- `GET /api/board` zwraca dokument albo pustą tablicę.
- `PUT /api/board` tworzy albo zastępuje dokument: zapisuje `tiles`, `frames` i `edges`, ustawia `updatedAt` i zwraca zapisany dokument. Ostatni zapis wygrywa.

`PUT` zwraca 400, gdy treść nie spełnia modelu: brakujące identyfikatory, duplikaty identyfikatorów, rozmiar poniżej minimum, `frame` wskazujący na brakującą ramkę, strzałka, której końce nie są dwoma różnymi kafelkami. Niezalogowany dostaje tę samą odpowiedź co przy mapach myśli. Zapis większy niż limit dokumentu Firestore jest zwykłą porażką zapisu.

## Płótno

Pasek: przełącznik widoku, „+ Kafelek”, „+ Ramka”. Etykiety biorą się z tłumaczeń („Płótno” / „Canvas”, „Lista” / „List”, „+ Kafelek” / „+ Tile”, „+ Ramka” / „+ Frame”). Domyślny widok to płótno.

„+ Ramka” pyta o nazwę, potem stawia ramkę. Ramka postawiona na kafelkach od razu je obejmuje. „+ Kafelek” stawia kafelek i otwiera okno tytułu i notatki. Zamknięcie okna zapisuje treść.

Kliknięcie zaznacza element i pokazuje uchwyty rozmiaru. Dwuklik kafelka otwiera okno tytułu i notatki. Dwuklik tytułu ramki zmienia tylko nazwę.

Przeciągnięcie i zmiana rozmiaru zapisują się po puszczeniu. Przesunięcie ramki przesuwa kafelki, które do niej należą, i na nowo liczy przynależność. Przynależność jest liczona też po upuszczeniu kafelka, po zmianie jego rozmiaru i po postawieniu albo zmianie rozmiaru ramki.

Strzałka łączy dwa różne kafelki. Nie ma rodzaju ani etykiety. Zaznaczoną strzałkę usuwa przycisk ×. Koniec strzałki można przeciągnąć na inny kafelek.

Usunięcie zaznaczenia (kosz albo Backspace) pyta o potwierdzenie. Wiele zaznaczonych elementów idzie w jednym oknie, każdy według swojej reguły. Fokus startuje na przycisku anulowania. Z kafelkiem znikają strzałki, które go dotykają. Ramka znika, a jej kafelki zostają: trafiają do ramki, w której leży ich środek, albo poza ramki. Przy otwartym oknie (edycja, nazwa ramki, potwierdzenie usunięcia) Backspace nic nie usuwa.

Powiększenie i przesunięcie widoku zostają w `localStorage` pod kluczem `board-viewport:{uid}`. Odświeżenie strony wraca do tego widoku. Kafelki mają jeden wygląd aplikacji.

## Lista

Lista czyta ten sam stan co płótno. Sekcje idą w kolejności ramek. Pusta ramka zostaje na liście. Sekcja kafelków poza ramkami („Poza ramkami” / „Outside frames”) jest na końcu i znika, gdy nie ma w niej kafelków.

Wiersz pokazuje tytuł i notatkę. Kliknięcie tytułu otwiera to samo okno co dwuklik na płótnie. Z listy nie przesuwa się kart i nie rysuje strzałek.

## Błędy

Gdy odczyt się nie uda, zakładka pokazuje komunikat i przycisk ponowienia. Płótno i lista wtedy się nie rysują.

Skończony gest od razu zmienia widok i wysyła cały dokument. Gdy zapis się nie uda, zmiany zostają na ekranie, a nad treścią pojawia się komunikat w języku interfejsu („Nie zapisano zmian” / „Changes were not saved”). Następny udany zapis wysyła aktualny stan i komunikat znika.

## Testy

Bez testu Playwright przeciągającego kafelki.

- Funkcje układu: wybór ramki według środka, wygrana późniejszej ramki, przesunięcie kafelków razem z ramką, plan usunięcia (strzałki kafelka, lądowanie kafelków usuwanej ramki), próg pół piksela.
- Serwis: pusty odczyt zwraca trzy puste listy, poprawny zapis jest odczytywany z powrotem, zła ramka, za mały rozmiar i strzałka bez dwóch różnych kafelków dają błąd domenowy.
- Trasa `GET` i `PUT`: niezalogowany dostaje tę samą odpowiedź co przy mapach myśli, zła treść daje 400.
- Lista: kafelki w sekcjach ramek, brak sekcji „Poza ramkami” gdy jest pusta, klik tytułu woła otwarcie okna.
- Okno usunięcia: fokus startuje na przycisku anulowania.
