"use client";

import React from "react";
import { useLang } from "@/src/i18n/useLang";
import { useT } from "@/src/i18n/useT";
import { CARDS, type CardId } from "./cards";

export interface CardRailProps {
  activeCard: CardId;
  onSelect: (id: CardId) => void;
  onOpenPalette: () => void;
}

export function CardRail({ activeCard, onSelect, onOpenPalette }: CardRailProps) {
  const t = useT();
  const { lang, toggleLang } = useLang();
  const langLabel = lang === "pl" ? t("common:lang.switchToEn") : t("common:lang.switchToPl");
  return (
    <nav className="card-rail" aria-label={t("shell:rail.aria")}>
      <div className="card-rail__logo" aria-hidden="true">
        M
      </div>
      {CARDS.map((card) => {
        const label = t(`shell:cards.${card.id}`);
        return (
          <button
            key={card.id}
            type="button"
            data-card-id={card.id}
            className="card-rail__item"
            style={{ "--c": `var(--c-${card.id})` } as React.CSSProperties}
            aria-current={card.id === activeCard ? "page" : undefined}
            title={t("shell:rail.cardTitle", { label, hotkey: card.hotkey })}
            onClick={() => onSelect(card.id)}
          >
            <span className="card-rail__num" aria-hidden="true">
              {card.hotkey}
            </span>
            <span className="card-rail__label">{label}</span>
          </button>
        );
      })}
      <div className="card-rail__spacer" />
      <button
        type="button"
        className="card-rail__lang"
        aria-label={langLabel}
        title={langLabel}
        onClick={toggleLang}
      >
        <span className={lang === "pl" ? "is-active" : undefined}>PL</span>
        <span className={lang === "en" ? "is-active" : undefined}>EN</span>
      </button>
      <button
        type="button"
        className="card-rail__cmd"
        aria-label={t("shell:rail.palette")}
        title={t("shell:rail.palette")}
        onClick={onOpenPalette}
      >
        ⌘K
      </button>
    </nav>
  );
}
