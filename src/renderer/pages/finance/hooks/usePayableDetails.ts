import { useCallback, useEffect, useState } from "react";
import type { AccountPayableDetail, AccountPayableOperation } from "../../../../shared/types/domain";

export function usePayableDetails(id: string | null): { detail: AccountPayableDetail | null; purchaseOperations: AccountPayableOperation[]; reload: () => Promise<void> } {
  const [detail, setDetail] = useState<AccountPayableDetail | null>(null);
  const [purchaseOperations, setPurchaseOperations] = useState<AccountPayableOperation[]>([]);
  const reload = useCallback(async () => {
    if (!id) {
      setDetail(null);
      setPurchaseOperations([]);
      return;
    }
    const loadedDetail = await window.operationsCafe.getAccountPayable(id);
    setDetail(loadedDetail);
    setPurchaseOperations(loadedDetail.payable.source === "IMPORT" ? await window.operationsCafe.listAccountPayableOperations(id) : []);
  }, [id]);
  useEffect(() => { void reload(); }, [reload]);
  return { detail, purchaseOperations, reload };
}
