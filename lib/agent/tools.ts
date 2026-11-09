import { z } from "zod";
import type { OllamaToolDef } from "@/lib/ollama";
import type { AgentTool, AnyAgentTool, ToolResult } from "@/lib/agent/types";

/** Declare a tool with typed args; returns the type-erased form for the registry. */
export function defineTool<A>(tool: AgentTool<A>): AnyAgentTool {
  return tool as unknown as AnyAgentTool;
}

export function validateToolArgs(
  tool: AnyAgentTool,
  rawArgs: unknown
): { ok: true; args: unknown } | { ok: false; error: string } {
  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (parsed.success) return { ok: true, args: parsed.data };
  const detail = parsed.error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return { ok: false, error: `Invalid arguments: ${detail}` };
}

export async function executeTool(
  tools: AnyAgentTool[],
  userId: string,
  name: string,
  rawArgs: unknown
): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
  const validated = validateToolArgs(tool, rawArgs);
  if (validated.ok === false) return { ok: false, error: validated.error };
  try {
    return await tool.run(userId, validated.args);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function toOllamaTools(tools: AnyAgentTool[]): OllamaToolDef[] {
  return tools.map((t) => {
    const parameters = z.toJSONSchema(t.schema) as Record<string, unknown>;
    delete parameters.$schema;
    return {
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters },
    };
  });
}
