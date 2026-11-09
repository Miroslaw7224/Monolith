import type { ZodType } from "zod";

/** Which UI areas must be refreshed after a tool changed data. */
export type ChangedArea = "tasks" | "calendar" | "mindmaps";

export type ToolResult =
  | { ok: true; data: unknown; changed?: ChangedArea; summary?: string }
  | { ok: false; error: string };

export interface AgentTool<A = unknown> {
  name: string;
  description: string;
  schema: ZodType<A>;
  /** Read-only tools do not count towards the per-request mutation cap. */
  readOnly?: boolean;
  /** Destructive tools are never run by the model loop; they require user confirmation. */
  destructive?: boolean;
  /** One-line, human-readable description of what a destructive call will do. Throws if the target does not exist. */
  describe?: (userId: string, args: A) => Promise<string>;
  run: (userId: string, args: A) => Promise<ToolResult>;
}

/** Type-erased tool used by the registry. */
export type AnyAgentTool = AgentTool<unknown>;
