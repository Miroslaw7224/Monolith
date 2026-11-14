# Knowledge Base Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple Chat/Notatki/Zasoby/MindMaps from the knowledge base, make the knowledge base AI-driven with a chat interface and preview-before-save flow.

**Architecture:** New `KnowledgeView` container holds three internal tabs (Chat AI default / Lista / Graf). `KnowledgeChatPanel` handles adding nodes via AI with a confirm-before-save preview card. Migration feature removed entirely. Per-node delete replaces bulk clear.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Firestore (Firebase Admin SDK), OpenAI `gpt-4o-mini`, Tailwind CSS with CSS variables, Lucide icons.

---

## File Map

| Action | File                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| Delete | `services/migrationService.ts`                                                     |
| Delete | `app/api/knowledge/migrate/route.ts`                                               |
| Create | `app/api/knowledge/extract/route.ts`                                               |
| Create | `features/knowledge/KnowledgeView.tsx`                                             |
| Create | `features/knowledge/KnowledgeChatPanel.tsx`                                        |
| Modify | `services/knowledgeAIService.ts` — export `extractNodeFromMessage`                 |
| Modify | `features/knowledge/useKnowledgeNodes.ts` — add `deleteKnowledgeNode` helper       |
| Modify | `features/knowledge/KnowledgeListView.tsx` — remove migration, add per-node delete |
| Modify | `features/knowledge/KnowledgeNodePanel.tsx` — add delete button                    |
| Modify | `src/features/wiedza/WiedzaView.tsx` — remove chat tab + related state             |
| Modify | `src/features/wiedza/WiedzaSidebarContent.tsx` — remove chat tab                   |

---

## Task 1: Delete migration

**Files:**

- Delete: `services/migrationService.ts`
- Delete: `app/api/knowledge/migrate/route.ts`

- [ ] **Step 1: Delete the two files**

```bash
rm services/migrationService.ts
rm app/api/knowledge/migrate/route.ts
```

- [ ] **Step 2: Verify no other file imports from migrationService**

```bash
grep -r "migrationService" --include="*.ts" --include="*.tsx" .
# Expected: no output (zero matches)
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: remove migration service and endpoint"
```

---

## Task 2: Export extractNodeFromMessage + add /api/knowledge/extract

The `KnowledgeChatPanel` needs to call an endpoint that extracts a node structure from a message without saving it. Export the existing private function and add a thin route.

**Files:**

- Modify: `services/knowledgeAIService.ts:32`
- Create: `app/api/knowledge/extract/route.ts`

- [ ] **Step 1: Export `extractNodeFromMessage` in `knowledgeAIService.ts`**

Change line 32 from:

```typescript
async function extractNodeFromMessage(message: string): Promise<{
```

to:

```typescript
export async function extractNodeFromMessage(message: string): Promise<{
```

- [ ] **Step 2: Create `app/api/knowledge/extract/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { extractNodeFromMessage } from "@/services/knowledgeAIService";

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message } = body as { message?: string };
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  try {
    const node = await extractNodeFromMessage(message);
    return NextResponse.json({ node });
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 4: Commit**

```bash
git add services/knowledgeAIService.ts app/api/knowledge/extract/route.ts
git commit -m "feat: export extractNodeFromMessage and add /api/knowledge/extract endpoint"
```

---

## Task 3: Add deleteKnowledgeNode helper to useKnowledgeNodes

**Files:**

- Modify: `features/knowledge/useKnowledgeNodes.ts`

- [ ] **Step 1: Add the export at the end of the file**

Append to `features/knowledge/useKnowledgeNodes.ts`:

```typescript
export async function deleteKnowledgeNode(apiFetch: ApiFetch, nodeId: string): Promise<void> {
  const res = await apiFetch(`/api/knowledge/nodes/${nodeId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Błąd usuwania węzła");
}
```

- [ ] **Step 2: Commit**

```bash
git add features/knowledge/useKnowledgeNodes.ts
git commit -m "feat: add deleteKnowledgeNode helper"
```

---

## Task 4: Create KnowledgeChatPanel

Two-mode chat: save flow (detects keywords → preview card → confirm/cancel) and query flow (semantic search → AI response).

**Files:**

- Create: `features/knowledge/KnowledgeChatPanel.tsx`

- [ ] **Step 1: Create the file**

```typescript
import React, { useRef, useState } from "react";
import { Send, Brain } from "lucide-react";
import { KnowledgeNodeType } from "@/types/knowledge";
import { ApiFetch } from "./useKnowledgeNodes";

const SAVE_KEYWORDS = [
  "zapamiętaj",
  "zapisz",
  "dodaj notatkę",
  "dodaj zadanie",
  "add note",
  "add task",
  "remember that",
  "save this",
];

function isSaveCommand(msg: string): boolean {
  const lower = msg.toLowerCase();
  return SAVE_KEYWORDS.some((k) => lower.includes(k));
}

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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

interface PendingNode {
  type: KnowledgeNodeType;
  title: string;
  content: string;
  tags: string[];
  dueDate?: string;
}

interface Props {
  apiFetch: ApiFetch;
  lang: "pl" | "en";
  onNodeSaved?: () => void;
}

export function KnowledgeChatPanel({ apiFetch, lang, onNodeSaved }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingNode, setPendingNode] = useState<PendingNode | null>(null);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const addMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    scrollToBottom();
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || pendingNode) return;
    const msg = input.trim();
    setInput("");
    addMessage({ role: "user", content: msg });
    setIsLoading(true);

    try {
      if (isSaveCommand(msg)) {
        const res = await apiFetch("/api/knowledge/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPendingNode(data.node);
        scrollToBottom();
      } else {
        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, lang }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        addMessage({ role: "assistant", content: data.text, sources: data.sources });
      }
    } catch {
      addMessage({
        role: "assistant",
        content: lang === "pl" ? "Wystąpił błąd. Spróbuj ponownie." : "An error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!pendingNode) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/knowledge/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pendingNode, sources: [], createdBy: "ai" }),
      });
      if (!res.ok) throw new Error();
      const saved = pendingNode;
      setPendingNode(null);
      addMessage({ role: "assistant", content: `✅ Zapisano: ${saved.title}` });
      onNodeSaved?.();
    } catch {
      addMessage({ role: "assistant", content: lang === "pl" ? "Błąd zapisu." : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSave = () => {
    setPendingNode(null);
    addMessage({ role: "assistant", content: lang === "pl" ? "Pominięto." : "Discarded." });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <Brain size={36} className="text-[var(--text3)] opacity-40" />
            <p className="text-[var(--text3)] text-sm">
              {lang === "pl"
                ? 'Powiedz AI co zapisać lub zadaj pytanie o bazę wiedzy'
                : 'Tell AI what to save or ask about your knowledge base'}
            </p>
            <p className="text-[var(--text3)] text-xs opacity-60">
              {lang === "pl" ? 'Użyj "zapamiętaj" lub "zapisz" aby dodać wiedzę' : 'Use "remember" or "save this" to add knowledge'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg2)] text-[var(--text)]"
              }`}
            >
              <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <p className="mt-1 text-xs opacity-60">{msg.sources.join(", ")}</p>
              )}
            </div>
          </div>
        ))}

        {pendingNode && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            <p className="text-xs text-[var(--text3)]">
              {lang === "pl" ? "Czy zapisać tę wiedzę?" : "Save this to your knowledge base?"}
            </p>
            <div className="flex items-start gap-2">
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-white text-xs font-medium ${TYPE_COLORS[pendingNode.type]}`}
              >
                {TYPE_LABELS[pendingNode.type]}
              </span>
              <p className="font-medium text-[var(--text)] text-sm">{pendingNode.title}</p>
            </div>
            <p className="text-[var(--text2)] text-xs leading-relaxed">{pendingNode.content}</p>
            {pendingNode.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {pendingNode.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded bg-[var(--bg3)] text-[var(--text3)] text-xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleConfirmSave}
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? (lang === "pl" ? "Zapisuję..." : "Saving...") : (lang === "pl" ? "Zapisz" : "Save")}
              </button>
              <button
                onClick={handleCancelSave}
                className="flex-1 py-2 rounded-xl border border-[var(--border)] text-[var(--text2)] text-sm hover:bg-[var(--bg2)] transition-colors"
              >
                {lang === "pl" ? "Anuluj" : "Cancel"}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg2)] rounded-2xl px-4 py-2.5 text-sm text-[var(--text3)]">
              ...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              lang === "pl"
                ? 'Wpisz wiedzę do zapisania lub zadaj pytanie...'
                : 'Type knowledge to save or ask a question...'
            }
            disabled={isLoading || !!pendingNode}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !!pendingNode}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual test plan**

Start dev server (`npm run dev`). Open Baza wiedzy → Chat AI tab.

1. Type "co wiem o React?" — expect AI response based on knowledge base
2. Type "zapamiętaj że TypeScript 5.5 ma nowe deklaracje" — expect preview card appears (type: note, title extracted, content shown)
3. Click "Zapisz" — expect "✅ Zapisano: ..." confirmation message
4. Type "zapamiętaj coś innego" → click "Anuluj" — expect "Pominięto." message
5. Verify input is disabled while preview card is shown

- [ ] **Step 3: Commit**

```bash
git add features/knowledge/KnowledgeChatPanel.tsx
git commit -m "feat: add KnowledgeChatPanel with preview-before-save flow"
```

---

## Task 5: Create KnowledgeView container

**Files:**

- Create: `features/knowledge/KnowledgeView.tsx`

- [ ] **Step 1: Create the file**

```typescript
import React, { useState } from "react";
import { MessageSquare, List, Network } from "lucide-react";
import { ApiFetch } from "./useKnowledgeNodes";
import { KnowledgeChatPanel } from "./KnowledgeChatPanel";
import { KnowledgeListView } from "./KnowledgeListView";
import { KnowledgeGraphView } from "./KnowledgeGraphView";

type InnerTab = "chat" | "list" | "graph";

interface Props {
  apiFetch: ApiFetch;
  lang: "pl" | "en";
}

const TABS: { id: InnerTab; labelPl: string; labelEn: string; Icon: React.ElementType }[] = [
  { id: "chat", labelPl: "Chat AI", labelEn: "AI Chat", Icon: MessageSquare },
  { id: "list", labelPl: "Lista", labelEn: "List", Icon: List },
  { id: "graph", labelPl: "Graf", labelEn: "Graph", Icon: Network },
];

export function KnowledgeView({ apiFetch, lang }: Props) {
  const [activeTab, setActiveTab] = useState<InnerTab>("chat");
  const [listKey, setListKey] = useState(0);

  const handleTabChange = (tab: InnerTab) => {
    setActiveTab(tab);
    if (tab === "list") setListKey((k) => k + 1);
  };

  const handleNodeSaved = () => {
    if (activeTab === "list") setListKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Inner tab bar */}
      <div className="flex gap-1 px-4 pt-2 border-b border-[var(--border)] shrink-0">
        {TABS.map(({ id, labelPl, labelEn, Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text2)] hover:text-[var(--text)]"
            }`}
          >
            <Icon size={14} />
            {lang === "pl" ? labelPl : labelEn}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "chat" && (
          <KnowledgeChatPanel apiFetch={apiFetch} lang={lang} onNodeSaved={handleNodeSaved} />
        )}
        {activeTab === "list" && (
          <KnowledgeListView
            key={listKey}
            apiFetch={apiFetch}
            lang={lang}
            onShowGraph={() => handleTabChange("graph")}
          />
        )}
        {activeTab === "graph" && (
          <KnowledgeGraphView
            apiFetch={apiFetch}
            lang={lang}
            onClose={() => handleTabChange("list")}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual test**

After wiring into `WiedzaView` (Task 8), verify:

1. Default tab is Chat AI
2. Switching to Lista shows node list
3. Switching to Graf shows graph
4. "Wróć" / close in Graf switches back to Lista

- [ ] **Step 3: Commit**

```bash
git add features/knowledge/KnowledgeView.tsx
git commit -m "feat: add KnowledgeView container with chat/list/graph inner tabs"
```

---

## Task 6: Simplify KnowledgeListView

Remove migration UI, type filter tabs, empty-state migrate button. Add per-node delete with trash icon on hover.

**Files:**

- Modify: `features/knowledge/KnowledgeListView.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
import React, { useState, useCallback } from "react";
import { Network, Search, Trash2 } from "lucide-react";
import { KnowledgeNode, KnowledgeNodeType } from "@/types/knowledge";
import { ApiFetch, useKnowledgeNodes, searchKnowledgeNodes, deleteKnowledgeNode } from "./useKnowledgeNodes";
import { KnowledgeNodePanel } from "./KnowledgeNodePanel";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeNode[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);

  const { nodes, loading, refetch } = useKnowledgeNodes(apiFetch);

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

  const handleDeleteNode = async (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(lang === "pl" ? "Usunąć ten węzeł?" : "Delete this node?")) return;
    try {
      await deleteKnowledgeNode(apiFetch, nodeId);
      if (searchResults) {
        setSearchResults((prev) => prev?.filter((n) => n.id !== nodeId) ?? null);
      }
      await refetch();
    } catch {
      // silent — node stays in list
    }
  };

  const handleNodeDeleted = async () => {
    setSelectedNode(null);
    await refetch();
  };

  const displayedNodes = searchResults ?? nodes;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {lang === "pl" ? "Baza wiedzy" : "Knowledge base"}
          </h2>
          <button
            onClick={onShowGraph}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm hover:opacity-90 transition-opacity"
          >
            <Network size={16} />
            {lang === "pl" ? "Pokaż graf" : "Show graph"}
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]"
            />
            <input
              type="text"
              placeholder={lang === "pl" ? "Szukaj semantycznie..." : "Semantic search..."}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] text-sm placeholder:text-[var(--text3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Node list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {loading || searching ? (
            <div className="flex items-center justify-center h-24 text-[var(--text3)] text-sm">
              {lang === "pl" ? "Ładowanie..." : "Loading..."}
            </div>
          ) : displayedNodes.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[var(--text3)] text-sm">
              {searchQuery
                ? (lang === "pl" ? "Brak wyników wyszukiwania" : "No results found")
                : (lang === "pl" ? "Baza wiedzy jest pusta. Dodaj wiedzę przez Chat AI." : "Knowledge base is empty. Add knowledge via AI Chat.")}
            </div>
          ) : (
            displayedNodes.map((node) => (
              <div
                key={node.id}
                className="group relative w-full text-left p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg2)] transition-colors cursor-pointer"
                onClick={() => setSelectedNode(node)}
              >
                <div className="flex items-start gap-2 pr-8">
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
                <button
                  onClick={(e) => handleDeleteNode(node.id, e)}
                  className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 transition-all"
                  aria-label={lang === "pl" ? "Usuń węzeł" : "Delete node"}
                >
                  <Trash2 size={14} />
                </button>
              </div>
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
          onDeleted={handleNodeDeleted}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add features/knowledge/KnowledgeListView.tsx
git commit -m "feat: simplify KnowledgeListView — remove migration, add per-node delete"
```

---

## Task 7: Add delete button to KnowledgeNodePanel

**Files:**

- Modify: `features/knowledge/KnowledgeNodePanel.tsx`

- [ ] **Step 1: Add `onDeleted` to Props interface**

Change:

```typescript
interface Props {
  node: KnowledgeNode;
  apiFetch: ApiFetch;
  onClose: () => void;
}
```

to:

```typescript
interface Props {
  node: KnowledgeNode;
  apiFetch: ApiFetch;
  onClose: () => void;
  onDeleted: () => void;
}
```

- [ ] **Step 2: Add Trash2 to imports and destructure onDeleted**

Change:

```typescript
import { X, Link, Tag } from "lucide-react";
```

to:

```typescript
import { X, Link, Tag, Trash2 } from "lucide-react";
```

Change function signature:

```typescript
export function KnowledgeNodePanel({ node, apiFetch, onClose }: Props) {
```

to:

```typescript
export function KnowledgeNodePanel({ node, apiFetch, onClose, onDeleted }: Props) {
```

- [ ] **Step 3: Add handleDelete function and button**

After the `useEffect` block (after line 38 in original), add:

```typescript
const handleDelete = async () => {
  if (!window.confirm("Usunąć ten węzeł z bazy wiedzy?")) return;
  try {
    await apiFetch(`/api/knowledge/nodes/${node.id}`, { method: "DELETE" });
    onDeleted();
  } catch {
    // silent
  }
};
```

In the header div, add the delete button between the type badge section and the close button:

```typescript
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleDelete}
            aria-label="Usuń węzeł"
            className="p-1 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="p-1 rounded-lg hover:bg-[var(--bg2)] text-[var(--text3)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
```

Replace the existing close-button-only section:

```typescript
        <button
          onClick={onClose}
          aria-label="Zamknij"
          className="shrink-0 p-1 rounded-lg hover:bg-[var(--bg2)] text-[var(--text3)] transition-colors"
        >
          <X size={16} />
        </button>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
# Expected: no errors (KnowledgeListView already passes onDeleted)
```

- [ ] **Step 5: Commit**

```bash
git add features/knowledge/KnowledgeNodePanel.tsx
git commit -m "feat: add delete button to KnowledgeNodePanel"
```

---

## Task 8: Refactor WiedzaView

Remove chat tab, all chat-related state, and replace KnowledgeListView+KnowledgeGraphView with KnowledgeView.

**Files:**

- Modify: `src/features/wiedza/WiedzaView.tsx`

- [ ] **Step 1: Update imports**

Remove:

```typescript
import { ChatPanel, type Message } from "./ChatPanel";
import { KnowledgeListView } from "@/features/knowledge/KnowledgeListView";
import { KnowledgeGraphView } from "@/features/knowledge/KnowledgeGraphView";
```

Add:

```typescript
import { KnowledgeView } from "@/features/knowledge/KnowledgeView";
```

- [ ] **Step 2: Update activeTab type**

Change:

```typescript
const [activeTab, setActiveTab] = useState<
  "chat" | "notes" | "resources" | "mindmaps" | "knowledge"
>("chat");
const [knowledgeViewMode, setKnowledgeViewMode] = useState<"list" | "graph">("list");
```

to:

```typescript
const [activeTab, setActiveTab] = useState<"notes" | "resources" | "mindmaps" | "knowledge">(
  "notes"
);
```

- [ ] **Step 3: Remove chat state and handler**

Remove these state declarations:

```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState("");
const [isLoading, setIsLoading] = useState(false);
const chatEndRef = useRef<HTMLDivElement>(null);
```

Remove the `useEffect` that scrolls chat:

```typescript
useEffect(() => {
  chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);
```

Remove the entire `handleSend` function.

- [ ] **Step 4: Remove chatEndRef from useRef imports if unused**

Check if `useRef` is still used by `fileInputRef`. It is — keep it. Only remove `chatEndRef` variable.

- [ ] **Step 5: Remove `type Message` from exports**

Remove:

```typescript
export type { Message } from "./ChatPanel";
```

- [ ] **Step 6: Update WiedzaSidebarContent call — remove chatTab prop**

Change:

```typescript
        <WiedzaSidebarContent
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          ...
          chatTab={t.chatTab}
          ...
        />
```

Remove the `chatTab={t.chatTab}` line.

- [ ] **Step 7: Replace the entire JSX content block inside `<div className="flex-1 min-w-0 overflow-hidden flex flex-col min-h-0">`**

Replace from `{activeTab === "chat" ? (` through the closing `}` of that block with:

```typescript
          {activeTab === "resources" ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
              <ResourceSection apiFetch={apiFetch} t={t} />
            </div>
          ) : activeTab === "mindmaps" ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
              <MindMapsTab
                apiFetch={apiFetch}
                title={(t.tabMindMaps as string) ?? "Mapy myśli"}
                t={t}
              />
            </div>
          ) : activeTab === "knowledge" ? (
            <KnowledgeView apiFetch={apiFetch} lang={lang} />
          ) : (
            <NotesPanel
              notes={notes}
              selectedNote={selectedNote}
              setSelectedNote={setSelectedNote}
              noteEditMode={noteEditMode}
              setNoteEditMode={setNoteEditMode}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
              newNote={t.newNote}
              noteTitlePlaceholder={t.noteTitlePlaceholder}
              noteContentPlaceholder={t.noteContentPlaceholder}
              noteCancelEdit={t.noteCancelEdit}
              saveNote={t.saveNote}
              noteEdit={t.noteEdit}
              deleteNote={t.deleteNote}
            />
          )}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 9: Commit**

```bash
git add src/features/wiedza/WiedzaView.tsx
git commit -m "feat: remove chat tab from WiedzaView, wire KnowledgeView"
```

---

## Task 9: Update WiedzaSidebarContent

Remove chat tab button and its prop.

**Files:**

- Modify: `src/features/wiedza/WiedzaSidebarContent.tsx`

- [ ] **Step 1: Update Props interface**

Change:

```typescript
export interface WiedzaSidebarContentProps {
  activeTab: "chat" | "notes" | "resources" | "mindmaps" | "knowledge";
  setActiveTab: (tab: "chat" | "notes" | "resources" | "mindmaps" | "knowledge") => void;
  ...
  chatTab: string;
  ...
}
```

to:

```typescript
export interface WiedzaSidebarContentProps {
  activeTab: "notes" | "resources" | "mindmaps" | "knowledge";
  setActiveTab: (tab: "notes" | "resources" | "mindmaps" | "knowledge") => void;
  ...
}
```

Remove `chatTab: string;` from the interface.

- [ ] **Step 2: Update tabClass helper**

Change:

```typescript
  const tabClass = (tab: "chat" | "notes" | "resources" | "mindmaps" | "knowledge") =>
```

to:

```typescript
  const tabClass = (tab: "notes" | "resources" | "mindmaps" | "knowledge") =>
```

- [ ] **Step 3: Remove chatTab from destructuring and chat button from JSX**

Remove `chatTab` from the destructured props. Remove the chat button:

```typescript
        <button type="button" onClick={() => setActiveTab("chat")} className={tabClass("chat")}>
          <MessageSquare className="w-5 h-5 flex-shrink-0" />
          <span>{chatTab}</span>
        </button>
```

- [ ] **Step 4: Remove MessageSquare from imports if unused**

Check remaining lucide imports — `MessageSquare` is no longer used. Remove it:

```typescript
import { Plus, FileText, Link, Trash2, Loader2, Network, Brain } from "lucide-react";
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 6: Commit**

```bash
git add src/features/wiedza/WiedzaSidebarContent.tsx
git commit -m "feat: remove chat tab from WiedzaSidebarContent"
```

---

## Final Verification

- [ ] **Start dev server and do end-to-end test**

```bash
npm run dev
```

1. Open the app → sidebar shows: Notatki, Zasoby, Mapa myśli, Baza wiedzy (no Chat)
2. Click Baza wiedzy → sees inner tabs: Chat AI (active), Lista, Graf
3. Chat AI tab: type a question → AI responds with sources
4. Chat AI tab: type "zapamiętaj że X" → preview card appears → click Zapisz → confirmation message
5. Switch to Lista → the just-saved node appears in list
6. Hover over a node in Lista → red trash icon appears → click → confirm dialog → node removed, list refreshes
7. Click a node in Lista → side panel opens → Trash icon in header → delete → panel closes, list refreshes
8. Switch to Graf → graph renders → close/back button returns to Lista
9. Semantic search in Lista works

- [ ] **Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup after knowledge base redesign"
```
