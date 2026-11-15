// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isHttpUrl, isSafeCertificatePath } from "@/lib/schema/course-fields";
import { CourseInputSchema, toCourseDto } from "@/contexts/bc_arsenal/schemas";

describe("isHttpUrl", () => {
  it.each([
    ["https://a.example.com/x", true],
    ["http://a.example.com", true],
    ["javascript:alert(1)", false],
    ["ftp://a.example.com", false],
    ["a.example.com", false],
    ["", false],
  ])("%s → %s", (value, expected) => {
    expect(isHttpUrl(value)).toBe(expected);
  });
});

describe("isSafeCertificatePath", () => {
  it.each([
    ["mcp.pdf", true],
    ["certyfikaty/mcp.pdf", true],
    ["", false],
    ["/etc/passwd", false],
    ["../x.pdf", false],
    ["a/../x.pdf", false],
    ["a//x.pdf", false],
    ["./x.pdf", false],
    ["a/", false],
    ["a\\x.pdf", false],
    ["C:/x.pdf", false],
    ["x\0.pdf", false],
  ])("%j → %s", (value, expected) => {
    expect(isSafeCertificatePath(value)).toBe(expected);
  });
});

const base = { title: "  Kurs MCP ", url: "https://a.example.com", status: "plan" as const };

describe("CourseInputSchema", () => {
  it("przycina teksty, puste pola opcjonalne zamienia na undefined", () => {
    const parsed = CourseInputSchema.parse({ ...base, provider: "  ", note: " uwaga " });
    expect(parsed.title).toBe("Kurs MCP");
    expect(parsed.provider).toBeUndefined();
    expect(parsed.note).toBe("uwaga");
  });

  it("odrzuca pusty tytuł i url spoza http(s)", () => {
    expect(CourseInputSchema.safeParse({ ...base, title: " " }).success).toBe(false);
    expect(CourseInputSchema.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(
      false
    );
    expect(
      CourseInputSchema.safeParse({ ...base, certificateUrl: "ftp://x.example.com" }).success
    ).toBe(false);
  });

  it("odrzuca nieznany status, złą ścieżkę certyfikatu i złą datę", () => {
    expect(CourseInputSchema.safeParse({ ...base, status: "x" }).success).toBe(false);
    expect(CourseInputSchema.safeParse({ ...base, certificateFile: "../x.pdf" }).success).toBe(
      false
    );
    expect(CourseInputSchema.safeParse({ ...base, completed: "2026-02-31" }).success).toBe(false);
  });
});

describe("toCourseDto", () => {
  it("pomija nieustawione pola opcjonalne", () => {
    const dto = toCourseDto({
      id: "c1",
      title: "T",
      url: "https://a.example.com",
      status: "plan",
      certificateMissing: false,
    });
    expect(dto).toEqual({
      id: "c1",
      title: "T",
      url: "https://a.example.com",
      status: "plan",
      certificateMissing: false,
    });
  });
});
