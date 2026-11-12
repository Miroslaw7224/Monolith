import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MindMapTree } from "@/src/features/mind-maps/MindMapTree";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { translations } from "@/src/translations";

afterEach(() => cleanup());

const root: MindMapNode = {
  id: "root",
  label: "Korzeń",
  note: "",
  collapsed: false,
  children: [{ id: "child", label: "Dziecko", note: "", collapsed: false, children: [] }],
};

function Editor({
  onCommitLabel,
  onStartEdit,
}: {
  onCommitLabel: (id: string, next: string) => void;
  onStartEdit: (id: string) => void;
}) {
  const [editId] = useState<string | null>("child");
  return (
    <MindMapTree
      mode="edit"
      rootNode={root}
      t={translations.pl}
      getColW={() => 150}
      startResize={() => {}}
      selId="child"
      editId={editId}
      ctxId={null}
      dragId={null}
      dropId={null}
      onSelect={() => {}}
      onToggleCollapsed={() => {}}
      onStartEdit={onStartEdit}
      onCommitLabel={onCommitLabel}
      onToggleCtx={() => {}}
      onAddChild={() => {}}
      onInsertAbove={() => {}}
      onRequestDelete={() => {}}
      onExportToOtherMap={() => {}}
      onDragStart={() => {}}
      onDragOver={() => {}}
      onDrop={() => {}}
      onDragEnd={() => {}}
    />
  );
}

describe("MindMapTree label edit", () => {
  it("Escape cancels the rename and the following blur does not commit", () => {
    const onCommitLabel = vi.fn();
    const onStartEdit = vi.fn();
    render(<Editor onCommitLabel={onCommitLabel} onStartEdit={onStartEdit} />);

    const input = screen.getByDisplayValue("Dziecko");
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(onStartEdit).toHaveBeenCalledWith("");
    expect(onCommitLabel).not.toHaveBeenCalled();
  });

  it("ArrowDown selects the next visible node", () => {
    const onSelect = vi.fn();
    render(
      <MindMapTree
        mode="edit"
        rootNode={root}
        t={translations.pl}
        getColW={() => 150}
        startResize={() => {}}
        selId="root"
        editId={null}
        ctxId={null}
        dragId={null}
        dropId={null}
        onSelect={onSelect}
        onToggleCollapsed={() => {}}
        onStartEdit={() => {}}
        onCommitLabel={() => {}}
        onToggleCtx={() => {}}
        onAddChild={() => {}}
        onInsertAbove={() => {}}
        onRequestDelete={() => {}}
        onExportToOtherMap={() => {}}
        onDragStart={() => {}}
        onDragOver={() => {}}
        onDrop={() => {}}
        onDragEnd={() => {}}
      />
    );

    const [rootItem] = screen.getAllByRole("treeitem");
    rootItem.focus();
    fireEvent.keyDown(rootItem, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenCalledWith("child");
  });
});
