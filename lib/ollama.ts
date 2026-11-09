import { DomainError } from "@/lib/errors";

export type OllamaToolCall = {
  function: { name: string; arguments: Record<string, unknown> };
};

export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
  /** Set on role "tool" messages: name of the tool that produced the result. */
  tool_name?: string;
};

export type OllamaToolDef = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type OllamaConfig = { baseUrl: string; model: string; numCtx: number };

const REQUEST_TIMEOUT_MS = 120_000;

/** Returns null when Ollama is not configured (e.g. on Vercel). */
export function getOllamaConfig(): OllamaConfig | null {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim();
  if (!baseUrl) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model: process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b-instruct",
    numCtx: Number(process.env.OLLAMA_NUM_CTX) || 8192,
  };
}

export async function ollamaChat(params: {
  messages: OllamaMessage[];
  tools?: OllamaToolDef[];
}): Promise<OllamaMessage> {
  const cfg = getOllamaConfig();
  if (!cfg) {
    throw new DomainError("Ollama nie jest skonfigurowana (brak OLLAMA_BASE_URL).", 503);
  }

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages: params.messages,
        tools: params.tools,
        stream: false,
        options: { num_ctx: cfg.numCtx, temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new DomainError(`Nie można połączyć się z Ollamą (${cfg.baseUrl}). Czy działa?`, 503);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new DomainError(`Ollama zwróciła błąd ${res.status}: ${text.slice(0, 200)}`, 502);
  }

  const data = (await res.json()) as { message?: OllamaMessage };
  if (!data.message) throw new DomainError("Ollama zwróciła pustą odpowiedź.", 502);
  return { ...data.message, content: data.message.content ?? "" };
}
