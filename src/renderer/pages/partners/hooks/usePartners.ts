import { useCallback, useEffect, useState } from "react";
import type { BusinessPartner } from "../../../../shared/types/domain";

export function usePartners(_organizationId: string, search: string): { partners: BusinessPartner[]; reload: () => Promise<void>; loading: boolean } {
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await window.operationsCafe.listBusinessPartners({ search, status: "all" });
      setPartners(rows);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { partners, reload, loading };
}
