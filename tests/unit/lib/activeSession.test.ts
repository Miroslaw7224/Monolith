import { beforeEach, describe, expect, it } from "vitest";
import { clearActiveSession, getActiveSession, setActiveSession } from "@/src/lib/activeSession";

const SESSION = {
  title: "Praca",
  startedAt: "2026-11-12T10:00:00.000Z",
  tags: ["a"],
  color: "#fff",
};

describe("activeSession", () => {
  beforeEach(() => localStorage.clear());

  it("zapisuje pod kluczem monolith_active_session_", () => {
    setActiveSession("u1", SESSION);
    expect(localStorage.getItem("monolith_active_session_u1")).not.toBeNull();
    expect(getActiveSession("u1")).toEqual(SESSION);
  });

  it("migruje sesję ze starego klucza second_brain_active_session_", () => {
    localStorage.setItem("second_brain_active_session_u1", JSON.stringify(SESSION));
    expect(getActiveSession("u1")).toEqual(SESSION);
    expect(localStorage.getItem("second_brain_active_session_u1")).toBeNull();
    expect(localStorage.getItem("monolith_active_session_u1")).not.toBeNull();
  });

  it("clearActiveSession usuwa nowy i stary klucz", () => {
    localStorage.setItem("second_brain_active_session_u1", JSON.stringify(SESSION));
    setActiveSession("u1", SESSION);
    clearActiveSession("u1");
    expect(getActiveSession("u1")).toBeNull();
    expect(localStorage.getItem("second_brain_active_session_u1")).toBeNull();
  });
});
