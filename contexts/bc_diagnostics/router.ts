import { NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { toPortsDto } from "./schemas";
import * as services from "./services";

export async function getPorts(): Promise<NextResponse> {
  try {
    return NextResponse.json(toPortsDto(await services.listPorts()));
  } catch (err) {
    return handleServiceError(err);
  }
}
