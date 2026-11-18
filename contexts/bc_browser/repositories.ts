import { openInChrome } from "@/lib/browser/chrome";
import type { OpenOutcome } from "./models";

export async function openUrlInChrome(url: string): Promise<OpenOutcome> {
  return openInChrome(url);
}
