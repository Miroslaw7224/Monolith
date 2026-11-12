import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Katalog tymczasowego vaulta dla e2e. Stała ścieżka, bo config czytają też workery. */
export const E2E_VAULT = path.join(os.tmpdir(), "monolith-e2e-vault");

export default function globalSetup(): void {
  fs.rmSync(E2E_VAULT, { recursive: true, force: true });
  fs.mkdirSync(E2E_VAULT, { recursive: true });
}
