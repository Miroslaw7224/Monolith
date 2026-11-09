import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleServiceError } from "@/lib/apiError";
import { getAuthUserId } from "@/lib/getAuth";
import { getOllamaConfig } from "@/lib/ollama";
import { parseBody } from "@/lib/parseBody";
import * as agentService from "@/services/agentService";

const ConfirmBodySchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  if (!getOllamaConfig()) {
    return NextResponse.json({ error: "Agent is disabled" }, { status: 404 });
  }
  const parsed = await parseBody(request, ConfirmBodySchema);
  if (parsed.success === false) return parsed.response;
  try {
    const result = await agentService.confirmAgentAction(auth.uid, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
