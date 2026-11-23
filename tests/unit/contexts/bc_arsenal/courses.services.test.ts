// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseYamlList } from "@/lib/nexus/yaml-lists";
import {
  createCourse,
  deleteCourse,
  listCourses,
  updateCourse,
} from "@/contexts/bc_arsenal/services";
import { setupTempVault } from "../../helpers/tempVault";

const FILE = "Arsenal/courses.yaml";
const vault = setupTempVault();

type Seed = { id: string; title?: string; status?: string; certificateFile?: string };

/** Kursy w pliku, w formacie czytanym przez repozytorium. */
const seed = (...courses: Seed[]) =>
  vault.write(
    FILE,
    `version: 1\ncourses:\n${courses
      .map(
        (c) =>
          `  - id: ${c.id}\n    title: ${c.title ?? "T"}\n    url: https://a.example.com\n    status: ${c.status ?? "plan"}\n` +
          (c.certificateFile ? `    certificate_file: ${c.certificateFile}\n` : "")
      )
      .join("")}`
  );
const stored = () => parseYamlList(vault.read(FILE)!, "courses").items;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 15, 12, 0, 0)); // 2026-11-15 lokalnie
});
afterEach(() => vi.useRealTimers());

describe("listCourses", () => {
  it("sortuje: w-trakcie, plan, ukonczony; w grupie po tytule (pl)", () => {
    seed(
      { id: "1", title: "Żółw", status: "plan" },
      { id: "2", title: "Zebra", status: "ukonczony" },
      { id: "3", title: "Beta", status: "w-trakcie" },
      { id: "4", title: "Alfa", status: "plan" },
      { id: "5", title: "Bravo", status: "plan" }
    );
    vault.write(FILE, vault.read(FILE)! + "  - id: zly\n    title: Zły\n    url: javascript:x\n");

    const list = listCourses();

    expect(list.courses.map((c) => c.id)).toEqual(["3", "4", "5", "1", "2"]);
    expect(list.skipped).toBe(1);
  });

  it("certificateMissing tylko dla kursu z plikiem, którego brak", () => {
    vault.write("Documents/jest.pdf", "x");
    seed(
      { id: "a", certificateFile: "jest.pdf" },
      { id: "b", certificateFile: "brak.pdf" },
      { id: "c" }
    );

    const byId = Object.fromEntries(listCourses().courses.map((c) => [c.id, c.certificateMissing]));

    expect(byId).toEqual({ a: false, b: true, c: false });
  });
});

describe("createCourse", () => {
  it("ukończony bez daty dostaje dzisiejszą datę", async () => {
    const created = await createCourse({
      title: "T",
      url: "https://a.example.com",
      status: "ukonczony",
    });

    expect(created.completed).toBe("2026-11-15");
    expect(stored()).toEqual([
      {
        id: created.id,
        title: "T",
        url: "https://a.example.com",
        status: "ukonczony",
        completed: "2026-11-15",
      },
    ]);
  });

  it("ukończony z datą zachowuje datę, inny status kasuje datę", async () => {
    await createCourse({
      title: "T",
      url: "https://a.example.com",
      status: "ukonczony",
      completed: "2026-01-02",
    });
    await createCourse({
      title: "T",
      url: "https://a.example.com",
      status: "plan",
      completed: "2026-01-02",
    });

    expect(stored().map((c) => [c.status, c.completed])).toEqual([
      ["ukonczony", "2026-01-02"],
      ["plan", undefined],
    ]);
  });
});

describe("updateCourse", () => {
  it("zapisuje w pliku i zwraca świeży wpis z ostrzeżeniem o braku certyfikatu", async () => {
    seed({ id: "c1" }, { id: "c2", title: "Sąsiad" });

    const updated = await updateCourse("c1", {
      title: "Po zmianie",
      url: "https://a.example.com",
      status: "plan",
      certificateFile: "x.pdf",
    });

    expect(updated).toMatchObject({ id: "c1", title: "Po zmianie", certificateMissing: true });
    expect(stored()).toEqual([
      {
        id: "c1",
        title: "Po zmianie",
        url: "https://a.example.com",
        status: "plan",
        certificate_file: "x.pdf",
      },
      { id: "c2", title: "Sąsiad", url: "https://a.example.com", status: "plan" },
    ]);
  });

  it("nieznany kurs to 404 i plik bez zmian", async () => {
    seed({ id: "c2" });
    const before = vault.read(FILE);

    await expect(
      updateCourse("c1", { title: "T", url: "https://a.example.com", status: "plan" })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(vault.read(FILE)).toBe(before);
  });
});

describe("deleteCourse", () => {
  it("usuwa kurs z pliku i zostawia pozostałe", async () => {
    seed({ id: "c1" }, { id: "c2" });

    await deleteCourse("c1");

    expect(stored().map((c) => c.id)).toEqual(["c2"]);
  });
});
