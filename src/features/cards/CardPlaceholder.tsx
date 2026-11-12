"use client";

import React from "react";
import { type CardId, getCard } from "./cards";

export function CardPlaceholder({ cardId }: { cardId: CardId }) {
  const card = getCard(cardId);
  const stage = card.target.kind === "placeholder" ? card.target.stage : "";
  const mockup = `docs/mockups/karty/cards/0${card.hotkey}-${card.id}.html`;
  return (
    <section className="card-placeholder" aria-labelledby="card-placeholder-title">
      <h1 id="card-placeholder-title" className="card-placeholder__title">
        {card.label}
      </h1>
      <p>Ta karta powstanie w etapie wdrożenia ({stage}).</p>
      <p>
        Makieta: <code>{mockup}</code>
      </p>
    </section>
  );
}
