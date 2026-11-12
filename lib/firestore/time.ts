/** Timestamp Firestore / Date / tekst / liczba (ms) → ISO 8601 (UTC) albo `undefined`. */
export function toIso(value: unknown): string | undefined {
  let date: Date | undefined;
  if (value instanceof Date) date = value;
  else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  else if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    date = (value as { toDate: () => Date }).toDate();
  }
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
