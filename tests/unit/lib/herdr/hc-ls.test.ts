// @vitest-environment node
import { describe, expect, it } from "vitest";
import { listTerminals, parseHcLs } from "@/lib/herdr/hc-ls";

const DUMP = JSON.stringify({
  hidden_finished: 0,
  terminals: [
    {
      address: "t1q",
      agent: "bash",
      cwd: "/home/u/NEXUS",
      state: "live",
      turn: 0,
      where: "NEXUS / 1",
    },
    {
      address: "t1r",
      agent: "claude-code",
      cwd: "/home/u/Monolith",
      state: "live",
      status: "working",
      turn: 507,
      where: "Monolith / 1",
    },
    { address: "t1u", cwd: "/home/u/Monolith", state: "live", turn: 2, where: "Monolith / 1" },
    { agent: "bez-adresu" },
    5,
  ],
});

describe("parseHcLs", () => {
  it("parsuje terminale, pomija wpisy bez adresu i niebędące obiektami", () => {
    const list = parseHcLs(DUMP);
    expect(list).toHaveLength(3);
    expect(list![1]).toEqual({
      address: "t1r",
      agent: "claude-code",
      cwd: "/home/u/Monolith",
      state: "live",
      status: "working",
      where: "Monolith / 1",
    });
  });

  it("puste lub brakujące pole agent daje pusty napis, brak status nie tworzy klucza", () => {
    const list = parseHcLs(DUMP)!;
    expect(list[2].agent).toBe("");
    expect(list[0]).not.toHaveProperty("status");
  });

  it("zły JSON i brak listy terminals dają null", () => {
    expect(parseHcLs("nie json")).toBeNull();
    expect(parseHcLs("{}")).toBeNull();
    expect(parseHcLs("null")).toBeNull();
  });
});

describe("listTerminals", () => {
  it("zwraca terminale, gdy hc odpowiada", () => {
    const res = listTerminals(() => DUMP);
    expect(res.available).toBe(true);
    if (res.available) expect(res.terminals).toHaveLength(3);
  });

  it("brak hc, timeout (wyjątek z wywołania) kończą się available:false, nie wyjątkiem", () => {
    const res = listTerminals(() => {
      throw new Error("ENOENT");
    });
    expect(res).toEqual({ available: false });
  });

  it("niepoprawna odpowiedź kończy się available:false", () => {
    expect(listTerminals(() => "śmieci")).toEqual({ available: false });
  });
});
