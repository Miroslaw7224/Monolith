"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MapClusterDto,
  MapClusterEdgeDto,
  MapEdgeDto,
  MapNodeDto,
} from "@/contexts/bc_map/schemas";
import { EDGE_CLASSES, buildEdgeMaps, groupEdges, type EdgeMaps } from "./edgeColors";
import { GlobeControls } from "./GlobeControls";
import {
  POINT_LABEL_ZOOM,
  capOutline,
  clampZoom,
  fitRadius,
  hitTest,
  isClick,
  layoutClusters,
  layoutPoints,
  project,
  rotate,
  rotationTo,
  stepZoom,
  wrapAngle,
  type ClusterPlacement,
  type Projected,
  type ProjectedNode,
  type Vec3,
} from "./globeMath";
import { selectionHighlight, type MapSelection, type SelectionHighlight } from "./selection";
import { axonPulse, coreAlphas, dustPosition, makeDust, withAlpha } from "./core";
import { approach, breathScale, idPhase, slowPulse } from "./motion";
import { elevate, liftedArc, nodeHeight } from "./relief";
import { pointAlong, retargetSparks, stepSparks, type Spark } from "./sparks";

/** Liczba iskier płynących po łukach: w spoczynku i po zaznaczeniu (wtedy tylko po podświetlonych). */
const SPARKS_IDLE = 70;
const SPARKS_SELECTED = 36;
/** Długość ogona iskry (ułamek łuku) i liczba segmentów ogona. */
const SPARK_TAIL = 0.14;
const SPARK_TAIL_SEGMENTS = 4;

type SparkEdge = { edge: MapEdgeDto; color: string };

/** Liczba ziaren pyłu dryfującego we wnętrzu kuli. */
const DUST_COUNT = 60;
/** Węzły wyższe niż to dostają „łodygę” do powierzchni kuli. */
const STEM_MIN_HEIGHT = 0.025;
const edgePhases = new WeakMap<MapEdgeDto, number>();
/** Stała faza falowania krawędzi (z jej końców), liczona raz. */
function edgePhase(e: MapEdgeDto): number {
  let p = edgePhases.get(e);
  if (p === undefined) {
    p = idPhase(`${e.from}>${e.to}`);
    edgePhases.set(e, p);
  }
  return p;
}

/** Tempo (1/s) miękkiego włączania i wygaszania podświetlenia; ok. 0,25 s na przejście. */
const HL_RATE = 10;
/** Warstwa podświetlenia: zaznaczenie z postępem 0..1 (przejście między zaznaczeniami to płynna zamiana warstw). */
type HlLayer = { hl: SelectionHighlight; amt: number; lit: ReturnType<typeof groupEdges> };

/** Prędkość auto-obrotu: ok. 0,12 rad/s, pełny obrót w ~52 s. */
const AUTO_SPEED = 0.12;
const PITCH_LIMIT = 1.2;
const BUTTON_ZOOM_STEP = 1.25;
const WHEEL_ZOOM_STEP = 1.1;
const MAX_POINT_LABELS = 150;

type Palette = {
  accent: string;
  ok: string;
  text: string;
  muted: string;
  line: string;
  surface: string;
};
const FALLBACK: Palette = {
  accent: "#3d95ff",
  ok: "#4ade9b",
  text: "#f0f0f2",
  muted: "#a8aab2",
  line: "#373a42",
  surface: "#1e1f24",
};

function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const pick = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    accent: pick("--accent", FALLBACK.accent),
    ok: pick("--ok", FALLBACK.ok),
    text: pick("--text", FALLBACK.text),
    muted: pick("--muted", FALLBACK.muted),
    line: pick("--line", FALLBACK.line),
    surface: pick("--surface", FALLBACK.surface),
  };
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

type Geometry = {
  placement: Record<string, ClusterPlacement>;
  notePos: Record<string, Vec3>;
  outlines: Record<string, Vec3[]>;
};

function buildGeometry(
  clusters: MapClusterDto[],
  nodes: MapNodeDto[],
  clusterEdges: MapClusterEdgeDto[]
): Geometry {
  const placement = layoutClusters(
    clusters.map(({ id, group, size, soon }) => ({ id, group, size, soon })),
    clusterEdges
  );
  const byCluster = new Map<string, MapNodeDto[]>();
  for (const n of nodes) byCluster.set(n.cluster, [...(byCluster.get(n.cluster) ?? []), n]);
  const notePos: Record<string, Vec3> = {};
  const outlines: Record<string, Vec3[]> = {};
  for (const c of clusters) {
    const pl = placement[c.id];
    if (!pl) continue;
    outlines[c.id] = capOutline(pl.center, pl.radius, 40);
    const list = (byCluster.get(c.id) ?? []).sort((a, b) => b.links - a.links || cmp(a.id, b.id));
    layoutPoints(pl.center, pl.radius, list.length).forEach((p, i) => {
      notePos[list[i].id] = p;
    });
  }
  return { placement, notePos, outlines };
}

export type GlobeProps = {
  clusters: MapClusterDto[];
  nodes: MapNodeDto[];
  edges: MapEdgeDto[];
  clusterEdges: MapClusterEdgeDto[];
  selection: MapSelection | null;
  /** Zmiana `tick` obraca globus do skupiska lub notatki `id`. */
  focus: { id: string; tick: number } | null;
  /** Zatrzymuje auto-obrót (np. fokus w liście skupisk). */
  paused?: boolean;
  onSelect: (s: MapSelection) => void;
  ariaLabel: string;
};

export function Globe({
  clusters,
  nodes,
  edges,
  clusterEdges,
  selection,
  focus,
  paused = false,
  onSelect,
  ariaLabel,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geo = useMemo(
    () => buildGeometry(clusters, nodes, clusterEdges),
    [clusters, nodes, clusterEdges]
  );
  const highlight = useMemo(
    () => selectionHighlight(selection, nodes, edges),
    [selection, nodes, edges]
  );

  const view = useRef({ yaw: 0.4, pitch: -0.25 });
  const target = useRef<{ yaw: number; pitch: number } | null>(null);
  const zoomRef = useRef(1);
  const zoomTarget = useRef(1);
  const [zoomLabel, setZoomLabel] = useState(1);
  const hover = useRef(false);
  const drag = useRef<{ sx: number; sy: number; lx: number; ly: number } | null>(null);
  const projectedNotes = useRef<ProjectedNode[]>([]);
  const projectedClusters = useRef<ProjectedNode[]>([]);
  const reduced = useRef(false);
  const drawRef = useRef<() => void>(() => {});
  const pausedRef = useRef(paused);
  const onSelectRef = useRef(onSelect);
  const edgeMaps = useMemo(() => buildEdgeMaps(nodes, clusters), [nodes, clusters]);
  const baseByClass = useMemo(() => groupEdges(edges, edgeMaps), [edges, edgeMaps]);
  const heights = useMemo(() => {
    const max = nodes.reduce((m, n) => Math.max(m, n.links), 0);
    return new Map(nodes.map((n) => [n.id, nodeHeight(n.links, max)]));
  }, [nodes]);
  const dataRef = useRef({
    geo,
    highlight,
    clusters,
    nodes,
    edges,
    edgeMaps,
    baseByClass,
    heights,
  });

  /** Zmiana zoomu (przyciski, kółko, klawisze, szczypanie); przy „ogranicz ruch” bez wygładzania. */
  const applyZoom = useCallback((next: number, immediate = false) => {
    const z = clampZoom(next);
    zoomTarget.current = z;
    setZoomLabel(z);
    if (immediate || reduced.current) {
      zoomRef.current = z;
      drawRef.current();
    }
  }, []);

  useEffect(() => {
    dataRef.current = { geo, highlight, clusters, nodes, edges, edgeMaps, baseByClass, heights };
    pausedRef.current = paused;
    onSelectRef.current = onSelect;
    drawRef.current();
  }, [geo, highlight, clusters, nodes, edges, edgeMaps, baseByClass, heights, paused, onSelect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const pal = readPalette(canvas);
    const groupColor = (g: MapClusterDto["group"]): string =>
      g === "knowledge" ? pal.ok : g === "skills" ? pal.muted : pal.accent;

    /** Najechanie (hover) ma pierwszeństwo przed zaznaczeniem; `null` = brak najechania. */
    let hoverHl: SelectionHighlight | null = null;
    let hoverKey = "";

    const dust = makeDust(DUST_COUNT);

    // Miękkie podświetlenie: każde zaznaczenie/najechanie to warstwa, która płynnie rośnie lub gaśnie.
    const layers: HlLayer[] = [];
    let lastHlTime = performance.now();
    const advanceLayers = (now: number, want: SelectionHighlight | null, maps: EdgeMaps) => {
      const dt = reduced.current ? 1 : Math.min(0.1, Math.max(0, (now - lastHlTime) / 1000));
      lastHlTime = now;
      if (want && !layers.some((l) => l.hl === want)) {
        layers.push({ hl: want, amt: 0, lit: groupEdges(want.edges, maps) });
      }
      for (const l of layers) l.amt = approach(l.amt, l.hl === want ? 1 : 0, dt, HL_RATE);
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        if (layers[i].hl !== want && layers[i].amt <= 0) layers.splice(i, 1);
      }
    };

    // Iskry: pula krawędzi zależy od tego, czy coś jest zaznaczone (wtedy lecą tylko po podświetlonych).
    const sparks: Spark<SparkEdge>[] = [];
    let sparkPool: SparkEdge[] = [];
    let sparkPoolSrc: unknown = null;
    const refreshSparkPool = () => {
      const { highlight: sel, baseByClass: byClass, edgeMaps: maps } = dataRef.current;
      const hl = hoverHl ?? sel;
      const src = hl.clusterId !== null ? hl.edges : byClass;
      if (src === sparkPoolSrc) return;
      sparkPoolSrc = src;
      const grouped = hl.clusterId !== null ? groupEdges(hl.edges, maps) : byClass;
      sparkPool = EDGE_CLASSES.flatMap((c) =>
        (grouped.get(c.id) ?? []).map((edge) => ({ edge, color: c.color }))
      );
      retargetSparks(sparks, sparkPool, Math.random);
    };

    const draw = () => {
      const {
        geo: g,
        highlight: sel,
        clusters: cls,
        nodes: nds,
        edgeMaps: maps,
        baseByClass: byClass,
        heights: hts,
      } = dataRef.current;
      const hl = hoverHl ?? sel;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const { yaw, pitch } = view.current;
      const zoom = zoomRef.current;
      const R = fitRadius(w, h) * zoom;
      const pj = (p: Vec3) => project(rotate(p, yaw, pitch), w, h, zoom);
      const now = performance.now();
      advanceLayers(now, hl.clusterId !== null ? hl : null, maps);
      const selectAmt = Math.min(
        1,
        layers.reduce((sum, l) => sum + l.amt, 0)
      );
      const live = !reduced.current;

      // 1. Dysk kuli (z delikatnym pulsem tła i krawędzi).
      const pulse = live ? slowPulse(now) : 0.5;
      const alphas = coreAlphas(pulse);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R, 0, Math.PI * 2);
      const body = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, R);
      body.addColorStop(0, withAlpha(pal.surface, alphas.edge * 0.5, FALLBACK.surface));
      body.addColorStop(1, withAlpha(pal.surface, alphas.edge, FALLBACK.surface));
      ctx.fillStyle = body;
      ctx.fill();
      // Świecące jądro w środku (gaśnie ku brzegowi).
      const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, R * 0.6);
      glow.addColorStop(0, withAlpha(pal.accent, alphas.core, FALLBACK.accent));
      glow.addColorStop(1, withAlpha(pal.accent, 0, FALLBACK.accent));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R, 0, Math.PI * 2);
      ctx.globalAlpha = 0.75 + 0.25 * pulse;
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 1b. Aksony: cienkie włókna od jądra do skupisk, z sygnałem biegnącym ku skupisku.
      const core = pj({ x: 0, y: 0, z: 0 });
      ctx.lineWidth = 1;
      for (const c of cls) {
        const pl = g.placement[c.id];
        if (!pl || c.soon) continue;
        const tip = pj(pl.center);
        let lit = 0;
        for (const l of layers) if (l.hl.clusterId === c.id) lit = Math.max(lit, l.amt);
        const base = (0.1 + 0.3 * lit) * (1 - 0.5 * selectAmt * (1 - lit));
        const side = tip.z >= 0 ? 1 : 0.45;
        ctx.strokeStyle = groupColor(c.group);
        ctx.fillStyle = groupColor(c.group);
        ctx.globalAlpha = base * side;
        ctx.beginPath();
        ctx.moveTo(core.x, core.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        if (live) {
          const t = axonPulse(now, c.id);
          const q = pj({ x: pl.center.x * t, y: pl.center.y * t, z: pl.center.z * t });
          ctx.globalAlpha = Math.sin(Math.PI * t) * (0.35 + 0.5 * lit) * side;
          ctx.beginPath();
          ctx.arc(q.x, q.y, 1.8 * q.scale * Math.sqrt(zoom), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 1c. Pył dryfujący we wnętrzu kuli.
      if (live) {
        ctx.fillStyle = pal.text;
        for (const d of dust) {
          const q = pj(dustPosition(d, now));
          ctx.globalAlpha = (q.z >= 0 ? 0.5 : 0.2) * (1 - 0.55 * selectAmt);
          ctx.beginPath();
          ctx.arc(q.x, q.y, 1.1 * q.scale * Math.sqrt(zoom), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // 2. Pola skupisk nie są rysowane; tylko przerywany obrys placeholdera (Skille).
      for (const c of cls) {
        const outline = g.outlines[c.id];
        const pl = g.placement[c.id];
        if (!c.soon || !outline || !pl) continue;
        ctx.beginPath();
        outline.map(pj).forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
        ctx.closePath();
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = pj(pl.center).z >= 0 ? 0.7 : 0.2;
        ctx.strokeStyle = pal.muted;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;

      // 3. Wszystkie połączenia naraz (przygaszone), potem jaśniejsze dla najechania lub zaznaczenia.
      // Łuk wznosi się nad kulą i łączy wzniesione węzły (szczyty); falowanie biegnie po nim w czasie.
      const arcFor = (e: MapEdgeDto): Vec3[] | null => {
        const from = g.notePos[e.from];
        const to = e.type === "link" ? g.notePos[e.to] : g.placement[e.to]?.center;
        if (!from || !to) return null;
        const hTo = e.type === "link" ? (hts.get(e.to) ?? 0) : 0;
        const ripple = live ? now * 0.0018 + edgePhase(e) : null;
        return liftedArc(from, to, hts.get(e.from) ?? 0, hTo, 8, ripple);
      };
      const strokeArcs = (
        list: MapEdgeDto[],
        color: string,
        width: number,
        frontAlpha: number,
        backAlpha: number
      ) => {
        const front: Projected[][] = [];
        const back: Projected[][] = [];
        for (const e of list) {
          const raw = arcFor(e);
          if (!raw) continue;
          const pts = raw.map(pj);
          (pts[Math.floor(pts.length / 2)].z >= 0 ? front : back).push(pts);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        for (const [group, alpha] of [
          [back, backAlpha],
          [front, frontAlpha],
        ] as const) {
          if (group.length === 0) continue;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          for (const pts of group) {
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
      };
      // Kolor wg klasy połączenia; podświetlone mają ten sam kolor, ale pełniejszy i grubszy.
      for (const cls of EDGE_CLASSES) {
        const list = byClass.get(cls.id);
        if (list) {
          strokeArcs(list, cls.color, 1, 0.38 - 0.28 * selectAmt, 0.1 - 0.07 * selectAmt);
        }
      }
      for (const layer of layers) {
        for (const cls of EDGE_CLASSES) {
          const list = layer.lit.get(cls.id);
          if (list) strokeArcs(list, cls.color, 1.8, 0.95 * layer.amt, 0.3 * layer.amt);
        }
      }
      ctx.globalAlpha = 1;

      // 4. Iskry płynące po łukach (jak sygnały między neuronami); przy ograniczeniu ruchu ich nie ma.
      if (!reduced.current) {
        const sparkScale = Math.sqrt(zoom);
        ctx.lineCap = "round";
        for (const s of sparks) {
          const raw = arcFor(s.edge.edge);
          if (!raw) continue;
          const fade = Math.sin(Math.PI * s.t);
          const head = pj(pointAlong(raw, s.t));
          const side = head.z >= 0 ? 1 : 0.3;
          ctx.strokeStyle = s.edge.color;
          ctx.fillStyle = s.edge.color;
          let prev = head;
          for (let k = 1; k <= SPARK_TAIL_SEGMENTS; k += 1) {
            const tk = s.t - (SPARK_TAIL * k) / SPARK_TAIL_SEGMENTS;
            if (tk < 0) break;
            const q = pj(pointAlong(raw, tk));
            ctx.globalAlpha = fade * side * 0.7 * (1 - (k - 1) / SPARK_TAIL_SEGMENTS);
            ctx.lineWidth = 2 * head.scale * sparkScale * (1 - (k - 1) / (SPARK_TAIL_SEGMENTS + 1));
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
            prev = q;
          }
          const r = 2 * head.scale * sparkScale;
          ctx.globalAlpha = fade * side * 0.25;
          ctx.beginPath();
          ctx.arc(head.x, head.y, r * 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = fade * side;
          ctx.beginPath();
          ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.lineCap = "butt";
        ctx.globalAlpha = 1;
      }

      // 5. Punkty-notatki (od tyłu do przodu).
      const cluster = new Map(cls.map((c) => [c.id, c]));
      const items = nds
        .flatMap((n) => {
          const p = g.notePos[n.id];
          const h = hts.get(n.id) ?? 0;
          return p ? [{ n, pr: pj(elevate(p, h)), base: p, h }] : [];
        })
        .sort((a, b) => a.pr.z - b.pr.z);
      const pointScale = Math.sqrt(zoom);
      // Szczyty: cienka „łodyga” od powierzchni kuli do wzniesionego węzła.
      ctx.beginPath();
      for (const { pr, base, h } of items) {
        if (h < STEM_MIN_HEIGHT || pr.z < 0) continue;
        const foot = pj(base);
        ctx.moveTo(foot.x, foot.y);
        ctx.lineTo(pr.x, pr.y);
      }
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      projectedNotes.current = items.map(({ n, pr }) => ({
        id: n.id,
        x: pr.x,
        y: pr.y,
        z: pr.z,
        r: 3.5 * pr.scale * pointScale,
      }));
      for (const { n, pr } of items) {
        const isActive = hl.noteId === n.id;
        const isSel = sel.noteId === n.id;
        let dimMul = 1;
        for (const l of layers) {
          if (n.cluster !== l.hl.clusterId && !l.hl.lit.has(n.id)) dimMul *= 1 - 0.5 * l.amt;
        }
        const breath = live ? breathScale(now, n.id) : 1;
        const r = (isActive || isSel ? 4.5 : 2.2) * pr.scale * pointScale * breath;
        ctx.globalAlpha = (pr.z >= 0 ? 1 : 0.25) * dimMul;
        ctx.fillStyle = groupColor(cluster.get(n.cluster)?.group ?? "knowledge");
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (isSel) {
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, r + 3, 0, Math.PI * 2);
          ctx.strokeStyle = pal.text;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // 6. Podpisy skupisk i dane do hit-testu skupisk.
      const clusterHits: ProjectedNode[] = [];
      ctx.fillStyle = pal.text;
      ctx.textAlign = "center";
      for (const c of cls) {
        const pl = g.placement[c.id];
        if (!pl) continue;
        const pr = pj(pl.center);
        clusterHits.push({
          id: c.id,
          x: pr.x,
          y: pr.y,
          z: pr.z,
          r: Math.max(10, Math.sin(pl.radius) * R * pr.scale),
        });
        if (pr.z > -0.2) {
          ctx.globalAlpha = pr.z >= 0 ? 1 : 0.4;
          ctx.font = `${Math.round(11 * pr.scale)}px ui-monospace, monospace`;
          ctx.fillText(c.soon ? `${c.label} (wkrótce)` : c.label, pr.x, pr.y + 4);
        }
      }
      projectedClusters.current = clusterHits;
      ctx.globalAlpha = 1;

      // 7. Podpisy punktów (tylko przy dużym zoomie, bez nakładania).
      if (zoom >= POINT_LABEL_ZOOM) {
        const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
        let drawn = 0;
        ctx.font = `${Math.round(10 * pointScale)}px ui-monospace, monospace`;
        for (let i = items.length - 1; i >= 0 && drawn < MAX_POINT_LABELS; i -= 1) {
          const { n, pr } = items[i];
          if (pr.z <= 0.1) continue;
          const width = ctx.measureText(n.label).width;
          const y = pr.y - 6 * pointScale;
          const box = { x0: pr.x - width / 2, y0: y - 11, x1: pr.x + width / 2, y1: y + 3 };
          if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) {
            continue;
          }
          boxes.push(box);
          ctx.fillText(n.label, pr.x, y);
          drawn += 1;
        }
      }
    };
    drawRef.current = draw;

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const zt = zoomTarget.current;
      zoomRef.current =
        Math.abs(zt - zoomRef.current) > 0.001
          ? zoomRef.current + (zt - zoomRef.current) * 0.25
          : zt;
      const t = target.current;
      if (t) {
        const dy = wrapAngle(t.yaw - view.current.yaw);
        const dp = t.pitch - view.current.pitch;
        view.current.yaw += dy * 0.14;
        view.current.pitch += dp * 0.14;
        if (Math.abs(dy) < 0.002 && Math.abs(dp) < 0.002) target.current = null;
      } else if (!hover.current && !pausedRef.current && !drag.current) {
        view.current.yaw += dt * AUTO_SPEED;
      }
      refreshSparkPool();
      const selecting = (hoverHl ?? dataRef.current.highlight).clusterId !== null;
      stepSparks(
        sparks,
        dt,
        sparkPool,
        selecting ? SPARKS_SELECTED : SPARKS_IDLE,
        selecting ? 1.6 : 1,
        Math.random
      );
      draw();
      raf = requestAnimationFrame(loop);
    };
    if (!reduced.current) raf = requestAnimationFrame(loop);
    draw();

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    let pinched = false;
    const pinchDistance = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const local = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const setHover = (next: MapSelection | null) => {
      const key = next ? `${next.kind}:${next.id}` : "";
      if (key === hoverKey) return;
      hoverKey = key;
      const { nodes: nds, edges: es } = dataRef.current;
      hoverHl = next ? selectionHighlight(next, nds, es) : null;
      draw();
    };
    const pick = (x: number, y: number): MapSelection | null => {
      const note = hitTest(projectedNotes.current, x, y);
      if (note) return { kind: "note", id: note };
      const cl = hitTest(projectedClusters.current, x, y);
      return cl ? { kind: "cluster", id: cl } : null;
    };
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      target.current = null;
      if (pointers.size === 1) {
        drag.current = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY };
      } else if (pointers.size === 2) {
        drag.current = null;
        pinched = true;
        pinchDist = pinchDistance();
      }
    };
    const onMove = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        const d = pinchDistance();
        if (pinchDist > 0 && d > 0) applyZoom(stepZoom(zoomRef.current, d / pinchDist), true);
        pinchDist = d;
        return;
      }
      const d = drag.current;
      if (d) {
        view.current.yaw += (e.clientX - d.lx) * 0.008;
        view.current.pitch = Math.max(
          -PITCH_LIMIT,
          Math.min(PITCH_LIMIT, view.current.pitch + (e.clientY - d.ly) * 0.008)
        );
        d.lx = e.clientX;
        d.ly = e.clientY;
        draw();
        return;
      }
      const { x, y } = local(e);
      const over = pick(x, y);
      canvas.style.cursor = over ? "pointer" : "grab";
      setHover(over);
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      pointers.delete(e.pointerId);
      if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      const wasPinch = pinched;
      if (pointers.size === 0) pinched = false;
      if (!wasPinch && d && isClick(e.clientX - d.sx, e.clientY - d.sy)) {
        const { x, y } = local(e);
        const sel = pick(x, y);
        if (sel) onSelectRef.current(sel);
      }
    };
    const onCancel = (e: PointerEvent) => {
      drag.current = null;
      pointers.delete(e.pointerId);
      if (pointers.size === 0) pinched = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoom(stepZoom(zoomTarget.current, e.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP));
    };
    const onEnter = () => {
      hover.current = true;
    };
    const onLeave = () => {
      hover.current = false;
      setHover(null);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerenter", onEnter);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => draw());
    resize?.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      resize?.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      drawRef.current = () => {};
    };
  }, [applyZoom]);

  useEffect(() => {
    if (!focus) return;
    const p = geo.notePos[focus.id] ?? geo.placement[focus.id]?.center;
    if (!p) return;
    const goal = rotationTo(p);
    if (reduced.current) {
      view.current = { ...goal };
      drawRef.current();
    } else {
      target.current = goal;
    }
    // Tylko zmiana `tick` obraca globus; geometria nie zmienia się po załadowaniu grafu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      applyZoom(stepZoom(zoomTarget.current, BUTTON_ZOOM_STEP));
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      applyZoom(stepZoom(zoomTarget.current, 1 / BUTTON_ZOOM_STEP));
    } else if (e.key === "0") {
      e.preventDefault();
      applyZoom(1);
    }
  };

  return (
    <div
      className="map-globe"
      role="application"
      tabIndex={0}
      aria-label="Globus sieci NEXUS. Klawisze: plus i minus zmieniają powiększenie, zero dopasowuje do okna."
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} className="map-canvas__el" role="img" aria-label={ariaLabel} />
      <GlobeControls
        zoom={zoomLabel}
        onZoomIn={() => applyZoom(stepZoom(zoomTarget.current, BUTTON_ZOOM_STEP))}
        onZoomOut={() => applyZoom(stepZoom(zoomTarget.current, 1 / BUTTON_ZOOM_STEP))}
        onFit={() => applyZoom(1)}
      />
    </div>
  );
}
