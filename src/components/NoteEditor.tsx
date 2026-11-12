"use client";

import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { Fragment, Slice } from "@tiptap/pm/model";
import { twMerge } from "tailwind-merge";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown/html-markdown";
import { FontSize } from "./noteEditorExtensions";
import { NoteEditorToolbar } from "./NoteEditorToolbar";

export function NoteEditor({
  content,
  onContentChange,
  placeholder,
  className,
  variant = "default",
  format = "html",
}: {
  content: string;
  /** HTML w trybie `html`, Markdown w trybie `markdown`. */
  onContentChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** W ograniczonej wysokości (np. panel mapy myśli): pasek przewijania w treści zamiast obcinania. */
  variant?: "default" | "panel";
  /**
   * `markdown`: `content` i `onContentChange` operują na Markdownie, a edytor ma tylko formatowanie,
   * które Markdown zapisze (notatki). `html` (domyślnie): bez zmian (notatki węzłów map myśli).
   */
  format?: "html" | "markdown";
}) {
  const markdown = format === "markdown";
  const toEditorHtml = (value: string) => (markdown ? markdownToHtml(value) : value) || "<p></p>";
  const proseClass =
    variant === "panel"
      ? "prose prose-lg max-w-none outline-none px-3 py-2 text-[var(--text)] leading-relaxed"
      : "prose prose-lg max-w-none min-h-[60vh] outline-none px-0 py-0 text-[var(--text)] leading-relaxed";

  const editor = useEditor({
    extensions: markdown
      ? [StarterKit.configure({ underline: false })]
      : [
          StarterKit,
          Underline,
          TextAlign.configure({ types: ["heading", "paragraph"] }),
          TextStyle,
          Color,
          FontFamily.configure({ types: ["textStyle"] }),
          FontSize,
        ],
    content: toEditorHtml(content),
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
      onContentChange(markdown ? htmlToMarkdown(editor.getHTML()) : editor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    if (markdown) {
      // Porównanie na poziomie Markdown: własny zapis edytora nie resetuje kursora; edytor w fokusie
      // nigdy nie jest nadpisywany z zewnątrz (zmiana notatki remontuje komponent przez `key`).
      if (!editor.isFocused && htmlToMarkdown(editor.getHTML()) !== content) {
        editor.commands.setContent(toEditorHtml(content), { emitUpdate: false });
      }
      return;
    }
    const current = editor.getHTML();
    const normalized = content || "<p></p>";
    if (current !== normalized) {
      editor.commands.setContent(normalized, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <NoteEditorToolbar editor={editor} format={format} />
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
