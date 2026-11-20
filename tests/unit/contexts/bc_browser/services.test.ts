// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as BrowserRepo from "@/contexts/bc_browser/repositories";
import { DomainError } from "@/lib/errors";

const mockOpen = vi.hoisted(() => vi.fn<typeof BrowserRepo.openUrlInChrome>());
vi.mock(
  "@/contexts/bc_browser/repositories",
  () =>
    ({
      openUrlInChrome: mockOpen,
    }) satisfies Partial<typeof BrowserRepo>
);

import { normalizeHttpUrl, openInChrome } from "@/contexts/bc_browser/services";

beforeEach(() => {
  mockOpen.mockReset();
});

describe("normalizeHttpUrl", () => {
  it("przepuszcza http i https i normalizuje", () => {
    expect(normalizeHttpUrl(" https://example.com/a b ")).toBe("https://example.com/a%20b");
    expect(normalizeHttpUrl("http://localhost:3000")).toBe("http://localhost:3000/");
  });
  it.each(["javascript:alert(1)", "file:///etc/passwd", "--new-window", "", "ftp://x.pl"])(
    "odrzuca %s",
    (raw) => {
      expect(() => normalizeHttpUrl(raw)).toThrow(DomainError);
    }
  );
});

describe("openInChrome", () => {
  it("woła repozytorium ze znormalizowanym adresem", async () => {
    mockOpen.mockResolvedValue({ ok: true });
    await openInChrome("https://example.com");
    expect(mockOpen).toHaveBeenCalledWith("https://example.com/");
  });
  it("nie woła repozytorium dla złego adresu", async () => {
    await expect(openInChrome("javascript:1")).rejects.toThrow(DomainError);
    expect(mockOpen).not.toHaveBeenCalled();
  });
  it("brak Chrome → błąd 502", async () => {
    mockOpen.mockResolvedValue({ ok: false, reason: "missing" });
    await expect(openInChrome("https://example.com")).rejects.toMatchObject({ statusCode: 502 });
  });
});
