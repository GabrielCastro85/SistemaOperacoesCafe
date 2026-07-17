import { useMemo } from "react";
import type { FiscalDocumentDetail } from "../../../../shared/types/domain";

export function useOperationalPending(detail: FiscalDocumentDetail | null): string[] {
  return useMemo(() => (detail ? [] : []), [detail]);
}
