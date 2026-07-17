import { useMemo } from "react";
import type { FiscalDocumentDetail, Operation } from "../../../../shared/types/domain";

export function useOperations(detail: FiscalDocumentDetail | null): Operation[] {
  return useMemo(() => detail?.operations ?? [], [detail]);
}
