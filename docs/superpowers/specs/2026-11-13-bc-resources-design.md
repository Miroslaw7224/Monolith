# PR 7: migracja domeny zasobów i dokumentów do `contexts/bc_resources/` — projekt

Data: 2026-11-13
Status: do review
Powiązane: `2026-11-12-struktura-kontekstow-design.md` (§4 siatka plików, §6 reguły, §7 wiersz PR 7), wzór: PR 3 `bc_tags` (#26), PR 4 `bc_tasks` (#27, `repositories/` jako folder), PR 6 `bc_notes` (#29)

## 1. Cel

Przenieść zasoby (linki z tagami i ulubionymi), dokumenty i wgrywanie plików ze starej warstwy (`services/`, `lib/nexus/repos/`, `lib/validation/`, `types/`) do jednego kontekstu `contexts/bc_resources/` oraz UI zasobów do `src/features/resources/`. Bez zmiany zachowania: te same testy przechodzą po przeniesieniu.

**Zasada nadrzędna:** projekt dopasowuje się do siatki i reguł 1–9, nie odwrotnie. `architecture.static.test.ts` i baseline zostają bez zmian (baseline nie zawiera wpisów o zasobach ani dokumentach).

## 2. Zakres

**W zakresie:**

- zasoby: `Resources/resources.yaml` (YAML), trasy `resources` (`GET`, `POST`) i `resources/[resourceId]` (`PUT`, `DELETE`), pobieranie metadanych strony (`<title>`, `og:image`), `searchResources` (słowa kluczowe; dziś bez wywołań poza testem, zostaje 1:1);
- dokumenty: `Documents/*.md` (frontmatter `id`, `name`, `type`, `created`; ciało = `content`), trasy `documents` (`GET`), `documents/[id]` (`DELETE`) i `upload` (`POST`, wgranie pliku jako dokumentu);
- UI: `src/components/ResourceSection.tsx` i cały `src/components/resources/` (w tym `DocumentsPanel`) → `src/features/resources/`;
- typy: `NoteResourceRecord` i `DocumentRecord` znikają z `types/`; UI bierze DTO i schematy zod ze `schemas`.

**Poza zakresem:** `lib/http/uploadFormFile.ts` (wspólna infrastruktura HTTP, router go importuje), `lib/nexus/markdown-dir.ts` i `record-helpers.ts` (wspólne z notatkami, zostają), plik YAML `Resources/tags.yaml` (to `bc_tags`), format plików w vaulcie, nazwa typu `NoteResource` w UI (alias zostaje; pole `noteId` jest opcjonalne i bez użycia, usunięcie to osobna decyzja), zmiany zachowania UI i API.

## 3. Struktura kontekstu

Dwa repozytoria (zasoby: YAML przez `yaml-store`; dokumenty: pliki przez `markdown-dir`) → folder `repositories/` jak w `bc_tasks` (§4: plik urósł → folder o tej samej nazwie z `index.ts`). Reszta mieści się w pojedynczych plikach.

| Plik                        | Zawartość                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models.ts`                 | `Resource` (dzisiejszy `NoteResourceRecord`), `UploadedDocument` (dzisiejszy `DocumentRecord`; nazwa unika kolizji z globalnym typem DOM `Document`)                                                                                         |
| `schemas.ts`                | zod `CreateResourceBodySchema`, `UpdateResourceBodySchema` z `lib/validation/resources.ts` 1:1; `ResourceDto`, `DocumentDto`; mappery `toResourceDto`, `toDocumentDto`. Bezpieczny dla klienta (zod, bez Node): UI importuje stąd formularze |
| `repositories/resources.ts` | `lib/nexus/repos/resources.ts` 1:1, funkcje bez „Firestore” w nazwie: `addResource`, `getResources`, `deleteResource`, `updateResource`                                                                                                      |
| `repositories/documents.ts` | `lib/nexus/repos/documents.ts` 1:1 (`getDocuments`, `createDocument`, `deleteDocument`)                                                                                                                                                      |
| `repositories/index.ts`     | re-eksport obu                                                                                                                                                                                                                               |
| `services.ts`               | `addResource` (z `fetchPageMetadata`), `getResources`, `updateResource`, `deleteResource`, `searchResources`, `listDocuments`, `ingestDocument`, `deleteDocument`: logika z `resourceService` i `documentService` 1:1                        |
| `router.ts`                 | 7 handlerów: `listResources`, `createResource`, `updateResource`, `deleteResource`, `listDocuments`, `deleteDocument`, `uploadDocument`; koercje i statusy z dzisiejszych `route.ts` 1:1                                                     |

`app/api/resources/route.ts`, `resources/[resourceId]/route.ts`, `documents/route.ts`, `documents/[id]/route.ts`, `upload/route.ts` stają się cienkim re-eksportem z `contexts/bc_resources/router` (reguła 4).

**Zgodność odpowiedzi (1:1):**

- `GET /api/resources` → tablica `ResourceDto` (klucze camelCase jak dziś: `id, noteId?, description, url, title, thumbnailUrl?, tags, isFavorite, createdAt?, updatedAt?`; `undefined` znika z JSON);
- `POST /api/resources` → 201 + zasób; `description` i `url` po `trim()`, `tags ?? []`;
- `PUT /api/resources/[resourceId]` → serwis `updateResource`, potem `getResources()` i wyszukanie po `id`; odpowiedź: znaleziony zasób albo `{ success: true }`; pola `title/description/url` po `trim()`, tylko przekazane pola trafiają do serwisu;
- `DELETE /api/resources/[resourceId]` → 204 bez ciała;
- `GET /api/documents` → `{ id, name, content, type, created_at }[]`; `DELETE /api/documents/[id]` → `{ success: true }`; `POST /api/upload` → `{ id, name }`, 400 `{ error: "Invalid form data" }` gdy `formData()` rzuca.

## 4. Przepięcia

- `app/api/{resources,documents,upload}/**`: re-eksport (§3).
- Usunięte: `services/resourceService.ts`, `services/documentService.ts`, `lib/validation/resources.ts`, `lib/nexus/repos/resources.ts`, `lib/nexus/repos/documents.ts` (`git mv`/`git rm`).
- `lib/firestore-db.ts`: traci eksporty zasobów, dokumentów i typów `DocumentRecord`/`NoteResourceRecord`; zostają `mindMaps` i `board` (PR 8, 9). `types/records.ts` traci oba typy, `types/index.ts` re-eksportuje tylko `MindMap`, `MindMapNode`.
- `src/features/resources/resourceTypes.ts`: `NoteResource` jako alias `ResourceDto` ze `schemas`; `CreateResourceBodySchema`/`UpdateResourceBodySchema` ze `schemas` (reguła 1). `ResourceAddForm` i `ResourceEditModal` importują schematy ze `schemas` zamiast z `lib/validation`.
- `PlanowanieView.tsx:13`: import `ResourceSection` z `@/src/features/resources/ResourceSection`. `planowanie` jest modułem składającym widoki (§5.1, już dziś importuje `tasks`, `calendar`, `tags`, `notes`, `mind-maps`, `board`), więc kolejny import nie wymaga zmian reguł; lista w §5.1 i w ADR-021 wymienia tylko część, więc jej nie dotykam (konwencja z review).
- Zależności między kontekstami: brak (`bc_resources` nie woła innych kontekstów, nikt go nie woła).
- `README.md`, ADR-019 i `docs/mockups/karty/STAN-W-KODZIE.md` (stare ścieżki `src/components/resources/…`) aktualizuje zbiorczo PR 10 (spec §7).

## 5. Testy (TDD)

Kolejność: najpierw przeniesione testy ze zmienionymi importami (czerwone: brak modułu), potem kod.

- `tests/unit/lib/nexus/repos/resources.test.ts` → `tests/unit/contexts/bc_resources/repositories.resources.test.ts` (import `@/contexts/bc_resources/repositories`, nazwy funkcji bez „Firestore”, helper `../../lib/nexus/repos/helpers`); **pierwszy czerwony test**; asercje bez zmian;
- `tests/unit/lib/nexus/repos/documents.test.ts` → `…/repositories.documents.test.ts` (jw.);
- `tests/unit/services/resourceService.test.ts` → `…/services.resources.test.ts` i `documentService.test.ts` → `…/services.documents.test.ts`: mock `lib/firestore-db` zastąpiony mockiem `@/contexts/bc_resources/repositories`; asercje bez zmian;
- `tests/unit/api/upload.test.ts` → `…/router.upload.test.ts`: mock `@/contexts/bc_resources/services` zamiast `@/services/documentService`; pozostałe mocki i asercje bez zmian (bez nagłówka `node`: komentarz w teście mówi, że jsdom jest tu celowy);
- **nowe** `router.resources.test.ts` (dziś nie ma testów tras zasobów): `GET`, `POST` (201, `trim`, domyślne `tags`, 400 dla złego URL i pustego opisu), `PUT` (przekazanie przyciętych pól, odpowiedź = znaleziony zasób, fallback `{ success: true }`, 400 dla pustego body, `NotFoundError` → 404), `DELETE` (204, `NotFoundError` → 404);
- **nowe** `router.documents.test.ts`: `GET` (dokładne klucze), `DELETE`;
- **nowy** `schemas.test.ts`: `toResourceDto`, `toDocumentDto`, domyślne `tags`, odrzucenie złego URL i pustego `{}` w `UpdateResourceBodySchema`;
- `tests/unit/lib/nexus/repos-static.test.ts`: `REPOS` zamienia `lib/nexus/repos/{resources,documents}.ts` na `contexts/bc_resources/repositories/{resources,documents}.ts`, a pętla barrel (L88) traci `resources` i `documents` (test starej warstwy, aktualizowany razem z kodem, spec §6);
- `no-user-id.static.test.ts` i `no-firebase-client.static.test.ts`: skanują `contexts/` i `src/` z automatu, więc nowe pliki wchodzą w skan bez zmian testów;
- `tests/unit/components/resources/*` → `tests/unit/features/resources/*` (3 testy UI: zmiana importów na `@/src/features/resources/...`);
- `tests/unit/architecture.static.test.ts` i baseline: **bez zmian**, test musi zostać zielony.

## 6. Kolejność i weryfikacja

Jeden PR, dwa commity; po każdym `npx tsc --noEmit` i `npx vitest run` zielone:

1. UI: `ResourceSection` + `resources/` → `src/features/resources/`, import w `PlanowanieView`, testy UI (niezależne od backendu);
2. backend: `contexts/bc_resources/` + 5 tras + przepięcie `resourceTypes`/formularzy na `schemas` + usunięcie starych plików i typów + testy domeny, tras i testy starej warstwy. Między krokami `tsc` jest celowo czerwony, więc jeden commit po całości.

Na końcu `npx vitest run` (całość), `npx tsc --noEmit`, `npm run lint`, `npm run build`: przez `cursor`. Review diffa przez `agy --role review` (zgodność statusów i JSON tras, importy wg reguł 1–9). Ręcznie w przeglądarce: Planowanie → zasoby (lista, dodanie linku, edycja, ulubione, tagi, usunięcie) i panel dokumentów (wgranie pliku, lista, usunięcie).

## 7. Ryzyka

- **Statusy odpowiedzi:** `POST resources` = 201, `DELETE resources` = 204 bez ciała, `DELETE documents` = 200 `{ success: true }`; nowe testy routera pilnują każdego z nich.
- **`PUT resources` robi dwa wywołania serwisu** (aktualizacja + lista); migracja zachowuje to 1:1 w `router.ts`, bez „upraszczania” w tym PR.
- **Rename funkcji repozytorium** (`…ToFirestore` → bez przyrostka) dotyka tylko `repositories`, `services` i ich testów; pominięty import wychodzi w `tsc`.
- **Metadane strony** (`fetch` z timeoutem 5 s) zostają w `services.ts`; test serwisu mockuje globalny `fetch`, jak dziś.
- **Duplikat nazw w jednym kontekście:** `services.updateResource`/`deleteResource` i handlery routera o tych samych nazwach nie kolidują dzięki `import * as services`.
