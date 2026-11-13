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
const LINK = "https://meet.google.com/gon-fztr-zrn";

describe("link wydarzenia (repozytorium)", () => {
  it("zapisuje i odczytuje link; bez linku pole nie występuje w pliku", async () => {
    const withLink = await createInRepo({ ...BASE, link: LINK });
    const without = await createInRepo({ ...BASE, date: "2026-11-25" });
    expect(withLink.link).toBe(LINK);
    expect(without.link).toBeUndefined();
    expect(vault.read("Calendar/2026-11.yaml")).toContain(`link: ${LINK}`);
    const all = await getFromRepo();
    expect(all.find((e) => e.id === withLink.id)?.link).toBe(LINK);
    expect(all.find((e) => e.id === without.id)?.link).toBeUndefined();
  });

  it("update ustawia link, a pusty tekst go usuwa", async () => {
    const e = await createInRepo(BASE);
    await updateInRepo(e.id, { link: LINK });
    expect((await getFromRepo())[0].link).toBe(LINK);
    await updateInRepo(e.id, { link: "" });
    expect((await getFromRepo())[0].link).toBeUndefined();
    expect(vault.read("Calendar/2026-11.yaml")).not.toContain("link:");
  });
});

describe("link wydarzenia (odczyt z pliku)", () => {
  it.each(["javascript:alert(1)", "data:text/html,x", "ftp://x.pl/a", "meet.google.com/abc"])(
    "link %s wpisany ręcznie w YAML jest ignorowany",
    async (bad) => {
      const e = await createInRepo({ ...BASE, link: LINK });
      vault.write("Calendar/2026-11.yaml", vault.read("Calendar/2026-11.yaml")!.replace(LINK, bad));
      expect((await getFromRepo()).find((x) => x.id === e.id)?.link).toBeUndefined();
    }
  );

  it("poprawny link http(s) z pliku zostaje", async () => {
    const e = await createInRepo({ ...BASE, link: LINK });
    expect((await getFromRepo()).find((x) => x.id === e.id)?.link).toBe(LINK);
  });
});

describe("link wydarzenia (DTO)", () => {
  it("DTO przenosi link", () => {
    expect(toCalendarEventDto({ id: "1", ...BASE, link: LINK }).link).toBe(LINK);
  });
});

const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_tasks/services", () => ({ getTasks: async () => [] }));

describe("link wydarzenia (serwis)", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpdate.mockReset();
  });

  it.each(["javascript:alert(1)", "ftp://x.pl/a", "meet.google.com/abc", "https://", "a b"])(
    "odrzuca %s",
    async (bad) => {
      vi.resetModules();
      vi.doMock("@/contexts/bc_calendar/repositories", () => ({
        createCalendarEvent: mockCreate,
        updateCalendarEvent: mockUpdate,
      }));
      const services = await import("@/contexts/bc_calendar/services");
      await expect(services.createCalendarEvent({ ...BASE, link: bad })).rejects.toThrow(
        "http(s) URL"
      );
      await expect(services.updateCalendarEvent("e1", { link: bad })).rejects.toThrow(
        "http(s) URL"
      );
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    }
  );

  it("przepuszcza http(s) i pusty link (usunięcie), przycinając spacje", async () => {
    vi.resetModules();
    vi.doMock("@/contexts/bc_calendar/repositories", () => ({
      createCalendarEvent: mockCreate,
      updateCalendarEvent: mockUpdate,
    }));
    const services = await import("@/contexts/bc_calendar/services");
    await services.createCalendarEvent({ ...BASE, link: ` ${LINK} ` });
    expect(mockCreate.mock.calls[0][0].link).toBe(LINK);
    await services.updateCalendarEvent("e1", { link: "" });
    expect(mockUpdate.mock.calls[0][1].link).toBe("");
    await services.updateCalendarEvent("e1", { title: "x" });
    expect(mockUpdate.mock.calls[1][1].link).toBeUndefined();
  });
});

describe("link wydarzenia (router)", () => {
  it("POST przekazuje link do serwisu, zły typ linku jest ignorowany", async () => {
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
    await POST(req({ ...BASE, link: LINK }));
    expect(create.mock.calls[0][0].link).toBe(LINK);
    await POST(req({ ...BASE, link: 5 }));
    expect(create.mock.calls[1][0].link).toBeUndefined();
  });
});
