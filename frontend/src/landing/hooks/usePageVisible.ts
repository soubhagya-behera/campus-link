import { useEffect, useState } from "react";

/**
 * True while the document is visible. Landing markup flips a data attribute on
 * the root so CSS can pause the ambient loops (drift, pulse, halo) when the
 * tab is in the background instead of burning frames on nothing.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}
