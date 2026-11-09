import { randomUUID } from "node:crypto";
import { DomainError } from "@/lib/errors";
import { executeTool, toOllamaTools, validateToolArgs } from "@/lib/agent/tools";
import type { AnyAgentTool, ChangedArea } from "@/lib/agent/types";
import { formatYmd, weekRangeMonSun } from "@/lib/dateRef";
import * as firestoreDb from "@/lib/firestore-db";
import { ollamaChat, type OllamaMessage } from "@/lib/ollama";
import { agentTools } from "@/services/agent";

const MAX_STEPS = 6;
const MAX_MUTATIONS_PER_REQUEST = 10;
const HISTORY_LIMIT = 12;

export type AgentAction = {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  summary: string;
};

export type PendingAction = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
};

export type AgentChatResult = {
  text: string;
  actions: AgentAction[];
  pending: PendingAction[];
  changed: ChangedArea[];
};

type AgentDeps = {
  chat: typeof ollamaChat;
  tools: AnyAgentTool[];
  now?: Date;
};

const defaultDeps: AgentDeps = { chat: ollamaChat, tools: agentTools };

function systemPrompt(lang: string, now: Date): string {
  const today = formatYmd(now);
  const week = weekRangeMonSun(now);
  const weekday = now.toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US", { weekday: "long" });
  const rules =
    lang === "pl"
      ? `Jesteś asystentem aplikacji Second Brain. Zarządzasz zadaniami, kalendarzem i mapami myśli użytkownika WYŁĄCZNIE przez dostępne narzędzia.
Dzisiaj jest ${weekday}, ${today}. Bieżący tydzień (pon–niedz): ${week.start} … ${week.end}. Przeliczaj daty względne ("jutro", "w piątek") na YYYY-MM-DD.
Zasady:
- Gdy potrzebujesz id (zadania, wpisu, mapy, węzła), najpierw wywołaj narzędzie list_* / get_*; nigdy nie zgaduj id.
- Tagi wpisów kalendarza muszą istnieć (list_tags). Gdy tagu brak, powiedz o tym użytkownikowi.
- Usuwanie wywołuj normalnie narzędziem delete_*; system sam poprosi użytkownika o potwierdzenie. Nie pytaj o potwierdzenie w tekście i nie ponawiaj wywołania.
- Odpowiadaj krótko po polsku i podsumuj, co zostało zrobione.`
      : `You are the assistant of the Second Brain app. You manage the user's tasks, calendar and mind maps ONLY through the available tools.
Today is ${weekday}, ${today}. Current week (Mon–Sun): ${week.start} … ${week.end}. Convert relative dates ("tomorrow", "on Friday") to YYYY-MM-DD.
Rules:
- When you need an id (task, event, map, node), call a list_* / get_* tool first; never guess ids.
- Calendar tags must already exist (list_tags). If a tag is missing, tell the user.
- Call delete_* tools normally; the system asks the user for confirmation itself. Do not ask for confirmation in text and do not retry the call.
- Reply briefly and summarise what was done.`;
  return rules;
}

async function logAction(
  userId: string,
  entry: firestoreDb.AgentLogEntry
): Promise<void> {
  try {
    await firestoreDb.addAgentLogEntry(userId, entry);
  } catch (err) {
    console.error("[agent] failed to write audit log", err);
  }
}

export async function agentChat(
  userId: string,
  params: {
    message: string;
    lang?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  },
  deps: Partial<AgentDeps> = {}
): Promise<AgentChatResult> {
  const { chat, tools, now } = { ...defaultDeps, ...deps };
  const lang = params.lang ?? "en";
  const messages: OllamaMessage[] = [
    { role: "system", content: systemPrompt(lang, now ?? new Date()) },
    ...(params.history ?? []).slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: params.message },
  ];
  const toolDefs = toOllamaTools(tools);

  const actions: AgentAction[] = [];
  const pending: PendingAction[] = [];
  const changed = new Set<ChangedArea>();
  let mutations = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    const reply = await chat({ messages: messages.slice(), tools: toolDefs });
    messages.push(reply);
    const calls = reply.tool_calls ?? [];
    if (calls.length === 0) {
      return { text: reply.content.trim(), actions, pending, changed: [...changed] };
    }

    for (const call of calls) {
      const { name, arguments: rawArgs } = call.function;
      const tool = tools.find((t) => t.name === name);
      let toolContent: string;

      if (tool?.destructive) {
        const validated = validateToolArgs(tool, rawArgs);
        if (validated.ok === false) {
          toolContent = JSON.stringify({ error: validated.error });
        } else {
          try {
            const summary = await tool.describe!(userId, validated.args);
            pending.push({
              id: randomUUID(),
              tool: name,
              args: validated.args as Record<string, unknown>,
              summary,
            });
            toolContent = JSON.stringify({
              status: "awaiting_user_confirmation",
              note: "The user will be asked to confirm. Do not retry.",
            });
          } catch (err) {
            toolContent = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
          }
        }
      } else if (tool && !tool.readOnly && mutations >= MAX_MUTATIONS_PER_REQUEST) {
        toolContent = JSON.stringify({ error: "Too many changes in one request. Stop and report." });
      } else {
        if (tool && !tool.readOnly) mutations++;
        const result = await executeTool(tools, userId, name, rawArgs);
        if (tool && !tool.readOnly) {
          const summary = result.ok ? (result.summary ?? name) : result.ok === false ? result.error : name;
          actions.push({ tool: name, args: rawArgs, ok: result.ok, summary });
          if (result.ok && result.changed) changed.add(result.changed);
          await logAction(userId, { tool: name, args: rawArgs, ok: result.ok, summary, source: "chat" });
        }
        toolContent = JSON.stringify(
          result.ok ? result.data : { error: result.ok === false ? result.error : "Unknown error" }
        );
      }

      messages.push({ role: "tool", tool_name: name, content: toolContent });
    }

    if (pending.length > 0) {
      const text =
        lang === "pl"
          ? "Wymagane potwierdzenia usunięcia — zatwierdź lub anuluj poniżej."
          : "Deletion needs your confirmation — confirm or cancel below.";
      return { text, actions, pending, changed: [...changed] };
    }
  }

  const text =
    lang === "pl"
      ? "Przerwano: zbyt wiele kroków. Spróbuj sformułować prośbę prościej."
      : "Stopped: too many steps. Try rephrasing the request.";
  return { text, actions, pending, changed: [...changed] };
}

export async function confirmAgentAction(
  userId: string,
  params: { tool: string; args: Record<string, unknown> },
  deps: Partial<Pick<AgentDeps, "tools">> = {}
): Promise<{ ok: boolean; message: string; changed: ChangedArea[] }> {
  const tools = deps.tools ?? agentTools;
  const tool = tools.find((t) => t.name === params.tool);
  if (!tool || !tool.destructive) {
    throw new DomainError("Ta akcja nie wymaga potwierdzenia lub nie istnieje.", 400);
  }
  const result = await executeTool(tools, userId, params.tool, params.args);
  const message = result.ok ? (result.summary ?? params.tool) : result.ok === false ? result.error : params.tool;
  await logAction(userId, {
    tool: params.tool,
    args: params.args,
    ok: result.ok,
    summary: message,
    source: "confirm",
  });
  return {
    ok: result.ok,
    message,
    changed: result.ok && result.changed ? [result.changed] : [],
  };
}
