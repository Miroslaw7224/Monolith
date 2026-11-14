# CURSOR TASK — Implementacja Mind Maps

**Stan (marzec 2026):** funkcja jest **wdrożona** w repo (`MindMapsTab`, `MindMapTree`, API `/api/mind-maps`, **`/api/mind-maps/import`**, eksport HTML). Poniższy dokument zostaje jako **referencja prototypu** i checklisty; przy dalszych zmianach trzymaj spójność z **ADR-017** (aktualny opis produktu i endpointów).

Poniżej znajdziesz działający prototyp UI mapy myśli (vanilla HTML/JS) oraz instrukcję adaptacji do projektu Drugi Mózg.

## Twoje zadanie

Przeportuj ten prototyp do aplikacji Next.js zgodnie z:

- **ADR-017** — model danych, architektura warstw, nazwy serwisów/plików
- **Istniejącym stylem aplikacji** — Tailwind CSS, komponenty zgodne z resztą UI (wzoruj się na sekcji Resources)
- **Strukturą hooków** — analogicznie do `useResources` stwórz `useMindMaps`

Nie wymyślaj algorytmu layoutu od nowa — użyj funkcji `leafCount` i `renderLevel` z prototypu jako reference implementation (przepisz do React/TSX).

---

## Kolejność implementacji

1. Model danych — interfejsy TypeScript (`MindMap`, `MindMapNode`) zgodnie z ADR-017
2. Firestore — kolekcja `mindMaps`, reguły bezpieczeństwa
3. `mindMapService.ts` — CRUD (create, get, getAll, save, delete)
4. `mindMapAIService.ts` — `generateNodeFromWeb(query)` przez Gemini + Google Search grounding
5. Route handlers — `/api/mind-maps/*` zgodnie z ADR-017 (w tym **`POST /api/mind-maps/import`** dla tekstu i/lub obrazu)
6. Hook `useMindMaps` — state management, debounced save (1500ms)
7. Komponenty UI — przeportuj logikę z prototypu do React komponentów
8. Integracja z nawigacją — dodaj sekcję Mind Maps do sidebar

---

## Edge cases do zachowania z prototypu

- Drag & drop: blokuj przenoszenie węzła na jego własne dziecko — funkcja `find(node, pid)` przed `moveUnder`
- Usuwanie z dziećmi: dwa warianty — "usuń tylko ten" (dzieci awansują) vs "usuń całą gałąź"
- Edycja inline: Escape anuluje bez zapisu, Enter zatwierdza
- `colWidths` per głębokość — jedna szerokość dla całego poziomu, nie per węzeł
- `collapsed` persystowany w Firestore (nie tylko React state)

---

## Prototyp referencyjny (HTML/JS → przepisz do React/TSX)

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .app {
        display: flex;
        flex-direction: column;
        height: 680px;
        border: 0.5px solid var(--color-border-tertiary);
        border-radius: var(--border-radius-lg);
        overflow: hidden;
        background: var(--color-background-primary);
        position: relative;
      }
      .hdr {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border-bottom: 0.5px solid var(--color-border-tertiary);
        background: var(--color-background-secondary);
        flex-shrink: 0;
      }
      .bc {
        font-size: 13px;
        color: var(--color-text-secondary);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tbar {
        margin-left: auto;
        display: flex;
        gap: 6px;
      }
      .tbtn {
        background: transparent;
        border: 0.5px solid var(--color-border-secondary);
        border-radius: var(--border-radius-md);
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        color: var(--color-text-secondary);
        font-family: var(--font-sans);
      }
      .tbtn:hover {
        background: var(--color-background-secondary);
      }
      .tbtn.acc {
        background: #185fa5;
        border-color: #185fa5;
        color: #fff;
      }
      .main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .tree {
        flex: 1;
        overflow: auto;
        padding: 20px 24px;
      }
      .bp {
        height: 160px;
        border-top: 0.5px solid var(--color-border-tertiary);
        background: var(--color-background-secondary);
        flex-shrink: 0;
      }
      .bpi {
        padding: 14px 20px;
        height: 100%;
        display: flex;
        gap: 16px;
      }
      .nb {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: var(--border-radius-md);
        border: 0.5px solid var(--color-border-tertiary);
        background: var(--color-background-primary);
        cursor: pointer;
        position: relative;
        overflow: visible;
        flex-shrink: 0;
      }
      .nb:hover {
        border-color: var(--color-border-secondary);
        background: var(--color-background-secondary);
      }
      .nb.sel {
        border-color: #b5d4f4;
        background: #e6f1fb;
      }
      .nb.drp {
        border-color: #c0dd97;
        background: #eaf3de;
      }
      .nb.drg {
        opacity: 0.3;
      }
      .lbl {
        font-size: 13px;
        color: var(--color-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        min-width: 0;
      }
      .lbl.root {
        font-weight: 500;
        color: #185fa5;
      }
      .lbl.branch {
        font-weight: 500;
      }
      .chv {
        width: 13px;
        height: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-secondary);
        transition: transform 0.15s;
        flex-shrink: 0;
        cursor: pointer;
      }
      .chv.open {
        transform: rotate(90deg);
      }
      .chv.empty {
        opacity: 0;
        pointer-events: none;
      }
      .ndot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #378add;
        flex-shrink: 0;
      }
      .acts {
        display: none;
        align-items: center;
        gap: 1px;
        flex-shrink: 0;
      }
      .nb:hover .acts,
      .nb.sel .acts {
        display: flex;
      }
      .ab {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1;
      }
      .ab:hover {
        background: var(--color-border-tertiary);
      }
      .ab.add {
        color: #1d9e75;
        font-size: 14px;
        font-weight: 500;
      }
      .ab.ai {
        color: #378add;
      }
      .ab.more {
        color: var(--color-text-secondary);
        letter-spacing: 1px;
      }
      .ni {
        width: 16px;
        height: 16px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        flex-shrink: 0;
      }
      .ni.root {
        background: #e6f1fb;
        color: #185fa5;
      }
      .ni.branch {
        background: #e1f5ee;
        color: #0f6e56;
      }
      .ni.leaf {
        background: var(--color-background-secondary);
        color: var(--color-text-secondary);
      }
      .ei {
        background: var(--color-background-primary);
        border: 0.5px solid #378add;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 13px;
        outline: none;
        color: var(--color-text-primary);
        width: 100%;
        min-width: 0;
      }
      .ctx {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 60;
        background: var(--color-background-primary);
        border: 0.5px solid var(--color-border-secondary);
        border-radius: var(--border-radius-lg);
        padding: 4px;
        min-width: 200px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      }
      .ci {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        background: transparent;
        border: none;
        padding: 6px 10px;
        border-radius: var(--border-radius-md);
        font-size: 12px;
        color: var(--color-text-primary);
        cursor: pointer;
        text-align: left;
      }
      .ci:hover {
        background: var(--color-background-secondary);
      }
      .ci.dng {
        color: #a32d2d;
      }
      .slbl {
        font-size: 11px;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 5px;
        flex-shrink: 0;
      }
      .sna {
        width: 100%;
        background: var(--color-background-primary);
        border: 0.5px solid var(--color-border-tertiary);
        border-radius: var(--border-radius-md);
        padding: 8px 10px;
        font-size: 13px;
        line-height: 1.5;
        color: var(--color-text-primary);
        resize: none;
        outline: none;
      }
      .sna:focus {
        border-color: var(--color-border-secondary);
      }
      .mb {
        background: var(--color-background-primary);
        border: 0.5px solid var(--color-border-secondary);
        border-radius: var(--border-radius-md);
        padding: 5px 10px;
        font-size: 12px;
        cursor: pointer;
        color: var(--color-text-primary);
        text-align: center;
        white-space: nowrap;
      }
      .mb:hover {
        background: var(--color-background-secondary);
      }
      .mb.dng {
        border-color: #e24b4a;
        color: #a32d2d;
      }
      .mb.dng:hover {
        background: #fcebeb;
      }
      .mb.ac {
        background: #185fa5;
        border-color: #185fa5;
        color: #fff;
      }
      .mb.ac:hover {
        background: #0c447c;
      }
      .mb .sub {
        font-size: 11px;
        display: block;
        margin-top: 2px;
        opacity: 0.7;
      }
      .dh {
        cursor: grab;
        color: var(--color-text-secondary);
        opacity: 0;
        font-size: 11px;
        flex-shrink: 0;
        letter-spacing: -1px;
        padding: 0 1px;
      }
      .nb:hover .dh {
        opacity: 0.5;
      }
      .rh {
        position: absolute;
        right: -8px;
        top: 0;
        width: 16px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: col-resize;
        z-index: 10;
        opacity: 0;
        transition: opacity 0.15s;
      }
      .rh::after {
        content: "";
        display: block;
        width: 2px;
        height: 22px;
        border-radius: 2px;
        background: var(--color-border-secondary);
      }
      .nb:hover .rh,
      .rh.active {
        opacity: 1;
      }
      .rh.active::after {
        background: #378add;
      }
      .rhint {
        position: absolute;
        top: -24px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--color-background-primary);
        border: 0.5px solid var(--color-border-secondary);
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 11px;
        color: var(--color-text-secondary);
        white-space: nowrap;
        pointer-events: none;
      }
      .mo {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.28);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        border-radius: var(--border-radius-lg);
      }
      .md {
        background: var(--color-background-primary);
        border: 0.5px solid var(--color-border-secondary);
        border-radius: var(--border-radius-lg);
        padding: 20px;
        min-width: 330px;
        max-width: 420px;
      }
      .mt {
        font-size: 15px;
        font-weight: 500;
        margin-bottom: 6px;
        color: var(--color-text-primary);
      }
      .mdsc {
        font-size: 13px;
        color: var(--color-text-secondary);
        margin-bottom: 16px;
        line-height: 1.55;
      }
      .mbs {
        display: flex;
        gap: 8px;
      }
      .air {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      .ain {
        flex: 1;
        background: var(--color-background-secondary);
        border: 0.5px solid var(--color-border-secondary);
        border-radius: var(--border-radius-md);
        padding: 7px 10px;
        font-size: 13px;
        outline: none;
        color: var(--color-text-primary);
      }
      .ain:focus {
        border-color: #378add;
      }
      .ares {
        background: var(--color-background-secondary);
        border: 0.5px solid var(--color-border-tertiary);
        border-radius: var(--border-radius-md);
        padding: 12px;
        margin-bottom: 12px;
      }
      .arlbl {
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 4px;
        color: var(--color-text-primary);
      }
      .ardsc {
        font-size: 12px;
        color: var(--color-text-secondary);
        line-height: 1.6;
      }
      .spin {
        display: inline-block;
        animation: sp 1s linear infinite;
      }
      @keyframes sp {
        to {
          transform: rotate(360deg);
        }
      }
    </style>
  </head>
  <body>
    <div class="app" id="app">
      <div class="hdr">
        <div class="bc">
          <span style="color:#185FA5;font-weight:500">Drugi Mózg</span>
          <span>›</span><span>Mapy myśli</span><span>›</span>
          <strong style="color:var(--color-text-primary);font-weight:500">Narzędzia AI</strong>
        </div>
        <div class="tbar">
          <button class="tbtn" onclick="collapseAll()">Zwiń wszystko</button>
          <button class="tbtn" onclick="expandAll()">Rozwiń wszystko</button>
          <button class="tbtn" onclick="resetWidths()">↺ Reset szerokości</button>
          <button class="tbtn acc">+ Nowa mapa</button>
        </div>
      </div>
      <div class="main">
        <div class="tree" id="tc"></div>
        <div class="bp"><div class="bpi" id="bp"></div></div>
      </div>
      <div id="mc"></div>
    </div>

    <script>
      // ─── DANE ────────────────────────────────────────────────────────────────────
      // W React zastąp useState + Firestore
      let T = {
        id: "root",
        label: "Narzędzia AI",
        collapsed: false,
        note: "",
        children: [
          {
            id: "n1",
            label: "Agenty AI",
            collapsed: false,
            note: "",
            children: [
              {
                id: "n1a",
                label: "n8n",
                collapsed: false,
                note: "Open-source workflow automation.",
                children: [
                  { id: "n1a1", label: "Integracje API", collapsed: false, note: "", children: [] },
                  { id: "n1a2", label: "Self-hosting", collapsed: false, note: "", children: [] },
                ],
              },
              { id: "n1b", label: "Make.com", collapsed: false, note: "", children: [] },
              { id: "n1c", label: "Zapier", collapsed: false, note: "", children: [] },
            ],
          },
          {
            id: "n2",
            label: "Modele LLM",
            collapsed: false,
            note: "",
            children: [
              { id: "n2a", label: "GPT-4o", collapsed: false, note: "", children: [] },
              { id: "n2b", label: "Gemini Pro", collapsed: false, note: "", children: [] },
              { id: "n2c", label: "Claude Sonnet", collapsed: false, note: "", children: [] },
            ],
          },
          {
            id: "n3",
            label: "Bazy wektorowe",
            collapsed: true,
            note: "",
            children: [
              { id: "n3a", label: "Pinecone", collapsed: false, note: "", children: [] },
              { id: "n3b", label: "Qdrant", collapsed: false, note: "", children: [] },
            ],
          },
        ],
      };

      // ─── STATE ────────────────────────────────────────────────────────────────────
      // W React: useState dla selId, editId, colWidths
      // colWidths persystuj w Firestore jako część dokumentu MindMap
      let selId = null,
        editId = null,
        ctxId = null,
        dragId = null,
        dropId = null;
      const DEFAULT_COL_W = 150,
        MIN_COL_W = 80,
        MAX_COL_W = 300;
      let colWidths = {};
      function getColW(depth) {
        return colWidths[depth] ?? DEFAULT_COL_W;
      }

      // ─── RESIZE LOGIC ─────────────────────────────────────────────────────────────
      // W React: useRef dla resizing, useEffect dla mousemove/mouseup na document
      let resizing = null;
      function startResize(e, depth) {
        e.stopPropagation();
        e.preventDefault();
        resizing = { depth, startX: e.clientX, startW: getColW(depth) };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }
      document.addEventListener("mousemove", (e) => {
        if (!resizing) return;
        const dx = e.clientX - resizing.startX;
        const newW = Math.max(MIN_COL_W, Math.min(MAX_COL_W, resizing.startW + dx));
        colWidths[resizing.depth] = newW;
        // Live update bez re-renderu — wydajniejsze
        document
          .querySelectorAll(`[data-depth="${resizing.depth}"]`)
          .forEach((el) => (el.style.width = newW + "px"));
        document
          .querySelectorAll(`.rh[data-depth="${resizing.depth}"] .rhint`)
          .forEach((el) => (el.textContent = Math.round(newW) + "px"));
      });
      document.addEventListener("mouseup", () => {
        if (!resizing) return;
        resizing = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.querySelectorAll(".rh").forEach((el) => el.classList.remove("active"));
        render(); // pełny re-render po zakończeniu resize
      });
      function resetWidths() {
        colWidths = {};
        render();
      }

      // ─── TREE HELPERS ─────────────────────────────────────────────────────────────
      // Wszystkie czyste funkcje — łatwe do przepisania jako utils/mindMapUtils.ts
      const find = (n, id) =>
        n.id === id ? n : n.children.reduce((f, c) => f || find(c, id), null);
      const mapN = (n, id, fn) =>
        n.id === id ? fn(n) : { ...n, children: n.children.map((c) => mapN(c, id, fn)) };
      const mapAll = (n, fn) => fn({ ...n, children: n.children.map((c) => mapAll(c, fn)) });
      const remN = (n, id) => ({
        ...n,
        children: n.children.filter((c) => c.id !== id).map((c) => remN(c, id)),
      });
      const delKeep = (n, id) => {
        const ch = [];
        for (const c of n.children) {
          if (c.id === id) ch.push(...c.children);
          else ch.push(delKeep(c, id));
        }
        return { ...n, children: ch };
      };
      const insAbove = (n, cid, np) => ({
        ...n,
        children: n.children.map((c) =>
          c.id === cid ? { ...np, children: [c] } : insAbove(c, cid, np)
        ),
      });
      const moveUnder = (root, nid, pid) => {
        const node = find(root, nid);
        if (!node || find(node, pid)) return root; // ← WAŻNE: blokuje zapętlenie drzewa
        return mapN(remN(root, nid), pid, (p) => ({ ...p, children: [...p.children, node] }));
      };
      const esc = (s) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      const uid = () => "n" + Math.random().toString(36).slice(2, 7);

      // ─── LAYOUT ALGORITHM ─────────────────────────────────────────────────────────
      // KLUCZOWE: przepisz dokładnie do React jako czystą funkcję renderującą JSX
      // ROW_H i GAP_H możesz wyeksponować jako stałe konfiguracyjne
      const ROW_H = 38,
        GAP_H = 8,
        CONN = 24;

      // Zlicz widoczne liście poddrzewa (uwzględnia collapsed)
      function leafCount(node) {
        if (!node.children.length || node.collapsed) return 1;
        return node.children.reduce((s, c) => s + leafCount(c), 0);
      }

      // Renderuje węzeł + jego dzieci rekurencyjnie
      // depth → indeks do colWidths (szerokość kolumny na tym poziomie)
      function renderLevel(node, isRoot, depth) {
        const lc = leafCount(node);
        const totalH = lc * ROW_H + (lc - 1) * GAP_H;
        const hasKids = node.children.length > 0 && !node.collapsed;
        const pill = makePill(node, isRoot, depth);
        if (!hasKids) {
          return `<div style="height:${ROW_H}px;display:flex;align-items:center">${pill}</div>`;
        }
        // Matematyczne wyśrodkowanie węzła względem gałęzi dzieci
        const firstLC = leafCount(node.children[0]);
        const lastLC = leafCount(node.children[node.children.length - 1]);
        const vTop = (firstLC * ROW_H + (firstLC - 1) * GAP_H) / 2;
        const vBot = totalH - (lastLC * ROW_H + (lastLC - 1) * GAP_H) / 2;
        const vH = Math.max(0, vBot - vTop);
        const HALF = CONN / 2;
        const kidsHTML = node.children
          .map((c, i) => {
            const clc = leafCount(c);
            const slotH = clc * ROW_H + (clc - 1) * GAP_H;
            const mt = i > 0 ? `margin-top:${GAP_H}px` : "";
            return `<div style="height:${slotH}px;${mt};display:flex;align-items:center">
      <div style="width:${HALF}px;height:0.5px;background:var(--color-border-secondary);flex-shrink:0"></div>
      ${renderLevel(c, false, depth + 1)}
    </div>`;
          })
          .join("");
        return `<div style="height:${totalH}px;display:flex;align-items:center">
    ${pill}
    <div style="width:${CONN}px;flex-shrink:0;height:${totalH}px;position:relative">
      <div style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:${HALF}px;height:0.5px;background:var(--color-border-secondary)"></div>
      <div style="position:absolute;left:${HALF}px;top:${vTop}px;width:0.5px;height:${vH}px;background:var(--color-border-secondary)"></div>
    </div>
    <div style="display:flex;flex-direction:column;height:${totalH}px">${kidsHTML}</div>
  </div>`;
      }

      // ─── PILL (pojedynczy węzeł) ──────────────────────────────────────────────────
      function makePill(node, isRoot, depth) {
        const colW = getColW(depth);
        const editing = node.id === editId,
          sel = node.id === selId;
        const isDrag = node.id === dragId,
          isDrop = node.id === dropId;
        const hasKids = node.children.length > 0;
        const iType = isRoot ? "root" : hasKids ? "branch" : "leaf";
        const iChar = isRoot ? "✦" : hasKids ? "▤" : "·";
        const lblCls = isRoot ? "root" : hasKids ? "branch" : "";
        const dragAttr = !isRoot ? 'draggable="true"' : "";
        const chvHtml = hasKids
          ? `<div class="chv${node.collapsed ? "" : " open"}" onclick="togColl('${node.id}',event)"><svg width="6" height="9" viewBox="0 0 6 9" fill="none"><path d="M1 1l4 3.5L1 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>`
          : `<div class="chv empty"></div>`;
        const lblHtml = editing
          ? `<input class="ei" id="ei-${node.id}" value="${esc(node.label)}" onclick="event.stopPropagation()" onkeydown="ek(event,'${node.id}')" onblur="ce('${node.id}')" />`
          : `<span class="lbl ${lblCls}" ondblclick="startEdit('${node.id}',event)">${esc(node.label)}</span>`;
        const dot = node.note && !editing ? '<div class="ndot"></div>' : "";
        const acts = !editing
          ? `<div class="acts">
    <button class="ab add" onclick="addKid('${node.id}',event)" title="Dodaj dziecko">+</button>
    <button class="ab ai" onclick="openAI('${node.id}',event)" title="AI search">✦</button>
    <button class="ab more" onclick="toggleCtx('${node.id}',event)">···</button>
  </div>`
          : "";
        const ctxHtml =
          ctxId === node.id
            ? `<div class="ctx" onclick="event.stopPropagation()">
    ${!isRoot ? `<button class="ci" onclick="doInsAbove('${node.id}')">↑ Wstaw węzeł powyżej</button>` : ""}
    <button class="ci" onclick="startEdit('${node.id}')">✎ Zmień nazwę</button>
    ${!isRoot ? `<button class="ci dng" onclick="reqDel('${node.id}')">✕ Usuń węzeł</button>` : ""}
  </div>`
            : "";
        // Uchwyt resize — po prawej krawędzi, zmienia szerokość całej kolumny (depth)
        const resizeHandle = `<div class="rh" data-depth="${depth}" onmousedown="startResize(event,${depth})">
    <div class="rhint">${Math.round(colW)}px</div>
  </div>`;
        return `<div class="nb${sel ? " sel" : ""}${isDrop ? " drp" : ""}${isDrag ? " drg" : ""}"
    data-id="${node.id}" data-depth="${depth}"
    style="width:${colW}px;height:${ROW_H}px"
    onclick="selNode('${node.id}',event)"
    ${dragAttr}
    ondragstart="ds(event,'${node.id}')"
    ondragover="dov(event,'${node.id}')"
    ondrop="dp(event,'${node.id}')"
    ondragend="de()">
    ${!isRoot ? '<div class="dh">⠿</div>' : ""}
    ${chvHtml}
    <div class="ni ${iType}">${iChar}</div>
    ${lblHtml}${dot}${acts}${ctxHtml}${resizeHandle}
  </div>`;
      }

      // ─── RENDER ───────────────────────────────────────────────────────────────────
      function render() {
        const tc = document.getElementById("tc");
        if (!tc) return;
        tc.innerHTML = `<div style="display:inline-flex;align-items:center;min-width:max-content">${renderLevel(T, true, 0)}</div>`;
        if (editId) {
          const ei = document.getElementById("ei-" + editId);
          if (ei) {
            ei.focus();
            try {
              ei.setSelectionRange(0, ei.value.length);
            } catch (e) {}
          }
        }
        renderBP();
      }

      // ─── BOTTOM PANEL ─────────────────────────────────────────────────────────────
      // W React: zastąp textarea → TipTap editor (już masz w projekcie)
      function renderBP() {
        const bp = document.getElementById("bp");
        if (!bp) return;
        if (!selId) {
          bp.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;flex:1;font-size:13px;color:var(--color-text-secondary)">Kliknij węzeł aby zobaczyć i edytować notatki</div>`;
          return;
        }
        const node = find(T, selId);
        if (!node) {
          bp.innerHTML = "";
          return;
        }
        bp.innerHTML = `
    <div style="width:170px;flex-shrink:0;border-right:0.5px solid var(--color-border-tertiary);padding-right:16px;display:flex;flex-direction:column;gap:8px;overflow:hidden">
      <div>
        <div class="slbl">Wybrany węzeł</div>
        <div style="font-weight:500;font-size:14px;color:var(--color-text-primary);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(node.label)}</div>
        <div style="font-size:12px;color:var(--color-text-secondary)">${node.children.length} elementów</div>
      </div>
      <button class="mb" onclick="addKid('${node.id}')">+ Dodaj dziecko</button>
      ${node.id !== "root" ? `<button class="mb" onclick="doInsAbove('${node.id}')">↑ Wstaw węzeł powyżej</button>` : ""}
    </div>
    <div style="flex:1;display:flex;flex-direction:column;gap:5px;padding-left:16px;overflow:hidden;min-width:0">
      <div class="slbl">Notatki</div>
      <!-- W React: zamień na <TipTapEditor content={node.note} onChange={...} /> -->
      <textarea class="sna" placeholder="Notatki do tego węzła..." oninput="upNote('${node.id}',this.value)" style="flex:1;height:0;min-height:0">${esc(node.note)}</textarea>
    </div>`;
      }

      // ─── AKCJE ────────────────────────────────────────────────────────────────────
      function togColl(id, e) {
        e && e.stopPropagation();
        T = mapN(T, id, (n) => ({ ...n, collapsed: !n.collapsed }));
        render();
      }
      function collapseAll() {
        T = mapAll(T, (n) => (n.id === "root" ? n : { ...n, collapsed: n.children.length > 0 }));
        render();
      }
      function expandAll() {
        T = mapAll(T, (n) => ({ ...n, collapsed: false }));
        render();
      }
      function selNode(id, e) {
        ctxId = null;
        selId = id;
        render();
      }
      function startEdit(id, e) {
        if (e) e.stopPropagation();
        ctxId = null;
        editId = id;
        render();
      }
      function ek(e, id) {
        if (e.key === "Enter") ce(id);
        if (e.key === "Escape") {
          editId = null;
          render();
        }
      }
      function ce(id) {
        const ei = document.getElementById("ei-" + id);
        if (ei && ei.value.trim()) T = mapN(T, id, (n) => ({ ...n, label: ei.value.trim() }));
        editId = null;
        render();
      }
      function addKid(pid, e) {
        if (e) e.stopPropagation();
        const nid = uid();
        T = mapN(T, pid, (n) => ({
          ...n,
          collapsed: false,
          children: [
            ...n.children,
            { id: nid, label: "Nowy węzeł", collapsed: false, note: "", children: [] },
          ],
        }));
        editId = nid;
        selId = nid;
        render();
      }
      function toggleCtx(id, e) {
        if (e) e.stopPropagation();
        ctxId = ctxId === id ? null : id;
        render();
      }
      function doInsAbove(cid) {
        const nid = uid();
        T = insAbove(T, cid, {
          id: nid,
          label: "Nowa kategoria",
          collapsed: false,
          note: "",
          children: [],
        });
        ctxId = null;
        editId = nid;
        render();
      }
      function reqDel(id) {
        ctxId = null;
        showDelModal(id, find(T, id).children.length > 0);
      }
      function upNote(id, val) {
        T = mapN(T, id, (n) => ({ ...n, note: val }));
      }

      // ─── DRAG & DROP ──────────────────────────────────────────────────────────────
      function ds(e, id) {
        if (id === "root") {
          e.preventDefault();
          return;
        }
        dragId = id;
        e.dataTransfer.effectAllowed = "move";
        e.stopPropagation();
      }
      function dov(e, id) {
        e.preventDefault();
        e.stopPropagation();
        if (id !== dragId) {
          dropId = id;
          document.querySelectorAll(".drp").forEach((el) => el.classList.remove("drp"));
          document.querySelector('[data-id="' + id + '"]')?.classList.add("drp");
        }
      }
      function dp(e, tid) {
        e.preventDefault();
        e.stopPropagation();
        if (dragId && tid && dragId !== tid) T = moveUnder(T, dragId, tid);
        dragId = null;
        dropId = null;
        render();
      }
      function de() {
        dragId = null;
        dropId = null;
        render();
      }

      // ─── MODALE ───────────────────────────────────────────────────────────────────
      function showModal(html) {
        document.getElementById("mc").innerHTML =
          `<div class="mo" onclick="closeModal()"><div class="md" onclick="event.stopPropagation()">${html}</div></div>`;
      }
      function closeModal() {
        document.getElementById("mc").innerHTML = "";
      }

      function showDelModal(id, hasKids) {
        if (!hasKids) {
          showModal(`<div class="mt">Usuń węzeł</div><div class="mdsc">Czy na pewno chcesz usunąć ten węzeł?</div>
      <div class="mbs"><button class="mb" onclick="closeModal()">Anuluj</button><button class="mb dng" onclick="confDel('${id}',false)">Usuń</button></div>`);
          return;
        }
        showModal(`<div class="mt">Usuń węzeł</div><div class="mdsc">Ten węzeł ma elementy podrzędne.</div>
    <div class="mbs">
      <button class="mb" onclick="confDel('${id}',true)" style="flex:1;text-align:left">
        <strong style="display:block;font-weight:500">Usuń tylko ten węzeł</strong>
        <span class="sub">dzieci awansują poziom wyżej</span>
      </button>
      <button class="mb dng" onclick="confDel('${id}',false)" style="flex:1;text-align:left">
        <strong style="display:block;font-weight:500">Usuń całą gałąź</strong>
        <span class="sub">wszystkie dzieci usunięte</span>
      </button>
    </div>`);
      }
      function confDel(id, keep) {
        T = keep ? delKeep(T, id) : remN(T, id);
        if (selId === id) selId = null;
        closeModal();
        render();
      }

      // ─── AI MODAL ────────────────────────────────────────────────────────────────
      // W produkcji: zastąp setTimeout wywołaniem /api/mind-maps/ai-node
      let aiPid = null,
        aiRes = null;
      function openAI(pid, e) {
        if (e) e.stopPropagation();
        aiPid = pid;
        aiRes = null;
        showAIModal("", null, false);
      }
      function showAIModal(q, res, loading) {
        const resHtml = res
          ? `<div class="ares"><div class="arlbl">${esc(res.label)}</div><div class="ardsc">${esc(res.desc)}</div></div>
      <div class="mbs"><button class="mb ac" onclick="confAI()">Dodaj do mapy ✓</button><button class="mb" onclick="closeModal()">Anuluj</button></div>`
          : `<div style="font-size:12px;color:var(--color-text-secondary);text-align:center;padding:4px 0">Wpisz nazwę narzędzia i naciśnij Enter</div>`;
        showModal(`<div class="mt">✦ Dodaj przez AI</div>
    <div class="mdsc">AI wyszuka opis narzędzia i zaproponuje do zatwierdzenia</div>
    <div class="air">
      <input class="ain" id="ai-q" value="${esc(q)}" placeholder="np. LangChain, Crew AI, Pinecone..." onkeydown="if(event.key==='Enter')doAIS()" />
      <button class="mb ac" onclick="doAIS()" style="padding:7px 14px;white-space:nowrap" ${loading ? "disabled" : ""}>${loading ? `<i class="spin">↻</i>` : "Szukaj"}</button>
    </div>${resHtml}`);
        const ai = document.getElementById("ai-q");
        if (ai) {
          ai.focus();
          if (q)
            try {
              ai.setSelectionRange(0, q.length);
            } catch (e) {}
        }
      }
      async function doAIS() {
        const ai = document.getElementById("ai-q");
        if (!ai || !ai.value.trim()) return;
        const q = ai.value.trim();
        showAIModal(q, null, true);
        // PRODUKCJA: zastąp fetch('/api/mind-maps/ai-node', { method:'POST', body: JSON.stringify({query:q}) })
        await new Promise((r) => setTimeout(r, 1400));
        aiRes = {
          label: q,
          desc: `${q} to narzędzie automatyzacji w ekosystemie AI. Umożliwia budowanie pipeline'ów łączących modele językowe z zewnętrznymi systemami. Dostępne w wersji cloud i self-hosted.`,
        };
        showAIModal(q, aiRes, false);
      }
      function confAI() {
        if (!aiRes || !aiPid) return;
        const nid = uid();
        T = mapN(T, aiPid, (n) => ({
          ...n,
          collapsed: false,
          children: [
            ...n.children,
            { id: nid, label: aiRes.label, collapsed: false, note: aiRes.desc, children: [] },
          ],
        }));
        aiRes = null;
        aiPid = null;
        closeModal();
        selId = nid;
        render();
      }

      document.addEventListener("click", () => {
        if (ctxId) {
          ctxId = null;
          render();
        }
      });
      render();
    </script>
  </body>
</html>
```

---

## Notatki do adaptacji

- `textarea` w dolnym panelu → zamień na `<TipTapEditor>` (już masz w projekcie)
- `setTimeout` w `doAIS()` → zamień na `fetch('/api/mind-maps/ai-node', ...)`
- `let T = {...}` → `useState<MindMapNode>` zasilany z Firestore przez hook `useMindMaps`
- `colWidths` → część stanu hooka, persystowana w Firestore z debounce 1500ms razem z drzewem
- `uid()` → zamień na `nanoid()` (już masz w projekcie)
- Funkcje `find`, `mapN`, `mapAll`, `remN`, `delKeep`, `insAbove`, `moveUnder`, `leafCount` → wydziel do `lib/mindMapUtils.ts` jako czyste funkcje (łatwe do testowania zgodnie z ADR-015)
