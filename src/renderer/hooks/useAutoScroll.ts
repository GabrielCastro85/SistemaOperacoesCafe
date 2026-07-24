import { useCallback, type RefObject } from "react";

type ScrollTarget = HTMLElement | null | RefObject<HTMLElement | null>;

export function useAutoScroll(): (target: ScrollTarget, delayMs?: number) => void {
  return useCallback((target: ScrollTarget, delayMs = 80) => {
    window.setTimeout(() => {
      const element = target && "current" in target ? target.current : target;
      element?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }, delayMs);
  }, []);
}
