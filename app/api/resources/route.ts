import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { CreateResourceBodySchema } from "@/lib/validation/resources";
import * as resourceService from "@/services/resourceService";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const resources = await resourceService.getResources(auth.uid);
    return NextResponse.json(resources);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(request, CreateResourceBodySchema);
  if (parsed.success === false) {
    return parsed.response;
  }
  const { description, url, tags } = parsed.data;
  try {
    const resource = await resourceService.addResource(auth.uid, {
      description: description.trim(),
      url: url.trim(),
      tags: tags ?? [],
    });
    return NextResponse.json(resource, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
