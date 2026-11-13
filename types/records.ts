export interface MindMap {
  id: string;
  title: string;
  rootNode: MindMapNode;
  /** Column widths in px per depth level. */
  colWidths: Record<number, number>;
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}

export interface MindMapNode {
  /** Unique within a mind map (use nanoid()). */
  id: string;
  label: string;
  /** Rich text (TipTap JSON or HTML depending on editor implementation). */
  note: string;
  /** UI state persisted in the document. */
  collapsed: boolean;
  children: MindMapNode[];
}

/** Zapisany dokument tablicy (surowe, jeszcze nieprzetworzone przez parseBoard). */
export type BoardDoc = { tiles: unknown; frames: unknown; edges: unknown };
