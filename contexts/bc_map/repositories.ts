import { listTerminals, type TerminalsResult } from "@/lib/herdr/hc-ls";
import { parseFrontmatter, type Frontmatter } from "@/lib/nexus/frontmatter";
import { listVaultFilesRecursive, readVaultFile } from "@/lib/nexus/vault-fs";
import type { MapSources } from "./models";

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

  const knowledgeFiles = listVaultFilesRecursive("Knowledge");
  const noteProjects: string[][] = [];
  for (const rel of knowledgeFiles) {
    try {
      const file = readVaultFile(rel);
      const parsed = file ? parseFrontmatter(file.text) : null;
      const ids = parsed ? parseNoteProjects(parsed.meta) : [];
      if (ids.length > 0) noteProjects.push(ids);
    } catch {
      warnings.push(`Nie można odczytać notatki ${rel}`);
    }
  }

  return {
    sharedSections,
    noteProjects,
    counts: {
      knowledge: knowledgeFiles.length,
      ai2030: listVaultFilesRecursive("AI-2030").length,
      projects: listVaultFilesRecursive("Projects").length,
    },
    warnings,
  };
}

/** Terminale Herdr (`hc ls`); niedostępny Herdr to `{ available: false }`. */
export function readTerminals(): TerminalsResult {
  return listTerminals();
}
