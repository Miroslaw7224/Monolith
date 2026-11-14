# Knowledge Graph — Plan implementacji: Faza 4 (Migracja i synchronizacja map)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zmigrować istniejące dane (notatki, zasoby, dokumenty, zadania, wydarzenia) do grafu wiedzy oraz dodać przycisk synchronizacji map myśli z bazą wiedzy.

**Architecture:** `migrationService.ts` odczytuje istniejące kolekcje Firestore i tworzy KnowledgeNodes przez `knowledgeNodeService.createNode` (embedding generowany automatycznie). Endpoint `/api/knowledge/migrate` uruchamia migrację dla zalogowanego użytkownika. Endpoint `/api/knowledge/mind-map-sync` konwertuje mapę myśli na węzły z relacjami `part-of`. Przycisk "Synchronizuj z bazą wiedzy" dodany do MindMapsTab. Przycisk "Migruj dane" dodany do KnowledgeListView gdy baza jest pusta.

**Tech Stack:** TypeScript, Firebase Admin SDK (Firestore), OpenAI SDK (via knowledgeNodeService), Vitest

---

## Kontekst kodebazy

### Istniejące kolekcje Firestore (do migracji)

```
users/{userId}/notes           → type: "note"
users/{userId}/resources       → type: "resource"
users/{userId}/documents       → type: "document"
users/{userId}/tasks           → type: "task"
users/{userId}/calendar_events → type: "event"
users/{userId}/mindMaps        → sync on-demand
```

### Typy istniejących rekordów

```typescript
// notes
type NoteRecord = {
  id: string;
  title: string;
  content: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// resources
interface NoteResourceRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// documents
type DocumentRecord = {
  id: string;
  name: string;
  content: string;
  type: string;
  createdAt?: Timestamp;
};

// tasks
type TaskRecord = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// calendar events
type CalendarEventRecord = {
  id: string;
  title: string;
  date: string;
  start_minutes: number;
  duration_minutes: number;
  tags: string[];
  color: string;
  createdAt?: Timestamp;
};

// mind map
interface MindMap {
  id: string;
  userId: string;
  title: string;
  rootNode: MindMapNode;
  createdAt: unknown;
  updatedAt: unknown;
}
interface MindMapNode {
  id: string;
  label: string;
  note: string;
  collapsed: boolean;
  children: MindMapNode[];
}
```

### knowledgeNodeService.createNode (gotowy z Fazy 1)

```typescript
// services/knowledgeNodeService.ts
export async function createNode(userId: string, input: KnowledgeNodeInput): Promise<KnowledgeNode>;
// Automatycznie generuje embedding przez OpenAI text-embedding-3-small
```

### Wzorzec Firestore Admin (z lib/firestore-knowledge.ts)

```typescript
import { getFirestore, Timestamp } from "firebase-admin/firestore";

async function fetchFromCollection<T>(userId: string, collectionName: string): Promise<T[]> {
  const snap = await getFirestore()
    .collection("users")
    .doc(userId)
    .collection(collectionName)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
}
```

### Wzorzec API route (z app/api/knowledge/nodes/route.ts)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  // ...
}
```

### MindMapsTab props

```typescript
export function MindMapsTab({
  apiFetch, // (url: string, options?: RequestInit) => Promise<Response>
  title, // string
  t, // translations object
});
```

---

## Mapa plików

| Plik                                           | Akcja     | Opis                                             |
| ---------------------------------------------- | --------- | ------------------------------------------------ |
| `services/migrationService.ts`                 | Utwórz    | Migracja każdej kolekcji do KnowledgeNodes       |
| `app/api/knowledge/migrate/route.ts`           | Utwórz    | POST endpoint uruchamiający migrację             |
| `app/api/knowledge/mind-map-sync/route.ts`     | Utwórz    | POST endpoint synchronizujący mapę myśli         |
| `src/features/mind-maps/MindMapsTab.tsx`       | Modyfikuj | Dodaj przycisk "Synchronizuj z bazą wiedzy"      |
| `src/features/knowledge/KnowledgeListView.tsx` | Modyfikuj | Dodaj przycisk "Migruj dane" gdy baza jest pusta |
| `tests/unit/services/migrationService.test.ts` | Utwórz    | Testy mapowania typów i logiki migracji          |

---

## Task 1: migrationService — logika migracji kolekcji

**Files:**

- Create: `services/migrationService.ts`
- Create: `tests/unit/services/migrationService.test.ts`

- [ ] **Step 1: Napisz failing testy**

Utwórz `tests/unit/services/migrationService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const mockNodeService = vi.hoisted(() => ({
  createNode: vi.fn(),
}));

const mockFirestore = vi.hoisted(() => {
  const get = vi.fn();
  const collection = vi.fn().mockReturnThis();
  const doc = vi.fn().mockReturnThis();
  return { getFirestore: vi.fn(() => ({ collection, doc })), get, collection, doc };
});

vi.mock("@/services/knowledgeNodeService", () => mockNodeService);
vi.mock("firebase-admin/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase-admin/firestore")>();
  return {
    ...actual,
    getFirestore: mockFirestore.getFirestore,
  };
});

const fakeTimestamp = Timestamp.fromDate(new Date("2026-01-01"));

function makeFirestoreSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  };
}

describe("migrationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNodeService.createNode.mockResolvedValue({ id: "new-node" });
  });

  describe("migrateNotes", () => {
    it("tworzy węzeł dla każdej notatki", async () => {
      const snap = makeFirestoreSnap([
        {
          id: "note-1",
          data: { title: "Notatka 1", content: "Treść notatki", createdAt: fakeTimestamp },
        },
        {
          id: "note-2",
          data: { title: "Notatka 2", content: "Druga treść", createdAt: fakeTimestamp },
        },
      ]);
      mockFirestore.getFirestore.mockReturnValue({
        collection: () => ({
          doc: () => ({ collection: () => ({ get: () => Promise.resolve(snap) }) }),
        }),
      });

      const { migrateNotes } = await import("@/services/migrationService");
      const count = await migrateNotes("user-1");

      expect(count).toBe(2);
      expect(mockNodeService.createNode).toHaveBeenCalledTimes(2);
      expect(mockNodeService.createNode).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          type: "note",
          title: "Notatka 1",
          content: "Treść notatki",
          createdBy: "user",
        })
      );
    });
  });

  describe("migrateTasks", () => {
    it("mapuje due_date na dueDate w węźle", async () => {
      const snap = makeFirestoreSnap([
        {
          id: "task-1",
          data: {
            title: "Zadanie testowe",
            description: "Opis zadania",
            due_date: "2026-06-01",
            status: "todo",
            createdAt: fakeTimestamp,
          },
        },
      ]);
      mockFirestore.getFirestore.mockReturnValue({
        collection: () => ({
          doc: () => ({ collection: () => ({ get: () => Promise.resolve(snap) }) }),
        }),
      });

      const { migrateTasks } = await import("@/services/migrationService");
      await migrateTasks("user-1");

      expect(mockNodeService.createNode).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          type: "task",
          title: "Zadanie testowe",
          content: "Opis zadania",
          dueDate: "2026-06-01",
        })
      );
    });
  });

  describe("migrateResources", () => {
    it("mapuje url zasobu na sources", async () => {
      const snap = makeFirestoreSnap([
        {
          id: "res-1",
          data: {
            title: "Przydatny zasób",
            description: "Opis zasobu",
            url: "https://example.com",
            tags: ["tech"],
            createdAt: fakeTimestamp,
            updatedAt: fakeTimestamp,
          },
        },
      ]);
      mockFirestore.getFirestore.mockReturnValue({
        collection: () => ({
          doc: () => ({ collection: () => ({ get: () => Promise.resolve(snap) }) }),
        }),
      });

      const { migrateResources } = await import("@/services/migrationService");
      await migrateResources("user-1");

      expect(mockNodeService.createNode).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          type: "resource",
          title: "Przydatny zasób",
          tags: ["tech"],
          sources: [{ title: "Przydatny zasób", url: "https://example.com" }],
        })
      );
    });
  });

  describe("migrateCalendarEvents", () => {
    it("mapuje date na dueDate w węźle event", async () => {
      const snap = makeFirestoreSnap([
        {
          id: "event-1",
          data: {
            title: "Spotkanie",
            date: "2026-06-15",
            start_minutes: 540,
            duration_minutes: 60,
            tags: ["praca"],
            createdAt: fakeTimestamp,
          },
        },
      ]);
      mockFirestore.getFirestore.mockReturnValue({
        collection: () => ({
          doc: () => ({ collection: () => ({ get: () => Promise.resolve(snap) }) }),
        }),
      });

      const { migrateCalendarEvents } = await import("@/services/migrationService");
      await migrateCalendarEvents("user-1");

      expect(mockNodeService.createNode).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          type: "event",
          title: "Spotkanie",
          dueDate: "2026-06-15",
          tags: ["praca"],
        })
      );
    });
  });

  describe("migrateAll", () => {
    it("zwraca łączną liczbę zmigrowanych rekordów", async () => {
      // Each collection returns 1 item
      const snap1 = makeFirestoreSnap([
        { id: "n1", data: { title: "A", content: "B", createdAt: fakeTimestamp } },
      ]);
      let callCount = 0;
      mockFirestore.getFirestore.mockReturnValue({
        collection: () => ({
          doc: () => ({
            collection: () => ({
              get: () => {
                callCount++;
                return Promise.resolve(snap1);
              },
            }),
          }),
        }),
      });

      const { migrateAll } = await import("@/services/migrationService");
      const result = await migrateAll("user-1");

      // notes + resources + documents + tasks + calendar_events = 5 collections
      expect(result.total).toBeGreaterThan(0);
      expect(typeof result.notes).toBe("number");
      expect(typeof result.resources).toBe("number");
      expect(typeof result.documents).toBe("number");
      expect(typeof result.tasks).toBe("number");
      expect(typeof result.events).toBe("number");
    });
  });
});
```

- [ ] **Step 2: Uruchom test — FAIL**

```bash
npx vitest run tests/unit/services/migrationService.test.ts
```

Oczekiwany output: FAIL — `Cannot find module '@/services/migrationService'`

- [ ] **Step 3: Zaimplementuj serwis migracji**

Utwórz `services/migrationService.ts`:

```typescript
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as knowledgeNodeService from "@/services/knowledgeNodeService";
import { KnowledgeNodeInput } from "@/types/knowledge";

async function fetchCollection<T>(userId: string, collectionName: string): Promise<T[]> {
  const snap = await getFirestore()
    .collection("users")
    .doc(userId)
    .collection(collectionName)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
}

export async function migrateNotes(userId: string): Promise<number> {
  const notes = await fetchCollection<{
    id: string;
    title: string;
    content: string;
    createdAt?: Timestamp;
  }>(userId, "notes");

  await Promise.all(
    notes.map((note) =>
      knowledgeNodeService.createNode(userId, {
        type: "note",
        title: note.title || "Bez tytułu",
        content: note.content || "",
        tags: [],
        sources: [],
        createdBy: "user",
      } satisfies KnowledgeNodeInput)
    )
  );
  return notes.length;
}

export async function migrateResources(userId: string): Promise<number> {
  const resources = await fetchCollection<{
    id: string;
    title: string;
    description: string;
    url: string;
    tags: string[];
    createdAt?: Timestamp;
  }>(userId, "resources");

  await Promise.all(
    resources.map((r) =>
      knowledgeNodeService.createNode(userId, {
        type: "resource",
        title: r.title || "Bez tytułu",
        content: r.description || "",
        tags: r.tags ?? [],
        sources: [{ title: r.title, url: r.url }],
        createdBy: "user",
      } satisfies KnowledgeNodeInput)
    )
  );
  return resources.length;
}

export async function migrateDocuments(userId: string): Promise<number> {
  const documents = await fetchCollection<{
    id: string;
    name: string;
    content: string;
    createdAt?: Timestamp;
  }>(userId, "documents");

  await Promise.all(
    documents.map((doc) =>
      knowledgeNodeService.createNode(userId, {
        type: "document",
        title: doc.name || "Bez tytułu",
        content: (doc.content || "").slice(0, 500),
        tags: [],
        sources: [],
        createdBy: "user",
      } satisfies KnowledgeNodeInput)
    )
  );
  return documents.length;
}

export async function migrateTasks(userId: string): Promise<number> {
  const tasks = await fetchCollection<{
    id: string;
    title: string;
    description: string;
    due_date: string | null;
    createdAt?: Timestamp;
  }>(userId, "tasks");

  await Promise.all(
    tasks.map((task) =>
      knowledgeNodeService.createNode(userId, {
        type: "task",
        title: task.title || "Bez tytułu",
        content: task.description || "",
        tags: [],
        sources: [],
        dueDate: task.due_date ?? undefined,
        createdBy: "user",
      } satisfies KnowledgeNodeInput)
    )
  );
  return tasks.length;
}

export async function migrateCalendarEvents(userId: string): Promise<number> {
  const events = await fetchCollection<{
    id: string;
    title: string;
    date: string;
    start_minutes: number;
    duration_minutes: number;
    tags: string[];
    createdAt?: Timestamp;
  }>(userId, "calendar_events");

  await Promise.all(
    events.map((evt) =>
      knowledgeNodeService.createNode(userId, {
        type: "event",
        title: evt.title || "Bez tytułu",
        content: `${evt.date} ${Math.floor(evt.start_minutes / 60)}:${String(evt.start_minutes % 60).padStart(2, "0")} (${evt.duration_minutes} min)`,
        tags: evt.tags ?? [],
        sources: [],
        dueDate: evt.date,
        createdBy: "user",
      } satisfies KnowledgeNodeInput)
    )
  );
  return events.length;
}

export async function migrateAll(userId: string): Promise<{
  notes: number;
  resources: number;
  documents: number;
  tasks: number;
  events: number;
  total: number;
}> {
  const [notes, resources, documents, tasks, events] = await Promise.all([
    migrateNotes(userId).catch(() => 0),
    migrateResources(userId).catch(() => 0),
    migrateDocuments(userId).catch(() => 0),
    migrateTasks(userId).catch(() => 0),
    migrateCalendarEvents(userId).catch(() => 0),
  ]);
  return {
    notes,
    resources,
    documents,
    tasks,
    events,
    total: notes + resources + documents + tasks + events,
  };
}
```

- [ ] **Step 4: Uruchom test — PASS**

```bash
npx vitest run tests/unit/services/migrationService.test.ts
```

Oczekiwany output: PASS (5 testów). Jeśli testy padają przez skomplikowane mockowanie Firestore, uprość mock tak, żeby `getFirestore()` → `{ collection: () => ({ doc: () => ({ collection: () => ({ get: () => Promise.resolve(snap) }) }) }) }`.

- [ ] **Step 5: Uruchom wszystkie testy — brak regresji**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add services/migrationService.ts tests/unit/services/migrationService.test.ts
git commit -m "feat: add migrationService for converting existing data to KnowledgeNodes"
```

---

## Task 2: API endpoints — migracja i synchronizacja map myśli

**Files:**

- Create: `app/api/knowledge/migrate/route.ts`
- Create: `app/api/knowledge/mind-map-sync/route.ts`

- [ ] **Step 1: Utwórz endpoint migracji**

Utwórz `app/api/knowledge/migrate/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { migrateAll } from "@/services/migrationService";

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await migrateAll(auth.uid);
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 2: Utwórz endpoint synchronizacji map myśli**

Najpierw przeczytaj `types/mindMap.ts` (lub podobny plik) żeby znaleźć MindMap i MindMapNode typy. Jeśli typy są w innym miejscu, dostosuj importy.

Utwórz `app/api/knowledge/mind-map-sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { getFirestore } from "firebase-admin/firestore";
import * as knowledgeNodeService from "@/services/knowledgeNodeService";
import * as knowledgeEdgeService from "@/services/knowledgeEdgeService";
import { KnowledgeNodeInput } from "@/types/knowledge";

interface MindMapNode {
  id: string;
  label: string;
  note: string;
  children: MindMapNode[];
}

function stripHtml(html: string): string {
  return (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function flattenNodes(
  node: MindMapNode,
  parentId: string | null = null
): Array<{ node: MindMapNode; parentId: string | null }> {
  return [
    { node, parentId },
    ...(node.children ?? []).flatMap((child) => flattenNodes(child, node.id)),
  ];
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { mindMapId } = body as { mindMapId?: string };
  if (!mindMapId) {
    return NextResponse.json({ error: "mindMapId is required" }, { status: 400 });
  }

  try {
    const mapDoc = await getFirestore()
      .collection("users")
      .doc(auth.uid)
      .collection("mindMaps")
      .doc(mindMapId)
      .get();

    if (!mapDoc.exists) {
      return NextResponse.json({ error: "Mind map not found" }, { status: 404 });
    }

    const mapData = mapDoc.data() as { title: string; rootNode: MindMapNode };
    const allNodes = flattenNodes(mapData.rootNode);

    // Map mindMapNode.id → KnowledgeNode.id for building edges
    const idMap = new Map<string, string>();

    // Create KnowledgeNodes sequentially to avoid rate limits
    for (const { node } of allNodes) {
      const input: KnowledgeNodeInput = {
        type: "note",
        title: node.label || "Bez tytułu",
        content: stripHtml(node.note),
        tags: [],
        sources: [{ title: mapData.title, nodeId: mindMapId }],
        createdBy: "user",
      };
      const created = await knowledgeNodeService.createNode(auth.uid, input);
      idMap.set(node.id, created.id);
    }

    // Create part-of edges
    const edgePromises = allNodes
      .filter(({ parentId }) => parentId !== null)
      .map(({ node, parentId }) => {
        const fromId = idMap.get(node.id);
        const toId = idMap.get(parentId!);
        if (!fromId || !toId) return Promise.resolve();
        return knowledgeEdgeService.createEdge(auth.uid, {
          fromNodeId: fromId,
          toNodeId: toId,
          relation: "part-of",
          strength: 1.0,
        });
      });

    await Promise.all(edgePromises);

    return NextResponse.json({
      nodes: allNodes.length,
      edges: allNodes.filter(({ parentId }) => parentId !== null).length,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 3: Sprawdź typy**

```bash
npx tsc --noEmit
```

Napraw błędy TypeScript. Jeśli `MindMapNode` lub `MindMap` typy są już zdefiniowane w projekcie (np. `types/mindMap.ts`), użyj ich zamiast lokalnej definicji — ale upewnij się że importy są poprawne.

- [ ] **Step 4: Uruchom wszystkie testy**

```bash
npx vitest run
```

Oczekiwany output: wszystkie testy PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/knowledge/migrate/route.ts app/api/knowledge/mind-map-sync/route.ts
git commit -m "feat: add migration and mind-map-sync API endpoints"
```

---

## Task 3: UI — przycisk synchronizacji w MindMapsTab i migracji w KnowledgeListView

**Files:**

- Modify: `src/features/mind-maps/MindMapsTab.tsx`
- Modify: `src/features/knowledge/KnowledgeListView.tsx`

**WAŻNE:** Przeczytaj oba pliki w CAŁOŚCI przed edycją.

- [ ] **Step 1: Przeczytaj MindMapsTab.tsx**

Odczytaj `src/features/mind-maps/MindMapsTab.tsx`. Zanotuj:

- Jak zarządzany jest stan aktualnie wybranej mapy myśli (szukaj zmiennych stanu jak `currentMap`, `selectedMap`, `activeMap` itp.)
- Gdzie renderowany jest edytor mapy (po załadowaniu mapy)
- Jak struktura komponentu pozwala na dodanie przycisku w górnym pasku edytora
- Jak działa `apiFetch` prop

- [ ] **Step 2: Dodaj przycisk synchronizacji do MindMapsTab**

W pliku `src/features/mind-maps/MindMapsTab.tsx` dodaj:

**Import ikony** (z lucide-react, już powinien być importowany):

```typescript
import { Database } from "lucide-react";
// lub inną dostępną ikonę z lucide-react jeśli Database nie jest dostępna
```

**Stan synchronizacji** (wewnątrz komponentu, obok istniejących stanów):

```typescript
const [syncing, setSyncing] = useState(false);
const [syncMessage, setSyncMessage] = useState<string | null>(null);
```

**Funkcja synchronizacji** (wewnątrz komponentu):

```typescript
const handleSyncToKnowledge = async (mapId: string) => {
  setSyncing(true);
  setSyncMessage(null);
  try {
    const res = await apiFetch("/api/knowledge/mind-map-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mindMapId: mapId }),
    });
    if (!res.ok) throw new Error("Błąd synchronizacji");
    const data = await res.json();
    setSyncMessage(`Zsynchronizowano ${data.nodes} węzłów`);
  } catch {
    setSyncMessage("Błąd synchronizacji");
  } finally {
    setSyncing(false);
    setTimeout(() => setSyncMessage(null), 4000);
  }
};
```

**Przycisk** — dodaj w miejscu gdzie renderuje się nagłówek/toolbar aktywnej mapy myśli. Znajdź odpowiednie miejsce (np. obok tytułu mapy lub w górnym pasku). Wzorzec przycisku:

```tsx
{
  currentMap /* currentMap — dostosuj do nazwy zmiennej w tym pliku */ && (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleSyncToKnowledge(currentMap.id)}
        disabled={syncing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text2)] text-xs hover:bg-[var(--bg2)] transition-colors disabled:opacity-50"
      >
        <Database size={14} />
        {syncing ? "Synchronizuję..." : "Synchronizuj z bazą wiedzy"}
      </button>
      {syncMessage && <span className="text-xs text-[var(--text3)]">{syncMessage}</span>}
    </div>
  );
}
```

Dostosuj nazwę zmiennej `currentMap` do rzeczywistej zmiennej stanu w pliku.

- [ ] **Step 3: Przeczytaj KnowledgeListView.tsx**

Odczytaj `src/features/knowledge/KnowledgeListView.tsx`. Zanotuj:

- Gdzie sprawdzany jest `displayedNodes.length === 0`
- Jak wygląda sekcja pustego stanu ("Baza wiedzy jest pusta")

- [ ] **Step 4: Dodaj przycisk migracji do KnowledgeListView**

W `src/features/knowledge/KnowledgeListView.tsx` dodaj:

**Stany migracji** (wewnątrz komponentu, obok `searching`):

```typescript
const [migrating, setMigrating] = useState(false);
const [migrateResult, setMigrateResult] = useState<string | null>(null);
```

**Funkcja migracji**:

```typescript
const handleMigrate = async () => {
  setMigrating(true);
  setMigrateResult(null);
  try {
    const res = await apiFetch("/api/knowledge/migrate", { method: "POST" });
    if (!res.ok) throw new Error("Błąd migracji");
    const data = await res.json();
    setMigrateResult(`Zmigrowano ${data.total} rekordów`);
    // Odśwież listę węzłów po migracji
    // refetch() — jeśli useKnowledgeNodes udostępnia refetch, wywołaj go tutaj
  } catch {
    setMigrateResult("Błąd migracji danych");
  } finally {
    setMigrating(false);
  }
};
```

**Zmień sekcję pustego stanu** — gdy baza jest pusta (nie w trybie wyszukiwania), pokaż przycisk migracji:

Znajdź ten fragment (lub podobny):

```tsx
<div className="flex items-center justify-center h-24 text-[var(--text3)] text-sm">
  {searchQuery ? ... : lang === "pl" ? "Baza wiedzy jest pusta" : ...}
</div>
```

Zastąp sekcję pustego stanu (gdy nie ma searchQuery):

```tsx
{
  !searchQuery && displayedNodes.length === 0 && (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <p className="text-[var(--text3)] text-sm">
        {lang === "pl" ? "Baza wiedzy jest pusta" : "Knowledge base is empty"}
      </p>
      <button
        onClick={handleMigrate}
        disabled={migrating}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {migrating
          ? lang === "pl"
            ? "Migruję..."
            : "Migrating..."
          : lang === "pl"
            ? "Migruj istniejące dane"
            : "Migrate existing data"}
      </button>
      {migrateResult && <p className="text-xs text-[var(--text3)]">{migrateResult}</p>}
    </div>
  );
}
```

Upewnij się że istniejący empty-state dla `searchQuery` (brak wyników wyszukiwania) jest zachowany osobno.

- [ ] **Step 5: Sprawdź typy i uruchom testy**

```bash
npx tsc --noEmit && npx vitest run
```

Oczekiwany output: brak nowych błędów TS, wszystkie testy PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/mind-maps/MindMapsTab.tsx src/features/knowledge/KnowledgeListView.tsx
git commit -m "feat: add sync-to-knowledge button in MindMapsTab and migrate button in KnowledgeListView"
```

---

## Weryfikacja końcowa Fazy 4

- [ ] **Uruchom pełny suite testów**

```bash
npx vitest run
```

Oczekiwany output: wszystkie testy PASS

- [ ] **Sprawdź typy**

```bash
npx tsc --noEmit
```

Oczekiwany output: brak nowych błędów

---

## Uwagi dla użytkownika po wdrożeniu

- **Klucz OpenAI:** upewnij się że `.env.local` zawiera prawdziwy klucz `OPENAI_API_KEY` (nie placeholder) — migracja generuje embeddingi przez OpenAI API
- **Jednorazowość:** przycisk "Migruj istniejące dane" może tworzyć duplikaty przy ponownym uruchomieniu — użyj go tylko raz
- **Koszt:** migracja 1000 rekordów ≈ $0.02 (embeddingi) + pomijalne (GPT nie jest używany podczas migracji)
