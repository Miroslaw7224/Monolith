import fs from "node:fs";
import path from "node:path";
import type { Auth } from "firebase-admin/auth";
import { AUTH_USERS_FILE, type AuthExport } from "./types";

/** Zapisuje tylko metadane kont (bez haszy haseł i tokenów). Błąd nie przerywa eksportu danych. */
export async function exportAuthUsers(
  auth: Auth,
  outDir: string,
  opts: { uid?: string } = {}
): Promise<AuthExport> {
  try {
    const users: Array<Record<string, unknown>> = [];
    let pageToken: string | undefined;
    do {
      // Z uid pobieramy wyłącznie to jedno konto, bez listowania pozostałych.
      const page = opts.uid
        ? { users: [await auth.getUser(opts.uid)], pageToken: undefined }
        : await auth.listUsers(1000, pageToken);
      for (const user of page.users) {
        users.push({
          uid: user.uid,
          email: user.email ?? null,
          disabled: user.disabled,
          createdAt: user.metadata.creationTime,
          lastSignInAt: user.metadata.lastSignInTime,
          providers: user.providerData.map((p) => p.providerId),
        });
      }
      pageToken = page.pageToken;
    } while (pageToken);
    fs.writeFileSync(path.join(outDir, AUTH_USERS_FILE), JSON.stringify(users, null, 2) + "\n", {
      mode: 0o600,
    });
    return { ok: true, users: users.length, file: AUTH_USERS_FILE };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
