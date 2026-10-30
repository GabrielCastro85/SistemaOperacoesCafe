import { useEffect } from "react";

export const CENTRAL_DATA_UPDATED_EVENT = "operations-cafe:central-data-updated";

/**
 * Recarrega os dados visiveis quando a sincronizacao central aplica uma nova
 * revisao no SQLite local. O componente permanece montado, portanto filtros,
 * abas e formularios em andamento nao sao descartados.
 */
export function useCentralDataRefresh(refresh: () => void | Promise<void>, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handleCentralDataUpdated = (): void => {
      void Promise.resolve(refresh()).catch((error: unknown) => {
        console.warn("Falha ao atualizar a tela apos sincronizacao central", error);
      });
    };
    window.addEventListener(CENTRAL_DATA_UPDATED_EVENT, handleCentralDataUpdated);
    return () => window.removeEventListener(CENTRAL_DATA_UPDATED_EVENT, handleCentralDataUpdated);
  }, [enabled, refresh]);
}
