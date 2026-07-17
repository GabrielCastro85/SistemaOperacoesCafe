import { useCallback, useEffect, useState } from "react";
import type { FiscalDocument } from "../../../../shared/types/domain";

export function useFiscalDocuments(organizationId: string): { documents: FiscalDocument[]; reload: () => Promise<void> } {
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const reload = useCallback(async () => {
    setDocuments(await window.operationsCafe.listFiscalDocuments({ organizationId, status: "all" }));
  }, [organizationId]);
  useEffect(() => { void reload(); }, [reload]);
  return { documents, reload };
}
