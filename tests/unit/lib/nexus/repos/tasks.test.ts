// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import {
  createTask,
  deleteTask,
  getTasks,
  reorderTasks,
  updateTask,
} from "@/lib/nexus/repos/tasks";
import { VaultConfigError } from "@/lib/nexus/vault-path";
import { useTempVault } from "./helpers";

const FILE = "Tasks/tasks.md";

const GEN = "---\ngenerated_by: import-to-vault\n---\n\n";
const T1 =
  "- [ ] Kurs Playwright [id:: t1] [status:: todo] [due:: 2026-08-06] [order:: 1] [created:: 2026-02-26T16:58:41.794Z] [updated:: 2026-11-11T22:19:18.163Z]";
const T2 =
  "- [x] Review PR [id:: t2] [status:: done] [order:: 0] [desc:: https://example.com/pr] [created:: 2026-08-03T19:45:42.870Z]";
const NOTE = "Notatka ręczna poza listą.";
const NOID = "- [ ] Linia bez id [status:: todo]";
const BROKEN = "- [ ] Zepsute [id:: c3] [order:: abc]";
const BODY = `# Zadania\n\n${T1}\n${T2}\n\n${NOTE}\n${NOID}\n`;
const SEED = `${GEN}${BODY}`;

const vault = useTempVault();

async function status(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    return (err as DomainError).statusCode;
  }
  return undefined;
}

describe("getTasks", () => {
  it("1. returns [] without a file", async () => {
    expect(await getTasks()).toEqual([]);
  });

  it("2. reads the 0b format, ordered by order, skipping lines without id", async () => {
    vault.write(FILE, SEED);
    const tasks = await getTasks();
    expect(tasks.map((t) => t.id)).toEqual(["t2", "t1"]);
    expect(tasks[0]).toEqual({
      id: "t2",
      title: "Review PR",
      link: "",
      description: "https://example.com/pr",
      status: "done",
      due_date: null,
      priority: null,
      order: 0,
      created_at: "2026-08-03T19:45:42.870Z",
      updated_at: undefined,
    });
  });

  it("3. sorts by order, then newest created first, then id", async () => {
    vault.write(
      FILE,
      [
        "# Zadania",
        "",
        "- [ ] X1 [id:: x1] [status:: todo] [order:: 2] [created:: 2026-01-01T00:00:00.000Z]",
        "- [ ] X4 [id:: x4] [status:: todo] [created:: 2026-02-01T00:00:00.000Z]",
        "- [ ] X3 [id:: x3] [status:: todo] [created:: 2026-02-01T00:00:00.000Z]",
        "- [ ] X2 [id:: x2] [status:: todo] [created:: 2026-03-01T00:00:00.000Z]",
        "",
      ].join("\n")
    );
    expect((await getTasks()).map((t) => t.id)).toEqual(["x1", "x2", "x3", "x4"]);
  });

  it("14. a broken line neither breaks reading nor gets rewritten", async () => {
    vault.write(FILE, `${SEED}${BROKEN}\n`);
    expect((await getTasks()).map((t) => t.id)).toEqual(["t2", "t1"]);
    await updateTask("t1", { title: "Zmiana" });
    expect(vault.read(FILE)).toContain(`${BROKEN}\n`);
  });

  it("15. throws VaultConfigError without NEXUS_VAULT_PATH", async () => {
    delete process.env.NEXUS_VAULT_PATH;
    await expect(getTasks()).rejects.toThrow(VaultConfigError);
  });
});

describe("createTask", () => {
  it("4. creates the file with heading and one line", async () => {
    const created = await createTask({ title: "Nowe" });
    const text = vault.read(FILE) as string;
    const m =
      /^# Zadania\n\n- \[ \] Nowe \[id:: ([A-Za-z0-9]{20})\] \[status:: todo\] \[order:: 0\] \[created:: (\S+)\] \[updated:: (\S+)\]\n$/.exec(
        text
      );
    expect(m).not.toBeNull();
    expect(m![2]).toBe(m![3]);
    expect(created).toMatchObject({
      id: m![1],
      title: "Nowe",
      status: "todo",
      link: "",
      description: "",
      due_date: null,
      priority: null,
      order: 0,
    });
    expect(created.created_at).toBe(created.updated_at);
  });

  it("5. appends to the end, drops generated_by, keeps everything else byte-for-byte", async () => {
    vault.write(FILE, SEED);
    const created = await createTask({ title: "Dopisane", status: "in_progress" });
    const text = vault.read(FILE) as string;
    expect(text).not.toContain("generated_by");
    expect(text.startsWith("# Zadania\n")).toBe(true);
    expect(text.startsWith(BODY)).toBe(true);
    const lines = text.trimEnd().split("\n");
    expect(lines.at(-1)).toContain(`[id:: ${created.id}]`);
    expect(created.status).toBe("in_progress");
  });

  it("6. round-trips special characters", async () => {
    const title = 'Ala [x] \\ i "cudzysłów" #tag';
    const description = "a\nb [c]";
    await createTask({ title, description, link: "https://example.com/?q=[1]" });
    const [task] = await getTasks();
    expect(task.title).toBe(title);
    expect(task.description).toBe(description);
    expect(task.link).toBe("https://example.com/?q=[1]");
  });
});

describe("updateTask", () => {
  it("7. rewrites only the target line and bumps updated", async () => {
    vault.write(FILE, SEED);
    await updateTask("t1", { status: "done" });
    const text = vault.read(FILE) as string;
    const line = text.split("\n").find((l) => l.includes("[id:: t1]")) as string;
    expect(line.startsWith("- [x] Kurs Playwright")).toBe(true);
    expect(line).toContain("[status:: done]");
    expect(line).toContain("[due:: 2026-08-06]");
    const updated = /\[updated:: (\S+?)\]/.exec(line)![1];
    expect(updated > "2026-11-11T22:19:18.163Z").toBe(true);
    expect(text).toContain(`${T2}\n\n${NOTE}\n${NOID}\n`);
    expect(text).not.toContain("generated_by");
  });

  it("8. clears and sets optional fields, keeping those not passed", async () => {
    vault.write(FILE, SEED);
    await updateTask("t1", { due_date: null });
    let line = (vault.read(FILE) as string).split("\n").find((l) => l.includes("[id:: t1]"))!;
    expect(line).not.toContain("[due::");
    expect(line).toContain("[order:: 1]");
    await updateTask("t1", { priority: 3, order: 7 });
    line = (vault.read(FILE) as string).split("\n").find((l) => l.includes("[id:: t1]"))!;
    expect(line).toContain("[priority:: 3]");
    expect(line).toContain("[order:: 7]");
    expect(line).toContain("Kurs Playwright");
  });

  it("9. an unknown id gives 404 and leaves the file untouched", async () => {
    vault.write(FILE, SEED);
    expect(await status(updateTask("nie-ma", { title: "x" }))).toBe(404);
    expect(vault.read(FILE)).toBe(SEED);
  });

  it("12. keeps lines added externally between operations", async () => {
    vault.write(FILE, `${SEED}- [ ] Z Obsidiana [id:: ext1] [status:: todo]\n`);
    await updateTask("t1", { title: "Zmiana" });
    expect(vault.read(FILE)).toContain("- [ ] Z Obsidiana [id:: ext1] [status:: todo]\n");
  });

  it("13. two parallel updates are both stored", async () => {
    vault.write(FILE, SEED);
    await Promise.all([updateTask("t1", { title: "A" }), updateTask("t2", { title: "B" })]);
    const byId = new Map((await getTasks()).map((t) => [t.id, t.title]));
    expect(byId.get("t1")).toBe("A");
    expect(byId.get("t2")).toBe("B");
  });
});

describe("reorderTasks", () => {
  it("10a. changes only order, leaves updated and other lines alone", async () => {
    vault.write(FILE, SEED);
    await reorderTasks(["t1", "t2"]);
    const text = vault.read(FILE) as string;
    const t1 = text.split("\n").find((l) => l.includes("[id:: t1]"))!;
    const t2 = text.split("\n").find((l) => l.includes("[id:: t2]"))!;
    expect(t1).toContain("[order:: 0]");
    expect(t1).toContain("[updated:: 2026-11-11T22:19:18.163Z]");
    expect(t2).toContain("[order:: 1]");
    expect(t2).not.toContain("[updated::");
    expect(text).toContain(`\n\n${NOTE}\n${NOID}\n`);
  });

  it("10b. does not rewrite lines whose order already matches", async () => {
    vault.write(FILE, SEED);
    await reorderTasks(["t2", "t1"]);
    expect(vault.read(FILE)).toBe(BODY);
  });

  it("10c. an empty list does not touch the file", async () => {
    vault.write(FILE, SEED);
    await reorderTasks([]);
    expect(vault.read(FILE)).toBe(SEED);
  });

  it("10d. an unknown id gives 404 without writing", async () => {
    vault.write(FILE, SEED);
    expect(await status(reorderTasks(["t1", "nie-ma"]))).toBe(404);
    expect(vault.read(FILE)).toBe(SEED);
  });
});

describe("deleteTask", () => {
  it("11a. removes only the matching line", async () => {
    vault.write(FILE, SEED);
    await deleteTask("t2");
    expect(vault.read(FILE)).toBe(BODY.replace(`${T2}\n`, ""));
  });

  it("11b. is idempotent and does not write for an unknown id", async () => {
    vault.write(FILE, SEED);
    await deleteTask("nie-ma");
    expect(vault.read(FILE)).toBe(SEED);
  });
});
