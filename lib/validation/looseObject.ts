import { z } from "zod";

/**
 * Accept a JSON object, or treat an array or other non-object as an empty body.
 * That matches destructuring those values in the previous route handlers.
 */
export function looseObject<T extends z.ZodRawShape>(shape: T) {
  return z.preprocess((value) => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) return value;
    return {};
  }, z.object(shape));
}
