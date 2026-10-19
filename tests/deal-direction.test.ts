import { describe, expect, it } from "vitest";
import { inferConfirmationDealDirection } from "../src/shared/utils/dealDirection";

describe("confirmation direction from fiscal documents", () => {
  it("treats inbound purchase XMLs as a purchase confirmation", () => {
    expect(inferConfirmationDealDirection(["INBOUND", "INBOUND"])).toBe("PURCHASE");
  });

  it("treats outbound sales XMLs as a sale confirmation", () => {
    expect(inferConfirmationDealDirection(["OUTBOUND", "OUTBOUND"])).toBe("SALE");
  });

  it("requires an explicit choice for mixed or unknown documents", () => {
    expect(inferConfirmationDealDirection(["INBOUND", "OUTBOUND"])).toBeNull();
    expect(inferConfirmationDealDirection(["UNKNOWN"])).toBeNull();
    expect(inferConfirmationDealDirection([])).toBeNull();
  });
});
