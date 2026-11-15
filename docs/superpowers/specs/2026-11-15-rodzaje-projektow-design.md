# Rodzaje projektów: kolor i znacznik (etat / własny / biblioteka)

Data: 2026-11-15. Status: szkic do przeglądu. Rozwija spec asystenta (`2026-11-11-asystent-lokalny-nexus-design.md`, §5 i §6.1) i spec 1-5 (`2026-11-13-etap-1-5-owner-design.md`, D5).

## 1. Cel

Użytkownik prowadzi w Monolith projekty własne i firmowe. Chce je widzieć w jednej liście i rozróżniać na pierwszy rzut oka: dziś karty w rejestrze karty Projekty wyglądają tak samo (niebieski akcent), a znacznik „Firma” pokazuje się tylko przy `owner: work`. Przełącznik „Etat / Własny / Biblioteka” (pole `type` w `index.md`, etap 1-2) już istnieje, ale nic nie zmienia wizualnie. Ten etap czyni z niego źródło koloru i znacznika.

## 2. Decyzje (brainstorming 2026-11-15)

| ID  | Temat                         | Decyzja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Gdzie leżą projekty firmowe   | W zwykłym rejestrze `Projects/_registry.yaml`. „+ Nowy projekt” zawsze tworzy wpis `owner: personal` i pozwala wybrać tylko `type` (np. Etat); `owner: work` wymaga ręcznego wpisu w rejestrze. **Bez czytania `Vault/Work/` w tym etapie.** Powód: użytkownik jest współwłaścicielem firmy, repo NEXUS jest prywatne, więc izolacja z §5 specu asystenta (zakładająca etat u pracodawcy i niesprawdzoną politykę firmy) nie jest tu wymagana. Odrzucone: odczyt `Work/_registry.work.yaml` w etapie A, zapis przez strażnika w B, kalendarz etatu w C. |
| D2  | Co przełącznik `type` zmienia | Kolor karty i znacznik tekstowy. Etat = zielony, Własny = niebieski (obecny akcent), Biblioteka = fioletowy. Brak `type` = rodzaj z `owner` (`work` → etat, inaczej własny). Kolor nie jest nadpisywalny osobnym polem (`color:` odrzucone, YAGNI).                                                                                                                                                                                                                                                                                                     |
| D3  | `type` a `owner`              | Nadal dwa osobne pola (D5 specu 1-5 zostaje). `owner` to jedyny przełącznik **blokad** (Mapa: prywatność agentów D9, filtr bazy wiedzy w Notatkach, przyszłe AI lokalne i eksport przez `isWorkProject`). `type: etat` dokłada tylko **ostrzeżenia i znaczniki** (D4); nie zmienia `isWorkProject`, żeby oznaczenie projektu jako „Etat” nie ukrywało jego notatek ani nie zmieniało zachowania Mapy. Twarda ochrona = ręczne `owner: work` w rejestrze.                                                                                                |
| D4  | Dane z firmy                  | `companyData = owner === "work" \|\| type === "etat"`. Przy `companyData`: znacznik „Dane z firmy” w teczce (z podpowiedzią `title`, zob. §4.2), ostrzeżenie „Dane z firmy: sprawdź, gdzie wklejasz” w paczce kontekstu (kopiowanie nadal niezablokowane) i znacznik „Dane z firmy” w oknie „Przenieś do…” z Inboxu.                                                                                                                                                                                                                                    |
| D5  | Znacznik „Firma”              | Żółty znacznik „Firma” (`prj-badge--firm`) w liście zostaje bez zmian: pokazuje się **wyłącznie** przy `owner: work`, niezależnie od rodzaju. Dzięki temu `owner: personal` z `type: etat` (tylko etykieta: zielony, „Etat”) różni się od `owner: work` z `type: etat` (zielony, „Etat” i żółty „Firma”, pełna ochrona z D3), a rozjazd koloru i granicy danych (np. `owner: work` z `type: wlasny`) jest widoczny.                                                                                                                                     |
| D6  | Wspólne zadania i kalendarz   | Bez nowego kodu. Projekty firmowe są w tym samym rejestrze, więc Kokpit (`listNowTasks` iteruje cały rejestr bez filtra po `owner` i zwraca `owner` w `NowTask`; istnieje test `services.test.ts`), „Przenieś do…” (lista z `GET /api/projects`, bez filtra) i kalendarz (nie zna `owner`) obsługują je jak własne.                                                                                                                                                                                                                                     |
| D7  | Kafelek „N własne · N etat”   | Liczy się po `kind`, nie po surowym `type`, żeby zgadzał się z kolorami listy; gałąź „bez typu” znika (projekt bez `type` wpada do rodzaju wyliczonego z `owner`).                                                                                                                                                                                                                                                                                                                                                                                      |

## 3. Zakres

**W zakresie:** pola `kind` i `companyData` w `ProjectSummaryDto`; kolor i znacznik rodzaju w liście rejestru i w nagłówku teczki; rozszerzenie znacznika „Dane z firmy” (teczka, okno „Przenieś do…”) i ostrzeżenia paczki o `type: etat`; odświeżanie listy i paczki po zmianie typu; kafelek po `kind`; testy.

**Poza zakresem (do `tasks.md` Monolith):**

- Znacznik „Dane z firmy” w grupie kolejki Kokpitu (`CockpitSections.tsx`, `QueueGroupDto.owner`) i „(etat)” w `DeployPanel.tsx`: dalej tylko po `owner`, bo `NowTask` i cele wdrożenia nie znają `type`; projekt z `type: etat` i `owner: personal` nie dostanie tam znacznika.
- Odczyt `Work/_registry.work.yaml` i zapis w `Work/` (wraca, gdy pojawi się projekt wrażliwy: dane klientów, NDA, klucze); w razie potrzeby osobny brainstorming.
- Kalendarz etatu (`Work/calendar.yaml`).
- Kolor projektu przy zadaniach w Kokpicie i na osi dnia.
- Nadpisywalny kolor (`color:` w rejestrze).
- Aktualizacja specu asystenta: linia 150 uzasadnia odrzucenie „przełącznika praca/życie” tym, że etat nie jest wykonywany na tym PC; użytkownik potwierdził 2026-11-15, że praca własna i etatowa jest na jednym komputerze. Polityka firmy (§10) przestaje być otwartym ryzykiem, bo użytkownik jest współwłaścicielem.
- Makieta `docs/mockups/karty/cards/04-projekty.html` nie jest aktualizowana.

## 4. Projekt

### 4.1 Reguły (kontekst `bc_projects`)

Reguła rodzaju: `kind = type ?? (owner === "work" ? "etat" : "wlasny")`, wartości `etat | wlasny | biblioteka`.
Reguła danych: `companyData = owner === "work" || type === "etat"`.

Test architektury zabrania `services → schemas` i runtime-owego `schemas → models` (R3), więc reguły są zapisane w dwóch miejscach, z tym samym zestawem przypadków testowych (tabela w jednym pliku testowym wołająca oba):

- `contexts/bc_projects/schemas.ts`: `toSummaryDto(p: Project)` dopisuje `kind` i `companyData` do `ProjectSummaryDto` (pola wymagane, `kind: ProjectType`, `companyData: boolean`);
- `contexts/bc_projects/services/index.ts`: `hasCompanyData(entry: Pick<RegistryEntry,"owner">, type?: ProjectType): boolean` używana w `buildContextPack` (`warnings` zaczyna się od `OWNER_WORK_WARNING`, gdy `hasCompanyData(entry, project.type)`). `isWorkProject` bez zmian (D3).

`models.ts`, `repositories.ts`, `router.ts`: bez zmian (`type` jest już czytany z `index.md` do `Project.type`).

### 4.2 UI (`src/features/projects/`)

- `ProjectList.tsx`: klasa modyfikatora `prj-item--kind-<kind>` na karcie; znacznik rodzaju `<span className="prj-badge prj-badge--kind-<kind>">` z tekstem „Etat”, „Własny” lub „Biblioteka” w rzędzie znaczników; żółty „Firma” bez zmian (`owner === "work"`, D5).
- `ProjectDossier.tsx`: modyfikator `prj-card--kind-<kind>` na nagłówku teczki (pasek koloru); „Dane z firmy” gdy `companyData` (zamiast `owner === "work"`), z atrybutem `title`: dla `owner: work` „Chronione: owner: work w rejestrze”, w pozostałych „Etykieta z typu Etat; ochronę (Mapa, Notatki, przyszłe AI i eksport) włącza owner: work w rejestrze”. Przełącznik rodzaju bez zmian.
- `useProjects.ts` (mutacja, ok. linii 98–109): przy odświeżaniu elementu listy po zapisie kopiuje także `kind` i `companyData` z odpowiedzi (dziś tylko `status`, `freshness` i `type`); bez tego kolor i znaczniki nie zmienią się po zmianie przełącznika.
- `useContextPack.ts` / `ProjectsView.tsx`: hook dostaje drugi sygnał odświeżenia (`detail?.companyData`) w zależnościach efektu ładującego paczkę, żeby po zmianie typu ostrzeżenie w `warnings` było aktualne bez klikania „Kopiuj”.
- `src/features/home/InboxMoveForm.tsx` (ok. linii 94): znacznik „Dane z firmy” gdy `selected?.companyData` (zamiast `selected?.owner === "work"`).
- `projects.css`: tokeny `--prj-kind-etat` (zielony), `--prj-kind-wlasny` (`var(--accent)`), `--prj-kind-biblioteka` (fioletowy) oraz zmienna `--prj-kind` ustawiana modyfikatorem. Pasek rodzaju na karcie rejestru to `::before` (`position: absolute`, lewa krawędź; `.prj-item` dostaje `position: relative`), żeby nie kolidował z `border-color` i `box-shadow` zaznaczenia ani czerwonej przerywanej ramki „brak zmian >14 dni”. Zaznaczenie (`prj-item--sel`) używa `--prj-kind` zamiast stałego `--accent` (dla własnych bez zmian wyglądu).
- `projectTiles.ts`: liczy po `p.kind` (D7), bez gałęzi „bez typu”.

### 4.3 Błędy i prywatność

Brak nowych tras API, zapisów ani wyjątków domenowych. Zapisy aplikacji dalej idą tylko do `Vault/`, a `Work/` pozostaje zablokowane (`vault-fs`, `workGuard`), bo ten etap go nie dotyka.

## 5. Testy (Vitest)

- **Tabela reguł** (`tests/unit/contexts/bc_projects/`, ten sam zestaw dla `toSummaryDto` i `hasCompanyData`):
  | owner | type | kind | companyData |
  | ----- | ---- | ---- | ----------- |
  | personal | brak | wlasny | false |
  | work | brak | etat | true |
  | personal | etat | etat | true |
  | personal | wlasny | wlasny | false |
  | personal | biblioteka | biblioteka | false |
  | work | wlasny | wlasny | true |
  | work | biblioteka | biblioteka | true |
- `tests/unit/contexts/bc_projects/services.context-pack.test.ts`: `type: etat` z `owner: personal` → `warnings[0] === OWNER_WORK_WARNING`; `type: wlasny` z `personal` → brak; `owner: work` bez `type`, z `type: wlasny` i z `type: biblioteka` → jest.
- `tests/unit/contexts/bc_projects/services.test.ts`: `isWorkProject` zwraca `false` dla `owner: personal` z `type: etat` (D3). Test `listNowTasks` z projektem `owner: work` już istnieje (ok. linii 593) i pokrywa D6, bez duplikatu.
- `tests/unit/features/projects/ProjectsView.test.tsx` (testy listy żyją tu; osobnego `ProjectList.test.tsx` nie ma): klasa `prj-item--kind-etat` i znacznik „Etat”; „Własny”; „Biblioteka”; żółty „Firma” przy `owner: work` niezależnie od rodzaju (w tym `etat` i `biblioteka`) i brak przy `owner: personal` z `type: etat`; istniejąca asercja `getByText("Firma")` (ok. linii 205, `owner: work` bez `type`) zostaje poprawna, bo „Firma” nadal wynika z `owner`, ale musi uwzględniać nowy znacznik „Etat” obok; „Dane z firmy” w teczce dla `type: etat` przy `owner: personal` (z `title` „Etykieta…”) i dla `owner: work` (z `title` „Chronione…”), brak dla własnego; zmiana przełącznika rodzaju (PATCH) odświeża klasę `prj-item--kind-*` w liście, `prj-card--kind-*` w nagłówku i znaczniki bez przeładowania.
- `tests/unit/features/projects/projectTiles.test.ts` (ok. linii 46): oczekiwany podpis liczy po `kind`, bez „bez typu”.
- `tests/unit/features/home/` (okno „Przenieś do…”): „Dane z firmy” dla projektu z `companyData: true`, brak dla `false`.
- `useContextPack`: po zmianie sygnału odświeżenia (`companyData`) paczka ładuje się ponownie (`warnings` aktualne).
- Fixtury: wymagane `kind` i `companyData` w `ProjectSummaryDto` wymuszają aktualizację ręcznych fixtur (`useProjects`, `ProjectsView`, `projectTiles` oraz helperów `ProjectDetailDto` w testach karty).
- Weryfikacja wykonawcy: wizualnie w przeglądarce (kopia vaulta, projekt z `type: etat`, zielony pasek i znacznik), `tsc`, `vitest`, `lint`, `build`.

## 6. Ryzyka

- **Dane firmowe w gicie.** Etap świadomie dopuszcza projekty firmowe w śledzonym rejestrze i w `Projects/`; ochronę przed wyciekiem daje tylko to, że repo jest prywatne. Zasada: do `Projects/<id>/` nie trafiają dane klientów, klucze ani hasła; projekt z takimi danymi czeka na odczyt `Work/` (poza zakresem). Historia gita jest nieodwracalna, więc to decyzja do zapamiętania przy każdym nowym projekcie firmowym.
- **Dwa miejsca z regułą** (D4 i test architektury): ten sam zestaw przypadków pilnuje, żeby się nie rozjechały.
- **`type: etat` nie blokuje** Mapy (D9), filtra notatek (`bc_nexus_docs`) ani przyszłych funkcji AI i eksportu (D3); użytkownik może sądzić, że „Etat” chroni bardziej, niż chroni. Łagodzą to: żółty „Firma” tylko przy `owner: work` (D5) i `title` przy znaczniku „Dane z firmy” w teczce (§4.2), który mówi wprost, że ochronę włącza `owner: work`.
- **Niepełna spójność znaczników** (poza zakresem, §3): grupa kolejki w Kokpicie i „(etat)” w `DeployPanel` dalej reagują tylko na `owner`.

## 7. Po wykonaniu

W `../NEXUS/Vault/Projects/monolith/tasks.md`: odhaczyć etap (PR #NN, data) i dopisać zadania z „Poza zakresem” (§3). Zmiana `tasks.md` w NEXUS za zgodą użytkownika.
