/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ActiveSession {
  title: string;
  startedAt: string;
  tags: string[];
  color: string;
}

const STORAGE_KEY_PREFIX = "monolith_active_session_";
const OLD_STORAGE_KEY_PREFIX = "second_brain_active_session_";

export function getActiveSession(userId: string): ActiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(STORAGE_KEY_PREFIX + userId);
    if (!raw) {
      // migracja ze starego klucza (Second Brain) przy pierwszym odczycie
      raw = localStorage.getItem(OLD_STORAGE_KEY_PREFIX + userId);
      if (raw) {
        localStorage.setItem(STORAGE_KEY_PREFIX + userId, raw);
        localStorage.removeItem(OLD_STORAGE_KEY_PREFIX + userId);
      }
    }
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (
      data &&
      typeof data === "object" &&
      "title" in data &&
      "startedAt" in data &&
      "tags" in data &&
      "color" in data &&
      Array.isArray((data as ActiveSession).tags)
    ) {
      return data as ActiveSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function setActiveSession(userId: string, session: ActiveSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearActiveSession(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + userId);
    localStorage.removeItem(OLD_STORAGE_KEY_PREFIX + userId);
  } catch {
    // ignore
  }
}
