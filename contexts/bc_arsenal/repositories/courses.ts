import type { YamlRecord } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import {
  appendRecord,
  generateId,
  optStr,
  patchRecord,
  removeRecord,
} from "@/lib/nexus/record-helpers";
import { vaultFileMtimeMs } from "@/lib/nexus/vault-fs";
import { isIsoDay } from "@/lib/schema/archive-date";
import { isHttpUrl, isSafeCertificatePath } from "@/lib/schema/course-fields";
import {
  COURSES_FILE,
  COURSES_KEY,
  COURSE_CERT_DIR,
  COURSE_STATUSES,
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
