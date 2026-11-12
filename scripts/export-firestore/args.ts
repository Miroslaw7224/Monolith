import { parseArgs } from "node:util";
import { DEFAULT_PAGE_SIZE } from "./types";

export type CliArgs =
  | { mode: "count-only" }
  | { mode: "verify"; dir: string }
  | {
      mode: "export";
      out: string | undefined;
      resume: boolean;
      skipAuth: boolean;
      pageSize: number;
    };

export function parseCliArgs(argv: string[]): CliArgs {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      "count-only": { type: "boolean" },
      verify: { type: "string" },
      out: { type: "string" },
      resume: { type: "boolean" },
      "skip-auth": { type: "boolean" },
      "page-size": { type: "string" },
    },
  });

  const countOnly = values["count-only"] === true;
  const verifyDir = values.verify;
  const others =
    values.out !== undefined ||
    values.resume === true ||
    values["skip-auth"] === true ||
    values["page-size"] !== undefined;

  if (countOnly && verifyDir !== undefined) {
    throw new Error("--count-only i --verify uruchamia się osobno.");
  }
  if (countOnly) {
    if (others) throw new Error("--count-only uruchamia się osobno, bez innych flag.");
    return { mode: "count-only" };
  }
  if (verifyDir !== undefined) {
    if (others) throw new Error("--verify uruchamia się osobno, bez innych flag.");
    return { mode: "verify", dir: verifyDir };
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  if (values["page-size"] !== undefined) {
    pageSize = Number(values["page-size"]);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
      throw new Error("--page-size musi być liczbą całkowitą od 1 do 1000.");
    }
  }
  if (values.resume === true && values.out === undefined) {
    throw new Error("--resume wymaga --out <katalog istniejącego, niedokończonego eksportu>.");
  }

  return {
    mode: "export",
    out: values.out,
    resume: values.resume === true,
    skipAuth: values["skip-auth"] === true,
    pageSize,
  };
}
