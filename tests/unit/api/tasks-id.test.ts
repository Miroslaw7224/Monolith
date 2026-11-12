import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockUpdateTask = vi.hoisted(() => vi.fn());
const mockDeleteTask = vi.hoisted(() => vi.fn());

vi.mock("@/services/taskService", () => ({
  updateTask: mockUpdateTask,
  deleteTask: mockDeleteTask,
}));

import { PUT, DELETE } from "@/app/api/tasks/[id]/route";

const params = Promise.resolve({ id: "task-1" });

function makeRequest(method: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = {};
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
  });

  it("deletes task and returns success", async () => {
    mockDeleteTask.mockResolvedValue(undefined);
    const res = await DELETE(makeRequest("DELETE"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockDeleteTask).toHaveBeenCalledWith("task-1");
  });
});
