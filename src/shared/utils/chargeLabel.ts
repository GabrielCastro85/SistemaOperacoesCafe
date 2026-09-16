import type { ClientCharge } from "../types/domain.js";

export function chargePeriodLabel(charge: Pick<ClientCharge, "periodStart" | "periodEnd">, compact = false): string {
  const date = (value: string, omitYear = false) => {
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${day}/${month}${omitYear ? "" : `/${compact ? year.slice(-2) : year}`}`;
  };
  return `${date(charge.periodStart, compact && charge.periodStart.slice(0, 4) === charge.periodEnd.slice(0, 4))} a ${date(charge.periodEnd)}`;
}
