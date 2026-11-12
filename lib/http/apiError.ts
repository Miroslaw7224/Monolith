import { NextResponse } from "next/server";
import { DomainError } from "@/lib/errors";
import { inferHttpStatus } from "@/lib/http/inferHttpStatus";

export function handleServiceError(err: unknown): NextResponse {
  if (err instanceof DomainError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  const status = inferHttpStatus(err);
  if (status === 429) {
    const msg = err instanceof Error ? err.message : "API rate limit exceeded.";
    const retryMatch = typeof msg === "string" ? msg.match(/retry in (\d+(?:\.\d+)?)s/i) : null;
    const retrySec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
    return NextResponse.json(
      {
        error: "Przekroczono limit zapytań do AI. Spróbuj ponownie za chwilę.",
        retryAfterSeconds: retrySec,
      },
      { status: 429 }
    );
  }
  if (status === 503) {
    return NextResponse.json(
      {
        error:
          "Usługa AI jest chwilowo przeciążona. Spróbuj ponownie za chwilę (często pomaga druga próba).",
      },
      { status: 503 }
    );
  }
  console.error(err);
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "Internal server error" },
    { status: 500 }
  );
}
