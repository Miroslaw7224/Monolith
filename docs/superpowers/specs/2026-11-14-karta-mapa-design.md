# Karta Mapa (Alt+8): etap 1, globus sieci NEXUS

Data: 2026-11-14. Rozwija spec asystenta (`2026-11-11-asystent-lokalny-nexus-design.md`, §6.4 „Mapa projektów i zależności”, §8 „Herdr”) i makietę `docs/mockups/karty/cards/08-mapa.html`.

## 1. Cel i zakres

Karta Mapa pokazuje cały ekosystem NEXUS jako **obracany globus**: węzły leżą na powierzchni kuli, obrót myszą i powolny auto-obrót. Obok są kafle z realnymi liczbami i panel agentów z Herdr. Całość to **odczyt**; aplikacja niczego nie zapisuje w vaulcie.

W zakresie etapu 1:

1. Globus (canvas 2D, własna projekcja 3D): 7 projektów z rejestru oraz 3 kontynenty: Wiedza, AI-2030, Skille (Skille jako placeholder, D13).
2. Krawędzie: projekt–projekt (współdzielone komponenty) i projekt–Wiedza.
3. Kafle: Neurony NEXUS, Zależności, Aktywne blokery („—”), Agenci na żywo.
4. Panel agentów Herdr (`hc ls`, odświeżanie ręczne) z mapowaniem agent → projekt.
5. Radar blokad jako stan pusty („wkrótce”).
6. Lista węzłów dostępna z klawiatury, obsługa `prefers-reduced-motion`, przejście do karty Projekty.

**Poza zakresem (kolejne etapy):** krawędzie typu „bloker” i „przepływ danych” (wymagają formatu w `bugs.md` / `tech-stack-wspolny.md`), radar blokad z danymi i przycisk „Analizuj blokery”, kontynent Docs (9 plików `NEXUS/docs/`), krawędzie Skille → projekty (wymagają mapowania „skill → projekt”), pojedyncze notatki jako neurony (makieta: 305), zapis czegokolwiek z karty, wykonywanie akcji na agentach (tylko odczyt stanu).

## 2. Decyzje

| #   | Decyzja                 | Wybór                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Zakres etapu 1          | Herdr + kafle + graf z linków `[[…]]` i frontmatteru (D5), radar blokad jako stan pusty bez wymyślonych danych. Wybór użytkownika, 2026-11-14.                                                                                                                                                                                                                                                                                                                                  |
| D2  | Kształt grafu           | Globus (węzły na kuli, obrót), nie płaski układ sił. Wybór użytkownika, 2026-11-14.                                                                                                                                                                                                                                                                                                                                                                                             |
| D3  | Technika                | Canvas 2D z własną projekcją 3D, bez three.js i nowych zależności. Dla 10 węzłów i kilkunastu krawędzi WebGL jest przerostem. Odrzucone: three.js (~600 KB, trudniejsze testy), wart rozważenia dopiero przy setkach węzłów. Efekt dla użytkownika: prawdziwy 3D (rzut perspektywiczny, głębia, obrót myszą) z powolnym auto-obrotem; potwierdzone 2026-11-14.                                                                                                                  |
| D4  | Węzły                   | 7 projektów z rejestru (`_registry.yaml`; zakomentowany `career-guide` pomijany) i 3 kontynenty: **Wiedza** (`Vault/Knowledge/`, rekurencyjnie), **AI-2030** (`Vault/AI-2030/`), **Skille** (placeholder bez rozmiaru, D13). Rozmiar Wiedzy i AI-2030 = liczba plików `.md` (`size` mają tylko kontynenty z danymi; Skille ma stały, mały promień i podpis „wkrótce”; projekty mają stały promień). `Work/` jest zawsze pomijany. Wybór użytkownika, 2026-11-14.                |
| D5  | Krawędzie               | Typ „współdzielenie”. (a) projekt–projekt: dwa projekty występują w tej samej sekcji `**Używają:**` w `Vault/tech-stack-wspolny.md`; waga = liczba wspólnych sekcji. (b) projekt–Wiedza: pole `projects:` we frontmatterze notatki z `Knowledge/`; waga = liczba takich notatek. Skille i AI-2030 nie mają krawędzi: Skille wg D7, a notatki AI-2030 nie mają pola `projects:` (sprawdzone 2026-11-14; 97 z notatek Wiedzy ma je niepuste). Pary nieskierowane, bez duplikatów. |
| D6  | Dlaczego nie `index.md` | `index.md` projektów zawiera tylko link nagłówkowy `[[<id>/<id>]]`; nie linkuje do płatów wiedzy (sprawdzone 2026-11-14). Źródłem krawędzi do Wiedzy jest więc frontmatter notatek.                                                                                                                                                                                                                                                                                             |
| D7  | Skille bez krawędzi     | `NEXUS/Superpower/` to zewnętrzne repo metodyki (agenci, komendy, skille) i nie linkuje do projektów. Kontynent jest samodzielny; legenda mówi to wprost, żeby nie sugerować powiązań, których dane nie niosą.                                                                                                                                                                                                                                                                  |
| D8  | Herdr                   | Tylko odczyt: `hc ls` (JSON). Dopasowanie agent → projekt po prefiksie `cwd` względem `local_path` (z rozwinięciem `~`) **na granicy segmentu** (`/home/u/proj` nie pasuje do `/home/u/proj-2`); najdłuższy prefiks wygrywa; symlinki nie są rozwiązywane (porównanie tekstowe po normalizacji). Brak dopasowania = agent bez projektu. Pole `agent` bywa puste (np. cursor): wtedy etykieta „terminal”.                                                                        |
| D9  | Prywatność `owner`      | Dla projektów `owner: work` panel pokazuje tylko etykietę agenta i stan (bez `where`, `cwd` i nazwy zadania), zgodnie ze specem asystenta §8; test `isWorkProject`. Agent **bez dopasowanego projektu** też pokazuje tylko etykietę i stan (nie wiadomo, czy to repo z etatu). `cwd` nigdy nie trafia do DTO; `where` tylko dla agenta dopasowanego do projektu `personal`. Makieta pokazuje opis zadania agenta: `hc ls` go nie daje, więc go nie ma.                          |
| D10 | Dostępność Herdr        | Brak `hc`, błąd albo timeout (2 s) nie psuje karty: panel pokazuje „Herdr niedostępny”, kafel „Agenci na żywo” ma „—”, reszta Mapy działa.                                                                                                                                                                                                                                                                                                                                      |
| D11 | Dwa endpointy           | `GET /api/map/graph` (statyczny, ładowany raz) i `GET /api/map/agents` (przycisk „Odśwież stan”). Odrzucone: jeden `GET /api/map`, bo odświeżanie agentów nie powinno przeliczać grafu.                                                                                                                                                                                                                                                                                         |
| D13 | Skille (placeholder)    | Kontynent Skille jest na globusie, ale bez liczenia plików i bez odczytu poza Vault: nie ma `lib/skills`, `NEXUS_SKILLS_PATH` ani wyjątku od zasady „aplikacja widzi tylko Vault”. Podpis „wkrótce”. Prawdziwy rozmiar i krawędzie Skille → projekty to osobna decyzja (§7). Wybór użytkownika, 2026-11-14.                                                                                                                                                                     |
| D12 | Blokery                 | Makieta ma radar blokad z `Projects/*/bugs.md`, ale `bugs.md` nie ma pola blokera. Kafel „Aktywne blokery” pokazuje „—”, a radar stan „wkrótce”. Przycisk „Analizuj blokery” nie powstaje.                                                                                                                                                                                                                                                                                      |

## 3. Zmiany w kodzie (ADR-021)

**Nowy kontekst `contexts/bc_map/`** (pięć plików):

- `repositories.ts`: czyta dane grafu z vaulta (`tech-stack-wspolny.md`, frontmatter notatek `Knowledge/`, liczby plików) i woła `lib/herdr`. Jedyny dostęp do I/O kontekstu.
- `models.ts`: `MapNode = { id, kind: "project" | "continent", label, size?, owner? }` (`size` tylko dla kontynentów), `MapEdge = { from, to, weight, type: "shared" }`, `Agent = { address, label, state, status?, projectId?, where? }`. Surowy rekord terminala (`HerdrTerminal` z `cwd`, `where`, `agent`, `state`, `status`) jest typem `lib/herdr`; `repositories` zwraca go do `services`, które buduje `Agent` (po dopasowaniu i filtrze D9). `cwd` nie opuszcza `services`.
- `services.ts`: składa graf. Listę projektów (id, nazwa, `localPath`, `owner`) bierze z `listProjects()` w `bc_projects/services` (R2: tylko `services` innego kontekstu). Liczy krawędzie, kafle i dopasowanie agent → projekt (`resolveAgentProject(terminals, projects, home)`, funkcja czysta); filtruje dane wg D9. Remisy wag rozstrzyga alfabetycznie po `id`.
- `schemas.ts` (bezpieczny dla klienta): zod i typy DTO `MapGraphDto = { nodes, edges, tiles, warnings }` oraz `MapAgentsDto = { agents, available }`; mapery model → DTO.
- `router.ts`: `GET` dla obu tras przez `handleServiceError`.
- Trasy `app/api/map/graph/route.ts` i `app/api/map/agents/route.ts`: tylko re-eksport.

**Nowa warstwa `lib/herdr/`:** `listTerminals()` wywołuje `hc ls` przez `execFileSync` (bez powłoki, stałe argumenty) z `timeout` 2 s, `maxBuffer` i `stdio: ["ignore", "pipe", "ignore"]` (wzór: `lib/git/project-git.ts`) i parsuje JSON (`terminals[].address|agent|cwd|state|status|where`). Importuje ją tylko `bc_map/repositories` (wzór: `lib/git` w `bc_projects`). Test architektury nie zakazuje `child_process` w `lib/**` (poza `lib/nexus/vault-path.ts` i `vault-fs.ts`) i nie obejmuje `lib/herdr`, więc go nie zmienia.

**Odczyt vaulta:** `listVaultFiles` (`lib/nexus/vault-fs.ts`) i `markdown-dir.listEntries` są jednopoziomowe, a `markdown-dir` wymaga `id` we frontmatterze; `Knowledge/` ma podfoldery (`prompty`, `testowanie`, `ai-security`). Repozytoria kontekstów nie mogą używać `node:fs` (test warstwy plikowej). Dlatego: (1) do `lib/nexus/vault-fs.ts` dochodzi `listVaultFilesRecursive(dir)` (tylko `.md`, bez symlinków, **nigdy nie wchodzi do `Work/`**, więc nie rzuca `WorkAreaBlockedError`), z testem w `tests/unit/lib/nexus/`; (2) `bc_map/repositories` czyta pliki przez `readVaultFile` i `parseFrontmatter`, więc trafia na listę `VAULT_FS_IMPORTERS` w `tests/unit/architecture.static.test.ts`. **Zmiana tej listy idzie osobnym commitem przed kodem** (CLAUDE.md).

**Pułapki parsowania (sprawdzone na plikach vaulta):**

- Linki w `tech-stack-wspolny.md` mają postać `[[Projects/<id>/<id>|Alias]]` z dopiskami poza `]]` (np. „(V2)”): id wyciągamy regexem `Projects/([^/|\]]+)`.
- Sekcje bez linii `**Używają:**` (Deploy / Infrastruktura) i sekcja z jednym projektem (Supabase) nie dają krawędzi.
- `projects: []` w notatkach Wiedzy jest częste; puste pola pomijamy, nieznane id (spoza rejestru) pomijamy z wpisem w `warnings`.
- Test `no-model-api.static.test.ts` skanuje `app`, `src`, `lib`, `scripts`, `contexts` wzorcem `FORBIDDEN` (m.in. `ollama`, `OLLAMA_`, `/api/agent`, `GoogleGenAI`, `lib/gemini`, `services/agentService`). Słowa „agent” i „model” są dozwolone, ale nie wolno ich łączyć w żadną z zakazanych ścieżek (np. trasa `/api/agent`); trasy Mapy to `/api/map/*`.

**Kafle:**

| Kafel           | Wartość                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neurony NEXUS   | suma plików kontynentów z danymi (Wiedza + AI-2030) i notatek `Vault/Projects/` (rekurencyjnie, bez `Work/`), z rozbiciem w podpisie; Skille nie wchodzi do sumy (D13) |
| Zależności      | liczba krawędzi                                                                                                                                                        |
| Aktywne blokery | „—” (D12)                                                                                                                                                              |
| Agenci na żywo  | liczba terminali z agentem w `hc ls`; „—” gdy Herdr niedostępny                                                                                                        |

## 4. UI (`src/features/map/`)

UI importuje z kontekstu tylko `schemas`. Karta zastępuje zaślepkę: `cards.ts` dostaje `target: { kind: "map" }` (dziś jest `placeholder`, `CardTarget` w `cards.ts:16-20`), `useCardNavigation.ts` flagę `mapOpen` (wzór: `projectsOpen`), a `App.tsx` renderuje `MapView` oraz **dopisuje `!mapOpen` do warunku widoku Kokpitu** (`!projectsOpen && !placeholder && appMode === "home"`), inaczej Alt+8 z Kokpitu zostawiłby go na ekranie.

- `globeMath.ts` (czysta matematyka, w pełni testowana): `layoutNodes(nodes, edges)` — deterministyczne współrzędne sferyczne; `rotate(point, yaw, pitch)`; `project(point, w, h)` — rzut perspektywiczny z głębią `z`; `arcPoints(a, b, n)` — łuk wielkiego koła (slerp); `hitTest(projected, x, y)`.
- `Globe.tsx`: pętla `requestAnimationFrame` na `<canvas>`; rysuje łuki, węzły i etykiety. Głębia wyraża rozmiar i przezroczystość; półkula tylna (`z < 0`) jest przygaszona (alfa i grubość linii).
- `MapView.tsx`: kafle, układ globus + panel boczny, odświeżanie agentów. `MapAgentsPanel.tsx`, `MapBlockersPanel.tsx` (stan „wkrótce”), `MapNodeList.tsx`, `useMapGraph.ts`, `map.css` (motyw `[data-card="mapa"]`, zmienne z `docs/mockups/karty/tokens.css`).

**Układ na kuli:** kontynenty to stałe kotwice rozmieszczone równomiernie na równiku (kolejność alfabetyczna po `id`); projekty leżą na średnich szerokościach, blisko kontynentu, z którym mają największą wagę krawędzi (remis: pierwszy alfabetycznie; bez krawędzi: rozkład równomierny po długości geograficznej). Projekty przypisane do tego samego kontynentu są rozsuwane równomiernie po długości geograficznej w jego sektorze (w danych na dziś prawie wszystkie wskażą Wiedzę), żeby się nie nakładały. Układ zależy tylko od danych, nie od losowości, więc globus nie skacze po odświeżeniu. Krawędzie to łuki wielkich kół, a nie cięciwy przez środek kuli; dla punktów prawie antypodalnych (`sin θ ≈ 0`) `arcPoints` przechodzi przez punkt pośredni na biegunie obrotu, zamiast dzielić przez zero.

**Interakcja:** przeciąganie obraca (yaw/pitch); auto-obrót zatrzymuje się przy `pointerenter`, `focusin` i przeciąganiu. Klik rozpoznawany po przesunięciu poniżej 4 px; hit-test sortuje po `z` malejąco i ignoruje węzły na tylnej półkuli (`z < -0,2`). Klik w projekt otwiera kartę Projekty przez istniejące `openProject(id)` (`src/App.tsx`); klik w kontynent obraca globus do niego, podświetla jego krawędzie (Wiedza) i pokazuje podpis z liczbą notatek; dla kontynentów bez krawędzi (AI-2030, Skille) dzieje się tylko obrót i podpis.

**Dostępność:** `MapNodeList` to lista przycisków z klawiatury (Tab, Enter): Enter obraca globus do węzła i otwiera projekt. `prefers-reduced-motion: reduce` wyłącza pętlę animacji (globus statyczny, obrót tylko na żądanie). Canvas ma `aria-label` z liczbami (projekty, kontynenty, połączenia).

## 5. Testy

- `globeMath.test.ts`: `layoutNodes` deterministyczny i kotwice kontynentów rozłożone; `project` — punkt przed kulą większy niż za; `arcPoints` zaczyna i kończy w węzłach, wszystkie punkty na jednostkowej sferze; `hitTest` pomija tylną półkulę; próg 4 px klik/przeciągnięcie.
- Parser `tech-stack-wspolny.md` na fragmencie z dopiskiem „(V2)” i sekcją bez `**Używają:**`: oczekiwane pary i wagi. Parser `projects:` z frontmattera (puste, nieznane id).
- `resolveAgentProject`: najdłuższy prefiks `cwd`, `~` rozwinięte, brak dopasowania, projekt `work` ukrywa zadanie i ścieżkę.
- `lib/herdr`: parser JSON `hc ls` na zrzucie z polem `agent` pustym; timeout i brak `hc` kończą się `available: false`, nie wyjątkiem.
- `listVaultFilesRecursive`: schodzi do podfolderów, zwraca tylko `.md`, pomija symlinki i `Work/` (bez wyjątku).
- `resolveAgentProject` / DTO: `/home/u/proj-2` nie pasuje do `/home/u/proj`; agent bez projektu i agent `work` nie mają `where`; w DTO nigdy nie ma `cwd`.
- `arcPoints` dla punktów antypodalnych nie zwraca `NaN`.
- Testy komponentów: `MapNodeList` (Enter wybiera węzeł), panel agentów „Herdr niedostępny”, pusty radar „wkrótce”.
- `tests/unit/architecture.static.test.ts` i `no-model-api.static.test.ts` muszą pozostać zielone.

## 6. Ryzyka i założenia

- Wygląd globusa (CSS, płynność animacji) potwierdzą dopiero oczy w przeglądarce; testy sprawdzają matematykę, nie wrażenie.
- Dane są skromne: 7 projektów i kilkanaście krawędzi. Globus ma być czytelny, nie imponujący; więcej węzłów (notatki) to osobny etap z osobną decyzją o technice (D3).
- `hc ls` nie zawsze wypełnia `agent`; stąd etykieta „terminal”. Wszystkie trzy terminale pomocników mają dziś `cwd` w Monolith, więc mapują się na jeden projekt.

## 7. Odłożone do późniejszej weryfikacji

Pozycje świadomie poza etapem 1; wracamy do nich po etapie 1, żeby nie zgubić wątku.

1. **Mapowanie „skill → projekt” i krawędzie Skille (z D7).** Dziś AI-2030 i Skille nie mają krawędzi, bo dane nie niosą powiązań. Do rozstrzygnięcia: skąd brać mapowanie (frontmatter, osobny plik) i czy w ogóle jest potrzebne.
2. **Prawdziwy rozmiar kontynentu Skille (z D13).** Wymaga odczytu poza Vault (`NEXUS/Superpower/`) albo przeniesienia/odbicia tych danych do Vaulta. To wyjątek od zasady „aplikacja widzi tylko Vault”, więc osobna decyzja z oceną prywatności.
3. **Głębsza analiza prywatności agentów (D9).** Do wyjaśnienia i rozstrzygnięcia: co panel Herdr może pokazać o agencie (etykieta, stan, `where`, projekt) w zależności od tego, czy projekt jest `personal`, `work` czy nie da się go dopasować. Na etap 1 obowiązuje najostrożniejszy wariant z D9.
