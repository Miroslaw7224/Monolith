/** Kategorie skilli wg działania (pole `category` we frontmatterze `skill.md`). */
export const SKILL_CATEGORIES = [
  "planowanie",
  "wykonanie",
  "testy",
  "review",
  "git",
  "architektura",
  "wiedza",
  "dokumenty",
  "meta",
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
