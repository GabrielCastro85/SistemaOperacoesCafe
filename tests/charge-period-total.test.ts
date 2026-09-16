import { expect, it } from "vitest";
import { adjustedChargeTotal, sumUnbilledPeriodNotes } from "../src/shared/utils/chargePeriodTotal";

it("sums Rafael's draft notes immediately with additions, discounts and advances", () => {
  const notes = [{ id: "rafael", operationType: "SALE" as const, status: "DRAFT" as const, billingStatus: "UNBILLED" as const, operationDate: "2026-09-04", serviceAmountCents: 4230918 }];
  const base = sumUnbilledPeriodNotes(notes, "2026-09-01", "2026-09-05");
  expect(base).toBe(4230918);
  expect(adjustedChargeTotal(base, 10000, 5000, 100000)).toBe(4135918);
});

it("includes pending and confirmed sales, excluding purchases, canceled, billed and out-of-period notes without duplication", () => {
  const sale = { id: "1", operationType: "SALE" as const, status: "CONFIRMED" as const, billingStatus: "UNBILLED" as const, operationDate: "2026-09-04", serviceAmountCents: 550000 };
  expect(sumUnbilledPeriodNotes([sale, sale, { ...sale, id: "2", status: "PENDING", serviceAmountCents: 255083 }, { ...sale, id: "3", status: "CANCELED" }, { ...sale, id: "4", operationType: "PURCHASE" }, { ...sale, id: "5", billingStatus: "BILLED" }, { ...sale, id: "6", operationDate: "2026-08-31" }], "2026-09-01", "2026-09-05")).toBe(805083);
  expect(adjustedChargeTotal(100, 0, 200, 0)).toBe(0);
});
