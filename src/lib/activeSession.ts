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

const STORAGE_KEY = "monolith_active_session";

export function getActiveSession(): ActiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

export function setActiveSession(session: ActiveSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearActiveSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
