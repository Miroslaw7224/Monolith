import { DocumentReference, GeoPoint, Timestamp } from "firebase-admin/firestore";

const TYPE_KEY = "__type";

export class UnsupportedValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedValueError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function encodeEntries(obj: Record<string, unknown>, at: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === TYPE_KEY) {
      throw new UnsupportedValueError(`${at}: pole "${TYPE_KEY}" jest zarezerwowane przez eksport`);
    }
    out[key] = encodeValue(val, `${at}.${key}`);
  }
  return out;
}

/**
 * Koduje wartość odczytaną z Firestore do postaci JSON bez utraty informacji o typie.
 * Wartości, których nie umiemy zapisać wiernie, powodują błąd zamiast cichej straty.
 */
export function encodeValue(value: unknown, at = "$"): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;

  if (typeof value === "number") {
    if (Number.isNaN(value)) return { [TYPE_KEY]: "number", value: "NaN" };
    if (value === Infinity) return { [TYPE_KEY]: "number", value: "Infinity" };
    if (value === -Infinity) return { [TYPE_KEY]: "number", value: "-Infinity" };
    // Liczby całkowite poza zakresem bezpiecznym JS mogły być int64 w Firestore: nie zgadujemy.
    if (
      Number.isInteger(value) &&
      Math.abs(value) > Number.MAX_SAFE_INTEGER &&
      Math.abs(value) < 2 ** 63
    ) {
      throw new UnsupportedValueError(`${at}: liczba całkowita poza zakresem bezpiecznym JS`);
    }
    return value;
  }

  if (value instanceof Timestamp) {
    return {
      [TYPE_KEY]: "timestamp",
      iso: value.toDate().toISOString(),
      seconds: value.seconds,
      nanos: value.nanoseconds,
    };
  }
  if (value instanceof GeoPoint) {
    return { [TYPE_KEY]: "geopoint", latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof DocumentReference) {
    return { [TYPE_KEY]: "reference", path: value.path };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { [TYPE_KEY]: "bytes", base64: Buffer.from(value).toString("base64") };
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => encodeValue(item, `${at}[${index}]`));
  }
  if (isPlainObject(value)) {
    return encodeEntries(value, at);
  }

  const kind =
    value === undefined ? "undefined" : ((value as object).constructor?.name ?? typeof value);
  throw new UnsupportedValueError(`${at}: nieobsługiwany typ wartości (${kind})`);
}

function decodeEntries(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) out[key] = decodeValue(val);
  return out;
}

/**
 * Odwraca encodeValue. Używane w testach i przy konwersji (krok 0b).
 * Znacznik "reference" zostaje jako obiekt ze ścieżką (żywa referencja wymaga instancji Firestore).
 */
export function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value === null || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  switch (obj[TYPE_KEY]) {
    case "timestamp":
      return new Timestamp(obj.seconds as number, obj.nanos as number);
    case "geopoint":
      return new GeoPoint(obj.latitude as number, obj.longitude as number);
    case "bytes":
      return Buffer.from(obj.base64 as string, "base64");
    case "number":
      return Number(obj.value);
    case "reference":
      return obj;
    default:
      return decodeEntries(obj);
  }
}
