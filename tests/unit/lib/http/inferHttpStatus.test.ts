import { describe, it, expect } from "vitest";
import { inferHttpStatus } from "@/lib/http/inferHttpStatus";

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
