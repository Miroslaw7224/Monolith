/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseBody } from "@/lib/http/parseBody";

describe("lib/parseBody", () => {
  it("returns validated data on valid JSON and schema match", async () => {
    const schema = z.object({ message: z.string(), lang: z.string().optional() });
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi", lang: "pl" }),
    });

    const result = await parseBody(req, schema);

    expect(result).toEqual({ success: true, data: { message: "hi", lang: "pl" } });
  });

  it("returns 400 when JSON is invalid", async () => {
    const schema = z.object({ a: z.number() });
    const req = new Request("http://localhost", {
      method: "POST",
      body: "not-json{",
    });

    const result = await parseBody(req, schema);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error).toBeDefined();
    }
  });

  it("returns 400 with validation details when schema fails", async () => {
    const schema = z.object({ email: z.string().email() });
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const result = await parseBody(req, schema);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.details).toBeDefined();
    }
  });
});
