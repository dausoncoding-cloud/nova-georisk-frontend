import { useCallback, useEffect, useRef, useState } from "react";

export type EdgeFade = "none" | "start" | "end" | "both";

/** For a horizontally scrollable row: which edge(s) have more content, to draw a fade there (data-fade). */
export function useEdgeFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [fade, setFade] = useState<EdgeFade>("none");
  const update = useCallback(() => {
    const row = ref.current;
    if (!row) return;
    const start = row.scrollLeft > 1;
    const end = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
    setFade(start && end ? "both" : start ? "start" : end ? "end" : "none");
  }, []);
  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  });
  return { ref, fade, onScroll: update };
}
