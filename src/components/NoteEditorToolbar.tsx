"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { twMerge } from "tailwind-merge";

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];
const FONT_FAMILIES = [
  { label: "Sans", value: "" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
];
const COLORS = [
  "#000000",
  "#374151",
  "#DC2626",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#2563EB",
  "#7C3AED",
];

function normalizeHexColor(c: string): string {
  return c.trim().toLowerCase();
}

function ColorSwatch({ color, className }: { color?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={twMerge(
        "inline-block size-4 shrink-0 rounded-sm border border-[var(--border)]",
        className
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

function TextColorPicker({
  value,
  onPick,
  onClear,
}: {
  value: string;
  onPick: (hex: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const normalizedValue = value ? normalizeHexColor(value) : "";

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex items-center gap-1" title="Kolor tekstu">
      <Palette className="size-4 text-[var(--text2)] shrink-0" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-8 flex items-center gap-1.5 px-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] cursor-pointer min-w-[5.75rem]"
      >
        <ColorSwatch color={value || undefined} />
        <span className="truncate tabular-nums">{value ? value.toUpperCase() : "Kolor"}</span>
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
          role="listbox"
        >
          <button
            type="button"
            role="option"
            aria-selected={!normalizedValue}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--bg3)]"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            <span
              aria-hidden
              className="inline-block size-4 shrink-0 rounded-sm border border-dashed border-[var(--border)] bg-[var(--bg3)]"
            />
            <span>Domyślny</span>
          </button>
          {COLORS.map((color) => {
            const active = normalizedValue === normalizeHexColor(color);
            return (
              <button
                key={color}
                type="button"
                role="option"
                aria-selected={active}
                className={twMerge(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-[var(--bg3)]",
                  active && "bg-[var(--accent)]/25"
                )}
                onClick={() => {
                  onPick(color);
                  setOpen(false);
                }}
              >
                <ColorSwatch color={color} />
                <span className="font-mono text-xs tabular-nums text-[var(--text)]">{color}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
  className,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={twMerge(
        "p-2 rounded-lg transition-colors",
        active ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--bg3)] text-[var(--text)]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
}

export function NoteEditorToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-[var(--border)] bg-[var(--bg2)] flex-shrink-0">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Pogrubienie"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Kursywa"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Podkreślenie"
      >
        <UnderlineIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Przekreślenie"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <span className="w-px h-6 bg-[var(--border)] mx-1" />
      {/* Text alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="Wyrównaj do lewej"
      >
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="Wyśrodkuj"
      >
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="Wyrównaj do prawej"
      >
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        active={editor.isActive({ textAlign: "justify" })}
        title="Justowanie"
      >
        <AlignJustify className="w-4 h-4" />
      </ToolbarButton>
      <span className="w-px h-6 bg-[var(--border)] mx-1" />
      {/* Font size */}
      <select
        title="Rozmiar czcionki"
        value={(editor.getAttributes("textStyle").fontSize as string) || ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontSize(v).run();
          else editor.chain().focus().unsetFontSize().run();
        }}
        className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] min-w-[4rem]"
      >
        <option value="">Rozmiar</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      {/* Font family */}
      <select
        title="Czcionka"
        value={(editor.getAttributes("textStyle").fontFamily as string) ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] min-w-[5rem]"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.value || "default"} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <span className="w-px h-6 bg-[var(--border)] mx-1" />
      <TextColorPicker
        value={(editor.getAttributes("textStyle").color as string) ?? ""}
        onPick={(hex) => editor.chain().focus().setColor(hex).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
      />
    </div>
  );
}
