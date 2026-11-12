// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatFrontmatter, parseFrontmatter } from "@/lib/nexus/frontmatter";

describe("formatFrontmatter / parseFrontmatter", () => {
  it("składa --- yaml --- pustą linię i treść zakończoną jednym \\n", () => {
    const out = formatFrontmatter({ id: "n1", title: "A: b", tags: [] }, "Treść\n\n");
    expect(out.startsWith("---\n")).toBe(true);
    expect(out.endsWith("Treść\n")).toBe(true);
    expect(out.endsWith("Treść\n\n")).toBe(false);
    expect(out).toMatch(/\n---\n\nTreść\n$/);
  });

  it("round-trip zachowuje meta (id jako tekst) i treść", () => {
    const meta = {
      id: "1",
      title: "Zażółć: [x] # y",
      created: "2026-05-01T10:00:00.000Z",
      tags: ["a", "b"],
    };
    const parsed = parseFrontmatter(formatFrontmatter(meta, "Treść"));
    expect(parsed).toEqual({ meta, body: "Treść\n" });
    expect(typeof parsed!.meta.id).toBe("string");
  });

  it("pusta treść ma jawny kształt: --- yaml --- + pusta linia + pusta treść + \\n", () => {
    const out = formatFrontmatter({ id: "n1" }, "");
    expect(out).toBe("---\nid: n1\n---\n\n\n");
    expect(parseFrontmatter(out)).toEqual({ meta: { id: "n1" }, body: "\n" });
  });

  it("tekst bez frontmattera daje null", () => {
    expect(parseFrontmatter("# Nagłówek")).toBeNull();
  });

  it("frontmatter niebędący mapą daje null", () => {
    expect(parseFrontmatter("---\n- a\n---\n")).toBeNull();
  });

  it("uszkodzony YAML daje null", () => {
    expect(parseFrontmatter("---\na: [1, 2\nb: : :\n---\ntreść\n")).toBeNull();
  });

  it("parsuje plik z \\r\\n", () => {
    const parsed = parseFrontmatter("---\r\nid: n1\r\ntitle: T\r\n---\r\n\r\nTreść\r\n");
    expect(parsed).not.toBeNull();
    expect(parsed!.meta).toEqual({ id: "n1", title: "T" });
    expect(parsed!.body.trim()).toBe("Treść");
  });

  it("pomija undefined w meta", () => {
    const out = formatFrontmatter({ id: "n1", gone: undefined }, "x");
    expect(out).not.toContain("gone");
    expect(parseFrontmatter(out)!.meta).toEqual({ id: "n1" });
  });
});
