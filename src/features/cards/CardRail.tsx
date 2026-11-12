"use client";

import React from "react";
import { CARDS, type CardId } from "./cards";

export interface CardRailProps {
  activeCard: CardId;
  onSelect: (id: CardId) => void;
  onOpenPalette: () => void;
}

export function CardRail({ activeCard, onSelect, onOpenPalette }: CardRailProps) {
  return (
    <nav className="card-rail" aria-label="Karty">
      <div className="card-rail__logo" aria-hidden="true">
        M
      </div>
      {CARDS.map((card) => (
        <button
          key={card.id}
          type="button"
          data-card-id={card.id}
          className="card-rail__item"
          style={{ "--c": `var(--c-${card.id})` } as React.CSSProperties}
          aria-current={card.id === activeCard ? "page" : undefined}
          title={`${card.label} (Alt+${card.hotkey})`}
          onClick={() => onSelect(card.id)}
        >
          <span className="card-rail__num" aria-hidden="true">
            {card.hotkey}
          </span>
          <span className="card-rail__label">{card.label}</span>
        </button>
      ))}
      <div className="card-rail__spacer" />
      <button
        type="button"
        className="card-rail__cmd"
        aria-label="Paleta poleceń (Ctrl+K)"
        title="Paleta poleceń (Ctrl+K)"
        onClick={onOpenPalette}
      >
        ⌘K
      </button>
    </nav>
  );
}
