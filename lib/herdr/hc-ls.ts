import { execFileSync } from "node:child_process";

/** Surowy rekord terminala z `hc ls`. `cwd` nie opuszcza `bc_map/services` (D9). */
export type HerdrTerminal = {
  address: string;
  agent: string;
  cwd: string;
  state: string;
  status?: string;
  where: string;
};

export type TerminalsResult =
  | { available: true; terminals: HerdrTerminal[] }
  | { available: false };

const text = (v: unknown): string => (typeof v === "string" ? v : "");

/** `null`, gdy to nie jest poprawny zrzut `hc ls`. Wpisy bez `address` są pomijane. */
export function parseHcLs(raw: string): HerdrTerminal[] | null {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return null;
  }
  if (doc === null || typeof doc !== "object") return null;
  const list = (doc as { terminals?: unknown }).terminals;
  if (!Array.isArray(list)) return null;
  const out: HerdrTerminal[] = [];
  for (const item of list) {
    if (item === null || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const address = text(r.address);
    if (address === "") continue;
    const status = text(r.status);
    out.push({
      address,
      agent: text(r.agent).trim(),
      cwd: text(r.cwd),
      state: text(r.state),
      where: text(r.where),
      ...(status !== "" ? { status } : {}),
    });
  }
  return out;
}

/** Bez powłoki, stałe argumenty, limit czasu 2 s (wzór: `lib/git/project-git.ts`). */
function runHcLs(): string {
  return execFileSync("hc", ["ls"], {
    encoding: "utf8",
    timeout: 2000,
    maxBuffer: 256 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/** Brak `hc`, błąd, timeout i śmieci w odpowiedzi dają `{ available: false }`, nigdy wyjątek. `run` tylko dla testów. */
export function listTerminals(run: () => string = runHcLs): TerminalsResult {
  try {
    const terminals = parseHcLs(run());
    return terminals === null ? { available: false } : { available: true, terminals };
  } catch {
    return { available: false };
  }
}
