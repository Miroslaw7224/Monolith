# Backend Tests — Priority 2: Secondary API Routes (Tasks, Notes, Edges, Rebuild)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit tests for secondary API routes: `/api/tasks`, `/api/tasks/[id]`, `/api/notes`, `/api/notes/[id]`, `/api/knowledge/edges`, `/api/knowledge/edges/[edgeId]`, `/api/knowledge/rebuild-connections`.

**Architecture:** Same pattern as Priority 1 — import route handlers directly, mock `getAuthUserId` and service layer, call handlers with `NextRequest`, assert on the returned `NextResponse`. All tests go in `tests/unit/api/`.

**Tech Stack:** Vitest, vi.mock, vi.hoisted, NextRequest (next/server)

---

## Shared helper (copy into each test file)

```typescript
import { NextRequest } from "next/server";

function makeRequest(options?: {
  method?: string;
  token?: string;
  body?: unknown;
  searchParams?: Record<string, string>;
}): NextRequest {
  const url = new URL("http://localhost/api/test");
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const headers: Record<string, string> = {
    authorization: `Bearer ${options?.token ?? "valid-token"}`,
  };
  if (options?.body) headers["content-type"] = "application/json";
  return new NextRequest(url.toString(), {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}
```

---

## Task 1: /api/tasks route tests (GET + POST)

**Files:**

- Create: `tests/unit/api/tasks.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockGetTasks = vi.hoisted(() => vi.fn());
const mockCreateTask = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/taskService", () => ({
  getTasks: mockGetTasks,
  createTask: mockCreateTask,
}));

import { GET, POST } from "@/app/api/tasks/route";

function makeRequest(options?: { method?: string; body?: unknown }): NextRequest {
  const headers: Record<string, string> = { authorization: "Bearer valid" };
  if (options?.body) headers["content-type"] = "application/json";
  return new NextRequest("http://localhost/api/tasks", {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

const fakeTask = {
  id: "task-1",
  userId: "user-1",
  title: "Napisać testy",
  description: "",
  status: "todo" as const,
  due_date: null,
  priority: null,
  order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("GET /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUserId.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns tasks array for authenticated user", async () => {
    mockGetTasks.mockResolvedValue([fakeTask]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].title).toBe("Napisać testy");
    expect(mockGetTasks).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(makeRequest({ method: "POST", body: { description: "no title" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/title/i);
  });

  it("creates task and returns it", async () => {
    mockCreateTask.mockResolvedValue(fakeTask);
    const res = await POST(
      makeRequest({ method: "POST", body: { title: "Napisać testy", status: "todo" } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Napisać testy");
    expect(mockCreateTask).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Napisać testy", status: "todo" })
    );
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { authorization: "Bearer valid", "content-type": "application/json" },
      body: "bad-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/tasks.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/tasks.test.ts
git commit -m "test: add /api/tasks route unit tests (GET + POST)"
```

---

## Task 2: /api/tasks/[id] route tests (PUT + DELETE)

**Files:**

- Create: `tests/unit/api/tasks-id.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockUpdateTask = vi.hoisted(() => vi.fn());
const mockDeleteTask = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/taskService", () => ({
  updateTask: mockUpdateTask,
  deleteTask: mockDeleteTask,
}));

import { PUT, DELETE } from "@/app/api/tasks/[id]/route";

const params = Promise.resolve({ id: "task-1" });

function makeRequest(method: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = { authorization: "Bearer valid" };
  if (body) headers["content-type"] = "application/json";
  return new NextRequest("http://localhost/api/tasks/task-1", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("PUT /api/tasks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUserId.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const res = await PUT(makeRequest("PUT", { title: "Test" }), { params });
    expect(res.status).toBe(401);
  });

  it("updates task and returns success", async () => {
    mockUpdateTask.mockResolvedValue(undefined);
    const res = await PUT(makeRequest("PUT", { title: "Updated", status: "in_progress" }), {
      params,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockUpdateTask).toHaveBeenCalledWith(
      "user-1",
      "task-1",
      expect.objectContaining({ title: "Updated", status: "in_progress" })
    );
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/tasks/task-1", {
      method: "PUT",
      headers: { authorization: "Bearer valid", "content-type": "application/json" },
      body: "invalid",
    });
    const res = await PUT(req, { params });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/tasks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("deletes task and returns success", async () => {
    mockDeleteTask.mockResolvedValue(undefined);
    const res = await DELETE(makeRequest("DELETE"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockDeleteTask).toHaveBeenCalledWith("user-1", "task-1");
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/tasks-id.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/tasks-id.test.ts
git commit -m "test: add /api/tasks/[id] route unit tests (PUT + DELETE)"
```

---

## Task 3: /api/notes route tests (GET + POST)

**Files:**

- Create: `tests/unit/api/notes.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockListNotes = vi.hoisted(() => vi.fn());
const mockCreateNote = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/noteService", () => ({
  listNotes: mockListNotes,
  createNote: mockCreateNote,
}));

import { GET, POST } from "@/app/api/notes/route";

function makeRequest(options?: { method?: string; body?: unknown }): NextRequest {
  const headers: Record<string, string> = { authorization: "Bearer valid" };
  if (options?.body) headers["content-type"] = "application/json";
  return new NextRequest("http://localhost/api/notes", {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

const fakeNote = {
  id: "note-1",
  title: "Moja notatka",
  content: "<p>Treść</p>",
  created_at: new Date().toISOString(),
};

describe("GET /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUserId.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns notes array with id, title, content, created_at", async () => {
    mockListNotes.mockResolvedValue([fakeNote]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({ id: "note-1", title: "Moja notatka" });
    expect(mockListNotes).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("creates note with empty title/content when fields are omitted", async () => {
    mockCreateNote.mockResolvedValue(fakeNote);
    const res = await POST(makeRequest({ method: "POST", body: {} }));
    expect(res.status).toBe(200);
    expect(mockCreateNote).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "", content: "" })
    );
  });

  it("creates note with provided title and content", async () => {
    mockCreateNote.mockResolvedValue(fakeNote);
    const res = await POST(
      makeRequest({ method: "POST", body: { title: "Nowa notatka", content: "<p>Treść</p>" } })
    );
    expect(res.status).toBe(200);
    expect(mockCreateNote).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Nowa notatka", content: "<p>Treść</p>" })
    );
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/notes.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/notes.test.ts
git commit -m "test: add /api/notes route unit tests (GET + POST)"
```

---

## Task 4: /api/knowledge/edges route tests (GET + POST)

**Files:**

- Create: `tests/unit/api/knowledge/edges.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockGetEdgesForNode = vi.hoisted(() => vi.fn());
const mockCreateEdge = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/knowledgeEdgeService", () => ({
  getEdgesForNode: mockGetEdgesForNode,
  createEdge: mockCreateEdge,
}));

import { GET, POST } from "@/app/api/knowledge/edges/route";

function makeGetRequest(nodeId?: string): NextRequest {
  const url = new URL("http://localhost/api/knowledge/edges");
  if (nodeId) url.searchParams.set("nodeId", nodeId);
  return new NextRequest(url.toString(), {
    headers: { authorization: "Bearer valid" },
  });
}

function makePostRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/knowledge/edges", {
    method: "POST",
    headers: { authorization: "Bearer valid", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const fakeEdge = {
  id: "edge-1",
  fromNodeId: "node-a",
  toNodeId: "node-b",
  relation: "related",
  strength: 0.8,
};

describe("GET /api/knowledge/edges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 400 when nodeId is missing", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
  });

  it("returns edges for the given nodeId", async () => {
    mockGetEdgesForNode.mockResolvedValue([fakeEdge]);
    const res = await GET(makeGetRequest("node-a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0].fromNodeId).toBe("node-a");
    expect(mockGetEdgesForNode).toHaveBeenCalledWith("user-1", "node-a");
  });
});

describe("POST /api/knowledge/edges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makePostRequest({ fromNodeId: "a", toNodeId: "b" }));
    expect(res.status).toBe(400);
  });

  it("creates edge and returns 201", async () => {
    mockCreateEdge.mockResolvedValue(fakeEdge);
    const res = await POST(
      makePostRequest({
        fromNodeId: "node-a",
        toNodeId: "node-b",
        relation: "related",
        strength: 0.8,
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.edge.id).toBe("edge-1");
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/knowledge/edges.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/knowledge/edges.test.ts
git commit -m "test: add /api/knowledge/edges route unit tests"
```

---

## Task 5: /api/knowledge/rebuild-connections route tests

**Files:**

- Create: `tests/unit/api/knowledge/rebuild-connections.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockListNodes = vi.hoisted(() => vi.fn());
const mockBuildConnections = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/knowledgeNodeService", () => ({ listNodes: mockListNodes }));
vi.mock("@/services/knowledgeAIService", () => ({ buildConnections: mockBuildConnections }));

import { POST } from "@/app/api/knowledge/rebuild-connections/route";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/knowledge/rebuild-connections", {
    method: "POST",
    headers: { authorization: "Bearer valid" },
  });
}

describe("POST /api/knowledge/rebuild-connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUserId.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("rebuilds connections for all nodes and returns count", async () => {
    const nodes = [
      { id: "n1", title: "A" },
      { id: "n2", title: "B" },
    ];
    mockListNodes.mockResolvedValue(nodes);
    mockBuildConnections.mockResolvedValue(undefined);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rebuilt).toBe(2);
    expect(mockBuildConnections).toHaveBeenCalledTimes(2);
    expect(mockBuildConnections).toHaveBeenCalledWith("user-1", "n1");
    expect(mockBuildConnections).toHaveBeenCalledWith("user-1", "n2");
  });

  it("returns 0 when no nodes exist", async () => {
    mockListNodes.mockResolvedValue([]);
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.rebuilt).toBe(0);
    expect(mockBuildConnections).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/knowledge/rebuild-connections.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/knowledge/rebuild-connections.test.ts
git commit -m "test: add /api/knowledge/rebuild-connections route unit tests"
```

---

## Final verification

- [ ] **Run full test suite**

```
npx vitest run
```

Expected: All tests pass (previously ~220 from Priority 1 plan, now ~240+).
