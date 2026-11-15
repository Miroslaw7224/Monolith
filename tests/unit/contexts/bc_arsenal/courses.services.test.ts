// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/contexts/bc_arsenal/models";

const repo = vi.hoisted(() => ({
  readCourses: vi.fn(),
  insertCourse: vi.fn(),
  replaceCourse: vi.fn(),
  removeCourse: vi.fn(),
  certificateExists: vi.fn(),
}));
vi.mock("@/contexts/bc_arsenal/repositories", () => ({
  readPromptFiles: vi.fn(),
  readSkillFiles: vi.fn(),
  readTemplates: vi.fn(),
  writeDeployed: vi.fn(),
  ...repo,
}));
vi.mock("@/contexts/bc_projects/services", () => ({
  listProjects: vi.fn(),
  hasCompanyData: vi.fn(),
}));

import {
  createCourse,
  deleteCourse,
  listCourses,
  updateCourse,
} from "@/contexts/bc_arsenal/services";

const course = (over: Partial<Course> & { id: string }): Course => ({
  title: "T",
  url: "https://a.example.com",
  status: "plan",
  ...over,
});

beforeEach(() => {
  Object.values(repo).forEach((fn) => fn.mockReset());
  repo.certificateExists.mockReturnValue(true);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 15, 12, 0, 0)); // 2026-11-15 lokalnie
});
afterEach(() => vi.useRealTimers());

describe("listCourses", () => {
  it("sortuje: w-trakcie, plan, ukonczony; w grupie po tytule (pl)", () => {
    repo.readCourses.mockReturnValue({
      courses: [
        course({ id: "1", title: "Żółw", status: "plan" }),
        course({ id: "2", title: "Zebra", status: "ukonczony" }),
        course({ id: "3", title: "Beta", status: "w-trakcie" }),
        course({ id: "4", title: "Alfa", status: "plan" }),
      ],
      skipped: 2,
    });
    const list = listCourses();
    expect(list.courses.map((c) => c.id)).toEqual(["3", "4", "1", "2"]);
    expect(list.skipped).toBe(2);
  });

  it("certificateMissing tylko dla kursu z plikiem, którego brak", () => {
    repo.certificateExists.mockImplementation((rel: string) => rel === "jest.pdf");
    repo.readCourses.mockReturnValue({
      courses: [
        course({ id: "a", certificateFile: "jest.pdf" }),
        course({ id: "b", certificateFile: "brak.pdf" }),
        course({ id: "c" }),
      ],
      skipped: 0,
    });
    const byId = Object.fromEntries(listCourses().courses.map((c) => [c.id, c.certificateMissing]));
    expect(byId).toEqual({ a: false, b: true, c: false });
  });

  it("błąd sprawdzania pliku liczy się jako brak pliku, lista się ładuje", () => {
    repo.certificateExists.mockImplementation(() => {
      throw new Error("EACCES");
    });
    repo.readCourses.mockReturnValue({
      courses: [course({ id: "a", certificateFile: "x.pdf" })],
      skipped: 0,
    });
    expect(listCourses().courses[0].certificateMissing).toBe(true);
  });
});

describe("createCourse", () => {
  it("ukończony bez daty dostaje dzisiejszą datę", async () => {
    repo.insertCourse.mockImplementation(async (input) => ({ id: "new", ...input }));
    const created = await createCourse({
      title: "T",
      url: "https://a.example.com",
      status: "ukonczony",
    });
    expect(repo.insertCourse).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ukonczony", completed: "2026-11-15" })
    );
    expect(created.completed).toBe("2026-11-15");
  });

  it("ukończony z datą zachowuje datę, inny status kasuje datę", async () => {
    repo.insertCourse.mockImplementation(async (input) => ({ id: "new", ...input }));
    await createCourse({
      title: "T",
      url: "https://a.example.com",
      status: "ukonczony",
      completed: "2026-01-02",
    });
    expect(repo.insertCourse).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: "2026-01-02" })
    );
    await createCourse({
      title: "T",
      url: "https://a.example.com",
      status: "plan",
      completed: "2026-01-02",
    });
    expect(repo.insertCourse.mock.calls.at(-1)![0].completed).toBeUndefined();
  });
});

describe("updateCourse", () => {
  it("zapisuje i zwraca świeży wpis z ostrzeżeniem", async () => {
    repo.replaceCourse.mockResolvedValue(undefined);
    repo.readCourses.mockReturnValue({
      courses: [course({ id: "c1", title: "Po zmianie", certificateFile: "x.pdf" })],
      skipped: 0,
    });
    repo.certificateExists.mockReturnValue(false);
    const updated = await updateCourse("c1", {
      title: "Po zmianie",
      url: "https://a.example.com",
      status: "plan",
      certificateFile: "x.pdf",
    });
    expect(updated).toMatchObject({ id: "c1", title: "Po zmianie", certificateMissing: true });
  });

  it("kurs, który zniknął po zapisie, to 404", async () => {
    repo.replaceCourse.mockResolvedValue(undefined);
    repo.readCourses.mockReturnValue({ courses: [], skipped: 0 });
    await expect(
      updateCourse("c1", { title: "T", url: "https://a.example.com", status: "plan" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("deleteCourse", () => {
  it("deleguje do repozytorium", async () => {
    repo.removeCourse.mockResolvedValue(undefined);
    await deleteCourse("c1");
    expect(repo.removeCourse).toHaveBeenCalledWith("c1");
  });
});
