/** Wynik próby otwarcia adresu w zewnętrznej przeglądarce. */
export type OpenOutcome = { ok: true } | { ok: false; reason: "missing" | "error" };
