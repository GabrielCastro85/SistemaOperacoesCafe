import { describe, expect, it } from "vitest";
import type { AccountPayable } from "../src/shared/types/domain";
import { payableMetrics } from "../src/renderer/pages/finance/components/PayablesTable";

function payable(status: AccountPayable["status"], dueDate: string): AccountPayable {
  return { status, dueDate } as AccountPayable;
}

describe("finance payables view", () => {
  it("does not count cancelled accounts as overdue or upcoming", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const metrics = Object.fromEntries(payableMetrics([
      payable("CANCELLED", yesterday),
      payable("CANCELLED", tomorrow),
      payable("OPEN", yesterday),
      payable("OPEN", tomorrow)
    ]).map((item) => [item.label, item.value]));

    expect(metrics["Vencidas"]).toBe(1);
    expect(metrics["Próximos 7 dias"]).toBe(1);
    expect(metrics["Abertas"]).toBe(2);
  });
});
