import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Lista suspensa larga (ex.: busca de cliente) aberta num campo perto da borda direita
 * passava da tela. Quando a lista nao cabe a partir da esquerda do campo, ela passa a
 * abrir alinhada pela direita do campo.
 */
export function useDropdownAlignEnd(open: boolean, wrapperRef: RefObject<HTMLElement>, panelRef: RefObject<HTMLElement>): boolean {
  const [alignEnd, setAlignEnd] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setAlignEnd(false);
      return;
    }
    function measure(): void {
      const wrapper = wrapperRef.current;
      const panel = panelRef.current;
      if (!wrapper || !panel) return;
      const wrapperBox = wrapper.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const fitsFromLeft = wrapperBox.left + panel.offsetWidth <= viewportWidth - 8;
      const fitsFromRight = wrapperBox.right - panel.offsetWidth >= 8;
      setAlignEnd(!fitsFromLeft && fitsFromRight);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, wrapperRef, panelRef]);

  return alignEnd;
}
