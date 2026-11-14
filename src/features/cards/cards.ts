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
  | { kind: "placeholder"; stage: string };

export interface CardDef {
  id: CardId;
  label: string;
  hotkey: number;
  target: CardTarget;
}

export const CARDS: readonly CardDef[] = [
  { id: "kokpit", label: "Kokpit", hotkey: 1, target: { kind: "home" } },
  { id: "kalendarz", label: "Kalendarz", hotkey: 2, target: { kind: "planning", tab: "calendar" } },
  { id: "zadania", label: "Zadania", hotkey: 3, target: { kind: "planning", tab: "tasks" } },
  {
    id: "projekty",
    label: "Projekty",
    hotkey: 4,
    target: { kind: "projects" },
  },
  { id: "notatki", label: "Notatki", hotkey: 5, target: { kind: "planning", tab: "notes" } },
  { id: "plotno", label: "Płótno", hotkey: 6, target: { kind: "planning", tab: "board" } },
  { id: "arsenal", label: "Arsenał", hotkey: 7, target: { kind: "planning", tab: "resources" } },
  { id: "mapa", label: "Mapa", hotkey: 8, target: { kind: "map" } },
  {
    id: "kodeks",
    label: "Kodeks",
    hotkey: 9,
    target: { kind: "placeholder", stage: "po etapie 0c" },
  },
];

const TAB_TO_CARD: Record<PlanningTab, CardId> = {
  calendar: "kalendarz",
  tasks: "zadania",
  notes: "notatki",
  board: "plotno",
  mindmaps: "plotno",
  resources: "arsenal",
  tags: "arsenal",
  activity: "kalendarz",
};

export const CARD_SUBTABS: Partial<Record<CardId, readonly PlanningTab[]>> = {
  kalendarz: ["calendar", "activity"],
  plotno: ["board", "mindmaps"],
  arsenal: ["resources", "tags"],
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

export function buildCardCommands(selectCard: (id: CardId) => void): PaletteCommand[] {
  return CARDS.map((card) => ({
    id: `go-${card.id}`,
    label: `Przejdź: ${card.label}`,
    hint: `Alt+${card.hotkey}`,
    run: () => selectCard(card.id),
  }));
}
