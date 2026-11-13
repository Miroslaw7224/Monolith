# PR 7: `bc_resources` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przenieść zasoby, dokumenty i upload do `contexts/bc_resources/` oraz UI zasobów do `src/features/resources/`, bez zmiany zachowania.

**Architecture:** Wzór: PR 4 (`contexts/bc_tasks/`, `repositories/` jako folder z `index.ts`) i PR 6. Kierunek `app/api/**/route.ts` (re-eksport) → `router` → `services` → `repositories` → `lib/nexus`. Dwa commity: A = UI (niezależne od backendu), B = backend + przepięcie typów i schematów w UI.

**Tech Stack:** Next.js 14, TypeScript, zod, vitest, `lib/nexus` (vault: YAML i Markdown).

Spec: `docs/superpowers/specs/2026-11-13-bc-resources-design.md`.

## Zasady wykonania

- Komendy z katalogu `~/projects/Brain_7224/Monolith`, gałąź `feat/pr-7-bc-resources` (spec i plan są jej pierwszymi commitami).
- **Testów, lintu, tsc i builda nie uruchamiam w swoim kontekście**: `scripts/ask-helper.sh --role task cursor "<komenda> ... odpowiedz: przeszło albo lista plik:linia + przyczyna"` (CLAUDE.md). Pełny output czytam tylko, gdy podsumowanie nie wystarcza.
- `tests/unit/architecture.static.test.ts` i baseline **nie są zmieniane**; pęknięcie naprawia się kodem.
- Testy kontekstu (`tests/unit/contexts/**`) mają `// @vitest-environment node`, z wyjątkiem przeniesionych testów, które dziś go nie mają (`router.upload`, `services.resources`, `services.documents`): zostają bez nagłówka, żeby środowisko się nie zmieniło.
- Router importuje tylko `services` i `schemas` (typy ze `schemas`, nie z `models`).
- Przenosimy przez `git mv` (historia).

## Mapa plików

Tworzone: `contexts/bc_resources/{models,schemas,services,router}.ts`, `contexts/bc_resources/repositories/index.ts`, `tests/unit/contexts/bc_resources/{schemas,router.resources,router.documents}.test.ts`.

Przenoszone (`git mv`):

- `lib/nexus/repos/resources.ts` → `contexts/bc_resources/repositories/resources.ts`
- `lib/nexus/repos/documents.ts` → `contexts/bc_resources/repositories/documents.ts`
- `src/components/ResourceSection.tsx` → `src/features/resources/ResourceSection.tsx`
- `src/components/resources/*` (10 plików) → `src/features/resources/`
- `tests/unit/components/resources/*` (3 pliki) → `tests/unit/features/resources/`
- `tests/unit/lib/nexus/repos/resources.test.ts` → `tests/unit/contexts/bc_resources/repositories.resources.test.ts`
- `tests/unit/lib/nexus/repos/documents.test.ts` → `tests/unit/contexts/bc_resources/repositories.documents.test.ts`
- `tests/unit/services/resourceService.test.ts` → `tests/unit/contexts/bc_resources/services.resources.test.ts`
- `tests/unit/services/documentService.test.ts` → `tests/unit/contexts/bc_resources/services.documents.test.ts`
- `tests/unit/api/upload.test.ts` → `tests/unit/contexts/bc_resources/router.upload.test.ts`

Usuwane: `services/resourceService.ts`, `services/documentService.ts`, `lib/validation/resources.ts`.

Modyfikowane: `app/api/resources/route.ts`, `app/api/resources/[resourceId]/route.ts`, `app/api/documents/route.ts`, `app/api/documents/[id]/route.ts`, `app/api/upload/route.ts`, `lib/firestore-db.ts`, `types/records.ts`, `types/index.ts`, `src/features/planowanie/PlanowanieView.tsx`, `src/features/resources/{resourceTypes.ts,ResourceAddForm.tsx,ResourceEditModal.tsx}`, `tests/unit/lib/nexus/repos-static.test.ts`.

---

### Task 1: UI zasobów → `src/features/resources/` (commit A)

- [ ] **Step 1:** przenieś pliki i testy:

```bash
mkdir -p src/features/resources tests/unit/features/resources
git mv src/components/ResourceSection.tsx src/features/resources/ResourceSection.tsx
git mv src/components/resources/* src/features/resources/
git mv tests/unit/components/resources/* tests/unit/features/resources/
ls src/components/resources tests/unit/components/resources 2>&1 | head
```

Oczekiwane: dwa komunikaty `No such file or directory` (katalogi puste, git ich nie śledzi).

- [ ] **Step 2:** przepięcia importów:
  - `src/features/resources/ResourceSection.tsx:3-10`: wszystkie `./resources/<nazwa>` → `./<nazwa>` (osiem importów: `resourceTypes`, `useResources`, `ResourceFilterSidebar`, `ResourceAddForm`, `ResourceFavoritesBar`, `ResourceListItem`, `ResourceEditModal`, `DocumentsPanel`);
  - `src/features/planowanie/PlanowanieView.tsx:13`: `@/src/components/ResourceSection` → `@/src/features/resources/ResourceSection`;
  - `tests/unit/features/resources/useResources.test.ts:3`: `@/src/components/resources/useResources` → `@/src/features/resources/useResources`;
  - `tests/unit/features/resources/ResourceListItem.test.tsx:5-6`: `@/src/components/resources/ResourceListItem` i `.../resourceTypes` → `@/src/features/resources/...`;
  - `tests/unit/features/resources/resourceParsing.test.ts:6`: `"../../../../src/components/resources/resourceParsing"` → `"@/src/features/resources/resourceParsing"`.
  - Pliki wewnątrz dawnego `resources/` importują się względnie (`./resourceTypes` itd.) i przenoszą się razem, więc się nie zmieniają.
- [ ] **Step 3:** kontrola: `grep -rn "components/resources\|components/ResourceSection" src tests app lib` → pusto (dokumenty w `docs/` i `README.md` zostają do PR 10).
- [ ] **Step 4:** weryfikacja przez `cursor`: `npx tsc --noEmit`, `npx vitest run tests/unit/features tests/unit/components`, `npm run lint`. Oczekiwane: „przeszło".
- [ ] **Step 5: Commit A**

```bash
git add -A src tests
git status --short | grep -v "^[MADR] " || echo "wszystko w indeksie"
git commit -m "$(cat <<'EOF'
refactor(resources): UI zasobów do src/features/resources (PR 7, 1/2)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Testy kontekstu (czerwone)

- [ ] **Step 1:** przenieś testy:

```bash
mkdir -p tests/unit/contexts/bc_resources
git mv tests/unit/lib/nexus/repos/resources.test.ts tests/unit/contexts/bc_resources/repositories.resources.test.ts
git mv tests/unit/lib/nexus/repos/documents.test.ts tests/unit/contexts/bc_resources/repositories.documents.test.ts
git mv tests/unit/services/resourceService.test.ts tests/unit/contexts/bc_resources/services.resources.test.ts
git mv tests/unit/services/documentService.test.ts tests/unit/contexts/bc_resources/services.documents.test.ts
git mv tests/unit/api/upload.test.ts tests/unit/contexts/bc_resources/router.upload.test.ts
```

- [ ] **Step 2: `repositories.resources.test.ts`** (pierwszy czerwony): zamień blok importu z `@/lib/nexus/repos/resources` na

```ts
import {
  addResource,
  deleteResource,
  getResources,
  updateResource,
} from "@/contexts/bc_resources/repositories";
```

oraz `import { useTempVault } from "./helpers"` na `from "../../lib/nexus/repos/helpers"`. W całym pliku: `addResourceToFirestore` → `addResource`, `deleteResourceFromFirestore` → `deleteResource`, `getResourcesFromFirestore` → `getResources`, `updateResourceInFirestore` → `updateResource` (wywołania w L45–L187). Asercje bez zmian.

- [ ] **Step 3: `repositories.documents.test.ts`**: import `from "@/contexts/bc_resources/repositories"` (nazwy `createDocument, deleteDocument, getDocuments` bez zmian), helper `from "../../lib/nexus/repos/helpers"`. Asercje bez zmian.
- [ ] **Step 4: `services.resources.test.ts`**: zamień L2 i L9–L22 na

```ts
import type { Resource } from "@/contexts/bc_resources/models";

const mockAdd = vi.hoisted(() => vi.fn());
const mockGetAll = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_resources/repositories", () => ({
  addResource: (...a: unknown[]) => mockAdd(...a),
  getResources: (...a: unknown[]) => mockGetAll(...a),
  deleteResource: (...a: unknown[]) => mockDelete(...a),
  updateResource: (...a: unknown[]) => mockUpdate(...a),
}));

import {
  addResource,
  getResources,
  deleteResource,
  updateResource,
  searchResources,
} from "@/contexts/bc_resources/services";
```

(usuń dotychczasowe deklaracje `mock*` z L4–L7, żeby nie zdublować) i `NoteResourceRecord` → `Resource` w L52 i L123. `describe("resourceService"` → `describe("bc_resources services (resources)"`. Reszta bez zmian (w tym stub `fetch` w `beforeEach`).

- [ ] **Step 5: `services.documents.test.ts`**: import `from "@/contexts/bc_resources/services"` (`listDocuments`, `ingestDocument`, `deleteDocument`), mock `vi.mock("@/contexts/bc_resources/repositories", () => ({ getDocuments: ..., createDocument: ..., deleteDocument: ... }))` z tymi samymi trzema funkcjami co dziś w mocku `firestore-db`. Asercje bez zmian.
- [ ] **Step 6: `router.upload.test.ts`**: L7 `vi.mock("@/services/documentService", ...)` → `vi.mock("@/contexts/bc_resources/services", () => ({ ingestDocument: mockIngestDocument }))`. Reszta (mock `uploadFormFile`, `import { POST } from "@/app/api/upload/route"`, 4 przypadki) bez zmian.
- [ ] **Step 7: `router.resources.test.ts`** (nowy):

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError } from "@/lib/errors";

const mockGetResources = vi.hoisted(() => vi.fn());
const mockAddResource = vi.hoisted(() => vi.fn());
const mockUpdateResource = vi.hoisted(() => vi.fn());
const mockDeleteResource = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_resources/services", () => ({
  getResources: mockGetResources,
  addResource: mockAddResource,
  updateResource: mockUpdateResource,
  deleteResource: mockDeleteResource,
}));

import { GET, POST } from "@/app/api/resources/route";
import { DELETE, PUT } from "@/app/api/resources/[resourceId]/route";

const fakeResource = {
  id: "r1",
  description: "opis",
  url: "https://a.com",
  title: "A",
  tags: ["x"],
  isFavorite: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const ctx = (id: string) => ({ params: Promise.resolve({ resourceId: id }) });

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/resources", {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/resources", () => {
  it("returns the list from the service", async () => {
    mockGetResources.mockResolvedValue([fakeResource]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([fakeResource]);
  });
});

describe("POST /api/resources", () => {
  it("returns 201, trims description and passes tags", async () => {
    mockAddResource.mockResolvedValue(fakeResource);
    const res = await POST(
      req("POST", { description: "  opis  ", url: "https://a.com", tags: ["x"] })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(fakeResource);
    expect(mockAddResource).toHaveBeenCalledWith({
      description: "opis",
      url: "https://a.com",
      tags: ["x"],
    });
  });

  it("defaults tags to []", async () => {
    mockAddResource.mockResolvedValue(fakeResource);
    await POST(req("POST", { description: "opis", url: "https://a.com" }));
    expect(mockAddResource).toHaveBeenCalledWith({
      description: "opis",
      url: "https://a.com",
      tags: [],
    });
  });

  it.each([
    ["invalid url", { description: "opis", url: "nie-url" }],
    ["empty description", { description: "", url: "https://a.com" }],
  ])("returns 400 for %s", async (_name, body) => {
    const res = await POST(req("POST", body));
    expect(res.status).toBe(400);
    expect(mockAddResource).not.toHaveBeenCalled();
  });
});

describe("PUT /api/resources/[resourceId]", () => {
  it("passes only given, trimmed fields and returns the updated resource", async () => {
    mockUpdateResource.mockResolvedValue(undefined);
    mockGetResources.mockResolvedValue([fakeResource]);
    const res = await PUT(req("PUT", { title: " T ", isFavorite: true }), ctx("r1"));
    expect(mockUpdateResource).toHaveBeenCalledWith("r1", { title: "T", isFavorite: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fakeResource);
  });

  it("falls back to { success: true } when the resource is not in the list", async () => {
    mockUpdateResource.mockResolvedValue(undefined);
    mockGetResources.mockResolvedValue([]);
    const res = await PUT(req("PUT", { isFavorite: false }), ctx("r1"));
    expect(await res.json()).toEqual({ success: true });
  });

  it("returns 400 for an empty body", async () => {
    const res = await PUT(req("PUT", {}), ctx("r1"));
    expect(res.status).toBe(400);
    expect(mockUpdateResource).not.toHaveBeenCalled();
  });

  it("maps NotFoundError to 404", async () => {
    mockUpdateResource.mockRejectedValue(new NotFoundError("Resource not found"));
    const res = await PUT(req("PUT", { title: "x" }), ctx("nope"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/resources/[resourceId]", () => {
  it("returns 204 without a body", async () => {
    mockDeleteResource.mockResolvedValue(undefined);
    const res = await DELETE(req("DELETE"), ctx("r1"));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(mockDeleteResource).toHaveBeenCalledWith("r1");
  });

  it("maps NotFoundError to 404", async () => {
    mockDeleteResource.mockRejectedValue(new NotFoundError("Resource not found"));
    const res = await DELETE(req("DELETE"), ctx("nope"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 8: `router.documents.test.ts`** (nowy):

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError } from "@/lib/errors";

const mockListDocuments = vi.hoisted(() => vi.fn());
const mockDeleteDocument = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_resources/services", () => ({
  listDocuments: mockListDocuments,
  deleteDocument: mockDeleteDocument,
}));

import { GET } from "@/app/api/documents/route";
import { DELETE } from "@/app/api/documents/[id]/route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/documents", () => {
  it("returns documents with exactly id, name, content, type, created_at", async () => {
    mockListDocuments.mockResolvedValue([
      {
        id: "d1",
        name: "a.txt",
        content: "x",
        type: "text/plain",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body[0]).sort()).toEqual(["content", "created_at", "id", "name", "type"]);
  });
});

describe("DELETE /api/documents/[id]", () => {
  const call = (id: string) =>
    DELETE(new NextRequest("http://localhost/api/documents/" + id, { method: "DELETE" }), {
      params: Promise.resolve({ id }),
    });

  it("returns { success: true } and passes the id", async () => {
    mockDeleteDocument.mockResolvedValue(undefined);
    const res = await call("d1");
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteDocument).toHaveBeenCalledWith("d1");
  });

  it("maps NotFoundError to 404", async () => {
    mockDeleteDocument.mockRejectedValue(new NotFoundError("Document not found"));
    expect((await call("nope")).status).toBe(404);
  });
});
```

- [ ] **Step 9: `schemas.test.ts`** (nowy):

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CreateResourceBodySchema,
  UpdateResourceBodySchema,
  toDocumentDto,
  toResourceDto,
} from "@/contexts/bc_resources/schemas";

describe("toResourceDto", () => {
  it("copies all fields and drops undefined optionals from JSON", () => {
    const dto = toResourceDto({
      id: "r1",
      description: "d",
      url: "https://a.com",
      title: "A",
      tags: ["x"],
      isFavorite: true,
    });
    expect(JSON.parse(JSON.stringify(dto))).toEqual({
      id: "r1",
      description: "d",
      url: "https://a.com",
      title: "A",
      tags: ["x"],
      isFavorite: true,
    });
  });
});

describe("toDocumentDto", () => {
  it("returns id, name, content, type, created_at", () => {
    expect(
      toDocumentDto({
        id: "d1",
        name: "n",
        content: "c",
        type: "t",
        created_at: "2026-01-01T00:00:00.000Z",
      })
    ).toEqual({
      id: "d1",
      name: "n",
      content: "c",
      type: "t",
      created_at: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("CreateResourceBodySchema", () => {
  it("defaults tags to []", () => {
    expect(CreateResourceBodySchema.parse({ description: "d", url: "https://a.com" }).tags).toEqual(
      []
    );
  });
  it("rejects an invalid url and an empty description", () => {
    expect(CreateResourceBodySchema.safeParse({ description: "d", url: "x" }).success).toBe(false);
    expect(
      CreateResourceBodySchema.safeParse({ description: "", url: "https://a.com" }).success
    ).toBe(false);
  });
});

describe("UpdateResourceBodySchema", () => {
  it("rejects an empty object and accepts a single field", () => {
    expect(UpdateResourceBodySchema.safeParse({}).success).toBe(false);
    expect(UpdateResourceBodySchema.safeParse({ isFavorite: false }).success).toBe(true);
  });
});
```

- [ ] **Step 10:** `npx vitest run tests/unit/contexts/bc_resources` → FAIL (brak modułów `@/contexts/bc_resources/*`).

---

### Task 3: `contexts/bc_resources/` (kod)

- [ ] **Step 1: `models.ts`**

```ts
/** Zasób użytkownika: link z opisem i tagami (`Resources/resources.yaml`). */
export type Resource = {
  id: string;
  noteId?: string; // opcjonalne: zasoby są na poziomie użytkownika, nie notatki
  description: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  tags: string[];
  isFavorite?: boolean;
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
};

/** Wgrany dokument (`Documents/*.md`: frontmatter + treść). */
export type UploadedDocument = {
  id: string;
  name: string;
  content: string;
  type: string;
  created_at?: string;
};
```

- [ ] **Step 2: `schemas.ts`**

```ts
import { z } from "zod";
import type { Resource, UploadedDocument } from "./models";

// ── wejście (zod) ──────────────────────────────────────────────────────────────

/** Body for POST /api/resources (create resource). */
export const CreateResourceBodySchema = z.object({
  description: z.string().min(1, "description is required"),
  url: z.string().url("invalid URL"),
  tags: z.array(z.string()).optional().default([]),
});

/** Body for PUT /api/resources/[resourceId] (partial update). */
export const UpdateResourceBodySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    url: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
    isFavorite: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one of title, description, url, tags, isFavorite is required",
  });

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type ResourceDto = {
  id: string;
  noteId?: string;
  description: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  tags: string[];
  isFavorite?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function toResourceDto(resource: Resource): ResourceDto {
  return {
    id: resource.id,
    noteId: resource.noteId,
    description: resource.description,
    url: resource.url,
    title: resource.title,
    thumbnailUrl: resource.thumbnailUrl,
    tags: resource.tags,
    isFavorite: resource.isFavorite,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  };
}

export type DocumentDto = {
  id: string;
  name: string;
  content: string;
  type: string;
  created_at?: string;
};

export function toDocumentDto(doc: UploadedDocument): DocumentDto {
  return {
    id: doc.id,
    name: doc.name,
    content: doc.content,
    type: doc.type,
    created_at: doc.created_at,
  };
}
```

- [ ] **Step 3: repozytoria**: `mkdir -p contexts/bc_resources/repositories`, potem

```bash
git mv lib/nexus/repos/resources.ts contexts/bc_resources/repositories/resources.ts
git mv lib/nexus/repos/documents.ts contexts/bc_resources/repositories/documents.ts
```

W `repositories/resources.ts`: `import type { NoteResourceRecord } from "@/types/records"` → `import type { Resource } from "../models"`; `NoteResourceRecord` → `Resource` (w `toResource`, `addResourceToFirestore`, `getResourcesFromFirestore`, w `Omit<…>`); importy `../yaml-lists`, `../yaml-store`, `../record-helpers` → `@/lib/nexus/yaml-lists`, `@/lib/nexus/yaml-store`, `@/lib/nexus/record-helpers`; nazwy funkcji `addResourceToFirestore` → `addResource`, `getResourcesFromFirestore` → `getResources`, `deleteResourceFromFirestore` → `deleteResource`, `updateResourceInFirestore` → `updateResource`. Reszta bez zmian.

W `repositories/documents.ts`: `import type { DocumentRecord } from "@/types/records"` → `import type { UploadedDocument } from "../models"`; `DocumentRecord` → `UploadedDocument` (w `toDocument` i `getDocuments`); importy `../record-helpers` i `../markdown-dir` → `@/lib/nexus/record-helpers` i `@/lib/nexus/markdown-dir`. Reszta bez zmian.

`repositories/index.ts`:

```ts
export { addResource, getResources, deleteResource, updateResource } from "./resources";
export { getDocuments, createDocument, deleteDocument } from "./documents";
```

- [ ] **Step 4: `services.ts`** (logika z `resourceService` i `documentService` 1:1):

```ts
import * as repositories from "./repositories";
import type { Resource } from "./models";

// ── zasoby ──────────────────────────────────────────────────────────────────────

export async function addResource(data: {
  description: string;
  url: string;
  tags?: string[];
  noteId?: string;
}): Promise<Resource> {
  const { title, thumbnailUrl } = await fetchPageMetadata(data.url);
  return repositories.addResource({
    description: data.description,
    url: data.url,
    title,
    thumbnailUrl,
    tags: data.tags ?? [],
    ...(data.noteId != null && { noteId: data.noteId }),
  });
}

export async function getResources(): Promise<Resource[]> {
  return repositories.getResources();
}

export async function deleteResource(resourceId: string): Promise<void> {
  return repositories.deleteResource(resourceId);
}

export async function updateResource(
  resourceId: string,
  data: {
    title?: string;
    description?: string;
    url?: string;
    tags?: string[];
    isFavorite?: boolean;
  }
): Promise<void> {
  return repositories.updateResource(resourceId, data);
}

async function fetchPageMetadata(url: string): Promise<{ title: string; thumbnailUrl?: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    return {
      title: titleMatch?.[1]?.trim() ?? url,
      thumbnailUrl: ogImage?.[1],
    };
  } catch {
    return { title: url };
  }
}

/** Wyszukiwanie po słowach kluczowych (opis, tytuł, tagi); puste `keywords` = wszystkie. */
export async function searchResources(keywords: string[]): Promise<Resource[]> {
  const allResources = await repositories.getResources();

  if (keywords.length === 0) {
    return allResources;
  }

  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  return allResources.filter((r) => {
    const desc = (r.description ?? "").toLowerCase();
    const title = (r.title ?? "").toLowerCase();
    const tagStr = (r.tags ?? []).join(" ").toLowerCase();
    return lowerKeywords.some((k) => desc.includes(k) || title.includes(k) || tagStr.includes(k));
  });
}

// ── dokumenty ───────────────────────────────────────────────────────────────────

export async function listDocuments() {
  return repositories.getDocuments();
}

export async function ingestDocument(data: { name: string; content: string; type: string }) {
  const { id } = await repositories.createDocument(data);
  return { id, name: data.name };
}

export async function deleteDocument(id: string) {
  return repositories.deleteDocument(id);
}
```

- [ ] **Step 5: `router.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { handleServiceError } from "@/lib/http/apiError";
import { parseBody } from "@/lib/http/parseBody";
import { parseUploadFormFile } from "@/lib/http/uploadFormFile";
import {
  CreateResourceBodySchema,
  UpdateResourceBodySchema,
  toDocumentDto,
  toResourceDto,
} from "./schemas";
import * as services from "./services";

type ResourceContext = { params: Promise<{ resourceId: string }> };
type DocumentContext = { params: Promise<{ id: string }> };

// ── zasoby ──────────────────────────────────────────────────────────────────────

export async function listResources(): Promise<NextResponse> {
  try {
    const resources = await services.getResources();
    return NextResponse.json(resources.map(toResourceDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function createResource(request: NextRequest): Promise<NextResponse> {
  const parsed = await parseBody(request, CreateResourceBodySchema);
  if (parsed.success === false) {
    return parsed.response;
  }
  const { description, url, tags } = parsed.data;
  try {
    const resource = await services.addResource({
      description: description.trim(),
      url: url.trim(),
      tags: tags ?? [],
    });
    return NextResponse.json(toResourceDto(resource), { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function updateResource(
  request: NextRequest,
  ctx: ResourceContext
): Promise<NextResponse> {
  const { resourceId } = await ctx.params;

  const parsed = await parseBody(request, UpdateResourceBodySchema);
  if (parsed.success === false) return parsed.response;
  const { title, description, url, tags, isFavorite } = parsed.data;
  const data: {
    title?: string;
    description?: string;
    url?: string;
    tags?: string[];
    isFavorite?: boolean;
  } = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description.trim();
  if (url !== undefined) data.url = url.trim();
  if (tags !== undefined) data.tags = tags;
  if (isFavorite !== undefined) data.isFavorite = isFavorite;

  try {
    await services.updateResource(resourceId, data);
    const resources = await services.getResources();
    const updated = resources.find((r) => r.id === resourceId);
    return NextResponse.json(updated ? toResourceDto(updated) : { success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteResource(
  _request: NextRequest,
  ctx: ResourceContext
): Promise<NextResponse> {
  const { resourceId } = await ctx.params;
  try {
    await services.deleteResource(resourceId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleServiceError(err);
  }
}

// ── dokumenty i upload ──────────────────────────────────────────────────────────

export async function listDocuments(): Promise<NextResponse> {
  try {
    const docs = await services.listDocuments();
    return NextResponse.json(docs.map(toDocumentDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function deleteDocument(
  _request: NextRequest,
  ctx: DocumentContext
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await services.deleteDocument(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function uploadDocument(request: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const parsed = await parseUploadFormFile(formData);
  if (parsed.ok === false) {
    return parsed.response;
  }
  const { name, type, content } = parsed;
  try {
    const result = await services.ingestDocument({ name, content, type });
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}
```

Uwaga: dzisiejszy `GET /api/resources` to `GET(request)` z nieużywanym argumentem; `listResources()` bez argumentu zachowuje się tak samo, a test woła `GET()`.

- [ ] **Step 6: trasy** (zastąp całą zawartość każdego pliku):

```ts
// app/api/resources/route.ts
export { listResources as GET, createResource as POST } from "@/contexts/bc_resources/router";
```

```ts
// app/api/resources/[resourceId]/route.ts
export { updateResource as PUT, deleteResource as DELETE } from "@/contexts/bc_resources/router";
```

```ts
// app/api/documents/route.ts
export { listDocuments as GET } from "@/contexts/bc_resources/router";
```

```ts
// app/api/documents/[id]/route.ts
export { deleteDocument as DELETE } from "@/contexts/bc_resources/router";
```

```ts
// app/api/upload/route.ts
export { uploadDocument as POST } from "@/contexts/bc_resources/router";
```

- [ ] **Step 7:** `npx vitest run tests/unit/contexts/bc_resources` → PASS (wszystkie, w tym nowe routery i schemas).

---

### Task 4: Usunięcie starej warstwy i przepięcia UI

- [ ] **Step 1:** `git rm services/resourceService.ts services/documentService.ts lib/validation/resources.ts` (repozytoria przeniesione w Task 3).
- [ ] **Step 2:** `lib/firestore-db.ts`: usuń `export type { DocumentRecord, NoteResourceRecord } …`, eksport `documents` i blok `resources`. Zostają tylko `mindMaps` i `board`:

```ts
export {
  getMindMaps,
  getMindMap,
  createMindMap,
  saveMindMap,
  deleteMindMap,
} from "@/lib/nexus/repos/mindMaps";
export { getBoard, saveBoard } from "@/lib/nexus/repos/board";
```

`types/records.ts`: usuń `DocumentRecord` i `NoteResourceRecord` (zostają `MindMap`, `MindMapNode`, `BoardDoc`). `types/index.ts`: `export type { MindMap, MindMapNode } from "./records";`.

- [ ] **Step 3:** UI → `schemas` (reguła 1):
  - `src/features/resources/resourceTypes.ts`: `export type { NoteResourceRecord as NoteResource } from "@/types/records";` → `export type { ResourceDto as NoteResource } from "@/contexts/bc_resources/schemas";`; `export { CreateResourceBodySchema, UpdateResourceBodySchema } from "@/lib/validation/resources";` → `… from "@/contexts/bc_resources/schemas";`;
  - `src/features/resources/ResourceAddForm.tsx:3` i `ResourceEditModal.tsx:3`: `@/lib/validation/resources` → `@/contexts/bc_resources/schemas`.
  - Kontrola: `grep -rn "NoteResourceRecord\|DocumentRecord\|validation/resources\|resourceService\|documentService\|repos/resources\|repos/documents" --include=*.ts --include=*.tsx . | grep -v node_modules | grep -v "^./docs" | grep -v "^./.next"` → pusto.
- [ ] **Step 4:** `tests/unit/lib/nexus/repos-static.test.ts`: w `REPOS` zamień `...["resources", "documents"].map((name) => \`lib/nexus/repos/${name}.ts\`),` na

```ts
  "contexts/bc_resources/repositories/resources.ts",
  "contexts/bc_resources/repositories/documents.ts",
```

a w teście barrel (pętla po `["resources", "documents", "mindMaps", "board"]`) zostaw `["mindMaps", "board"]`. Nie zmieniaj reszty pliku. Jeśli któryś test w tym pliku zakłada konkretny zbiór plików (np. importerzy `vault-fs` albo `markdown-dir`), uruchom go i dopasuj listę do wyniku, wypisz różnice w opisie commita.

- [ ] **Step 5:** weryfikacja przez `cursor`: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Oczekiwane: „przeszło" (w tym `architecture.static.test.ts` bez zmian).
- [ ] **Step 6: Commit B**

```bash
git add -A contexts app lib services types src tests
git status --short | grep -v "^[MADR] " || echo "wszystko w indeksie"
git commit -m "$(cat <<'EOF'
refactor(bc_resources): migracja zasobów, dokumentów i uploadu do contexts/bc_resources (PR 7, 2/2)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Weryfikacja końcowa i review

- [ ] **Step 1:** `git diff main --stat` i `git diff main --name-only | grep architecture` → pusto; `ls services/resourceService.ts services/documentService.ts lib/validation/resources.ts lib/nexus/repos/resources.ts lib/nexus/repos/documents.ts src/components/ResourceSection.tsx src/components/resources 2>&1` → brak plików.
- [ ] **Step 2:** review diffa przez `agy` (`--role review`, tier deep): zgodność statusów i JSON tras z dzisiejszymi (`POST resources` 201, `DELETE resources` 204, `PUT` z fallbackiem, `GET documents` klucze, `upload` 400/200), importy wg reguł 1–9, brak martwych importów, kompletność przeniesienia UI. Opinie weryfikuję w kodzie przed poprawkami.
- [ ] **Step 3:** ręcznie w przeglądarce (`npm run dev`): Planowanie → zasoby (lista, dodanie linku z tagami, edycja, ulubione, filtr tagów, usunięcie) oraz panel dokumentów (wgranie pliku `.txt`, lista, usunięcie). Dopisz do zadania w NEXUS.

### Task 6: Zamknięcie

- [ ] **Step 1:** po zgodzie użytkownika: `git push -u origin feat/pr-7-bc-resources` i `gh pr create` (opis z attribution z systemu).
- [ ] **Step 2:** po mergu: w `../NEXUS/Vault/Projects/monolith/tasks.md` odhaczyć „PR 7", dopisać wpis w Backlogu (`PR 7: migracja domeny zasobów i dokumentów do contexts/bc_resources/ (razem z UI w src/features/resources/), PR #NN — data`), awansować „PR 8: `bc_board`" do Next (z Backlogu zostaje „PR 9 (`bc_mind_maps`), potem PR 10"); commit tylko `tasks.md` (niezacommitowany `index.md` w NEXUS nie jest mój).

---

## Self-review

- **Pokrycie spec:** §2 zakres (zasoby, dokumenty, upload, UI, typy) → zad. 1, 3, 4; §3 struktura (7 plików + folder `repositories/`, zgodność odpowiedzi) → zad. 3 i testy routerów (201, 204, fallback `PUT`, klucze `GET documents`); §4 przepięcia (usunięcia, barrel, typy, `resourceTypes`, formularze, `PlanowanieView`) → zad. 1, 4; §5 testy (5 przeniesionych, 3 nowe, `repos-static`, UI) → zad. 1, 2, 4; §6 dwa commity → zad. 1, 4; §7 ryzyka → testy statusów, `build` w obu commitach, `tsc` dla renamu.
- **Placeholdery:** brak (jedyna kontrola „na miejscu" to ewentualne dopasowanie listy importerów w kroku 4 zad. 4, z jednoznacznym działaniem).
- **Spójność nazw:** `Resource`/`UploadedDocument` w `models`; `ResourceDto`/`DocumentDto`, `toResourceDto`/`toDocumentDto`, `CreateResourceBodySchema`/`UpdateResourceBodySchema` w `schemas`; repozytoria `addResource`/`getResources`/`deleteResource`/`updateResource`/`getDocuments`/`createDocument`/`deleteDocument` (mocki w testach serwisów używają tych samych nazw); serwis: `addResource`, `getResources`, `updateResource`, `deleteResource`, `searchResources`, `listDocuments`, `ingestDocument`, `deleteDocument` (mocki w testach routerów); handlery routera `listResources`/`createResource`/`updateResource`/`deleteResource`/`listDocuments`/`deleteDocument`/`uploadDocument` (re-eksporty w 5 trasach); alias `NoteResource = ResourceDto` w `resourceTypes`.
