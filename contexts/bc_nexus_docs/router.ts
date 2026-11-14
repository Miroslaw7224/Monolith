import { NextResponse } from "next/server";
import { DomainError } from "@/lib/errors";
import { handleServiceError } from "@/lib/http/apiError";
import { NexusDocPathParamsSchema, toDocDto, toSummaryDto } from "./schemas";
import * as services from "./services";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function listNexusDocs(): Promise<NextResponse> {
  try {
    return NextResponse.json(services.listDocs().map(toSummaryDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function getNexusDoc(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  try {
    const parsed = NexusDocPathParamsSchema.safeParse(await ctx.params);
    if (!parsed.success) throw new DomainError("Nieprawidłowa ścieżka dokumentu", 400);
    return NextResponse.json(toDocDto(services.getDoc(parsed.data.path)));
  } catch (err) {
    return handleServiceError(err);
  }
}
