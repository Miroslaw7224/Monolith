# Monolith: podział na karty i makiety, plan

Data: 2026-11-11
Status: kroki 1–7 zrobione (makiety, spec §6.6, plan `2026-11-11-karty-szkielet.md`)
Powiązany spec: `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md` (§6, D8)

## 1. Cel

Aplikacja dzieli się na 8 kart. Każda karta to osobny widok z własnym, wyraźnie innym stylem graficznym, tak aby od razu było widać, gdzie się jest. Przed implementacją w Next.js powstają statyczne makiety HTML wszystkich kart, do oceny i poprawek.

Ten plan dotyczy tylko makiet. Wdrożenie kart w aplikacji to osobny plan po akceptacji makiet.

## 2. Kierunek wizualny

- **Futurystyka w stylu Kokpitu (decyzja 2026-11-11 po przeglądzie wzorców):** Kokpit jest wzorcem dla wszystkich kart: ciemne tło, zaokrąglone panele, kafle z liczbami, cyfry mono, poświata na aktywnych elementach. Tło wspólne dla wszystkich kart (neutralny grafit z kropkami). Karty różnią się akcentem, krojem nagłówków i jednym motywem. Bez stylów papierowych, retro i przesadnych efektów HUD.
- **Żywe, nasycone kolory i mocny kontrast.** Każda karta ma jeden dominujący akcent, z poświatą (glow) na elementach aktywnych.
- **Własny styl, bez kopiowania** układów, palet ani elementów z obejrzanych zrzutów ekranu (inspiracja to wyłącznie poziom energii).
- **Wspólny szkielet, różne motywy:** zmienia się tło, akcent, krój nagłówków i motyw wizualny karty. Komponenty (przyciski, chipy, kafle, listy, modale, toasty) są wspólne.
- **Wszystkie karty ciemne** (decyzja 2026-11-11): ciemne tło i kontrastowy tekst; karty rozróżnia akcent, krój i motyw, nie jasność.
- **Czytelność:** tekst spełnia kontrast WCAG AA mimo nasyconych kolorów; akcent służy do wyróżnień, nie do długich tekstów.

## 3. Karty (brief)

| Skrót | Karta              | Zawartość (ze specu)                                                                                                  | Tło            | Akcent                                 | Motyw i typografia                                                   |
| ----- | ------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Alt+1 | **Kokpit** (start) | spotkania dziś, 2–3 aktywne tematy z Save State, kolejka zadań na dziś, inbox, rytuał zamknięcia dnia                 | wspólny grafit | bursztyn / pomarańcz                   | centrum dowodzenia: gęste kafle z liczbami, cyfry mono               |
| Alt+2 | **Kalendarz**      | miesiąc / tydzień / agenda, wydarzenia etatu i projektów, planer slotów, brief i action items                         | wspólny grafit | sygnałowa czerwień                     | styl Kokpitu + siatka godzin tygodnia, nagłówki Oxanium              |
| Alt+3 | **Zadania**        | wspólna lista ze wszystkich projektów, Deep Work / Quick Win, filtry projektu                                         | wspólny grafit | kwaśna limonka                         | terminal i checklista: mono, znaczniki `[ ]`                         |
| Alt+4 | **Projekty**       | rejestr, karta projektu: metryczka, Save State, Teraz / Następne / Icebox, devlog, paczka kontekstu, etykieta „Firma” | wspólny grafit | elektryczny błękit                     | teczka inżynierska: kafle statusu, nagłówki Exo 2                    |
| Alt+5 | **Notatki**        | lista i edytor notatek Markdown, wyszukiwarka decyzji                                                                 | wspólny grafit | biały tekst + neonowy żółty zakreślacz | holo-notatnik: szeroki margines, wysoki kontrast, nagłówki Sora      |
| Alt+6 | **Płótno**         | tablica i mapy myśli                                                                                                  | wspólny grafit | cyjan                                  | blueprint: linie techniczne, węzły                                   |
| Alt+7 | **Arsenał**        | skille i prompty, zasoby (linki), kursy z postępem, baza rozwiązań bugów                                              | wspólny grafit | fiolet                                 | zbrojownia modułów: holograficzne karty-moduły, sloty, nagłówki Syne |
| Alt+8 | **Mapa**           | graf zależności projektów, radar blokad, agenci z Herdr                                                               | wspólny grafit | neonowa magenta                        | sieć neuronowa (mózg): neurony, aksony, impulsy                      |

Dokładne wartości kolorów (hex) ustalam w kroku 1, w `tokens.css`, i sprawdzam ich kontrast.

## 4. Wspólny szkielet

- **Pasek kart** po lewej: neutralny, numery 1–8, aktywna karta podświetlona swoim akcentem.
- **Pasek stanu** na dole: aktywny projekt, stan vaulta, branch, zegar.
- **Nawigacja:** `Alt+1…8` przełącza karty, `Ctrl+K` otwiera paletę poleceń (w makiecie atrapa).
- **Motyw karty** włączany atrybutem `data-card` na kontenerze; zmienne CSS: `--bg`, `--surface`, `--text`, `--accent`, `--glow`, `--font-display`, `--pattern`.
- **Dane w makietach:** fikcyjne albo z projektów własnych z rejestru NEXUS. **Żadnych danych z `Vault/Work/`**, bo makiety oglądają zewnętrzne modele (Gemini).

## 5. Pliki

Katalog `docs/mockups/karty/`:

```
tokens.css         palety 8 kart + wspólne zmienne
shell.css          pasek kart, pasek stanu, wspólne komponenty
shell.js           przełączanie kart, skróty, atrapa Ctrl+K
cards/01-kokpit.html ... cards/08-mapa.html
index.html         złożenie: wszystkie karty w jednym szkielecie
STYLEGUIDE.md      zasady dla agy: tokeny, komponenty, czego nie robić
```

## 6. Etapy

| #   | Krok                                                                                                                                        | Kto                 | Wynik                           | Bramka |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------- | ------ |
| 0   | Akceptacja tego planu                                                                                                                       | użytkownik          | decyzje z §8                    | tak    |
| 1   | `tokens.css`, `shell.css`, `shell.js`, `STYLEGUIDE.md`                                                                                      | Claude              | szkielet z pustymi kartami      |        |
| 2   | Karty wzorcowe: **Kokpit** (ciemna, najbardziej złożona) i **Kalendarz** (styl Kokpitu)                                                     | Claude              | 2 gotowe karty, wzór dla reszty |        |
| 3   | Przegląd szkieletu i 2 kart, poprawki                                                                                                       | użytkownik + Claude | zatwierdzony wzorzec            | tak    |
| 4   | Pozostałe 6 kart: jedna karta na zlecenie (`ask-helper.sh --role task agy`), w prompcie brief z §3, `STYLEGUIDE.md` i pliki wzorcowe        | agy                 | 6 kart                          |        |
| 5   | Przegląd każdej karty: zgodność z tokenami i komponentami, kontrast, brak nowych bibliotek; poprawki zleca się agy (`--keep`) albo robi sam | Claude              | spójny komplet                  |        |
| 6   | Złożenie `index.html`, publikacja jako strona do obejrzenia                                                                                 | Claude              | link do makiety                 | tak    |
| 7   | Dopisanie podziału na karty do specu (nowa sekcja §6.6) i osobny plan wdrożenia w Next.js                                                   | Claude              | spec + plan wdrożenia           |        |

## 7. Zasady dla agy (w STYLEGUIDE.md i w każdym prompcie)

- Tylko wspólne komponenty i zmienne z `tokens.css`; nowe kolory wyłącznie jako zmienne motywu tej karty.
- Bez nowych bibliotek i zewnętrznych zasobów poza tymi, których używa szkielet.
- Edytuje wyłącznie swój plik `cards/0N-<nazwa>.html`.
- Dane fikcyjne lub z projektów własnych; bez danych z etatu.
- Na koniec krótka lista: co zrobione, co odbiega od wzorca i dlaczego.

## 8. Decyzje do potwierdzenia przed krokiem 1

1. Czy karty mają stały motyw (każda karta zawsze jasna albo ciemna), czy także przełącznik jasny / ciemny dla całej aplikacji? Decyzja: **stały motyw, wszystkie karty ciemne** (2026-11-11).
2. Czy kolejność i nazwy 8 kart z §3 są ostateczne?
3. Czy makiety mają też wersję mobilną? Propozycja: **na razie tylko desktop**, mobile przy wdrożeniu.

## 9. Ryzyka

- **Rozjazd stylu kart od agy:** ograniczają go tokeny, wspólne komponenty i przegląd po każdej karcie.
- **Kontrast przy nasyconych kolorach:** sprawdzany przy ustalaniu tokenów i w przeglądzie.
- **Za podobne akcenty** (bursztyn w Kokpicie, żółty zakreślacz w Notatkach, magenta w Mapie, fiolet w Arsenale): rozróżnia je tło karty; do weryfikacji na złożonej makiecie.
