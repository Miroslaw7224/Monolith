import type { TFn } from "@/src/i18n";
import type { PlanningTab } from "@/src/features/planowanie/planningTab";

export type CardId =
  | "kokpit"
  | "kalendarz"
  | "zadania"
  | "projekty"
  | "notatki"
  | "plotno"
  | "arsenal"
  | "mapa"
  | "kodeks";

export type AppMode = "home" | "planowanie";

export type CardTarget =
  | { kind: "home" }
  | { kind: "planning"; tab: PlanningTab }
  | { kind: "projects" }
  | { kind: "map" }
  | { kind: "codex" };

export interface CardDef {
  id: CardId;
  hotkey: number;
  target: CardTarget;
}

export const CARDS: readonly CardDef[] = [
  { id: "kokpit", hotkey: 1, target: { kind: "home" } },
  { id: "kalendarz", hotkey: 2, target: { kind: "planning", tab: "calendar" } },
  { id: "zadania", hotkey: 3, target: { kind: "planning", tab: "tasks" } },
  {
    id: "projekty",
    hotkey: 4,
    target: { kind: "projects" },
  },
  { id: "notatki", hotkey: 5, target: { kind: "planning", tab: "notes" } },
  { id: "plotno", hotkey: 6, target: { kind: "planning", tab: "board" } },
  { id: "arsenal", hotkey: 7, target: { kind: "planning", tab: "skills" } },
  { id: "mapa", hotkey: 8, target: { kind: "map" } },
  { id: "kodeks", hotkey: 9, target: { kind: "codex" } },
];

const TAB_TO_CARD: Record<PlanningTab, CardId> = {
  calendar: "kalendarz",
  tasks: "zadania",
  notes: "notatki",
  board: "plotno",
  mindmaps: "plotno",
  resources: "arsenal",
  skills: "arsenal",
  courses: "arsenal",
  agents: "arsenal",
  tags: "arsenal",
  activity: "kalendarz",
};

export const CARD_SUBTABS: Partial<Record<CardId, readonly PlanningTab[]>> = {
  kalendarz: ["calendar", "activity"],
  plotno: ["board", "mindmaps"],
  arsenal: ["skills", "resources", "courses", "agents", "tags"],
};

export function subtabsForCard(id: CardId): readonly PlanningTab[] {
  return CARD_SUBTABS[id] ?? [];
}

export function getCard(id: CardId): CardDef {
  const card = CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`Nieznana karta: ${id}`);
  return card;
}

export function cardByHotkey(n: number): CardDef | undefined {
  return CARDS.find((c) => c.hotkey === n);
}

export function cardForView(appMode: AppMode, tab: PlanningTab): CardId {
  return appMode === "home" ? "kokpit" : TAB_TO_CARD[tab];
}

export function cardFromHash(hash: string): CardId | null {
  const id = hash.replace(/^#/, "");
  return CARDS.some((c) => c.id === id) ? (id as CardId) : null;
}

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
}

export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const q = fold(query.trim());
  if (!q) return commands;
  return commands.filter((c) => fold(c.label).includes(q));
}

export function buildCardCommands(selectCard: (id: CardId) => void, t: TFn): PaletteCommand[] {
  return CARDS.map((card) => ({
    id: `go-${card.id}`,
    label: t("shell:palette.goTo", { card: t(`shell:cards.${card.id}`) }),
    hint: `Alt+${card.hotkey}`,
    run: () => selectCard(card.id),
  }));
}
