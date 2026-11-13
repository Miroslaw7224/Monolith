import { beforeEach, describe, expect, it } from "vitest";
import {
  clearActiveSession,
  getActiveSession,
  setActiveSession,
} from "@/src/components/sessions/activeSession";

const SESSION = {
  title: "Praca",
  startedAt: "2026-11-12T10:00:00.000Z",
  tags: ["a"],
  color: "#fff",
};

describe("activeSession", () => {
  beforeEach(() => localStorage.clear());

  it("zapisuje pod kluczem monolith_active_session", () => {
    setActiveSession(SESSION);
    expect(localStorage.getItem("monolith_active_session")).not.toBeNull();
    expect(getActiveSession()).toEqual(SESSION);
  });

  it("zwraca null, gdy nic nie zapisano lub dane są uszkodzone", () => {
    expect(getActiveSession()).toBeNull();
    localStorage.setItem("monolith_active_session", "{nie json");
    expect(getActiveSession()).toBeNull();
    localStorage.setItem("monolith_active_session", JSON.stringify({ title: "x" }));
    expect(getActiveSession()).toBeNull();
  });

  it("clearActiveSession usuwa zapis", () => {
    setActiveSession(SESSION);
    clearActiveSession();
    expect(getActiveSession()).toBeNull();
    expect(localStorage.getItem("monolith_active_session")).toBeNull();
  });
});
