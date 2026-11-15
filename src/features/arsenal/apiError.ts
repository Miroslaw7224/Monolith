import i18n from "@/src/i18n";

export const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : i18n.t("arsenal:arsenalErrorGeneric");

export async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string"
    ? body.error
    : i18n.t("arsenal:arsenalErrorStatus", { status: res.status });
}
