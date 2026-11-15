// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { parseYamlList } from "@/lib/nexus/yaml-lists";
import {
  certificateExists,
  insertCourse,
  readCourses,
  removeCourse,
  replaceCourse,
} from "@/contexts/bc_arsenal/repositories";
import { setupTempVault } from "../../helpers/tempVault";

const FILE = "Arsenal/courses.yaml";
const vault = setupTempVault();

const HAND_WRITTEN = `version: 1
courses:
  - id: c1
    title: Kurs MCP
    url: https://a.example.com
    provider: Udemy
    status: ukonczony
    completed: 2026-03-01
    certificate_url: https://a.example.com/cert
    certificate_file: certyfikaty/mcp.pdf
    note: Ręczna notatka
    x_extra: zostaje
  - id: c2
    title: Bez statusu
    url: https://b.example.com
  - id: c3
    title: Zły adres
    url: javascript:alert(1)
    status: plan
  - id: c4
    title: Zła ścieżka certyfikatu
    url: https://c.example.com
    status: plan
    certificate_file: ../tajne.pdf
  - id: c6
    title: Data przy statusie plan
    url: https://e.example.com
    status: plan
    completed: 2026-03-01
  - id: c5
    title: Zła data i zły link certyfikatu
    url: https://d.example.com
    status: w-trakcie
    completed: kiedyś
    certificate_url: ftp://x.example.com
`;

const stored = () => parseYamlList(vault.read(FILE)!, "courses").items;

describe("readCourses", () => {
  it("brak pliku = pusta lista", () => {
    expect(readCourses()).toEqual({ courses: [], skipped: 0 });
  });

  it("mapuje poprawne wpisy i liczy pominięte (brak statusu, zły url, zła ścieżka)", () => {
    vault.write(FILE, HAND_WRITTEN);
    const { courses, skipped } = readCourses();
    expect(skipped).toBe(3);
    expect(courses.map((c) => c.id)).toEqual(["c1", "c6", "c5"]);
    expect(courses[0]).toEqual({
      id: "c1",
      title: "Kurs MCP",
      url: "https://a.example.com",
      provider: "Udemy",
      status: "ukonczony",
      completed: "2026-03-01",
      certificateUrl: "https://a.example.com/cert",
      certificateFile: "certyfikaty/mcp.pdf",
      note: "Ręczna notatka",
    });
  });

  it("completed bez statusu ukonczony jest odrzucane (niezmiennik K3 przy ręcznej edycji)", () => {
    vault.write(FILE, HAND_WRITTEN);
    expect(readCourses().courses.find((c) => c.id === "c6")!.completed).toBeUndefined();
  });

  it("zła data i zły link certyfikatu odrzuca tylko pole, wpis zostaje", () => {
    vault.write(FILE, HAND_WRITTEN);
    const c5 = readCourses().courses.find((c) => c.id === "c5")!;
    expect(c5.completed).toBeUndefined();
    expect(c5.certificateUrl).toBeUndefined();
    expect(c5.status).toBe("w-trakcie");
  });
});

describe("insertCourse", () => {
  it("dopisuje wpis z wygenerowanym id i pomija puste pola", async () => {
    const course = await insertCourse({
      title: "Nowy",
      url: "https://n.example.com",
      status: "plan",
    });
    expect(course.id).toMatch(/^[A-Za-z0-9]{20}$/);
    const [item] = stored();
    expect(item).toMatchObject({ title: "Nowy", url: "https://n.example.com", status: "plan" });
    expect("provider" in item).toBe(false);
    expect("completed" in item).toBe(false);
  });
});

describe("replaceCourse", () => {
  it("zastępuje pola edytowalne, puste kasuje, nieznane klucze zostają", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await replaceCourse("c1", {
      title: "Kurs MCP 2",
      url: "https://a.example.com",
      status: "plan",
    });
    const item = stored().find((i) => i.id === "c1")!;
    expect(item.title).toBe("Kurs MCP 2");
    expect(item.status).toBe("plan");
    for (const key of ["provider", "completed", "certificate_url", "certificate_file", "note"]) {
      expect(key in item).toBe(false);
    }
    expect(item.x_extra).toBe("zostaje");
    expect(stored()).toHaveLength(6); // pominięte wpisy przeżywają zapis
  });

  it("nieistniejące id to DomainError 404", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await expect(
      replaceCourse("brak", { title: "T", url: "https://a.example.com", status: "plan" })
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      replaceCourse("brak", { title: "T", url: "https://a.example.com", status: "plan" })
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("removeCourse", () => {
  it("usuwa wpis; brak wpisu nie zmienia pliku", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await removeCourse("c1");
    expect(stored().map((i) => i.id)).toEqual(["c2", "c3", "c4", "c6", "c5"]);
    const before = vault.read(FILE);
    await removeCourse("brak");
    expect(vault.read(FILE)).toBe(before);
  });
});

describe("certificateExists", () => {
  it("sprawdza plik w Documents/", () => {
    vault.write("Documents/certyfikaty/mcp.pdf", "x");
    expect(certificateExists("certyfikaty/mcp.pdf")).toBe(true);
    expect(certificateExists("certyfikaty/brak.pdf")).toBe(false);
  });
});
