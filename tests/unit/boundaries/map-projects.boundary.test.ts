// @vitest-environment node
/**
 * Granica `bc_map` → `bc_projects` (ASERCJE-3) bez atrap kontekstów: rejestr z tymczasowego vaulta dochodzi
 * do mapy przez `listProjects` / `isWorkProject`.
 * Atrapa tylko na podprocesie: `@/lib/herdr/hc-ls` (`listTerminals` uruchamia `hc ls`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as HcLs from "@/lib/herdr/hc-ls";
import { boundaryRegistry, REGISTRY_PATH } from "../helpers/boundaryRegistry";
import { setupTempVault } from "../helpers/tempVault";

const mockListTerminals = vi.hoisted(() => vi.fn<typeof HcLs.listTerminals>());

vi.mock(
  "@/lib/herdr/hc-ls",
  () => ({ listTerminals: mockListTerminals }) satisfies Partial<typeof HcLs>
);

import { getAgents, getGraph } from "@/contexts/bc_map/services";

const vault = setupTempVault();

const terminal = (o: Partial<HcLs.HerdrTerminal>): HcLs.HerdrTerminal => ({
  address: "w1:p1",
  agent: "claude",
  cwd: "/",
  state: "idle",
  status: "pracuje",
  where: "Brain_7224",
  ...o,
});

beforeEach(() => {
  vault.write(REGISTRY_PATH, boundaryRegistry("/tmp/alfa", "/tmp/beta"));
  vault.write(
    "tech-stack-wspolny.md",
    "# Wspólny stack\n\n**Używają:** [[Projects/alfa]] [[Projects/beta]]\n"
  );
  mockListTerminals.mockReset();
});

describe("granica map ↔ projects", () => {
  it("agent w projekcie etatowym nie dostaje projektu ani miejsca", () => {
    mockListTerminals.mockReturnValue({
      available: true,
      terminals: [
        terminal({ address: "w1:p1", cwd: "/tmp/alfa/src", where: "alfa-ws" }),
        terminal({ address: "w1:p2", cwd: "/tmp/beta/src", where: "beta-ws" }),
      ],
    });
    expect(getAgents()).toEqual({
      available: true,
      agents: [
        {
          address: "w1:p1",
          label: "claude",
          state: "idle",
          status: "pracuje",
          projectId: "alfa",
          where: "alfa-ws",
        },
        { address: "w1:p2", label: "claude", state: "idle" },
      ],
    });
  });

  it("graf ma skupiska projektów z nazwą i owner z rejestru, bez ostrzeżeń", () => {
    const graph = getGraph();
    expect(graph.clusters.filter((c) => c.group === "projects")).toEqual([
      {
        id: "alfa",
        label: "Alfa",
        group: "projects",
        size: 0,
        projectId: "alfa",
        owner: "personal",
      },
      { id: "beta", label: "Beta", group: "projects", size: 0, projectId: "beta", owner: "work" },
    ]);
    expect(graph.clusterEdges).toEqual([{ from: "alfa", to: "beta", weight: 1 }]);
    expect(graph.warnings).toEqual([]);
  });
});
