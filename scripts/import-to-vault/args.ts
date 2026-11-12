import { parseArgs } from "node:util";

export type ImportArgs =
  | { ok: true; dump: string; vault: string; write: boolean; uid?: string }
  | { ok: false; error: string };

export function parseImportArgs(
  argv: string[],
  env: Record<string, string | undefined>
): ImportArgs {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        dump: { type: "string" },
        vault: { type: "string" },
        write: { type: "boolean" },
        uid: { type: "string" },
        help: { type: "boolean" },
      },
    }));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  if (!values.dump) {
    return { ok: false, error: "Brak --dump <katalog zrzutu>." };
  }
  const vault = values.vault || env.NEXUS_VAULT_PATH;
  if (!vault) {
    return {
      ok: false,
      error: "Brak vaulta: podaj --vault <ścieżka> albo ustaw NEXUS_VAULT_PATH.",
    };
  }

  const result: ImportArgs = {
    ok: true,
    dump: values.dump,
    vault,
    write: values.write === true,
  };
  if (values.uid) result.uid = values.uid;
  return result;
}
