# Backend Tests — Priority 1: Lib Utilities + Critical API Routes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit tests for 3 critical lib utilities (`inferHttpStatus`, `getAuth`, `gemini`) and 7 high-risk API route handlers (`/api/chat`, `/api/knowledge/extract`, `/api/knowledge/nodes`, `/api/knowledge/nodes/[nodeId]`, `/api/knowledge/search`, `/api/waitlist/check-email`, `/api/upload`).

**Architecture:** All tests use Vitest with `vi.mock()` to mock external dependencies (Firebase, OpenAI, Gemini). API route handlers are imported and called directly with `NextRequest` — no HTTP server needed. Tests go in `tests/unit/` so they run with the standard `npx vitest run` command.

**Tech Stack:** Vitest, @testing-library/jest-dom, NextRequest (next/server), vi.mock, vi.hoisted, vi.useFakeTimers

---

## Shared Helper (reuse across all API route test files)

Every API route test file needs a `makeRequest` helper. Copy this into each new test file:

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
  const headers: Record<string, string> = {};
  if (options?.token !== undefined) {
    headers["authorization"] = `Bearer ${options.token}`;
  }
  if (options?.body) {
    headers["content-type"] = "application/json";
  }
  return new NextRequest(url.toString(), {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}
```

---

## Task 1: inferHttpStatus unit tests

**Files:**

- Create: `tests/unit/lib/inferHttpStatus.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect } from "vitest";
import { inferHttpStatus } from "@/lib/inferHttpStatus";

describe("inferHttpStatus", () => {
  it("extracts status from object.status", () => {
    expect(inferHttpStatus({ status: 429 })).toBe(429);
    expect(inferHttpStatus({ status: 503 })).toBe(503);
  });

  it("extracts code from object.code when in 4xx-5xx range", () => {
    expect(inferHttpStatus({ code: 503 })).toBe(503);
    expect(inferHttpStatus({ code: 200 })).toBeUndefined();
    expect(inferHttpStatus({ code: 399 })).toBeUndefined();
  });

  it("extracts code from nested object.error.code", () => {
    expect(inferHttpStatus({ error: { code: 408 } })).toBe(408);
    expect(inferHttpStatus({ error: { code: 200 } })).toBeUndefined();
  });

  it("parses code from Error.message JSON string", () => {
    const err = new Error('{"code": 429, "message": "rate limited"}');
    expect(inferHttpStatus(err)).toBe(429);
  });

  it("returns undefined for non-matching inputs", () => {
    expect(inferHttpStatus(new Error("something went wrong"))).toBeUndefined();
    expect(inferHttpStatus("string error")).toBeUndefined();
    expect(inferHttpStatus(null)).toBeUndefined();
    expect(inferHttpStatus(undefined)).toBeUndefined();
    expect(inferHttpStatus(42)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/lib/inferHttpStatus.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/lib/inferHttpStatus.test.ts
git commit -m "test: add inferHttpStatus unit tests"
```

---

## Task 2: getAuthUserId unit tests

**Files:**

- Create: `tests/unit/lib/getAuth.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyIdToken = vi.hoisted(() => vi.fn());
const mockGetAuth = vi.hoisted(() => vi.fn());
const mockGetFirestore = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase-admin", () => ({
  verifyIdToken: mockVerifyIdToken,
  getAuth: mockGetAuth,
  getFirestore: mockGetFirestore,
}));

import { getAuthUserId } from "@/lib/getAuth";

function makeReq(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers["authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/test", { headers });
}

function makeFirestoreWithEmail(empty: boolean) {
  return {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty }),
        }),
      }),
    }),
  };
}

describe("getAuthUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const result = await getAuthUserId(makeReq());
    const res = result as Response;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/missing/i);
  });

  it("returns 401 when Authorization header lacks 'Bearer ' prefix", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Basic abc123" },
    });
    const result = await getAuthUserId(req);
    expect((result as Response).status).toBe(401);
  });

  it("returns 401 when token verification fails", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));
    const result = await getAuthUserId(makeReq("bad-token"));
    const res = result as Response;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or expired/i);
  });

  it("returns 403 when user has no email", async () => {
    mockVerifyIdToken.mockResolvedValue("uid-1");
    mockGetAuth.mockReturnValue({
      getUser: vi.fn().mockResolvedValue({ email: undefined }),
    });
    const result = await getAuthUserId(makeReq("valid"));
    const res = result as Response;
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.allowed).toBe(false);
  });

  it("returns 403 when email is not on waitlist", async () => {
    mockVerifyIdToken.mockResolvedValue("uid-1");
    mockGetAuth.mockReturnValue({
      getUser: vi.fn().mockResolvedValue({ email: "user@example.com" }),
    });
    mockGetFirestore.mockReturnValue(makeFirestoreWithEmail(true));
    const result = await getAuthUserId(makeReq("valid"));
    expect((result as Response).status).toBe(403);
  });

  it("returns { uid } when token is valid and email is on waitlist", async () => {
    mockVerifyIdToken.mockResolvedValue("uid-1");
    mockGetAuth.mockReturnValue({
      getUser: vi.fn().mockResolvedValue({ email: "user@example.com" }),
    });
    mockGetFirestore.mockReturnValue(makeFirestoreWithEmail(false));
    const result = await getAuthUserId(makeReq("valid"));
    expect(result).toEqual({ uid: "uid-1" });
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/lib/getAuth.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/lib/getAuth.test.ts
git commit -m "test: add getAuthUserId unit tests (auth + waitlist enforcement)"
```

---

## Task 3: gemini generateContent retry logic tests

**Files:**

- Create: `tests/unit/lib/gemini.test.ts`

Note: `gemini.ts` uses a module-level singleton (`let client = null`). Use `vi.resetModules()` in `beforeEach` so the singleton resets between tests. Also stub `GEMINI_API_KEY` env var before each test.

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("gemini — generateContent", () => {
  let generateContent: (p: {
    model: string;
    contents: string;
    systemInstruction?: string;
  }) => Promise<string>;
  let mockGenerateContentFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();

    mockGenerateContentFn = vi.fn();
    vi.stubEnv("GEMINI_API_KEY", "test-key");

    vi.doMock("@google/genai", () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: { generateContent: mockGenerateContentFn },
      })),
    }));

    ({ generateContent } = await import("@/lib/gemini"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.doUnmock("@google/genai");
  });

  it("returns trimmed text on first success", async () => {
    mockGenerateContentFn.mockResolvedValue({ text: "  hello  " });
    const result = await generateContent({ model: "gemini-pro", contents: "test" });
    expect(result).toBe("hello");
    expect(mockGenerateContentFn).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 and returns when next attempt succeeds", async () => {
    const err503 = Object.assign(new Error("overloaded"), { status: 503 });
    mockGenerateContentFn
      .mockRejectedValueOnce(err503)
      .mockResolvedValue({ text: "success after retry" });

    const promise = generateContent({ model: "gemini-pro", contents: "test" });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("success after retry");
    expect(mockGenerateContentFn).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 rate limit error", async () => {
    const err429 = Object.assign(new Error("rate limit exceeded"), { status: 429 });
    mockGenerateContentFn
      .mockRejectedValueOnce(err429)
      .mockRejectedValueOnce(err429)
      .mockResolvedValue({ text: "ok" });

    const promise = generateContent({ model: "gemini-pro", contents: "test" });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("ok");
    expect(mockGenerateContentFn).toHaveBeenCalledTimes(3);
  });

  it("throws DomainError with status 503 after 4 failed retries", async () => {
    const { DomainError } = await import("@/lib/errors");
    const err503 = Object.assign(new Error("overloaded"), { status: 503 });
    mockGenerateContentFn.mockRejectedValue(err503);

    const promise = generateContent({ model: "gemini-pro", contents: "test" });
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBeInstanceOf(DomainError);
    expect(mockGenerateContentFn).toHaveBeenCalledTimes(4); // MAX_GEMINI_ATTEMPTS
  });

  it("does NOT retry on non-retryable errors (e.g. 400 bad request)", async () => {
    const err400 = Object.assign(new Error("invalid model"), { status: 400 });
    mockGenerateContentFn.mockRejectedValue(err400);

    await expect(generateContent({ model: "bad-model", contents: "test" })).rejects.toThrow(
      "invalid model"
    );
    expect(mockGenerateContentFn).toHaveBeenCalledTimes(1);
  });

  it("retries when error message contains 'overloaded'", async () => {
    const errMsg = new Error("The model is currently overloaded. Please try again.");
    mockGenerateContentFn.mockRejectedValueOnce(errMsg).mockResolvedValue({ text: "done" });

    const promise = generateContent({ model: "gemini-pro", contents: "test" });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("done");
    expect(mockGenerateContentFn).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/lib/gemini.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/lib/gemini.test.ts
git commit -m "test: add gemini retry logic unit tests (503/429/408/overloaded)"
```

---

## Task 4: /api/chat route tests

**Files:**

- Create: `tests/unit/api/chat.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockQuery = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/knowledgeAIService", () => ({ query: mockQuery }));

import { POST } from "@/app/api/chat/route";

function makeRequest(body?: unknown, token = "valid-token"): NextRequest {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 401 when auth fails", async () => {
    mockGetAuthUserId.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const res = await POST(makeRequest({ message: "hello" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(makeRequest({ lang: "pl" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/message/i);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: { authorization: "Bearer valid", "content-type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns AI response with sources on success", async () => {
    mockQuery.mockResolvedValue({
      text: "Projekt X ma deadline 20 maja.",
      sources: ["Projekt X"],
    });

    const res = await POST(makeRequest({ message: "kiedy deadline projektu X?", lang: "pl" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Projekt X ma deadline 20 maja.");
    expect(body.sources).toContain("Projekt X");
    expect(mockQuery).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ message: "kiedy deadline projektu X?", lang: "pl" })
    );
  });

  it("passes history to query when provided", async () => {
    mockQuery.mockResolvedValue({ text: "ok", sources: [] });
    const history = [{ role: "user", content: "poprzednia wiadomość" }];

    await POST(makeRequest({ message: "tak", lang: "pl", history }));

    expect(mockQuery).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        history: expect.arrayContaining([{ role: "user", content: "poprzednia wiadomość" }]),
      })
    );
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/chat.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/chat.test.ts
git commit -m "test: add /api/chat route unit tests"
```

---

## Task 5: /api/knowledge/extract route tests

**Files:**

- Create: `tests/unit/api/knowledge/extract.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockExtractNodes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/knowledgeAIService", () => ({
  extractNodesFromMessage: mockExtractNodes,
}));

import { POST } from "@/app/api/knowledge/extract/route";

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/knowledge/extract", {
    method: "POST",
    headers: { authorization: "Bearer valid", "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/knowledge/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 401 when auth fails", async () => {
    mockGetAuthUserId.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const res = await POST(makeRequest({ message: "test" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is not a string", async () => {
    const res = await POST(makeRequest({ message: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns extracted nodes on success", async () => {
    const nodes = [
      {
        type: "resource",
        title: "Vercel",
        content: "Platforma do deploymentu",
        tags: [],
        sources: [],
      },
    ];
    mockExtractNodes.mockResolvedValue(nodes);

    const res = await POST(makeRequest({ message: "zapamiętaj https://vercel.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodes).toHaveLength(1);
    expect(body.nodes[0].title).toBe("Vercel");
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/knowledge/extract.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/knowledge/extract.test.ts
git commit -m "test: add /api/knowledge/extract route unit tests"
```

---

## Task 6: /api/knowledge/nodes route tests (GET + POST)

**Files:**

- Create: `tests/unit/api/knowledge/nodes.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockListNodes = vi.hoisted(() => vi.fn());
const mockCreateNode = vi.hoisted(() => vi.fn());
const mockBuildConnections = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/knowledgeNodeService", () => ({
  listNodes: mockListNodes,
  createNode: mockCreateNode,
}));
vi.mock("@/services/knowledgeAIService", () => ({ buildConnections: mockBuildConnections }));

import { GET, POST } from "@/app/api/knowledge/nodes/route";

function makeRequest(options: {
  method: "GET" | "POST";
  body?: unknown;
  searchParams?: Record<string, string>;
}): NextRequest {
  const url = new URL("http://localhost/api/knowledge/nodes");
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const headers: Record<string, string> = { authorization: "Bearer valid" };
  if (options.body) headers["content-type"] = "application/json";
  return new NextRequest(url.toString(), {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

const fakeNode = {
  id: "node-1",
  type: "note" as const,
  title: "Test",
  content: "Content",
  tags: [],
  sources: [],
  embedding: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "user" as const,
};

describe("GET /api/knowledge/nodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 401 when auth fails", async () => {
    mockGetAuthUserId.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const res = await GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(401);
  });

  it("returns list of nodes for authenticated user", async () => {
    mockListNodes.mockResolvedValue([fakeNode]);
    const res = await GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodes).toHaveLength(1);
    expect(body.nodes[0].id).toBe("node-1");
    expect(mockListNodes).toHaveBeenCalledWith("user-1", undefined);
  });

  it("filters by type when ?type= query param is provided", async () => {
    mockListNodes.mockResolvedValue([]);
    await GET(makeRequest({ method: "GET", searchParams: { type: "task" } }));
    expect(mockListNodes).toHaveBeenCalledWith("user-1", "task");
  });
});

describe("POST /api/knowledge/nodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
    mockBuildConnections.mockResolvedValue(undefined);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeRequest({ method: "POST", body: { title: "Test" } }));
    expect(res.status).toBe(400);
  });

  it("returns 201 with created node on success", async () => {
    mockCreateNode.mockResolvedValue(fakeNode);
    const res = await POST(
      makeRequest({
        method: "POST",
        body: { type: "note", title: "Test", content: "Content" },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.node.id).toBe("node-1");
    expect(mockCreateNode).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ type: "note", title: "Test", createdBy: "user" })
    );
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/knowledge/nodes.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/knowledge/nodes.test.ts
git commit -m "test: add /api/knowledge/nodes route unit tests (GET + POST)"
```

---

## Task 7: /api/knowledge/nodes/[nodeId] route tests (PATCH + DELETE)

**Files:**

- Create: `tests/unit/api/knowledge/nodes-id.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockGetNode = vi.hoisted(() => vi.fn());
const mockUpdateNode = vi.hoisted(() => vi.fn());
const mockDeleteNode = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/knowledgeNodeService", () => ({
  getNode: mockGetNode,
  updateNode: mockUpdateNode,
  deleteNode: mockDeleteNode,
}));

import { GET, PATCH, DELETE } from "@/app/api/knowledge/nodes/[nodeId]/route";

function makeRequest(method: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = { authorization: "Bearer valid" };
  if (body) headers["content-type"] = "application/json";
  return new NextRequest("http://localhost/api/knowledge/nodes/node-1", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = Promise.resolve({ nodeId: "node-1" });

const fakeNode = {
  id: "node-1",
  type: "note" as const,
  title: "Test",
  content: "Content",
  tags: [],
  sources: [],
  embedding: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "user" as const,
};

describe("GET /api/knowledge/nodes/[nodeId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 404 when node does not exist", async () => {
    mockGetNode.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(404);
  });

  it("returns node when found", async () => {
    mockGetNode.mockResolvedValue(fakeNode);
    const res = await GET(makeRequest("GET"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.node.id).toBe("node-1");
  });
});

describe("PATCH /api/knowledge/nodes/[nodeId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("updates and returns node", async () => {
    const updated = { ...fakeNode, title: "Updated" };
    mockUpdateNode.mockResolvedValue(updated);

    const res = await PATCH(makeRequest("PATCH", { title: "Updated" }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.node.title).toBe("Updated");
    expect(mockUpdateNode).toHaveBeenCalledWith("user-1", "node-1", { title: "Updated" });
  });
});

describe("DELETE /api/knowledge/nodes/[nodeId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 200 ok after deletion", async () => {
    mockDeleteNode.mockResolvedValue(undefined);
    const res = await DELETE(makeRequest("DELETE"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDeleteNode).toHaveBeenCalledWith("user-1", "node-1");
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/knowledge/nodes-id.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/knowledge/nodes-id.test.ts
git commit -m "test: add /api/knowledge/nodes/[nodeId] route unit tests"
```

---

## Task 8: /api/knowledge/search route tests

**Files:**

- Create: `tests/unit/api/knowledge/search.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockSearchNodes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/knowledgeSearchService", () => ({ searchNodes: mockSearchNodes }));

import { GET } from "@/app/api/knowledge/search/route";

function makeRequest(q?: string): NextRequest {
  const url = new URL("http://localhost/api/knowledge/search");
  if (q) url.searchParams.set("q", q);
  return new NextRequest(url.toString(), {
    headers: { authorization: "Bearer valid" },
  });
}

describe("GET /api/knowledge/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 400 when q param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns search results for valid query", async () => {
    mockSearchNodes.mockResolvedValue([
      {
        node: {
          id: "n1",
          title: "Vercel",
          content: "Deploy",
          type: "resource",
          tags: [],
          sources: [],
        },
        score: 0.95,
      },
    ]);

    const res = await GET(makeRequest("vercel"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].title).toBe("Vercel");
    expect(body.results[0].score).toBe(0.95);
    expect(mockSearchNodes).toHaveBeenCalledWith("user-1", "vercel");
  });

  it("returns empty results when nothing matches", async () => {
    mockSearchNodes.mockResolvedValue([]);
    const res = await GET(makeRequest("xyz-unknown"));
    const body = await res.json();
    expect(body.results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/knowledge/search.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/knowledge/search.test.ts
git commit -m "test: add /api/knowledge/search route unit tests"
```

---

## Task 9: /api/waitlist/check-email route tests

**Files:**

- Create: `tests/unit/api/waitlist-check-email.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetFirestore = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase-admin", () => ({ getFirestore: mockGetFirestore }));

import { GET } from "@/app/api/waitlist/check-email/route";

function makeRequest(email?: string): NextRequest {
  const url = new URL("http://localhost/api/waitlist/check-email");
  if (email !== undefined) url.searchParams.set("email", email);
  return new NextRequest(url.toString());
}

function makeFirestore(empty: boolean) {
  return {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty }),
        }),
      }),
    }),
  };
}

describe("GET /api/waitlist/check-email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when email is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await GET(makeRequest("not-an-email"));
    expect(res.status).toBe(400);
  });

  it("returns { allowed: true } when email is on waitlist", async () => {
    mockGetFirestore.mockReturnValue(makeFirestore(false));
    const res = await GET(makeRequest("user@example.com"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowed).toBe(true);
  });

  it("returns { allowed: false } when email is NOT on waitlist", async () => {
    mockGetFirestore.mockReturnValue(makeFirestore(true));
    const res = await GET(makeRequest("unknown@example.com"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/waitlist-check-email.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/waitlist-check-email.test.ts
git commit -m "test: add /api/waitlist/check-email route unit tests"
```

---

## Task 10: /api/upload route tests

**Files:**

- Create: `tests/unit/api/upload.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockIngestDocument = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/documentService", () => ({ ingestDocument: mockIngestDocument }));

import { POST } from "@/app/api/upload/route";

function makeFormDataRequest(file?: File): NextRequest {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    headers: { authorization: "Bearer valid" },
    body: formData,
  });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 401 when auth fails", async () => {
    mockGetAuthUserId.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const res = await POST(
      makeFormDataRequest(new File(["content"], "test.txt", { type: "text/plain" }))
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file is uploaded", async () => {
    const res = await POST(makeFormDataRequest());
    expect(res.status).toBe(400);
  });

  it("ingests document and returns result on success", async () => {
    const result = { id: "doc-1", title: "test.txt" };
    mockIngestDocument.mockResolvedValue(result);

    const file = new File(["Hello world"], "test.txt", { type: "text/plain" });
    const res = await POST(makeFormDataRequest(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("doc-1");
    expect(mockIngestDocument).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "test.txt", type: "text/plain" })
    );
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run tests/unit/api/upload.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/api/upload.test.ts
git commit -m "test: add /api/upload route unit tests"
```

---

## Final verification

- [ ] **Run full unit test suite**

```
npx vitest run
```

Expected: All tests pass (previously 180, now ~220+ with new tests).

- [ ] **Final commit if needed**

```
git commit -m "test: complete priority-1 backend test coverage (lib utilities + critical API routes)"
```
