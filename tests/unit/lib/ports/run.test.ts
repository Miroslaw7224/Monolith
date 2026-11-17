// @vitest-environment node
import { describe, expect, it } from "vitest";
import { runCommand } from "@/lib/ports/run";

describe("runCommand", () => {
  it("zwraca stdout", async () => {
    const r = await runCommand(process.execPath, ["-e", "process.stdout.write('ok')"], 5000);
    expect(r).toEqual({ ok: true, stdout: "ok" });
  });

  it("brak programu to missing", async () => {
    const r = await runCommand("/nie/ma/takiego-programu", [], 5000);
    expect(r).toEqual({ ok: false, reason: "missing" });
  });

  it("przekroczenie czasu to timeout", async () => {
    const r = await runCommand(process.execPath, ["-e", "setTimeout(()=>{},5000)"], 150);
    expect(r).toEqual({ ok: false, reason: "timeout" });
  });

  it("kod wyjścia ≠ 0 to error", async () => {
    const r = await runCommand(process.execPath, ["-e", "process.exit(3)"], 5000);
    expect(r).toEqual({ ok: false, reason: "error" });
  });
});
