// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Auth } from "firebase-admin/auth";
import { exportAuthUsers } from "@/scripts/export-firestore/auth-export";

const made: string[] = [];
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsx-auth-"));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function user(uid: string) {
  return {
    uid,
    email: `${uid}@example.test`,
    disabled: false,
    metadata: { creationTime: "2026-01-01T00:00:00Z", lastSignInTime: "2026-02-01T00:00:00Z" },
    providerData: [{ providerId: "password" }],
    passwordHash: "SECRET-HASH",
    passwordSalt: "SECRET-SALT",
  };
}

describe("exportAuthUsers", () => {
  it("follows page tokens and writes only account metadata (no hashes)", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ users: [user("u1")], pageToken: "next" })
      .mockResolvedValueOnce({ users: [user("u2")], pageToken: undefined });
    const dir = tmp();

    const result = await exportAuthUsers({ listUsers } as unknown as Auth, dir);

    expect(result).toEqual({ ok: true, users: 2, file: "auth-users.json" });
    expect(listUsers).toHaveBeenNthCalledWith(1, 1000, undefined);
    expect(listUsers).toHaveBeenNthCalledWith(2, 1000, "next");
    const file = path.join(dir, "auth-users.json");
    const text = fs.readFileSync(file, "utf8");
    expect(JSON.parse(text)).toEqual([
      {
        uid: "u1",
        email: "u1@example.test",
        disabled: false,
        createdAt: "2026-01-01T00:00:00Z",
        lastSignInAt: "2026-02-01T00:00:00Z",
        providers: ["password"],
      },
      {
        uid: "u2",
        email: "u2@example.test",
        disabled: false,
        createdAt: "2026-01-01T00:00:00Z",
        lastSignInAt: "2026-02-01T00:00:00Z",
        providers: ["password"],
      },
    ]);
    expect(text).not.toContain("SECRET");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it("reports a failure instead of throwing, and writes no file", async () => {
    const listUsers = vi.fn().mockRejectedValue(new Error("boom"));
    const dir = tmp();

    const result = await exportAuthUsers({ listUsers } as unknown as Auth, dir);

    expect(result).toEqual({ ok: false, error: "boom" });
    expect(fs.existsSync(path.join(dir, "auth-users.json"))).toBe(false);
  });
});
