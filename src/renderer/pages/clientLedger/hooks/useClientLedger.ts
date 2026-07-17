import { useCallback, useEffect, useState } from "react";
import type { ClientLedgerEntry } from "../../../../shared/types/domain";

export function useClientLedger(organizationId: string, ownLegalEntityId: string, clientPartnerId: string): { entries: ClientLedgerEntry[]; reload: () => Promise<void> } {
  const [entries, setEntries] = useState<ClientLedgerEntry[]>([]);
  const reload = useCallback(async () => {
    if (!clientPartnerId) {
      setEntries([]);
      return;
    }
    setEntries(await window.operationsCafe.listLedgerEntries({ organizationId, ownLegalEntityId, clientPartnerId }));
  }, [organizationId, ownLegalEntityId, clientPartnerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { entries, reload };
}
