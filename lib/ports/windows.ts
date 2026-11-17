import { parseWindowsJson } from "./parse-windows";
import { runCommand, type RunFn } from "./run";
import type { SourceResult } from "./types";

export const POWERSHELL_PATH = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";

/** Stały skrypt (bez danych od użytkownika, bez cudzysłowów). Zawsze zwraca tablicę JSON. */
export const WINDOWS_SCRIPT = [
  "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
  "$cmd = @{}",
  "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object { $cmd[[int]$_.ProcessId] = $_.CommandLine }",
  "$proc = @{}",
  "Get-Process -ErrorAction SilentlyContinue | ForEach-Object { $proc[[int]$_.Id] = $_ }",
  "$rows = @(Get-NetTCPConnection -State Listen | ForEach-Object { $p = $proc[[int]$_.OwningProcess]; [pscustomobject]@{ LocalAddress = $_.LocalAddress; LocalPort = $_.LocalPort; OwningProcess = $_.OwningProcess; Name = $p.ProcessName; Path = $p.Path; CommandLine = $cmd[[int]$_.OwningProcess] } })",
  "ConvertTo-Json -InputObject $rows -Compress",
].join("; ");

export interface WindowsDeps {
  run: RunFn;
}

/** Porty LISTEN w Windows przez interop WSL. Nigdy nie rzuca. */
export async function listWindowsListeners(
  deps: WindowsDeps = { run: runCommand }
): Promise<SourceResult> {
  const res = await deps.run(
    POWERSHELL_PATH,
    ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_SCRIPT],
    8000
  );
  if (!res.ok) return { ok: false, reason: res.reason };
  try {
    return { ok: true, listeners: parseWindowsJson(res.stdout) };
  } catch {
    return { ok: false, reason: "error" };
  }
}
