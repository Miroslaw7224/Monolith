// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatYamlList, GENERATED_BY_IMPORT } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  createTaskTemplate,
  deleteTaskTemplate,
  getTaskTemplates,
  updateTaskTemplate,
} from "@/contexts/bc_tasks/repositories";
import { useTempVault } from "../../helpers/tempVault";

const FILE = "Tasks/templates.yaml";
const STORED = [
  {
    id: "tplA",
    label: "PR",
    title: "Sprawdzić PR",
    link: "https://example.com/pr",
    created: "2026-08-02T10:00:00.000Z",
    x_note: "ręcznie",
  },
  {
    id: "tplB",
    label: "Bug",
    title: "Zgłosić błąd",
    link: "",
    created: "2026-08-01T10:00:00.000Z",
  },
];

const vault = useTempVault();
const seed = () => vault.write(FILE, formatYamlList("templates", STORED, GENERATED_BY_IMPORT));

describe("task templates repository", () => {
  it("returns [] when the file does not exist", async () => {
    expect(await getTaskTemplates()).toEqual([]);
  });

  it("maps a 0b file and sorts ascending by created", async () => {
    seed();
    expect(await getTaskTemplates()).toEqual([
      {
        id: "tplB",
        label: "Bug",
        title: "Zgłosić błąd",
        link: "",
        created_at: "2026-08-01T10:00:00.000Z",
      },
      {
        id: "tplA",
        label: "PR",
        title: "Sprawdzić PR",
        link: "https://example.com/pr",
        created_at: "2026-08-02T10:00:00.000Z",
      },
    ]);
  });

  it("creates a trimmed template with an empty link by default, creating the file", async () => {
    const tpl = await createTaskTemplate({ label: " Doc ", title: " Dokumentacja " });
    expect(tpl.id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(tpl).toMatchObject({ label: "Doc", title: "Dokumentacja", link: "" });
    const [stored] = readList(FILE, "templates");
    expect(Object.keys(stored)).toEqual(["id", "label", "title", "link", "created"]);
    expect(vault.read(FILE)).not.toContain("generated_by");
  });

  it("appends without losing existing records", async () => {
    seed();
    await createTaskTemplate({ label: "Doc", title: "D", link: " https://x.dev " });
    const stored = readList(FILE, "templates");
    expect(stored.slice(0, 2)).toEqual(STORED);
    expect(stored[2]).toMatchObject({ link: "https://x.dev" });
  });

  it("updates only the passed fields and keeps unknown keys", async () => {
    seed();
    await updateTaskTemplate("tplA", { link: " https://new.dev " });
    expect(readList(FILE, "templates")).toEqual([
      { ...STORED[0], link: "https://new.dev" },
      STORED[1],
    ]);
  });

  it("update of a missing id is a 404 and leaves the file untouched", async () => {
    seed();
    const before = vault.read(FILE);
    await expect(updateTaskTemplate("nope", { label: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(vault.read(FILE)).toBe(before);
  });

  it("update with no fields does no I/O", async () => {
    await expect(updateTaskTemplate("nope", {})).resolves.toBeUndefined();
    expect(vault.read(FILE)).toBeNull();
  });

  it("deletes a template; deleting a missing id does not touch the file", async () => {
    seed();
    await deleteTaskTemplate("tplA");
    expect(readList(FILE, "templates").map((r) => r.id)).toEqual(["tplB"]);
    const before = vault.read(FILE);
    await deleteTaskTemplate("nope");
    expect(vault.read(FILE)).toBe(before);
  });

  it("round-trips special characters", async () => {
    const title = 'Sprawdź: "PR" #12 &apos; — zażółć gęślą jaźń';
    const tpl = await createTaskTemplate({ label: "yes", title });
    expect(await getTaskTemplates()).toEqual([
      expect.objectContaining({ id: tpl.id, label: "yes", title }),
    ]);
  });
});
