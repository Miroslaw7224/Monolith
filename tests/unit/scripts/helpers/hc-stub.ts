import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Dane, które atrapa `hc` zwraca zamiast żywego rdzenia herdr-core. */
export type HcFixtures = {
  /** Wynik `hc ls` (z `--json` lub bez). */
  ls?: { terminals: Record<string, unknown>[] };
  /** Wynik `hc get X`; klucz = adres albo nazwa. Brak klucza = kod 1. */
  get?: Record<string, unknown>;
  /** Ekran z `hc read X [--lines N]`; klucz = adres albo nazwa. */
  read?: Record<string, string>;
  /** Błąd `hc run` (stderr + kod 1). Gdy `failRunFor` podane, tylko dla wywołań, których argv go zawiera. */
  failRun?: string;
  failRunFor?: string;
};

export type HcStub = {
  dir: string;
  /** Katalog z atrapą `hc` oraz fałszywymi `agy` i `cursor-agent` (pierwszy na PATH). */
  binDir: string;
  /** Środowisko z atrapą `hc` na początku PATH i odizolowanym XDG_STATE_HOME. */
  env: NodeJS.ProcessEnv;
  /** Zarejestrowane wywołania modyfikujące (run|kill|rm|send|keys|attach), po jednym argv na wywołanie. */
  calls: () => string[][];
  /** Podmienia dane atrapy między wywołaniami skryptu (np. zmiana ekranu). */
  setFixtures: (fixtures: HcFixtures) => void;
};

const STUB = `#!/usr/bin/env python3
import json, os, sys
d = os.path.dirname(os.path.abspath(__file__))
fx = json.load(open(os.path.join(d, "fixtures.json")))
a = sys.argv[1:]
cmd = a[0] if a else ""
if cmd == "ls":
    print(json.dumps(fx.get("ls", {"terminals": []})))
elif cmd == "get":
    got = fx.get("get", {})
    if a[1] in got:
        print(json.dumps(got[a[1]]))
    else:
        sys.exit(1)
elif cmd == "read":
    pos = [x for x in a[1:] if not x.startswith("--") and not x.isdigit()]
    print(fx.get("read", {}).get(pos[0], "") if pos else "")
elif cmd in ("run", "kill", "rm", "send", "keys", "attach"):
    with open(os.path.join(d, "calls.log"), "a") as f:
        f.write(json.dumps(a) + "\\n")
    if cmd == "run" and fx.get("failRun") and (not fx.get("failRunFor") or fx["failRunFor"] in " ".join(a)):
        sys.stderr.write(fx["failRun"] + "\\n")
        sys.exit(1)
else:
    sys.exit(0)
`;

export function makeHcStub(fixtures: HcFixtures = {}): HcStub {
  const dir = mkdtempSync(path.join(os.tmpdir(), "hc-stub-"));
  const bin = path.join(dir, "bin");
  // bin/ trzyma tylko `hc`, żeby PATH nie zawierał innych plików z katalogu testu
  mkdirSync(bin);
  const script = path.join(bin, "hc");
  writeFileSync(script, STUB);
  chmodSync(script, 0o755);
  // fixtures.json i calls.log leżą obok skryptu
  const fixturesPath = path.join(bin, "fixtures.json");
  const callsPath = path.join(bin, "calls.log");
  writeFileSync(fixturesPath, JSON.stringify(fixtures));
  for (const prog of ["agy", "cursor-agent"]) {
    writeFileSync(path.join(bin, prog), "#!/bin/sh\nexit 0\n");
    chmodSync(path.join(bin, prog), 0o755);
  }
  const state = path.join(dir, "state");
  mkdirSync(state);
  return {
    dir,
    binDir: bin,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      XDG_STATE_HOME: state,
    },
    calls: () => {
      try {
        return readFileSync(callsPath, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l) as string[]);
      } catch {
        return [];
      }
    },
    setFixtures: (next) => writeFileSync(fixturesPath, JSON.stringify(next)),
  };
}
