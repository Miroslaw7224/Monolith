#!/usr/bin/env python3
"""Decyzja, czy dialog zgody w panelu pomocnika (cursor) wolno zatwierdzić automatycznie.

Użycie: approve-check.py <katalog-monolith> < ekran-panelu
Wejście: tekst ekranu z `hc read`. Wyjście (jedna linia):
  NONE                    brak dialogu "Run this command?" (nic do zatwierdzenia)
  ALLOW <polecenie>       polecenie dokładnie z listy zgód z CLAUDE.md
  DENY <powód>: <polecenie>  wszystko inne: zatwierdza człowiek

Lista zgód (CLAUDE.md, "Zgoda użytkownika 2026-11-13"): wyłącznie
  npx tsc --noEmit | npx vitest run [ścieżki] | npm run lint | npm run build,
opcjonalnie z prefiksem `cd <Monolith> && ` i sufiksem ` 2>&1`.
Żadnych flag, pipe'ów, przekierowań (poza 2>&1), podstawień ani łańcuchów.
"""
import re
import sys

root = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else ""
screen = sys.stdin.read()
lines = screen.splitlines()

run_idx = max((i for i, l in enumerate(lines) if "Run this command?" in l), default=-1)
if run_idx < 0:
    print("NONE")
    sys.exit(0)

# Linia dialogu: dokładnie " $  <polecenie>" (jedna spacja przed $, dwie po); historia ma "  $ <polecenie>".
start = next(
    (i for i in range(run_idx - 1, -1, -1) if re.match(r"^ \$  \S", lines[i])), -1
)
if start < 0:
    print("DENY brak polecenia w dialogu: ")
    sys.exit(0)

parts = [lines[start][4:].strip()] + [l.strip() for l in lines[start + 1 : run_idx] if l.strip()]
command = " ".join(parts)
command = re.sub(r"\s+in\s+\.$", "", command)  # sufiks z katalogiem roboczym

TOKEN = r"(?!-)[A-Za-z0-9_./\[\]@-]+"  # ścieżka testu; bez flag (nie zaczyna się od '-')
CMDS = [
    r"npx tsc --noEmit",
    r"npm run lint",
    r"npm run build",
    rf"npx vitest run(?: {TOKEN})*",
]
pattern = re.compile(
    r"^(?:cd " + re.escape(root) + r" && )?(?:" + "|".join(CMDS) + r")(?: 2>&1)?$"
)

if root and pattern.match(command):
    print(f"ALLOW {command}")
else:
    print(f"DENY poza listą zgód: {command}")
