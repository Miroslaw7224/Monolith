/** @vitest-environment node */
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { DomainError } from "@/lib/errors";
import { handleServiceError } from "@/lib/http/apiError";
import { VaultConfigError } from "@/lib/nexus/vault-path";

describe("lib/apiError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps DomainError to JSON with status from error", async () => {
    const res = handleServiceError(new DomainError("Not here", 404));
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not here" });
  });

  it("maps VaultConfigError to 500 with its readable message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleServiceError(
      new VaultConfigError("Brak vaulta: ustaw NEXUS_VAULT_PATH na bezwzględną ścieżkę.")
    );
    expect(res.status).toBe(500);
    expect(String((await res.json()).error)).toContain("NEXUS_VAULT_PATH");
  });

  it("maps 429-shaped error to retry payload", async () => {
    const err = Object.assign(new Error("retry in 12.5s please"), { status: 429 });
    const res = handleServiceError(err);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.retryAfterSeconds).toBe(13);
    expect(String(json.error)).toContain("limit");
  });

  it("defaults 429 retry to 60 when message has no retry hint", async () => {
    const err = Object.assign(new Error("rate limited"), { status: 429 });
    const res = handleServiceError(err);
    const json = await res.json();
    expect(json.retryAfterSeconds).toBe(60);
  });

  it("returns 500 for unknown errors and logs", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleServiceError(new Error("boom"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("boom");
    expect(spy).toHaveBeenCalled();
  });
});
