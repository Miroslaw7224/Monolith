import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

export type TempVault = {
  readonly root: string;
  write(rel: string, text: string): void;
  /** Treść pliku albo `null`, gdy nie istnieje. */
  read(rel: string): string | null;
};

/** Tymczasowy vault na czas jednego testu: ustawia NEXUS_VAULT_PATH i sprząta po teście. */
export function useTempVault(): TempVault {
  let tmp = "";
  let root = "";
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.NEXUS_VAULT_PATH;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-repo-"));
    root = path.join(tmp, "vault");
    fs.mkdirSync(root);
    process.env.NEXUS_VAULT_PATH = root;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.NEXUS_VAULT_PATH;
    else process.env.NEXUS_VAULT_PATH = previous;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  return {
    get root() {
      return root;
    },
    write(rel, text) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text, "utf8");
    },
    read(rel) {
      try {
        return fs.readFileSync(path.join(root, rel), "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
  };
}
