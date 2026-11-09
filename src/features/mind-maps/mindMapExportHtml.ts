import type { MindMap } from "@/src/features/mind-maps/mindMapTypes";
import { buildMindMapExportHtmlDocument } from "@/src/features/mind-maps/mindMapExportTemplate";

function escapeHtmlText(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeJsonForScript(value: unknown): string {
  // Avoid closing the surrounding <script> tag if user note contains `</script>`.
  return JSON.stringify(value).replace(/<\/script/gi, "<\\/script");
}

export function buildHTMLExport(map: MindMap): string {
  const title = escapeHtmlText(map.title || "Mapa myśli");
  const rootJson = safeJsonForScript(map.rootNode);
  const colWidthsJson = safeJsonForScript(map.colWidths ?? {});

  // Offline-ready export: no React, no imports, no external assets.
  return buildMindMapExportHtmlDocument(title, rootJson, colWidthsJson);
}

export function exportHTML(map: MindMap) {
  const html = buildHTMLExport(map);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${map.title.replace(/\s+/g, "-").toLowerCase()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
