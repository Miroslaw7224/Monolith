import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import {
  ClosingInputSchema,
  PinnedInputSchema,
  toClosingDto,
  toCockpitDto,
  toPinnedDto,
} from "./schemas";
import * as services from "./services";

export async function getCockpit(): Promise<NextResponse> {
  try {
    return NextResponse.json(toCockpitDto(await services.getCockpit()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putPinned(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, PinnedInputSchema, { details: false });
  if (parsed.success === false) return parsed.response;
  try {
    return NextResponse.json(toPinnedDto(await services.setPinned(parsed.data.ids)));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putClosing(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, ClosingInputSchema, { details: false });
  if (parsed.success === false) return parsed.response;
  try {
    const closing = await services.closeDay({
      text: parsed.data.text,
      projectId: parsed.data.projectId ?? null,
    });
    return NextResponse.json(toClosingDto(closing));
  } catch (err) {
    return handleServiceError(err);
  }
}
