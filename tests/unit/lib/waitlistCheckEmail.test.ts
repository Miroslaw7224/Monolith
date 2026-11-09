import { describe, it, expect } from "vitest";
import { isValidEmail, parseWaitlistCheckEmailParam } from "../../../lib/waitlistCheckEmail.js";

describe("lib/waitlistCheckEmail", () => {
  it("isValidEmail accepts common addresses", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("user+tag@example.com")).toBe(true);
  });

  it("isValidEmail rejects invalid", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@nodomain.com")).toBe(false);
  });

  it("parseWaitlistCheckEmailParam rejects empty", () => {
    const r = parseWaitlistCheckEmailParam(null);
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.status).toBe(400);
      expect(r.body.error).toContain("email");
    }
    expect(parseWaitlistCheckEmailParam("   ").ok).toBe(false);
  });

  it("parseWaitlistCheckEmailParam rejects invalid format", () => {
    const r = parseWaitlistCheckEmailParam("bad");
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.body.allowed).toBe(false);
  });

  it("parseWaitlistCheckEmailParam normalizes email to lower case", () => {
    const r = parseWaitlistCheckEmailParam("  Test@Example.COM ");
    expect(r).toEqual({ ok: true, email: "test@example.com" });
  });
});
