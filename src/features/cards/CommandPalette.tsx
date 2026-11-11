"use client";

import React, { useEffect, useRef, useState } from "react";
import { filterCommands, type PaletteCommand } from "./cards";

export interface CommandPaletteProps {
  commands: PaletteCommand[];
  onClose: () => void;
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = filterCommands(commands, query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const run = (cmd: PaletteCommand | undefined) => {
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(shown[selected]);
    }
  };

  return (
    <div
      className="card-palette__overlay"
      data-testid="palette-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card-palette" role="dialog" aria-modal="true" aria-label="Paleta poleceń">
        <input
          ref={inputRef}
          className="card-palette__input"
          aria-label="Polecenie"
          placeholder="Wpisz polecenie lub nazwę…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
        />
        <ul className="card-palette__list" role="listbox" aria-label="Polecenia">
          {shown.map((cmd, i) => (
            <li
              key={cmd.id}
              role="option"
              aria-selected={i === selected}
              className="card-palette__item"
              onMouseEnter={() => setSelected(i)}
              onClick={() => run(cmd)}
            >
              <span>{cmd.label}</span>
              {cmd.hint && <kbd className="card-palette__kbd">{cmd.hint}</kbd>}
            </li>
          ))}
          {shown.length === 0 && <li className="card-palette__empty">Brak wyników</li>}
        </ul>
      </div>
    </div>
  );
}
