#!/usr/bin/env python3
"""Decyzja, których pomocników (agy / cursor) wolno zatwierdzić do zakończenia (`helpers.sh down`).

Użycie: helpers-check.py < wejście.json
Wejście (JSON, stdin):
  now_ms, idle_min, force, slug, terminals: [
    {address, name|null, state, status|null, idle_since_ms, screen_changed_ms, screen}
  ]
Wyjście: jedna linia na terminal, w kolejności wejścia:
  KILL <nazwa>
  SKIP <nazwa-lub-adres>: <powód>
Kod wyjścia 0; niepoprawne wejście: kod 2 i komunikat na stderr.

Kolejność reguł (spec 3.3): nazwa -> state -> zgoda -> praca -> próg czasu -> osłona ekranu.
--force (pole `force`) pomija wyłącznie próg czasu.
"""
import json
import re
import sys

APPROVAL_RE = re.compile(r"Requesting permission|Allow this|Run this command\?|\(y/n\)", re.I)
WORKING_RE = re.compile(r"Running|ctrl\+c to stop|esc to cancel")
ROLES = ("agy", "cursor")
SCREEN_GUARD_MS = 60_000


def tail(text, n):
    return "\n".join((text or "").splitlines()[-n:])


def decide(term, cfg):
    name = term.get("name")
    label = name or term.get("address") or "?"

    # 1) nazwa
    if not name:
        return f"SKIP {label}: bez nazwy"
    role = next((r for r in ROLES if name.startswith(r + "-")), None)
    if role is None:
        return f"SKIP {label}: nie pomocnik"
    if name != f"{role}-{cfg['slug']}"[:32]:
        return f"SKIP {label}: inny projekt"

    # 2) stan terminala
    if term.get("state") != "live":
        return f"SKIP {label}: nie działa"

    status = term.get("status")
    screen = term.get("screen") or ""

    # 3) czeka na zgodę
    if status == "blocked" or APPROVAL_RE.search(tail(screen, 25)):
        return f"SKIP {label}: czeka na zgodę"

    # 4) pracuje: status inny niż idle/done (working, starting…) liczy się jak praca; bez statusu decyduje ekran
    if (status and status not in ("idle", "done")) or (not status and WORKING_RE.search(tail(screen, 12))):
        return f"SKIP {label}: pracuje"

    now = cfg["now_ms"]
    # 5) próg bezczynności (pomija --force)
    if not cfg["force"]:
        idle_min = max(0, (now - term["idle_since_ms"]) // 60_000)
        if (now - term["idle_since_ms"]) / 60_000 < cfg["idle_min"]:
            return f"SKIP {label}: bezczynny {int(idle_min)} min < {cfg['idle_min']}"

    # 6) osłona okna między `hc send` a zmianą statusu na working
    if now - term["screen_changed_ms"] < SCREEN_GUARD_MS:
        return f"SKIP {label}: ekran zmienił się w ostatniej minucie"

    return f"KILL {name}"


def main():
    try:
        data = json.load(sys.stdin)
        cfg = {
            "now_ms": int(data["now_ms"]),
            "idle_min": int(data["idle_min"]),
            "force": bool(data.get("force", False)),
            "slug": str(data["slug"]),
        }
        terminals = list(data["terminals"])
        out = [decide(t, cfg) for t in terminals]
    except (ValueError, KeyError, TypeError) as exc:
        print(f"helpers-check.py: niepoprawne wejście: {exc}", file=sys.stderr)
        return 2
    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
