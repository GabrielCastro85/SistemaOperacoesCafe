import type { Operation } from "../types/domain.js";

type PeriodOperation = Pick<Operation, "id" | "operationType" | "status" | "billingStatus" | "operationDate" | "serviceAmountCents">;

export function sumUnbilledPeriodNotes(operations: PeriodOperation[], start: string, end: string): number {
  const seen = new Set<string>();
  return operations.reduce((total, operation) => {
    const date = operation.operationDate.slice(0, 10);
    if (seen.has(operation.id) || operation.operationType !== "SALE" || operation.status === "CANCELED"
      || operation.billingStatus !== "UNBILLED" || date < start || date > end) return total;
    seen.add(operation.id);
    return total + operation.serviceAmountCents;
  }, 0);
}

export function adjustedChargeTotal(base: number, surcharge: number, discount: number, advance: number): number {
  return Math.max(0, base + surcharge - discount - advance);
}
