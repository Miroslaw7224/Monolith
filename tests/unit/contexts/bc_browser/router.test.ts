// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const mockOpen = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_browser/services", () => ({ openInChrome: mockOpen }));

import { POST } from "@/app/api/browser/open/route";

beforeEach(() => {
  mockOpen.mockReset();
});

const req = (body: unknown) =>
  new Request("http://127.0.0.1/api/browser/open", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/browser/open", () => {
  it("otwiera adres", async () => {
    mockOpen.mockResolvedValue(undefined);
    const res = await POST(req({ url: "https://example.com" }));
    expect(res.status).toBe(200);
    expect(mockOpen).toHaveBeenCalledWith("https://example.com");
  });
  it("400 dla ciała bez url", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });
  it("mapuje błąd domeny", async () => {
    mockOpen.mockImplementation(async () => {
      throw new DomainError("zły", 400);
    });
    const res = await POST(req({ url: "x" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "zły" });
  });
});
