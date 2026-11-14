export type TaskEnergy = "deep" | "quick";

const ENERGY_TAG = /(^|\s)#(deep|quick)(?=\s|$)/gi;

/** Energia zadania z tagu `#deep` / `#quick` w tytule (bez rozróżniania wielkości liter). */
export function getTaskEnergy(title: string): TaskEnergy | null {
  const match = /(^|\s)#(deep|quick)(?=\s|$)/i.exec(title);
  return match ? (match[2].toLowerCase() as TaskEnergy) : null;
}

/** Tytuł z podmienionym tagiem energii (`null` usuwa tag); tag trafia na koniec tytułu. */
export function setTaskEnergy(title: string, energy: TaskEnergy | null): string {
  const base = title.replace(ENERGY_TAG, " ").replace(/\s+/g, " ").trim();
  if (!energy) return base;
  return base ? `${base} #${energy}` : `#${energy}`;
}

/** Ten sam tag wyłącza energię, inny ją przełącza. */
export function toggleTaskEnergy(title: string, energy: TaskEnergy): string {
  return setTaskEnergy(title, getTaskEnergy(title) === energy ? null : energy);
}
