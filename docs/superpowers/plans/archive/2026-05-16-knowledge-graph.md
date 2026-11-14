# Knowledge Graph Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Graf" tab to WiedzaView that renders an interactive force-directed graph of KnowledgeNodes and KnowledgeEdges using XYFlow, with color-coded node types, labeled edges, click-to-detail panel, and type/relation filters.

**Architecture:** New `KnowledgeGraphView` component in `src/features/wiedza/` fetches nodes and edges from existing API endpoints, converts them to XYFlow `Node[]` and `Edge[]`, runs d3-force layout, and renders with a `KnowledgeNodeCard` custom node. A right-side detail panel shows selected node info. Filters are managed as local state.

**Tech Stack:** `@xyflow/react` (^12.10.2, already installed), `d3-force` (^3.0.0, already installed), `@types/d3-force` (already installed), React, TypeScript, Tailwind

---

## Task 1: Create useKnowledgeGraph data hook

**Files:**

- Create: `src/features/wiedza/useKnowledgeGraph.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/features/wiedza/useKnowledgeGraph.test.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { useKnowledgeGraph } from "@/src/features/wiedza/useKnowledgeGraph";

const mockNode = {
  id: "n1",
  type: "note",
  title: "Test note",
  content: "content",
  tags: [],
  sources: [],
  embedding: [],
  createdAt: { seconds: 0 },
  updatedAt: { seconds: 0 },
  createdBy: "user",
};

const mockEdge = {
  id: "e1",
  fromNodeId: "n1",
  toNodeId: "n2",
  relation: "related",
  strength: 0.8,
  createdAt: { seconds: 0 },
};

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => [mockNode] })
    .mockResolvedValueOnce({ ok: true, json: async () => [mockEdge] });
});

test("returns nodes and edges from API", async () => {
  const { result } = renderHook(() => useKnowledgeGraph(mockFetch));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.nodes).toHaveLength(1);
  expect(result.current.edges).toHaveLength(1);
  expect(result.current.nodes[0].id).toBe("n1");
});

test("returns empty arrays on fetch error", async () => {
  mockFetch.mockReset();
  mockFetch.mockRejectedValue(new Error("network error"));
  const { result } = renderHook(() => useKnowledgeGraph(mockFetch));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.nodes).toHaveLength(0);
  expect(result.current.edges).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/features/wiedza/useKnowledgeGraph.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/src/features/wiedza/useKnowledgeGraph'`

- [ ] **Step 3: Create `useKnowledgeGraph.ts`**

```ts
// src/features/wiedza/useKnowledgeGraph.ts
import { useEffect, useState } from "react";

export interface RawKnowledgeNode {
  id: string;
  type: "note" | "task" | "resource" | "chat" | "document" | "event";
  title: string;
  content: string;
  tags: string[];
  dueDate?: string;
  createdBy: "user" | "ai";
}

export interface RawKnowledgeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: "related" | "supports" | "contradicts" | "part-of" | "derived-from";
  strength: number;
}

interface UseKnowledgeGraphResult {
  nodes: RawKnowledgeNode[];
  edges: RawKnowledgeEdge[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useKnowledgeGraph(
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>
): UseKnowledgeGraphResult {
  const [nodes, setNodes] = useState<RawKnowledgeNode[]>([]);
  const [edges, setEdges] = useState<RawKnowledgeEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch("/api/knowledge/nodes").then((r) => r.json()),
      apiFetch("/api/knowledge/edges").then((r) => r.json()),
    ])
      .then(([nodesData, edgesData]) => {
        if (cancelled) return;
        setNodes(Array.isArray(nodesData) ? nodesData : []);
        setEdges(Array.isArray(edgesData) ? edgesData : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load graph");
        setNodes([]);
        setEdges([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiFetch, tick]);

  return { nodes, edges, loading, error, refetch: () => setTick((t) => t + 1) };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/features/wiedza/useKnowledgeGraph.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/wiedza/useKnowledgeGraph.ts tests/unit/features/wiedza/useKnowledgeGraph.test.ts
git commit -m "feat(graph): add useKnowledgeGraph data hook"
```

---

## Task 2: Create KnowledgeNodeCard custom XYFlow node

**Files:**

- Create: `src/features/wiedza/KnowledgeNodeCard.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/features/wiedza/KnowledgeNodeCard.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { KnowledgeNodeCard } from "@/src/features/wiedza/KnowledgeNodeCard";

// XYFlow injects these props into custom nodes
const baseProps = {
  id: "n1",
  data: { label: "Test note", type: "note" as const, selected: false },
  selected: false,
  isConnectable: true,
  dragging: false,
  type: "knowledgeNode",
  xPos: 0,
  yPos: 0,
  zIndex: 0,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
};

test("renders node title", () => {
  render(<KnowledgeNodeCard {...baseProps} />);
  expect(screen.getByText("Test note")).toBeInTheDocument();
});

test("renders correct type badge", () => {
  render(<KnowledgeNodeCard {...baseProps} />);
  expect(screen.getByText("note")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/features/wiedza/KnowledgeNodeCard.test.tsx --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Create `KnowledgeNodeCard.tsx`**

```tsx
// src/features/wiedza/KnowledgeNodeCard.tsx
import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export type KnowledgeNodeType = "note" | "task" | "resource" | "chat" | "document" | "event";

export interface KnowledgeNodeData {
  label: string;
  type: KnowledgeNodeType;
  selected: boolean;
  tags?: string[];
}

const NODE_COLORS: Record<KnowledgeNodeType, { bg: string; border: string; text: string }> = {
  chat: { bg: "rgba(96,165,250,0.15)", border: "#60a5fa", text: "#93c5fd" },
  note: { bg: "rgba(124,109,255,0.15)", border: "#7c6dff", text: "#a395ff" },
  task: { bg: "rgba(52,211,153,0.15)", border: "#34d399", text: "#6ee7b7" },
  resource: { bg: "rgba(245,158,11,0.15)", border: "#f59e0b", text: "#fcd34d" },
  event: { bg: "rgba(248,113,113,0.15)", border: "#f87171", text: "#fca5a5" },
  document: { bg: "rgba(192,132,252,0.15)", border: "#c084fc", text: "#d8b4fe" },
};

const TYPE_ICONS: Record<KnowledgeNodeType, string> = {
  chat: "💬",
  note: "📝",
  task: "✅",
  resource: "🔗",
  event: "📅",
  document: "📄",
};

export const KnowledgeNodeCard = memo(function KnowledgeNodeCard({
  data,
  selected,
}: NodeProps<KnowledgeNodeData>) {
  const colors = NODE_COLORS[data.type] ?? NODE_COLORS.note;

  return (
    <div
      style={{
        background: colors.bg,
        border: `1.5px solid ${selected ? "#7c6dff" : colors.border}`,
        boxShadow: selected ? `0 0 0 2px rgba(124,109,255,0.4)` : undefined,
      }}
      className="rounded-xl px-3 py-2 min-w-[100px] max-w-[160px] cursor-pointer"
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs">{TYPE_ICONS[data.type]}</span>
        <span
          className="text-[9px] font-bold uppercase tracking-wide"
          style={{ color: colors.text }}
        >
          {data.type}
        </span>
      </div>
      <p
        className="text-xs font-semibold leading-tight"
        style={{
          color: "var(--text)",
          maxWidth: 140,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={data.label}
      >
        {data.label}
      </p>
      {data.tags && data.tags.length > 0 && (
        <p className="text-[9px] mt-0.5" style={{ color: "var(--text3)" }}>
          {data.tags.slice(0, 2).join(", ")}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
    </div>
  );
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/unit/features/wiedza/KnowledgeNodeCard.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/wiedza/KnowledgeNodeCard.tsx tests/unit/features/wiedza/KnowledgeNodeCard.test.tsx
git commit -m "feat(graph): add KnowledgeNodeCard custom XYFlow node component"
```

---

## Task 3: Create KnowledgeGraphView main component

**Files:**

- Create: `src/features/wiedza/KnowledgeGraphView.tsx`

- [ ] **Step 1: Create `KnowledgeGraphView.tsx`**

No unit test for this component — it wraps XYFlow which requires a DOM environment that's complex to mock. Manual testing in Task 5 covers it.

```tsx
// src/features/wiedza/KnowledgeGraphView.tsx
"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import * as d3Force from "d3-force";
import {
  KnowledgeNodeCard,
  type KnowledgeNodeType,
  type KnowledgeNodeData,
} from "./KnowledgeNodeCard";
import {
  useKnowledgeGraph,
  type RawKnowledgeNode,
  type RawKnowledgeEdge,
} from "./useKnowledgeGraph";
import { X, RefreshCw } from "lucide-react";

const NODE_TYPES = { knowledgeNode: KnowledgeNodeCard };

const EDGE_COLORS: Record<string, string> = {
  related: "rgba(124,109,255,0.5)",
  supports: "rgba(52,211,153,0.6)",
  contradicts: "rgba(248,113,113,0.6)",
  "part-of": "rgba(160,160,160,0.5)",
  "derived-from": "rgba(96,165,250,0.6)",
};

const ALL_TYPES: KnowledgeNodeType[] = ["note", "task", "resource", "chat", "document", "event"];
const ALL_RELATIONS = ["related", "supports", "contradicts", "part-of", "derived-from"] as const;

function runForceLayout(rawNodes: RawKnowledgeNode[], rawEdges: RawKnowledgeEdge[]) {
  const sim = d3Force
    .forceSimulation(
      rawNodes.map((n) => ({ id: n.id, x: Math.random() * 600, y: Math.random() * 400 }))
    )
    .force(
      "link",
      d3Force
        .forceLink(rawEdges.map((e) => ({ source: e.fromNodeId, target: e.toNodeId })))
        .id((d: { id: string }) => d.id)
        .distance(160)
    )
    .force("charge", d3Force.forceManyBody().strength(-300))
    .force("center", d3Force.forceCenter(400, 300))
    .stop();

  for (let i = 0; i < 300; i++) sim.tick();

  const positions: Record<string, { x: number; y: number }> = {};
  (sim.nodes() as { id: string; x: number; y: number }[]).forEach((n) => {
    positions[n.id] = { x: n.x, y: n.y };
  });
  return positions;
}

function buildFlowNodes(
  rawNodes: RawKnowledgeNode[],
  positions: Record<string, { x: number; y: number }>
): Node<KnowledgeNodeData>[] {
  return rawNodes.map((n) => ({
    id: n.id,
    type: "knowledgeNode",
    position: positions[n.id] ?? { x: Math.random() * 600, y: Math.random() * 400 },
    data: { label: n.title, type: n.type as KnowledgeNodeType, selected: false, tags: [] },
  }));
}

function buildFlowEdges(rawEdges: RawKnowledgeEdge[]): Edge[] {
  return rawEdges.map((e) => ({
    id: e.id,
    source: e.fromNodeId,
    target: e.toNodeId,
    label: e.relation,
    labelStyle: { fontSize: 9, fill: "rgba(240,238,232,0.4)" },
    labelBgStyle: { fill: "transparent" },
    style: { stroke: EDGE_COLORS[e.relation] ?? EDGE_COLORS.related, strokeWidth: 1.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: EDGE_COLORS[e.relation] ?? EDGE_COLORS.related,
      width: 12,
      height: 12,
    },
    animated: e.relation === "contradicts",
  }));
}

interface KnowledgeGraphViewProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
}

export function KnowledgeGraphView({ apiFetch, lang }: KnowledgeGraphViewProps) {
  const { nodes: rawNodes, edges: rawEdges, loading, error, refetch } = useKnowledgeGraph(apiFetch);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<KnowledgeNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<RawKnowledgeNode | null>(null);
  const [typeFilter, setTypeFilter] = useState<Set<KnowledgeNodeType>>(new Set(ALL_TYPES));
  const [relationFilter, setRelationFilter] = useState<Set<string>>(new Set(ALL_RELATIONS));

  useEffect(() => {
    if (rawNodes.length === 0) return;
    const filteredNodes = rawNodes.filter((n) => typeFilter.has(n.type as KnowledgeNodeType));
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = rawEdges.filter(
      (e) =>
        filteredNodeIds.has(e.fromNodeId) &&
        filteredNodeIds.has(e.toNodeId) &&
        relationFilter.has(e.relation)
    );
    const positions = runForceLayout(filteredNodes, filteredEdges);
    setNodes(buildFlowNodes(filteredNodes, positions));
    setEdges(buildFlowEdges(filteredEdges));
  }, [rawNodes, rawEdges, typeFilter, relationFilter, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const raw = rawNodes.find((n) => n.id === node.id) ?? null;
      setSelectedNode(raw);
    },
    [rawNodes]
  );

  const toggleType = (type: KnowledgeNodeType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const toggleRelation = (rel: string) => {
    setRelationFilter((prev) => {
      const next = new Set(prev);
      next.has(rel) ? next.delete(rel) : next.add(rel);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text2)] text-sm">
        {lang === "pl" ? "Ładowanie grafu…" : "Loading graph…"}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400 text-sm">{error}</div>
    );
  }

  if (rawNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text2)] text-sm">
        {lang === "pl" ? "Brak węzłów w bazie wiedzy." : "No knowledge nodes yet."}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] flex-wrap">
        <span className="text-xs text-[var(--text2)] font-bold uppercase tracking-wider">
          {lang === "pl" ? "Typ:" : "Type:"}
        </span>
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
              typeFilter.has(type)
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg3)] text-[var(--text3)]"
            }`}
          >
            {type}
          </button>
        ))}
        <div className="w-px h-4 bg-[var(--border)] mx-1" />
        <span className="text-xs text-[var(--text2)] font-bold uppercase tracking-wider">
          {lang === "pl" ? "Relacja:" : "Relation:"}
        </span>
        {ALL_RELATIONS.map((rel) => (
          <button
            key={rel}
            onClick={() => toggleRelation(rel)}
            className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
              relationFilter.has(rel)
                ? "bg-[var(--accent-bg)] text-[var(--accent2)] border border-[var(--accent-border)]"
                : "bg-[var(--bg3)] text-[var(--text3)]"
            }`}
          >
            {rel}
          </button>
        ))}
        <button
          onClick={refetch}
          className="ml-auto p-1.5 rounded-lg hover:bg-[var(--bg3)] text-[var(--text2)]"
          title={lang === "pl" ? "Odśwież" : "Refresh"}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Graph + Detail panel */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1" style={{ background: "var(--bg)" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={NODE_TYPES}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background color="var(--border)" gap={24} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const type = (n.data as KnowledgeNodeData).type;
                const colors: Record<string, string> = {
                  note: "#7c6dff",
                  task: "#34d399",
                  resource: "#f59e0b",
                  event: "#f87171",
                  chat: "#60a5fa",
                  document: "#c084fc",
                };
                return colors[type] ?? "#7c6dff";
              }}
              style={{ background: "var(--bg2)", border: "1px solid var(--border)" }}
            />
          </ReactFlow>
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div className="w-72 border-l border-[var(--border)] bg-[var(--bg2)] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="font-semibold text-sm text-[var(--text)] truncate">
                {selectedNode.title}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded hover:bg-[var(--bg3)] text-[var(--text2)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">
                  {lang === "pl" ? "Typ" : "Type"}
                </span>
                <p className="text-[var(--text)] mt-0.5">{selectedNode.type}</p>
              </div>
              {selectedNode.content && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">
                    {lang === "pl" ? "Treść" : "Content"}
                  </span>
                  <p className="text-[var(--text2)] mt-0.5 leading-relaxed line-clamp-6">
                    {selectedNode.content}
                  </p>
                </div>
              )}
              {selectedNode.dueDate && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">
                    {lang === "pl" ? "Termin" : "Due date"}
                  </span>
                  <p className="text-[var(--accent)] mt-0.5">{selectedNode.dueDate}</p>
                </div>
              )}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">
                  {lang === "pl" ? "Połączenia" : "Connections"}
                </span>
                {rawEdges.filter(
                  (e) => e.fromNodeId === selectedNode.id || e.toNodeId === selectedNode.id
                ).length === 0 ? (
                  <p className="text-[var(--text3)] mt-0.5 text-xs">
                    {lang === "pl" ? "Brak" : "None"}
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {rawEdges
                      .filter(
                        (e) => e.fromNodeId === selectedNode.id || e.toNodeId === selectedNode.id
                      )
                      .slice(0, 8)
                      .map((e) => {
                        const otherId =
                          e.fromNodeId === selectedNode.id ? e.toNodeId : e.fromNodeId;
                        const other = rawNodes.find((n) => n.id === otherId);
                        return (
                          <li key={e.id} className="flex items-center gap-1.5 text-xs">
                            <span className="text-[var(--text3)]">{e.relation}</span>
                            <span className="text-[var(--text2)]">{other?.title ?? otherId}</span>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/wiedza/KnowledgeGraphView.tsx
git commit -m "feat(graph): add KnowledgeGraphView with force-directed layout and detail panel"
```

---

## Task 4: Add "Graf" tab to WiedzaView and WiedzaSidebarContent

**Files:**

- Modify: `src/features/wiedza/WiedzaView.tsx`
- Modify: `src/features/wiedza/WiedzaSidebarContent.tsx`

- [ ] **Step 1: Add "graph" to the activeTab union type in WiedzaSidebarContent**

In `src/features/wiedza/WiedzaSidebarContent.tsx`, change all occurrences of:

```ts
"notes" | "resources" | "mindmaps" | "knowledge";
```

To:

```ts
"notes" | "resources" | "mindmaps" | "knowledge" | "graph";
```

Add `tabGraph: string` to `WiedzaSidebarContentProps` interface.

Add "Graf" button after the existing "knowledge" button:

```tsx
import { Network } from "lucide-react";

// Inside WiedzaSidebarContent JSX, after the "knowledge" button:
<button type="button" onClick={() => setActiveTab("graph")} className={tabClass("graph")}>
  <Network className="w-5 h-5 flex-shrink-0" />
  <span>{tabGraph}</span>
</button>;
```

- [ ] **Step 2: Add "graph" to WiedzaView**

In `src/features/wiedza/WiedzaView.tsx`:

Update the `useState` type:

```ts
const [activeTab, setActiveTab] = useState<
  "notes" | "resources" | "mindmaps" | "knowledge" | "graph"
>("notes");
```

Add import:

```ts
import { KnowledgeGraphView } from "./KnowledgeGraphView";
```

Add to `WiedzaSidebarContent` call:

```tsx
tabGraph={(t.tabGraph as string) ?? "Graf"}
```

Add to the tab render switch in `<main>`:

```tsx
) : activeTab === "graph" ? (
  <KnowledgeGraphView apiFetch={apiFetch} lang={lang} />
) : (
  // existing NotesPanel
```

- [ ] **Step 3: Add `tabGraph` translation key**

In `src/translations.ts`:

```ts
// en
tabGraph: "Graph",
// pl
tabGraph: "Graf",
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/features/wiedza/WiedzaView.tsx src/features/wiedza/WiedzaSidebarContent.tsx src/features/wiedza/KnowledgeGraphView.tsx src/translations.ts
git commit -m "feat(graph): add Graf tab to WiedzaView with KnowledgeGraphView"
```

---

## Task 5: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify checklist**

1. Navigate to Wiedza → sidebar shows "Graf" button
2. Click "Graf" → KnowledgeGraphView renders (or "Brak węzłów" if DB empty)
3. If nodes exist: graph renders with color-coded nodes and labeled edges
4. Click a node → detail panel opens on the right with title, content, connections
5. Click X → panel closes
6. Type filter buttons toggle node types on/off
7. Relation filter buttons toggle edge types on/off
8. Zoom (scroll) and pan (drag) work
9. MiniMap visible in bottom-right corner
10. Refresh button (↺) re-fetches data

- [ ] **Step 3: Run all graph-related unit tests**

```bash
npx jest tests/unit/features/wiedza/ --no-coverage
```

Expected: all PASS
