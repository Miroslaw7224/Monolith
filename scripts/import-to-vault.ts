import { parseImportArgs } from "./import-to-vault/args";
import type { ImportArgs } from "./import-to-vault/args";
import { runImport } from "./import-to-vault/run";
import { EXIT } from "./import-to-vault/types";

const parsed = parseImportArgs(process.argv.slice(2), process.env);

if (!parsed.ok) {
  console.error((parsed as Extract<ImportArgs, { ok: false }>).error);
  process.exitCode = EXIT.USAGE;
} else {
  const args = parsed as Extract<ImportArgs, { ok: true }>;
  const { exitCode, screen } = runImport({
    dumpDir: args.dump,
    vaultRoot: args.vault,
    write: args.write,
    uid: args.uid,
  });
  console.log(screen);
  process.exitCode = exitCode;
}
