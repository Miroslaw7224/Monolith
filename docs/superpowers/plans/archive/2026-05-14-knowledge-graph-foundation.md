# Knowledge Graph — Plan implementacji: Faza 1 (Foundation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stworzyć fundament bazy wiedzy — typy TypeScript, klienta OpenAI, funkcje Firestore dla węzłów i krawędzi, serwisy oraz API routes do CRUD operacji.

**Architecture:** Nowy moduł `@/lib/firestore-knowledge.ts` przechowuje wszystkie operacje Firestore na węzłach i krawędziach. Serwisy (`knowledgeNodeService`, `knowledgeEdgeService`) owijają go w logikę biznesową (generowanie embeddingów, cascade delete). API routes (`/api/knowledge/nodes`, `/api/knowledge/edges`) ekspozują operacje na zewnątrz z autoryzacją.

**Tech Stack:** TypeScript, Firebase Admin SDK (Firestore), OpenAI SDK (`openai` package), Vitest (testy)

---

## Mapa plików

| Plik                                               | Akcja     | Opis                                          |
| -------------------------------------------------- | --------- | --------------------------------------------- |
| `types/knowledge.ts`                               | Utwórz    | Interfejsy TypeScript dla całego systemu      |
| `lib/openai.ts`                                    | Utwórz    | Klient OpenAI (singleton) + generateEmbedding |
| `lib/firestore-knowledge.ts`                       | Utwórz    | CRUD Firestore dla węzłów i krawędzi          |
| `services/knowledgeNodeService.ts`                 | Utwórz    | Node CRUD + embedding + cascade delete        |
| `services/knowledgeEdgeService.ts`                 | Utwórz    | Edge CRUD                                     |
| `app/api/knowledge/nodes/route.ts`                 | Utwórz    | REST API dla węzłów                           |
| `app/api/knowledge/edges/route.ts`                 | Utwórz    | REST API dla krawędzi                         |
| `tests/unit/services/knowledgeNodeService.test.ts` | Utwórz    | Testy jednostkowe                             |
| `tests/unit/services/knowledgeEdgeService.test.ts` | Utwórz    | Testy jednostkowe                             |
| `.env.local`                                       | Modyfikuj | Dodaj OPENAI_API_KEY                          |

---

## Task 1: Zainstaluj zależności i skonfiguruj środowisko

**Files:**

- Modify: `package.json` (automatycznie przez npm)
- Modify: `.env.local` (dodaj klucz)

- [ ] **Step 1: Zainstaluj pakiet OpenAI**

```bash
npm install openai
```

Oczekiwany output: `added 1 package` (lub podobny)

- [ ] **Step 2: Dodaj OPENAI_API_KEY do .env.local**

Otwórz `.env.local` i dodaj linię:

```
OPENAI_API_KEY=sk-proj-twój-klucz-tutaj
```

- [ ] **Step 3: Zweryfikuj instalację**

```bash
node -e "const { OpenAI } = require('openai'); console.log('OK')"
```

Oczekiwany output: `OK`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add openai package"
```

---

## Task 2: Typy TypeScript

**Files:**

- Create: `types/knowledge.ts`

- [ ] **Step 1: Utwórz plik typów**

```typescript
// types/knowledge.ts
import { Timestamp } from "firebase-admin/firestore";

export type KnowledgeNodeType = "note" | "task" | "resource" | "chat" | "document" | "event";

export type KnowledgeRelation = "related" | "supports" | "contradicts" | "part-of" | "derived-from";

export interface KnowledgeSource {
  title: string;
  url?: string;
  nodeId?: string;
}

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  title: string;
  content: string;
  tags: string[];
  sources: KnowledgeSource[];
  embedding: number[];
  dueDate?: string;
  reminderAt?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: "user" | "ai";
}

export interface KnowledgeNodeInput {
  type: KnowledgeNodeType;
  title: string;
  content: string;
  tags?: string[];
  sources?: KnowledgeSource[];
  dueDate?: string;
  reminderAt?: string;
  createdBy: "user" | "ai";
}

export interface KnowledgeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: KnowledgeRelation;
  strength: number;
  createdAt: Timestamp;
}

export interface KnowledgeEdgeInput {
  fromNodeId: string;
  toNodeId: string;
  relation: KnowledgeRelation;
  strength: number;
}
```

- [ ] **Step 2: Sprawdź poprawność typów**

```bash
npx tsc --noEmit
```

Oczekiwany output: brak błędów

- [ ] **Step 3: Commit**

```bash
git add types/knowledge.ts
git commit -m "feat: add knowledge graph TypeScript types"
```

---

## Task 3: Klient OpenAI

**Files:**

- Create: `lib/openai.ts`
- Test: `tests/unit/lib/openai.test.ts`

- [ ] **Step 1: Napisz failing test**

```typescript
// tests/unit/lib/openai.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: mockCreate,
    },
  })),
}));

describe("generateEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  it("zwraca embedding jako number[]", async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);
    mockCreate.mockResolvedValue({
      data: [{ embedding: fakeEmbedding }],
    });

    const { generateEmbedding } = await import("@/lib/openai");
    const result = await generateEmbedding("test text");

    expect(mockCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "test text",
    });
    expect(result).toEqual(fakeEmbedding);
    expect(result).toHaveLength(1536);
  });

  it("rzuca błąd gdy OPENAI_API_KEY nie jest ustawiony", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const { generateEmbedding } = await import("@/lib/openai");
    await expect(generateEmbedding("test")).rejects.toThrow("OPENAI_API_KEY");
  });
});
```

- [ ] **Step 2: Uruchom test — upewnij się że nie przechodzi**

```bash
npx vitest run tests/unit/lib/openai.test.ts
```

Oczekiwany output: FAIL — `Cannot find module '@/lib/openai'`

- [ ] **Step 3: Utwórz klienta OpenAI**

```typescript
// lib/openai.ts
import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}
```

- [ ] **Step 4: Uruchom test — upewnij się że przechodzi**

```bash
npx vitest run tests/unit/lib/openai.test.ts
```

Oczekiwany output: PASS (2 testy)

- [ ] **Step 5: Commit**

```bash
git add lib/openai.ts tests/unit/lib/openai.test.ts
git commit -m "feat: add OpenAI client with generateEmbedding"
```

---

## Task 4: Funkcje Firestore dla węzłów i krawędzi

**Files:**

- Create: `lib/firestore-knowledge.ts`

Nie ma osobnych testów — ta warstwa jest testowana przez serwisy w Task 5 i 6.

- [ ] **Step 1: Utwórz moduł Firestore**

```typescript
// lib/firestore-knowledge.ts
import { getFirestore } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  KnowledgeNode,
  KnowledgeNodeInput,
  KnowledgeEdge,
  KnowledgeEdgeInput,
  KnowledgeNodeType,
} from "@/types/knowledge";

const USERS = "users";
const NODES = "knowledgeNodes";
const EDGES = "knowledgeEdges";

function nodesCol(userId: string) {
  return getFirestore().collection(USERS).doc(userId).collection(NODES);
}

function edgesCol(userId: string) {
  return getFirestore().collection(USERS).doc(userId).collection(EDGES);
}

export async function createKnowledgeNode(
  userId: string,
  input: KnowledgeNodeInput & { embedding: number[] }
): Promise<KnowledgeNode> {
  const ref = nodesCol(userId).doc();
  const now = Timestamp.now();
  const node: KnowledgeNode = {
    id: ref.id,
    type: input.type,
    title: input.title,
    content: input.content,
    tags: input.tags ?? [],
    sources: input.sources ?? [],
    embedding: input.embedding,
    dueDate: input.dueDate,
    reminderAt: input.reminderAt,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };
  await ref.set(node);
  return node;
}

export async function getKnowledgeNode(
  userId: string,
  nodeId: string
): Promise<KnowledgeNode | null> {
  const snap = await nodesCol(userId).doc(nodeId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as KnowledgeNode;
}

export async function updateKnowledgeNode(
  userId: string,
  nodeId: string,
  updates: Partial<Omit<KnowledgeNode, "id" | "createdAt" | "createdBy">>
): Promise<KnowledgeNode> {
  const ref = nodesCol(userId).doc(nodeId);
  await ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
  const snap = await ref.get();
  return { id: snap.id, ...snap.data() } as KnowledgeNode;
}

export async function deleteKnowledgeNode(userId: string, nodeId: string): Promise<void> {
  await nodesCol(userId).doc(nodeId).delete();
}

export async function listKnowledgeNodes(
  userId: string,
  type?: KnowledgeNodeType
): Promise<KnowledgeNode[]> {
  let query = nodesCol(userId).orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (type) query = query.where("type", "==", type);
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KnowledgeNode);
}

export async function createKnowledgeEdge(
  userId: string,
  input: KnowledgeEdgeInput
): Promise<KnowledgeEdge> {
  const ref = edgesCol(userId).doc();
  const edge: KnowledgeEdge = {
    id: ref.id,
    ...input,
    createdAt: Timestamp.now(),
  };
  await ref.set(edge);
  return edge;
}

export async function getEdgesForNode(userId: string, nodeId: string): Promise<KnowledgeEdge[]> {
  const [fromSnap, toSnap] = await Promise.all([
    edgesCol(userId).where("fromNodeId", "==", nodeId).get(),
    edgesCol(userId).where("toNodeId", "==", nodeId).get(),
  ]);
  const seen = new Set<string>();
  const edges: KnowledgeEdge[] = [];
  for (const doc of [...fromSnap.docs, ...toSnap.docs]) {
    if (!seen.has(doc.id)) {
      seen.add(doc.id);
      edges.push({ id: doc.id, ...doc.data() } as KnowledgeEdge);
    }
  }
  return edges;
}

export async function deleteEdgesForNode(userId: string, nodeId: string): Promise<void> {
  const [fromSnap, toSnap] = await Promise.all([
    edgesCol(userId).where("fromNodeId", "==", nodeId).get(),
    edgesCol(userId).where("toNodeId", "==", nodeId).get(),
  ]);
  const batch = getFirestore().batch();
  for (const doc of [...fromSnap.docs, ...toSnap.docs]) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

export async function deleteKnowledgeEdge(userId: string, edgeId: string): Promise<void> {
  await edgesCol(userId).doc(edgeId).delete();
}

export async function listAllKnowledgeNodesWithEmbeddings(
  userId: string
): Promise<KnowledgeNode[]> {
  const snap = await nodesCol(userId)
    .select("id", "title", "content", "type", "embedding", "sources")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KnowledgeNode);
}
```

- [ ] **Step 2: Sprawdź typy**

```bash
npx tsc --noEmit
```

Oczekiwany output: brak błędów

- [ ] **Step 3: Commit**

```bash
git add lib/firestore-knowledge.ts
git commit -m "feat: add Firestore functions for knowledge nodes and edges"
```

---

## Task 5: knowledgeNodeService

**Files:**

- Create: `services/knowledgeNodeService.ts`
- Create: `tests/unit/services/knowledgeNodeService.test.ts`

- [ ] **Step 1: Napisz failing testy**

```typescript
// tests/unit/services/knowledgeNodeService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const mockFirestoreKnowledge = vi.hoisted(() => ({
  createKnowledgeNode: vi.fn(),
  getKnowledgeNode: vi.fn(),
  updateKnowledgeNode: vi.fn(),
  deleteKnowledgeNode: vi.fn(),
  deleteEdgesForNode: vi.fn(),
  listKnowledgeNodes: vi.fn(),
}));

const mockOpenai = vi.hoisted(() => ({
  generateEmbedding: vi.fn(),
}));

vi.mock("@/lib/firestore-knowledge", () => mockFirestoreKnowledge);
vi.mock("@/lib/openai", () => mockOpenai);

const fakeEmbedding = Array.from({ length: 1536 }, () => 0.1);
const fakeTimestamp = Timestamp.fromDate(new Date("2026-01-01"));

const fakeNode = {
  id: "node-1",
  type: "note" as const,
  title: "Test",
  content: "Content",
  tags: [],
  sources: [],
  embedding: fakeEmbedding,
  createdAt: fakeTimestamp,
  updatedAt: fakeTimestamp,
  createdBy: "user" as const,
};

describe("knowledgeNodeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenai.generateEmbedding.mockResolvedValue(fakeEmbedding);
  });

  describe("createNode", () => {
    it("generuje embedding i tworzy węzeł w Firestore", async () => {
      mockFirestoreKnowledge.createKnowledgeNode.mockResolvedValue(fakeNode);
      const { createNode } = await import("@/services/knowledgeNodeService");

      const result = await createNode("user-1", {
        type: "note",
        title: "Test",
        content: "Content",
        createdBy: "user",
      });

      expect(mockOpenai.generateEmbedding).toHaveBeenCalledWith("Test\nContent");
      expect(mockFirestoreKnowledge.createKnowledgeNode).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ title: "Test", content: "Content", embedding: fakeEmbedding })
      );
      expect(result).toEqual(fakeNode);
    });
  });

  describe("getNode", () => {
    it("zwraca węzeł z Firestore", async () => {
      mockFirestoreKnowledge.getKnowledgeNode.mockResolvedValue(fakeNode);
      const { getNode } = await import("@/services/knowledgeNodeService");

      const result = await getNode("user-1", "node-1");

      expect(mockFirestoreKnowledge.getKnowledgeNode).toHaveBeenCalledWith("user-1", "node-1");
      expect(result).toEqual(fakeNode);
    });
  });

  describe("deleteNode", () => {
    it("usuwa węzeł i jego krawędzie", async () => {
      mockFirestoreKnowledge.deleteKnowledgeNode.mockResolvedValue(undefined);
      mockFirestoreKnowledge.deleteEdgesForNode.mockResolvedValue(undefined);
      const { deleteNode } = await import("@/services/knowledgeNodeService");

      await deleteNode("user-1", "node-1");

      expect(mockFirestoreKnowledge.deleteKnowledgeNode).toHaveBeenCalledWith("user-1", "node-1");
      expect(mockFirestoreKnowledge.deleteEdgesForNode).toHaveBeenCalledWith("user-1", "node-1");
    });
  });

  describe("listNodes", () => {
    it("zwraca listę węzłów z opcjonalnym filtrem po typie", async () => {
      mockFirestoreKnowledge.listKnowledgeNodes.mockResolvedValue([fakeNode]);
      const { listNodes } = await import("@/services/knowledgeNodeService");

      const result = await listNodes("user-1", "note");

      expect(mockFirestoreKnowledge.listKnowledgeNodes).toHaveBeenCalledWith("user-1", "note");
      expect(result).toEqual([fakeNode]);
    });
  });
});
```

- [ ] **Step 2: Uruchom testy — upewnij się że nie przechodzą**

```bash
npx vitest run tests/unit/services/knowledgeNodeService.test.ts
```

Oczekiwany output: FAIL — `Cannot find module '@/services/knowledgeNodeService'`

- [ ] **Step 3: Zaimplementuj serwis**

```typescript
// services/knowledgeNodeService.ts
import * as firestoreKnowledge from "@/lib/firestore-knowledge";
import { generateEmbedding } from "@/lib/openai";
import { KnowledgeNode, KnowledgeNodeInput, KnowledgeNodeType } from "@/types/knowledge";

export async function createNode(
  userId: string,
  input: KnowledgeNodeInput
): Promise<KnowledgeNode> {
  const embedding = await generateEmbedding(`${input.title}\n${input.content}`);
  return firestoreKnowledge.createKnowledgeNode(userId, { ...input, embedding });
}

export async function getNode(userId: string, nodeId: string): Promise<KnowledgeNode | null> {
  return firestoreKnowledge.getKnowledgeNode(userId, nodeId);
}

export async function updateNode(
  userId: string,
  nodeId: string,
  updates: Partial<
    Pick<KnowledgeNode, "title" | "content" | "tags" | "sources" | "dueDate" | "reminderAt">
  >
): Promise<KnowledgeNode> {
  if (updates.title !== undefined || updates.content !== undefined) {
    const node = await firestoreKnowledge.getKnowledgeNode(userId, nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    const title = updates.title ?? node.title;
    const content = updates.content ?? node.content;
    const embedding = await generateEmbedding(`${title}\n${content}`);
    return firestoreKnowledge.updateKnowledgeNode(userId, nodeId, { ...updates, embedding });
  }
  return firestoreKnowledge.updateKnowledgeNode(userId, nodeId, updates);
}

export async function deleteNode(userId: string, nodeId: string): Promise<void> {
  await firestoreKnowledge.deleteKnowledgeNode(userId, nodeId);
  await firestoreKnowledge.deleteEdgesForNode(userId, nodeId);
}

export async function listNodes(
  userId: string,
  type?: KnowledgeNodeType
): Promise<KnowledgeNode[]> {
  return firestoreKnowledge.listKnowledgeNodes(userId, type);
}
```

- [ ] **Step 4: Uruchom testy — upewnij się że przechodzą**

```bash
npx vitest run tests/unit/services/knowledgeNodeService.test.ts
```

Oczekiwany output: PASS (4 testy)

- [ ] **Step 5: Commit**

```bash
git add services/knowledgeNodeService.ts tests/unit/services/knowledgeNodeService.test.ts
git commit -m "feat: add knowledgeNodeService with embedding generation"
```

---

## Task 6: knowledgeEdgeService

**Files:**

- Create: `services/knowledgeEdgeService.ts`
- Create: `tests/unit/services/knowledgeEdgeService.test.ts`

- [ ] **Step 1: Napisz failing testy**

```typescript
// tests/unit/services/knowledgeEdgeService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const mockFirestoreKnowledge = vi.hoisted(() => ({
  createKnowledgeEdge: vi.fn(),
  getEdgesForNode: vi.fn(),
  deleteKnowledgeEdge: vi.fn(),
}));

vi.mock("@/lib/firestore-knowledge", () => mockFirestoreKnowledge);

const fakeTimestamp = Timestamp.fromDate(new Date("2026-01-01"));

const fakeEdge = {
  id: "edge-1",
  fromNodeId: "node-1",
  toNodeId: "node-2",
  relation: "related" as const,
  strength: 0.85,
  createdAt: fakeTimestamp,
};

describe("knowledgeEdgeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEdge", () => {
    it("tworzy krawędź w Firestore", async () => {
      mockFirestoreKnowledge.createKnowledgeEdge.mockResolvedValue(fakeEdge);
      const { createEdge } = await import("@/services/knowledgeEdgeService");

      const result = await createEdge("user-1", {
        fromNodeId: "node-1",
        toNodeId: "node-2",
        relation: "related",
        strength: 0.85,
      });

      expect(mockFirestoreKnowledge.createKnowledgeEdge).toHaveBeenCalledWith("user-1", {
        fromNodeId: "node-1",
        toNodeId: "node-2",
        relation: "related",
        strength: 0.85,
      });
      expect(result).toEqual(fakeEdge);
    });
  });

  describe("getEdgesForNode", () => {
    it("zwraca krawędzie dla węzła", async () => {
      mockFirestoreKnowledge.getEdgesForNode.mockResolvedValue([fakeEdge]);
      const { getEdgesForNode } = await import("@/services/knowledgeEdgeService");

      const result = await getEdgesForNode("user-1", "node-1");

      expect(mockFirestoreKnowledge.getEdgesForNode).toHaveBeenCalledWith("user-1", "node-1");
      expect(result).toEqual([fakeEdge]);
    });
  });

  describe("deleteEdge", () => {
    it("usuwa krawędź z Firestore", async () => {
      mockFirestoreKnowledge.deleteKnowledgeEdge.mockResolvedValue(undefined);
      const { deleteEdge } = await import("@/services/knowledgeEdgeService");

      await deleteEdge("user-1", "edge-1");

      expect(mockFirestoreKnowledge.deleteKnowledgeEdge).toHaveBeenCalledWith("user-1", "edge-1");
    });
  });
});
```

- [ ] **Step 2: Uruchom testy — upewnij się że nie przechodzą**

```bash
npx vitest run tests/unit/services/knowledgeEdgeService.test.ts
```

Oczekiwany output: FAIL

- [ ] **Step 3: Zaimplementuj serwis**

```typescript
// services/knowledgeEdgeService.ts
import * as firestoreKnowledge from "@/lib/firestore-knowledge";
import { KnowledgeEdge, KnowledgeEdgeInput } from "@/types/knowledge";

export async function createEdge(
  userId: string,
  input: KnowledgeEdgeInput
): Promise<KnowledgeEdge> {
  return firestoreKnowledge.createKnowledgeEdge(userId, input);
}

export async function getEdgesForNode(userId: string, nodeId: string): Promise<KnowledgeEdge[]> {
  return firestoreKnowledge.getEdgesForNode(userId, nodeId);
}

export async function deleteEdge(userId: string, edgeId: string): Promise<void> {
  return firestoreKnowledge.deleteKnowledgeEdge(userId, edgeId);
}
```

- [ ] **Step 4: Uruchom testy — upewnij się że przechodzą**

```bash
npx vitest run tests/unit/services/knowledgeEdgeService.test.ts
```

Oczekiwany output: PASS (3 testy)

- [ ] **Step 5: Commit**

```bash
git add services/knowledgeEdgeService.ts tests/unit/services/knowledgeEdgeService.test.ts
git commit -m "feat: add knowledgeEdgeService"
```

---

## Task 7: API route dla węzłów

**Files:**

- Create: `app/api/knowledge/nodes/route.ts`

- [ ] **Step 1: Utwórz route**

```typescript
// app/api/knowledge/nodes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import * as knowledgeNodeService from "@/services/knowledgeNodeService";
import { KnowledgeNodeInput, KnowledgeNodeType } from "@/types/knowledge";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as KnowledgeNodeType | null;

  try {
    const nodes = await knowledgeNodeService.listNodes(auth.uid, type ?? undefined);
    return NextResponse.json({ nodes });
  } catch (err) {
    return handleServiceError(err);
  }
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

  const input = body as KnowledgeNodeInput;
  if (!input.type || !input.title || !input.content) {
    return NextResponse.json({ error: "type, title and content are required" }, { status: 400 });
  }

  try {
    const node = await knowledgeNodeService.createNode(auth.uid, {
      ...input,
      createdBy: "user",
    });
    return NextResponse.json({ node }, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 2: Utwórz route dla pojedynczego węzła**

```typescript
// app/api/knowledge/nodes/[nodeId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import * as knowledgeNodeService from "@/services/knowledgeNodeService";

export async function GET(request: NextRequest, { params }: { params: { nodeId: string } }) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const node = await knowledgeNodeService.getNode(auth.uid, params.nodeId);
    if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ node });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { nodeId: string } }) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const node = await knowledgeNodeService.updateNode(
      auth.uid,
      params.nodeId,
      body as Parameters<typeof knowledgeNodeService.updateNode>[2]
    );
    return NextResponse.json({ node });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { nodeId: string } }) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  try {
    await knowledgeNodeService.deleteNode(auth.uid, params.nodeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 3: Sprawdź typy**

```bash
npx tsc --noEmit
```

Oczekiwany output: brak błędów

- [ ] **Step 4: Commit**

```bash
git add app/api/knowledge/
git commit -m "feat: add knowledge nodes API routes (GET, POST, PATCH, DELETE)"
```

---

## Task 8: API route dla krawędzi

**Files:**

- Create: `app/api/knowledge/edges/route.ts`
- Create: `app/api/knowledge/edges/[edgeId]/route.ts`

- [ ] **Step 1: Utwórz route dla krawędzi**

```typescript
// app/api/knowledge/edges/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import * as knowledgeEdgeService from "@/services/knowledgeEdgeService";
import { KnowledgeEdgeInput } from "@/types/knowledge";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get("nodeId");
  if (!nodeId) {
    return NextResponse.json({ error: "nodeId query param is required" }, { status: 400 });
  }

  try {
    const edges = await knowledgeEdgeService.getEdgesForNode(auth.uid, nodeId);
    return NextResponse.json({ edges });
  } catch (err) {
    return handleServiceError(err);
  }
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

  const input = body as KnowledgeEdgeInput;
  if (!input.fromNodeId || !input.toNodeId || !input.relation || input.strength === undefined) {
    return NextResponse.json(
      { error: "fromNodeId, toNodeId, relation and strength are required" },
      { status: 400 }
    );
  }

  try {
    const edge = await knowledgeEdgeService.createEdge(auth.uid, input);
    return NextResponse.json({ edge }, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 2: Utwórz route dla DELETE**

```typescript
// app/api/knowledge/edges/[edgeId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import * as knowledgeEdgeService from "@/services/knowledgeEdgeService";

export async function DELETE(request: NextRequest, { params }: { params: { edgeId: string } }) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  try {
    await knowledgeEdgeService.deleteEdge(auth.uid, params.edgeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 3: Sprawdź typy i uruchom wszystkie testy**

```bash
npx tsc --noEmit && npx vitest run tests/unit/services/
```

Oczekiwany output: brak błędów typów, PASS wszystkich testów

- [ ] **Step 4: Commit**

```bash
git add app/api/knowledge/edges/
git commit -m "feat: add knowledge edges API routes (GET, POST, DELETE)"
```

---

## Weryfikacja końcowa Fazy 1

- [ ] **Uruchom pełny suite testów**

```bash
npx vitest run
```

Oczekiwany output: wszystkie testy przechodzą, brak regresji

- [ ] **Sprawdź typy**

```bash
npx tsc --noEmit
```

Oczekiwany output: brak błędów

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete knowledge graph foundation (Phase 1)"
```

---

## Co dalej — Faza 2: AI Search

Następny plan: `2026-05-14-knowledge-graph-ai-search.md`

Obejmuje:

- `services/knowledgeSearchService.ts` — cosine similarity search po embeddingach
- `services/knowledgeAIService.ts` — GPT-4o-mini: tworzenie węzłów, budowanie połączeń, przypomnienia
- Aktualizacja `app/api/chat/route.ts` — zastąpienie `ragService` przez `knowledgeAIService`
- `app/api/knowledge/search/route.ts` — endpoint wyszukiwania semantycznego
