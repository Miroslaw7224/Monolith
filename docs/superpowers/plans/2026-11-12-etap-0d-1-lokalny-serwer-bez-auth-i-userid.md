# Etap 0d-1: zabezpieczenie lokalnego serwera, usunięcie auth i `userId` z warstwy serwerowej

> **Dla wykonawcy:** REQUIRED SUB-SKILL: superpowers:executing-plans. Kroki mają checkboxy (`- [ ]`). Komendy testów, tsc, lint i build uruchamia `cursor` (`scripts/ask-helper.sh --role task`, w prompcie „nie edytuj plików”, wynik: „przeszło” albo lista `plik:linia + przyczyna`). Review diffa robi `agy --role review`.

**Cel:** po tym podkroku serwer nasłuchuje tylko na `127.0.0.1`, odrzuca obce `Host` i obce żądania zmieniające stan (middleware), a żaden route handler, serwis ani repozytorium nie zna ani auth, ani `userId`. Aplikacja nadal działa (klient dalej loguje się Firebase, ale serwer ignoruje token).

**Architektura:** (A) czysta logika strażnika w `lib/localGuard.ts` + cienkie `middleware.ts` + flagi `-H 127.0.0.1`; (B) usunięcie `userId` plasterkami po kolekcjach (repo → serwis → route → testy w jednym commicie, `tsc` zielony po każdym), na końcu test statyczny pilnujący, że `userId` nie wraca.

**Stos:** Next 14.2 (middleware w katalogu głównym, bo `app/` jest w głównym), Vitest, TypeScript.

**Stan wyjściowy (main po PR #14):** `tsc` czysty, `lint` 3 ostrzeżenia `react-hooks` (`TaskTemplatesModal.tsx:73`, `BoardCanvas.tsx:253`, `BoardCanvas.tsx:279`), 822 testy w 109 plikach, `build` przechodzi.

---

## Decyzje

- **D1. Podział 0d.** Spec §7 wrzuca do 0d wszystko naraz. Dzielimy: **0d-1** (ten plan: zabezpieczenie + serwer bez auth/`userId`) i **0d-2** (klient: `App.tsx`, logowanie, `(protected)`, landing, strony prawne, `app/page.tsx`; usunięcie waitlisty, `getAuth.ts`, `api/auth`; pakiet `firebase`; e2e; `.env.example`; `docker-compose-test.yml`, `firebase.json`, `firestore.rules`; ADR i README). Plan 0d-2 powstanie po zmergowaniu 0d-1 (kod się zmieni).
- **D2. Aplikacja działa między 0d-1 a 0d-2.** W 0d-1 **nie ruszamy** `app/api/waitlist/*`, `app/api/auth/me`, `lib/getAuth.ts`, `lib/waitlistCheckEmail.ts`, `lib/firebase-admin.ts` ani klienta. Klient dalej loguje się przez Firebase i woła `/api/waitlist/check` (które nadal weryfikuje token), a pozostałe route'y po prostu przestają sprawdzać `Authorization`. Dzięki temu po każdym commicie aplikację da się uruchomić.
- **D3. `firebase-admin`, `lib/firebase-admin.ts` i `scripts/export-firestore/` zostają do 0e.** Spec §7 0d każe usunąć `firebase-admin`, ale `--verify` zrzutu (bramka 0e krok 1) i ewentualny ponowny eksport potrzebują go, a zrzut jest jedyną siatką bezpieczeństwa przed usunięciem projektu Firebase. Usuwamy go więc dopiero po bramce 0e. Kryterium „bez pakietów Firebase” dotyczy końca całego etapu 0, nie 0d. Do zapisania w specu (Task 12).
- **D4. Strażnik lokalny nie dotyka klienta.** Przeglądarka przy `fetch` na ten sam origin sama wysyła `Origin` i `Sec-Fetch-Site: same-origin`, więc kod UI nie wymaga zmian. Narzędzia spoza przeglądarki (curl, skrypty) wysyłają `X-Nexus-Client: 1`.
- **D5. Jeden użytkownik = brak parametru.** `userId` znika z sygnatur (nie „stała lokalna”): `getTasks()`, `createNote(data)` itd. Znika też `ensureOwnMap` w `mindMapService` (jedyny właściciel) i pole `userId` z `NoteResourceRecord` i `MindMap`.
- **D6. Klient bez zmian w 0d-1.** `user.id` w UI (`activeSession`, `boardViewport`, `BoardTab userId`) to klucz `localStorage`, nie parametr serwera; zostaje do 0d-2.
- **D7. Test integracyjny `tests/integration/services/mindMapService.integration.test.ts`** jest wyłączony z domyślnego `vitest`, ale `tsc` go widzi (`tsconfig` include `**/*.ts`), więc w Task 9 aktualizujemy wywołania. Całość tła emulatora znika w 0d-2.

## Reguły transformacji (R1–R4, stosowane w Taskach 4–10)

- **R1 repozytorium** (`lib/nexus/repos/*`): usuń pierwszy parametr `userId`/`_userId` z każdej funkcji eksportowanej; funkcje pomocnicze nie przyjmują `userId`; rekordy nie mają pola `userId`. Zachowanie poza tym bez zmian.
- **R2 serwis** (`services/*`): usuń parametr `userId`, przekaż wywołanie dalej bez niego.
- **R3 route** (`app/api/**`, poza `auth` i `waitlist`): usuń import `getAuthUserId` oraz dwie linie `const auth = await getAuthUserId(request); if (auth instanceof NextResponse) return auth;`, a `auth.uid` z wywołań serwisów. Usuń import `NextResponse`, jeśli przestał być używany (lint).
- **R4 testy:** usuń argument `userId`/`"u1"`/`U` z wywołań, usuń `vi.mock("@/lib/getAuth", …)` razem z `mockGetAuthUserId` i testy „returns 401 when not authenticated”, usuń pola `userId` z fixtur. Gdy test sprawdzał `toHaveBeenCalledWith("user-1", …)`, popraw oczekiwanie.

---

## Część A: zabezpieczenie lokalnego serwera

### Task 1: czysta logika strażnika `lib/localGuard.ts` (TDD)

**Pliki:**

- Create: `lib/localGuard.ts`
- Test: `tests/unit/lib/localGuard.test.ts` (`// @vitest-environment node`)

- [ ] **Krok 1: test (czerwony).** Importuje `isAllowedHost` i `checkRequest` z `@/lib/localGuard`. Pomocnik `req(over)` buduje `GuardInput` z domyślnym `{ method: "GET", host: "localhost:3100", origin: null, secFetchSite: null, clientHeader: null }`. Przypadki:

| Test                          | Wejście                                                                                                                                                                                          | Oczekiwanie                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| host dozwolony                | `isAllowedHost` dla `localhost`, `localhost:3100`, `127.0.0.1:3100`, `[::1]:3100`, `LOCALHOST:3100`                                                                                              | `true`                                                                                         |
| host obcy                     | `evil.com`, `evil.com:3100`, `localhost.evil.com:3100`, `127.0.0.1.evil.com`, `localhost@evil.com`, `localhost:3100,evil.com`, `localhost:abc`, `""`, `null`, `0.0.0.0:3100`, `192.168.1.5:3100` | `false`                                                                                        |
| GET z obcym hostem            | `checkRequest(req({ host: "evil.com" }))`                                                                                                                                                        | `{ ok:false, status:403, reason:"host" }`                                                      |
| GET z dobrym hostem           | `checkRequest(req({}))`, także `HEAD` i `OPTIONS`                                                                                                                                                | `{ ok:true }` (nawet z `secFetchSite:"cross-site"`)                                            |
| POST same-origin              | `method:"POST", secFetchSite:"same-origin"`                                                                                                                                                      | `ok:true`                                                                                      |
| POST cross/same-site          | `secFetchSite` = `cross-site`, `same-site`, `none`                                                                                                                                               | `reason:"origin"` (także z `clientHeader:"1"` i zgodnym `origin`: `Sec-Fetch-Site` rozstrzyga) |
| POST z `Origin`               | brak `secFetchSite`, `origin:"http://localhost:3100"`, `host:"localhost:3100"`                                                                                                                   | `ok:true`                                                                                      |
| POST z innym portem           | `origin:"http://localhost:3000"`, `host:"localhost:3100"`                                                                                                                                        | `reason:"origin"` (inny origin tego samego hosta)                                              |
| POST obcy `Origin`            | `origin:"http://evil.com"`; `origin:"null"`; `origin:"nie-url"`                                                                                                                                  | `reason:"origin"`                                                                              |
| POST obcy `Origin` + nagłówek | `origin:"http://evil.com"`, `clientHeader:"1"`                                                                                                                                                   | `reason:"origin"` (nagłówek nie przebija `Origin`)                                             |
| POST bez nagłówków            | brak `origin`, `secFetchSite`, `clientHeader`                                                                                                                                                    | `reason:"origin"`                                                                              |
| POST narzędzie                | brak `origin`/`secFetchSite`, `clientHeader:"1"`                                                                                                                                                 | `ok:true`                                                                                      |
| POST zły nagłówek             | `clientHeader:"0"`; `"true"`                                                                                                                                                                     | `reason:"origin"`                                                                              |
| PUT, PATCH, DELETE            | te same reguły co POST (wystarczy po jednym przypadku `reason:"origin"` i `ok:true` z `secFetchSite:"same-origin"`)                                                                              | zgodnie z wierszami powyżej                                                                    |
| host sprawdzany pierwszy      | `method:"POST", host:"evil.com", secFetchSite:"same-origin"`                                                                                                                                     | `reason:"host"`                                                                                |

- [ ] **Krok 2: uruchom, oczekuj porażki** (`Cannot find module '@/lib/localGuard'`): `npx vitest run tests/unit/lib/localGuard.test.ts`.

- [ ] **Krok 3: implementacja** (mały, współdzielony kontrakt, pełny kod):

```ts
const ALLOWED_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface GuardInput {
  method: string;
  /** Surowy nagłówek `Host` (z portem). */
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
  /** Wartość nagłówka `X-Nexus-Client`. */
  clientHeader: string | null;
}

export type GuardResult = { ok: true } | { ok: false; status: 403; reason: "host" | "origin" };

export function isAllowedHost(host: string | null): boolean {
  return ALLOWED_HOST.test((host ?? "").trim().toLowerCase());
}

function sameHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === host.trim().toLowerCase();
  } catch {
    return false;
  }
}

const reject = (reason: "host" | "origin"): GuardResult => ({ ok: false, status: 403, reason });

export function checkRequest(input: GuardInput): GuardResult {
  if (!isAllowedHost(input.host)) return reject("host");
  if (SAFE_METHODS.has(input.method.toUpperCase())) return { ok: true };
  if (input.secFetchSite !== null) {
    return input.secFetchSite === "same-origin" ? { ok: true } : reject("origin");
  }
  if (input.origin !== null) {
    return sameHost(input.origin, input.host as string) ? { ok: true } : reject("origin");
  }
  return input.clientHeader === "1" ? { ok: true } : reject("origin");
}
```

- [ ] **Krok 4: uruchom, oczekuj zieleni.** Jeśli test z `LOCALHOST:3100` zawodzi, sprawdź, czy `isAllowedHost` robi `toLowerCase()` przed regexem.
- [ ] **Krok 5: commit** `feat(security): add local request guard (host and origin checks)`.

### Task 2: `middleware.ts` i flagi `-H 127.0.0.1` (TDD)

**Pliki:**

- Create: `middleware.ts` (katalog główny repo; `app/` jest w głównym, więc nie `src/`)
- Modify: `package.json` (skrypty `dev`, `start`, `preview`)
- Test: `tests/unit/middleware.test.ts` (`// @vitest-environment node`), `tests/unit/package-scripts.static.test.ts`

- [ ] **Krok 1: testy (czerwone).**
  - `middleware.test.ts`: buduje `new NextRequest("http://localhost:3100/api/notes", { method, headers })` z nagłówkiem `host`. Jeśli `NextRequest` nie przyjmie nagłówka `host` (forbidden header), użyj `new Request(...)` opakowanego w `new NextRequest(req)` albo `Object.defineProperty` na `headers`; wybierz najprostsze działające rozwiązanie i zostaw komentarz. Przypadki: (1) `GET` z `host: localhost:3100` → `status` 200 i nagłówek `x-middleware-next` ustawiony (odpowiedź `NextResponse.next()`), (2) `GET` z `host: evil.com` → 403, ciało JSON `{ error: ... }`, (3) `POST` z `host: localhost:3100` i `sec-fetch-site: same-origin` → przechodzi, (4) `POST` z `origin: http://evil.com` → 403, (5) `POST` z `x-nexus-client: 1` bez `origin` → przechodzi, (6) `config.matcher` istnieje i nie obejmuje `_next/static` (test na `config.matcher[0]` jako `RegExp` po zamianie `/((?!_next/static|_next/image).*)`: `"/_next/static/x.js"` nie pasuje, `"/api/notes"` pasuje).
  - `package-scripts.static.test.ts`: czyta `package.json`, asercja: `scripts.dev` zawiera `-H 127.0.0.1` i `-p 3100`; `scripts.start` i `scripts.preview` zawierają `-H 127.0.0.1`.
- [ ] **Krok 2: uruchom, oczekuj porażki.**
- [ ] **Krok 3: implementacja.**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { checkRequest } from "@/lib/localGuard";

export function middleware(request: NextRequest) {
  const result = checkRequest({
    method: request.method,
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    clientHeader: request.headers.get("x-nexus-client"),
  });
  if (result.ok) return NextResponse.next();
  const error =
    result.reason === "host" ? "Niedozwolony host" : "Niedozwolone żądanie spoza aplikacji";
  return NextResponse.json({ error }, { status: result.status });
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
```

`package.json`: `"dev": "next dev -p 3100 -H 127.0.0.1"`, `"start": "next start -H 127.0.0.1"`, `"preview": "next start -H 127.0.0.1"`.

- [ ] **Krok 4: testy zielone**, potem `npx tsc --noEmit` (cursor).
- [ ] **Krok 5: smoke na kopii vaulta** (patrz Task 13, krok 4; tu wystarczy sprawdzić, że `npm run dev` startuje). Zapamiętaj: w WSL2 `localhost` z przeglądarki Windows trafia w `127.0.0.1` wewnątrz WSL, więc `-H 127.0.0.1` powinno działać; jeśli nie, zgłoś użytkownikowi, nie zmieniaj na `0.0.0.0`.
- [ ] **Krok 6: commit** `feat(security): bind to 127.0.0.1 and guard host and origin in middleware`.

---

## Część B: serwer bez auth i bez `userId` (plasterki)

Każdy plaster = jeden commit; po każdym `npx tsc --noEmit` czysty i testy dotkniętych plików zielone. Pliki dotknięte wynajdź przez `npx tsc --noEmit` po zmianie sygnatury repozytorium (kompilator wskaże wszystkich wywołujących, w tym testy, bo `tsconfig` obejmuje `tests/`). Barrel `lib/firestore-db.ts` to same re-eksporty: sygnatury płyną z repozytoriów, plik zwykle nie wymaga zmian.

### Task 3: kontrola linii bazowej i rejestr plików

- [ ] **Krok 1:** `git grep -nE "userId|_userId|getAuthUserId|auth\.uid" -- app services lib types ':!lib/getAuth.ts' ':!app/api/auth' ':!app/api/waitlist' ':!lib/firebase-admin.ts'` i zapisz liczbę trafień (pomoc przy końcowym porównaniu). Spodziewane: repozytoria `lib/nexus/repos/*`, `services/*`, 19 route'ów (`board`, `calendar/events` ×2, `documents` ×2, `mind-maps` ×2, `notes` ×2, `resources` ×2, `tags` ×2, `task-templates` ×2, `tasks` ×3 (`route`, `[id]`, `reorder`), `upload`), `types/records.ts:20,80`.
- [ ] **Krok 2:** brak commita (tylko odczyt).

### Task 4: tagi (`tags`)

**Pliki:** `lib/nexus/repos/tags.ts`, `services/tagService.ts`, `app/api/tags/route.ts`, `app/api/tags/[id]/route.ts`, `tests/unit/lib/nexus/repos/tags.test.ts`, `tests/unit/services/tagService.test.ts`.

- [ ] Zastosuj R1–R4. W `tags.test.ts` zmień `getUserTags("u1")` → `getUserTags()`, analogicznie pozostałe wywołania.
- [ ] `npx tsc --noEmit` (powinien nadal wskazywać błędy tylko w kolekcjach, których jeszcze nie ruszyłeś: ich sygnatury się nie zmieniły, więc ma być czysty), `npx vitest run tests/unit/lib/nexus/repos/tags.test.ts tests/unit/services/tagService.test.ts`.
- [ ] Commit `refactor(tags): drop userId and auth from tags backend`.

### Task 5: szablony zadań (`taskTemplates`)

**Pliki:** `lib/nexus/repos/taskTemplates.ts`, `services/taskTemplateService.ts`, `app/api/task-templates/route.ts`, `app/api/task-templates/[id]/route.ts`, testy: `tests/unit/lib/nexus/repos/taskTemplates.test.ts`, `tests/unit/services/taskTemplateService.test.ts`, `tests/unit/api/task-templates.test.ts`.

- [ ] R1–R4, `tsc`, testy trzech plików. Commit `refactor(task-templates): drop userId and auth`.

### Task 6: zasoby (`resources`)

**Pliki:** `lib/nexus/repos/resources.ts`, `services/resourceService.ts`, `app/api/resources/route.ts`, `app/api/resources/[resourceId]/route.ts`, `types/records.ts` (pole `userId` w `NoteResourceRecord`, ok. linia 20), testy: `tests/unit/lib/nexus/repos/resources.test.ts`, `tests/unit/services/resourceService.test.ts`, `tests/unit/components/resources/ResourceListItem.test.tsx` (fixtura z `userId`).

- [ ] R1–R4 plus: `toResource(record)` bez drugiego argumentu, `addResourceToFirestore(data)` bez `userId` w danych, `resourceService.addResource` nie wstawia `userId` do `data`; typ `NoteResourceRecord` traci `userId`. Sprawdź `git grep -n "userId" src/components/resources` (oczekiwane: brak; jeśli jest, usuń).
- [ ] `tsc`, testy trzech plików. Commit `refactor(resources): drop userId and auth`.

### Task 7: zadania i kalendarz (`tasks`, `calendarEvents`)

Razem, bo `calendarService` czyta zadania (`getTasks`), a `planowanie` łączy oba.

**Pliki:** `lib/nexus/repos/tasks.ts`, `lib/nexus/repos/calendarEvents.ts`, `services/taskService.ts`, `services/calendarService.ts`, route'y: `app/api/tasks/route.ts`, `app/api/tasks/[id]/route.ts`, `app/api/tasks/reorder/route.ts`, `app/api/calendar/events/route.ts`, `app/api/calendar/events/[id]/route.ts`; testy: `tests/unit/lib/nexus/repos/tasks.test.ts` (stała `U = "user"`: usuń), `tests/unit/lib/nexus/repos/calendarEvents.test.ts`, `tests/unit/services/taskService.test.ts`, `tests/unit/services/calendarService.test.ts`, `tests/unit/api/tasks.test.ts`, `tests/unit/api/tasks-id.test.ts`.

- [ ] R1–R4. Uwaga: w `calendarService` wywołanie `getTasks(userId)` staje się `getTasks()`; `app/api/tasks/reorder` weryfikuje `taskIds`, nie dotykaj walidacji.
- [ ] `tsc`, testy wymienionych plików. Commit `refactor(tasks,calendar): drop userId and auth`.

### Task 8: notatki, dokumenty, upload (`notes`, `documents`)

**Pliki:** `lib/nexus/repos/notes.ts`, `lib/nexus/repos/documents.ts`, `services/noteService.ts`, `services/documentService.ts` (w tym `ingestDocument`), `app/api/notes/route.ts`, `app/api/notes/[id]/route.ts`, `app/api/documents/route.ts`, `app/api/documents/[id]/route.ts`, `app/api/upload/route.ts`; testy: `tests/unit/lib/nexus/repos/notes.test.ts`, `tests/unit/lib/nexus/repos/documents.test.ts`, `tests/unit/services/noteService.test.ts`, `tests/unit/services/documentService.test.ts`, `tests/unit/api/notes.test.ts`, `tests/unit/api/upload.test.ts`.

- [ ] R1–R4. W `upload.test.ts` oczekiwanie `ingestDocument` zmienia się z `("user-1", {…})` na `({…})`.
- [ ] `tsc`, testy. Commit `refactor(notes,documents): drop userId and auth`.

### Task 9: mapy myśli (`mindMaps`)

**Pliki:** `lib/nexus/repos/mindMaps.ts`, `services/mindMapService.ts`, `types/records.ts` (pole `userId` w `MindMap`, ok. linia 80), `app/api/mind-maps/route.ts`, `app/api/mind-maps/[id]/route.ts`; testy: `tests/unit/lib/nexus/repos/mindMaps.test.ts`, `tests/unit/services/mindMapService.test.ts` (35 trafień), `tests/unit/features/mind-maps/mindMapExportHtml.test.ts` i `useMindMapDocument.test.tsx` (fixtury z `userId`), `tests/integration/services/mindMapService.integration.test.ts` (D7).

- [ ] R1–R4 plus: `toMindMap(id, stored)` bez `userId`; w `mindMapService` usuń `ensureOwnMap` i jej wywołania (`getMindMap` nadal rzuca `DomainError("Mind map not found", 404)`, gdy repozytorium zwróci `null`); usuń z `mindMapService.test.ts` testy „obca mapa → 404” (nie istnieją już obcy właściciele), zostaw testy „brak mapy → 404”. Zamień komentarz w `lib/nexus/repos/mindMaps.ts` (ok. linia 48) na brzmienie bez słowa `userId` (test statyczny z Task 11 skanuje też komentarze), np. „Kolejność kluczy w pliku jest stała; rekord nie przechowuje właściciela (M1)”. Test `mindMaps.test.ts` „creates … without storing userId” zmień na „creates MindMaps/<id>.json” i usuń asercję `not.toContain("userId")`, bo wywołanie nie ma już `userId` (zostaw asercję, że plik nie ma klucza `owner`, jeśli test to sprawdzał).
- [ ] `tsc`, testy. Commit `refactor(mind-maps): drop userId, ownership check and auth`.

### Task 10: tablica (`board`)

**Pliki:** `lib/nexus/repos/board.ts`, `services/boardService.ts`, `app/api/board/route.ts`, `tests/unit/lib/nexus/repos/board.test.ts`, `tests/unit/services/boardService.test.ts`, `tests/unit/api/board.test.ts`.

- [ ] R1–R4. **Nie** zmieniaj `BoardTab`/`BoardCanvas` ani ich testów `tests/unit/features/board/BoardTab.test.tsx`, `BoardCanvas.test.tsx`, `boardViewport.test.ts` (`userId` tam to klucz `localStorage`, D6; zostają do 0d-2).
- [ ] `tsc`, testy. Commit `refactor(board): drop userId and auth`.

### Task 11: strażnik statyczny przeciw powrotowi `userId` (TDD)

**Pliki:** Create `tests/unit/no-user-id.static.test.ts` (`// @vitest-environment node`).

- [ ] **Krok 1: test.** Zbiera rekurencyjnie pliki `.ts` z `app/api`, `services`, `lib/nexus`, `types` oraz `lib/firestore-db.ts`, z wyłączeniem `app/api/auth/`, `app/api/waitlist/` (znikają w 0d-2). Asercje: brak trafień wzorca `/\b_?userId\b|getAuthUserId|\bauth\.uid\b/` (zwraca listę `plik:linia`), oraz test pomocniczy „skanuje istniejące pliki” (lista niepusta, zawiera `services/noteService.ts` i `app/api/notes/route.ts`).
- [ ] **Krok 2:** uruchom; jeśli zgłasza pozostałości (np. komentarze), popraw je (nie wyłączaj wzorca).
- [ ] **Krok 3:** `git grep -n "_userId" -- app services lib types` ma zwrócić tylko wykluczone pliki. Commit `test: guard against userId and auth in the server layer`.

### Task 12: dokumentacja

**Pliki:** `docs/superpowers/specs/2026-11-12-etap-0-odpiecie-firebase-design.md`, `docs/nexus-vault-formaty-yaml.md`.

- [ ] W specu etapu 0: status (0d podzielone na 0d-1 i 0d-2; 0d-1 zaimplementowane), §7 0d: dopisz D1–D3 (podział; `firebase-admin`, `lib/firebase-admin.ts`, `scripts/export-firestore/` i testy integracyjne eksportu zostają do 0e po bramce; usunięcie z `package.json` po 0e), zabezpieczenie lokalne oznacz jako zaimplementowane (`lib/localGuard.ts`, `middleware.ts`, nagłówek `X-Nexus-Client`), §10 kryterium „bez pakietów Firebase” przesuń na koniec 0e.
- [ ] `docs/nexus-vault-formaty-yaml.md`: dwa wiersze „`userId` nie jest zapisywany (jednoużytkownikowy vault do etapu 0d)” (ok. linii 22 i 86) zamień na „vault jest jednoużytkownikowy; `userId` nie istnieje”.
- [ ] Commit `docs: record 0d split, local guard and firebase-admin deferral`.

### Task 13: weryfikacja końcowa, smoke, PR

- [ ] **Krok 1 (cursor):** `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`. Oczekiwane: `tsc` czysty; lint tylko 3 znane ostrzeżenia; testy zielone (liczba testów rośnie o nowe z Tasków 1, 2, 11 i maleje o usunięte „401” i „obca mapa”: zanotuj różnicę); build przechodzi.
- [ ] **Krok 2:** `git grep -nE "getAuthUserId" -- app lib` ma zwrócić tylko `app/api/auth/me/route.ts`, `app/api/waitlist/check/route.ts`, `lib/getAuth.ts`.
- [ ] **Krok 3 (agy, `--role review`, świeża sesja):** review `git diff main...HEAD` pod kątem: pominiętego route'a bez `userId`, ale nadal wołającego usunięte API, luk w strażniku (`Host`/`Origin`/`Sec-Fetch-Site`), regresji zachowania. Opinie to hipotezy: weryfikuj w kodzie.
- [ ] **Krok 4: smoke na tymczasowym vaulcie** (nie na prawdziwym): `NEXUS_VAULT_PATH=$(mktemp -d)/Vault`, `mkdir` tego katalogu, `npm run dev` w tle. Następnie (każdy wynik zanotuj):
  - `curl -s -o /dev/null -w "%{http_code}" -H "Host: evil.com" http://127.0.0.1:3100/api/notes` → `403`,
  - `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/api/notes` → `200` (GET bez tokenu działa),
  - `curl -s -X POST -H "content-type: application/json" -d '{"title":"t","content":"c"}' http://127.0.0.1:3100/api/notes` → `403` (brak `Origin` i nagłówka),
  - to samo z `-H "X-Nexus-Client: 1"` → `200`, a w tymczasowym vaulcie powstaje `Notes/t.md`,
  - to samo z `-H "Origin: http://evil.com"` → `403`.
    Zatrzymaj serwer, usuń katalog tymczasowy.
- [ ] **Krok 5:** push, PR do `main` (tytuł po polsku, np. „Etap 0d-1: lokalny strażnik serwera, usunięcie auth i userId z backendu”), w opisie: decyzje D1–D7, wyniki weryfikacji, uwaga, że UI nadal wymaga logowania Firebase do 0d-2. Stopka PR: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Poza zakresem (0d-2 i dalej)

- **0d-2:** `src/App.tsx` (formularz logowania, `apiFetch` z tokenem, `checkWaitlistAndProceed`), `src/components/LoginScreen.tsx`, `src/lib/auth/useAuth.ts`, `src/lib/firebase-client.ts`, `app/(protected)/layout.tsx` (decyzja: spłaszczenie tras do `app/dashboard` czy grupa bez auth), `app/auth/login`, `app/page.tsx` i landing (O4: przekierowanie do aplikacji), `app/regulamin|politika-prywatnosci|cookies`, `app/api/waitlist/*`, `app/api/auth`, `lib/getAuth.ts`, `lib/waitlistCheckEmail.ts` i ich testy, klucze `localStorage` zależne od `user.id` (`activeSession`, `boardViewport`), prop `userId` w `BoardTab`/`BoardCanvas`/`PlanowanieView`, pakiet `firebase`, `NEXT_PUBLIC_FIREBASE_*` i `FIREBASE_*` w `.env.example`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `docker-compose-test.yml`, skrypty `emulator:docker`, `test:integration:docker`, `migrate:sqlite-to-firestore`, `vercel`, `vercel:prod`, pakiety `vercel` i `better-sqlite3` (po sprawdzeniu użycia), przepisanie lub usunięcie e2e zależnych od logowania, ADR „lokalne pliki zamiast Firestore”, README.
- **0e:** zdjęcie z Vercela, usunięcie `firebase-admin`, `lib/firebase-admin.ts`, `scripts/export-firestore/`, `scripts/migrate-sqlite-to-firestore.ts`, `scripts/cleanup-knowledge-collections.ts` i testów integracyjnych eksportu, po bramce 0e.
- **0f:** `Vault/Work/`.
