"use client";

import React, { useRef } from "react";
import type { PlanningTab } from "@/src/features/planowanie/PlanowanieSidebarContent";
import { cardForView, type CardId } from "./cards";

export interface CardSubTabItem {
  id: PlanningTab;
  label: string;
}

export interface CardSubTabsProps {
  tabs: CardSubTabItem[];
  active: PlanningTab;
  onSelect: (tab: PlanningTab) => void;
  cardId?: CardId;
}

export function CardSubTabs({ tabs, active, onSelect, cardId }: CardSubTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!tabs || tabs.length < 2) {
    return null;
  }

  const currentCard = cardId ?? cardForView("planowanie", active);

  const selectIndex = (nextIndex: number) => {
    const nextTab = tabs[nextIndex];
    if (nextTab) {
      onSelect(nextTab.id);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        selectIndex((index + 1) % tabs.length);
        break;
      case "ArrowLeft":
        e.preventDefault();
        selectIndex((index - 1 + tabs.length) % tabs.length);
        break;
      case "Home":
        e.preventDefault();
        selectIndex(0);
        break;
      case "End":
        e.preventDefault();
        selectIndex(tabs.length - 1);
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Widoki karty"
      className="card-subtabs"
      data-card={currentCard}
      style={{ "--c": `var(--c-${currentCard})` } as React.CSSProperties}
    >
      {tabs.map((tab, index) => {
        const isSelected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={`card-subtabs__tab${isSelected ? " card-subtabs__tab--active" : ""}`}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
