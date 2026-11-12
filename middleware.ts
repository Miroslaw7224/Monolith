import { NextResponse, type NextRequest } from "next/server";
import { checkRequest } from "@/lib/http/localGuard";

export function middleware(request: NextRequest) {
  const result = checkRequest({
    method: request.method,
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    clientHeader: request.headers.get("x-nexus-client"),
  });
  if (result.ok === true) return NextResponse.next();
  const error =
    result.reason === "host" ? "Niedozwolony host" : "Niedozwolone żądanie spoza aplikacji";
  return NextResponse.json({ error }, { status: result.status });
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
