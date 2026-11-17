// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PortsResponseSchema, toPortsDto } from "@/contexts/bc_diagnostics/schemas";
import type { PortsSnapshot } from "@/contexts/bc_diagnostics/models";

const SNAP: PortsSnapshot = {
  generatedAt: "2026-11-17T10:00:00.000Z",
  sources: { wsl: { ok: true }, windows: { ok: false, reason: "timeout" } },
  ports: [
    {
      id: "wsl|1|3101",
      role: "frontend",
      orphan: false,
      source: "wsl",
      port: 3101,
      addresses: ["127.0.0.1", "::1"],
      pid: 1,
      process: "next-server",
      path: null,
      commandLine: null,
      exposure: "local",
      warning: "self",
      killCommand: "kill 1",
      relevant: true,
      project: { id: "tester-ai", name: "TesterAI" },
    },
  ],
  groups: [{ projectId: "tester-ai", launcher: { pid: 20, name: "node" }, missingRole: "backend" }],
};

describe("toPortsDto", () => {
  it("przepisuje migawkę i przechodzi walidację zod", () => {
    const dto = toPortsDto(SNAP);
    expect(dto.ports[0].killCommand).toBe("kill 1");
    expect(dto.ports[0]).toMatchObject({ id: "wsl|1|3101", role: "frontend", orphan: false });
    expect(dto.groups).toEqual(SNAP.groups);
    expect(PortsResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("odrzuca nieznany powód błędu źródła", () => {
    const bad = {
      ...toPortsDto(SNAP),
      sources: { wsl: { ok: false, reason: "x" }, windows: { ok: true } },
    };
    expect(PortsResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("odrzuca nieznaną rolę", () => {
    const dto = toPortsDto(SNAP);
    const bad = { ...dto, ports: [{ ...dto.ports[0], role: "middleware" }] };
    expect(PortsResponseSchema.safeParse(bad).success).toBe(false);
  });
});
