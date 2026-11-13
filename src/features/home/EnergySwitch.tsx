// src/features/home/EnergySwitch.tsx
import React from "react";

export type EnergyValue = "deep" | "quick";

/** Dwa przyciski deep/quick: wybrana energia świeci, klik w nią zdejmuje, klik w drugą zmienia. */
export function EnergySwitch({
  title,
  energy,
  disabled,
  onChange,
}: {
  /** Tytuł zadania (do nazw dostępnościowych przycisków). */
  title: string;
  energy: EnergyValue | null;
  disabled: boolean;
  onChange: (energy: EnergyValue | null) => void;
}) {
  return (
    <span className="kok-energy-switch" role="group" aria-label={`Energia: ${title}`}>
      {(["deep", "quick"] as const).map((value) => (
        <button
          key={value}
          type="button"
          className={`kok-energy kok-energy--btn kok-energy--${value}`}
          aria-pressed={energy === value}
          aria-label={`Energia ${value}: ${title}`}
          disabled={disabled}
          onClick={() => onChange(energy === value ? null : value)}
        >
          {value}
        </button>
      ))}
    </span>
  );
}
