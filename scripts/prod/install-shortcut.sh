#!/usr/bin/env bash
# Kopiuje ikonę i skrypt .ps1 do %LOCALAPPDATA%\Monolith i tworzy skrót Monolith.lnk na pulpicie.
# Uruchamiaj z worktree prod (ścieżka tego katalogu trafia do skrótu).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PS="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
DISTRO="${WSL_DISTRO_NAME:-Ubuntu}"

LAD="$("$PS" -NoProfile -Command '[Environment]::GetFolderPath("LocalApplicationData")' | tr -d '\r')"
LAD_WSL="$(wslpath -u "$LAD")"
mkdir -p "$LAD_WSL/Monolith"
cp "$ROOT/scripts/prod/monolith.ico" "$LAD_WSL/Monolith/monolith.ico"
# .ps1 uruchamiamy z dysku lokalnego (ścieżki UNC wsl.localhost bywają blokowane przez politykę wykonywania).
cp "$ROOT/scripts/prod/install-shortcut.ps1" "$LAD_WSL/Monolith/install-shortcut.ps1"

"$PS" -NoProfile -ExecutionPolicy Bypass -File "$LAD\\Monolith\\install-shortcut.ps1" \
  -Distro "$DISTRO" -IconPath "$LAD\\Monolith\\monolith.ico" -ProdDir "$ROOT"
