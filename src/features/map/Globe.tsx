"use client";

import React, { useEffect, useMemo, useRef } from "react";
import type { MapEdgeDto, MapNodeDto } from "@/contexts/bc_map/schemas";
import {
  arcPoints,
  globeRadius,
  hitTest,
  isClick,
  layoutNodes,
  project,
  rotate,
  rotationTo,
  wrapAngle,
  type ProjectedNode,
  type Vec3,
} from "./globeMath";

/** Prędkość auto-obrotu: ok. 0,12 rad/s, pełny obrót w ~52 s. */
const AUTO_SPEED = 0.12;
const PITCH_LIMIT = 1.2;

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

function nodeRadius(n: MapNodeDto): number {
  if (n.kind === "project") return 7;
  if (n.soon) return 9;
  return 9 + Math.min(14, Math.sqrt(n.size ?? 0) * 0.8);
}

export type GlobeProps = {
  nodes: MapNodeDto[];
  edges: MapEdgeDto[];
  selectedId: string | null;
  /** Zmiana `tick` obraca globus do węzła `id`. */
  focus: { id: string; tick: number } | null;
  /** Zatrzymuje auto-obrót (np. fokus w liście węzłów). */
  paused?: boolean;
  onSelect: (id: string) => void;
  ariaLabel: string;
};

export function Globe({
  nodes,
  edges,
  selectedId,
  focus,
  paused = false,
  onSelect,
  ariaLabel,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positions = useMemo(
    () =>
      layoutNodes(
        nodes.map((n) => ({ id: n.id, kind: n.kind })),
        edges
      ),
    [nodes, edges]
  );
  const view = useRef({ yaw: 0.4, pitch: -0.25 });
  const target = useRef<{ yaw: number; pitch: number } | null>(null);
  const hover = useRef(false);
  const drag = useRef<{ sx: number; sy: number; lx: number; ly: number } | null>(null);
  const projected = useRef<ProjectedNode[]>([]);
  const pausedRef = useRef(paused);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const reduced = useRef(false);
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    pausedRef.current = paused;
    selectedRef.current = selectedId;
    onSelectRef.current = onSelect;
    drawRef.current();
  }, [paused, selectedId, onSelect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const pal = readPalette(canvas);

    const draw = () => {
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
      const selected = selectedRef.current;

      ctx.beginPath();
      ctx.arc(w / 2, h / 2, globeRadius(w, h), 0, Math.PI * 2);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = pal.surface;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1;
      ctx.stroke();

      for (const e of edges) {
        const a = positions[e.from];
        const b = positions[e.to];
        if (!a || !b) continue;
        const pts = arcPoints(a, b, 28).map((p) => project(rotate(p, yaw, pitch), w, h));
        const hot = selected !== null && (e.from === selected || e.to === selected);
        ctx.strokeStyle = hot ? pal.accent : pal.muted;
        ctx.lineWidth = (hot ? 2 : 1) + Math.min(e.weight, 4) * 0.35;
        for (let i = 1; i < pts.length; i += 1) {
          const front = (pts[i - 1].z + pts[i].z) / 2 >= 0;
          ctx.globalAlpha = (hot ? 0.95 : 0.55) * (front ? 1 : 0.25);
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      const items = nodes
        .flatMap((n) => {
          const p: Vec3 | undefined = positions[n.id];
          if (!p) return [];
          const pr = project(rotate(p, yaw, pitch), w, h);
          return [{ n, pr, r: nodeRadius(n) * pr.scale }];
        })
        .sort((a, b) => a.pr.z - b.pr.z);
      projected.current = items.map((i) => ({
        id: i.n.id,
        x: i.pr.x,
        y: i.pr.y,
        z: i.pr.z,
        r: i.r,
      }));

      for (const { n, pr, r } of items) {
        const front = pr.z >= 0;
        const color = n.kind === "continent" ? pal.ok : pal.accent;
        ctx.globalAlpha = front ? 1 : 0.3;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
        if (n.soon) {
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }
        if (n.id === selected) {
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = pal.text;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        if (pr.z > -0.2) {
          ctx.fillStyle = pal.text;
          ctx.font = `${Math.round(11 * pr.scale)}px ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.fillText(n.soon ? `${n.label} (wkrótce)` : n.label, pr.x, pr.y + r + 13);
        }
      }
      ctx.globalAlpha = 1;
    };
    drawRef.current = draw;

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
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
      draw();
      raf = requestAnimationFrame(loop);
    };
    if (!reduced.current) raf = requestAnimationFrame(loop);
    draw();

    const local = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture?.(e.pointerId);
      drag.current = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY };
      target.current = null;
    };
    const onMove = (e: PointerEvent) => {
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
      canvas.style.cursor = hitTest(projected.current, x, y) ? "pointer" : "grab";
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (d && isClick(e.clientX - d.sx, e.clientY - d.sy)) {
        const { x, y } = local(e);
        const id = hitTest(projected.current, x, y);
        if (id) onSelectRef.current(id);
      }
    };
    const onCancel = () => {
      drag.current = null;
    };
    const onEnter = () => {
      hover.current = true;
    };
    const onLeave = () => {
      hover.current = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerenter", onEnter);
    canvas.addEventListener("pointerleave", onLeave);

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
      drawRef.current = () => {};
    };
  }, [nodes, edges, positions]);

  useEffect(() => {
    if (!focus) return;
    const p = positions[focus.id];
    if (!p) return;
    const goal = rotationTo(p);
    if (reduced.current) {
      view.current = { ...goal };
      drawRef.current();
    } else {
      target.current = goal;
    }
  }, [focus, positions]);

  return <canvas ref={canvasRef} className="map-canvas__el" role="img" aria-label={ariaLabel} />;
}
