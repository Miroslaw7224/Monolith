// @vitest-environment node
import { describe, expect, it } from "vitest";
import { VaultConfigError, resolveVaultRoot } from "@/lib/nexus/vault-path";

const linux = { platform: "linux" as const };
const win = { platform: "win32" as const };

describe("resolveVaultRoot", () => {
  it("throws VaultConfigError when NEXUS_VAULT_PATH is missing or blank", () => {
    expect(() => resolveVaultRoot({}, linux)).toThrow(VaultConfigError);
    expect(() => resolveVaultRoot({ NEXUS_VAULT_PATH: "   " }, linux)).toThrow(/NEXUS_VAULT_PATH/);
  });

  it("returns an absolute posix path unchanged on linux (trailing slash trimmed)", () => {
    expect(resolveVaultRoot({ NEXUS_VAULT_PATH: "/home/u/NEXUS/Vault/" }, linux)).toBe(
      "/home/u/NEXUS/Vault"
    );
  });

  it("maps a Windows drive path to /mnt/<drive>/ on linux", () => {
    expect(resolveVaultRoot({ NEXUS_VAULT_PATH: "E:\\NEXUS\\Vault" }, linux)).toBe(
      "/mnt/e/NEXUS/Vault"
    );
    expect(resolveVaultRoot({ NEXUS_VAULT_PATH: "e:/NEXUS/Vault" }, linux)).toBe(
      "/mnt/e/NEXUS/Vault"
    );
  });

  it("maps /mnt/<drive>/ to a Windows drive path on win32", () => {
    expect(resolveVaultRoot({ NEXUS_VAULT_PATH: "/mnt/e/NEXUS/Vault" }, win)).toBe(
      "E:\\NEXUS\\Vault"
    );
  });

  it("keeps a Windows drive path on win32", () => {
    expect(resolveVaultRoot({ NEXUS_VAULT_PATH: "E:\\NEXUS\\Vault" }, win)).toBe(
      "E:\\NEXUS\\Vault"
    );
  });

  it("rejects a relative path", () => {
    expect(() => resolveVaultRoot({ NEXUS_VAULT_PATH: "NEXUS/Vault" }, linux)).toThrow(
      /bezwzględn/
    );
    expect(() => resolveVaultRoot({ NEXUS_VAULT_PATH: "~/NEXUS/Vault" }, linux)).toThrow(
      /bezwzględn/
    );
  });
});
