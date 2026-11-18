import { NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { OpenLinkSchema } from "./schemas";
import * as services from "./services";

export async function postOpen(request: Request): Promise<NextResponse> {
  try {
    const body = await parseBody(request, OpenLinkSchema);
    if (body.success === false) return body.response;
    await services.openInChrome(body.data.url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
