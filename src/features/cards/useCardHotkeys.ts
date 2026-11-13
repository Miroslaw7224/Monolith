"use client";

import { useEffect } from "react";
import { type CardId, cardByHotkey } from "./cards";

export interface CardHotkeysOptions {
  onSelectCard: (id: CardId) => void;
  onOpenPalette: () => void;
  /** Alt+I: szybki zapis do inboxu (Kokpit, pole zapisu). */
  onCaptureInbox?: () => void;
  disabled?: boolean;
}

export function useCardHotkeys({
  onSelectCard,
  onOpenPalette,
  onCaptureInbox,
  disabled = false,
}: CardHotkeysOptions) {
  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenPalette();
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.code === "KeyI" && onCaptureInbox) {
          e.preventDefault();
          onCaptureInbox();
          return;
        }
        const match = /^Digit([1-9])$/.exec(e.code);
        const card = match ? cardByHotkey(Number(match[1])) : undefined;
        if (card) {
          e.preventDefault();
          onSelectCard(card.id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSelectCard, onOpenPalette, onCaptureInbox, disabled]);
}
