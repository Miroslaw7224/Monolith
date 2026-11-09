import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockAgentChat = vi.hoisted(() => vi.fn());
const mockConfirm = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/agentService", () => ({
  agentChat: mockAgentChat,
  confirmAgentAction: mockConfirm,
}));

import { GET as statusGET } from "@/app/api/agent/status/route";
import { POST as chatPOST } from "@/app/api/agent/chat/route";
import { POST as confirmPOST } from "@/app/api/agent/confirm/route";

function req(body?: unknown, method = "POST") {
  return new NextRequest("http://localhost/api/agent/x", {
    method,
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/agent/status", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUserId.mockResolvedValue(NextResponse.json({ error: "x" }, { status: 401 }));
    expect((await statusGET(req(undefined, "GET"))).status).toBe(401);
  });

  it("reports disabled when OLLAMA_BASE_URL is not set", async () => {
    mockGetAuthUserId.mockResolvedValue({ uid: "u1" });
    vi.stubEnv("OLLAMA_BASE_URL", "");
    const res = await statusGET(req(undefined, "GET"));
    expect(await res.json()).toEqual({ enabled: false });
  });

  it("reports enabled with the model name", async () => {
    mockGetAuthUserId.mockResolvedValue({ uid: "u1" });
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    vi.stubEnv("OLLAMA_MODEL", "qwen3:8b");
    expect(await (await statusGET(req(undefined, "GET"))).json()).toEqual({
      enabled: true,
      model: "qwen3:8b",
    });
  });
});

describe("POST /api/agent/chat", () => {
  it("returns 404 when the agent is disabled", async () => {
    mockGetAuthUserId.mockResolvedValue({ uid: "u1" });
    vi.stubEnv("OLLAMA_BASE_URL", "");
    expect((await chatPOST(req({ message: "hej" }))).status).toBe(404);
  });

  it("validates the body", async () => {
    mockGetAuthUserId.mockResolvedValue({ uid: "u1" });
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    expect((await chatPOST(req({ message: "" }))).status).toBe(400);
  });

  it("calls agentChat with the authenticated uid", async () => {
    mockGetAuthUserId.mockResolvedValue({ uid: "u1" });
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    mockAgentChat.mockResolvedValue({ text: "ok", actions: [], pending: [], changed: [] });
    const res = await chatPOST(
      req({ message: "hej", lang: "pl", history: [{ role: "user", content: "a" }] })
    );
    expect(res.status).toBe(200);
    expect(mockAgentChat).toHaveBeenCalledWith("u1", {
      message: "hej",
      lang: "pl",
      history: [{ role: "user", content: "a" }],
    });
  });
});

describe("POST /api/agent/confirm", () => {
  it("returns 404 when the agent is disabled", async () => {
    mockGetAuthUserId.mockResolvedValue({ uid: "u1" });
    vi.stubEnv("OLLAMA_BASE_URL", "");
    expect((await confirmPOST(req({ tool: "delete_task", args: { id: "1" } }))).status).toBe(404);
  });

  it("calls confirmAgentAction", async () => {
    mockGetAuthUserId.mockResolvedValue({ uid: "u1" });
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    mockConfirm.mockResolvedValue({ ok: true, message: "Usunięto", changed: ["tasks"] });
    const res = await confirmPOST(req({ tool: "delete_task", args: { id: "1" } }));
    expect(res.status).toBe(200);
    expect(mockConfirm).toHaveBeenCalledWith("u1", { tool: "delete_task", args: { id: "1" } });
  });
});
