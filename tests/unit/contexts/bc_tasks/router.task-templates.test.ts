// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetTaskTemplates = vi.hoisted(() => vi.fn());
const mockCreateTaskTemplate = vi.hoisted(() => vi.fn());
const mockUpdateTaskTemplate = vi.hoisted(() => vi.fn());
const mockDeleteTaskTemplate = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_tasks/services", () => ({
  getTaskTemplates: mockGetTaskTemplates,
  createTaskTemplate: mockCreateTaskTemplate,
  updateTaskTemplate: mockUpdateTaskTemplate,
  deleteTaskTemplate: mockDeleteTaskTemplate,
}));

import { GET, POST } from "@/app/api/task-templates/route";
import { PUT, DELETE } from "@/app/api/task-templates/[id]/route";

function makeRequest(options?: { method?: string; body?: unknown; url?: string }): NextRequest {
  const headers: Record<string, string> = {};
  if (options?.body) headers["content-type"] = "application/json";
  return new NextRequest(options?.url ?? "http://localhost/api/task-templates", {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

const fakeTemplate = {
  id: "tpl-1",
  label: "Review PR",
  title: "Review PR",
  link: "",
  created_at: new Date().toISOString(),
};

describe("GET /api/task-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns templates array for authenticated user", async () => {
    mockGetTaskTemplates.mockResolvedValue([fakeTemplate]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].label).toBe("Review PR");
    expect(mockGetTaskTemplates).toHaveBeenCalledWith();
  });
});

describe("POST /api/task-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when label is missing", async () => {
    const res = await POST(makeRequest({ method: "POST", body: { title: "Review PR" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/label/i);
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(makeRequest({ method: "POST", body: { label: "Review PR" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/title/i);
  });

  it("creates template and returns it", async () => {
    mockCreateTaskTemplate.mockResolvedValue(fakeTemplate);
    const res = await POST(
      makeRequest({
        method: "POST",
        body: { label: "Review PR", title: "Review PR", link: "" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.label).toBe("Review PR");
    expect(mockCreateTaskTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Review PR", title: "Review PR" })
    );
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/task-templates", {
      method: "POST",
      headers: { authorization: "Bearer valid", "content-type": "application/json" },
      body: "bad-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/task-templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates template and returns success", async () => {
    mockUpdateTaskTemplate.mockResolvedValue(undefined);
    const res = await PUT(
      makeRequest({
        method: "PUT",
        body: { title: "Updated" },
        url: "http://localhost/api/task-templates/tpl-1",
      }),
      { params: Promise.resolve({ id: "tpl-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockUpdateTaskTemplate).toHaveBeenCalledWith(
      "tpl-1",
      expect.objectContaining({ title: "Updated" })
    );
  });
});

describe("DELETE /api/task-templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes template and returns success", async () => {
    mockDeleteTaskTemplate.mockResolvedValue(undefined);
    const res = await DELETE(
      makeRequest({
        method: "DELETE",
        url: "http://localhost/api/task-templates/tpl-1",
      }),
      { params: Promise.resolve({ id: "tpl-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockDeleteTaskTemplate).toHaveBeenCalledWith("tpl-1");
  });
});
