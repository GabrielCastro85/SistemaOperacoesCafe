import { useCallback, useEffect, useState } from "react";
import type { ServiceRateRule } from "../../../../shared/types/domain";

export function useServiceRateRules(organizationId: string): { rules: ServiceRateRule[]; reload: () => Promise<void> } {
  const [rules, setRules] = useState<ServiceRateRule[]>([]);
  const reload = useCallback(async () => {
    setRules(await window.operationsCafe.listServiceRateRules({ organizationId, status: "all" }));
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rules, reload };
}
