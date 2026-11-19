// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type HcFixtures, makeHcStub } from "../helpers/hc-stub";

const SCRIPT = path.join(process.cwd(), "scripts/ask-helper.sh");
const NONCE = "ref:aaa111bbb222";

type Stub = ReturnType<typeof makeHcStub>;

function run(stub: Stub, args: string[]) {
  const res = spawnSync("bash", [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...stub.env, ASK_HELPER_START_WAIT: "0", ASK_HELPER_POLL_SEC: "0.05" },
    timeout: 60_000,
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

const stateDir = (stub: Stub) => path.join(stub.env.XDG_STATE_HOME as string, "ask-helper");
const lastFile = (stub: Stub) => path.join(stateDir(stub), "last-t1.json");

function writeLast(stub: Stub, over: Record<string, unknown> = {}) {
  mkdirSync(stateDir(stub), { recursive: true });
  writeFileSync(
    lastFile(stub),
    JSON.stringify({
      target: "t1",
      nonce: NONCE,
      sent_ms: 1,
      role: "task",
      collects: 0,
      nudged: false,
      screen_hash: "",
      ...over,
    })
  );
}
const readLast = (stub: Stub) => JSON.parse(readFileSync(lastFile(stub), "utf8"));
const withScreen = (screen: string): HcFixtures => ({ read: { t1: screen } });

const COLLECT = ["--collect", "--target", "t1", "--timeout", "0"];
const ECHO = `[Rola: pomocnik] zrób coś (${NONCE})`;

describe("ask-helper.sh --collect", () => {
  it("brak pliku zadania: kod 1", () => {
    const stub = makeHcStub(withScreen(ECHO));
    const res = run(stub, [...COLLECT, "cursor"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("brak zadania do odebrania");
  });

  it("wynik za nonce: wypisuje go, kod 0", () => {
    const stub = makeHcStub(withScreen(`${ECHO}\n=== WYNIK ===\nok\n> `));
    writeLast(stub);
    const res = run(stub, [...COLLECT, "--timeout", "5", "cursor"]);
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("ok");
  });

  it("długi prompt zwinięty do [Pasted text]: nonce tylko w końcowej linii GOTOWE, wynik i tak wypisany", () => {
    const stub = makeHcStub(
      withScreen(
        `[Pasted text #1 +1 lines]\n\n  Uruchamiam polecenia.\n\n  === WYNIK ===\n\n  PRZESZŁO: tsc, vitest (267 testów), lint\n\n  GOTOWE: ${NONCE} — ok\n\n> `
      )
    );
    writeLast(stub);
    const res = run(stub, [...COLLECT, "--timeout", "5", "cursor"]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("PRZESZŁO: tsc, vitest (267 testów), lint");
  });

  it("prompt zwinięty do [Pasted text], pomocnik jeszcze pracuje (brak nonce na ekranie): kod 3, nie 1", () => {
    const stub = makeHcStub(
      withScreen("[Pasted text #1 +1 lines]\n\nczytam pliki\nRunning grep\nctrl+c to stop")
    );
    writeLast(stub);
    expect(run(stub, [...COLLECT, "cursor"]).status).toBe(3);
  });

  it("po zapytaniu kontrolnym odpowiedź bez === WYNIK === (linia GOTOWE:) kończy zbieranie kodem 0", () => {
    const stub = makeHcStub(
      withScreen(
        `${ECHO}\nPodaj wynik poprzedniego zadania; zakończ linią GOTOWE: albo UTKNĄŁEM:\n\n  Wynik jest taki.\n  GOTOWE: zrobione\n\n> `
      )
    );
    writeLast(stub, { collects: 3, nudged: true });
    const res = run(stub, [...COLLECT, "--timeout", "5", "cursor"]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("GOTOWE: zrobione");
  });

  it("stopka Cursora (zawinięta ścieżka, gałąź, numer PR) nie trafia do wyniku", () => {
    const bar = "▄".repeat(20);
    const stub = makeHcStub(
      withScreen(
        `${ECHO}\n\n  === WYNIK ===\n  9+9 to 18.\n\n ${bar}\n  → Add a follow-up\n ${"▀".repeat(20)}\n  Composer 2.5 · 9.3%\n  ~/projects/Brain_7224/Monolith ·\n  feat/pomocnicy-start-i-verify · #101`
      )
    );
    writeLast(stub);
    const res = run(stub, [...COLLECT, "--timeout", "5", "cursor"]);
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("9+9 to 18.");
  });

  it("nonce zadania nie ma na ekranie: kod 1, nie myli wyników", () => {
    const stub = makeHcStub(withScreen("ref:ffffffffffff\n=== WYNIK ===\ninne\n"));
    writeLast(stub);
    const res = run(stub, [...COLLECT, "cursor"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("wynik niedostępny na ekranie");
  });

  it("pomocnik pracuje: kod 3, licznik prób rośnie", () => {
    const stub = makeHcStub(withScreen(`${ECHO}\nczytam pliki\nRunning grep\nctrl+c to stop`));
    writeLast(stub);
    const res = run(stub, [...COLLECT, "cursor"]);
    expect(res.status).toBe(3);
    expect(readLast(stub).collects).toBe(1);
    expect(stub.calls().filter((c) => c[0] === "send")).toEqual([]);
  });

  it("cisza po trzech próbach: zapytanie kontrolne raz, potem kod 4", () => {
    const stub = makeHcStub(withScreen(`${ECHO}\nnic się nie dzieje\n> `));
    writeLast(stub);
    for (let i = 1; i <= 3; i++) {
      expect(run(stub, [...COLLECT, "cursor"]).status).toBe(3);
      expect(readLast(stub).collects).toBe(i);
    }
    const fourth = run(stub, [...COLLECT, "cursor"]);
    const sends = stub.calls().filter((c) => c[0] === "send");
    expect(sends).toHaveLength(1);
    expect(sends[0][2]).toContain("Podaj wynik poprzedniego zadania");
    expect(readLast(stub).nudged).toBe(true);
    expect(fourth.status).toBe(4);
    expect(fourth.stderr).toContain("nic się nie dzieje");

    expect(run(stub, [...COLLECT, "cursor"]).status).toBe(4);
    expect(stub.calls().filter((c) => c[0] === "send")).toHaveLength(1);
  });

  it("dialog zgody: kod 2, bez zapytania", () => {
    const stub = makeHcStub(
      withScreen(`${ECHO}\n $  npm run lint\n Run this command?\n → Run (once) (y)`)
    );
    writeLast(stub);
    const res = run(stub, [...COLLECT, "cursor"]);
    expect(res.status).toBe(2);
    expect(stub.calls().filter((c) => c[0] === "send")).toEqual([]);
  });
});

describe("ask-helper.sh: zapis zadania", () => {
  it("zwykłe wywołanie zapisuje last-<nazwa>.json z collects 0", () => {
    const stub = makeHcStub(withScreen("{{NONCE}}\n=== WYNIK ===\nok\n> "));
    const res = run(stub, [
      "--keep",
      "--tier",
      "none",
      "--target",
      "t1",
      "--timeout",
      "5",
      "cursor",
      "pytanie",
    ]);
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("ok");
    const last = readLast(stub);
    expect(last).toMatchObject({ target: "t1", role: "advice", collects: 0, nudged: false });
    expect(last.nonce).toMatch(/^ref:[0-9a-f]{12}$/);
  });
});
