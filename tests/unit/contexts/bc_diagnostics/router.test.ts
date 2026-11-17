// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const mockList = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_diagnostics/services", () => ({ listPorts: mockList }));

import { GET } from "@/app/api/diagnostics/ports/route";

beforeEach(() => {
  mockList.mockReset();
});

describe("GET /api/diagnostics/ports", () => {
  it("zwraca DTO", async () => {
    mockList.mockResolvedValue({
      generatedAt: "2026-11-17T10:00:00.000Z",
      sources: { wsl: { ok: true }, windows: { ok: true } },
      ports: [],
      groups: [],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      generatedAt: "2026-11-17T10:00:00.000Z",
      sources: { wsl: { ok: true }, windows: { ok: true } },
      ports: [],
      groups: [],
    });
  });

  it("mapuje błąd domeny przez handleServiceError", async () => {
    mockList.mockRejectedValue(new DomainError("brak", 404));
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
