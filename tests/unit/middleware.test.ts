// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "@/middleware";

function makeRequest(method: string, headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3100/api/notes", { method, headers });
}

const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("middleware", () => {
  it("lets a GET with a local host through", () => {
    const res = middleware(makeRequest("GET", { host: "localhost:3100" }));
    expect(passes(res)).toBe(true);
  });

  it("rejects a GET with a foreign host", async () => {
    const res = middleware(makeRequest("GET", { host: "evil.com" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });

  it("lets a same-origin POST through", () => {
    const res = middleware(
      makeRequest("POST", { host: "localhost:3100", "sec-fetch-site": "same-origin" })
    );
    expect(passes(res)).toBe(true);
  });

  it("rejects a POST from a foreign Origin", () => {
    const res = middleware(
      makeRequest("POST", { host: "localhost:3100", origin: "http://evil.com" })
    );
    expect(res.status).toBe(403);
  });

  it("lets a tool through with X-Nexus-Client: 1", () => {
    const res = middleware(makeRequest("POST", { host: "localhost:3100", "x-nexus-client": "1" }));
    expect(passes(res)).toBe(true);
  });

  it("does not match static assets but matches API routes", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/_next/static/x.js")).toBe(false);
    expect(matcher.test("/_next/image")).toBe(false);
    expect(matcher.test("/api/notes")).toBe(true);
    expect(matcher.test("/dashboard")).toBe(true);
  });
});
