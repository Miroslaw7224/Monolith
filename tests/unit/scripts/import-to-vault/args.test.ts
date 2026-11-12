// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseImportArgs } from "@/scripts/import-to-vault/args";

describe("parseImportArgs", () => {
  it("parses --dump and --vault, write defaults to false", () => {
    expect(parseImportArgs(["--dump", "d", "--vault", "v"], {})).toEqual({
      ok: true,
      dump: "d",
      vault: "v",
      write: false,
    });
  });

  it("falls back to NEXUS_VAULT_PATH and parses --write", () => {
    expect(parseImportArgs(["--dump", "d", "--write"], { NEXUS_VAULT_PATH: "/x/Vault" })).toEqual({
      ok: true,
      dump: "d",
      vault: "/x/Vault",
      write: true,
    });
  });

  it("requires --dump", () => {
    const result = parseImportArgs(["--vault", "v"], {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("--dump");
  });

  it("requires a vault from --vault or NEXUS_VAULT_PATH", () => {
    const result = parseImportArgs(["--dump", "d"], {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("NEXUS_VAULT_PATH");
  });

  it("returns an error (does not throw) for an unknown option", () => {
    const result = parseImportArgs(["--dump", "d", "--vault", "v", "--nope"], {});
    expect(result.ok).toBe(false);
  });

  it("parses --uid", () => {
    expect(parseImportArgs(["--dump", "d", "--vault", "v", "--uid", "u1"], {})).toMatchObject({
      ok: true,
      uid: "u1",
    });
  });
});
