# Arsenał, etap 3: Kursy — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zakładka „Kursy” w karcie Arsenał: lista kursów z `Vault/Arsenal/courses.yaml`, dodawanie, edycja i usuwanie z UI, ostrzeżenie o brakującym PDF certyfikatu.

**Architecture:** Kursy dochodzą do istniejącego kontekstu `contexts/bc_arsenal/` (spec Arsenału A2). `repositories.ts` zamienia się w folder `repositories/` (`skills.ts` bez zmian logiki, nowy `courses.ts` na `lib/nexus/yaml-store` i `record-helpers`). Reguły (sortowanie, `completed`, ostrzeżenie o certyfikacie) siedzą w `services.ts`, handlery w `router.ts`, trasy `app/api/arsenal/courses/**`. UI: nowa zakładka `courses` w rejestrze kart (`Alt+7`), widok `CoursesView` z formularzem.

**Tech Stack:** Next.js 14, TypeScript, zod 4, `yaml` przez `lib/nexus/yaml-store.ts`, i18next (nowy namespace `courses`), Vitest + Testing Library.

Spec: `docs/superpowers/specs/2026-11-14-karta-arsenal-design.md` (§4.1, §6, §7 etap 3). Poprzednie plany: `2026-11-14-arsenal-etap-1-zasoby.md`, `2026-11-14-arsenal-etap-2-skille-prompty.md`.

## Decyzje podjęte w planie (do spec §4.1, które mówi tylko o polach)

| #   | Decyzja                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | `url` i `certificate_url` tylko `http:`/`https:` (zod `url()` przepuszcza też `javascript:`; adresy trafiają do `<a href>`). Odczyt: zły `url` = wpis pominięty; zły `certificate_url` = pole odrzucone, wpis zostaje.          |
| K2  | `certificate_file` to ścieżka **względem `Vault/Documents/`** (np. `certyfikaty/mcp.pdf`), nie od korzenia Vaulta. Bez pustych segmentów, `.`, `..`, `\`, litery dysku i `/` na początku. Zła ścieżka z pliku = wpis pominięty. |
| K3  | `completed` (RRRR-MM-DD) tylko przy `ukonczony`. Zapis `ukonczony` bez daty = dzisiejsza data lokalna; zmiana na inny status kasuje `completed`. Zła data z pliku = pole odrzucone, wpis zostaje.                               |
| K4  | Kolejność listy: `w-trakcie`, `plan`, `ukonczony`; w grupie alfabetycznie po tytule (`pl`). Plik nie ma `created`, nie dodajemy go (YAGNI).                                                                                     |
| K5  | `PUT` przyjmuje pełny zestaw pól edytowalnych (jak formularz); puste pole kasuje klucz w pliku.                                                                                                                                 |
| K6  | `certificateMissing` liczy serwer (`services`), UI tylko pokazuje ostrzeżenie. Aplikacja nie serwuje PDF-ów, więc przy certyfikacie-pliku pokazuje samą ścieżkę.                                                                |
| K7  | Test architektury **nie zmienia się**: wpis `contexts/bc_arsenal/repositories` w `VAULT_FS_IMPORTERS` obejmuje folder (regex `repositories(?:\.ts\|\/)`). Jeśli test mimo to pęknie, naprawiamy kodem, nie testem (CLAUDE.md).  |

## Struktura plików

| Plik                                                                                                                       | Zmiana      | Odpowiedzialność                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `contexts/bc_arsenal/repositories.ts` → `repositories/skills.ts`                                                           | przenieś    | dotychczasowy odczyt skilli i promptów (tylko ścieżka importu `../models`)   |
| `contexts/bc_arsenal/repositories/index.ts`                                                                                | nowy        | re-eksport `skills` i `courses`                                              |
| `contexts/bc_arsenal/repositories/courses.ts`                                                                              | nowy        | plik `Arsenal/courses.yaml` ↔ `Course`, zapis, sprawdzenie pliku certyfikatu |
| `contexts/bc_arsenal/models.ts`                                                                                            | edycja      | typy `Course*`, stałe, `isHttpUrl`, `isSafeCertificatePath`                  |
| `contexts/bc_arsenal/schemas.ts`                                                                                           | edycja      | `CourseInputSchema`, DTO i mapery                                            |
| `contexts/bc_arsenal/services.ts`                                                                                          | edycja      | `listCourses`, `createCourse`, `updateCourse`, `deleteCourse`                |
| `contexts/bc_arsenal/router.ts`                                                                                            | edycja      | `getCourses`, `postCourse`, `putCourse`, `removeCourse`                      |
| `app/api/arsenal/courses/route.ts`, `…/[courseId]/route.ts`                                                                | nowe        | re-eksport handlerów                                                         |
| `src/features/arsenal/apiError.ts`                                                                                         | nowy        | wspólne `messageOf`/`errorText` (wyciągnięte z `useArsenal.ts`)              |
| `src/features/arsenal/useCourses.ts`                                                                                       | nowy        | pobieranie i zapis kursów                                                    |
| `src/features/arsenal/CoursesView.tsx`, `CourseForm.tsx`                                                                   | nowe        | widok zakładki                                                               |
| `src/features/arsenal/arsenal.css`                                                                                         | edycja      | klasy `.crs-*`                                                               |
| `src/i18n/locales/{pl,en}/courses.ts`, `resources.ts`, `index.ts`                                                          | nowe/edycja | namespace `courses`                                                          |
| `src/i18n/locales/{pl,en}/planning.ts`, `shell.ts`                                                                         | edycja      | `tabCourses`, `drawer.courses`                                               |
| `src/features/planowanie/planningTab.ts`, `cards/cards.ts`, `PlanowanieView.tsx`, `components/layout/MobileMoreDrawer.tsx` | edycja      | zakładka `courses`                                                           |
| `docs/nexus-vault-formaty-yaml.md`                                                                                         | edycja      | format `Arsenal/courses.yaml`                                                |

Gałąź: `feat/arsenal-etap-3-kursy` z aktualnego `main`.

---

### Task 1: Gałąź i rozbicie `repositories.ts` na folder (bez zmiany zachowania)

**Files:**

- Move: `contexts/bc_arsenal/repositories.ts` → `contexts/bc_arsenal/repositories/skills.ts`
- Create: `contexts/bc_arsenal/repositories/index.ts`

- [ ] **Step 1: Gałąź i zielony punkt wyjścia**

```bash
cd ~/projects/Brain_7224/Monolith
git checkout main && git pull --ff-only
git checkout -b feat/arsenal-etap-3-kursy
npx vitest run tests/unit/contexts/bc_arsenal tests/unit/architecture.static.test.ts
```

Expected: PASS (wszystko zielone przed zmianą).

- [ ] **Step 2: Przenieś plik i popraw import**

```bash
mkdir contexts/bc_arsenal/repositories
git mv contexts/bc_arsenal/repositories.ts contexts/bc_arsenal/repositories/skills.ts
```

W `contexts/bc_arsenal/repositories/skills.ts` zmień blok importu modeli:

```ts
} from "../models";
```

(zamiast `} from "./models";`).

- [ ] **Step 3: Dodaj `index.ts`**

`contexts/bc_arsenal/repositories/index.ts`:

```ts
export * from "./skills";
```

- [ ] **Step 4: Sprawdź, że nic się nie zmieniło**

Run: `npx vitest run tests/unit/contexts/bc_arsenal tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS, tsc bez błędów (`services.ts` importuje `./repositories` i trafia na `index.ts`).

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_arsenal
git commit -m "refactor(arsenal): repositories jako folder (przygotowanie pod kursy)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Model i schematy kursu

**Files:**

- Modify: `contexts/bc_arsenal/models.ts` (dopisz na końcu)
- Modify: `contexts/bc_arsenal/schemas.ts`
- Test: `tests/unit/contexts/bc_arsenal/courses.schemas.test.ts`

- [ ] **Step 1: Napisz czerwony test**

`tests/unit/contexts/bc_arsenal/courses.schemas.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isHttpUrl, isSafeCertificatePath } from "@/contexts/bc_arsenal/models";
import { CourseInputSchema, toCourseDto } from "@/contexts/bc_arsenal/schemas";

describe("isHttpUrl", () => {
  it.each([
    ["https://a.example.com/x", true],
    ["http://a.example.com", true],
    ["javascript:alert(1)", false],
    ["ftp://a.example.com", false],
    ["a.example.com", false],
    ["", false],
  ])("%s → %s", (value, expected) => {
    expect(isHttpUrl(value)).toBe(expected);
  });
});

describe("isSafeCertificatePath", () => {
  it.each([
    ["mcp.pdf", true],
    ["certyfikaty/mcp.pdf", true],
    ["", false],
    ["/etc/passwd", false],
    ["../x.pdf", false],
    ["a/../x.pdf", false],
    ["a//x.pdf", false],
    ["./x.pdf", false],
    ["a/", false],
    ["a\\x.pdf", false],
    ["C:/x.pdf", false],
    ["x\0.pdf", false],
  ])("%j → %s", (value, expected) => {
    expect(isSafeCertificatePath(value)).toBe(expected);
  });
});

const base = { title: "  Kurs MCP ", url: "https://a.example.com", status: "plan" as const };

describe("CourseInputSchema", () => {
  it("przycina teksty, puste pola opcjonalne zamienia na undefined", () => {
    const parsed = CourseInputSchema.parse({ ...base, provider: "  ", note: " uwaga " });
    expect(parsed.title).toBe("Kurs MCP");
    expect(parsed.provider).toBeUndefined();
    expect(parsed.note).toBe("uwaga");
  });

  it("odrzuca pusty tytuł i url spoza http(s)", () => {
    expect(CourseInputSchema.safeParse({ ...base, title: " " }).success).toBe(false);
    expect(CourseInputSchema.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(
      false
    );
    expect(
      CourseInputSchema.safeParse({ ...base, certificateUrl: "ftp://x.example.com" }).success
    ).toBe(false);
  });

  it("odrzuca nieznany status, złą ścieżkę certyfikatu i złą datę", () => {
    expect(CourseInputSchema.safeParse({ ...base, status: "x" }).success).toBe(false);
    expect(CourseInputSchema.safeParse({ ...base, certificateFile: "../x.pdf" }).success).toBe(
      false
    );
    expect(CourseInputSchema.safeParse({ ...base, completed: "2026-02-31" }).success).toBe(false);
  });
});

describe("toCourseDto", () => {
  it("pomija nieustawione pola opcjonalne", () => {
    const dto = toCourseDto({
      id: "c1",
      title: "T",
      url: "https://a.example.com",
      status: "plan",
      certificateMissing: false,
    });
    expect(dto).toEqual({
      id: "c1",
      title: "T",
      url: "https://a.example.com",
      status: "plan",
      certificateMissing: false,
    });
  });
});
```

- [ ] **Step 2: Uruchom i zobacz porażkę**

Run: `npx vitest run tests/unit/contexts/bc_arsenal/courses.schemas.test.ts`
Expected: FAIL (brak eksportów `isHttpUrl`, `CourseInputSchema`…).

- [ ] **Step 3: Dopisz modele**

Na końcu `contexts/bc_arsenal/models.ts`:

```ts
// ── kursy (`Arsenal/courses.yaml`) ───────────────────────────────────────────────

export const COURSES_FILE = "Arsenal/courses.yaml";
export const COURSES_KEY = "courses";
/** Katalog PDF-ów certyfikatów; `certificate_file` jest ścieżką względem niego. */
export const COURSE_CERT_DIR = "Documents";

export const COURSE_STATUSES = ["plan", "w-trakcie", "ukonczony"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export type Course = {
  id: string;
  title: string;
  url: string;
  provider?: string;
  status: CourseStatus;
  /** RRRR-MM-DD, tylko dla `ukonczony`. */
  completed?: string;
  certificateUrl?: string;
  /** Względem `Vault/Documents/`. */
  certificateFile?: string;
  note?: string;
};

/** Pola edytowalne (formularz i `PUT`). */
export type CourseInput = Omit<Course, "id">;

/** Kurs z ostrzeżeniem liczonym przez `services`. */
export type CourseEntry = Course & { certificateMissing: boolean };

export type CourseList = { courses: CourseEntry[]; skipped: number };

/** Tylko `http:` i `https:`: adresy trafiają do `<a href>`. */
export function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Ścieżka względna bez wyjścia poza `Documents/` (K2). */
export function isSafeCertificatePath(path: string): boolean {
  if (path === "" || path.length > 200) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  return path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}
```

- [ ] **Step 4: Dopisz schematy**

W `contexts/bc_arsenal/schemas.ts` zmień import na górze:

```ts
import { z } from "zod";
import { isIsoDay } from "@/lib/schema/archive-date";
import {
  COURSE_STATUSES,
  isHttpUrl,
  isSafeCertificatePath,
  type ArsenalCatalog,
  type ArsenalEntry,
  type CourseEntry,
  type CourseList,
  type DeployInstructions,
  type DeployTarget,
} from "./models";
```

(zastępuje dotychczasowy `import type { ArsenalCatalog, … } from "./models";`) i dopisz na końcu pliku:

```ts
// ── kursy ────────────────────────────────────────────────────────────────────────

export { COURSE_STATUSES };

/** Tekst przycięty; pusty = `undefined` (puste pole formularza kasuje klucz w pliku, K5). */
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((value) => {
      const text = value?.trim();
      return text === "" ? undefined : text;
    });

/** Body `POST /api/arsenal/courses` i `PUT /api/arsenal/courses/[courseId]`. */
export const CourseInputSchema = z
  .object({
    title: z.string().trim().min(1, "title is required").max(200),
    url: z.string().trim().max(2000),
    provider: optionalText(100),
    status: z.enum(COURSE_STATUSES),
    completed: optionalText(10),
    certificateUrl: optionalText(2000),
    certificateFile: optionalText(200),
    note: optionalText(1000),
  })
  .superRefine((course, ctx) => {
    const bad = (field: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [field], message });
    if (!isHttpUrl(course.url)) bad("url", "url must start with http:// or https://");
    if (course.certificateUrl !== undefined && !isHttpUrl(course.certificateUrl)) {
      bad("certificateUrl", "certificateUrl must start with http:// or https://");
    }
    if (course.certificateFile !== undefined && !isSafeCertificatePath(course.certificateFile)) {
      bad("certificateFile", "certificateFile must be a relative path inside Documents/");
    }
    if (course.completed !== undefined && !isIsoDay(course.completed)) {
      bad("completed", "completed must be YYYY-MM-DD");
    }
  });

export type CourseInputDto = z.input<typeof CourseInputSchema>;

export const CourseDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  provider: z.string().optional(),
  status: z.enum(COURSE_STATUSES),
  completed: z.string().optional(),
  certificateUrl: z.string().optional(),
  certificateFile: z.string().optional(),
  certificateMissing: z.boolean(),
  note: z.string().optional(),
});

export const CoursesDtoSchema = z.object({
  courses: z.array(CourseDtoSchema),
  skipped: z.number(),
});

export type CourseDto = z.infer<typeof CourseDtoSchema>;
export type CoursesDto = z.infer<typeof CoursesDtoSchema>;

export function toCourseDto(entry: CourseEntry): CourseDto {
  return {
    id: entry.id,
    title: entry.title,
    url: entry.url,
    status: entry.status,
    certificateMissing: entry.certificateMissing,
    ...(entry.provider !== undefined && { provider: entry.provider }),
    ...(entry.completed !== undefined && { completed: entry.completed }),
    ...(entry.certificateUrl !== undefined && { certificateUrl: entry.certificateUrl }),
    ...(entry.certificateFile !== undefined && { certificateFile: entry.certificateFile }),
    ...(entry.note !== undefined && { note: entry.note }),
  };
}

export function toCoursesDto(list: CourseList): CoursesDto {
  return { courses: list.courses.map(toCourseDto), skipped: list.skipped };
}
```

- [ ] **Step 5: Zielony test**

Run: `npx vitest run tests/unit/contexts/bc_arsenal/courses.schemas.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_arsenal tests/unit/contexts/bc_arsenal/courses.schemas.test.ts
git commit -m "feat(arsenal): model i schematy kursu (walidacja url, certyfikatu i daty)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Repozytorium kursów

**Files:**

- Create: `contexts/bc_arsenal/repositories/courses.ts`
- Modify: `contexts/bc_arsenal/repositories/index.ts`
- Test: `tests/unit/contexts/bc_arsenal/courses.repositories.test.ts`

- [ ] **Step 1: Czerwony test**

`tests/unit/contexts/bc_arsenal/courses.repositories.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { parseYamlList } from "@/lib/nexus/yaml-lists";
import {
  certificateExists,
  insertCourse,
  readCourses,
  removeCourse,
  replaceCourse,
} from "@/contexts/bc_arsenal/repositories";
import { setupTempVault } from "../../helpers/tempVault";

const FILE = "Arsenal/courses.yaml";
const vault = setupTempVault();

const HAND_WRITTEN = `version: 1
courses:
  - id: c1
    title: Kurs MCP
    url: https://a.example.com
    provider: Udemy
    status: ukonczony
    completed: 2026-03-01
    certificate_url: https://a.example.com/cert
    certificate_file: certyfikaty/mcp.pdf
    note: Ręczna notatka
    x_extra: zostaje
  - id: c2
    title: Bez statusu
    url: https://b.example.com
  - id: c3
    title: Zły adres
    url: javascript:alert(1)
    status: plan
  - id: c4
    title: Zła ścieżka certyfikatu
    url: https://c.example.com
    status: plan
    certificate_file: ../tajne.pdf
  - id: c5
    title: Zła data i zły link certyfikatu
    url: https://d.example.com
    status: w-trakcie
    completed: kiedyś
    certificate_url: ftp://x.example.com
`;

const stored = () => parseYamlList(vault.read(FILE)!, "courses").items;

describe("readCourses", () => {
  it("brak pliku = pusta lista", () => {
    expect(readCourses()).toEqual({ courses: [], skipped: 0 });
  });

  it("mapuje poprawne wpisy i liczy pominięte (brak statusu, zły url, zła ścieżka)", () => {
    vault.write(FILE, HAND_WRITTEN);
    const { courses, skipped } = readCourses();
    expect(skipped).toBe(3);
    expect(courses.map((c) => c.id)).toEqual(["c1", "c5"]);
    expect(courses[0]).toEqual({
      id: "c1",
      title: "Kurs MCP",
      url: "https://a.example.com",
      provider: "Udemy",
      status: "ukonczony",
      completed: "2026-03-01",
      certificateUrl: "https://a.example.com/cert",
      certificateFile: "certyfikaty/mcp.pdf",
      note: "Ręczna notatka",
    });
  });

  it("zła data i zły link certyfikatu odrzuca tylko pole, wpis zostaje", () => {
    vault.write(FILE, HAND_WRITTEN);
    const c5 = readCourses().courses.find((c) => c.id === "c5")!;
    expect(c5.completed).toBeUndefined();
    expect(c5.certificateUrl).toBeUndefined();
    expect(c5.status).toBe("w-trakcie");
  });
});

describe("insertCourse", () => {
  it("dopisuje wpis z wygenerowanym id i pomija puste pola", async () => {
    const course = await insertCourse({
      title: "Nowy",
      url: "https://n.example.com",
      status: "plan",
    });
    expect(course.id).toMatch(/^[A-Za-z0-9]{20}$/);
    const [item] = stored();
    expect(item).toMatchObject({ title: "Nowy", url: "https://n.example.com", status: "plan" });
    expect("provider" in item).toBe(false);
    expect("completed" in item).toBe(false);
  });
});

describe("replaceCourse", () => {
  it("zastępuje pola edytowalne, puste kasuje, nieznane klucze zostają", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await replaceCourse("c1", {
      title: "Kurs MCP 2",
      url: "https://a.example.com",
      status: "plan",
    });
    const item = stored().find((i) => i.id === "c1")!;
    expect(item.title).toBe("Kurs MCP 2");
    expect(item.status).toBe("plan");
    for (const key of ["provider", "completed", "certificate_url", "certificate_file", "note"]) {
      expect(key in item).toBe(false);
    }
    expect(item.x_extra).toBe("zostaje");
    expect(stored()).toHaveLength(5); // pominięte wpisy przeżywają zapis
  });

  it("nieistniejące id to DomainError 404", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await expect(
      replaceCourse("brak", { title: "T", url: "https://a.example.com", status: "plan" })
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      replaceCourse("brak", { title: "T", url: "https://a.example.com", status: "plan" })
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("removeCourse", () => {
  it("usuwa wpis; brak wpisu nie zmienia pliku", async () => {
    vault.write(FILE, HAND_WRITTEN);
    await removeCourse("c1");
    expect(stored().map((i) => i.id)).toEqual(["c2", "c3", "c4", "c5"]);
    const before = vault.read(FILE);
    await removeCourse("brak");
    expect(vault.read(FILE)).toBe(before);
  });
});

describe("certificateExists", () => {
  it("sprawdza plik w Documents/", () => {
    vault.write("Documents/certyfikaty/mcp.pdf", "x");
    expect(certificateExists("certyfikaty/mcp.pdf")).toBe(true);
    expect(certificateExists("certyfikaty/brak.pdf")).toBe(false);
  });
});
```

- [ ] **Step 2: Czerwono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal/courses.repositories.test.ts`
Expected: FAIL (brak eksportów).

- [ ] **Step 3: Implementacja**

`contexts/bc_arsenal/repositories/courses.ts`:

```ts
import type { YamlRecord } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  appendRecord,
  generateId,
  optStr,
  patchRecord,
  removeRecord,
} from "@/lib/nexus/record-helpers";
import { isIsoDay } from "@/lib/schema/archive-date";
import { vaultFileMtimeMs } from "@/lib/nexus/vault-fs";
import {
  COURSES_FILE,
  COURSES_KEY,
  COURSE_CERT_DIR,
  COURSE_STATUSES,
  isHttpUrl,
  isSafeCertificatePath,
  type Course,
  type CourseInput,
  type CourseStatus,
} from "../models";

const isStatus = (value: unknown): value is CourseStatus =>
  typeof value === "string" && (COURSE_STATUSES as readonly string[]).includes(value);

/** `null` = wpis uszkodzony (brak id/tytułu/statusu, zły `url` lub ścieżka certyfikatu). */
function toCourse(record: YamlRecord): Course | null {
  const id = optStr(record.id);
  const title = optStr(record.title);
  const url = optStr(record.url);
  if (id === undefined || title === undefined || url === undefined) return null;
  if (!isStatus(record.status) || !isHttpUrl(url)) return null;
  const certificateFile = optStr(record.certificate_file);
  if (certificateFile !== undefined && !isSafeCertificatePath(certificateFile)) return null;
  const completed = optStr(record.completed);
  const certificateUrl = optStr(record.certificate_url);
  const provider = optStr(record.provider);
  const note = optStr(record.note);
  return {
    id,
    title,
    url,
    status: record.status,
    ...(provider !== undefined && { provider }),
    ...(completed !== undefined && isIsoDay(completed) && { completed }),
    ...(certificateUrl !== undefined && isHttpUrl(certificateUrl) && { certificateUrl }),
    ...(certificateFile !== undefined && { certificateFile }),
    ...(note !== undefined && { note }),
  };
}

/** Klucze pliku; `undefined` kasuje klucz przy `patchRecord` i jest pomijane przy dopisywaniu. */
function toFields(input: CourseInput): Record<string, unknown> {
  return {
    title: input.title,
    url: input.url,
    provider: input.provider,
    status: input.status,
    completed: input.completed,
    certificate_url: input.certificateUrl,
    certificate_file: input.certificateFile,
    note: input.note,
  };
}

export function readCourses(): { courses: Course[]; skipped: number } {
  const courses: Course[] = [];
  let skipped = 0;
  for (const record of readList(COURSES_FILE, COURSES_KEY)) {
    const course = toCourse(record);
    if (course === null) skipped += 1;
    else courses.push(course);
  }
  return { courses, skipped };
}

export async function insertCourse(input: CourseInput): Promise<Course> {
  const record = await appendRecord(COURSES_FILE, COURSES_KEY, (taken) => ({
    id: generateId(taken),
    ...toFields(input),
  }));
  const course = toCourse(record);
  if (course === null) throw new Error("Zapisany kurs jest niepoprawny"); // walidacja jest w schemacie
  return course;
}

export async function replaceCourse(id: string, input: CourseInput): Promise<void> {
  await patchRecord(COURSES_FILE, COURSES_KEY, id, toFields(input), "Kurs nie istnieje");
}

export async function removeCourse(id: string): Promise<void> {
  await removeRecord(COURSES_FILE, COURSES_KEY, id);
}

/** Czy PDF certyfikatu leży w `Vault/Documents/` (`rel` względem tego katalogu). */
export function certificateExists(rel: string): boolean {
  return vaultFileMtimeMs(`${COURSE_CERT_DIR}/${rel}`) !== null;
}
```

`contexts/bc_arsenal/repositories/index.ts`:

```ts
export * from "./skills";
export * from "./courses";
```

- [ ] **Step 4: Zielono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS. Jeśli test architektury pęknie na `repositories/courses.ts` (np. import `lib/nexus/yaml-store`), naprawiamy kod (K7), nie test.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_arsenal tests/unit/contexts/bc_arsenal/courses.repositories.test.ts
git commit -m "feat(arsenal): repozytorium kursów (Arsenal/courses.yaml)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Serwis kursów

**Files:**

- Modify: `contexts/bc_arsenal/services.ts`
- Test: `tests/unit/contexts/bc_arsenal/courses.services.test.ts`

- [ ] **Step 1: Czerwony test**

`tests/unit/contexts/bc_arsenal/courses.services.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/contexts/bc_arsenal/models";

const repo = vi.hoisted(() => ({
  readCourses: vi.fn(),
  insertCourse: vi.fn(),
  replaceCourse: vi.fn(),
  removeCourse: vi.fn(),
  certificateExists: vi.fn(),
}));
vi.mock("@/contexts/bc_arsenal/repositories", () => ({
  readPromptFiles: vi.fn(),
  readSkillFiles: vi.fn(),
  readTemplates: vi.fn(),
  writeDeployed: vi.fn(),
  ...repo,
}));
vi.mock("@/contexts/bc_projects/services", () => ({
  listProjects: vi.fn(),
  hasCompanyData: vi.fn(),
}));

import {
  createCourse,
  deleteCourse,
  listCourses,
  updateCourse,
} from "@/contexts/bc_arsenal/services";

const course = (over: Partial<Course> & { id: string }): Course => ({
  title: "T",
  url: "https://a.example.com",
  status: "plan",
  ...over,
});

beforeEach(() => {
  Object.values(repo).forEach((fn) => fn.mockReset());
  repo.certificateExists.mockReturnValue(true);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 15, 12, 0, 0)); // 2026-11-15 lokalnie
});
afterEach(() => vi.useRealTimers());

describe("listCourses", () => {
  it("sortuje: w-trakcie, plan, ukonczony; w grupie po tytule (pl)", () => {
    repo.readCourses.mockReturnValue({
      courses: [
        course({ id: "1", title: "Żółw", status: "plan" }),
        course({ id: "2", title: "Zebra", status: "ukonczony" }),
        course({ id: "3", title: "Beta", status: "w-trakcie" }),
        course({ id: "4", title: "Alfa", status: "plan" }),
      ],
      skipped: 2,
    });
    const list = listCourses();
    expect(list.courses.map((c) => c.id)).toEqual(["3", "4", "1", "2"]);
    expect(list.skipped).toBe(2);
  });

  it("certificateMissing tylko dla kursu z plikiem, którego brak", () => {
    repo.certificateExists.mockImplementation((rel: string) => rel === "jest.pdf");
    repo.readCourses.mockReturnValue({
      courses: [
        course({ id: "a", certificateFile: "jest.pdf" }),
        course({ id: "b", certificateFile: "brak.pdf" }),
        course({ id: "c" }),
      ],
      skipped: 0,
    });
    const byId = Object.fromEntries(listCourses().courses.map((c) => [c.id, c.certificateMissing]));
    expect(byId).toEqual({ a: false, b: true, c: false });
  });

  it("błąd sprawdzania pliku liczy się jako brak pliku, lista się ładuje", () => {
    repo.certificateExists.mockImplementation(() => {
      throw new Error("EACCES");
    });
    repo.readCourses.mockReturnValue({
      courses: [course({ id: "a", certificateFile: "x.pdf" })],
      skipped: 0,
    });
    expect(listCourses().courses[0].certificateMissing).toBe(true);
  });
});

describe("createCourse", () => {
  it("ukończony bez daty dostaje dzisiejszą datę", async () => {
    repo.insertCourse.mockImplementation(async (input) => ({ id: "new", ...input }));
    const created = await createCourse({
      title: "T",
      url: "https://a.example.com",
      status: "ukonczony",
    });
    expect(repo.insertCourse).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ukonczony", completed: "2026-11-15" })
    );
    expect(created.completed).toBe("2026-11-15");
  });

  it("ukończony z datą zachowuje datę, inny status kasuje datę", async () => {
    repo.insertCourse.mockImplementation(async (input) => ({ id: "new", ...input }));
    await createCourse({
      title: "T",
      url: "https://a.example.com",
      status: "ukonczony",
      completed: "2026-01-02",
    });
    expect(repo.insertCourse).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: "2026-01-02" })
    );
    await createCourse({
      title: "T",
      url: "https://a.example.com",
      status: "plan",
      completed: "2026-01-02",
    });
    expect(repo.insertCourse.mock.calls.at(-1)![0].completed).toBeUndefined();
  });
});

describe("updateCourse", () => {
  it("zapisuje i zwraca świeży wpis z ostrzeżeniem", async () => {
    repo.replaceCourse.mockResolvedValue(undefined);
    repo.readCourses.mockReturnValue({
      courses: [course({ id: "c1", title: "Po zmianie", certificateFile: "x.pdf" })],
      skipped: 0,
    });
    repo.certificateExists.mockReturnValue(false);
    const updated = await updateCourse("c1", {
      title: "Po zmianie",
      url: "https://a.example.com",
      status: "plan",
      certificateFile: "x.pdf",
    });
    expect(updated).toMatchObject({ id: "c1", title: "Po zmianie", certificateMissing: true });
  });

  it("kurs, który zniknął po zapisie, to 404", async () => {
    repo.replaceCourse.mockResolvedValue(undefined);
    repo.readCourses.mockReturnValue({ courses: [], skipped: 0 });
    await expect(
      updateCourse("c1", { title: "T", url: "https://a.example.com", status: "plan" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("deleteCourse", () => {
  it("deleguje do repozytorium", async () => {
    repo.removeCourse.mockResolvedValue(undefined);
    await deleteCourse("c1");
    expect(repo.removeCourse).toHaveBeenCalledWith("c1");
  });
});
```

- [ ] **Step 2: Czerwono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal/courses.services.test.ts`
Expected: FAIL (brak `listCourses` itd.).

- [ ] **Step 3: Implementacja**

W `contexts/bc_arsenal/services.ts` zmień importy na górze:

```ts
import { hasCompanyData, listProjects } from "@/contexts/bc_projects/services";
import { DomainError } from "@/lib/errors";
import { localIsoDate } from "@/lib/schema/archive-date";
import {
  SUMMARY_MAX,
  WORK_TARGET_NOTE,
  type ArsenalCatalog,
  type Course,
  type CourseEntry,
  type CourseInput,
  type CourseList,
  type CourseStatus,
  type DeployInstructions,
  type DeployMode,
  type DeployTarget,
  type Deployment,
  type PromptEntry,
  type RawFile,
  type SkillEntry,
} from "./models";
import {
  certificateExists,
  insertCourse,
  readCourses,
  readPromptFiles,
  readSkillFiles,
  readTemplates,
  removeCourse,
  replaceCourse,
  writeDeployed,
} from "./repositories";
```

(zachowaj wszystko, co istniało między importami a kodem; zmieniają się tylko te dwa bloki importów) i dopisz na końcu pliku:

```ts
// ── kursy ────────────────────────────────────────────────────────────────────────

const STATUS_RANK: Record<CourseStatus, number> = { "w-trakcie": 0, plan: 1, ukonczony: 2 };

function withWarning(course: Course): CourseEntry {
  let missing = false;
  if (course.certificateFile !== undefined) {
    try {
      missing = !certificateExists(course.certificateFile);
    } catch {
      missing = true; // błąd odczytu nie psuje listy, tylko pokazuje ostrzeżenie
    }
  }
  return { ...course, certificateMissing: missing };
}

/** `completed` tylko dla `ukonczony`; brak daty = dziś (K3). */
function applyStatusRules(input: CourseInput): CourseInput {
  if (input.status !== "ukonczony") return { ...input, completed: undefined };
  return { ...input, completed: input.completed ?? localIsoDate(new Date()) };
}

export function listCourses(): CourseList {
  const { courses, skipped } = readCourses();
  const entries = courses
    .map(withWarning)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || cmp(a.title, b.title));
  return { courses: entries, skipped };
}

export async function createCourse(input: CourseInput): Promise<CourseEntry> {
  return withWarning(await insertCourse(applyStatusRules(input)));
}

export async function updateCourse(id: string, input: CourseInput): Promise<CourseEntry> {
  await replaceCourse(id, applyStatusRules(input));
  const found = readCourses().courses.find((course) => course.id === id);
  if (found === undefined) throw new DomainError("Kurs nie istnieje", 404);
  return withWarning(found);
}

export async function deleteCourse(id: string): Promise<void> {
  await removeCourse(id);
}
```

(`cmp` już istnieje na górze pliku.)

- [ ] **Step 4: Zielono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_arsenal tests/unit/contexts/bc_arsenal/courses.services.test.ts
git commit -m "feat(arsenal): serwis kursów (sortowanie, data ukończenia, ostrzeżenie o certyfikacie)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Router i trasy API

**Files:**

- Modify: `contexts/bc_arsenal/router.ts`
- Create: `app/api/arsenal/courses/route.ts`, `app/api/arsenal/courses/[courseId]/route.ts`
- Test: `tests/unit/contexts/bc_arsenal/courses.router.test.ts`

- [ ] **Step 1: Czerwony test**

`tests/unit/contexts/bc_arsenal/courses.router.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const svc = vi.hoisted(() => ({
  listCourses: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  deleteCourse: vi.fn(),
}));
vi.mock("@/contexts/bc_arsenal/services", () => svc);

import { getCourses, postCourse, putCourse, removeCourse } from "@/contexts/bc_arsenal/router";

const entry = {
  id: "c1",
  title: "T",
  url: "https://a.example.com",
  status: "plan" as const,
  certificateMissing: false,
};
const ctx = { params: Promise.resolve({ courseId: "c1" }) };
const req = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/arsenal/courses", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const valid = { title: " T ", url: "https://a.example.com", status: "plan" };

beforeEach(() => Object.values(svc).forEach((fn) => fn.mockReset()));

describe("getCourses", () => {
  it("200 z DTO", async () => {
    svc.listCourses.mockReturnValue({ courses: [entry], skipped: 1 });
    const res = await getCourses();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ courses: [entry], skipped: 1 });
  });

  it("błąd domenowy zachowuje status", async () => {
    svc.listCourses.mockImplementation(() => {
      throw new DomainError("źle", 409);
    });
    expect((await getCourses()).status).toBe(409);
  });
});

describe("postCourse", () => {
  it("201 i przycięte dane do serwisu", async () => {
    svc.createCourse.mockResolvedValue(entry);
    const res = await postCourse(req(valid));
    expect(res.status).toBe(201);
    expect(svc.createCourse).toHaveBeenCalledWith(expect.objectContaining({ title: "T" }));
  });

  it("400 dla adresu javascript: i dla pustego tytułu", async () => {
    expect((await postCourse(req({ ...valid, url: "javascript:alert(1)" }))).status).toBe(400);
    expect((await postCourse(req({ ...valid, title: "" }))).status).toBe(400);
    expect(svc.createCourse).not.toHaveBeenCalled();
  });
});

describe("putCourse", () => {
  it("200 z DTO", async () => {
    svc.updateCourse.mockResolvedValue(entry);
    const res = await putCourse(req(valid, "PUT"), ctx);
    expect(res.status).toBe(200);
    expect(svc.updateCourse).toHaveBeenCalledWith("c1", expect.objectContaining({ title: "T" }));
  });

  it("404 gdy serwis zgłasza brak kursu", async () => {
    svc.updateCourse.mockRejectedValue(new DomainError("Kurs nie istnieje", 404));
    expect((await putCourse(req(valid, "PUT"), ctx)).status).toBe(404);
  });
});

describe("removeCourse", () => {
  it("204", async () => {
    svc.deleteCourse.mockResolvedValue(undefined);
    const res = await removeCourse(new Request("http://localhost/x", { method: "DELETE" }), ctx);
    expect(res.status).toBe(204);
    expect(svc.deleteCourse).toHaveBeenCalledWith("c1");
  });
});
```

- [ ] **Step 2: Czerwono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal/courses.router.test.ts`
Expected: FAIL (brak eksportów w routerze).

- [ ] **Step 3: Router**

W `contexts/bc_arsenal/router.ts` rozszerz import schematów o `CourseInputSchema`, `toCourseDto`, `toCoursesDto` i dopisz na końcu pliku:

```ts
type CourseContext = { params: Promise<{ courseId: string }> };

export async function getCourses(): Promise<NextResponse> {
  try {
    return NextResponse.json(toCoursesDto(services.listCourses()));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function postCourse(request: Request): Promise<NextResponse> {
  const parsed = await parseBody(request, CourseInputSchema);
  if (parsed.success === false) return parsed.response;
  try {
    return NextResponse.json(toCourseDto(await services.createCourse(parsed.data)), {
      status: 201,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function putCourse(request: Request, ctx: CourseContext): Promise<NextResponse> {
  const parsed = await parseBody(request, CourseInputSchema);
  if (parsed.success === false) return parsed.response;
  try {
    const { courseId } = await ctx.params;
    return NextResponse.json(toCourseDto(await services.updateCourse(courseId, parsed.data)));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function removeCourse(_request: Request, ctx: CourseContext): Promise<NextResponse> {
  try {
    const { courseId } = await ctx.params;
    await services.deleteCourse(courseId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleServiceError(err);
  }
}
```

Import na górze pliku ma po zmianie postać:

```ts
import {
  CourseInputSchema,
  DeployQuerySchema,
  MarkDeployedBodySchema,
  toCatalogDto,
  toCourseDto,
  toCoursesDto,
  toEntryDto,
  toInstructionsDto,
} from "./schemas";
```

- [ ] **Step 4: Trasy**

`app/api/arsenal/courses/route.ts`:

```ts
export { getCourses as GET, postCourse as POST } from "@/contexts/bc_arsenal/router";
```

`app/api/arsenal/courses/[courseId]/route.ts`:

```ts
export { putCourse as PUT, removeCourse as DELETE } from "@/contexts/bc_arsenal/router";
```

- [ ] **Step 5: Zielono**

Run: `npx vitest run tests/unit/contexts/bc_arsenal tests/unit/architecture.static.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_arsenal app/api/arsenal/courses tests/unit/contexts/bc_arsenal/courses.router.test.ts
git commit -m "feat(arsenal): API kursów (GET/POST /api/arsenal/courses, PUT/DELETE …/[courseId])

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tłumaczenia (namespace `courses`) i etykiety zakładki

**Files:**

- Create: `src/i18n/locales/pl/courses.ts`, `src/i18n/locales/en/courses.ts`
- Modify: `src/i18n/resources.ts`, `src/i18n/index.ts`, `src/i18n/locales/{pl,en}/planning.ts`, `src/i18n/locales/{pl,en}/shell.ts`

Test: istniejący `tests/unit/i18n/parity.test.ts` (parytet kluczy PL/EN i brak pustych wartości) — to jest czerwony test tego zadania.

- [ ] **Step 1: Zarejestruj namespace (test parytetu pęknie)**

W `src/i18n/resources.ts` dodaj `import { courses as plCourses } from "./locales/pl/courses";` i `import { courses as enCourses } from "./locales/en/courses";`, a w obiektach `pl` i `en` po `arsenal` wpis `courses: plCourses,` / `courses: enCourses,`. W `src/i18n/index.ts` do tablicy `ns` dodaj `"courses"` po `"arsenal"`.

Run: `npx vitest run tests/unit/i18n/parity.test.ts`
Expected: FAIL (brak plików słowników).

- [ ] **Step 2: Słowniki**

`src/i18n/locales/pl/courses.ts`:

```ts
export const courses = {
  title: "Kursy",
  count_one: "{{count}} kurs",
  count_few: "{{count}} kursy",
  count_many: "{{count}} kursów",
  count_other: "{{count}} kursu",
  skippedSuffix: " · pominięto {{count}} (uszkodzone wpisy)",
  loading: "Ładowanie",
  errorGeneric: "Nie udało się wykonać operacji",
  errorStatus: "Błąd serwera ({{status}})",
  statsAria: "Statystyki kursów",
  tileInProgress: "W trakcie",
  tilePlanned: "Zaplanowane",
  tileDone: "Ukończone",
  tileInProgressMeta: "kursy, które teraz robisz",
  tilePlannedMeta: "na później",
  tileDoneMeta: "z datą ukończenia",
  filterAria: "Status kursu",
  filterAll: "wszystkie",
  statusPlan: "Plan",
  statusInProgress: "W trakcie",
  statusDone: "Ukończony",
  add: "Dodaj kurs",
  edit: "Edytuj",
  delete: "Usuń",
  deleteConfirm: "Usunąć kurs „{{title}}”?",
  save: "Zapisz",
  cancel: "Anuluj",
  formAddTitle: "Nowy kurs",
  formEditTitle: "Edycja kursu",
  fieldTitle: "Tytuł",
  fieldUrl: "Adres kursu (http/https)",
  fieldProvider: "Dostawca",
  fieldStatus: "Status",
  fieldCompleted: "Data ukończenia",
  fieldCertificateUrl: "Link do certyfikatu (http/https)",
  fieldCertificateFile: "Plik certyfikatu w Vault/Documents/",
  fieldCertificateFileHint: "Ścieżka względna, np. certyfikaty/mcp.pdf. PDF wrzucasz ręcznie.",
  fieldNote: "Notatka",
  empty: "Brak kursów. Dodaj pierwszy.",
  emptyFilter: "Brak kursów o tym statusie.",
  open: "Otwórz kurs",
  completedOn: "Ukończono {{date}}",
  certificateLink: "Certyfikat",
  certificateFile: "Plik: {{path}}",
  certificateMissing: "brak pliku w Vault/Documents/",
};
```

`src/i18n/locales/en/courses.ts`:

```ts
export const courses = {
  title: "Courses",
  count_one: "{{count}} course",
  count_other: "{{count}} courses",
  skippedSuffix: " · skipped {{count}} (corrupt entries)",
  loading: "Loading",
  errorGeneric: "The operation failed",
  errorStatus: "Server error ({{status}})",
  statsAria: "Course statistics",
  tileInProgress: "In progress",
  tilePlanned: "Planned",
  tileDone: "Completed",
  tileInProgressMeta: "courses you are taking now",
  tilePlannedMeta: "for later",
  tileDoneMeta: "with a completion date",
  filterAria: "Course status",
  filterAll: "all",
  statusPlan: "Planned",
  statusInProgress: "In progress",
  statusDone: "Completed",
  add: "Add course",
  edit: "Edit",
  delete: "Delete",
  deleteConfirm: "Delete the course “{{title}}”?",
  save: "Save",
  cancel: "Cancel",
  formAddTitle: "New course",
  formEditTitle: "Edit course",
  fieldTitle: "Title",
  fieldUrl: "Course URL (http/https)",
  fieldProvider: "Provider",
  fieldStatus: "Status",
  fieldCompleted: "Completion date",
  fieldCertificateUrl: "Certificate link (http/https)",
  fieldCertificateFile: "Certificate file in Vault/Documents/",
  fieldCertificateFileHint: "Relative path, e.g. certyfikaty/mcp.pdf. You add the PDF by hand.",
  fieldNote: "Note",
  empty: "No courses yet. Add the first one.",
  emptyFilter: "No courses with this status.",
  open: "Open course",
  completedOn: "Completed {{date}}",
  certificateLink: "Certificate",
  certificateFile: "File: {{path}}",
  certificateMissing: "file missing in Vault/Documents/",
};
```

- [ ] **Step 3: Etykiety zakładki**

`src/i18n/locales/pl/planning.ts`: po `tabSkills: "Skille i prompty",` dodaj `tabCourses: "Kursy",`. W `en/planning.ts` analogicznie `tabCourses: "Courses",`.

`src/i18n/locales/pl/shell.ts`: w obiekcie `drawer` po `skills: "Skille i prompty",` dodaj `courses: "Kursy",`. W `en/shell.ts` `courses: "Courses",`.

- [ ] **Step 4: Zielono**

Run: `npx vitest run tests/unit/i18n && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "feat(i18n): namespace courses (PL/EN) i etykiety zakładki Kursy

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hook `useCourses` (i wspólne `apiError`)

**Files:**

- Create: `src/features/arsenal/apiError.ts`, `src/features/arsenal/useCourses.ts`
- Modify: `src/features/arsenal/useArsenal.ts`
- Test: `tests/unit/features/arsenal/useCourses.test.tsx`

- [ ] **Step 1: Czerwony test**

`tests/unit/features/arsenal/useCourses.test.tsx`:

```ts
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCourses } from "@/src/features/arsenal/useCourses";

const list = {
  courses: [
    {
      id: "c1",
      title: "Kurs",
      url: "https://a.example.com",
      status: "plan",
      certificateMissing: false,
    },
  ],
  skipped: 1,
};
const json = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

function setup(handler?: (url: string, init?: RequestInit) => Response) {
  const apiFetch = vi.fn(async (url: string, init?: RequestInit) =>
    handler ? handler(url, init) : json(list)
  );
  return { apiFetch, ...renderHook(() => useCourses(apiFetch)) };
}

const input = { title: "Nowy", url: "https://n.example.com", status: "plan" as const };

describe("useCourses", () => {
  it("ładuje listę i licznik pominiętych", async () => {
    const { result, apiFetch } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiFetch).toHaveBeenCalledWith("/api/arsenal/courses");
    expect(result.current.courses.map((c) => c.id)).toEqual(["c1"]);
    expect(result.current.skipped).toBe(1);
  });

  it("błąd ładowania trafia do `error`", async () => {
    const { result } = setup(() => json({ error: "Zepsute" }, false, 500));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Zepsute");
  });

  it("save bez id robi POST, z id robi PUT, potem odświeża listę", async () => {
    const { result, apiFetch } = setup((_url, init) => json(init?.method ? {} : list));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.save(input));
    const post = apiFetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe("/api/arsenal/courses");
    expect(JSON.parse(post[1]!.body as string)).toEqual(input);
    await act(() => result.current.save(input, "c1"));
    expect(
      apiFetch.mock.calls.some(
        ([url, init]) => url === "/api/arsenal/courses/c1" && init?.method === "PUT"
      )
    ).toBe(true);
    expect(apiFetch.mock.calls.filter(([, init]) => init === undefined)).toHaveLength(3);
  });

  it("save przy błędzie serwera rzuca z komunikatem serwera", async () => {
    const { result } = setup((_url, init) =>
      init?.method === "POST" ? json({ error: "Zły adres" }, false, 400) : json(list)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(act(() => result.current.save(input))).rejects.toThrow("Zły adres");
  });

  it("remove robi DELETE i odświeża listę", async () => {
    const { result, apiFetch } = setup((_url, init) =>
      init?.method === "DELETE" ? ({ ok: true, status: 204 } as Response) : json(list)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.remove("c1"));
    expect(
      apiFetch.mock.calls.some(
        ([url, init]) => url === "/api/arsenal/courses/c1" && init?.method === "DELETE"
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Czerwono**

Run: `npx vitest run tests/unit/features/arsenal/useCourses.test.tsx`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Wyciągnij wspólny kod błędów**

`src/features/arsenal/apiError.ts`:

```ts
import i18n from "@/src/i18n";

export const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : i18n.t("arsenal:arsenalErrorGeneric");

export async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string"
    ? body.error
    : i18n.t("arsenal:arsenalErrorStatus", { status: res.status });
}
```

W `src/features/arsenal/useArsenal.ts` usuń lokalne `messageOf` i `errorText` (linie od `const messageOf` do końca `errorText`), usuń `import i18n from "@/src/i18n";` **tylko jeśli** nie jest już używany (jest: `i18n.t("arsenal:arsenalRefreshFailed"…)`, więc zostaje) i dodaj `import { errorText, messageOf } from "./apiError";`.

- [ ] **Step 4: Hook**

`src/features/arsenal/useCourses.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import {
  CoursesDtoSchema,
  type CourseDto,
  type CourseInputDto,
} from "@/contexts/bc_arsenal/schemas";
import { errorText, messageOf } from "./apiError";
import type { ApiFetch } from "./useArsenal";

const BASE = "/api/arsenal/courses";

export function useCourses(apiFetch: ApiFetch) {
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const res = await apiFetch(BASE);
    if (!res.ok) throw new Error(await errorText(res));
    const data = CoursesDtoSchema.parse(await res.json());
    setCourses(data.courses);
    setSkipped(data.skipped);
    setError(null);
  }, [apiFetch]);

  useEffect(() => {
    refetch()
      .catch((err) => setError(messageOf(err)))
      .finally(() => setLoading(false));
  }, [refetch]);

  /** Bez `id` tworzy kurs (POST), z `id` zapisuje zmiany (PUT); błąd rzuca z komunikatem serwera. */
  const save = useCallback(
    async (input: CourseInputDto, id?: string): Promise<void> => {
      const res = await apiFetch(id === undefined ? BASE : `${BASE}/${encodeURIComponent(id)}`, {
        method: id === undefined ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await errorText(res));
      await refetch();
    },
    [apiFetch, refetch]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const res = await apiFetch(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorText(res));
      await refetch();
    },
    [apiFetch, refetch]
  );

  return { courses, skipped, loading, error, save, remove };
}
```

- [ ] **Step 5: Zielono (hook i regresja Arsenału)**

Run: `npx vitest run tests/unit/features/arsenal && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/arsenal tests/unit/features/arsenal/useCourses.test.tsx
git commit -m "feat(arsenal): hook useCourses; wspólne apiError dla zakładek Arsenału

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Widok `CoursesView` i formularz

**Files:**

- Create: `src/features/arsenal/CoursesView.tsx`, `src/features/arsenal/CourseForm.tsx`
- Modify: `src/features/arsenal/arsenal.css` (dopisz na końcu)
- Test: `tests/unit/features/arsenal/CoursesView.test.tsx`

- [ ] **Step 1: Czerwony test**

`tests/unit/features/arsenal/CoursesView.test.tsx`:

```tsx
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoursesView } from "@/src/features/arsenal/CoursesView";
import { setLanguage } from "@/src/i18n";

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await act(async () => {
    await setLanguage("pl");
  });
});

const list = {
  courses: [
    {
      id: "c1",
      title: "Next.js App Router",
      url: "https://a.example.com",
      provider: "Udemy",
      status: "w-trakcie",
      certificateMissing: false,
    },
    {
      id: "c2",
      title: "Plan na później",
      url: "https://b.example.com",
      status: "plan",
      certificateMissing: false,
    },
    {
      id: "c3",
      title: "MCP w praktyce",
      url: "https://c.example.com",
      status: "ukonczony",
      completed: "2026-03-01",
      certificateUrl: "https://c.example.com/cert",
      certificateFile: "certyfikaty/mcp.pdf",
      certificateMissing: true,
      note: "Warto wrócić",
    },
  ],
  skipped: 0,
};

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

function setup() {
  const apiFetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "DELETE"
      ? ({ ok: true, status: 204 } as Response)
      : json(init?.method ? {} : list)
  );
  render(<CoursesView apiFetch={apiFetch} />);
  return apiFetch;
}

describe("CoursesView", () => {
  it("pokazuje kafle i listę w kolejności z serwera", async () => {
    setup();
    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(3);
    const tiles = screen.getByLabelText("Statystyki kursów");
    expect(within(tiles).getByText("W trakcie").parentElement).toHaveTextContent("1");
    expect(within(tiles).getByText("Ukończone").parentElement).toHaveTextContent("1");
  });

  it("kurs z certyfikatem pokazuje link, ścieżkę, ostrzeżenie o braku pliku i notatkę", async () => {
    setup();
    const card = (await screen.findByText("MCP w praktyce")).closest("article")!;
    expect(within(card).getByRole("link", { name: "Certyfikat" })).toHaveAttribute(
      "href",
      "https://c.example.com/cert"
    );
    expect(within(card).getByText("Plik: certyfikaty/mcp.pdf")).toBeInTheDocument();
    expect(within(card).getByText("brak pliku w Vault/Documents/")).toBeInTheDocument();
    expect(within(card).getByText("Warto wrócić")).toBeInTheDocument();
  });

  it("tytuł kursu to link otwierany w nowej karcie z rel noopener", async () => {
    setup();
    const link = await screen.findByRole("link", { name: "Next.js App Router" });
    expect(link).toHaveAttribute("href", "https://a.example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("filtr statusu zawęża listę", async () => {
    setup();
    await screen.findAllByRole("article");
    await userEvent.click(screen.getByRole("button", { name: "Plan" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Plan na później")).toBeInTheDocument();
  });

  it("dodawanie: formularz wysyła POST z polami i odświeża listę", async () => {
    const apiFetch = setup();
    await screen.findAllByRole("article");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj kurs" }));
    await userEvent.type(screen.getByLabelText("Tytuł"), "Nowy kurs");
    await userEvent.type(
      screen.getByLabelText("Adres kursu (http/https)"),
      "https://n.example.com"
    );
    await userEvent.selectOptions(screen.getByLabelText("Status"), "w-trakcie");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      const post = apiFetch.mock.calls.find(([, init]) => init?.method === "POST");
      expect(post).toBeDefined();
      expect(JSON.parse(post![1]!.body as string)).toMatchObject({
        title: "Nowy kurs",
        url: "https://n.example.com",
        status: "w-trakcie",
      });
    });
    await waitFor(() => expect(screen.queryByLabelText("Tytuł")).toBeNull());
  });

  it("błąd zapisu zostawia formularz i pokazuje komunikat", async () => {
    const apiFetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? ({ ok: false, status: 400, json: async () => ({ error: "Zły adres" }) } as Response)
        : json(list)
    );
    render(<CoursesView apiFetch={apiFetch} />);
    await screen.findAllByRole("article");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj kurs" }));
    await userEvent.type(screen.getByLabelText("Tytuł"), "X");
    await userEvent.type(
      screen.getByLabelText("Adres kursu (http/https)"),
      "https://x.example.com"
    );
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Zły adres");
    expect(screen.getByLabelText("Tytuł")).toBeInTheDocument();
  });

  it("edycja: formularz startuje z danymi kursu i wysyła PUT", async () => {
    const apiFetch = setup();
    const card = (await screen.findByText("Plan na później")).closest("article")!;
    await userEvent.click(within(card).getByRole("button", { name: "Edytuj" }));
    expect(screen.getByLabelText("Tytuł")).toHaveValue("Plan na później");
    await userEvent.clear(screen.getByLabelText("Tytuł"));
    await userEvent.type(screen.getByLabelText("Tytuł"), "Zmieniony");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      const put = apiFetch.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(put![0]).toBe("/api/arsenal/courses/c2");
      expect(JSON.parse(put![1]!.body as string).title).toBe("Zmieniony");
    });
  });

  it("usuwanie: po potwierdzeniu wysyła DELETE, po odmowie nic", async () => {
    const apiFetch = setup();
    const card = (await screen.findByText("Plan na później")).closest("article")!;
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    await userEvent.click(within(card).getByRole("button", { name: "Usuń" }));
    expect(apiFetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    await userEvent.click(within(card).getByRole("button", { name: "Usuń" }));
    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          ([url, init]) => url === "/api/arsenal/courses/c2" && init?.method === "DELETE"
        )
      ).toBe(true)
    );
    expect(confirm).toHaveBeenCalledWith("Usunąć kurs „Plan na później”?");
  });

  it("po angielsku: etykiety EN", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    setup();
    expect(await screen.findByRole("button", { name: "Add course" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Certificate" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Czerwono**

Run: `npx vitest run tests/unit/features/arsenal/CoursesView.test.tsx`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Formularz**

`src/features/arsenal/CourseForm.tsx`:

```tsx
import React, { useState } from "react";
import {
  COURSE_STATUSES,
  type CourseDto,
  type CourseInputDto,
} from "@/contexts/bc_arsenal/schemas";
import { useT } from "@/src/i18n/useT";
import { messageOf } from "./apiError";

const STATUS_KEY = {
  plan: "courses:statusPlan",
  "w-trakcie": "courses:statusInProgress",
  ukonczony: "courses:statusDone",
} as const;

type Props = {
  initial?: CourseDto;
  onSubmit: (input: CourseInputDto) => Promise<void>;
  onCancel: () => void;
};

export function CourseForm({ initial, onSubmit, onCancel }: Props) {
  const t = useT();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [status, setStatus] = useState<CourseInputDto["status"]>(initial?.status ?? "plan");
  const [completed, setCompleted] = useState(initial?.completed ?? "");
  const [certificateUrl, setCertificateUrl] = useState(initial?.certificateUrl ?? "");
  const [certificateFile, setCertificateFile] = useState(initial?.certificateFile ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title,
        url,
        provider,
        status,
        completed: status === "ukonczony" ? completed : "",
        certificateUrl,
        certificateFile,
        note,
      });
    } catch (err) {
      setError(messageOf(err));
      setSaving(false);
    }
  };

  return (
    <form className="crs-form" onSubmit={submit}>
      <h2 className="crs-form__title">
        {t(initial === undefined ? "courses:formAddTitle" : "courses:formEditTitle")}
      </h2>
      <label className="crs-field">
        <span>{t("courses:fieldTitle")}</span>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="crs-field">
        <span>{t("courses:fieldUrl")}</span>
        <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label className="crs-field">
        <span>{t("courses:fieldProvider")}</span>
        <input value={provider} onChange={(e) => setProvider(e.target.value)} />
      </label>
      <label className="crs-field">
        <span>{t("courses:fieldStatus")}</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {COURSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(STATUS_KEY[s])}
            </option>
          ))}
        </select>
      </label>
      {status === "ukonczony" && (
        <label className="crs-field">
          <span>{t("courses:fieldCompleted")}</span>
          <input type="date" value={completed} onChange={(e) => setCompleted(e.target.value)} />
        </label>
      )}
      <label className="crs-field">
        <span>{t("courses:fieldCertificateUrl")}</span>
        <input
          type="url"
          value={certificateUrl}
          onChange={(e) => setCertificateUrl(e.target.value)}
        />
      </label>
      <label className="crs-field">
        <span>{t("courses:fieldCertificateFile")}</span>
        <input value={certificateFile} onChange={(e) => setCertificateFile(e.target.value)} />
        <small className="crs-hint">{t("courses:fieldCertificateFileHint")}</small>
      </label>
      <label className="crs-field">
        <span>{t("courses:fieldNote")}</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error !== null && (
        <p role="alert" className="asv-error">
          {error}
        </p>
      )}
      <div className="crs-form__actions">
        <button type="submit" className="asv-btn asv-btn--primary" disabled={saving}>
          {t("courses:save")}
        </button>
        <button type="button" className="asv-btn" onClick={onCancel}>
          {t("courses:cancel")}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Widok**

`src/features/arsenal/CoursesView.tsx`:

```tsx
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type { CourseDto, CourseInputDto } from "@/contexts/bc_arsenal/schemas";
import { formatDate } from "@/src/i18n/format";
import { useT } from "@/src/i18n/useT";
import "@/src/features/resources/resources.css";
import "./arsenal.css";
import { CourseForm } from "./CourseForm";
import { messageOf } from "./apiError";
import { useCourses } from "./useCourses";
import type { ApiFetch } from "./useArsenal";

type StatusFilter = "all" | CourseDto["status"];

const STATUS_KEY = {
  plan: "courses:statusPlan",
  "w-trakcie": "courses:statusInProgress",
  ukonczony: "courses:statusDone",
} as const;

function Tile({
  label,
  value,
  meta,
  accent = false,
}: {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "asv-tile asv-tile--accent" : "asv-tile"}>
      <span className="asv-tile__label">{label}</span>
      <span className="asv-tile__value">{value}</span>
      <span className="asv-tile__meta">{meta}</span>
    </div>
  );
}

function CourseCard({
  course,
  onEdit,
  onDelete,
}: {
  course: CourseDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <article className="crs-card" data-status={course.status}>
      <div className="crs-card__head">
        <span className="asv-badge" data-status={course.status}>
          {t(STATUS_KEY[course.status])}
        </span>
        <a href={course.url} target="_blank" rel="noopener noreferrer" className="crs-card__title">
          {course.title}
        </a>
      </div>
      <p className="crs-card__meta">
        {[
          course.provider,
          course.completed !== undefined
            ? t("courses:completedOn", {
                date: formatDate(new Date(`${course.completed}T12:00:00`)),
              })
            : undefined,
        ]
          .filter((part): part is string => part !== undefined)
          .join(" · ")}
      </p>
      {(course.certificateUrl !== undefined || course.certificateFile !== undefined) && (
        <p className="crs-card__cert">
          {course.certificateUrl !== undefined && (
            <a href={course.certificateUrl} target="_blank" rel="noopener noreferrer">
              {t("courses:certificateLink")}
            </a>
          )}
          {course.certificateFile !== undefined && (
            <span>{t("courses:certificateFile", { path: course.certificateFile })}</span>
          )}
          {course.certificateMissing && (
            <span className="crs-warn">{t("courses:certificateMissing")}</span>
          )}
        </p>
      )}
      {course.note !== undefined && <p className="crs-card__note">{course.note}</p>}
      <div className="crs-card__actions">
        <button type="button" className="asv-btn" onClick={onEdit}>
          {t("courses:edit")}
        </button>
        <button type="button" className="asv-btn" onClick={onDelete}>
          {t("courses:delete")}
        </button>
      </div>
    </article>
  );
}

export function CoursesView({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const c = useCourses(apiFetch);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const count = (status: CourseDto["status"]) =>
    c.courses.filter((x) => x.status === status).length;
  const visible = filter === "all" ? c.courses : c.courses.filter((x) => x.status === filter);
  const filters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: t("courses:filterAll") },
    { id: "w-trakcie", label: t("courses:statusInProgress") },
    { id: "plan", label: t("courses:statusPlan") },
    { id: "ukonczony", label: t("courses:statusDone") },
  ];

  const save = async (input: CourseInputDto, id?: string) => {
    await c.save(input, id);
    setEditing(null);
  };
  const remove = async (course: CourseDto) => {
    if (!window.confirm(t("courses:deleteConfirm", { title: course.title }))) return;
    setActionError(null);
    try {
      await c.remove(course.id);
    } catch (err) {
      setActionError(messageOf(err));
    }
  };

  return (
    <div className="ars asv" data-card="arsenal">
      <header className="ars-head">
        <div>
          <p className="ars-eyebrow">{`Alt+7 · ${t("shell:cards.arsenal")}`}</p>
          <h1 className="ars-title">{t("courses:title")}</h1>
          <p className="ars-sub">
            {t("courses:count", { count: c.courses.length })}
            {c.skipped > 0 ? t("courses:skippedSuffix", { count: c.skipped }) : ""}
          </p>
        </div>
        <button
          type="button"
          className="asv-btn asv-btn--primary"
          onClick={() => setEditing("new")}
        >
          {t("courses:add")}
        </button>
      </header>

      {c.loading ? (
        <Loader2 className="animate-spin" aria-label={t("courses:loading")} />
      ) : c.error !== null ? (
        <p role="alert" className="asv-error">
          {c.error}
        </p>
      ) : (
        <>
          <section className="asv-tiles" aria-label={t("courses:statsAria")}>
            <Tile
              label={t("courses:tileInProgress")}
              value={count("w-trakcie")}
              meta={t("courses:tileInProgressMeta")}
              accent
            />
            <Tile
              label={t("courses:tilePlanned")}
              value={count("plan")}
              meta={t("courses:tilePlannedMeta")}
            />
            <Tile
              label={t("courses:tileDone")}
              value={count("ukonczony")}
              meta={t("courses:tileDoneMeta")}
            />
          </section>

          <div className="asv-chips" role="group" aria-label={t("courses:filterAria")}>
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className="asv-chip"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {actionError !== null && (
            <p role="alert" className="asv-error">
              {actionError}
            </p>
          )}
          {editing === "new" && (
            <CourseForm onSubmit={(input) => save(input)} onCancel={() => setEditing(null)} />
          )}

          {visible.length === 0 && editing !== "new" ? (
            <p className="asv-empty">
              {t(c.courses.length === 0 ? "courses:empty" : "courses:emptyFilter")}
            </p>
          ) : (
            <div className="crs-list">
              {visible.map((course) =>
                editing === course.id ? (
                  <CourseForm
                    key={course.id}
                    initial={course}
                    onSubmit={(input) => save(input, course.id)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onEdit={() => setEditing(course.id)}
                    onDelete={() => void remove(course)}
                  />
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: CSS**

Dopisz na końcu `src/features/arsenal/arsenal.css` (tokeny jak w pozostałych klasach `.asv-*`):

```css
/* Kursy */
.crs-list {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.crs-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: var(--s-4);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.crs-card[data-status="ukonczony"] {
  opacity: 0.85;
}
.crs-card__head {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.crs-card__title {
  font: 600 var(--fs-md) / 1.3 var(--font-display);
  color: var(--text);
}
.crs-card__meta,
.crs-card__cert,
.crs-card__note {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--muted);
}
.crs-card__cert {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
}
.crs-warn {
  color: var(--warn, #e5a50a);
}
.crs-card__actions,
.crs-form__actions {
  display: flex;
  gap: var(--s-2);
}
.crs-form {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: var(--r-md);
  padding: var(--s-4);
  margin-bottom: var(--s-3);
}
.crs-form__title {
  margin: 0;
  font: 600 var(--fs-md) / 1.3 var(--font-display);
}
.crs-field {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
  font-size: var(--fs-xs);
  color: var(--muted);
}
.crs-field input,
.crs-field select,
.crs-field textarea {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: var(--s-2);
  font: inherit;
}
.crs-hint {
  color: var(--muted);
}
```

- [ ] **Step 6: Zielono**

Run: `npx vitest run tests/unit/features/arsenal && npx tsc --noEmit && npm run lint`
Expected: PASS. Jeśli selektor w teście (np. kafel „W trakcie” zdublowany z filtrem) jest niejednoznaczny, zawęź zapytanie (`within(tiles)`), nie zmieniaj komponentu.

- [ ] **Step 7: Commit**

```bash
git add src/features/arsenal tests/unit/features/arsenal/CoursesView.test.tsx
git commit -m "feat(arsenal): widok Kursy (lista, filtr statusu, formularz dodawania i edycji, usuwanie)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Zakładka `courses` w rejestrze kart, widoku i szufladce mobilnej

**Files:**

- Modify: `src/features/planowanie/planningTab.ts`, `src/features/cards/cards.ts`, `src/features/planowanie/PlanowanieView.tsx`, `src/components/layout/MobileMoreDrawer.tsx`
- Test: `tests/unit/features/cards/cards.test.ts`, `tests/unit/components/layout/MobileMoreDrawer.test.tsx`

- [ ] **Step 1: Czerwone testy**

W `tests/unit/features/cards/cards.test.ts`: zmień linie z oczekiwaniem `["skills", "resources", "tags"]` (dwie: w `subtabsForCard("arsenal")` i w `CARD_SUBTABS`) na `["skills", "resources", "courses", "tags"]`, w tytule testu też; obok `expect(cardForView("planowanie", "resources")).toBe("arsenal");` dodaj `expect(cardForView("planowanie", "courses")).toBe("arsenal");`.

W `tests/unit/components/layout/MobileMoreDrawer.test.tsx` dopisz:

```tsx
test("calls onSelectTab for courses", () => {
  const onSelectTab = vi.fn();
  render(<MobileMoreDrawer isOpen={true} onClose={vi.fn()} onSelectTab={onSelectTab} />);
  fireEvent.click(screen.getByText("Kursy"));
  expect(onSelectTab).toHaveBeenCalledWith("courses");
});
```

Run: `npx vitest run tests/unit/features/cards tests/unit/components/layout`
Expected: FAIL.

- [ ] **Step 2: Implementacja**

`src/features/planowanie/planningTab.ts`: dodaj `| "courses"` po `| "skills"`.

`src/features/cards/cards.ts`: w `TAB_TO_CARD` dodaj `courses: "arsenal",`; `CARD_SUBTABS.arsenal` = `["skills", "resources", "courses", "tags"]`.

`src/features/planowanie/PlanowanieView.tsx`: w `TAB_LABEL_KEY` dodaj `courses: "planning:tabCourses",`; obok importu `ArsenalSkillsView` dodaj `import { CoursesView } from "@/src/features/arsenal/CoursesView";`; przed gałęzią `planningTab === "skills"` dodaj:

```tsx
        ) : planningTab === "courses" ? (
          <div className="flex-1 flex flex-col overflow-auto bg-[var(--bg)]">
            <CoursesView apiFetch={apiFetch} />
          </div>
```

`src/components/layout/MobileMoreDrawer.tsx`: import `GraduationCap` z `lucide-react`; `type DrawerTab = … | "skills" | "courses" | …`; w `items` po `skills` dodaj `{ id: "courses", icon: <GraduationCap className="w-5 h-5" /> },`.

- [ ] **Step 3: Zielono (cały zestaw)**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: PASS (przy pęknięciu testu liczącego pozycje szufladki lub zakładki popraw oczekiwanie na nowy stan, to zmiana zamierzona).

- [ ] **Step 4: Commit**

```bash
git add src tests
git commit -m "feat(arsenal): zakładka Kursy w karcie Arsenał (rejestr kart, widok, szufladka mobilna)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Dokumentacja formatu i weryfikacja końcowa

**Files:**

- Modify: `docs/nexus-vault-formaty-yaml.md`

- [ ] **Step 1: Format pliku**

W tabeli na górze `docs/nexus-vault-formaty-yaml.md` dodaj wiersz:

```
| `Arsenal/courses.yaml`     | `courses`   | `id`, `title`, `url`, `provider`\*, `status`, `completed`\*, `certificate_url`\*, `certificate_file`\*, `note`\* |
```

oraz sekcję (przed „## Zadania”):

```markdown
## Kursy: `Arsenal/courses.yaml`

Karta Arsenał, zakładka Kursy. Zapis z aplikacji (`lib/nexus/yaml-store.ts`), plik można też edytować ręcznie.

- `status`: `plan`, `w-trakcie` albo `ukonczony`. `completed` (RRRR-MM-DD) ma sens tylko przy `ukonczony`; aplikacja dopisuje dzisiejszą datę, gdy jej brak, i kasuje ją przy innym statusie.
- `url` i `certificate_url`: tylko `http://` lub `https://`.
- `certificate_file`: ścieżka względem `Vault/Documents/` (np. `certyfikaty/mcp.pdf`), bez `..`, bez `/` na początku. PDF wrzucasz ręcznie; brak pliku to ostrzeżenie w UI, nie błąd.
- Wpis bez `id`, `title`, poprawnego `status`, poprawnego `url` albo z niedozwoloną ścieżką certyfikatu jest pomijany (licznik „pominięto N” w nagłówku zakładki); reszta listy się ładuje.
- Kolejność w UI: `w-trakcie`, `plan`, `ukonczony`, w grupie po tytule. Kolejność w pliku nie ma znaczenia.
```

- [ ] **Step 2: Pełna weryfikacja**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run lint:tests && npm run build`
Expected: wszystko zielone. (Zgodnie z CLAUDE.md te komendy można zlecić `cursor --tier light --role task --approve-allowed` z prośbą o „przeszło” albo listę `plik:linia + przyczyna`.)

- [ ] **Step 3: Przegląd diffa**

Zlecić `agy --role review` przegląd `git diff main...HEAD` (CLAUDE.md: review po większej zmianie). Opinie traktować jak hipotezy: weryfikować w kodzie przed zmianą.

- [ ] **Step 4: Sprawdzenie w przeglądarce (wykonawca albo użytkownik)**

`npm run dev`, wejść w `Alt+7` → zakładka „Kursy”: dodać kurs `w-trakcie`, zmienić na `ukonczony` (data dopisana), wpisać nieistniejący `certificate_file` (ostrzeżenie „brak pliku…”), usunąć kurs; przełączyć PL/EN. Sprawdzić, że `Vault/Arsenal/courses.yaml` ma `version: 1` i listę `courses`. Zrobić to na kopii vaulta (`NEXUS_VAULT_PATH`), nie na prawdziwym.

- [ ] **Step 5: Commit i uzupełnienie backlogu**

```bash
git add docs/nexus-vault-formaty-yaml.md
git commit -m "docs: format Arsenal/courses.yaml

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

W `NEXUS/Vault/Projects/monolith/tasks.md` dopisać zadanie „Arsenał, etap 3: Kursy” jako zrobione z numerem PR i listą weryfikacji (commit i push do NEXUS od razu).

---

## Samoprzegląd planu względem specu

- **§4.1 pola** (`id`, `title`, `url`, `provider`, `status`, `completed`, `certificate_url`, `certificate_file`, `note`): modele, repozytorium, schemat, formularz, dokumentacja (Tasks 2, 3, 8, 10).
- **Walidacja `certificate_file`** (bez `..`, bez absolutnych, tylko `Documents/`): `isSafeCertificatePath` + `certificateExists` przez `vaultFileMtimeMs`, który przechodzi `resolveInsideVault` (Tasks 2, 3).
- **Brak pliku = ostrzeżenie**: `certificateMissing` (Tasks 4, 8).
- **§6 uszkodzony wpis pomijany z licznikiem**: `readCourses().skipped` (Task 3), nagłówek widoku (Task 8).
- **Zapisy YAML przez `handleServiceError`**: router (Task 5).
- **Test architektury bez zmian** (K7): sprawdzane w Tasks 1, 3, 4, 5.
- **Zakładki** (spec §7: docelowo cztery; etap 4 dodaje `agents`): Task 9.
- **Poza zakresem** (spec §9): postęp modułów, action items, upload PDF.
- Spójność nazw: repozytorium `readCourses`/`insertCourse`/`replaceCourse`/`removeCourse`/`certificateExists`, serwis `listCourses`/`createCourse`/`updateCourse`/`deleteCourse`, router `getCourses`/`postCourse`/`putCourse`/`removeCourse`, UI `useCourses().save/remove`, DTO `CourseDto`/`CoursesDto`/`CourseInputDto`.
