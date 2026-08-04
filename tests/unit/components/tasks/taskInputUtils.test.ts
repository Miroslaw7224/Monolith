import { describe, expect, it } from "vitest";
import {
  isHttpUrl,
  matchTaskSearch,
  normalizeUrl,
  parseTaskInput,
} from "@/src/components/tasks/taskInputUtils";

describe("parseTaskInput", () => {
  it("uses first line as title and second as description", () => {
    expect(parseTaskInput("Review dla Jacka\nhttps://github.com/org/repo/pull/471")).toEqual({
      title: "Review dla Jacka",
      description: "https://github.com/org/repo/pull/471",
    });
  });

  it("ignores empty lines", () => {
    expect(parseTaskInput("  Tytuł  \n\n  https://example.com  ")).toEqual({
      title: "Tytuł",
      description: "https://example.com",
    });
  });

  it("returns empty title for blank input", () => {
    expect(parseTaskInput("   \n  ")).toEqual({ title: "", description: "" });
  });
});

describe("isHttpUrl", () => {
  it("accepts https URLs", () => {
    expect(isHttpUrl("https://github.com/org/repo/pull/471")).toBe(true);
  });

  it("accepts URLs without protocol", () => {
    expect(isHttpUrl("github.com/org/repo/pull/471")).toBe(true);
  });

  it("rejects plain text", () => {
    expect(isHttpUrl("not a link")).toBe(false);
  });
});

describe("normalizeUrl", () => {
  it("adds https when missing", () => {
    expect(normalizeUrl("example.com/path")).toBe("https://example.com/path");
  });

  it("keeps existing protocol", () => {
    expect(normalizeUrl("http://localhost:3100")).toBe("http://localhost:3100");
  });
});

describe("matchTaskSearch", () => {
  const task = {
    title: "Review dla Jacka",
    description: "https://github.com/org/repo/pull/471",
  };

  it("matches empty query", () => {
    expect(matchTaskSearch(task, "")).toBe(true);
    expect(matchTaskSearch(task, "   ")).toBe(true);
  });

  it("matches single word in title", () => {
    expect(matchTaskSearch(task, "jacka")).toBe(true);
    expect(matchTaskSearch(task, "Review")).toBe(true);
  });

  it("matches word in description/link", () => {
    expect(matchTaskSearch(task, "github")).toBe(true);
    expect(matchTaskSearch(task, "471")).toBe(true);
  });

  it("matches multiple words across title and description", () => {
    expect(matchTaskSearch(task, "review jacka")).toBe(true);
    expect(matchTaskSearch(task, "jacka github")).toBe(true);
  });

  it("rejects when a word is missing", () => {
    expect(matchTaskSearch(task, "review rafał")).toBe(false);
  });
});
