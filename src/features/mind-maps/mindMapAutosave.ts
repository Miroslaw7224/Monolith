import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";

export const AUTOSAVE_DELAY_MS = 1500;

export type SavePayload = {
  mapId: string;
  rootNode: MindMapNode;
  colWidths: Record<number, number>;
  title: string;
};

export type SavePhase = "clean" | "pending" | "saving" | "saved" | "error";

export type AutosaveState = {
  phase: SavePhase;
  pending: SavePayload | null;
  inFlight: SavePayload | null;
  lastSavedAt: number | null;
};

export function initialAutosave(): AutosaveState {
  return { phase: "clean", pending: null, inFlight: null, lastSavedAt: null };
}

export function markDirty(state: AutosaveState, payload: SavePayload): AutosaveState {
  return {
    ...state,
    pending: payload,
    phase: state.inFlight ? "saving" : "pending",
  };
}

export function takeForSave(state: AutosaveState): {
  state: AutosaveState;
  payload: SavePayload | null;
} {
  if (!state.pending || state.inFlight) return { state, payload: null };
  return {
    payload: state.pending,
    state: { ...state, pending: null, inFlight: state.pending, phase: "saving" },
  };
}

export function settleSave(
  state: AutosaveState,
  payload: SavePayload,
  result: { ok: boolean; at: number }
): AutosaveState {
  if (state.inFlight !== payload) return state;
  if (!result.ok) {
    return {
      ...state,
      inFlight: null,
      pending: state.pending ?? payload,
      phase: "error",
    };
  }
  return {
    ...state,
    inFlight: null,
    lastSavedAt: result.at,
    phase: state.pending ? "pending" : "saved",
  };
}
