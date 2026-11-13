# Etap 1-4: paczka kontekstu dla agenta

Data: 2026-11-13. Rozwija spec asystenta (`2026-11-11-asystent-lokalny-nexus-design.md`, §6.1, „Paczka kontekstu dla agenta”) i spec 1-1 (D6: mapowanie `local_path` odłożone do 1-4).

## 1. Cel i zakres

Przycisk „Kopiuj paczkę kontekstu” w karcie projektu (Alt+4) jednym kliknięciem składa blok Markdown do wklejenia na start nowej sesji z agentem (Claude Code, Cursor, agy). Agent dostaje stan projektu bez czytania całego vaulta. Przycisk niczego nie zapisuje: czyta vault i repozytorium projektu (tylko odczyt), wynik trafia do schowka.

**Poza zakresem:** szablony per rola (review / implementacja / debug) i podgląd przed skopiowaniem; `owner: work` i ostrzeżenie z §5 (etap 1-5; rejestr nie ma jeszcze pola `owner`); narzędzie MCP `project_git` (tor A, spec `2026-11-12-agent-przez-cli-bez-api-design.md`); jakikolwiek zapis do repozytorium projektu.

## 2. Decyzje

| #   | Decyzja          | Wybór                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Gdzie składamy   | Na serwerze: `GET /api/projects/[id]/context-pack` zwraca gotowy Markdown. Ten sam serwis może później wołać narzędzie MCP z toru A. Odrzucone: składanie w przeglądarce (logika w dwóch miejscach, trudniejszy test budżetu).                                                                                                                                                                                                                                                                                                                                            |
| D2  | `local_path`     | Akceptowane tylko ścieżki WSL: `~/…` (rozwijane przez `os.homedir()`) albo bezwzględne. Po `realpath` ścieżka musi leżeć w katalogu domowym i poza `/mnt/` (obrona przed `~/../../mnt/…` i symlinkami). **Bez** mapowania `E:\` → `/mnt/e/`: kopie na dysku E są nieaktualne, projekty leżą w `~/projects`. `E:\…`, `/mnt/…` i ścieżki spoza domu = „repozytorium niedostępne”. `vault-path.ts` bez zmian (jego mapowanie dotyczy ścieżki vaulta).                                                                                                                        |
| D3  | Poprawka danych  | `local_path` w `NEXUS/Vault/Projects/_registry.yaml` poprawiamy na ścieżki WSL (osobny commit w NEXUS, tabela w §6).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D4  | Zasady projektu  | Pierwsze dostępne źródło: `Projects/<id>/ai-context.md` (vault) → `CLAUDE.md` z katalogu `local_path` (odczyt, limit 64 KB) → wyciąg z `index.md`: sekcje `## Tech Stack`, `## Architektura`, `## Pułapki` (są we wszystkich 7 plikach; do tego nowa funkcja w `repositories`, bo `readProjectIndex` czyta dziś tylko „Gdzie skończyłem”; `parseSections` jest w `repositories/markdown.ts`). Nagłówek sekcji podaje źródło.                                                                                                                                              |
| D5  | Zadania w paczce | Kolumny `Blokery` i `Teraz` bez zadań `done: true` (bloker ważniejszy dla agenta niż „Teraz” samo; spec §6.1 wymieniał tylko „Teraz”). Bugi: wszystkie z `section !== "Zamknięte"`, jak w teczce. „Ostatnia praca” liczy `effectiveLastWorked`; przy świeżości `unknown` etykieta „brak danych”.                                                                                                                                                                                                                                                                          |
| D6  | Budżet           | ok. 4 tys. tokenów, szacunek `znaki / 4` (bez tokenizera). Kroki redukcji, wykonywane po kolei aż paczka mieści się w budżecie: (1) `diff --stat` do 10 linii, (2) `git log` z 5 do 3 commitów, (3) usunięcie `diff --stat`, (4) devlog z 3 do 2, potem do 1 wpisu, (5) zasady cięte po akapicie do minimum 800 znaków, każde cięcie kończy `…`. Save State, Blokery/Teraz i bugi nigdy nie są skracane. `truncated: true` = zastosowano choć jeden krok redukcji; gdy po wszystkich krokach paczka nadal przekracza budżet, dodatkowo ostrzeżenie „paczka ponad budżet”. |
| D7  | Interfejs        | Przycisk kopiuje do schowka i pokazuje komunikat inline (wzorzec `prj-alert`, jak w `ProjectSaveState`; w projekcie nie ma tostów): „skopiowano, ~N tys. tokenów” oraz ostrzeżenia. Wywołanie `GET /context-pack` poza `mutate` z `useProjects` (to odczyt). Bez podglądu.                                                                                                                                                                                                                                                                                                |

## 3. Architektura (ADR-021)

- `lib/git/` (nowy katalog infrastruktury, nie importuje `lib/nexus/`; R5). Cała fizyczna obsługa plików i procesów leży tu, bo test architektury zabrania `node:fs` i `process.env` w `contexts/*/repositories*` (część C, „warstwa plikowa”):
  - `resolveRepoPath(localPath)`: rozwija `~`, odrzuca `E:\…`, `/mnt/…`, ścieżki względne; `realpath` musi leżeć w `os.homedir()` i poza `/mnt/`; wymaga, by `localPath/.git` istniało bezpośrednio (katalog albo plik worktree), inaczej `not-a-repo` (git nie szuka repo w katalogach nadrzędnych); `GIT_CEILING_DIRECTORIES` ustawione na katalog nadrzędny.
  - `project-git.ts`: `execFile` (bez powłoki), biała lista trzech wywołań: `git status --short --branch`, `git log -5 --oneline`, `git diff --stat`. Każde z `--no-pager` i `-c core.fsmonitor=false -c core.hooksPath=/dev/null` (`diff` dodatkowo `--no-ext-diff`), żeby konfiguracja obcego repo nie wykonywała kodu. Limit czasu 5 s, limit rozmiaru wyjścia, `GIT_OPTIONAL_LOCKS=0` (odczyt nie zostawia blokad). Wzorzec: `lib/workGuard.ts`. Argumenty nie pochodzą od użytkownika; katalog pochodzi wyłącznie z rejestru.
  - `repo-file.ts`: `readRepoFile(localPath, "CLAUDE.md")`: `lstat` (zwykły plik, nie symlink), `realpath` wewnątrz repo, limit 64 KB; brak pliku zwraca `null`.
- `contexts/bc_projects/repositories`: `readGitSnapshot(entry)` i `readRepoRules(entry)` tylko delegują do `lib/git/` (bez `fs`, bez `process.env`); `readAiContext(entry)` i `readIndexRules(entry)` (sekcje `index.md`) czytają vault przez `lib/nexus`.
- `contexts/bc_projects/services`: `buildContextPack(id)`, składanie sekcji i budżet (funkcje czyste, łatwe do testu).
- `contexts/bc_projects/router` + `schemas`: handler i `ContextPackDto { markdown, approxTokens, truncated, warnings }`.
- `app/api/projects/[id]/context-pack/route.ts`: tylko re-eksport handlera.
- UI: przycisk w `src/features/projects/ProjectDossier.tsx` (importuje wyłącznie `schemas`).
- Test architektury nie jest zmieniany. Jeśli pęknie (np. przez `child_process` w `lib/git/`), naprawiamy kodem; ewentualną zmianę testu zgłaszamy osobno i robimy osobnym commitem.

## 4. Format wyniku

Kolejność stała, puste sekcje pomijane:

```markdown
# Kontekst projektu: <name>

Status: <status> · priorytet: <priority> · ostatnia praca: <last_worked> (<świeży|nieświeży>)

## Zasady projektu (źródło: CLAUDE.md)

## Save State

Branch: … · Bloker: … · Następny krok: …

## Kod (git)

Branch/status · ostatnie commity · zmiany (diff --stat)

## Zadania

Blokery / Teraz

## Bugi (otwarte)

- [P1] …

## Devlog (ostatnie 3)

- 2026-11-13: …
```

## 5. Błędy i ostrzeżenia

Paczka nie wywala się przez brak jednego źródła; `warnings` trafiają do DTO i do komunikatu w UI.

| Sytuacja                                               | Efekt                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| nieznany `id`                                          | 404 (`NotFoundError`)                                                                       |
| `local_path` pusty, `E:\…`, `/mnt/…` lub spoza domu    | „Kod” = „repozytorium niedostępne (ścieżka spoza WSL)”, bez `CLAUDE.md` z repo, ostrzeżenie |
| katalog nie istnieje lub nie jest repo git             | to samo, z przyczyną                                                                        |
| git zwraca błąd lub przekracza limit czasu             | sekcja „Kod” z adnotacją, reszta działa                                                     |
| brak `state.md` / `devlog.md` / `ai-context.md`        | sekcja pominięta, bez ostrzeżenia (pliki opcjonalne; dziś żaden projekt ich nie ma)         |
| `CLAUDE.md` jest symlinkiem, ponad 64 KB lub poza repo | pominięty, dalej zasady z `index.md`, ostrzeżenie                                           |
| zastosowano krok redukcji z D6                         | `truncated: true`                                                                           |
| po wszystkich krokach nadal ponad budżet               | dodatkowo ostrzeżenie „paczka ponad budżet”, nie błąd                                       |
| `git diff --stat` ponad 40 linii                       | obcięcie do 40 + „… i N więcej plików”                                                      |

## 6. Poprawka rejestru (NEXUS, osobny commit)

| id            | docelowy `local_path`                         |
| ------------- | --------------------------------------------- |
| nexus         | `~/projects/Brain_7224/NEXUS`                 |
| english-agent | `~/projects/English-agent`                    |
| monolith      | `~/projects/Brain_7224/Monolith` (bez zmiany) |
| tester-ai     | `~/projects/crait/projects/TesterAI`          |
| gen-podsum-ai | `~/projects/Gen_Podsum_AI`                    |
| portfolio     | `~/projects/Portfolio`                        |
| code-sensei   | `~/projects/Code_sensei/Code_sensei_v15`      |

`Projects/<id>/index.md` ma własne pole `local_path` w frontmatterze (linia 6); sześć plików ma jeszcze `E:\…` (nexus, english-agent, tester-ai, gen-podsum-ai, portfolio, code-sensei): poprawić razem z rejestrem, na te same wartości; `monolith/index.md` jest już poprawny. `~/projects/crait/projects/TesterAI-pr161` (osobny checkout) jest pomijany.

## 7. Testy (TDD)

1. `lib/git/` (tymczasowe repo w katalogu tymczasowym pod `os.homedir()` albo z podstawionym korzeniem w teście; `/tmp` jest poza domem, więc `resolveRepoPath` dostaje wstrzykiwany „dozwolony korzeń”): czyste repo → `status` = `## main` bez zmian; jeden zmodyfikowany plik → `diff --stat` zawiera jego nazwę; 7 commitów → `log` zwraca dokładnie 5; katalog bez `.git` (nawet gdy nadrzędny katalog jest repo) → `{ ok: false, reason: "not-a-repo" }`; `~/../../mnt/c/x` i symlink do `/mnt/…` → odrzucone; `E:\x` → odrzucone; repo z `core.fsmonitor` ustawionym na skrypt nie wykonuje go (skrypt nie tworzy pliku-znacznika); wywołanie spoza białej listy → wyjątek; `readRepoFile`: symlink `CLAUDE.md` → `null`, plik 65 KB → `null`, zwykły plik → treść.
2. `services.buildContextPack`: ścieżka `E:\x` → sekcja „Kod” zawiera „niedostępne”, `warnings` niepuste, pozostałe sekcje obecne; źródło zasad: `ai-context.md` wygrywa z `CLAUDE.md`, ten z `index.md`; projekt bez zasad i bez gita nadal zawiera Save State; zadania `done: true` nie trafiają do paczki; brak `state.md`/`devlog.md` nie daje ostrzeżenia; budżet: devlog z 50 wpisami → w wyniku 3 wpisy, a po wymuszeniu małego budżetu kolejno 2 i 1 (kroki z D6 w ustalonej kolejności), `approxTokens` ≤ budżet, Save State, Blokery/Teraz i bugi bez zmian; `truncated` tylko gdy zastosowano krok redukcji; po wyczerpaniu kroków i nadal ponad budżet → ostrzeżenie „paczka ponad budżet”.
3. `router`: 200 z `ContextPackDto`, 404 dla nieznanego `id`.
4. UI (RTL, wzorzec w `tests/unit/features/projects/`; `navigator.clipboard` nie jest dziś nigdzie mockowany, więc test sam go stubuje): kliknięcie woła `GET /context-pack`, potem `navigator.clipboard.writeText(markdown)` i pokazuje liczbę tokenów oraz ostrzeżenia; błąd HTTP → komunikat błędu, schowek nietknięty.
5. Ręcznie po implementacji: Monolith (pełna paczka z gitem), `tester-ai` (po poprawie ścieżki), projekt z celowo zepsutym `local_path`.
