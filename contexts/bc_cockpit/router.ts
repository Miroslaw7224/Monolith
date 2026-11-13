import { NextRequest, NextResponse } from "next/server";
import { DomainError } from "@/lib/errors";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import {
  ClosingInputSchema,
  PinnedInputSchema,
  toClosingDto,
  toCockpitDto,
  toCommitHistoryDto,
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

const DEFAULT_HISTORY_DAYS = 7;

/** Zgodne z `MAX_HISTORY_DAYS` w services (router nie importuje wartości z services; serwis sprawdza je drugi raz). */
const MAX_HISTORY_DAYS = 90;

/** `?days=` (liczba całkowita 1–90, domyślnie 14); inna wartość to 400. */
export async function getCommits(request: NextRequest): Promise<NextResponse> {
  const raw = request.nextUrl.searchParams.get("days");
  const days = raw === null ? DEFAULT_HISTORY_DAYS : Number(raw);
  try {
    if (!Number.isInteger(days) || days < 1 || days > MAX_HISTORY_DAYS) {
      throw new DomainError(`days musi być liczbą całkowitą 1–${MAX_HISTORY_DAYS}`);
    }
    return NextResponse.json(toCommitHistoryDto(await services.getCommitHistory(days)));
  } catch (err) {
    return handleServiceError(err);
  }
}
