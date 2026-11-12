# Zarządzanie aplikacją przez agentów CLI zamiast modeli po API — projekt

Data: 2026-11-12
Status: szkic do przeglądu (brainstorm zakończony, bez implementacji)
Powiązane: `2026-11-11-asystent-lokalny-nexus-design.md` (§4, §5, §7, §8), `2026-11-12-etap-0-odpiecie-firebase-design.md`

## 1. Cel i decyzje

Aplikacja (Monolith) nie łączy się z żadnym modelem po kluczu API i nie uruchamia procesów agentów. Uzupełnianie postępów, nadzór nad kalendarzem, bazą wiedzy i vaultem prowadzi dowolny agent CLI (Claude Code na subskrypcji, Cursor, agy) w zwykłym terminalu, poza aplikacją. Agent zbiera informacje także z innych aplikacji właściciela (kod i git projektów, tylko odczyt).

| #   | Decyzja              | Wybór                                                                                                                                                                                                                        |
| --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Kanał do agentów     | Kolejka zleceń w plikach vaulta plus serwer MCP nad `lib/nexus/` (opcje B + C)                                                                                                                                               |
| G2  | Terminal w aplikacji | Nie. Odrzucone: powłoka dostępna z przeglądarki, osobny serwer WebSocket, `node-pty` w WSL, niepewny regulamin subskrypcji CLI. Może wrócić jako nakładka, gdy kolejka i MCP działają                                        |
| G3  | Modele po API        | Usunięte z aplikacji: Gemini (`lib/gemini.ts`, `services/mindMapAIService.ts`, `GEMINI_API_KEY`) i agent Ollama (`app/api/agent/*`, `lib/ollama.ts`, `services/agentService.ts`, `lib/agent/*`, `lib/firestore/agentLog.ts`) |
| G4  | Dane `owner: work`   | Blokada: MCP nie czyta ani nie zapisuje `Vault/Work/` i odmawia zleceń `owner: work`; UI nie tworzy ich (przycisk wyszarzony). Dotyczy wszystkich funkcji AI, nie tylko Gemini                                               |
| G5  | Odświeżanie UI       | Odpytywanie `version` przy fokusie okna i zmianie karty. Bez file watchera (`inotify` na `/mnt/e/` w WSL gubi zmiany)                                                                                                        |

Opinie pomocników (`agy`, `cursor`, niezależnie) zgodne co do B + C i odrzucenia A na starcie. Zastrzeżenie dotyczące regulaminu Claude Code CLI w `node-pty` jest niezweryfikowaną hipotezą.

## 2. Architektura

```
UI (przycisk "Uzupełnij postępy")
   └─> /api/nexus/jobs ──> lib/nexus/ ──> Vault/Agent/queue/<id>.md  (status: pending)
                                                      ▲        │
   Claude Code / Cursor / agy w terminalu ── MCP (tools/nexus-mcp) ─┘
        claim_job → praca (git projektów tylko do odczytu) → zapis wyników w vaulcie → complete_job
   UI: polling `version` przy fokusie / zmianie karty
```

Przepływ danych jest ten sam co w specu asystenta (§4.1): `Vault <-> lib/nexus/ <-> API <-> UI`. Dochodzi drugi klient `lib/nexus/`: serwer MCP.

### 2.1 Zlecenie (`Vault/Agent/queue/<id>.md`)

Frontmatter:

| Pole                                    | Znaczenie                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `id`                                    | stabilny identyfikator (nazwa pliku to `<id>.md`)                           |
| `type`                                  | `progress-update`, `weekly-review`, `context-pack`, `mindmap`, rozszerzalne |
| `project`                               | id projektu z rejestru (opcjonalne dla zleceń ogólnych)                     |
| `owner`                                 | `personal` (dla `work` zlecenie nie powstaje)                               |
| `status`                                | `pending → claimed → done` albo `failed`                                    |
| `version`                               | liczba całkowita, +1 przy każdej zmianie pliku                              |
| `created`, `claimed_at`, `heartbeat_at` | znaczniki ISO                                                               |
| `claimed_by`                            | nazwa agenta (`claude-code`, `cursor`, `agy`)                               |
| `result_paths`                          | ścieżki w vaulcie zmienione lub utworzone przez agenta                      |

Treść: polecenie dla agenta i parametry (Markdown). Sekcja `## Wynik` jest wypełniana przez agenta (krótkie podsumowanie, błąd przy `failed`).

Zasady:

- Przejścia statusu to zapis atomowy (plik tymczasowy plus `rename`) z kontrolą `version`. Przy rozbieżności `ConflictError` (409); agent ponawia.
- Zlecenie `claimed` bez `heartbeat_at` przez `JOB_STALE_MINUTES` (domyślnie 30, konfigurowalne) wraca do `pending` przy następnym `list_jobs`.
- Zleceń nie usuwa się automatycznie. Zlecenia `done` starsze niż 30 dni może archiwizować osobna akcja (poza zakresem pierwszego etapu).

### 2.2 Serwer MCP (`tools/nexus-mcp/`)

Osobny proces stdio, używa tego samego kodu `lib/nexus/`. Narzędzia pierwszej wersji:

| Narzędzie                  | Działanie                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `list_jobs`                | zlecenia wg statusu; przejmuje przeterminowane `claimed`                           |
| `claim_job`                | `pending → claimed` z kontrolą `version`; odmowa dla `owner: work`                 |
| `heartbeat_job`            | odświeża `heartbeat_at`                                                            |
| `complete_job`             | `claimed → done` lub `failed`, zapis `## Wynik` i `result_paths`                   |
| `vault_read`, `vault_list` | odczyt w `Vault/` z wyjątkiem `Work/`                                              |
| `vault_write`              | zapis w `Vault/` (poza `Work/`) z kontrolą wersji pliku, punktowy gdzie to możliwe |
| `project_git`              | `log`, `status`, `diff --stat`, `show --stat` w `local_path` projektu `personal`   |

Rejestracja serwera w konfiguracji CLI (np. `.mcp.json`) opisana w dokumentacji etapu A-3.

### 2.3 UI

- Przyciski AI (mapy myśli, plan, przegląd tygodnia, aktualizacja postępów) tworzą zlecenie zamiast wołać model.
- Panel zleceń: lista ze statusem, czasem i podglądem `## Wynik`.
- Obok zlecenia przycisk „kopiuj paczkę kontekstu" (spec asystenta §6.1), dla agenta uruchomionego ręcznie.
- Po `done` widok odświeża dane projektu przy najbliższym fokusie okna.

## 3. Granice bezpieczeństwa

- **Zapis** tylko w `Vault/`, po `realpath` (bez ucieczki przez `..` i symlinki), nigdy w `Vault/Work/`.
- **Odczyt** `Vault/` bez `Work/`. Repozytoria projektów wyłącznie przez białą listę komend gita, w katalogu z `local_path` rejestru, tylko `owner: personal`. Żadnej dowolnej powłoki.
- **Projekty `owner: work`:** UI nie tworzy zleceń (przycisk wyszarzony z wyjaśnieniem), `claim_job` odmawia. Spec asystenta §5 zostaje poprawiony: funkcje AI dla `owner: work` są wyszarzone w ogóle.
- **Ograniczenie:** blokada działa tylko dla agentów korzystających z MCP. Agent z własnym dostępem do powłoki może przeczytać `Vault/Work/` bezpośrednio. Dlatego etap A-5 dodaje regułę w `CLAUDE.md` NEXUS i, jeśli CLI to wspiera, odmowę odczytu `Vault/Work/` w uprawnieniach agenta.
- **Brak `NEXUS_VAULT_PATH`:** błąd konfiguracji, bez trybu częściowego (jak dotąd).

## 4. Błędy i współbieżność

- Równoczesna zmiana pliku przez UI i agenta: `ConflictError` → HTTP 409. UI pokazuje „zmieniono w międzyczasie", agent ponawia po ponownym odczycie.
- Agent kończący błędem ustawia `failed` z opisem w `## Wynik`.
- Zlecenie z nieznanym `type` pozostaje `pending`; agent może je przejąć i opisać w wyniku, czego brakuje.

## 5. Testy (TDD)

- Strażnik ścieżek: `..`, symlink, `Work/`, ścieżka bezwzględna poza vaultem.
- Maszyna stanów zlecenia: `pending → claimed → done|failed`, podwójny `claim`, przejęcie po przekroczeniu `JOB_STALE_MINUTES`, konflikt `version`.
- Narzędzia MCP wywoływane w procesie (bez uruchamiania serwera), w tym odmowa dla `owner: work` i komenda gita spoza listy.
- Test statyczny: w aplikacji brak importów `@google/genai`, `ollama` i odczytu `*_API_KEY` (wzór: `tests/unit/lib/nexus/static.test.ts`).
- UI: przycisk AI tworzy zlecenie; dla projektu `work` jest nieaktywny.

## 6. Etapy wdrożenia

Każdy etap dostaje osobny plan i wdrożenie.

| Etap | Zakres                                                                                                                                                                                                                                                                                                                                     | Zależności                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| A-1  | Usunięcie AI po API: `lib/gemini.ts`, `services/mindMapAIService.ts`, `services/planService.ts` (wywołanie modelu), agent Ollama i `lib/firestore/agentLog.ts`, `GEMINI_API_KEY`; trasy `app/api/mind-maps/import`, `app/api/mind-maps/ai-node`, `app/api/plan/ask`, `app/api/agent/*` wyłączone lub przepięte na zaślepkę; test statyczny | brak; wykonać **przed 0c-3**, bo `agentLog` znika zamiast być migrowany |
| A-2  | Strażnik ścieżek (`lib/nexus/guard.ts`), repozytorium zleceń i maszyna stanów, API `/api/nexus/jobs`, testy                                                                                                                                                                                                                                | 0c-1                                                                    |
| A-3  | Serwer MCP `tools/nexus-mcp/`: narzędzia z §2.2, biała lista gita, rejestracja w konfiguracji CLI, dokumentacja uruchomienia                                                                                                                                                                                                               | A-2                                                                     |
| A-4  | UI: przyciski tworzące zlecenia, panel zleceń, polling `version` przy fokusie, paczka kontekstu do skopiowania                                                                                                                                                                                                                             | A-2                                                                     |
| A-5  | Reguły dla agentów: `CLAUDE.md` NEXUS (zakaz `Vault/Work/`, protokół zleceń), poprawka §5 i §8 specu asystenta, uprawnienia odmowy dla `Vault/Work/`                                                                                                                                                                                       | A-3                                                                     |

Kolejność proponowana: A-1 → 0c-3 → A-2 → A-3 → A-4 → A-5. A-2…A-5 nie wymagają zmigrowanych zadań ani kalendarza, więc mogą też iść równolegle z kolejnymi podetapami 0c.

## 7. Poza zakresem

Terminal w aplikacji, file watcher, odczyt stanu paneli Herdr (spec asystenta §8), automatyczna archiwizacja zleceń, tryb wielu użytkowników.

## 8. Otwarte pytania

- Czy `claude` CLI pozwala ograniczyć odczyt `Vault/Work/` w uprawnieniach (do sprawdzenia w A-5 w dokumentacji narzędzia).
- Dokładna lista `type` zleceń i szablonów poleceń: ustalana per przycisk w A-4.
