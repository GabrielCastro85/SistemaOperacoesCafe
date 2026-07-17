import { useCallback, useEffect, useState } from "react";
import type { ClientCharge } from "../../../../shared/types/domain";

export function useCharges(organizationId: string): { charges: ClientCharge[]; reload: () => Promise<void> } {
  const [charges, setCharges] = useState<ClientCharge[]>([]);
  const reload = useCallback(async () => {
    setCharges(await window.operationsCafe.listClientCharges({ organizationId, status: "all" }));
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { charges, reload };
}
