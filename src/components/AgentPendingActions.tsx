import React from "react";

export interface PendingAgentAction {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
}

interface AgentPendingActionsProps {
  pending: PendingAgentAction[];
  busy: boolean;
  lang: "en" | "pl";
  onConfirm: (action: PendingAgentAction) => void;
  onCancel: (action: PendingAgentAction) => void;
}

export function AgentPendingActions({
  pending,
  busy,
  lang,
  onConfirm,
  onCancel,
}: AgentPendingActionsProps) {
  if (pending.length === 0) return null;
  const confirmLabel = lang === "pl" ? "Potwierdź" : "Confirm";
  const cancelLabel = lang === "pl" ? "Anuluj" : "Cancel";
  return (
    <div className="mb-2 space-y-2">
      {pending.map((action) => (
        <div
          key={action.id}
          className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg3)] px-3 py-2 text-sm"
        >
          <span>{action.summary}</span>
          <span className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm(action)}
              className="rounded-lg bg-red-600 px-3 py-1 font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancel(action)}
              className="rounded-lg px-3 py-1 text-[var(--text3)] hover:bg-[var(--bg2)] disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
