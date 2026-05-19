"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { Extension } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
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

// Custom FontSize extension (TipTap 3 TextStyle attribute)
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, "") || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({
          chain,
        }: {
          chain: () => { setMark: (...a: unknown[]) => { run: () => boolean }; run: () => boolean };
        }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({
          chain,
        }: {
          chain: () => {
            setMark: (...a: unknown[]) => { removeEmptyTextStyle: () => { run: () => boolean } };
            run: () => boolean;
          };
        }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

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

export function NoteEditor({
  content,
  onContentChange,
  placeholder,
  className,
  variant = "default",
}: {
  content: string;
  onContentChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** W ograniczonej wysokości (np. panel mapy myśli): pasek przewijania w treści zamiast obcinania. */
  variant?: "default" | "panel";
}) {
  const proseClass =
    variant === "panel"
      ? "prose prose-lg max-w-none outline-none px-3 py-2 text-[var(--text)] leading-relaxed"
      : "prose prose-lg max-w-none min-h-[60vh] outline-none px-0 py-0 text-[var(--text)] leading-relaxed";

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize,
    ],
    content: content || "<p></p>",
    editorProps: {
      attributes: {
        class: proseClass,
      },
      handleDOMEvents: {
        paste: (view, event) => {
          const text = event.clipboardData?.getData("text/plain");
          if (text) {
            event.preventDefault();
            const { state } = view;
            const paragraph = state.schema.nodes.paragraph;
            if (!paragraph) return false;

            const lines = text.split(/\r?\n/);
            const blocks = lines.map((line) => {
              const content =
                line.length > 0 ? Fragment.from(state.schema.text(line)) : Fragment.empty;
              return paragraph.create({}, content);
            });
            const slice = Slice.maxOpen(Fragment.from(blocks));
            view.dispatch(state.tr.replaceSelection(slice).scrollIntoView());
            return true;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const normalized = content || "<p></p>";
    if (current !== normalized) {
      editor.commands.setContent(normalized, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div
        className={twMerge(
          variant === "panel" ? "h-full min-h-0 flex flex-col" : "min-h-[60vh]",
          "bg-[var(--surface)] rounded-lg",
          className
        )}
      >
        <div className="animate-pulse h-8 bg-[var(--bg3)] rounded mb-4 w-1/3 flex-shrink-0" />
        <div className="animate-pulse h-4 bg-[var(--bg3)] rounded mb-2 flex-1 min-h-[4rem]" />
        <div className="animate-pulse h-4 bg-[var(--bg3)] rounded mb-2 w-5/6" />
      </div>
    );
  }

  return (
    <div
      className={twMerge(
        "border border-[var(--border)] rounded-xl bg-[var(--surface)]",
        variant === "panel" ? "flex flex-col h-full min-h-0 overflow-hidden" : "overflow-hidden",
        className
      )}
    >
      {/* Toolbar */}
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
      {variant === "panel" ? (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <EditorContent editor={editor} />
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}
