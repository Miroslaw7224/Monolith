// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { toCalendarEventDto } from "@/contexts/bc_calendar/schemas";
import {
  createCalendarEvent as createInRepo,
  getCalendarEvents as getFromRepo,
  updateCalendarEvent as updateInRepo,
} from "@/contexts/bc_calendar/repositories";
import { useTempVault } from "../../helpers/tempVault";

const vault = useTempVault();
const BASE = {
  date: "2026-11-18",
  start_minutes: 1200,
  duration_minutes: 60,
  title: "Career Guide",
  tags: [],
  color: "#00802b",
  type: "meeting" as const,
};
const BRIEF = "Wybrać focus na tydzień 47\nDecyzja o fiszkach A1–C2";

describe("brief wydarzenia (repozytorium)", () => {
  it("zapisuje i odczytuje wieloliniowy brief; bez briefu pole nie występuje w pliku", async () => {
    const withBrief = await createInRepo({ ...BASE, brief: BRIEF });
    const without = await createInRepo({ ...BASE, date: "2026-11-25" });
    expect(withBrief.brief).toBe(BRIEF);
    expect(without.brief).toBeUndefined();
    const all = await getFromRepo();
    expect(all.find((e) => e.id === withBrief.id)?.brief).toBe(BRIEF);
    expect(all.find((e) => e.id === without.id)?.brief).toBeUndefined();
    expect(vault.read("Calendar/2026-11.yaml").match(/brief:/g)).toHaveLength(1);
  });

  it("update ustawia brief, a pusty tekst go usuwa", async () => {
    const e = await createInRepo(BASE);
    await updateInRepo(e.id, { brief: BRIEF });
    expect((await getFromRepo())[0].brief).toBe(BRIEF);
    await updateInRepo(e.id, { brief: "" });
    expect((await getFromRepo())[0].brief).toBeUndefined();
    expect(vault.read("Calendar/2026-11.yaml")).not.toContain("brief:");
  });
});

describe("brief wydarzenia (DTO)", () => {
  it("DTO przenosi brief", () => {
    expect(toCalendarEventDto({ id: "1", ...BASE, brief: BRIEF }).brief).toBe(BRIEF);
  });
});

const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_tasks/services", () => ({ getTasks: async () => [] }));

async function loadServices() {
  vi.resetModules();
  vi.doMock("@/contexts/bc_calendar/repositories", () => ({
    createCalendarEvent: mockCreate,
    updateCalendarEvent: mockUpdate,
  }));
  return import("@/contexts/bc_calendar/services");
}

describe("brief wydarzenia (serwis)", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpdate.mockReset();
  });

  it("odrzuca brief dłuższy niż 1000 znaków", async () => {
    const services = await loadServices();
    const tooLong = "x".repeat(1001);
    await expect(services.createCalendarEvent({ ...BASE, brief: tooLong })).rejects.toThrow(
      "brief too long"
    );
    await expect(services.updateCalendarEvent("e1", { brief: tooLong })).rejects.toThrow(
      "brief too long"
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("przycina brief, pusty przechodzi jako usunięcie, brak pola zostaje nieruszony", async () => {
    const services = await loadServices();
    await services.createCalendarEvent({ ...BASE, brief: `  ${BRIEF}\n ` });
    expect(mockCreate.mock.calls[0][0].brief).toBe(BRIEF);
    await services.updateCalendarEvent("e1", { brief: "   " });
    expect(mockUpdate.mock.calls[0][1].brief).toBe("");
    await services.updateCalendarEvent("e1", { title: "x" });
    expect(mockUpdate.mock.calls[1][1].brief).toBeUndefined();
  });
});

describe("brief wydarzenia (router)", () => {
  it("POST przekazuje brief do serwisu, zły typ jest ignorowany", async () => {
    vi.resetModules();
    const create = vi.fn().mockResolvedValue({ id: "1", ...BASE });
    vi.doMock("@/contexts/bc_calendar/services", () => ({ createCalendarEvent: create }));
    const { POST } = await import("@/app/api/calendar/events/route");
    const req = (body: unknown) =>
      new NextRequest("http://localhost/api/calendar/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    await POST(req({ ...BASE, brief: BRIEF }));
    expect(create.mock.calls[0][0].brief).toBe(BRIEF);
    await POST(req({ ...BASE, brief: 5 }));
    expect(create.mock.calls[1][0].brief).toBeUndefined();
  });
});
