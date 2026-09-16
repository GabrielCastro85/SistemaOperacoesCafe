import { expect, it } from "vitest";
import { chargePeriodLabel } from "../src/shared/utils/chargeLabel";

it("identifies a charge by its full period", () => {
  expect(chargePeriodLabel({ periodStart: "2026-09-01", periodEnd: "2026-09-30" })).toBe("01/09/2026 a 30/09/2026");
});

it("keeps both years in compact periods crossing the year boundary", () => {
  expect(chargePeriodLabel({ periodStart: "2026-12-15", periodEnd: "2027-01-15" }, true)).toBe("15/12/26 a 15/01/27");
});
