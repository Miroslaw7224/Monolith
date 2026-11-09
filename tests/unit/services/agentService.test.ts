import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

const mockAddLog = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firestore-db", () => ({ addAgentLogEntry: mockAddLog }));

import { defineTool } from "@/lib/agent/tools";
import { agentChat, confirmAgentAction } from "@/services/agentService";
import type { OllamaMessage } from "@/lib/ollama";

function makeTools() {
  const created = vi.fn().mockResolvedValue({ ok: true, data: { id: "1" }, changed: "tasks", summary: "Dodano zadanie" });
  const removed = vi.fn().mockResolvedValue({ ok: true, data: {}, changed: "tasks", summary: "Usunięto" });
  const tools = [
    defineTool({ name: "list_tasks", description: "d", schema: z.object({}), readOnly: true, run: async () => ({ ok: true, data: [] }) }),
    defineTool({ name: "create_task", description: "d", schema: z.object({ title: z.string() }), run: created }),
    defineTool({
      name: "delete_task",
      description: "d",
      schema: z.object({ id: z.string() }),
      destructive: true,
      describe: async (_u, a) => `Usunąć zadanie ${a.id}?`,
      run: removed,
    }),
  ];
  return { tools, created, removed };
}

const call = (name: string, args: Record<string, unknown>): OllamaMessage => ({
  role: "assistant",
  content: "",
  tool_calls: [{ function: { name, arguments: args } }],
});
const say = (content: string): OllamaMessage => ({ role: "assistant", content });

describe("agentChat", () => {
  it("returns the model text when no tools are called", async () => {
    const { tools } = makeTools();
    const chat = vi.fn().mockResolvedValue(say("Cześć!"));
    const res = await agentChat("u1", { message: "hej", lang: "pl" }, { chat, tools });
    expect(res.text).toBe("Cześć!");
    expect(res.actions).toEqual([]);
    expect(res.pending).toEqual([]);
  });

  it("executes a tool call, feeds the result back and returns the final answer", async () => {
    const { tools, created } = makeTools();
    const chat = vi
      .fn()
      .mockResolvedValueOnce(call("create_task", { title: "Raport" }))
      .mockResolvedValueOnce(say("Dodane."));
    const res = await agentChat("u1", { message: "dodaj zadanie Raport", lang: "pl" }, { chat, tools });

    expect(created).toHaveBeenCalledWith("u1", { title: "Raport" });
    expect(res.text).toBe("Dodane.");
    expect(res.changed).toEqual(["tasks"]);
    expect(res.actions).toEqual([
      { tool: "create_task", args: { title: "Raport" }, ok: true, summary: "Dodano zadanie" },
    ]);
    const secondCallMessages = chat.mock.calls[1][0].messages as OllamaMessage[];
    const toolMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(toolMsg.role).toBe("tool");
    expect(toolMsg.tool_name).toBe("create_task");
    expect(mockAddLog).toHaveBeenCalledWith("u1", expect.objectContaining({ tool: "create_task", ok: true, source: "chat" }));
  });

  it("never runs a destructive tool; returns a pending action instead", async () => {
    const { tools, removed } = makeTools();
    const chat = vi.fn().mockResolvedValueOnce(call("delete_task", { id: "t1" }));
    const res = await agentChat("u1", { message: "usuń zadanie", lang: "pl" }, { chat, tools });

    expect(removed).not.toHaveBeenCalled();
    expect(res.pending).toHaveLength(1);
    expect(res.pending[0]).toMatchObject({
      tool: "delete_task",
      args: { id: "t1" },
      summary: "Usunąć zadanie t1?",
    });
    expect(res.pending[0].id).toBeTruthy();
    expect(chat).toHaveBeenCalledTimes(1);
    expect(res.text).toContain("potwierdzenia");
  });

  it("reports an invalid destructive call back to the model instead of creating a pending action", async () => {
    const { tools } = makeTools();
    const chat = vi
      .fn()
      .mockResolvedValueOnce(call("delete_task", {}))
      .mockResolvedValueOnce(say("Brakuje id."));
    const res = await agentChat("u1", { message: "usuń", lang: "pl" }, { chat, tools });
    expect(res.pending).toEqual([]);
    expect(res.text).toBe("Brakuje id.");
  });

  it("stops after the maximum number of steps", async () => {
    const { tools } = makeTools();
    const chat = vi.fn().mockResolvedValue(call("list_tasks", {}));
    const res = await agentChat("u1", { message: "x", lang: "en" }, { chat, tools });
    expect(chat).toHaveBeenCalledTimes(6);
    expect(res.text.length).toBeGreaterThan(0);
  });

  it("stops executing mutations after the per-request cap", async () => {
    const { tools, created } = makeTools();
    const chat = vi.fn().mockResolvedValue(call("create_task", { title: "x" }));
    await agentChat("u1", { message: "x", lang: "en" }, { chat, tools });
    expect(created).toHaveBeenCalledTimes(6);
    created.mockClear();
    const many: OllamaMessage = {
      role: "assistant",
      content: "",
      tool_calls: Array.from({ length: 15 }, () => ({ function: { name: "create_task", arguments: { title: "x" } } })),
    };
    const chat2 = vi.fn().mockResolvedValueOnce(many).mockResolvedValueOnce(say("ok"));
    await agentChat("u1", { message: "x", lang: "en" }, { chat: chat2, tools });
    expect(created).toHaveBeenCalledTimes(10);
  });

  it("includes today's date and the existing history in the model input", async () => {
    const { tools } = makeTools();
    const chat = vi.fn().mockResolvedValue(say("ok"));
    await agentChat(
      "u1",
      { message: "co dziś?", lang: "pl", history: [{ role: "user", content: "wcześniej" }] },
      { chat, tools, now: new Date(2026, 10, 9) }
    );
    const msgs = chat.mock.calls[0][0].messages as OllamaMessage[];
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("2026-11-09");
    expect(msgs[1]).toEqual({ role: "user", content: "wcześniej" });
    expect(msgs[msgs.length - 1]).toEqual({ role: "user", content: "co dziś?" });
  });
});

describe("confirmAgentAction", () => {
  it("runs a destructive tool and logs it", async () => {
    const { tools, removed } = makeTools();
    const res = await confirmAgentAction("u1", { tool: "delete_task", args: { id: "t1" } }, { tools });
    expect(removed).toHaveBeenCalledWith("u1", { id: "t1" });
    expect(res).toEqual({ ok: true, message: "Usunięto", changed: ["tasks"] });
    expect(mockAddLog).toHaveBeenCalledWith("u1", expect.objectContaining({ tool: "delete_task", source: "confirm" }));
  });

  it("refuses non-destructive or unknown tools", async () => {
    const { tools, created } = makeTools();
    await expect(confirmAgentAction("u1", { tool: "create_task", args: { title: "x" } }, { tools })).rejects.toMatchObject({ statusCode: 400 });
    await expect(confirmAgentAction("u1", { tool: "nope", args: {} }, { tools })).rejects.toMatchObject({ statusCode: 400 });
    expect(created).not.toHaveBeenCalled();
  });
});
