// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
} from "@/contexts/bc_calendar/repositories";
import { formatYamlList } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import { useTempVault } from "../../helpers/tempVault";

const NOV = "Calendar/2026-11.yaml";
const DEC = "Calendar/2026-12.yaml";

const E1 = {
  id: "e1",
  date: "2026-11-30",
  start_minutes: 1380,
  duration_minutes: 120,
  title: "Nocna sesja",
  tags: ["praca"],
  color: "#111111",
  type: "work",
  created: "2026-11-01T08:00:00.000Z",
  x_note: "ręcznie",
};
const E2 = {
  id: "e2",
  date: "2026-11-02",
  start_minutes: 540,
  duration_minutes: 60,
  title: "Spotkanie",
  tags: ["a"],
  color: "#222222",
  type: "meeting",
  created: "2026-11-01T09:00:00.000Z",
};
const E3 = {
  id: "e3",
  date: "2026-12-01",
  start_minutes: 600,
  duration_minutes: 30,
  title: "Rano",
  tags: [],
  color: "#333333",
  type: "work",
  created: "2026-11-01T10:00:00.000Z",
};

const vault = useTempVault();
const writeEvents = (file: string, events: Record<string, unknown>[]) =>
  vault.write(file, formatYamlList("events", events));
const seed = () => {
  writeEvents(NOV, [E1, E2]);
  writeEvents(DEC, [E3]);
};
const NEW = {
  date: "2026-11-05",
  start_minutes: 600,
  duration_minutes: 60,
  title: "T",
  tags: ["x"],
  color: "#abcdef",
};

async function statusOf(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    return (err as DomainError).statusCode;
  }
  return undefined;
}

describe("getCalendarEvents", () => {
  it("1. returns [] without a Calendar directory", async () => {
    expect(await getCalendarEvents()).toEqual([]);
  });

  it("2. reads all month files sorted by date and start", async () => {
    seed();
    const events = await getCalendarEvents();
    expect(events.map((e) => e.id)).toEqual(["e2", "e1", "e3"]);
    expect(events[1]).toMatchObject({
      tags: ["praca"],
      type: "work",
      created_at: "2026-11-01T08:00:00.000Z",
    });
  });

  it("3. a range includes events crossing midnight into it", async () => {
    seed();
    const events = await getCalendarEvents({ startDate: "2026-12-01", endDate: "2026-12-01" });
    expect(events.map((e) => e.id)).toEqual(["e1", "e3"]);
  });

  it("4. a single bound compares the date only", async () => {
    seed();
    expect((await getCalendarEvents({ startDate: "2026-12-01" })).map((e) => e.id)).toEqual(["e3"]);
    expect((await getCalendarEvents({ endDate: "2026-11-02" })).map((e) => e.id)).toEqual(["e2"]);
  });

  it("5. ignores files that are not month files", async () => {
    seed();
    vault.write("Calendar/notes.yaml", "events: [unclosed");
    vault.write("Calendar/.2026-11.yaml.1.abc.tmp", "events: [unclosed");
    expect((await getCalendarEvents()).map((e) => e.id)).toEqual(["e2", "e1", "e3"]);
  });

  it("12. deduplicates by id: the later updated wins, ties go to the later file", async () => {
    writeEvents(NOV, [{ ...E2, title: "Nov", updated: "2026-11-10T00:00:00.000Z" }]);
    writeEvents(DEC, [{ ...E2, title: "Dec", updated: "2026-11-09T00:00:00.000Z" }]);
    expect((await getCalendarEvents()).map((e) => e.title)).toEqual(["Nov"]);
    writeEvents(NOV, [{ ...E2, title: "Nov" }]);
    writeEvents(DEC, [{ ...E2, title: "Dec" }]);
    expect((await getCalendarEvents()).map((e) => e.title)).toEqual(["Dec"]);
  });

  it("15. a corrupted month file fails the read with its name", async () => {
    vault.write(NOV, "events: [unclosed");
    await expect(getCalendarEvents()).rejects.toThrow(/Calendar\/2026-11\.yaml/);
    expect(vault.read(NOV)).toBe("events: [unclosed");
  });
});

describe("createCalendarEvent", () => {
  it("6a. creates the month file with version: 1 and returns the mapped record", async () => {
    const created = await createCalendarEvent(NEW);
    expect(created).toMatchObject({ ...NEW, type: "work" });
    expect(created.id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(new Date(created.created_at as string).toISOString()).toBe(created.created_at);
    const text = vault.read(NOV) as string;
    expect(text).toContain("version: 1");
    expect(readList(NOV, "events")).toHaveLength(1);
  });

  it("6b. keeps type meeting and appends without touching other records", async () => {
    seed();
    const created = await createCalendarEvent({ ...NEW, type: "meeting" });
    expect(created.type).toBe("meeting");
    const stored = readList(NOV, "events");
    expect(stored).toHaveLength(3);
    expect(stored[0]).toMatchObject({ id: "e1", x_note: "ręcznie" });
  });

  it("7. rejects an invalid date with 400 and creates nothing", async () => {
    for (const date of ["2026-13-01", "11/02/2026", "2026-11-5"]) {
      expect(await statusOf(createCalendarEvent({ ...NEW, date })), date).toBe(400);
    }
    expect(vault.read(NOV)).toBeNull();
    expect(vault.read("Calendar/2026-13.yaml")).toBeNull();
  });

  it("14. five parallel creates in one month all land in the file", async () => {
    await Promise.all([1, 2, 3, 4, 5].map((n) => createCalendarEvent({ ...NEW, title: `T${n}` })));
    expect(readList(NOV, "events")).toHaveLength(5);
  });

  it("15b. does not overwrite a corrupted month file", async () => {
    vault.write(NOV, "events: [unclosed");
    await expect(createCalendarEvent(NEW)).rejects.toThrow();
    expect(vault.read(NOV)).toBe("events: [unclosed");
  });
});

describe("updateCalendarEvent", () => {
  it("8. changes only the passed fields and keeps unknown keys of other records", async () => {
    seed();
    await updateCalendarEvent("e2", { title: "Zmiana" });
    const e2 = readList(NOV, "events").find((r) => r.id === "e2")!;
    expect(e2).toMatchObject({
      title: "Zmiana",
      date: "2026-11-02",
      start_minutes: 540,
      created: "2026-11-01T09:00:00.000Z",
    });
    expect(typeof e2.updated).toBe("string");
    expect(readList(NOV, "events").find((r) => r.id === "e1")).toMatchObject({
      x_note: "ręcznie",
    });
  });

  it("9. moves the record to the new month file exactly once", async () => {
    seed();
    await updateCalendarEvent("e2", { date: "2026-12-05" });
    expect(readList(NOV, "events").map((r) => r.id)).toEqual(["e1"]);
    const moved = readList(DEC, "events").find((r) => r.id === "e2")!;
    expect(moved).toMatchObject({
      date: "2026-12-05",
      created: "2026-11-01T09:00:00.000Z",
      title: "Spotkanie",
    });
    expect(typeof moved.updated).toBe("string");
    expect((await getCalendarEvents()).filter((e) => e.id === "e2")).toHaveLength(1);
  });

  it("10. a date change inside the same month keeps the record in place", async () => {
    seed();
    await updateCalendarEvent("e1", { date: "2026-11-29" });
    const stored = readList(NOV, "events");
    expect(stored.map((r) => r.id)).toEqual(["e1", "e2"]);
    expect(stored[0]).toMatchObject({ date: "2026-11-29", x_note: "ręcznie" });
  });

  it("11. an unknown id gives 404; an empty patch writes nothing", async () => {
    seed();
    const before = [vault.read(NOV), vault.read(DEC)];
    expect(await statusOf(updateCalendarEvent("nie-ma", { title: "x" }))).toBe(404);
    await updateCalendarEvent("e2", {});
    expect([vault.read(NOV), vault.read(DEC)]).toEqual(before);
  });

  it("rejects an invalid new date with 400 and writes nothing", async () => {
    seed();
    const before = vault.read(NOV);
    expect(await statusOf(updateCalendarEvent("e2", { date: "2026-02-31x" }))).toBe(400);
    expect(vault.read(NOV)).toBe(before);
  });
});

describe("deleteCalendarEvent", () => {
  it("13. removes only the matching record; an unknown id writes nothing", async () => {
    seed();
    await deleteCalendarEvent("e1");
    expect(readList(NOV, "events").map((r) => r.id)).toEqual(["e2"]);
    const before = [vault.read(NOV), vault.read(DEC)];
    await deleteCalendarEvent("nie-ma");
    expect([vault.read(NOV), vault.read(DEC)]).toEqual(before);
  });

  it("12b. removes a duplicated id from every month file", async () => {
    writeEvents(NOV, [E2]);
    writeEvents(DEC, [E2, E3]);
    await deleteCalendarEvent("e2");
    expect(readList(NOV, "events")).toEqual([]);
    expect(readList(DEC, "events").map((r) => r.id)).toEqual(["e3"]);
  });
});
