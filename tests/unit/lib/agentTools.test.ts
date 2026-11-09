import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { defineTool, executeTool, toOllamaTools, validateToolArgs } from "@/lib/agent/tools";

const echo = defineTool({
  name: "echo",
  description: "Echo text",
  schema: z.object({ text: z.string(), times: z.coerce.number().int().min(1).optional() }),
  readOnly: true,
  run: async (_userId, args) => ({ ok: true, data: args.text }),
});

describe("agent tool framework", () => {
  it("toOllamaTools converts the zod schema to JSON schema without $schema", () => {
    const [def] = toOllamaTools([echo]);
    expect(def.type).toBe("function");
    expect(def.function.name).toBe("echo");
    expect(def.function.parameters.type).toBe("object");
    expect(def.function.parameters).not.toHaveProperty("$schema");
    expect(def.function.parameters.properties).toHaveProperty("text");
  });

  it("validateToolArgs coerces numeric strings", () => {
    const res = validateToolArgs(echo, { text: "a", times: "2" });
    expect(res).toEqual({ ok: true, args: { text: "a", times: 2 } });
  });

  it("executeTool returns an error for unknown tools", async () => {
    const res = await executeTool([echo], "u1", "nope", {});
    expect(res).toEqual({ ok: false, error: "Unknown tool: nope" });
  });

  it("executeTool returns a readable error for invalid args", async () => {
    const res = await executeTool([echo], "u1", "echo", {});
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.error).toContain("text");
  });

  it("executeTool passes userId and parsed args to run", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, data: "x" });
    const tool = defineTool({
      name: "t",
      description: "d",
      schema: z.object({ a: z.string() }),
      run,
    });
    await executeTool([tool], "user-9", "t", { a: "1" });
    expect(run).toHaveBeenCalledWith("user-9", { a: "1" });
  });

  it("executeTool converts thrown errors into ok:false", async () => {
    const tool = defineTool({
      name: "boom",
      description: "d",
      schema: z.object({}),
      run: async () => {
        throw new Error("kaboom");
      },
    });
    expect(await executeTool([tool], "u", "boom", {})).toEqual({ ok: false, error: "kaboom" });
  });
});
