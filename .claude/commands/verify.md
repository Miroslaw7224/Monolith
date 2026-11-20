---
description: Zweryfikuj zmiany: tsc + vitest + lint przez cursora
argument-hint: [build] [ścieżki testów]
allowed-tools: Bash(scripts/ask-helper.sh *), Bash(scripts/helpers.sh *)
---

Zweryfikuj bieżące zmiany w Monolith przez pomocnika `cursor` (zasady z CLAUDE.md: testy, lint i typecheck idą do cursora, nie do mnie) i zdaj relację.

Argumenty: $ARGUMENTS

Co sprawdzam:

- zawsze: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`;
- argument `build` dodaje `npm run build` (uwaga: zapisuje `.next/`, a na porcie 3100 może działać `npm run dev`; uprzedź o tym użytkownika, zanim uruchomisz);
- argumenty będące ścieżkami testów zawężają vitest do `npx vitest run <ścieżki>` (`tsc` i `lint` zostają).

Wywołanie (jedno, z `--timeout 600`; `--approve-allowed` zatwierdza WYŁĄCZNIE dokładne polecenia z listy zgód z CLAUDE.md):

```bash
scripts/ask-helper.sh --role task --tier light --fresh --approve-allowed --timeout 600 cursor "<prompt>"
```

Prompt (podstaw polecenia zgodnie z argumentami, bez żadnych innych flag):

> Uruchom kolejno, każde OSOBNO i dokładnie w tej postaci (bez `cd`, bez flag, bez pipe, bez przekierowań poza `2>&1`):
>
> 1. `npx tsc --noEmit 2>&1`
> 2. `npx vitest run [ścieżki] 2>&1`
> 3. `npm run lint 2>&1`
> 4. (tylko gdy użytkownik podał `build`) `npm run build 2>&1`
>
> Niczego nie edytuj, niczego nie naprawiaj, nie uruchamiaj nic poza tą listą. Odpowiedź: gdy wszystko przeszło, jedna linia
> `PRZESZŁO: tsc, vitest (N testów), lint` (z `build`, jeśli był); w przeciwnym razie dla każdego etapu, który nie przeszedł, lista
> `plik:linia — przyczyna` (maks. 30 pozycji). Zakończ linią `GOTOWE: …` albo `UTKNĄŁEM: …`.

Obsługa kodu wyjścia `ask-helper.sh`:

| Kod | Co robię                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Zdaję relację. „Przeszło” mówię tylko wtedy, gdy w `PRZESZŁO` są wszystkie wymagane pozycje (tsc, vitest, lint, a z `build` także build); inaczej czytam panel (`hc read cursor-monolith`) |
| 1   | Nie ma sesji cursora: proszę użytkownika o `open-agent cursor` w panelu, czekam na potwierdzenie i raz ponawiam                                                                            |
| 2   | Cursor czeka na zgodę na polecenie spoza listy. Mówię użytkownikowi, niczego nie zatwierdzam                                                                                               |
| 3   | Nie uznaję za zielone. `scripts/ask-helper.sh --collect cursor` powtarzam, aż kod będzie ≠ 3 (najwyżej 6 wywołań); nie wysyłam zadania drugi raz                                           |
| 4   | Cursor nie odpowiedział nawet na zapytanie kontrolne: pokazuję użytkownikowi ostatnie linie panelu ze stderr i niczego nie uznaję za zielone                                               |

`/verify` uzupełnia skill `verification-before-completion` (dostarcza dowód), nie zastępuje go. Wynik cursora traktuję jak hipotezę: przy czerwonym wyniku
sprawdzam wskazane `plik:linia` w kodzie, zanim cokolwiek zmienię.
