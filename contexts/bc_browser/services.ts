import { DomainError } from "@/lib/errors";
import * as repo from "./repositories";

/** Tylko `http(s)`: żadnych `file:`, `javascript:` ani opcji wiersza poleceń. Zwraca znormalizowany adres. */
export function normalizeHttpUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new DomainError("Nieprawidłowy adres URL.", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new DomainError("Dozwolone są tylko adresy http(s).", 400);
  }
  return parsed.href;
}

export async function openInChrome(rawUrl: string): Promise<void> {
  const url = normalizeHttpUrl(rawUrl);
  const result = await repo.openUrlInChrome(url);
  if (result.ok === true) return;
  throw new DomainError(
    result.reason === "missing"
      ? "Nie znaleziono Chrome w Windows."
      : "Nie udało się uruchomić Chrome.",
    502
  );
}
