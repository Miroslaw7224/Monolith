# Pomiary: aplikacja desktopowa

Komenda: `bash scripts/prod/measure.sh` (build do `.next-measure`, port 3199).

## Przed zmianami (stan bazowy)

```text
build: 502 s
--- trasy (bez /api) ---
Route (app)                              Size     First Load JS
┌ ○ /                                    138 B          87.8 kB
├ ○ /_not-found                          880 B          88.6 kB
├ ○ /apple-icon.png                      0 B                0 B
├ ○ /dashboard                           302 kB          436 kB
├ ○ /icon.svg                            0 B                0 B
└ ○ /notes                               287 B            88 kB
+ First Load JS shared by all            87.7 kB
  ├ chunks/117-78272dc9202b17a6.js       31.9 kB
  ├ chunks/fd9d1056-7d140f8347ed4914.js  53.7 kB
  └ other shared chunks (total)          2.13 kB


ƒ Middleware                             26.7 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

zimny start do pierwszej odpowiedzi /dashboard: 518 ms
GET /api/cockpit #1: 0.205791 s (TTFB)
GET /api/cockpit #2: 0.084844 s (TTFB)
GET /api/cockpit #3: 0.067573 s (TTFB)
GET /dashboard (rozgrzany): 0.006450 s (TTFB)
```

Warstwa 3 (async git/hc w `getCockpit`): niepotrzebna (TTFB `/api/cockpit` po rozgrzaniu 68-85 ms, poniżej progu 300 ms).

Uwaga: build trwa ok. 8 minut (502 s), więc rebuild po zmianie `main` jest kosztowny; start bez zmian pomija build.

## Po lazy loadingu

```text
build: 34 s
--- trasy (bez /api) ---
Route (app)                              Size     First Load JS
┌ ○ /                                    138 B          88.5 kB
├ ○ /_not-found                          880 B          89.2 kB
├ ○ /apple-icon.png                      0 B                0 B
├ ○ /dashboard                           70.6 kB         205 kB
├ ○ /icon.svg                            0 B                0 B
└ ○ /notes                               287 B          88.6 kB
+ First Load JS shared by all            88.4 kB
  ├ chunks/117-78272dc9202b17a6.js       31.9 kB
  ├ chunks/fd9d1056-7d140f8347ed4914.js  53.7 kB
  └ other shared chunks (total)          2.8 kB


ƒ Middleware                             26.7 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

zimny start do pierwszej odpowiedzi /dashboard: 390 ms
GET /api/cockpit #1: 0.111729 s (TTFB)
GET /api/cockpit #2: 0.064776 s (TTFB)
GET /api/cockpit #3: 0.056529 s (TTFB)
GET /dashboard (rozgrzany): 0.005673 s (TTFB)
```

`/dashboard`: First Load JS 436 kB -> 205 kB (rozmiar trasy 302 kB -> 70,6 kB); zimny start 518 -> 390 ms.
Czas builda 502 s -> 34 s **nie jest porównywalny**: pomiar bazowy był pierwszym buildem (zimny cache webpacka), pomiar po zmianie korzystał z cache. Realny czas pierwszego builda w worktree prod to ok. 8 minut.
