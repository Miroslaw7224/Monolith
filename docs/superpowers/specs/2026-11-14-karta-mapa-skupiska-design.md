# Karta Mapa: skupiska notatek, więcej połączeń, zoom i dopasowanie do okna

Data: 2026-11-14. Rozwija `2026-11-14-karta-mapa-design.md` (etap 1, gałąź `feat/karta-mapa`). Powód zmiany: na globusie cała Wiedza (223 pliki) była jednym punktem, a połączeń było 16; kula była mała i nie wypełniała okna.

## 1. Cel i zakres

Globus pokazuje **punkty-notatki zbite w skupiska** (obszary na kuli), a nie jeden węzeł na kontynent. Skupisk jest ok. 21: 7 projektów, AI-2030, kategorie Wiedzy i Skille („wkrótce”). Połączeń jest wielokrotnie więcej, bo każdy link `[[…]]` między notatkami jest krawędzią. Kula wypełnia dostępne miejsce w oknie, ma zoom `−` / `+` i przycisk „Dopasuj do okna”.

Zakres:

1. Węzły na poziomie notatek: `Vault/Knowledge/`, `Vault/AI-2030/`, `Vault/Projects/<id>/` (rekurencyjnie, bez `Work/`).
2. Skupiska: projekt, AI-2030, kategoria Wiedzy, Skille (pusty pierścień).
3. Krawędzie: notatka–notatka z linków `[[…]]`, notatka Wiedzy–projekt z `projects:`, projekt–projekt z `tech-stack-wspolny.md`; krawędzie zagregowane między skupiskami.
4. Układ skupisk na kuli (płaty) i punktów w płatach, deterministyczny.
5. Płótno wypełnia okno; zoom `−` / `+` (kółko, szczypanie, przyciski, klawisze); „Dopasuj do okna”.

**Poza zakresem:** pełny ekran, przesuwanie widoku (pan), otwieranie notatki w innej karcie, krawędzie „bloker” i „przepływ danych”, rozmiar i krawędzie Skille (§7 specu etapu 1), akcje na agentach. Panel agentów, radar blokad i `lib/herdr` zostają bez zmian.

## 2. Co zastępuje spec etapu 1

| Było                                                | Jest                                                        |
| --------------------------------------------------- | ----------------------------------------------------------- |
| D4: 7 projektów + 3 kontynenty jako węzły           | D14, D15: węzły to notatki, skupiska to płaty               |
| D5: krawędzie projekt–projekt i projekt–Wiedza      | D16: plus notatka–notatka, plus agregacja między skupiskami |
| §1 poza zakresem: „pojedyncze notatki jako neurony” | wchodzi do zakresu                                          |
| §4 „Układ na kuli”, `layoutNodes`                   | D17: `layoutClusters` i spirala w płacie                    |
| Kafle „Neurony” i „Zależności”                      | D19: liczą węzły-notatki i pary skupisk                     |
| Płótno stałej wysokości                             | D20: płótno wypełnia okno, zoom i dopasowanie               |

D1–D3, D6–D13 (Herdr, prywatność agentów, Skille bez krawędzi, canvas 2D) obowiązują dalej. D3 zostaje: ~260 punktów i do kilkuset łuków to nadal domena canvasu 2D bez three.js.

## 3. Decyzje

| #   | Decyzja                   | Wybór                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D14 | Skupiska                  | Wszystko skupiskami (wybór użytkownika, 2026-11-14): każdy z 7 projektów (jego notatki z `Projects/<id>/`, ok. 4 na projekt), AI-2030 i każda kategoria Wiedzy to osobny płat z punktami-notatkami; Skille to pusty pierścień „wkrótce” bez punktów (D13). Grupy wizualne (`group`): `projects`, `knowledge`, `ai2030`, `skills`; płaty jednej grupy leżą blisko siebie.                                                                                                                                                                                            |
| D15 | Kategoria Wiedzy          | Skupisko notatki z `Knowledge/` = pierwsza wartość `categories:` we frontmatterze. Brak pola albo kategoria z mniej niż 3 notatkami → skupisko „inne”. Na dziś daje to ok. 12 skupisk (`ai-tools` 55, `dev-tools` 36, `testing` 34, `concepts` 21 …). Id skupiska: `knowledge:<kategoria>`; projekt ma id projektu (żeby `openProject(id)` działało bez zmian), AI-2030 ma `ai-2030`, Skille `skille`.                                                                                                                                                              |
| D16 | Połączenia                | Zagregowane + szczegóły po kliknięciu (wybór użytkownika, 2026-11-14). Domyślnie widoczne są grube łuki między skupiskami (grubość = waga, 40 najsilniejszych par). Notatkowe linki rysujemy tylko dla zaznaczonego skupiska lub punktu; reszta jest przygaszona. Źródła krawędzi poniżej.                                                                                                                                                                                                                                                                          |
| D17 | Układ                     | Deterministyczny, bez losowości (globus nie skacze po odświeżeniu). Płat to czapa sferyczna o promieniu kątowym `R = 0,10 + 0,045·√n` rad (n = liczba notatek; Skille ma stałe `R = 0,10`). Środki płatów: start z punktów spirali Fibonacciego, potem stała liczba iteracji relaksacji sił (odpychanie do odległości `Rᵢ + Rⱼ + 0,04`, słabe przyciąganie do środka grupy i po wadze krawędzi zagregowanych). W płacie punkty leżą na spirali Fibonacciego (kąt złoty), a notatki o największej liczbie linków (remis: alfabetycznie po `id`) bliżej środka płatu. |
| D18 | Rozwiązywanie linków      | `[[cel\|alias#kotwica]]`: obcinamy alias i kotwicę; najpierw dopasowanie pełnej ścieżki względem `Vault/` (bez `.md`), potem sam `basename`; przy wielu trafieniach pierwszeństwo: Wiedza, Projekty, AI-2030, potem alfabetycznie. Nierozwiązany link, link do `_index`/`_tags` i link do samego siebie są pomijane (nierozwiązane liczone w `warnings`, bez listy ścieżek). Dublety par łączymy w jedną krawędź z sumą wag.                                                                                                                                        |
| D19 | Kafle                     | „Neurony NEXUS” = liczba węzłów-notatek (rozbicie: Wiedza, AI-2030, projekty). „Zależności” = liczba par skupisk połączonych przed obcięciem do 40 łuków. Pliki `_index.md`, `_tags.md` i katalogi `attachments/` nie są notatkami; liczby kafli mogą się więc nieznacznie różnić od `223` ze specu etapu 1 (to oczekiwane).                                                                                                                                                                                                                                        |
| D20 | Widok: zoom i dopasowanie | Płótno wypełnia dostępne miejsce w oknie. Zoom `0,5×–6×` względem środka kuli. „Dopasuj do okna” przywraca zoom 1× i dobiera promień kuli do rozmiaru płótna. Bez pełnego ekranu i bez przesuwania widoku (obrót i klik w skupisko wystarczają do nawigacji).                                                                                                                                                                                                                                                                                                       |

## 4. Zmiany w kodzie (ADR-021)

Zmiany w istniejącym `contexts/bc_map/` (pięć plików, bez nowych kontekstów i bez nowych importerów `node:fs`; `repositories` jest już na liście `VAULT_FS_IMPORTERS`, więc **test architektury nie zmienia się**):

- `models.ts`: `MapCluster = { id, label, group, size, projectId?, owner?, soon? }`; `MapNode = { id, label, cluster, links }` (`links` = liczba powiązań, do układu); `MapEdge = { from, to, weight, type: "link" | "project" }` (`link`: notatka–notatka; `project`: notatka Wiedzy → skupisko projektu z `projects:`); `MapClusterEdge = { from, to, weight }`. Węzły-kontynenty znikają. `MapGraph = { clusters, nodes, edges, clusterEdges, tiles, warnings }`.
- `repositories.ts`: czyta notatki (`listVaultFilesRecursive` z etapu 1, `readVaultFile`, `parseFrontmatter`), wyciąga wikilinki z treści (bez fragmentów w blokach kodu) i `categories`/`projects` z frontmattera; zwraca surowe `MapSources` (notatki, surowe cele linków, sekcje „Używają”).
- `services.ts`: rozwiązuje linki (D18), buduje skupiska (D15), krawędzie, agregację z obcięciem do 40 (waga malejąco, remis alfabetycznie po `from`, `to`), kafle (D19). Funkcje czyste, osobno testowane: `resolveLink`, `buildClusters`, `aggregateEdges`. Agenci bez zmian.
- `schemas.ts`: DTO `MapGraphDto = { clusters, nodes, edges, clusterEdges, tiles, warnings }` i mapery; bezpieczny dla klienta. Tytuł węzła to `name`/`title` z frontmattera albo nazwa pliku; ścieżka pliku nie trafia do DTO (id notatki to ścieżka względem `Vault/` bez `.md`, bez `Work/`).
- `router.ts`, `app/api/map/*`: bez zmian poza typem odpowiedzi.

Rozmiar odpowiedzi: ok. 260 węzłów i ok. 1,9 tys. krawędzi to rząd 150 KB JSON, ładowane raz (D11 bez zmian).

**UI (`src/features/map/`)**, importuje z kontekstu tylko `schemas`:

- `globeMath.ts`: `layoutClusters(clusters, clusterEdges)` zamiast `layoutNodes`; `layoutPoints(center, R, nodes)` (spirala w płacie, rzut na sferę jednostkową); `fitRadius(w, h)` i `clampZoom(z)`; `project` dostaje promień z zoomem. `rotate`, `arcPoints`, `rotationTo`, `hitTest`, `isClick` zostają.
- `Globe.tsx`: rysuje płaty (delikatna obwiednia i podpis skupiska), punkty, łuki zagregowane i, dla zaznaczenia, łuki notatkowe; stan zoomu, `ResizeObserver` i obsługa wejścia (D20).
- `core.ts` (nowy, czysta logika wnętrza kuli: `withAlpha`, `coreAlphas`, `coreStops`, `coreStops`, `makeDust`, `dustPosition`, `axonPulse`, `innerSphere`) i `motion.ts` (dodane `globeBreath`, `rimFactor`): zob. §5a.
- `MapNodeList.tsx`: lista **skupisk** (ok. 21 przycisków, pogrupowana wg `group`), nie 260 punktów. Enter obraca do skupiska, a skupisko projektu dodatkowo otwiera kartę Projekty (jak dziś).
- `MapClusterPanel.tsx` (nowy): po zaznaczeniu skupiska lista jego notatek jako przyciski (dostępność z klawiatury); po zaznaczeniu punktu tytuł, skupisko i liczba linków wychodzących/przychodzących. Otwieranie notatki w innej karcie jest poza zakresem.
- `MapView.tsx`, `mapTiles.ts`, `map.css`: stan zaznaczenia (skupisko lub notatka), układ wypełniający wysokość okna.

## 5. Interakcja i rysowanie

- **Domyślnie:** punkty w płatach, podpisy płatów, grube łuki zagregowane (40). Projekty to płaty z ok. 4 punktami, więc nadal wyraźne.
- **Klik w skupisko:** obrót do niego, jego notatkowe linki cienko (także do innych skupisk), reszta przygaszona; panel boczny z listą notatek. Skupisko projektu otwiera dodatkowo kartę Projekty.
- **Klik w punkt:** jego linki wychodzące i przychodzące; podpis to tytuł notatki. Hit-test ignoruje tylną półkulę (`z < -0,2`) i wybiera punkt o największym `z`; promień trafienia ma stałą dolną granicę w px, żeby mały punkt przy zoomie 1× dało się kliknąć.
- **Limit rysowania:** dla zaznaczenia rysujemy co najwyżej 400 łuków notatkowych (najpierw o obu końcach w zaznaczeniu, potem alfabetycznie po `from`, `to`), żeby klatka zostawała tania.
- **Etykiety:** podpisy skupisk zawsze; podpisy punktów tylko przy zoomie ≥ 2,5× i tylko na przedniej półkuli (`z > 0`), z unikaniem nakładania (pomijamy podpis, który zachodzi na już narysowany).
- **Głębia i `prefers-reduced-motion`:** jak w etapie 1 (alfa i grubość z `z`; brak pętli animacji, obrót na żądanie).

### 5a. Wnętrze i ruch kuli (dodane po implementacji, bez zmiany danych)

Kula ma „żywe” wnętrze, rysowane pod płatami i punktami (czysta wizualizacja; nie wpływa na hit-test ani dane). Logika liczbowa jest w `core.ts` i `motion.ts`, rysowanie w `Globe.tsx`.

- **Tło i jądro:** radialny gradient ciemnego brzegu (alfa `0,34 + 0,08·puls`, w środku połowa) oraz świecące jądro jak lawa (`LAVA`: żar `#fff0a8` → pomarańcz `#ff8a1f` → czerwień `#d0300a`, `coreStops`; alfa do `CORE_MAX_ALPHA` = 0,4, gaśnie na 85% promienia; kolor stały, nie z palety motywu). Puls to `slowPulse` (okres ok. 6,3 s); `coreAlphas(puls)` zwraca obie alfy.
- **Wewnętrzna siatka:** `innerSphere(0,4, 3 równoleżniki, 4 południki, 48 odcinków)`, cienkie linie `accent` (alfa `0,06 + 0,05·puls`), obracane razem z globusem; przy zaznaczeniu przygaszone.
- **Aksony:** od jądra do środka każdego skupiska (bez Skilli) cienkie włókno w kolorze grupy; przy zaznaczeniu skupiska rozjaśnione, pozostałe przygaszone. Wzdłuż włókna biegnie kropka (`axonPulse`, okres 4,2 s, stałe przesunięcie fazy z `id`).
- **Pył:** `DUST_COUNT` = 110 ziaren (`makeDust`, deterministyczny generator `mulberry32` z ziarnem 7224, więc ten sam wygląd po odświeżeniu) na promieniach 0,2–0,75; `dustPosition` daje powolne krążenie wokół osi pionowej i lekkie pływanie.
- **Oddech kuli:** `globeBreath(now)` = 1 ± `GLOBE_BREATH_AMP` (**±2%**, okres ok. 5,2 s) skaluje cały rzut (węzły, łuki, etykiety, hit-test) razem.
- **Elastyczny brzeg:** promień obrysu kuli mnożony przez `rimFactor(θ, now)`: trzy harmoniczne (2, 3, 5) o amplitudach 1,4%, 1,0%, 0,8%, więc maksymalne odchylenie `RIM_MAX_WOBBLE` = **3,2%**. `RIM_MAX_WOBBLE` ma równać się sumie amplitud harmonicznych (test sprawdza tylko, że brzeg mieści się w 1 ± `RIM_MAX_WOBBLE`, więc przy zmianie amplitud podnosimy je razem ręcznie). Brzeg działa niezależnie od oddechu: gdy ±2% jest zbyt ruchliwe (węzły i etykiety „pływają”), cofamy tylko `GLOBE_BREATH_AMP`.
- **Losowe kierunki auto-obrotu:** zamiast stałego obrotu w jedną stronę co 7–14 s (`spinHoldMs`) losujemy nowy kierunek (`pickSpin`): obrót w lewo lub w prawo z tempem 0,06–0,16 rad/s i lekkie pochylenie do ±0,05 rad/s. Prędkość zmienia się płynnie (`approach`, tempo 0,6/s). `spinPitchGuard` zawraca pochylanie, gdy kula jest poza `AUTO_PITCH_LIMIT` = 0,6 rad. Dotyczy tylko auto-obrotu (zatrzymanego przy hoverze, przeciąganiu i `paused`); obrót do fokusu i przeciąganie działają jak wcześniej.
- **`prefers-reduced-motion`:** bez oddechu (mnożnik 1), bez falowania brzegu (okrąg), bez pyłu i bez biegnących kropek; jądro, siatka i aksony statyczne.

## 6. Widok: dopasowanie do okna i zoom (D20)

- **Wypełnianie okna:** kontener płótna zajmuje wysokość `100dvh` pomniejszoną o to, co jest nad nim (nagłówek, kafle), z dolną granicą 420 px. `ResizeObserver` ustawia rozmiar bufora płótna z uwzględnieniem `devicePixelRatio`, bez przeładowania. Kafle i panel agentów zostają jak były, a lista węzłów i legenda pod globusem.
- **Zoom:** kółko myszy (krok ×1,1 na ząbek), szczypanie dwoma wskaźnikami (stosunek odległości), przyciski `−` i `+` w rogu płótna (krok ×1,25). Zakres `clampZoom`: 0,5 do 6. Zoom jest względem środka kuli; promień rysowania = `fitRadius(w, h) · zoom`.
- **„Dopasuj do okna”:** przycisk (i klawisz `0`) ustawia zoom 1× i przelicza `fitRadius` dla bieżącego rozmiaru. Dopóki użytkownik nie zmienił zoomu ręcznie, rozmiar kuli sam podąża za zmianą rozmiaru okna; po ręcznej zmianie zostaje zoom, a „Dopasuj” znów włącza śledzenie.
- **Klawiatura:** `+` / `=`, `−`, `0` działają, gdy płótno ma fokus; przyciski mają `aria-label` i `title`. Płótno ma `tabIndex={0}` i `aria-label` z liczbami (skupiska, notatki, połączenia).
- **`prefers-reduced-motion`:** zmiana zoomu natychmiastowa; w przeciwnym razie krótkie wygładzenie (ok. 150 ms).
- **Kółko myszy** nad płótnem zoomuje i nie przewija strony (płótno zajmuje całe okno, więc przewijanie nie jest tu potrzebne); poza płótnem strona przewija się normalnie.

## 7. Testy

- `globeMath.test.ts`: `layoutClusters` deterministyczny (dwa wywołania, identyczny wynik), środki na sferze jednostkowej, płaty się nie nakładają (odległość środków ≥ `Rᵢ + Rⱼ`) dla danych z ok. 21 skupiskami; `layoutPoints` zwraca punkty w czapie o promieniu `R` na sferze jednostkowej, węzeł o największym `links` najbliżej środka; `fitRadius` rośnie z płótnem i uwzględnia margines; `clampZoom` przycina do 0,5–6; `project` z zoomem skaluje promień; `hitTest` nadal pomija tylną półkulę.
- `core.test.ts` i `motion.test.ts` (wnętrze kuli i losowy obrót, §5a; losowość wstrzykiwana jako `rand`, więc testy są deterministyczne; `pickSpin` daje oba kierunki w granicach tempa, `spinHoldMs` w przedziale, `spinPitchGuard` zawraca pochylanie): `withAlpha` (hex 3/6, `rgb()`, nieznany format → `fallback`, przycięcie alfy), `coreAlphas` w granicach, `coreStops` (ciepłe kolory, alfa malejąca do 0 na brzegu), `makeDust` deterministyczny z promieniami w `[DUST_MIN_RADIUS, DUST_MAX_RADIUS]`, `axonPulse` w [0, 1), `innerSphere` (liczba łamanych, długość `segments + 1`, punkty na promieniu), `globeBreath` w 1 ± `GLOBE_BREATH_AMP`, `rimFactor` w 1 ± `RIM_MAX_WOBBLE`, brzeg nie jest okręgiem i faluje w czasie.
- `resolveLink`: pełna ścieżka, sam `basename`, alias `|`, kotwica `#`, link do `_index`, nieznany cel, pierwszeństwo Wiedza przed Projektami przy dublecie, link do samego siebie.
- `buildClusters`: pierwsza kategoria, brak `categories`, kategoria z 2 notatkami trafia do „inne”, Skille bez punktów.
- `aggregateEdges`: suma wag w parze, pominięcie linków wewnątrz skupiska, obcięcie do 40 z deterministyczną kolejnością przy remisie.
- Repozytorium na fixturze `Vault`: frontmatter `categories:` w formie listy i w jednej linii, wikilinki w bloku kodu ignorowane, katalog `attachments/` i `Work/` pominięte.
- DTO: brak ścieżek bezwzględnych i `cwd`; id notatki nie zawiera `Work/`.
- Komponenty: `MapNodeList` (Enter wybiera skupisko, projekt otwiera kartę), `MapClusterPanel` (lista notatek, przyciski z klawiatury), przyciski zoomu (`+`, `−`, „Dopasuj”: wywołania i `aria-label`).
- `tests/unit/architecture.static.test.ts` i `no-model-api.static.test.ts` muszą zostać zielone; zmiana tych testów, gdyby była potrzebna, idzie osobnym commitem przed kodem (CLAUDE.md).

## 8. Ryzyka i założenia

- **Wygląd** (gęstość punktów, czytelność podpisów, płynność przy zoomie 6×) ocenią dopiero oczy w przeglądarce; testy sprawdzają matematykę, nie wrażenie. Po implementacji obowiązkowy przegląd karty na żywo.
- **Relaksacja układu** może nie znaleźć układu bez nakładania, jeśli płaty są zbyt duże. Test z §7 to wychwytuje; zapasem jest zmniejszenie współczynnika `0,045` albo odstępu `0,04`. Szacunek pokrycia: płaty zajmują ok. jedną trzecią powierzchni kuli, więc zapas jest.
- **Nazwy kategorii** są nierówne: obok dużych (`ai-tools`, `dev-tools`) są pojedyncze (`chain`, `user-prompt`, `template`); reguła „<3 notatki → inne” je zbiera. Zapisy, które różnią się tylko formatowaniem (np. `dev-tools` w dwóch postaciach we frontmatterze), normalizuję przy odczycie (trim, małe litery), a w planie sprawdzam to na danych; vaulta nie zmieniam.
- **Prywatność:** węzły to tytuły i linki notatek z `Knowledge/`, `AI-2030/` i `Projects/<id>/`, czyli to, co aplikacja już czyta w innych kartach. `Work/` pozostaje wykluczony; ścieżki nie trafiają do DTO.
- **Wydajność:** ok. 1,9 tys. krawędzi tylko w pamięci; rysujemy najwyżej 40 + 400 łuków na klatkę.
- **Kolizja nazw CSS:** klasa `.chip` w `map.css` jest globalna i może kolidować z innymi stylami (znane ryzyko z etapu 1); nowe style skupisk dostają prefiks `map-`.
