"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const OLD_KEYS = ["nexus-theme", "secondbrain-theme"];
const STORAGE_KEY = "monolith-theme";

export type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  // migrate from old key only when new key does not yet have a stored theme
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (!(existing === "dark" || existing === "light")) {
    for (const oldKey of OLD_KEYS) {
      const migrated = window.localStorage.getItem(oldKey);
      if (migrated === "dark" || migrated === "light") {
        window.localStorage.setItem(STORAGE_KEY, migrated);
        window.localStorage.removeItem(oldKey);
        break;
      }
    }
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(getInitialTheme());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
