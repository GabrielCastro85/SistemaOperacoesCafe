import { useEffect } from "react";

export const CENTRAL_DATA_UPDATED_EVENT = "operations-cafe:central-data-updated";

/**
 * Recarrega os dados visiveis quando a sincronizacao central aplica uma nova
 * revisao no SQLite local. O componente permanece montado, portanto filtros,
 * abas e formularios em andamento nao sao descartados.
 *
 * Avisos que chegam enquanto a tela ainda esta recarregando nao disparam outra
 * carga em paralelo: viram uma unica nova carga no fim. No site cada carga
 * passa pela fila do servidor, e avisos seguidos empilhavam cargas pesadas.
 */
export function useCentralDataRefresh(refresh: () => void | Promise<void>, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let pending = false;
    let disposed = false;
    const run = (): void => {
      running = true;
      pending = false;
      void Promise.resolve(refresh())
        .catch((error: unknown) => {
          console.warn("Falha ao atualizar a tela apos sincronizacao central", error);
        })
        .finally(() => {
          running = false;
          if (pending && !disposed) run();
        });
    };
    const handleCentralDataUpdated = (): void => {
      if (running) { pending = true; return; }
      run();
    };
    window.addEventListener(CENTRAL_DATA_UPDATED_EVENT, handleCentralDataUpdated);
    return () => { disposed = true; window.removeEventListener(CENTRAL_DATA_UPDATED_EVENT, handleCentralDataUpdated); };
  }, [enabled, refresh]);
}
