import { useEffect, useState } from "react";

/** `true`, gdy okno ma co najmniej `px` szerokości; bez `matchMedia` (SSR, jsdom) `false`. */
export function useMinWidth(px: number): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(`(min-width: ${px}px)`);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [px]);
  return matches;
}
