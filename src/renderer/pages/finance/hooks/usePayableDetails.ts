import { useCallback, useEffect, useState } from "react";
import type { AccountPayableDetail } from "../../../../shared/types/domain";

export function usePayableDetails(id: string | null): { detail: AccountPayableDetail | null; reload: () => Promise<void> } {
  const [detail, setDetail] = useState<AccountPayableDetail | null>(null);
  const reload = useCallback(async () => {
    if (!id) {
      setDetail(null);
      return;
    }
    setDetail(await window.operationsCafe.getAccountPayable(id));
  }, [id]);
  useEffect(() => { void reload(); }, [reload]);
  return { detail, reload };
}
