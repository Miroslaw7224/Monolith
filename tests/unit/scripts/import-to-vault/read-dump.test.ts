// @vitest-environment node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DumpError, readDump } from "@/scripts/import-to-vault/read-dump";
import { makeDump, sampleCollections } from "./helpers";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "read-dump-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function readManifest(): { collections: Array<Record<string, unknown>> } & Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
}

function writeManifest(manifest: object): void {
  fs.writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Podmienia treść pliku kolekcji i dopasowuje sha256 w manifeście (liczbę linii zostawia). */
function replaceFile(collectionPath: string, text: string): string {
  const manifest = readManifest();
  const entry = manifest.collections.find((c) => c.path === collectionPath)!;
  const buffer = Buffer.from(text, "utf8");
  fs.writeFileSync(path.join(dir, entry.file as string), buffer);
  entry.sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  writeManifest(manifest);
  return entry.file as string;
}

function thrown(fn: () => unknown): DumpError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DumpError);
    return error as DumpError;
  }
  throw new Error("oczekiwano DumpError, funkcja nie rzuciła");
}

describe("readDump", () => {
  it("wczytuje obsługiwane kolekcje wybranego konta i raportuje pominięte", () => {
    makeDump(dir, {
      ...sampleCollections(),
      waitlist: [{ id: "w1", data: { email: "a@b.c" } }],
    });
    const dump = readDump(dir, "u1");

    expect(dump.uid).toBe("u1");
    expect(dump.dumpDir).toBe(dir);
    expect(dump.exportedAt).toBe("2026-11-12T10:00:00.000Z");
    expect(dump.rows.notes.length).toBe(4);
    expect(dump.rows.tasks[0].id).toBe("t1");
    expect(dump.rows.tasks[0].path).toBe("users/u1/tasks/t1");
    expect(dump.rows.tasks[0].data.title).toBe("Napraw ] i :: błąd");
    expect(dump.rows.user_tags.length).toBe(2);
    expect(dump.rows.task_templates.length).toBe(1);
    expect(dump.rows.resources.length).toBe(1);

    expect(dump.skipped).toContainEqual(
      expect.objectContaining({ path: "users/u1/calendar_events", count: 2, type: null })
    );
    expect(dump.skipped).toContainEqual({
      path: "users/u2/notes",
      count: 1,
      type: "notes",
      reason: "inne konto",
    });
    expect(dump.skipped).toContainEqual({
      path: "waitlist",
      count: 1,
      type: null,
      reason: "kolekcja główna, poza zakresem",
    });
    expect(dump.skipped.find((s) => s.path === "users/u1/calendar_events")!.reason).toBe(
      "poza zakresem etapu 0 (§1.1)"
    );
  });

  it("liczy 3 wiersze w pominiętej kolekcji i 2 wiersze notatek", () => {
    makeDump(dir, {
      "users/u1/notes": [
        { id: "a", data: { title: "A" } },
        { id: "b", data: { title: "B" } },
      ],
      "users/u1/tasks": [{ id: "t", data: { title: "T" } }],
      "users/u1/calendar_events": [
        { id: "1", data: {} },
        { id: "2", data: {} },
        { id: "3", data: {} },
      ],
      "users/u2/notes": [{ id: "x", data: {} }],
      waitlist: [{ id: "w", data: {} }],
    });
    const dump = readDump(dir, "u1");

    expect(dump.rows.notes.length).toBe(2);
    expect(dump.rows.tasks[0].id).toBe("t");
    expect(dump.skipped).toContainEqual({
      path: "users/u1/calendar_events",
      count: 3,
      type: null,
      reason: "poza zakresem etapu 0 (§1.1)",
    });
    expect(dump.skipped).toContainEqual({
      path: "users/u2/notes",
      count: 1,
      type: "notes",
      reason: "inne konto",
    });
    expect(dump.skipped.map((s) => s.path)).toContain("waitlist");
  });

  it("zagnieżdżone kolekcje i puste wpisy trafiają na listę pominiętych", () => {
    makeDump(dir, {
      "users/u1/notes": [{ id: "a", data: {} }],
      "users/u1/notes/a/versions": [{ id: "v1", data: {} }],
      "users/u1/mindMaps": [],
    });
    const dump = readDump(dir);

    expect(dump.rows.notes.length).toBe(1);
    expect(dump.skipped).toContainEqual({
      path: "users/u1/notes/a/versions",
      count: 1,
      type: null,
      reason: "poza zakresem etapu 0 (§1.1)",
    });
    expect(dump.skipped).toContainEqual({
      path: "users/u1/mindMaps",
      count: 0,
      type: null,
      reason: "poza zakresem etapu 0 (§1.1)",
    });
  });

  it("bez uidOverride przy dwóch kontach z obsługiwanymi kolekcjami rzuca DumpError z --uid", () => {
    makeDump(dir, sampleCollections());
    expect(thrown(() => readDump(dir)).message).toContain("--uid");
  });

  it("jedyne konto wybiera się samo", () => {
    makeDump(dir, { "users/solo/notes": [{ id: "a", data: {} }] });
    expect(readDump(dir).uid).toBe("solo");
  });

  it("manifest.uid wybiera konto bez uidOverride", () => {
    makeDump(dir, sampleCollections(), { uid: "u1" });
    const dump = readDump(dir);
    expect(dump.uid).toBe("u1");
    expect(dump.rows.notes.length).toBe(4);
  });

  it("uidOverride ma pierwszeństwo przed manifest.uid", () => {
    makeDump(dir, sampleCollections(), { uid: "u1" });
    const dump = readDump(dir, "u2");
    expect(dump.uid).toBe("u2");
    expect(dump.rows.notes.length).toBe(1);
    expect(dump.rows.tasks.length).toBe(0);
  });

  it("uidOverride nieobecny w zrzucie rzuca DumpError", () => {
    makeDump(dir, sampleCollections());
    expect(thrown(() => readDump(dir, "nieistnieje")).message).toContain("nieistnieje");
  });

  it("status inny niż ok rzuca DumpError z faktycznym statusem", () => {
    makeDump(dir, sampleCollections(), { status: "needs-review" });
    expect(thrown(() => readDump(dir, "u1")).message).toContain("needs-review");
  });

  it("zła wersja lub narzędzie w manifeście rzuca DumpError", () => {
    makeDump(dir, sampleCollections(), { version: 2 });
    expect(() => readDump(dir, "u1")).toThrow(DumpError);
    makeDump(dir, sampleCollections(), { version: 1, tool: "inne" });
    expect(() => readDump(dir, "u1")).toThrow(DumpError);
  });

  it("manifest nie będący poprawnym JSON-em rzuca DumpError", () => {
    makeDump(dir, sampleCollections());
    fs.writeFileSync(path.join(dir, "manifest.json"), "{ to nie json");
    expect(() => readDump(dir, "u1")).toThrow(DumpError);
  });

  it("zmiana jednego bajtu w pliku .jsonl rzuca DumpError z nazwą pliku", () => {
    makeDump(dir, sampleCollections());
    const file = path.join(dir, "users/u1/tasks.jsonl");
    const buffer = fs.readFileSync(file);
    buffer[buffer.length - 3] = buffer[buffer.length - 3] ^ 1;
    fs.writeFileSync(file, buffer);

    expect(thrown(() => readDump(dir, "u1")).message).toContain("users/u1/tasks.jsonl");
  });

  it("obcięta ostatnia linia (z poprawionym SHA) rzuca DumpError przez liczbę linii", () => {
    makeDump(dir, sampleCollections());
    const original = fs.readFileSync(path.join(dir, "users/u1/notes.jsonl"), "utf8");
    const truncated = original.split("\n").slice(0, 3).join("\n") + "\n";
    const file = replaceFile("users/u1/notes", truncated);

    expect(thrown(() => readDump(dir, "u1")).message).toContain(file);
  });

  it("brak manifest.json rzuca DumpError", () => {
    makeDump(dir, sampleCollections());
    fs.rmSync(path.join(dir, "manifest.json"));
    expect(() => readDump(dir, "u1")).toThrow(DumpError);
  });

  it("brak pliku kolekcji rzuca DumpError z nazwą pliku", () => {
    makeDump(dir, sampleCollections());
    fs.rmSync(path.join(dir, "users/u1/tasks.jsonl"));
    expect(thrown(() => readDump(dir, "u1")).message).toContain("users/u1/tasks.jsonl");
  });

  it("wpis z file: ../poza.jsonl rzuca DumpError (ucieczka z katalogu)", () => {
    makeDump(dir, sampleCollections());
    const outside = path.join(path.dirname(dir), `poza-${path.basename(dir)}.jsonl`);
    fs.writeFileSync(outside, "");
    try {
      const manifest = readManifest();
      manifest.collections[0].file = `../${path.basename(outside)}`;
      manifest.collections[0].sha256 = crypto.createHash("sha256").update("").digest("hex");
      manifest.collections[0].lines = 0;
      writeManifest(manifest);
      expect(() => readDump(dir, "u1")).toThrow(DumpError);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it("wpis ze ścieżką absolutną rzuca DumpError", () => {
    makeDump(dir, sampleCollections());
    const manifest = readManifest();
    manifest.collections[0].file = path.join(dir, String(manifest.collections[0].file));
    writeManifest(manifest);
    expect(() => readDump(dir, "u1")).toThrow(DumpError);
  });

  it("_path niezgodny z kolekcją rzuca DumpError z plikiem i linią, bez treści data", () => {
    makeDump(dir, {
      "users/u1/notes": [{ id: "a", data: { title: "A" } }],
      "users/u1/tasks": [{ id: "t", data: { title: "T" } }],
    });
    const bad =
      JSON.stringify({ _id: "a", _path: "users/u1/notes/a", data: { title: "A" } }) +
      "\n" +
      JSON.stringify({ _id: "b", _path: "users/u9/notes/b", data: { secret: "SEKRET" } }) +
      "\n";
    const file = replaceFile("users/u1/notes", bad);
    const manifest = readManifest();
    manifest.collections.find((c) => c.path === "users/u1/notes")!.lines = 2;
    writeManifest(manifest);

    const error = thrown(() => readDump(dir, "u1"));
    expect(error.message).toContain(file);
    expect(error.message).toContain("2");
    expect(error.message).not.toContain("SEKRET");
  });

  it("linia niebędąca JSON-em rzuca DumpError z numerem linii, bez treści", () => {
    makeDump(dir, { "users/u1/notes": [{ id: "a", data: {} }] });
    const file = replaceFile("users/u1/notes", "SEKRET to nie json\n");

    const error = thrown(() => readDump(dir, "u1"));
    expect(error.message).toContain(file);
    expect(error.message).toContain("1");
    expect(error.message).not.toContain("SEKRET");
  });

  it("wiersz bez data-obiektu rzuca DumpError", () => {
    makeDump(dir, { "users/u1/notes": [{ id: "a", data: {} }] });
    replaceFile(
      "users/u1/notes",
      JSON.stringify({ _id: "a", _path: "users/u1/notes/a", data: "SEKRET" }) + "\n"
    );
    const error = thrown(() => readDump(dir, "u1"));
    expect(error.message).not.toContain("SEKRET");
  });

  it("zrzut bez żadnej obsługiwanej kolekcji rzuca DumpError", () => {
    makeDump(dir, {
      "users/u1/calendar_events": [{ id: "e1", data: {} }],
      waitlist: [{ id: "w1", data: {} }],
    });
    expect(() => readDump(dir)).toThrow(DumpError);
  });
});
