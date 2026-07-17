import { useCallback, useEffect, useState } from "react";
import type { BootstrapData, Diagnostics, LegalEntity, Location, OrganizationListItem } from "../../../../shared/types/domain";
import type { StatusFilter } from "../types";

export function useOrganizations(search = "", status: StatusFilter = "all"): { items: OrganizationListItem[]; reload: () => Promise<void> } {
  const [items, setItems] = useState<OrganizationListItem[]>([]);
  const reload = useCallback(async () => setItems(await window.operationsCafe.listOrganizations({ search, status })), [search, status]);
  useEffect(() => { void reload(); }, [reload]);
  return { items, reload };
}

export function useLegalEntities(refresh: () => Promise<BootstrapData>, search = "", status: StatusFilter = "all"): { bootstrap: BootstrapData | null; items: LegalEntity[]; reload: () => Promise<void> } {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [items, setItems] = useState<LegalEntity[]>([]);
  const reload = useCallback(async () => {
    setBootstrap(await refresh());
    setItems(await window.operationsCafe.listLegalEntities({ search, status }));
  }, [refresh, search, status]);
  useEffect(() => { void reload(); }, [reload]);
  return { bootstrap, items, reload };
}

export function useLocations(refresh: () => Promise<BootstrapData>, search = "", status: StatusFilter = "all"): { bootstrap: BootstrapData | null; items: Location[]; reload: () => Promise<void> } {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [items, setItems] = useState<Location[]>([]);
  const reload = useCallback(async () => {
    setBootstrap(await refresh());
    setItems(await window.operationsCafe.listLocations({ search, status }));
  }, [refresh, search, status]);
  useEffect(() => { void reload(); }, [reload]);
  return { bootstrap, items, reload };
}

export function useDiagnostics(): Diagnostics | null {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  useEffect(() => { void window.operationsCafe.getDiagnostics().then(setDiagnostics).catch(() => setDiagnostics(null)); }, []);
  return diagnostics;
}
