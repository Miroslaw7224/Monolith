import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetTasks = vi.hoisted(() => vi.fn());
const mockCreateTask = vi.hoisted(() => vi.fn());

vi.mock("@/services/taskService", () => ({
  getTasks: mockGetTasks,
  createTask: mockCreateTask,
}));

import { GET, POST } from "@/app/api/tasks/route";

function makeRequest(options?: { method?: string; body?: unknown }): NextRequest {
  const headers: Record<string, string> = {};
  if (options?.body) headers["content-type"] = "application/json";
  return new NextRequest("http://localhost/api/tasks", {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

const fakeTask = {
  id: "task-1",
  title: "Napisać testy",
  description: "",
  link: "",
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
  });

  it("returns tasks array for authenticated user", async () => {
    mockGetTasks.mockResolvedValue([fakeTask]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].title).toBe("Napisać testy");
    expect(mockGetTasks).toHaveBeenCalledWith();
  });
});

describe("POST /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
