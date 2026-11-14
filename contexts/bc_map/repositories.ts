import { listTerminals, type TerminalsResult } from "@/lib/herdr/hc-ls";
import { parseFrontmatter, type Frontmatter } from "@/lib/nexus/frontmatter";
import { listVaultFilesRecursive, readVaultFile } from "@/lib/nexus/vault-fs";
import type { MapSources, RawNote } from "./models";

const TECH_STACK = "tech-stack-wspolny.md";
const USERS_LINE = /^\*\*Używają:\*\*(.*)$/;
const PROJECT_LINK = /\[\[Projects\/([^/|\]]+)/g;

/** Id projektów z każdej linii `**Używają:**` (jedna lista na sekcję); dopiski typu „(V2)” poza `]]` nie przeszkadzają. */
export function parseSharedSections(text: string): string[][] {
  const out: string[][] = [];
  for (const line of text.split("\n")) {
    const m = USERS_LINE.exec(line.trim());
    if (!m) continue;
    out.push([...m[1].matchAll(PROJECT_LINK)].map((x) => x[1]));
  }
  return out;
}

/** Niepuste teksty z pola `projects:` frontmatteru notatki (lista); wszystko inne daje []. */
export function parseNoteProjects(meta: Frontmatter): string[] {
  const value = meta.projects;
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/** Cele wikilinków `[[cel|alias#kotwica]]` z treści (bez bloków kodu), z duplikatami i w kolejności. */
export function extractWikiLinks(text: string): string[] {
  const out: string[] = [];
  const clean = text.replace(/```[\s\S]*?```/g, "");
  for (const m of clean.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = m[1].split("|")[0].split("#")[0].trim();
    if (target !== "") out.push(target);
  }
  return out;
}

/** Pierwsza kategoria notatki (małe litery, trim); lista albo tekst rozdzielony przecinkami. */
export function primaryCategory(meta: Frontmatter): string | undefined {
  const value = meta.categories;
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const cat = item.trim().toLowerCase();
    if (cat !== "") return cat;
  }
  return undefined;
}

const AREAS = [
  { dir: "Knowledge", area: "knowledge" },
  { dir: "AI-2030", area: "ai2030" },
  { dir: "Projects", area: "project" },
] as const;

function noteTitle(meta: Frontmatter, fallback: string): string {
  for (const key of ["name", "title"]) {
    const v = meta[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return fallback;
}

/** Odczyt grafu z vaulta. Nieczytelny plik daje ostrzeżenie zamiast wyjątku. */
export function readMapSources(): MapSources {
  const warnings: string[] = [];

  let sharedSections: string[][] = [];
  const stack = readVaultFile(TECH_STACK);
  if (stack === null) {
    warnings.push(`Brak ${TECH_STACK}: bez krawędzi projekt–projekt`);
  } else {
    sharedSections = parseSharedSections(stack.text);
  }

  const notes: RawNote[] = [];
  for (const { dir, area } of AREAS) {
    for (const rel of listVaultFilesRecursive(dir)) {
      const segments = rel.split("/");
      const file = segments[segments.length - 1];
      if (file.startsWith("_") || segments.includes("attachments")) continue;
      if (area === "project" && segments.length < 3) continue;
      try {
        const read = readVaultFile(rel);
        if (read === null) continue;
        const parsed = parseFrontmatter(read.text);
        const meta = parsed?.meta ?? {};
        const path = rel.replace(/\.md$/, "");
        notes.push({
          path,
          area,
          ...(area === "project" ? { projectId: segments[1] } : {}),
          title: noteTitle(meta, file.replace(/\.md$/, "")),
          ...(area === "knowledge" ? { category: primaryCategory(meta) } : {}),
          projects: area === "knowledge" ? parseNoteProjects(meta) : [],
          links: extractWikiLinks(parsed ? parsed.body : read.text),
        });
      } catch {
        warnings.push(`Nie można odczytać notatki ${rel}`);
      }
    }
  }
  notes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { sharedSections, notes, warnings };
}

/** Terminale Herdr (`hc ls`); niedostępny Herdr to `{ available: false }`. */
export function readTerminals(): TerminalsResult {
  return listTerminals();
}
