import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import * as documentService from "@/services/documentService";

export async function GET(request: NextRequest) {
  try {
    const docs = await documentService.listDocuments();
    return NextResponse.json(
      docs.map((d) => ({
        id: d.id,
        name: d.name,
        content: d.content,
        type: d.type,
        created_at: d.created_at,
      }))
    );
  } catch (err) {
    return handleServiceError(err);
  }
}
