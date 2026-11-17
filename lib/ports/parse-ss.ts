import type { RawListener } from "./types";

const OWNER = /users:\(\("((?:[^"\\]|\\.)*)",pid=(\d+)/;

function splitLocal(local: string): { address: string; port: number } | null {
  const i = local.lastIndexOf(":");
  if (i <= 0) return null;
  const port = Number(local.slice(i + 1));
  if (!Number.isInteger(port) || port < 0 || port > 65535) return null;
  let address = local.slice(0, i);
  if (address.startsWith("[") && address.endsWith("]")) address = address.slice(1, -1);
  const pct = address.indexOf("%");
  if (pct >= 0) address = address.slice(0, pct);
  return { address, port };
}

/** Zrzut `ss -ltnpH`: `LISTEN Recv-Q Send-Q Local Peer [users:(("nazwa",pid=N,fd=M),…)]`. */
export function parseSs(raw: string): RawListener[] {
  const out: RawListener[] = [];
  for (const line of raw.split("\n")) {
    const tokens = line.trim().split(/\s+/);
    if (tokens[0] !== "LISTEN" || tokens.length < 5) continue;
    const local = splitLocal(tokens[3]);
    if (!local) continue;
    const owner = OWNER.exec(line);
    out.push({
      port: local.port,
      address: local.address,
      pid: owner ? Number(owner[2]) : null,
      process: owner ? owner[1] : null,
      path: null,
      commandLine: null,
      cwd: null,
    });
  }
  return out;
}
