// src/features/home/ShellStatusBar.tsx
"use client";
import React, { useEffect, useState } from "react";
import "./home.css";
import type { CockpitDto } from "@/contexts/bc_cockpit/schemas";
import { StatusBar } from "./StatusBar";

interface ShellStatusBarProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** Zmiana wartości (np. aktywna karta) wczytuje dane paska od nowa. */
  refreshKey: string;
}

/** Pasek statusu dla kart innych niż Kokpit (Kokpit renderuje własny, z już wczytanymi danymi). */
export function ShellStatusBar({ apiFetch, refreshKey }: ShellStatusBarProps) {
  const [cockpit, setCockpit] = useState<CockpitDto | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/cockpit");
        if (!res.ok) return;
        const data = (await res.json()) as CockpitDto;
        if (!cancelled) setCockpit(data);
      } catch {
        // pasek jest informacyjny: przy błędzie zostają ostatnie znane dane
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, refreshKey]);

  return (
    <StatusBar
      projectId={cockpit?.topics[0]?.id ?? null}
      branch={cockpit?.git?.branch ?? null}
      warningsCount={cockpit?.warnings.length ?? 0}
      now={now}
    />
  );
}
