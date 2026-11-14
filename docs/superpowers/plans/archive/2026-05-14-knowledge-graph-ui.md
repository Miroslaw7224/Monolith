# Knowledge Graph UI — Plan implementacji: Faza 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować UI dla grafu wiedzy: nowa zakładka "Baza wiedzy" w WiedzaView z filtrowalną listą węzłów, semantyczną wyszukiwarką i interaktywnym grafem (React Flow).

**Architecture:** Nowy hook `useKnowledgeNodes` odpytuje `/api/knowledge/nodes` i `/api/knowledge/search`. `KnowledgeListView` renderuje filtrowalną listę z kartami węzłów. `KnowledgeNodePanel` to wspólny panel boczny (lista + graf). `KnowledgeGraphView` używa `@xyflow/react` do renderowania grafu. Wszystko wpięte w `WiedzaView` jako nowa zakładka obok "chat", "notes", "resources", "mindmaps".

**Tech Stack:** React 19, TypeScript, @xyflow/react v12, Tailwind CSS (CSS variables: `--bg`, `--surface`, `--accent`, `--text`, `--border`), Vitest + @testing-library/react

---

## Kontekst kodebazy

### Jak przekazywany jest apiFetch

`apiFetch` jest propem WiedzaView i dalej przekazywany w dół. Sygnatura:

```typescript
apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
```

### Istniejące API (gotowe z Fazy 1+2)

- `GET /api/knowledge/nodes` → `KnowledgeNode[]`
- `GET /api/knowledge/nodes?type=note` → `KnowledgeNode[]` (filtrowanie)
- `GET /api/knowledge/nodes/[nodeId]` → `KnowledgeNode`
- `GET /api/knowledge/edges?nodeId=[id]` → `KnowledgeEdge[]`
- `GET /api/knowledge/search?q=[query]` → `{ results: Array<{id,type,title,content,tags,score}> }`

### Typy (z `types/knowledge.ts`)

```typescript
type KnowledgeNodeType = "note" | "task" | "resource" | "chat" | "document" | "event";
type KnowledgeRelation = "related" | "supports" | "contradicts" | "part-of" | "derived-from";
interface KnowledgeNode {
  id;
  type;
  title;
  content;
  tags;
  sources;
  embedding;
  dueDate?;
  createdAt;
  updatedAt;
  createdBy;
}
interface KnowledgeEdge {
  id;
  fromNodeId;
  toNodeId;
  relation;
  strength;
  createdAt;
}
```

### Wzorzec testów komponentów (z `tests/unit/components/`)

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
```

### WiedzaView — aktywny tab

```typescript
// src/features/wiedza/WiedzaView.tsx — activeTab zarządza widokiem
const [activeTab, setActiveTab] = useState<"chat" | "notes" | "resources" | "mindmaps">("chat");
```

Po zmianach: rozszerzyć union o `"knowledge"`.

### WiedzaSidebarContent — przyciski zakładek

Plik `src/features/wiedza/WiedzaSidebarContent.tsx` zawiera przyciski zakładek — należy dodać nowy przycisk "Baza wiedzy".

---

## Mapa plików

| Plik                                                          | Akcja     | Opis                                       |
| ------------------------------------------------------------- | --------- | ------------------------------------------ |
| `package.json`                                                | Modyfikuj | Dodaj `@xyflow/react`                      |
| `src/features/knowledge/useKnowledgeNodes.ts`                 | Utwórz    | Hook do pobierania węzłów i wyszukiwania   |
| `src/features/knowledge/KnowledgeListView.tsx`                | Utwórz    | Lista węzłów z filtrami i wyszukiwarką     |
| `src/features/knowledge/KnowledgeNodePanel.tsx`               | Utwórz    | Panel boczny: szczegóły węzła + połączenia |
| `src/features/knowledge/KnowledgeGraphView.tsx`               | Utwórz    | Interaktywny graf React Flow               |
| `src/features/wiedza/WiedzaView.tsx`                          | Modyfikuj | Dodaj zakładkę "knowledge"                 |
| `src/features/wiedza/WiedzaSidebarContent.tsx`                | Modyfikuj | Dodaj przycisk "Baza wiedzy"               |
| `tests/unit/components/knowledge/KnowledgeListView.test.tsx`  | Utwórz    | Testy renderowania listy                   |
| `tests/unit/components/knowledge/KnowledgeNodePanel.test.tsx` | Utwórz    | Testy panelu bocznego                      |
| `tests/unit/components/knowledge/KnowledgeGraphView.test.tsx` | Utwórz    | Test render grafu                          |

---

## Task 1: Zainstaluj @xyflow/react i stwórz useKnowledgeNodes

**Files:**

- Modify: `package.json` (via npm install)
- Create: `src/features/knowledge/useKnowledgeNodes.ts`
- Create: `tests/unit/components/knowledge/useKnowledgeNodes.test.ts`

- [ ] **Step 1: Zainstaluj @xyflow/react**

```bash
cd "E:\Open_AI\Moje_projekty\Projekty_kompletne\Second_brain"
npm install @xyflow/react
```

Oczekiwany output: `added X packages` bez błędów. Sprawdź że `@xyflow/react` pojawił się w `package.json` w sekcji `dependencies`.

- [ ] **Step 2: Napisz failing test dla hooka**

Utwórz plik `tests/unit/components/knowledge/useKnowledgeNodes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useKnowledgeNodes,
  searchKnowledgeNodes,
  fetchNodeEdges,
} from "@/features/knowledge/useKnowledgeNodes";
import { Timestamp } from "firebase-admin/firestore";

const fakeNode = {
  id: "node-1",
  type: "note" as const,
  title: "Test Node",
  content: "Content",
  tags: ["tag1"],
  sources: [],
  embedding: [],
  createdAt: Timestamp.fromDate(new Date()),
  updatedAt: Timestamp.fromDate(new Date()),
  createdBy: "user" as const,
};

describe("useKnowledgeNodes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pobiera węzły i ustawia state", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([fakeNode]),
    });

    const { result } = renderHook(() => useKnowledgeNodes(mockFetch));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetch).toHaveBeenCalledWith("/api/knowledge/nodes");
    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].title).toBe("Test Node");
  });

  it("filtruje po typie gdy type jest podany", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { result } = renderHook(() => useKnowledgeNodes(mockFetch, "task"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetch).toHaveBeenCalledWith("/api/knowledge/nodes?type=task");
  });
});

describe("searchKnowledgeNodes", () => {
  it("zwraca wyniki wyszukiwania", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ id: "node-1", title: "Test", score: 0.9 }] }),
    });

    const results = await searchKnowledgeNodes(mockFetch, "test query");

    expect(mockFetch).toHaveBeenCalledWith("/api/knowledge/search?q=test%20query");
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.9);
  });
});

describe("fetchNodeEdges", () => {
  it("zwraca krawędzie dla węzła", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: "edge-1",
            fromNodeId: "node-1",
            toNodeId: "node-2",
            relation: "related",
            strength: 0.8,
          },
        ]),
    });

    const edges = await fetchNodeEdges(mockFetch, "node-1");

    expect(mockFetch).toHaveBeenCalledWith("/api/knowledge/edges?nodeId=node-1");
    expect(edges).toHaveLength(1);
  });

  it("zwraca pustą tablicę gdy błąd API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });

    const edges = await fetchNodeEdges(mockFetch, "bad-id");

    expect(edges).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Uruchom test — FAIL**

```bash
npx vitest run tests/unit/components/knowledge/useKnowledgeNodes.test.ts
```

Oczekiwany output: FAIL — `Cannot find module '@/features/knowledge/useKnowledgeNodes'`

- [ ] **Step 4: Zaimplementuj hook**

Utwórz `src/features/knowledge/useKnowledgeNodes.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import { KnowledgeNode, KnowledgeEdge, KnowledgeNodeType } from "@/types/knowledge";

export type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

export function useKnowledgeNodes(apiFetch: ApiFetch, type?: KnowledgeNodeType) {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = type ? `/api/knowledge/nodes?type=${type}` : "/api/knowledge/nodes";
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Błąd pobierania węzłów");
      const data = await res.json();
      setNodes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, type]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  return { nodes, loading, error, refetch: fetchNodes };
}

export async function searchKnowledgeNodes(
  apiFetch: ApiFetch,
  query: string
): Promise<
  Array<{
    id: string;
    type: KnowledgeNodeType;
    title: string;
    content: string;
    tags: string[];
    score: number;
  }>
> {
  const res = await apiFetch(`/api/knowledge/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Błąd wyszukiwania");
  const data = await res.json();
  return data.results;
}

export async function fetchNodeEdges(apiFetch: ApiFetch, nodeId: string): Promise<KnowledgeEdge[]> {
  const res = await apiFetch(`/api/knowledge/edges?nodeId=${nodeId}`);
  if (!res.ok) return [];
  return res.json();
}
```

- [ ] **Step 5: Uruchom test — PASS**

```bash
npx vitest run tests/unit/components/knowledge/useKnowledgeNodes.test.ts
```

Oczekiwany output: PASS (4 testy)

- [ ] **Step 6: Uruchom wszystkie testy — brak regresji**

```bash
npx vitest run
```

Oczekiwany output: wszystkie testy PASS

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/features/knowledge/useKnowledgeNodes.ts tests/unit/components/knowledge/useKnowledgeNodes.test.ts
git commit -m "feat: install @xyflow/react and add useKnowledgeNodes hook"
```

---

## Task 2: KnowledgeListView — lista węzłów z filtrami

**Files:**

- Create: `src/features/knowledge/KnowledgeListView.tsx`
- Create: `tests/unit/components/knowledge/KnowledgeListView.test.tsx`

- [ ] **Step 1: Napisz failing test**

Utwórz `tests/unit/components/knowledge/KnowledgeListView.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { KnowledgeListView } from "@/features/knowledge/KnowledgeListView";

const fakeNodes = [
  {
    id: "n1", type: "note" as const, title: "Notatka testowa", content: "Treść notatki",
    tags: ["test"], sources: [], embedding: [],
    createdAt: { toDate: () => new Date() } as any,
    updatedAt: { toDate: () => new Date() } as any,
    createdBy: "user" as const,
  },
  {
    id: "n2", type: "task" as const, title: "Zadanie do zrobienia", content: "Opis zadania",
    tags: [], sources: [], embedding: [],
    createdAt: { toDate: () => new Date() } as any,
    updatedAt: { toDate: () => new Date() } as any,
    createdBy: "ai" as const,
  },
];

const mockApiFetch = vi.fn();

describe("KnowledgeListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeNodes),
    });
  });

  it("renderuje listę węzłów po załadowaniu", async () => {
    render(<KnowledgeListView apiFetch={mockApiFetch} lang="pl" onShowGraph={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Notatka testowa")).toBeInTheDocument();
      expect(screen.getByText("Zadanie do zrobienia")).toBeInTheDocument();
    });
  });

  it("wyświetla przyciski filtrów typów", async () => {
    render(<KnowledgeListView apiFetch={mockApiFetch} lang="pl" onShowGraph={() => {}} />);

    expect(screen.getByRole("button", { name: /wszystkie/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notatki/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zadania/i })).toBeInTheDocument();
  });

  it("filtruje węzły po kliknięciu przycisku typu", async () => {
    const user = userEvent.setup();

    mockApiFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeNodes) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([fakeNodes[0]]) });

    render(<KnowledgeListView apiFetch={mockApiFetch} lang="pl" onShowGraph={() => {}} />);

    await waitFor(() => screen.getByText("Notatka testowa"));

    await user.click(screen.getByRole("button", { name: /notatki/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/knowledge/nodes?type=note");
    });
  });

  it("otwiera panel po kliknięciu węzła", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(fakeNodes) });

    render(<KnowledgeListView apiFetch={mockApiFetch} lang="pl" onShowGraph={() => {}} />);

    await waitFor(() => screen.getByText("Notatka testowa"));

    await user.click(screen.getByText("Notatka testowa"));

    expect(screen.getByTestId("knowledge-node-panel")).toBeInTheDocument();
  });

  it("wywołuje onShowGraph po kliknięciu przycisku grafu", async () => {
    const onShowGraph = vi.fn();
    render(<KnowledgeListView apiFetch={mockApiFetch} lang="pl" onShowGraph={onShowGraph} />);

    await waitFor(() => screen.getByText("Notatka testowa"));

    await userEvent.click(screen.getByRole("button", { name: /pokaż graf/i }));

    expect(onShowGraph).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Uruchom test — FAIL**

```bash
npx vitest run tests/unit/components/knowledge/KnowledgeListView.test.tsx
```

Oczekiwany output: FAIL — `Cannot find module '@/features/knowledge/KnowledgeListView'`

- [ ] **Step 3: Zaimplementuj KnowledgeListView**

Utwórz `src/features/knowledge/KnowledgeListView.tsx`:

```typescript
import { useState, useCallback } from "react";
import { Network, Search } from "lucide-react";
import { KnowledgeNode, KnowledgeNodeType } from "@/types/knowledge";
import { ApiFetch, useKnowledgeNodes, searchKnowledgeNodes } from "./useKnowledgeNodes";
import { KnowledgeNodePanel } from "./KnowledgeNodePanel";

const TYPE_FILTERS: { label: string; value: KnowledgeNodeType | "all" }[] = [
  { label: "Wszystkie", value: "all" },
  { label: "Notatki", value: "note" },
  { label: "Zadania", value: "task" },
  { label: "Wydarzenia", value: "event" },
  { label: "Zasoby", value: "resource" },
  { label: "Chaty", value: "chat" },
  { label: "Dokumenty", value: "document" },
];

const TYPE_COLORS: Record<KnowledgeNodeType, string> = {
  note: "bg-blue-500",
  task: "bg-orange-500",
  resource: "bg-green-500",
  chat: "bg-purple-500",
  document: "bg-gray-500",
  event: "bg-red-500",
};

const TYPE_LABELS: Record<KnowledgeNodeType, string> = {
  note: "Notatka",
  task: "Zadanie",
  resource: "Zasób",
  chat: "Chat",
  document: "Dokument",
  event: "Wydarzenie",
};

interface Props {
  apiFetch: ApiFetch;
  lang: "pl" | "en";
  onShowGraph: () => void;
}

export function KnowledgeListView({ apiFetch, lang, onShowGraph }: Props) {
  const [activeFilter, setActiveFilter] = useState<KnowledgeNodeType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeNode[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);

  const { nodes, loading } = useKnowledgeNodes(
    apiFetch,
    activeFilter === "all" ? undefined : activeFilter
  );

  const handleSearch = useCallback(
    async (q: string) => {
      setSearchQuery(q);
      if (!q.trim()) {
        setSearchResults(null);
        return;
      }
      setSearching(true);
      try {
        const results = await searchKnowledgeNodes(apiFetch, q);
        const full: KnowledgeNode[] = results.map((r) => ({
          ...r,
          sources: [],
          embedding: [],
          createdAt: null as any,
          updatedAt: null as any,
          createdBy: "user" as const,
        }));
        setSearchResults(full);
      } finally {
        setSearching(false);
      }
    },
    [apiFetch]
  );

  const displayedNodes = searchResults ?? nodes;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Baza wiedzy</h2>
          <button
            onClick={onShowGraph}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm hover:opacity-90 transition-opacity"
          >
            <Network size={16} />
            Pokaż graf
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
            <input
              type="text"
              placeholder={lang === "pl" ? "Szukaj semantycznie..." : "Semantic search..."}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] text-sm placeholder:text-[var(--text3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Type filters */}
        {!searchQuery && (
          <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeFilter === f.value
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg2)] text-[var(--text2)] hover:bg-[var(--bg3)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Node list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {loading || searching ? (
            <div className="flex items-center justify-center h-24 text-[var(--text3)] text-sm">
              {lang === "pl" ? "Ładowanie..." : "Loading..."}
            </div>
          ) : displayedNodes.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[var(--text3)] text-sm">
              {searchQuery
                ? lang === "pl" ? "Brak wyników wyszukiwania" : "No results found"
                : lang === "pl" ? "Baza wiedzy jest pusta" : "Knowledge base is empty"}
            </div>
          ) : (
            displayedNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className="w-full text-left p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg2)] transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-white text-xs font-medium ${TYPE_COLORS[node.type]}`}
                  >
                    {TYPE_LABELS[node.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--text)] text-sm truncate">{node.title}</p>
                    <p className="text-[var(--text3)] text-xs mt-0.5 line-clamp-2">{node.content}</p>
                    {node.tags && node.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {node.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded bg-[var(--bg3)] text-[var(--text3)] text-xs"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Side panel */}
      {selectedNode && (
        <KnowledgeNodePanel
          node={selectedNode}
          apiFetch={apiFetch}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Uruchom test — PASS**

```bash
npx vitest run tests/unit/components/knowledge/KnowledgeListView.test.tsx
```

Oczekiwany output: PASS (5 testów). Jeśli jest błąd o brakującym `KnowledgeNodePanel`, stwórz tymczasowy stub w `src/features/knowledge/KnowledgeNodePanel.tsx`:

```typescript
// Tymczasowy stub — zostanie zastąpiony w Task 3
export function KnowledgeNodePanel({ onClose }: { node: any; apiFetch: any; onClose: () => void }) {
  return <div data-testid="knowledge-node-panel"><button onClick={onClose}>Zamknij</button></div>;
}
```

- [ ] **Step 5: Uruchom wszystkie testy — brak regresji**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add src/features/knowledge/KnowledgeListView.tsx tests/unit/components/knowledge/KnowledgeListView.test.tsx
git commit -m "feat: add KnowledgeListView with type filters and semantic search"
```

---

## Task 3: KnowledgeNodePanel — panel szczegółów węzła

**Files:**

- Create/Replace: `src/features/knowledge/KnowledgeNodePanel.tsx` (zastępuje stub z Task 2)
- Create: `tests/unit/components/knowledge/KnowledgeNodePanel.test.tsx`

- [ ] **Step 1: Napisz failing test**

Utwórz `tests/unit/components/knowledge/KnowledgeNodePanel.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { KnowledgeNodePanel } from "@/features/knowledge/KnowledgeNodePanel";

const fakeNode = {
  id: "n1",
  type: "note" as const,
  title: "Notatka testowa",
  content: "Treść notatki z ważnymi informacjami.",
  tags: ["tag1", "tag2"],
  sources: [{ title: "Źródło", url: "https://example.com" }],
  embedding: [],
  createdAt: { toDate: () => new Date("2026-01-01") } as any,
  updatedAt: { toDate: () => new Date("2026-01-02") } as any,
  createdBy: "user" as const,
};

const fakeEdges = [
  {
    id: "e1",
    fromNodeId: "n1",
    toNodeId: "n2",
    relation: "related" as const,
    strength: 0.85,
    createdAt: { toDate: () => new Date() } as any,
  },
];

const mockApiFetch = vi.fn();

describe("KnowledgeNodePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Edges API call
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeEdges),
    });
  });

  it("wyświetla tytuł i treść węzła", () => {
    render(<KnowledgeNodePanel node={fakeNode} apiFetch={mockApiFetch} onClose={() => {}} />);

    expect(screen.getByText("Notatka testowa")).toBeInTheDocument();
    expect(screen.getByText("Treść notatki z ważnymi informacjami.")).toBeInTheDocument();
  });

  it("wyświetla tagi węzła", () => {
    render(<KnowledgeNodePanel node={fakeNode} apiFetch={mockApiFetch} onClose={() => {}} />);

    expect(screen.getByText("#tag1")).toBeInTheDocument();
    expect(screen.getByText("#tag2")).toBeInTheDocument();
  });

  it("ładuje i wyświetla połączenia", async () => {
    render(<KnowledgeNodePanel node={fakeNode} apiFetch={mockApiFetch} onClose={() => {}} />);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/knowledge/edges?nodeId=n1");
    });

    await waitFor(() => {
      expect(screen.getByText(/0\.85/)).toBeInTheDocument();
    });
  });

  it("wywołuje onClose po kliknięciu przycisku zamknięcia", async () => {
    const onClose = vi.fn();
    render(<KnowledgeNodePanel node={fakeNode} apiFetch={mockApiFetch} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: /zamknij/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it("ma data-testid dla testów integracyjnych", () => {
    render(<KnowledgeNodePanel node={fakeNode} apiFetch={mockApiFetch} onClose={() => {}} />);

    expect(screen.getByTestId("knowledge-node-panel")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Uruchom test — FAIL**

```bash
npx vitest run tests/unit/components/knowledge/KnowledgeNodePanel.test.tsx
```

Oczekiwany output: FAIL

- [ ] **Step 3: Zaimplementuj KnowledgeNodePanel**

Zastąp stub pełną implementacją w `src/features/knowledge/KnowledgeNodePanel.tsx`:

```typescript
import { useEffect, useState } from "react";
import { X, Link, Tag } from "lucide-react";
import { KnowledgeEdge, KnowledgeNode } from "@/types/knowledge";
import { ApiFetch, fetchNodeEdges } from "./useKnowledgeNodes";

const RELATION_LABELS: Record<string, string> = {
  related: "powiązany",
  supports: "wspiera",
  contradicts: "sprzeczny",
  "part-of": "część",
  "derived-from": "pochodzi z",
};

const TYPE_COLORS: Record<string, string> = {
  note: "bg-blue-500",
  task: "bg-orange-500",
  resource: "bg-green-500",
  chat: "bg-purple-500",
  document: "bg-gray-500",
  event: "bg-red-500",
};

interface Props {
  node: KnowledgeNode;
  apiFetch: ApiFetch;
  onClose: () => void;
}

export function KnowledgeNodePanel({ node, apiFetch, onClose }: Props) {
  const [edges, setEdges] = useState<KnowledgeEdge[]>([]);
  const [loadingEdges, setLoadingEdges] = useState(true);

  useEffect(() => {
    setLoadingEdges(true);
    fetchNodeEdges(apiFetch, node.id)
      .then(setEdges)
      .finally(() => setLoadingEdges(false));
  }, [apiFetch, node.id]);

  return (
    <div
      data-testid="knowledge-node-panel"
      className="w-80 shrink-0 flex flex-col border-l border-[var(--border)] bg-[var(--surface)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-white text-xs font-medium ${TYPE_COLORS[node.type] ?? "bg-gray-500"}`}>
            {node.type}
          </span>
          <h3 className="font-semibold text-[var(--text)] text-sm truncate">{node.title}</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Zamknij"
          className="shrink-0 p-1 rounded-lg hover:bg-[var(--bg2)] text-[var(--text3)] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Content */}
        <section>
          <p className="text-sm text-[var(--text)] leading-relaxed">{node.content}</p>
        </section>

        {/* Tags */}
        {node.tags && node.tags.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 mb-2 text-[var(--text3)]">
              <Tag size={13} />
              <span className="text-xs font-medium uppercase tracking-wide">Tagi</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-[var(--bg2)] text-[var(--text2)] text-xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Sources */}
        {node.sources && node.sources.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 mb-2 text-[var(--text3)]">
              <Link size={13} />
              <span className="text-xs font-medium uppercase tracking-wide">Źródła</span>
            </div>
            <ul className="space-y-1">
              {node.sources.map((s, i) => (
                <li key={i} className="text-xs text-[var(--text2)]">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Connections */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text3)]">
              Połączenia
            </span>
            {!loadingEdges && (
              <span className="text-xs text-[var(--text3)]">{edges.length}</span>
            )}
          </div>
          {loadingEdges ? (
            <p className="text-xs text-[var(--text3)]">Ładowanie...</p>
          ) : edges.length === 0 ? (
            <p className="text-xs text-[var(--text3)]">Brak połączeń</p>
          ) : (
            <ul className="space-y-1.5">
              {edges.map((edge) => {
                const otherId = edge.fromNodeId === node.id ? edge.toNodeId : edge.fromNodeId;
                return (
                  <li
                    key={edge.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg2)] text-xs"
                  >
                    <span className="text-[var(--text2)] truncate">{otherId}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[var(--text3)]">{RELATION_LABELS[edge.relation] ?? edge.relation}</span>
                      <span className="text-[var(--accent)] font-medium">{edge.strength.toFixed(2)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Metadata */}
        <section className="text-xs text-[var(--text3)] space-y-1">
          <p>Utworzono przez: {node.createdBy === "ai" ? "AI" : "Użytkownik"}</p>
          {node.dueDate && <p>Termin: {node.dueDate}</p>}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Uruchom test — PASS**

```bash
npx vitest run tests/unit/components/knowledge/KnowledgeNodePanel.test.tsx
```

Oczekiwany output: PASS (5 testów)

- [ ] **Step 5: Uruchom wszystkie testy — brak regresji**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add src/features/knowledge/KnowledgeNodePanel.tsx tests/unit/components/knowledge/KnowledgeNodePanel.test.tsx
git commit -m "feat: add KnowledgeNodePanel with edges and metadata"
```

---

## Task 4: KnowledgeGraphView — interaktywny graf React Flow

**Files:**

- Create: `src/features/knowledge/KnowledgeGraphView.tsx`
- Create: `tests/unit/components/knowledge/KnowledgeGraphView.test.tsx`

**Uwaga:** React Flow wymaga środowiska przeglądarki. Testy muszą mockować `@xyflow/react`.

- [ ] **Step 1: Napisz failing test**

Utwórz `tests/unit/components/knowledge/KnowledgeGraphView.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock @xyflow/react — nie działa w jsdom bez DOM APIs
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes, onNodeClick }: any) => (
    <div data-testid="react-flow">
      {nodes.map((n: any) => (
        <button
          key={n.id}
          data-testid={`graph-node-${n.id}`}
          onClick={() => onNodeClick?.({}, n)}
        >
          {n.data?.node?.title ?? n.id}
        </button>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
}));

import { KnowledgeGraphView } from "@/features/knowledge/KnowledgeGraphView";

const fakeNodes = [
  {
    id: "n1", type: "note" as const, title: "Węzeł A", content: "Treść A",
    tags: [], sources: [], embedding: [],
    createdAt: { toDate: () => new Date() } as any,
    updatedAt: { toDate: () => new Date() } as any,
    createdBy: "user" as const,
  },
  {
    id: "n2", type: "task" as const, title: "Węzeł B", content: "Treść B",
    tags: [], sources: [], embedding: [],
    createdAt: { toDate: () => new Date() } as any,
    updatedAt: { toDate: () => new Date() } as any,
    createdBy: "ai" as const,
  },
];

const mockApiFetch = vi.fn();

describe("KnowledgeGraphView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeNodes) }) // nodes
      .mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }); // edges
  });

  it("renderuje graf z węzłami", async () => {
    render(
      <KnowledgeGraphView apiFetch={mockApiFetch} lang="pl" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
      expect(screen.getByTestId("graph-node-n1")).toBeInTheDocument();
      expect(screen.getByTestId("graph-node-n2")).toBeInTheDocument();
    });
  });

  it("otwiera panel boczny po kliknięciu węzła", async () => {
    const user = userEvent.setup();
    render(
      <KnowledgeGraphView apiFetch={mockApiFetch} lang="pl" onClose={() => {}} />
    );

    await waitFor(() => screen.getByTestId("graph-node-n1"));

    await user.click(screen.getByTestId("graph-node-n1"));

    expect(screen.getByTestId("knowledge-node-panel")).toBeInTheDocument();
  });

  it("wywołuje onClose po kliknięciu przycisku wstecz", async () => {
    const onClose = vi.fn();
    render(<KnowledgeGraphView apiFetch={mockApiFetch} lang="pl" onClose={onClose} />);

    await waitFor(() => screen.getByText(/wróć do listy/i));

    await userEvent.click(screen.getByText(/wróć do listy/i));

    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Uruchom test — FAIL**

```bash
npx vitest run tests/unit/components/knowledge/KnowledgeGraphView.test.tsx
```

Oczekiwany output: FAIL — `Cannot find module '@/features/knowledge/KnowledgeGraphView'`

- [ ] **Step 3: Zaimplementuj KnowledgeGraphView**

Utwórz `src/features/knowledge/KnowledgeGraphView.tsx`:

```typescript
import { useState, useEffect, useCallback } from "react";
import { ReactFlow, Background, Controls, MiniMap, Node, Edge, NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft } from "lucide-react";
import { KnowledgeEdge, KnowledgeNode } from "@/types/knowledge";
import { ApiFetch, useKnowledgeNodes, fetchNodeEdges } from "./useKnowledgeNodes";
import { KnowledgeNodePanel } from "./KnowledgeNodePanel";

const TYPE_COLORS: Record<string, string> = {
  note: "#3b82f6",
  task: "#f97316",
  resource: "#22c55e",
  chat: "#a855f7",
  document: "#6b7280",
  event: "#ef4444",
};

function toRFNodes(nodes: KnowledgeNode[]): Node[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const SPACING_X = 220;
  const SPACING_Y = 140;

  return nodes.map((node, i) => ({
    id: node.id,
    position: {
      x: (i % cols) * SPACING_X + (Math.floor(i / cols) % 2 === 0 ? 0 : SPACING_X / 2),
      y: Math.floor(i / cols) * SPACING_Y,
    },
    data: { node, label: node.title },
    style: {
      background: TYPE_COLORS[node.type] ?? "#6b7280",
      color: "#fff",
      border: "none",
      borderRadius: "10px",
      padding: "8px 14px",
      fontSize: "12px",
      fontWeight: 600,
      maxWidth: 180,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      cursor: "pointer",
    },
  }));
}

function toRFEdges(edges: KnowledgeEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.fromNodeId,
    target: e.toNodeId,
    label: e.relation,
    style: { stroke: "#94a3b8" },
    labelStyle: { fontSize: 10, fill: "#94a3b8" },
  }));
}

interface Props {
  apiFetch: ApiFetch;
  lang: "pl" | "en";
  onClose: () => void;
}

export function KnowledgeGraphView({ apiFetch, lang, onClose }: Props) {
  const { nodes, loading } = useKnowledgeNodes(apiFetch);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);

  useEffect(() => {
    if (nodes.length === 0) return;
    // Fetch edges for all nodes in parallel (cap at 50)
    const nodeIds = nodes.slice(0, 50).map((n) => n.id);
    Promise.all(nodeIds.map((id) => fetchNodeEdges(apiFetch, id))).then((edgeArrays) => {
      const allEdges = edgeArrays.flat();
      const unique = Array.from(new Map(allEdges.map((e) => [e.id, e])).values());
      setRfEdges(toRFEdges(unique));
    });
  }, [nodes, apiFetch]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, rfNode) => {
      const node = rfNode.data?.node as KnowledgeNode | undefined;
      if (node) setSelectedNode(node);
    },
    []
  );

  const rfNodes = toRFNodes(nodes);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)] shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-[var(--text2)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft size={16} />
          Wróć do listy
        </button>
        <span className="text-[var(--text3)] text-sm">
          {nodes.length} {lang === "pl" ? "węzłów" : "nodes"}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Graph */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-full text-[var(--text3)] text-sm">
              {lang === "pl" ? "Ładowanie grafu..." : "Loading graph..."}
            </div>
          ) : (
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodeClick={handleNodeClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={(n) => TYPE_COLORS[(n.data?.node as KnowledgeNode)?.type] ?? "#6b7280"}
              />
            </ReactFlow>
          )}
        </div>

        {/* Side panel */}
        {selectedNode && (
          <KnowledgeNodePanel
            node={selectedNode}
            apiFetch={apiFetch}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Uruchom test — PASS**

```bash
npx vitest run tests/unit/components/knowledge/KnowledgeGraphView.test.tsx
```

Oczekiwany output: PASS (3 testy)

- [ ] **Step 5: Uruchom wszystkie testy — brak regresji**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add src/features/knowledge/KnowledgeGraphView.tsx tests/unit/components/knowledge/KnowledgeGraphView.test.tsx
git commit -m "feat: add KnowledgeGraphView with React Flow visualization"
```

---

## Task 5: Integracja w WiedzaView i WiedzaSidebarContent

**Files:**

- Modify: `src/features/wiedza/WiedzaView.tsx`
- Modify: `src/features/wiedza/WiedzaSidebarContent.tsx`

W tym zadaniu należy przeczytać oba pliki CAŁKOWICIE przed edycją, a następnie dokonać minimalnych zmian.

- [ ] **Step 1: Przeczytaj WiedzaView.tsx**

```bash
# Odczytaj plik i zanotuj:
# 1. Typ activeTab (union string literal)
# 2. Warunki renderowania każdej zakładki (np. {activeTab === "chat" && <ChatPanel .../>})
# 3. Jakie propsy ma WiedzaView (apiFetch, lang itp.)
```

Użyj narzędzia Read na `src/features/wiedza/WiedzaView.tsx`.

- [ ] **Step 2: Przeczytaj WiedzaSidebarContent.tsx**

Użyj narzędzia Read na `src/features/wiedza/WiedzaSidebarContent.tsx`.

Zanotuj:

- Jak wyglądają istniejące przyciski zakładek (className, onClick, ikona)
- Jakie propsy przyjmuje komponent

- [ ] **Step 3: Zaktualizuj WiedzaView.tsx**

Wprowadź trzy zmiany:

**Zmiana 1** — rozszerz typ `activeTab` o `"knowledge"`:

```typescript
// Znajdź linię z useState dla activeTab, np.:
const [activeTab, setActiveTab] = useState<"chat" | "notes" | "resources" | "mindmaps">("chat");
// Zmień na:
const [activeTab, setActiveTab] = useState<
  "chat" | "notes" | "resources" | "mindmaps" | "knowledge"
>("chat");
```

**Zmiana 2** — dodaj stan dla trybu grafu:

```typescript
// Dodaj pod useState activeTab:
const [knowledgeViewMode, setKnowledgeViewMode] = useState<"list" | "graph">("list");
```

**Zmiana 3** — dodaj import i renderowanie zakładki (w bloku warunków renderowania, obok innych `{activeTab === "..." && ...}`):

```typescript
// Na górze pliku, dodaj importy:
import { KnowledgeListView } from "@/features/knowledge/KnowledgeListView";
import { KnowledgeGraphView } from "@/features/knowledge/KnowledgeGraphView";

// W miejscu renderowania zakładek, dodaj:
{activeTab === "knowledge" && knowledgeViewMode === "list" && (
  <KnowledgeListView
    apiFetch={apiFetch}
    lang={lang}
    onShowGraph={() => setKnowledgeViewMode("graph")}
  />
)}
{activeTab === "knowledge" && knowledgeViewMode === "graph" && (
  <KnowledgeGraphView
    apiFetch={apiFetch}
    lang={lang}
    onClose={() => setKnowledgeViewMode("list")}
  />
)}
```

- [ ] **Step 4: Zaktualizuj WiedzaSidebarContent.tsx**

Dodaj nowy przycisk zakładki "Baza wiedzy". Wzoruj się na istniejących przyciskach w pliku. Przykładowy import ikony: `import { Network } from "lucide-react"`.

Wzorzec przycisku (dopasuj do istniejącego stylu w pliku):

```typescript
<button
  onClick={() => setActiveTab("knowledge")}
  className={/* użyj tego samego className co inne przyciski, z warunkiem activeTab === "knowledge" */}
>
  <Network size={18} />
  {/* etykieta "Baza wiedzy" lub "Knowledge" zależnie od lang */}
</button>
```

Prop `setActiveTab` i `activeTab` muszą obsługiwać typ `"knowledge"` — sprawdź sygnaturę propsów komponentu i zaktualizuj union type jeśli jest zdefiniowany lokalnie.

- [ ] **Step 5: Sprawdź typy**

```bash
npx tsc --noEmit
```

Napraw wszystkie błędy TypeScript przed przejściem dalej.

- [ ] **Step 6: Uruchom wszystkie testy — brak regresji**

```bash
npx vitest run
```

Oczekiwany output: wszystkie testy PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/wiedza/WiedzaView.tsx src/features/wiedza/WiedzaSidebarContent.tsx
git commit -m "feat: wire KnowledgeListView and KnowledgeGraphView into WiedzaView"
```

---

## Weryfikacja końcowa Fazy 3

- [ ] **Uruchom pełny suite testów**

```bash
npx vitest run
```

Oczekiwany output: wszystkie testy PASS, brak regresji

- [ ] **Sprawdź typy**

```bash
npx tsc --noEmit
```

Oczekiwany output: brak błędów

---

## Co dalej — Faza 4: Migracja i synchronizacja map myśli

Następny plan: `2026-05-14-knowledge-graph-migration.md`

Obejmuje:

- Skrypt migracyjny: istniejące notatki/zadania/zasoby/kalendarz → KnowledgeNodes
- Przycisk "Synchronizuj z bazą wiedzy" na każdej mapie myśli
- Generowanie embeddingów dla wszystkich zmigrowanych węzłów
- Wstępne budowanie połączeń po migracji
