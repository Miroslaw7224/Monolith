import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleServiceError } from "@/lib/apiError";
import { getAuthUserId } from "@/lib/getAuth";
import { getOllamaConfig } from "@/lib/ollama";
import { parseBody } from "@/lib/parseBody";
import * as agentService from "@/services/agentService";

const ChatBodySchema = z.object({
  message: z.string().min(1).max(4000),
  lang: z.enum(["pl", "en"]).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(40)
    .optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  if (!getOllamaConfig()) {
    return NextResponse.json({ error: "Agent is disabled" }, { status: 404 });
  }
  const parsed = await parseBody(request, ChatBodySchema);
  if (parsed.success === false) return parsed.response;
  try {
    const result = await agentService.agentChat(auth.uid, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
