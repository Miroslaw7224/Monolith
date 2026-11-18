import { describe, expect, it } from "vitest";
import { externalHttpUrl } from "@/src/lib/openExternal";

const O = "http://127.0.0.1:3101";

describe("externalHttpUrl", () => {
  it("zewnętrzny https", () => {
    expect(externalHttpUrl("https://example.com/a", O)).toBe("https://example.com/a");
  });
  it.each(["/dashboard", "http://127.0.0.1:3101/x", "mailto:a@b.pl", "javascript:1", "#x"])(
    "pomija %s",
    (h) => {
      expect(externalHttpUrl(h, O)).toBeNull();
    }
  );
});
