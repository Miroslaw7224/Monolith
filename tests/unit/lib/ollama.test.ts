import { describe, it, expect, vi, afterEach } from "vitest";
import { getOllamaConfig, ollamaChat } from "@/lib/ollama";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getOllamaConfig", () => {
  it("returns null when OLLAMA_BASE_URL is not set", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "");
    expect(getOllamaConfig()).toBeNull();
  });

  it("returns config with defaults and strips trailing slash", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434/");
    vi.stubEnv("OLLAMA_MODEL", "");
    vi.stubEnv("OLLAMA_NUM_CTX", "");
    expect(getOllamaConfig()).toEqual({
      baseUrl: "http://localhost:11434",
      model: "qwen2.5:7b-instruct",
      numCtx: 8192,
    });
  });

  it("reads model and context from env", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://x:1");
    vi.stubEnv("OLLAMA_MODEL", "llama3.1:8b");
    vi.stubEnv("OLLAMA_NUM_CTX", "16384");
    expect(getOllamaConfig()).toEqual({ baseUrl: "http://x:1", model: "llama3.1:8b", numCtx: 16384 });
  });
});

describe("ollamaChat", () => {
  it("throws 503 when not configured", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "");
    await expect(ollamaChat({ messages: [] })).rejects.toMatchObject({ statusCode: 503 });
  });

  it("posts to /api/chat and returns the assistant message", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{ function: { name: "list_tasks", arguments: {} } }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const msg = await ollamaChat({ messages: [{ role: "user", content: "hi" }] });

    expect(msg.tool_calls?.[0].function.name).toBe("list_tasks");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(init.body as string);
    expect(body.stream).toBe(false);
    expect(body.model).toBe("qwen2.5:7b-instruct");
    expect(body.options.num_ctx).toBe(8192);
  });

  it("maps a network failure to a 503 DomainError", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(ollamaChat({ messages: [] })).rejects.toMatchObject({ statusCode: 503 });
  });

  it("maps a non-OK response to a 502 DomainError", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "model not found" })
    );
    await expect(ollamaChat({ messages: [] })).rejects.toMatchObject({ statusCode: 502 });
  });
});
