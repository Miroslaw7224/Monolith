# Knowledge Graph — Plan implementacji: Faza 2 (AI Search)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zastąpić system RAG semantycznym wyszukiwaniem po grafie wiedzy i dodać GPT-4o-mini jako silnik AI zdolny do odpowiadania na pytania, tworzenia węzłów i budowania połączeń.

**Architecture:** `knowledgeSearchService` implementuje cosine similarity po embeddingach węzłów (zamiast keyword search). `knowledgeAIService` używa GPT-4o-mini do odpowiadania z kontekstem grafu, tworzenia węzłów na polecenie i pasywnego budowania połączeń. `app/api/chat/route.ts` zastępuje `ragService` nowym serwisem bez zmian w interfejsie (frontend nie wymaga zmian).

**Tech Stack:** TypeScript, OpenAI SDK (gpt-4o-mini + text-embedding-3-small), Firebase Firestore, Vitest

---

## Zależności od Fazy 1

Wymagane (już istnieje):

- `types/knowledge.ts` — KnowledgeNode, KnowledgeEdge
- `lib/openai.ts` — generateEmbedding
- `lib/firestore-knowledge.ts` — listAllKnowledgeNodesWithEmbeddings, listKnowledgeNodes, createKnowledgeEdge, getKnowledgeNode
- `services/knowledgeNodeService.ts` — createNode

---

## Mapa plików

| Plik                                                 | Akcja     | Opis                                                           |
| ---------------------------------------------------- | --------- | -------------------------------------------------------------- |
| `lib/openai.ts`                                      | Modyfikuj | Dodaj `generateChatCompletion` + `ChatMessage` type            |
| `services/knowledgeSearchService.ts`                 | Utwórz    | Cosine similarity search po węzłach                            |
| `services/knowledgeAIService.ts`                     | Utwórz    | GPT-4o-mini: chat, tworzenie węzłów, połączenia, przypomnienia |
| `app/api/chat/route.ts`                              | Modyfikuj | Zastąp `ragService` przez `knowledgeAIService`                 |
| `app/api/knowledge/search/route.ts`                  | Utwórz    | Endpoint wyszukiwania semantycznego                            |
| `tests/unit/lib/openai.test.ts`                      | Modyfikuj | Dodaj test dla generateChatCompletion                          |
| `tests/unit/services/knowledgeSearchService.test.ts` | Utwórz    | Testy cosine similarity i filtrowania                          |
| `tests/unit/services/knowledgeAIService.test.ts`     | Utwórz    | Testy query, save command, reminders                           |

---

## Task 1: Rozszerz lib/openai.ts o generateChatCompletion

**Files:**

- Modify: `lib/openai.ts`
- Modify: `tests/unit/lib/openai.test.ts`

- [ ] **Step 1: Dodaj failing test dla generateChatCompletion**

Otwórz `tests/unit/lib/openai.test.ts` i dodaj po istniejącym `describe("generateEmbedding", ...)` nowy blok:

```typescript
const mockChatCreate = vi.hoisted(() => vi.fn());

// Dodaj do istniejącego vi.mock("openai", ...) - zmień mock aby obsługiwał też chat
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: { create: mockCreate },
    chat: { completions: { create: mockChatCreate } },
  })),
}));

describe("generateChatCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  it("zwraca treść odpowiedzi jako string", async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "Odpowiedź AI" } }],
    });

    const { generateChatCompletion } = await import("@/lib/openai");
    const result = await generateChatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Jesteś asystentem." },
        { role: "user", content: "Cześć" },
      ],
    });

    expect(mockChatCreate).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Jesteś asystentem." },
        { role: "user", content: "Cześć" },
      ],
    });
    expect(result).toBe("Odpowiedź AI");
  });
});
```

UWAGA: Istniejący `vi.mock("openai", ...)` musi być zastąpiony nową wersją która mockuje zarówno `embeddings` jak i `chat.completions`. Zaktualizuj istniejący mock w pliku.

- [ ] **Step 2: Uruchom test — FAIL**

```bash
npx vitest run tests/unit/lib/openai.test.ts
```

Oczekiwany output: FAIL — `generateChatCompletion is not a function`

- [ ] **Step 3: Zaktualizuj lib/openai.ts**

```typescript
// lib/openai.ts — pełna zawartość pliku
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

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function generateChatCompletion(params: {
  model: string;
  messages: ChatMessage[];
}): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: params.model,
    messages: params.messages,
  });
  return (response.choices[0].message.content ?? "").trim();
}
```

- [ ] **Step 4: Uruchom testy — PASS**

```bash
npx vitest run tests/unit/lib/openai.test.ts
```

Oczekiwany output: PASS (3 testy — 2 z generateEmbedding + 1 nowy)

- [ ] **Step 5: Commit**

```bash
git add lib/openai.ts tests/unit/lib/openai.test.ts
git commit -m "feat: add generateChatCompletion to openai client"
```

---

## Task 2: knowledgeSearchService

**Files:**

- Create: `services/knowledgeSearchService.ts`
- Create: `tests/unit/services/knowledgeSearchService.test.ts`

- [ ] **Step 1: Napisz failing testy**

```typescript
// tests/unit/services/knowledgeSearchService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const mockFirestoreKnowledge = vi.hoisted(() => ({
  listAllKnowledgeNodesWithEmbeddings: vi.fn(),
}));

const mockOpenai = vi.hoisted(() => ({
  generateEmbedding: vi.fn(),
}));

vi.mock("@/lib/firestore-knowledge", () => mockFirestoreKnowledge);
vi.mock("@/lib/openai", () => mockOpenai);

const fakeTimestamp = Timestamp.fromDate(new Date("2026-01-01"));

// Wektor jednostkowy w kierunku pierwszej osi
function unitVec(dim: number, axis: number): number[] {
  return Array.from({ length: dim }, (_, i) => (i === axis ? 1 : 0));
}

function makeNode(id: string, embedding: number[]) {
  return {
    id,
    type: "note" as const,
    title: `Node ${id}`,
    content: "Content",
    tags: [],
    sources: [],
    embedding,
    createdAt: fakeTimestamp,
    updatedAt: fakeTimestamp,
    createdBy: "user" as const,
  };
}

describe("knowledgeSearchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchNodes", () => {
    it("zwraca węzły posortowane malejąco po score", async () => {
      // query i node-A są identyczne (similarity=1.0), node-B jest prostopadły (similarity=0)
      const queryEmbedding = unitVec(1536, 0);
      const nodeA = makeNode("a", unitVec(1536, 0)); // identical → score=1.0
      const nodeB = makeNode("b", unitVec(1536, 1)); // orthogonal → score=0, filtered

      mockOpenai.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockFirestoreKnowledge.listAllKnowledgeNodesWithEmbeddings.mockResolvedValue([nodeA, nodeB]);

      const { searchNodes } = await import("@/services/knowledgeSearchService");
      const results = await searchNodes("user-1", "test query");

      expect(results).toHaveLength(1);
      expect(results[0].node.id).toBe("a");
      expect(results[0].score).toBeCloseTo(1.0);
    });

    it("filtruje węzły poniżej progu 0.75", async () => {
      const queryEmbedding = unitVec(1536, 0);
      // Score ≈ 0.6: embedding [0.6, 0.8, 0, ...], |v|=1, dot=0.6
      const belowThreshold = makeNode("c", [0.6, 0.8, ...Array.from({ length: 1534 }, () => 0)]);

      mockOpenai.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockFirestoreKnowledge.listAllKnowledgeNodesWithEmbeddings.mockResolvedValue([
        belowThreshold,
      ]);

      const { searchNodes } = await import("@/services/knowledgeSearchService");
      const results = await searchNodes("user-1", "query");

      expect(results).toHaveLength(0);
    });

    it("respektuje parametr limit", async () => {
      const queryEmbedding = unitVec(1536, 0);
      // Wszystkie 5 węzłów mają similarity=1.0 (identyczne embeddingi)
      const nodes = Array.from({ length: 5 }, (_, i) => makeNode(`n${i}`, unitVec(1536, 0)));

      mockOpenai.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockFirestoreKnowledge.listAllKnowledgeNodesWithEmbeddings.mockResolvedValue(nodes);

      const { searchNodes } = await import("@/services/knowledgeSearchService");
      const results = await searchNodes("user-1", "query", 3);

      expect(results).toHaveLength(3);
    });

    it("pomija węzły bez embeddingu", async () => {
      const queryEmbedding = unitVec(1536, 0);
      const nodeWithoutEmbedding = makeNode("x", []);

      mockOpenai.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockFirestoreKnowledge.listAllKnowledgeNodesWithEmbeddings.mockResolvedValue([
        nodeWithoutEmbedding,
      ]);

      const { searchNodes } = await import("@/services/knowledgeSearchService");
      const results = await searchNodes("user-1", "query");

      expect(results).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Uruchom testy — FAIL**

```bash
npx vitest run tests/unit/services/knowledgeSearchService.test.ts
```

Oczekiwany output: FAIL — `Cannot find module '@/services/knowledgeSearchService'`

- [ ] **Step 3: Zaimplementuj serwis**

```typescript
// services/knowledgeSearchService.ts
import * as firestoreKnowledge from "@/lib/firestore-knowledge";
import { generateEmbedding } from "@/lib/openai";
import { KnowledgeNode } from "@/types/knowledge";

const SIMILARITY_THRESHOLD = 0.75;
const DEFAULT_LIMIT = 10;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

export async function searchNodes(
  userId: string,
  query: string,
  limit = DEFAULT_LIMIT
): Promise<Array<{ node: KnowledgeNode; score: number }>> {
  const [queryEmbedding, allNodes] = await Promise.all([
    generateEmbedding(query),
    firestoreKnowledge.listAllKnowledgeNodesWithEmbeddings(userId),
  ]);

  return allNodes
    .filter((n) => n.embedding && n.embedding.length > 0)
    .map((node) => ({ node, score: cosineSimilarity(queryEmbedding, node.embedding) }))
    .filter(({ score }) => score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

- [ ] **Step 4: Uruchom testy — PASS**

```bash
npx vitest run tests/unit/services/knowledgeSearchService.test.ts
```

Oczekiwany output: PASS (4 testy)

- [ ] **Step 5: Commit**

```bash
git add services/knowledgeSearchService.ts tests/unit/services/knowledgeSearchService.test.ts
git commit -m "feat: add knowledgeSearchService with cosine similarity"
```

---

## Task 3: knowledgeAIService

**Files:**

- Create: `services/knowledgeAIService.ts`
- Create: `tests/unit/services/knowledgeAIService.test.ts`

- [ ] **Step 1: Napisz failing testy**

```typescript
// tests/unit/services/knowledgeAIService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const mockSearchService = vi.hoisted(() => ({
  searchNodes: vi.fn(),
}));

const mockNodeService = vi.hoisted(() => ({
  createNode: vi.fn(),
}));

const mockFirestoreKnowledge = vi.hoisted(() => ({
  listKnowledgeNodes: vi.fn(),
  getKnowledgeNode: vi.fn(),
  createKnowledgeEdge: vi.fn(),
}));

const mockOpenai = vi.hoisted(() => ({
  generateChatCompletion: vi.fn(),
}));

vi.mock("@/services/knowledgeSearchService", () => mockSearchService);
vi.mock("@/services/knowledgeNodeService", () => mockNodeService);
vi.mock("@/lib/firestore-knowledge", () => mockFirestoreKnowledge);
vi.mock("@/lib/openai", () => mockOpenai);

const fakeTimestamp = Timestamp.fromDate(new Date("2026-01-01"));

const fakeNode = {
  id: "node-1",
  type: "note" as const,
  title: "Projekt X",
  content: "Deadline 20 maja",
  tags: [],
  sources: [],
  embedding: [],
  createdAt: fakeTimestamp,
  updatedAt: fakeTimestamp,
  createdBy: "user" as const,
};

describe("knowledgeAIService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("query — tryb wyszukiwania", () => {
    it("zwraca odpowiedź AI z węzłami jako źródłami", async () => {
      mockFirestoreKnowledge.listKnowledgeNodes.mockResolvedValue([]);
      mockSearchService.searchNodes.mockResolvedValue([{ node: fakeNode, score: 0.9 }]);
      mockOpenai.generateChatCompletion.mockResolvedValue("Deadline projektu X to 20 maja.");

      const { query } = await import("@/services/knowledgeAIService");
      const result = await query("user-1", { message: "kiedy deadline projektu X?", lang: "pl" });

      expect(mockSearchService.searchNodes).toHaveBeenCalledWith(
        "user-1",
        "kiedy deadline projektu X?"
      );
      expect(mockOpenai.generateChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o-mini",
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "system" }),
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining("Projekt X"),
            }),
          ]),
        })
      );
      expect(result.text).toBe("Deadline projektu X to 20 maja.");
      expect(result.sources).toContain("Projekt X");
    });
  });

  describe("query — tryb zapisu (save command)", () => {
    it("tworzy węzeł gdy wiadomość zawiera 'zapamiętaj'", async () => {
      mockOpenai.generateChatCompletion
        .mockResolvedValueOnce(
          JSON.stringify({
            type: "note",
            title: "Projekt X deadline",
            content: "Deadline projektu X to 20 maja.",
            tags: ["projekt"],
            dueDate: null,
          })
        )
        .mockResolvedValueOnce("Nieużywany response");

      mockNodeService.createNode.mockResolvedValue({ ...fakeNode, id: "new-node" });
      mockSearchService.searchNodes.mockResolvedValue([]);
      mockFirestoreKnowledge.getKnowledgeNode.mockResolvedValue(null);

      const { query } = await import("@/services/knowledgeAIService");
      const result = await query("user-1", {
        message: "zapamiętaj że projekt X ma deadline 20 maja",
        lang: "pl",
      });

      expect(mockNodeService.createNode).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ title: "Projekt X deadline", createdBy: "ai" })
      );
      expect(result.text).toContain("Zapisano");
      expect(result.sources).toContain("Projekt X deadline");
    });
  });

  describe("getUpcomingReminders", () => {
    it("zwraca węzły task/event z dueDate w ciągu 48h", async () => {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString().split("T")[0];

      const upcoming = { ...fakeNode, type: "task" as const, dueDate: in24h };
      const tooLate = { ...fakeNode, id: "late", type: "task" as const, dueDate: in72h };
      const noDate = { ...fakeNode, id: "nodate", type: "task" as const };

      mockFirestoreKnowledge.listKnowledgeNodes.mockResolvedValue([upcoming, tooLate, noDate]);

      const { getUpcomingReminders } = await import("@/services/knowledgeAIService");
      const result = await getUpcomingReminders("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("node-1");
    });

    it("ignoruje węzły typu note/resource", async () => {
      const noteWithDate = {
        ...fakeNode,
        type: "note" as const,
        dueDate: new Date(Date.now() + 60_000).toISOString().split("T")[0],
      };
      mockFirestoreKnowledge.listKnowledgeNodes.mockResolvedValue([noteWithDate]);

      const { getUpcomingReminders } = await import("@/services/knowledgeAIService");
      const result = await getUpcomingReminders("user-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("buildConnections", () => {
    it("tworzy krawędzie dla podobnych węzłów", async () => {
      mockFirestoreKnowledge.getKnowledgeNode.mockResolvedValue(fakeNode);
      mockSearchService.searchNodes.mockResolvedValue([
        { node: { ...fakeNode, id: "node-2" }, score: 0.82 },
      ]);
      mockFirestoreKnowledge.createKnowledgeEdge.mockResolvedValue({});

      const { buildConnections } = await import("@/services/knowledgeAIService");
      await buildConnections("user-1", "node-1");

      expect(mockFirestoreKnowledge.createKnowledgeEdge).toHaveBeenCalledWith("user-1", {
        fromNodeId: "node-1",
        toNodeId: "node-2",
        relation: "related",
        strength: 0.82,
      });
    });

    it("nie tworzy krawędzi gdy węzeł nie istnieje", async () => {
      mockFirestoreKnowledge.getKnowledgeNode.mockResolvedValue(null);

      const { buildConnections } = await import("@/services/knowledgeAIService");
      await buildConnections("user-1", "nonexistent");

      expect(mockFirestoreKnowledge.createKnowledgeEdge).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Uruchom testy — FAIL**

```bash
npx vitest run tests/unit/services/knowledgeAIService.test.ts
```

Oczekiwany output: FAIL — `Cannot find module '@/services/knowledgeAIService'`

- [ ] **Step 3: Zaimplementuj serwis**

```typescript
// services/knowledgeAIService.ts
import * as firestoreKnowledge from "@/lib/firestore-knowledge";
import { generateChatCompletion } from "@/lib/openai";
import * as knowledgeSearchService from "@/services/knowledgeSearchService";
import * as knowledgeNodeService from "@/services/knowledgeNodeService";
import { KnowledgeNode, KnowledgeNodeType } from "@/types/knowledge";

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

const SYSTEM_PROMPT = `Jesteś asystentem osobistej bazy wiedzy. Odpowiadaj na pytania WYŁĄCZNIE na podstawie dostarczonego kontekstu.

Zasady:
- Odpowiedzi zwięzłe: max 3-4 zdania, konkretne fakty
- Zawsze podaj źródło: [→ tytuł (nodeId)]
- Jeśli są powiązane węzły, dodaj: Powiązane: [Tytuł A], [Tytuł B]
- Odpowiadaj w języku użytkownika (PL jeśli pisze po polsku, EN jeśli po angielsku)
- Jeśli informacji nie ma w kontekście, powiedz to wprost — nie wymyślaj faktów`;

function isSaveCommand(message: string): boolean {
  const lower = message.toLowerCase();
  return SAVE_KEYWORDS.some((k) => lower.includes(k));
}

async function extractNodeFromMessage(message: string): Promise<{
  type: KnowledgeNodeType;
  title: string;
  content: string;
  tags: string[];
  dueDate?: string;
}> {
  const prompt = `Wyciągnij strukturę wiedzy z tej wiadomości. Zwróć TYLKO JSON, bez markdown:
{
  "type": "note" | "task" | "resource" | "event",
  "title": "krótki tytuł (max 50 znaków)",
  "content": "zwięzła treść (max 3 zdania)",
  "tags": ["tag1", "tag2"],
  "dueDate": "YYYY-MM-DD lub null"
}

Wiadomość: ${message}`;

  try {
    const response = await generateChatCompletion({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });
    const parsed = JSON.parse(response);
    return {
      type: parsed.type ?? "note",
      title: parsed.title ?? message.slice(0, 50),
      content: parsed.content ?? message,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      dueDate: parsed.dueDate ?? undefined,
    };
  } catch {
    return {
      type: "note",
      title: message.slice(0, 50),
      content: message,
      tags: [],
    };
  }
}

export async function getUpcomingReminders(userId: string): Promise<KnowledgeNode[]> {
  const nodes = await firestoreKnowledge.listKnowledgeNodes(userId);
  const now = Date.now();
  const in48h = now + 48 * 60 * 60 * 1000;
  return nodes.filter((n) => {
    if (n.type !== "task" && n.type !== "event") return false;
    if (!n.dueDate) return false;
    const due = new Date(n.dueDate).getTime();
    return due >= now && due <= in48h;
  });
}

export async function buildConnections(userId: string, nodeId: string): Promise<void> {
  const node = await firestoreKnowledge.getKnowledgeNode(userId, nodeId);
  if (!node) return;

  const similar = await knowledgeSearchService.searchNodes(
    userId,
    `${node.title}\n${node.content}`,
    5
  );

  const candidates = similar.filter(({ node: n }) => n.id !== nodeId);
  await Promise.all(
    candidates.map(({ node: candidate, score }) =>
      firestoreKnowledge.createKnowledgeEdge(userId, {
        fromNodeId: nodeId,
        toNodeId: candidate.id,
        relation: "related",
        strength: score,
      })
    )
  );
}

async function handleSaveCommand(
  userId: string,
  message: string
): Promise<{ text: string; sources: string[] }> {
  const extracted = await extractNodeFromMessage(message);
  const node = await knowledgeNodeService.createNode(userId, {
    ...extracted,
    sources: [],
    createdBy: "ai",
  });

  // Build connections in background — don't block response
  buildConnections(userId, node.id).catch((err) =>
    console.error("[knowledgeAI] buildConnections error:", err)
  );

  return {
    text: `Zapisano: ${node.title}\nTyp: ${node.type}`,
    sources: [node.title],
  };
}

export async function query(
  userId: string,
  { message, lang }: { message: string; lang?: string }
): Promise<{ text: string; sources: string[] }> {
  if (isSaveCommand(message)) {
    return handleSaveCommand(userId, message);
  }

  const [reminders, searchResults] = await Promise.all([
    getUpcomingReminders(userId),
    knowledgeSearchService.searchNodes(userId, message),
  ]);

  const contextParts: string[] = [];

  if (reminders.length > 0) {
    const reminderLines = reminders.map((n) => `- ${n.title} (${n.dueDate})`).join("\n");
    contextParts.push(`## Nadchodzące zadania/wydarzenia:\n${reminderLines}`);
  }

  if (searchResults.length > 0) {
    const nodesText = searchResults
      .map(
        ({ node }) =>
          `### ${node.title} [${node.id}]\nTyp: ${node.type}\n${node.content}` +
          (node.sources.length > 0
            ? `\nŹródła: ${node.sources.map((s) => s.url ?? s.nodeId).join(", ")}`
            : "")
      )
      .join("\n\n");
    contextParts.push(`## Baza wiedzy:\n${nodesText}`);
  }

  const context = contextParts.length > 0 ? contextParts.join("\n\n") : "Baza wiedzy jest pusta.";

  const responseText = await generateChatCompletion({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Kontekst:\n${context}\n\nPytanie: ${message}` },
    ],
  });

  const sources = searchResults.map(({ node }) => node.title);
  return { text: responseText, sources };
}
```

- [ ] **Step 4: Uruchom testy — PASS**

```bash
npx vitest run tests/unit/services/knowledgeAIService.test.ts
```

Oczekiwany output: PASS (6 testów)

- [ ] **Step 5: Commit**

```bash
git add services/knowledgeAIService.ts tests/unit/services/knowledgeAIService.test.ts
git commit -m "feat: add knowledgeAIService with query, save command, reminders, buildConnections"
```

---

## Task 4: Zastąp ragService w chat API

**Files:**

- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Przeczytaj obecny plik**

Obecna zawartość `app/api/chat/route.ts`:

```typescript
import * as ragService from "@/services/ragService";
// ...
const result = await ragService.query(auth.uid, { message, lang });
```

- [ ] **Step 2: Zaktualizuj import i wywołanie**

```typescript
// app/api/chat/route.ts — pełna zawartość
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseChatPostBody } from "@/lib/chatRequestBody";
import * as knowledgeAIService from "@/services/knowledgeAIService";

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseChatPostBody(body);
  if (parsed.ok === false) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { message, lang } = parsed;
  try {
    const result = await knowledgeAIService.query(auth.uid, { message, lang });
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 3: Sprawdź typy**

```bash
npx tsc --noEmit
```

Oczekiwany output: brak nowych błędów

- [ ] **Step 4: Uruchom wszystkie testy**

```bash
npx vitest run
```

Oczekiwany output: wszystkie testy PASS (brak regresji)

- [ ] **Step 5: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: replace ragService with knowledgeAIService in chat API"
```

---

## Task 5: Endpoint wyszukiwania semantycznego

**Files:**

- Create: `app/api/knowledge/search/route.ts`

- [ ] **Step 1: Utwórz endpoint**

```typescript
// app/api/knowledge/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import * as knowledgeSearchService from "@/services/knowledgeSearchService";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "q query param is required" }, { status: 400 });
  }

  try {
    const results = await knowledgeSearchService.searchNodes(auth.uid, q);
    return NextResponse.json({
      results: results.map(({ node, score }) => ({
        id: node.id,
        type: node.type,
        title: node.title,
        content: node.content,
        tags: node.tags,
        score,
      })),
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 2: Sprawdź typy i testy**

```bash
npx tsc --noEmit && npx vitest run
```

Oczekiwany output: brak błędów, wszystkie testy PASS

- [ ] **Step 3: Commit**

```bash
git add app/api/knowledge/search/route.ts
git commit -m "feat: add semantic search API endpoint"
```

---

## Weryfikacja końcowa Fazy 2

- [ ] **Uruchom pełny suite testów**

```bash
npx vitest run
```

Oczekiwany output: wszystkie testy PASS, brak regresji

- [ ] **Sprawdź typy**

```bash
npx tsc --noEmit
```

Oczekiwany output: brak nowych błędów

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete knowledge graph AI search (Phase 2)"
```

---

## Co dalej — Faza 3: UI

Następny plan: `2026-05-14-knowledge-graph-ui.md`

Obejmuje:

- Refaktoryzacja `WiedzaView.tsx` — zunifikowana lista węzłów + przycisk "Pokaż graf"
- `KnowledgeListView.tsx` — filtrowalna lista węzłów z licznikiem połączeń
- `KnowledgeGraphView.tsx` — interaktywny graf (React Flow / @xyflow/react)
- Integracja z nowym API (`/api/knowledge/nodes`, `/api/knowledge/search`)
