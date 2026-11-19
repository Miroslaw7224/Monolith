#!/usr/bin/env python3
"""Co zrobić po timeoucie `ask-helper.sh --collect` (spec 3.8).

Wejście (JSON, stdin): {"collects": int, "nudged": bool, "screen": str, "screen_prev": str}
  collects     liczba dotychczasowych prób `--collect` (łącznie z bieżącą, już po timeoucie)
  nudged       zapytanie kontrolne już wysłano
  screen       ekran pomocnika teraz; screen_prev: ekran na końcu poprzedniego `--collect`
Wyjście (jedno słowo):
  ASK_USER   dialog zgody na ekranie: pyta człowiek
  COLLECT    pracuje albo za wcześnie na zapytanie kontrolne: wywołaj --collect ponownie
  NUDGE      wyślij jedno zapytanie kontrolne o wynik
  REPORT     zapytanie kontrolne poszło, wyniku brak: raport dla użytkownika
Kolejność reguł: zgoda -> praca -> nudged -> collects < 3 -> ekran bez zmian -> COLLECT.
"""
import json
import re
import sys

APPROVAL_RE = re.compile(r"Requesting permission|Allow this|Run this command\?|\(y/n\)", re.I)
WORKING_RE = re.compile(r"Running|ctrl\+c to stop|esc to cancel")


def tail(text, n):
    return "\n".join((text or "").splitlines()[-n:])


def decide(d):
    screen = d.get("screen") or ""
    if APPROVAL_RE.search(tail(screen, 25)):
        return "ASK_USER"
    if WORKING_RE.search(tail(screen, 12)):
        return "COLLECT"
    if d.get("nudged"):
        return "REPORT"
    if int(d.get("collects", 0)) < 3:
        return "COLLECT"
    if screen == (d.get("screen_prev") or ""):
        return "NUDGE"
    return "COLLECT"


def main():
    try:
        data = json.load(sys.stdin)
        if not isinstance(data, dict):
            raise ValueError("oczekiwano obiektu JSON")
        print(decide(data))
    except (ValueError, TypeError) as exc:
        print(f"collect-decide.py: niepoprawne wejście: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
