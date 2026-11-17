import { z } from "zod";
import type { PortsSnapshot } from "./models";

const FailureSchema = z.enum(["missing", "timeout", "error"]);
const SourceStatusSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: FailureSchema }),
]);

const RoleSchema = z.enum(["frontend", "backend"]);

export const PortListenerSchema = z.object({
  id: z.string(),
  source: z.enum(["wsl", "windows"]),
  port: z.number().int(),
  addresses: z.array(z.string()),
  exposure: z.enum(["local", "network"]),
  pid: z.number().int().nullable(),
  process: z.string(),
  path: z.string().nullable(),
  commandLine: z.string().nullable(),
  warning: z.enum(["self"]).nullable(),
  killCommand: z.string().nullable(),
  relevant: z.boolean(),
  project: z.object({ id: z.string(), name: z.string() }).nullable(),
  role: RoleSchema.nullable(),
  orphan: z.boolean(),
});

export const PortGroupSchema = z.object({
  projectId: z.string(),
  launcher: z.object({ pid: z.number().int(), name: z.string() }).nullable(),
  missingRole: RoleSchema.nullable(),
});

export const PortsResponseSchema = z.object({
  generatedAt: z.string(),
  sources: z.object({ wsl: SourceStatusSchema, windows: SourceStatusSchema }),
  ports: z.array(PortListenerSchema),
  groups: z.array(PortGroupSchema),
});

export type PortListenerDto = z.infer<typeof PortListenerSchema>;
export type PortGroupDto = z.infer<typeof PortGroupSchema>;
export type SourceStatusDto = z.infer<typeof SourceStatusSchema>;
export type PortsResponseDto = z.infer<typeof PortsResponseSchema>;

export function toPortsDto(snapshot: PortsSnapshot): PortsResponseDto {
  return {
    generatedAt: snapshot.generatedAt,
    sources: { wsl: snapshot.sources.wsl, windows: snapshot.sources.windows },
    groups: snapshot.groups.map((g) => ({
      projectId: g.projectId,
      launcher: g.launcher,
      missingRole: g.missingRole,
    })),
    ports: snapshot.ports.map((p) => ({
      id: p.id,
      source: p.source,
      port: p.port,
      addresses: p.addresses,
      exposure: p.exposure,
      pid: p.pid,
      process: p.process,
      path: p.path,
      commandLine: p.commandLine,
      warning: p.warning,
      killCommand: p.killCommand,
      relevant: p.relevant,
      project: p.project,
      role: p.role,
      orphan: p.orphan,
    })),
  };
}
