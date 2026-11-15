// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const svc = vi.hoisted(() => ({
  listCourses: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  deleteCourse: vi.fn(),
}));
vi.mock("@/contexts/bc_arsenal/services", () => svc);

import { getCourses, postCourse, putCourse, removeCourse } from "@/contexts/bc_arsenal/router";

const entry = {
  id: "c1",
  title: "T",
  url: "https://a.example.com",
  status: "plan" as const,
  certificateMissing: false,
};
const ctx = { params: Promise.resolve({ courseId: "c1" }) };
const req = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/arsenal/courses", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const valid = { title: " T ", url: "https://a.example.com", status: "plan" };

beforeEach(() => Object.values(svc).forEach((fn) => fn.mockReset()));

describe("getCourses", () => {
  it("200 z DTO", async () => {
    svc.listCourses.mockReturnValue({ courses: [entry], skipped: 1 });
    const res = await getCourses();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ courses: [entry], skipped: 1 });
  });

  it("błąd domenowy zachowuje status", async () => {
    svc.listCourses.mockImplementation(() => {
      throw new DomainError("źle", 409);
    });
    expect((await getCourses()).status).toBe(409);
  });
});

describe("postCourse", () => {
  it("201 i przycięte dane do serwisu", async () => {
    svc.createCourse.mockResolvedValue(entry);
    const res = await postCourse(req(valid));
    expect(res.status).toBe(201);
    expect(svc.createCourse).toHaveBeenCalledWith(expect.objectContaining({ title: "T" }));
  });

  it("400 dla adresu javascript: i dla pustego tytułu", async () => {
    expect((await postCourse(req({ ...valid, url: "javascript:alert(1)" }))).status).toBe(400);
    expect((await postCourse(req({ ...valid, title: "" }))).status).toBe(400);
    expect(svc.createCourse).not.toHaveBeenCalled();
  });
});

describe("putCourse", () => {
  it("200 z DTO", async () => {
    svc.updateCourse.mockResolvedValue(entry);
    const res = await putCourse(req(valid, "PUT"), ctx);
    expect(res.status).toBe(200);
    expect(svc.updateCourse).toHaveBeenCalledWith("c1", expect.objectContaining({ title: "T" }));
  });

  it("404 gdy serwis zgłasza brak kursu", async () => {
    svc.updateCourse.mockRejectedValue(new DomainError("Kurs nie istnieje", 404));
    expect((await putCourse(req(valid, "PUT"), ctx)).status).toBe(404);
  });
});

describe("removeCourse", () => {
  it("204", async () => {
    svc.deleteCourse.mockResolvedValue(undefined);
    const res = await removeCourse(new Request("http://localhost/x", { method: "DELETE" }), ctx);
    expect(res.status).toBe(204);
    expect(svc.deleteCourse).toHaveBeenCalledWith("c1");
  });
});
