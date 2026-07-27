import { useState, useEffect } from "react";

// Matches the app's existing @media(max-width:768px) breakpoint (see
// src/data/globalStyles.js) — desktop starts one pixel above it.
const DESKTOP_QUERY = "(min-width: 769px)";

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_QUERY).matches : true
  );

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handler = (e) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}
