// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { WINDOWS_SCRIPT, POWERSHELL_PATH, listWindowsListeners } from "@/lib/ports/windows";

describe("listWindowsListeners", () => {
  it("woła PowerShell ze stałą ścieżką i skryptem", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, stdout: "[]" });
    const r = await listWindowsListeners({ run });
    expect(run).toHaveBeenCalledWith(
      POWERSHELL_PATH,
      ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_SCRIPT],
      8000
    );
    expect(r).toEqual({ ok: true, listeners: [] });
  });

  it("skrypt jest stałą bez cudzysłowów i kończy się ConvertTo-Json", () => {
    expect(WINDOWS_SCRIPT).not.toContain('"');
    expect(WINDOWS_SCRIPT).toMatch(/ConvertTo-Json -InputObject \$rows -Compress$/);
  });

  it("brak powershell.exe to missing", async () => {
    const run = vi.fn().mockResolvedValue({ ok: false, reason: "missing" });
    expect(await listWindowsListeners({ run })).toEqual({ ok: false, reason: "missing" });
  });

  it("niepoprawny JSON to error", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, stdout: "{nie json" });
    expect(await listWindowsListeners({ run })).toEqual({ ok: false, reason: "error" });
  });
});
