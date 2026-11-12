import { test, expect } from "vitest";
import { buildHTMLExport } from "@/src/features/mind-maps/mindMapExportHtml";
import type { MindMap } from "@/src/features/mind-maps/mindMapTypes";

const map: MindMap = {
  id: "m1",
  title: "Client X",
  rootNode: {
    id: "n1",
    label: "Delivery",
    note: "",
    collapsed: false,
    children: [],
  },
  colWidths: { 0: 150 },
  createdAt: "2026-11-09T00:00:00.000Z",
  updatedAt: "2026-11-09T00:00:00.000Z",
};

test("buildHTMLExport snapshot of a one-node map", () => {
  expect(buildHTMLExport(map)).toMatchSnapshot();
});
