import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { getOllamaConfig } from "@/lib/ollama";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  const cfg = getOllamaConfig();
  return NextResponse.json(cfg ? { enabled: true, model: cfg.model } : { enabled: false });
}
