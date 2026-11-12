# Etap A-1: usunięcie AI po API — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** Aplikacja nie zawiera żadnego kodu, zależności ani zmiennych środowiskowych do modeli po API (Gemini, Ollama). Funkcje UI, które z nich korzystały, znikają. Test statyczny pilnuje, żeby to nie wróciło.

**Architektura:** Najpierw test statyczny (czerwony), potem usuwamy od strony UI (czat w Planowaniu, akcje AI w mapach myśli), dopiero potem backend (trasy, serwisy, `lib/`), zależności i dokumentację. Dzięki tej kolejności każdy commit się kompiluje. Zastępnik funkcji AI (zlecenia dla agentów CLI) powstaje w etapach A-2…A-4 (spec `2026-11-12-agent-przez-cli-bez-api-design.md`).

**Stack:** Next.js 14, TypeScript, Vitest, ESLint, Prettier (lint-staged w hooku commita).

**Zasady wykonania (CLAUDE.md):** testy, `tsc`, lint i build zleca się `cursor` (`scripts/ask-helper.sh --role task`/`advice`, prośba o „przeszło" albo listę `plik:linia + przyczyna`). Task 3 (mechaniczne edycje w wielu plikach) można zlecić `cursor --role task`, po czym sprawdzić `git diff --stat` i testy. Review końcowy: `agy` (`--role review`).

**Poza zakresem:** klucze tłumaczeń (`src/translations.ts`) zostają bez zmian, bo A-4 użyje ich ponownie dla przycisków tworzących zlecenia. Nie ruszamy `lib/dateRef.ts` ani `services/tagService.ts`, nawet jeśli część funkcji stanie się nieużywana.

---

## Mapa plików

**Usuwane**

- Trasy: `app/api/agent/` (chat, confirm, status), `app/api/plan/ask/`, `app/api/mind-maps/ai-node/`, `app/api/mind-maps/import/`
- Serwisy: `services/agentService.ts`, `services/planService.ts`, `services/mindMapAIService.ts`, `services/agent/` (calendarTools, mindMapTools, overviewTools, taskTools, index)
- Biblioteki: `lib/gemini.ts`, `lib/ollama.ts`, `lib/agent/` (tools, types), `lib/firestore/agentLog.ts`
- UI: `src/components/AgentPendingActions.tsx`, `src/features/mind-maps/MindMapAIModal.tsx`, `MindMapAIImportTreeModal.tsx`, `MindMapImportModal.tsx`
- Testy: `tests/unit/api/agent.test.ts`, `tests/unit/lib/{agentTools,gemini,ollama}.test.ts`, `tests/unit/services/{agentService,planService,mindMapAIService}.test.ts`, `tests/unit/services/agent/`, `tests/unit/components/AgentPendingActions.test.tsx`

**Modyfikowane**

- `src/features/planowanie/PlanowanieView.tsx` (bez paska czatu i stanów agenta)
- `src/features/mind-maps/{MindMapEditor,MindMapTree,TreeLevel,NodePill,MindMapList,MindMapsTab}.tsx`
- `tests/unit/features/mind-maps/MindMapTree.labelEdit.test.tsx`
- `lib/firestore-db.ts` (eksport `addAgentLogEntry`), `lib/firestore/collections.ts` (`agentLogCol`)
- `package.json`, `package-lock.json` (`@google/genai`), `.env.example`, `README.md`, `tests/integration/README.md`, `tests/integration/setup.ts` (komentarz)

**Nowe**

- `tests/unit/no-model-api.static.test.ts`

---

### Task 0: Gałąź

- [ ] **Krok 1: Utwórz gałąź wykonawczą** z gałęzi, która zawiera spec i ten plan (`docs/agent-cli-kolejka-spec`), albo z `main`, jeśli ta gałąź została już zmergowana.

```bash
git checkout docs/agent-cli-kolejka-spec   # lub: git checkout main && git pull --ff-only
git checkout -b feat/etap-a1-usuniecie-ai-po-api
```

---

### Task 1: Test statyczny (czerwony)

**Pliki:** Create `tests/unit/no-model-api.static.test.ts`

- [ ] **Krok 1: Napisz test**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "src", "services", "lib", "scripts"];
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

// Klucze, SDK, trasy i moduły modeli po API. Wzorzec jest celowo szeroki.
const FORBIDDEN =
  /@google\/genai|GoogleGenAI|GEMINI_API_KEY|OLLAMA_|ollama|\/api\/agent|\/api\/plan\/ask|mind-maps\/(?:ai-node|import)|lib\/gemini|services\/(?:agentService|planService|mindMapAIService)/i;

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(rel, out);
    } else if (SOURCE_EXT.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap((d) => walk(d));

describe("no model APIs in the app", () => {
  it("scans a realistic number of source files", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("has no source file referencing a model API, SDK, key or AI route", () => {
    const hits: string[] = [];
    for (const rel of FILES) {
      const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n");
      lines.forEach((line, i) => {
        const m = line.match(FORBIDDEN);
        if (m) hits.push(`${rel}:${i + 1} (${m[0]})`);
      });
    }
    expect(hits).toEqual([]);
  });

  it("does not depend on @google/genai", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).filter((n) => /genai|ollama|openai|anthropic/i.test(n))).toEqual([]);
  });

  it(".env.example mentions no model keys", () => {
    const env = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
    expect(env).not.toMatch(/GEMINI|OLLAMA|OPENAI|ANTHROPIC/i);
  });
});
```

- [ ] **Krok 2: Uruchom i potwierdź czerwony wynik**

Run: `npx vitest run tests/unit/no-model-api.static.test.ts`
Oczekiwane: pierwszy test PASS, trzy pozostałe FAIL. Lista trafień w drugim teście obejmuje m.in. `lib/gemini.ts`, `lib/ollama.ts`, `services/agentService.ts`, `src/features/planowanie/PlanowanieView.tsx` i `src/features/mind-maps/MindMapAIModal.tsx`.

- [ ] **Krok 3: Commit** (czerwony do Tasku 5; hook commita uruchamia tylko Prettiera, nie testy)

```bash
git add tests/unit/no-model-api.static.test.ts
git commit -m "test: static guard against model APIs in the app (red until A-1 is done)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Planowanie bez czatu AI

**Pliki:** Modify `src/features/planowanie/PlanowanieView.tsx`; Delete `src/components/AgentPendingActions.tsx`, `tests/unit/components/AgentPendingActions.test.tsx`

Czat u dołu widoku (pole „Plan AI", lista wiadomości, akcje agenta) wywołuje wyłącznie `/api/agent/*` i `/api/plan/ask`. Usuwamy go w całości. Kalendarz, zadania, notatki, zasoby, mapy i tablica zostają bez zmian.

- [ ] **Krok 1: Usuń importy** w `PlanowanieView.tsx`: `import { Send, Loader2 } from "lucide-react";`, `import { cn } from "@/src/lib/cn";` oraz blok `import { AgentPendingActions, type PendingAgentAction } from "@/src/components/AgentPendingActions";` (wielowierszowy, linie 20–23).

- [ ] **Krok 2: Usuń funkcję** `planAskResponseText` (linie 46–59, wraz z pustą linią za nią).

- [ ] **Krok 3: Usuń stany** `planAskInput`, `messages`, `planAskLoading`, `planAskPendingMessage`, `planAskUnknownTags`, `agentEnabled`, `agentPending`, `dataRefreshKey`. Zostają m.in. `calendarRefreshKey`, `userTags`, `activeSession`, `sessionEndError`, `selectedNote`, `noteEditMode`.

- [ ] **Krok 4: Usuń efekt** pobierający `/api/agent/status` (blok `useEffect` z `let cancelled = false;` i `apiFetch("/api/agent/status")`).

- [ ] **Krok 5: Usuń funkcje** `applyAgentChanges`, `handlePlanAsk`, `handleAgentConfirm`, `handleAgentCancel`, `handlePlanAskAddTagAndRetry`. Zostaje `handleSelectTab` (leży tuż przed `applyAgentChanges`).

- [ ] **Krok 6: Usuń propsy `key`** zależne od usuniętego stanu: `key={`maps-${dataRefreshKey}`}` w `<MindMapsTab …>` i `key={`tasks-${dataRefreshKey}`}` w `<TasksSection …>`.

- [ ] **Krok 7: Usuń pasek czatu**: cały blok `<div className="flex-shrink-0 p-4 bg-[var(--surface)] border-t border-[var(--border)]"> … </div>` przed `</main>` (od listy `messages`, przez `AgentPendingActions` i przycisk „Dodaj tag", po pole wejściowe i przycisk wysyłania).

- [ ] **Krok 8: Usuń pliki komponentu**

```bash
git rm src/components/AgentPendingActions.tsx tests/unit/components/AgentPendingActions.test.tsx
```

- [ ] **Krok 9: Sprawdź e2e** pod kątem usuniętych elementów

Run: `grep -rn "planAsk\|Plan AI\|api/plan\|api/agent\|mind-maps/import\|ai-node" tests/e2e`
Oczekiwane: brak trafień. Jeśli są, usuń lub zaktualizuj odpowiednie kroki testu.

- [ ] **Krok 10: Typecheck i lint tej zmiany** (zleć `cursor`): `npx tsc --noEmit` i `npx eslint src/features/planowanie`. Oczekiwane: brak błędów. Nieużywane importy usuń (np. jeśli `useCallback` albo `useState` przestały być potrzebne; po tym kroku nadal są używane).

- [ ] **Krok 11: Commit**

```bash
git add -A src/features/planowanie src/components tests/unit/components
git commit -m "refactor(planowanie): remove AI chat bar and agent state" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Mapy myśli bez akcji AI i importu

**Pliki:** Modify `MindMapEditor.tsx`, `MindMapTree.tsx`, `TreeLevel.tsx`, `NodePill.tsx`, `MindMapList.tsx`, `MindMapsTab.tsx`, `tests/unit/features/mind-maps/MindMapTree.labelEdit.test.tsx` (wszystkie pliki źródłowe w `src/features/mind-maps/`); Delete `MindMapAIModal.tsx`, `MindMapAIImportTreeModal.tsx`, `MindMapImportModal.tsx`

Wszystkie trzy modale wołają usuwane trasy (`/api/mind-maps/ai-node`, `/api/mind-maps/import`). Zwykłe dodawanie węzłów, notatki, eksport HTML, eksport poddrzewa do innej mapy i przeciąganie zostają.

- [ ] **Krok 1: Test najpierw (kontrakt propsów).** W `tests/unit/features/mind-maps/MindMapTree.labelEdit.test.tsx` usuń cztery linie: dwa razy `onAddChildAIImport={() => {}}` i dwa razy `onOpenAI={() => {}}` (linie 44, 47, 91, 94). Run: `npx tsc --noEmit`. Oczekiwane: błędy w obu użyciach `<MindMapTree>` w tym teście (brak wymaganych propsów `onAddChildAIImport` i `onOpenAI`). Znikną po Krokach 2–3, gdy propsy zostaną usunięte z typów.

- [ ] **Krok 2: `NodePill.tsx`.** Usuń z destrukturyzacji i z typu propsów `onAddChildAIImport` i `onOpenAI`. W menu kontekstowym usuń dwa przyciski: ten z `onAddChildAIImport(node.id)` (etykieta `t.mindMapsAIImportTreeAdd`) i ten z `onOpenAI(node.id)` (etykieta `t.mindMapsAIAddTitle`). Przycisk „Dodaj dziecko" (`onAddChild`) zostaje. Usuń `Sparkles` z importu `lucide-react` (po usunięciu obu przycisków nie jest używany).

- [ ] **Krok 3: `TreeLevel.tsx` i `MindMapTree.tsx`.** W typach propsów usuń `onAddChildAIImport` (wraz z komentarzem JSDoc „Add a subtree generated by the "import" AI flow.") i `onOpenAI`. W `MindMapTree.tsx` usuń przekazywanie `onAddChildAIImport={props.onAddChildAIImport}` i `onOpenAI={props.onOpenAI}` (linie ~177, 180) oraz `onAddChildAIImport={() => {}}` i `onOpenAI={() => {}}` w widoku tylko do odczytu (linie ~240, 243).

- [ ] **Krok 4: `MindMapEditor.tsx`.**
  - Usuń importy `MindMapAIModal` i `MindMapAIImportTreeModal` oraz lokalny typ `type AINodeResult = { label: string; description: string };`.
  - Usuń stany `aiParentId`, `aiImportParentId`, `isAiImportOpen` i ich trzy wywołania `set…(null/false)` w funkcji resetu (blok z `setDeleteNodeId(null)`).
  - Usuń funkcje `openAI`, `acceptAI` i `acceptAIImportTree`. **`cloneWithNewNodeIds` zostaje** (używa go `cloneExportSubtree`).
  - Usuń propsy `onAddChildAIImport={…}` (blok trzech linii z `setAiImportParentId`, `setIsAiImportOpen`, `setCtxId`) i `onOpenAI={openAI}` z `<MindMapTree …>`.
  - Usuń dwa elementy `<MindMapAIModal … />` i `<MindMapAIImportTreeModal … />` z końca JSX.
  - Uruchom lint (Krok 7) i usuń importy zgłoszone jako nieużywane (np. `mapNode`, `nanoid`, jeśli przestały być potrzebne; nie usuwaj ich na ślepo).

- [ ] **Krok 5: `MindMapList.tsx`.** Usuń import `MindMapImportModal`, stan `isImportOpen`, kartę „Importuj mapę" (cały `<button … onClick={() => setIsImportOpen(true)} …> … </button>`) i element `<MindMapImportModal … />`. Zmień import ikon na `import { Loader2, Plus } from "lucide-react";`. Usuń z destrukturyzacji i z typu propsów `apiFetch`, `onCreatedNew`, `onRefreshList` (po usunięciu modala są nieużywane).

- [ ] **Krok 6: `MindMapsTab.tsx`.** W wywołaniu `<MindMapList …>` usuń propsy `apiFetch`, `onCreatedNew` i `onRefreshList`. `<MindMapEditor …>` zostaje bez zmian. Usuń pliki modali:

```bash
git rm src/features/mind-maps/MindMapAIModal.tsx src/features/mind-maps/MindMapAIImportTreeModal.tsx src/features/mind-maps/MindMapImportModal.tsx
```

- [ ] **Krok 7: Weryfikacja** (zleć `cursor`): `npx tsc --noEmit`, `npx eslint src/features/mind-maps tests/unit/features/mind-maps`, `npx vitest run tests/unit/features/mind-maps`. Oczekiwane: przeszło. W razie błędu `tsc` w trasach `app/api/mind-maps/*` zignoruj je (znikają w Tasku 4).

- [ ] **Krok 8: Commit**

```bash
git add -A src/features/mind-maps tests/unit/features/mind-maps
git commit -m "refactor(mind-maps): remove AI node/subtree actions and AI import" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Backend — trasy, serwisy, biblioteki, agentLog

**Pliki:** zob. „Usuwane" w mapie plików; Modify `lib/firestore-db.ts`, `lib/firestore/collections.ts`

Po Taskach 2 i 3 nic w UI nie woła tych tras.

- [ ] **Krok 1: Usuń trasy, serwisy, biblioteki i testy**

```bash
git rm -r app/api/agent app/api/plan/ask app/api/mind-maps/ai-node app/api/mind-maps/import
git rm -r services/agent lib/agent tests/unit/services/agent
git rm services/agentService.ts services/planService.ts services/mindMapAIService.ts
git rm lib/gemini.ts lib/ollama.ts lib/firestore/agentLog.ts
git rm tests/unit/api/agent.test.ts tests/unit/lib/agentTools.test.ts tests/unit/lib/gemini.test.ts tests/unit/lib/ollama.test.ts
git rm tests/unit/services/agentService.test.ts tests/unit/services/planService.test.ts tests/unit/services/mindMapAIService.test.ts
```

- [ ] **Krok 2: `lib/firestore-db.ts`.** Usuń linię `export { addAgentLogEntry, type AgentLogEntry } from "@/lib/firestore/agentLog";`.

- [ ] **Krok 3: `lib/firestore/collections.ts`.** Usuń funkcję (razem z pustą linią przed nią):

```ts
export function agentLogCol(userId: string) {
  return userCollection(userId, "agent_log");
}
```

- [ ] **Krok 4: Sprawdź, że nic nie zostało**

Run: `grep -rn "agentLog\|AgentLog\|lib/agent\|services/agent\|lib/gemini\|lib/ollama" --include=*.ts --include=*.tsx app src services lib tests`
Oczekiwane: brak trafień. Kolekcji `agent_log` w Firestore nie ruszamy (dane historyczne; Firestore i tak jest wygaszany w etapie 0).

- [ ] **Krok 5: Weryfikacja** (zleć `cursor`): `npx tsc --noEmit` i `npx vitest run`. Oczekiwane: tsc bez błędów, testy zielone poza czerwonym testem statycznym z Tasku 1 (pozostałe trafienia dotyczą jeszcze `package.json`, `.env.example` i ewentualnych komentarzy w kodzie).

- [ ] **Krok 6: Commit**

```bash
git add -A app services lib tests
git commit -m "refactor: remove Gemini and Ollama routes, services and libs, drop agent_log writer" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Zależności, env i dokumentacja

**Pliki:** Modify `package.json`, `package-lock.json`, `.env.example`, `README.md`, `tests/integration/README.md`, `tests/integration/setup.ts`

- [ ] **Krok 1: Odinstaluj SDK**

Run: `npm uninstall @google/genai --legacy-peer-deps`
Oczekiwane: `@google/genai` znika z `package.json` i `package-lock.json`.

- [ ] **Krok 2: `.env.example`.** Usuń blok trzech linii komentarza `# GEMINI_API_KEY: …` i samą zmienną `GEMINI_API_KEY="MY_GEMINI_API_KEY"` (linie 4–7 wraz z pustą linią). Zmiennych `OLLAMA_*` w pliku nie ma.

- [ ] **Krok 3: `README.md`.**
  - Usuń punkt `  -`GEMINI_API_KEY` — klucz API Gemini`.
  - W opisie map myśli zamień fragment `AI (węzeł / poddrzewo), **import** tekstu i/lub obrazu (np. screenshot) przez `/api/mind-maps/import`, ` na pusty (zostaje `eksport do samodzielnego HTML, …`).
  - Usuń punkt `  - Pasek Plan AI z historią rozmowy.`
  - Usuń całą sekcję `## Lokalny agent (Ollama)` (od nagłówka do następnego nagłówka `##` albo końca pliku).
  - Dodaj w jej miejsce:

```markdown
## AI

Aplikacja nie łączy się z żadnym modelem po API i nie wymaga kluczy. Uzupełnianie danych i zarządzanie vaultem prowadzą agenci CLI (Claude Code, Cursor, agy) w terminalu, przez kolejkę zleceń w vaulcie i serwer MCP. Zob. `docs/superpowers/specs/2026-11-12-agent-przez-cli-bez-api-design.md`.
```

- [ ] **Krok 4: `tests/integration/README.md`.** W linii „Bez emulatora: skonfigurowane zmienne środowiskowe (np. `GEMINI_API_KEY`, Firebase/Firestore)." zamień wyliczenie na `(np. konfiguracja Firebase/Firestore)`.

- [ ] **Krok 5: `tests/integration/setup.ts`.** W komentarzu nagłówkowym zamień ` * Runs before integration tests. Loads .env so GEMINI_API_KEY etc. are available.` na ` * Runs before integration tests. Loads .env so Firebase and other variables are available.`

- [ ] **Krok 6: Test statyczny ma być zielony**

Run: `npx vitest run tests/unit/no-model-api.static.test.ts`
Oczekiwane: 4 testy PASS. Jeśli drugi test wskazuje trafienia spoza listy tego planu (np. komentarz w kodzie wspominający Ollamę), usuń lub przeformułuj komentarz. Wzorca testu nie osłabiaj.

- [ ] **Krok 7: Commit**

```bash
git add -A package.json package-lock.json .env.example README.md tests/integration
git commit -m "chore: drop @google/genai, model env vars and AI docs" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Weryfikacja końcowa, review, PR

- [ ] **Krok 1: Pełna weryfikacja** (zleć `cursor`, prośba: „przeszło" albo lista `plik:linia + przyczyna`): `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`. Oczekiwane: wszystko przechodzi, a test statyczny jest zielony. Build wymaga `NEXUS_VAULT_PATH` z `.env` (jest ustawione).

- [ ] **Krok 2: Sprawdzenie ręczne** (`npm run dev`, port 3100):
  - Planowanie: brak paska „Plan AI" u dołu we wszystkich zakładkach; kalendarz, zadania, notatki, zasoby, tagi, tablica działają.
  - Mapy myśli: lista bez karty „Importuj mapę"; w menu kontekstowym węzła jest „Dodaj dziecko", „Wstaw powyżej", usuwanie i eksport, bez pozycji AI.
  - `curl -i localhost:3100/api/agent/status` oraz `/api/plan/ask` zwracają 404.

- [ ] **Krok 3: Review diffa** przez `agy` (`scripts/ask-helper.sh --role review agy "…"`, z prośbą o: pozostałości po usuniętych modułach, martwy kod po usunięciach, regresje w mapach myśli i Planowaniu). Opinie traktuj jak hipotezy i weryfikuj w kodzie.

- [ ] **Krok 4: PR** do `main` zwykłym merge commitem (jak PR #9). Opis: co usunięto, że funkcje AI wrócą jako zlecenia dla agentów w A-2…A-4, oraz że `agent_log` w Firestore nie jest migrowany ani kasowany. Po merge'u następny jest etap 0c-3.

---

## Samoocena planu względem specu

- G3 (usunięcie Gemini, Ollama, `lib/agent/*`, `agentLog`, `GEMINI_API_KEY`): Taski 4–5.
- Trasy `mind-maps/import`, `mind-maps/ai-node`, `plan/ask`, `agent/*`: Task 4; ich konsumenci w UI: Taski 2–3 (usunięte, a nie zaślepione; przyciski wracają jako zlecenia w A-4).
- Test statyczny (spec §5): Task 1, zielony po Tasku 5.
- Kolejność „przed 0c-3" i brak migracji `agentLog`: Task 4, krok 3–4.
