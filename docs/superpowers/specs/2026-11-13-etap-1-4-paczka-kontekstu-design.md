# Etap 1-4: paczka kontekstu dla agenta

Data: 2026-11-13. Rozwija spec asystenta (`2026-11-11-asystent-lokalny-nexus-design.md`, §6.1, „Paczka kontekstu dla agenta”) i spec 1-1 (D6: mapowanie `local_path` odłożone do 1-4).

## 1. Cel i zakres

Przycisk „Kopiuj paczkę kontekstu” w karcie projektu (Alt+4) jednym kliknięciem składa blok Markdown do wklejenia na start nowej sesji z agentem (Claude Code, Cursor, agy). Agent dostaje stan projektu bez czytania całego vaulta. Przycisk niczego nie zapisuje: czyta vault i repozytorium projektu (tylko odczyt), wynik trafia do schowka.

**Poza zakresem:** szablony per rola (review / implementacja / debug) i podgląd przed skopiowaniem; `owner: work` i ostrzeżenie z §5 (etap 1-5; rejestr nie ma jeszcze pola `owner`); narzędzie MCP `project_git` (tor A, spec `2026-11-12-agent-przez-cli-bez-api-design.md`); jakikolwiek zapis do repozytorium projektu.

## 2. Decyzje

| #   | Decyzja          | Wybór                                                                                                                                                                                                                                                                                     |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Gdzie składamy   | Na serwerze: `GET /api/projects/[id]/context-pack` zwraca gotowy Markdown. Ten sam serwis może później wołać narzędzie MCP z toru A. Odrzucone: składanie w przeglądarce (logika w dwóch miejscach, trudniejszy test budżetu).                                                            |
| D2  | `local_path`     | Akceptowane tylko ścieżki WSL (`~/…` i bezwzględne spoza `/mnt/`). **Bez** mapowania `E:\` → `/mnt/e/`: kopie na dysku E są nieaktualne, projekty leżą w `~/projects`. `E:\…` i `/mnt/…` = „repozytorium niedostępne”. `vault-path.ts` bez zmian (jego mapowanie dotyczy ścieżki vaulta). |
| D3  | Poprawka danych  | `local_path` w `NEXUS/Vault/Projects/_registry.yaml` poprawiamy na ścieżki WSL (osobny commit w NEXUS, tabela w §6).                                                                                                                                                                      |
| D4  | Zasady projektu  | Pierwsze dostępne źródło: `Projects/<id>/ai-context.md` (vault) → `CLAUDE.md` z katalogu `local_path` (odczyt) → wyciąg z `index.md` (Tech Stack, Architektura, Pułapki). Nagłówek sekcji podaje źródło.                                                                                  |
| D5  | Zadania w paczce | Kolumny `Blokery` i `Teraz` (bloker ważniejszy dla agenta niż „Teraz” samo; spec §6.1 wymieniał tylko „Teraz”). Bugi: wszystkie z `section !== "Zamknięte"`, jak w teczce.                                                                                                                |
| D6  | Budżet           | ok. 4 tys. tokenów, szacunek `znaki / 4` (bez tokenizera). Skracanie w kolejności: git → devlog (z 3 do 2 wpisów) → zasady (cięcie po akapicie, `…`). Save State, Blokery/Teraz i bugi nigdy nie są skracane.                                                                             |
| D7  | Interfejs        | Przycisk kopiuje do schowka i pokazuje „skopiowano, ~N tys. tokenów” oraz ostrzeżenia. Bez podglądu.                                                                                                                                                                                      |

## 3. Architektura (ADR-021)

- `lib/git/project-git.ts`: nowy adapter infrastruktury. `execFile` (bez powłoki), biała lista trzech wywołań: `git status --short --branch`, `git log -5 --oneline`, `git diff --stat`. Limit czasu 5 s, limit rozmiaru wyjścia, `GIT_OPTIONAL_LOCKS=0` (odczyt nie zostawia blokad). Wzorzec: `lib/workGuard.ts`. Argumenty nie pochodzą od użytkownika; katalog pochodzi wyłącznie z rejestru.
- `contexts/bc_projects/repositories`: `readGitSnapshot(localPath)` (woła adapter) i `readRepoRules(localPath)` (odczyt `CLAUDE.md` z repo, odmowa dla ścieżek spoza WSL).
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

| Sytuacja                                   | Efekt                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| nieznany `id`                              | 404 (`NotFoundError`)                                                                       |
| `local_path` pusty, `E:\…` lub `/mnt/…`    | „Kod” = „repozytorium niedostępne (ścieżka spoza WSL)”, bez `CLAUDE.md` z repo, ostrzeżenie |
| katalog nie istnieje lub nie jest repo git | to samo, z przyczyną                                                                        |
| git zwraca błąd lub przekracza limit czasu | sekcja „Kod” z adnotacją, reszta działa                                                     |
| brak `state.md` / `devlog.md`              | sekcja pominięta, ostrzeżenie                                                               |
| po skróceniu nadal ponad budżet            | `truncated: true` + ostrzeżenie, nie błąd                                                   |
| `git diff --stat` ponad 40 linii           | obcięcie do 40 + „… i N więcej plików”                                                      |

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

`Gen_Podsum_AI/index.md` w vaulcie ma własne pole `local_path` w frontmatterze (`E:\…`): poprawić razem z rejestrem. `~/projects/crait/projects/TesterAI-pr161` (osobny checkout) jest pomijany.

## 7. Testy (TDD)

1. `lib/git/project-git` (tymczasowe repo w katalogu tymczasowym): czyste repo → `status` = `## main` bez zmian; jeden zmodyfikowany plik → `diff --stat` zawiera jego nazwę; 7 commitów → `log` zwraca dokładnie 5; katalog bez `.git` → `{ ok: false, reason: "not-a-repo" }`; wywołanie spoza białej listy → wyjątek.
2. `services.buildContextPack`: ścieżka `E:\x` → sekcja „Kod” zawiera „niedostępne”, `warnings` niepuste, pozostałe sekcje obecne; źródło zasad: `ai-context.md` wygrywa z `CLAUDE.md`, ten z `index.md`; projekt bez zasad i bez gita nadal zawiera Save State; budżet: devlog z 50 wpisami → w wyniku 3 wpisy (2 po skróceniu), `approxTokens ≤ 4000`, Save State, Blokery/Teraz i bugi bez zmian; `truncated` tylko przy realnym obcięciu.
3. `router`: 200 z `ContextPackDto`, 404 dla nieznanego `id`.
4. UI: kliknięcie woła `navigator.clipboard.writeText(markdown)` i pokazuje liczbę tokenów (jeśli projekt ma wzorzec testów komponentów; inaczej weryfikacja ręczna).
5. Ręcznie po implementacji: Monolith (pełna paczka z gitem), `tester-ai` (po poprawie ścieżki), projekt z celowo zepsutym `local_path`.
