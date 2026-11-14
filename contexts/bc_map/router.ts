import { NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { toAgentsDto, toGraphDto } from "./schemas";
import * as services from "./services";

export async function getMapGraph(): Promise<NextResponse> {
  try {
    return NextResponse.json(toGraphDto(services.getGraph()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function getMapAgents(): Promise<NextResponse> {
  try {
    return NextResponse.json(toAgentsDto(services.getAgents()));
  } catch (err) {
    return handleServiceError(err);
  }
}
