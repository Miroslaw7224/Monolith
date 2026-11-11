# CLAUDE.md

Second Brain (Next.js 14) wchodzi w skład ekosystemu NEXUS: vault Markdown/YAML w `~/projects/NEXUS/`
(źródło prawdy o projektach). Kierunek: lokalny asystent pracy,
zob. `docs/superpowers/specs/2026-11-11-asystent-lokalny-nexus-design.md`.
Kod projektów wolno tylko czytać; zapisy aplikacji idą wyłącznie do `Vault/`.

## Współpraca z agentem `agy` (herdr)

Sesje Claude Code i `agy` (Antigravity CLI) działają w osobnych panelach herdr tego samego workspace.

- Do rozmowy z działającym `agy` służy `scripts/agy-ask.sh "<prompt>"` albo komenda `/agy <zadanie>`.
  Skrypt sam znajduje panel agenta `agy`, czeka na koniec tury i wypisuje odpowiedź.
- NIE uruchamiaj `agy -p ...` przez Basha: to osobny proces bez kontekstu sesji użytkownika.
- `agy` nie widzi mojej rozmowy. W prompcie podawaj ścieżki, cel i ograniczenia.
- Jeśli `agy` jest `blocked` (czeka na zgodę), nie zatwierdzaj za użytkownika; poproś go o kliknięcie w jego panelu.
- Podział ról (propozycja): Claude implementuje, `agy` robi niezależne review / szuka w repo; nie edytujemy
  równolegle tych samych plików.
- Bezpośrednie komendy herdr: `herdr agent list`, `herdr agent prompt <pane> "..." --wait`,
  `herdr agent read <pane>`, `herdr agent wait <pane>`.
