import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/src/lib/apiFetch";

describe("apiFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("deleguje do fetch z tym samym URL i opcjami, bez nagłówka Authorization", async () => {
    const response = new Response("{}", { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const init = { method: "POST", headers: { "Content-Type": "application/json" } };
    const res = await apiFetch("/api/notes", init);

    expect(res).toBe(response);
    expect(fetchMock).toHaveBeenCalledWith("/api/notes", init);
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).not.toContain("Authorization");
  });

  it("bez opcji woła fetch z pustym obiektem opcji", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/tags");
    expect(fetchMock).toHaveBeenCalledWith("/api/tags", {});
  });
});
