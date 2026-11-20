// @vitest-environment node
/**
 * Granica `bc_calendar` → `bc_tasks` / `bc_tags` (ASERCJE-3) bez żadnych atrap: terminy zadań i słownik tagów
 * dochodzą przez prawdziwe serwisy dostawców w tymczasowym vaulcie.
 */
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { createCalendarEvent, getCalendarEvents } from "@/contexts/bc_calendar/services";
import { getUserTags } from "@/contexts/bc_tags/services";
import { createTask } from "@/contexts/bc_tasks/services";
import { setupTempVault } from "../helpers/tempVault";

const vault = setupTempVault();

const NOVEMBER = { startDate: "2026-11-01", endDate: "2026-11-30" };

/** Słownik z tagiem `Praca` i synonimem `robota` (synonim równy nazwie bez wielkości liter jest odrzucany). */
const TAGS = [
  "version: 1",
  "tags:",
  "  - id: AAAAAAAAAAAAAAAAAAAA",
  "    tag: Praca",
  "    title: Praca",
  "    aliases:",
  "      - robota",
  '    created: "2026-11-01T00:00:00.000Z"',
  "",
].join("\n");

describe("granica calendar ↔ tasks / tags", () => {
  it("termin zadania z bc_tasks jest w kalendarzu, zadanie odłożone nie", async () => {
    await createTask({ title: "Raport", due_date: "2026-11-20" });
    await createTask({ title: "Odłożone", due_date: "2026-11-20", status: "deferred" });

    const events = await getCalendarEvents(NOVEMBER);

    expect(events).toEqual([
      expect.objectContaining({ date: "2026-11-20", title: "Raport", type: "task_deadline" }),
    ]);
  });

  it("synonim tagu zapisuje się w pliku miesiąca jako nazwa kanoniczna z bc_tags", async () => {
    vault.write("Resources/tags.yaml", TAGS);

    await createCalendarEvent({
      date: "2026-11-20",
      start_minutes: 600,
      duration_minutes: 30,
      title: "X",
      tags: ["robota"],
      color: "#00802b",
    });

    const file: unknown = YAML.parse(vault.read("Calendar/2026-11.yaml") ?? "");
    expect(file).toMatchObject({ events: [{ title: "X", tags: ["Praca"] }] });
    expect((await getUserTags()).map((t) => t.tag)).toEqual(["Praca"]);
  });
});
