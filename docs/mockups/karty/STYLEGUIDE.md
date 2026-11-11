# Makiety kart: styleguide

Zasady dla każdego, kto tworzy lub poprawia kartę w `docs/mockups/karty/cards/`.
Wzorce: `cards/01-kokpit.html` (ciemna, gęsta) i `cards/02-kalendarz.html` (styl Kokpitu na innej karcie).
Brief kart (tło, akcent, motyw): `docs/superpowers/plans/2026-11-11-karty-makiety.md` §3.

## 0. Kierunek: futurystyka w stylu Kokpitu

**`01-kokpit.html` to wzorzec stylu dla wszystkich kart.** Ciemne tło z delikatnym wzorem, zaokrąglone panele,
kafle z liczbami (`.tiles`) na górze, cyfry mono, poświata tylko na aktywnych elementach, kontrastowy tekst.
**Tło jest wspólne dla wszystkich kart** (neutralny grafit z kropkami z `tokens.css`). Karty różnią się akcentem, krojem nagłówków i **jednym** motywem (np. w Kalendarzu siatka godzin),
a nie innym językiem wizualnym. Bez jasnych motywów, bez stylów papierowych, retro, szeryfowych i bez przesadnych
efektów HUD (ścięte rogi, narożniki). `02-kalendarz.html` pokazuje, jak przenieść ten styl na inną kartę.

## 1. Pliki

| Plik                    | Rola                                                      | Czy wolno edytować w zadaniu karty |
| ----------------------- | --------------------------------------------------------- | ---------------------------------- |
| `tokens.css`            | palety 8 kart + wspólne zmienne                           | **nie**                            |
| `shell.css`             | szkielet i wspólne komponenty                             | **nie**                            |
| `shell.js`              | pasek kart, pasek stanu, skróty, Ctrl+K, toasty, zakładki | **nie**                            |
| `cards/0N-<nazwa>.html` | jedna karta                                               | **tak, tylko swój plik**           |

Brakuje komponentu? Zrób go w `<style>` swojej karty (z prefiksem) i zgłoś to w raporcie.

## 2. Szablon strony karty

Skopiuj `<head>` z karty wzorcowej bez zmian (ten sam link Google Fonts, `../tokens.css`, `../shell.css`).
Zmieniasz tylko `data-card`, `<title>` i opcjonalnie `data-project` / `data-branch` (pasek stanu).

```html
<html lang="pl" data-card="zadania" data-project="…" data-branch="…">
  …
  <body>
    <div class="app">
      <main class="view">
        <header class="view-head">…</header>
        …treść karty…
      </main>
    </div>
    <script src="../shell.js"></script>
  </body>
</html>
```

Pasek kart i pasek stanu dokleja `shell.js`. Nie dodawaj ich ręcznie.

## 3. Tokeny (zmienne CSS)

Każda karta ma te same nazwy zmiennych, inne wartości (blok `[data-card="…"]` w `tokens.css`):

| Zmienna                                       | Do czego                                                         |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `--bg`, `--surface`, `--surface-2`, `--line`  | tło widoku, panele, pola i hover, obramowania                    |
| `--text`, `--muted`                           | tekst główny, tekst pomocniczy (oba AA na `--bg` i `--surface`)  |
| `--accent`                                    | wypełnienia, obramowania aktywne, kropki, paski                  |
| `--accent-text`                               | akcent użyty jako **tekst** (AA na tle)                          |
| `--accent-ink`                                | tekst **na** wypełnieniu `--accent` (np. przycisk primary)       |
| `--accent-soft`, `--glow`                     | delikatne tło akcentu, poświata (`box-shadow`)                   |
| `--ok`, `--warn`, `--danger`                  | statusy                                                          |
| `--font-display`                              | nagłówki i motyw karty; `--font-body` i `--font-mono` są wspólne |
| `--pattern`                                   | tło widoku (już nałożone przez `.view`)                          |
| `--s-1…7`, `--r-sm/md/lg/pill`, `--fs-xs…3xl` | odstępy, promienie, rozmiary pisma                               |

Zasady:

- **Żadnych gołych kolorów** (`#…`, `rgb(…)`) w regułach. Potrzebujesz nowego koloru? Zdefiniuj go raz jako
  zmienną z prefiksem karty na początku `<style>` (np. `:root { --zad-done: #…; }`) i sprawdź kontrast AA.
  Wyjątek: `color-mix()` na istniejących zmiennych.
- **Akcent dawkuj oszczędnie** (decyzja po przeglądzie Kalendarza): tylko kilka punktów na ekranie, np. jeden
  wyróżniony kafel, aktywny / wybrany element, „dziś / teraz”, główny przycisk. Tło karty zostaje neutralnie ciemne
  (bez zabarwienia akcentem), zwykłe elementy listy i wydarzenia w kolorach neutralnych. Nie barw akcentem całych
  paneli, ramek wszystkich elementów ani długich tekstów.
- Poświata tylko na elementach aktywnych / wybranych (`.panel--active`, `.tile--accent`, `.btn--primary:hover`).

## 4. Wspólne komponenty (`shell.css`)

| Klasa                                                                                             | Użycie                                     |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `.view-head`, `__eyebrow`, `__title`, `__sub`, `__actions`                                        | nagłówek widoku; eyebrow = „Alt+N · Nazwa” |
| `.panel`, `.panel--flush`, `.panel--active`, `.panel__head`, `.panel__title` (z `<b>`)            | panele                                     |
| `.tiles` (`--cols`), `.tile`, `__label`, `__value`, `__meta`, `.tile--accent`                     | kafle z liczbami                           |
| `.btn`, `--primary`, `--ghost`, `--sm`, `--icon`                                                  | przyciski                                  |
| `.chip`, `--accent`, `--solid`, `--ok`, `--warn`, `--danger`; `button.chip[aria-pressed]` = filtr | chipy, tagi, filtry                        |
| `.dot`, `--accent/ok/warn/danger`                                                                 | kropki statusu                             |
| `.energy--deep`, `.energy--quick`                                                                 | energia zadania                            |
| `.list`, `.list__item`, `__main`, `__title`, `__meta`                                             | listy                                      |
| `.check` (na `input[type=checkbox]`)                                                              | checkbox                                   |
| `.input` (input / textarea)                                                                       | pola                                       |
| `.progress > span` (`--v: 60%`)                                                                   | pasek postępu                              |
| `.tabs[data-group]` + `.tabs__btn[data-tab]`, panele `[data-tab-group][data-tab]`                 | zakładki (JS w szkielecie)                 |
| `.kbd`                                                                                            | skrót klawiszowy                           |
| `.stack`, `.row`, `.grid` (`--gap`), `.muted`, `.mono`, `.accent`                                 | układ i pomocnicze                         |
| `data-toast="…"` na dowolnym elemencie                                                            | atrapa akcji: po kliknięciu toast          |

Klasy własne karty mają prefiks: Kokpit `.kp-`, Kalendarz `.kal-`, Zadania `.zad-`, Projekty `.prj-`,
Notatki `.not-`, Płótno `.plo-`, Arsenał `.ars-`, Mapa `.map-`.

## 5. Źródła danych (`data-src`)

Makiety zbierają wymagania dla warstwy danych. Każdy blok z danymi dostaje atrybut
`data-src="plik · pole"`, np. `data-src="Projects/<slug>/tasks.md · [energy::]"`.
`Alt+0` (albo przycisk `src` w pasku kart) pokazuje te etykiety. Podawaj pliki z vaulta NEXUS
(`Projects/<slug>/index.md, state.md, tasks.md, bugs.md, devlog.md`, `Inbox/inbox.md`, `Sessions/`,
`focus.md`, `tech-stack-wspolny.md`, `_registry.yaml`) albo inne źródło (kalendarz, git, Herdr).

## 6. Dane w makietach

- Fikcyjne albo z projektów własnych z rejestru NEXUS: `code-sensei`, `english-agent`, `gen-podsum-ai`,
  `nexus`, `portfolio`, `second-brain`, `tester-ai`.
- **Żadnych danych z `Vault/Work/`** ani szczegółów etatu. Wydarzenia etatu tylko ogólnie („Etat · daily”).
- Data „dziś” we wszystkich kartach: **środa, 11 listopada 2026, 09:48**.
- Teksty po polsku, krótko, bez myślników w zdaniach.

## 7. Czego nie robić

- Nie dodawaj bibliotek, frameworków, ikon z CDN, obrazków ani innych fontów niż w linku Google Fonts z szablonu.
  Ikony: znaki Unicode albo inline SVG rysowane `currentColor`.
- Nie edytuj `tokens.css`, `shell.css`, `shell.js` ani cudzych kart.
- Nie kopiuj układów, palet ani elementów z cudzych produktów; motyw karty wynika z briefu.
- Tylko desktop (szerokość od 1200 px), bez wersji mobilnej.
- Karta jest statyczna: interakcje tylko jako atrapy (`data-toast`, zakładki, filtry `aria-pressed`).
  Własny `<script>` w karcie tylko gdy to konieczne, krótki, bez zewnętrznych zależności.

## 8. Raport po zakończeniu karty

Na koniec napisz krótko:

1. co jest na karcie (sekcje),
2. co odbiega od wzorca i dlaczego,
3. jakie nowe zmienne / klasy dodałeś,
4. lista `data-src` (źródła danych, których karta potrzebuje).
