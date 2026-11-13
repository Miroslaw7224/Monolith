// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DomainError } from "@/lib/errors";

const mockReorderTasks = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_tasks/services", () => ({
  reorderTasks: mockReorderTasks,
}));

import { PUT } from "@/app/api/tasks/reorder/route";

const put = (body: unknown) =>
  new NextRequest("http://localhost/api/tasks/reorder", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  mockReorderTasks.mockReset();
});

describe("PUT /api/tasks/reorder", () => {
  it("przekazuje taskIds do serwisu i zwraca success", async () => {
    mockReorderTasks.mockResolvedValue(undefined);
    const res = await PUT(put({ taskIds: ["a", "b"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockReorderTasks).toHaveBeenCalledWith(["a", "b"]);
  });

  it("zwraca 400 dla niepoprawnego JSON", async () => {
    const res = await PUT(put("{nie-json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
    expect(mockReorderTasks).not.toHaveBeenCalled();
  });

  it.each([[{ taskIds: "x" }], [{ taskIds: [1, 2] }], [{}]])(
    "zwraca 400, gdy taskIds nie jest tablicą stringów (%j)",
    async (body) => {
      const res = await PUT(put(body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "taskIds must be an array of strings" });
      expect(mockReorderTasks).not.toHaveBeenCalled();
    }
  );

  it("mapuje błąd domeny na jego status", async () => {
    mockReorderTasks.mockRejectedValue(new DomainError("Task not found: x", 404));
    const res = await PUT(put({ taskIds: ["x"] }));
    expect(res.status).toBe(404);
  });
});
