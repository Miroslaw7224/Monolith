import i18n from "@/src/i18n";

export const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : i18n.t("arsenal:arsenalErrorGeneric");

/** Pierwszy komunikat pola z `details` odpowiedzi 400 (`parseBody`: mapa pole → lista komunikatów). */
function firstDetail(details: unknown): string | undefined {
  if (details === null || typeof details !== "object") return undefined;
  for (const messages of Object.values(details)) {
    if (Array.isArray(messages) && typeof messages[0] === "string") return messages[0];
  }
  return undefined;
}

export async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: unknown;
    details?: unknown;
  } | null;
  if (typeof body?.error !== "string") {
    return i18n.t("arsenal:arsenalErrorStatus", { status: res.status });
  }
  const detail = firstDetail(body.details);
  return detail === undefined ? body.error : `${body.error}: ${detail}`;
}
