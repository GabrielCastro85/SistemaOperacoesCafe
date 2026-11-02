export interface ComparisonPeriodInput {
  start: string;
  end: string;
}

export interface PeriodComparisonInput {
  periods: ComparisonPeriodInput[];
  themeOrganizationId?: string | null;
}

export interface ComparisonPeriodSummary extends ComparisonPeriodInput {
  label: string;
  days: number;
  sacks: number;
  internalSacks: number;
  externalSacks: number;
  notes: number;
  operations: number;
  draftOperations: number;
  clients: number;
  amountCents: number;
  dailySacks: number;
  amountPerSackCents: number;
  inProgress: boolean;
}

export interface ComparisonCompanyRow {
  name: string;
  sacks: number[];
}

export interface ComparisonClientRow {
  name: string;
  sacks: number;
}

export interface ComparisonClientMover {
  name: string;
  previousSacks: number;
  currentSacks: number;
  deltaSacks: number;
}

export interface PeriodComparisonReport {
  scopeLabel: string;
  periods: ComparisonPeriodSummary[];
  companies: ComparisonCompanyRow[];
  topClients: ComparisonClientRow[][];
  risers: ComparisonClientMover[];
  fallers: ComparisonClientMover[];
  absentClients: ComparisonClientMover[];
  newClients: ComparisonClientMover[];
  observations: string[];
  attention: string[];
}

export type ComparisonPresetId = "sameDaysLastMonth" | "lastTwoMonths" | "lastThreeMonths" | "sameDaysLastYear";

export const COMPARISON_PRESETS: Array<{ id: ComparisonPresetId; label: string }> = [
  { id: "sameDaysLastMonth", label: "Este mês x anterior (mesmos dias)" },
  { id: "lastTwoMonths", label: "Últimos 2 meses inteiros" },
  { id: "lastThreeMonths", label: "Últimos 3 meses inteiros" },
  { id: "sameDaysLastYear", label: "Este mês x ano passado" }
];

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = (value: number): string => String(value).padStart(2, "0");
const isoDate = (year: number, month: number, day: number): string => `${year}-${pad(month)}-${pad(day)}`;

function parts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthRange(year: number, month: number, fromDay = 1, toDay = 31): ComparisonPeriodInput {
  const last = lastDayOfMonth(year, month);
  return { start: isoDate(year, month, Math.min(fromDay, last)), end: isoDate(year, month, Math.min(toDay, last)) };
}

function shiftMonth(year: number, month: number, offset: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + offset;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function comparisonPresetPeriods(preset: ComparisonPresetId, today: string): ComparisonPeriodInput[] {
  const { year, month, day } = parts(today);
  const monthBack = (offset: number) => shiftMonth(year, month, -offset);
  const fullMonth = (offset: number) => {
    const target = monthBack(offset);
    return monthRange(target.year, target.month);
  };
  if (preset === "lastTwoMonths") return [fullMonth(2), fullMonth(1)];
  if (preset === "lastThreeMonths") return [fullMonth(3), fullMonth(2), fullMonth(1)];
  if (preset === "sameDaysLastYear") return [monthRange(year - 1, month, 1, day), monthRange(year, month, 1, day)];
  const previous = monthBack(1);
  return [monthRange(previous.year, previous.month, 1, day), monthRange(year, month, 1, day)];
}

/** Aplica o mesmo intervalo de dias ao mes em que cada periodo comeca (ex.: dia 1 ao 20). */
export function applyDayRangeToPeriods(periods: ComparisonPeriodInput[], fromDay: number, toDay: number): ComparisonPeriodInput[] {
  return periods.map((period) => {
    const { year, month } = parts(period.start);
    return monthRange(year, month, fromDay, toDay);
  });
}

/** Sugere o periodo seguinte: o mesmo intervalo de dias no mes posterior. */
export function nextComparisonPeriod(period: ComparisonPeriodInput): ComparisonPeriodInput {
  const start = parts(period.start);
  const end = parts(period.end);
  const next = shiftMonth(start.year, start.month, 1);
  if (start.year !== end.year || start.month !== end.month) return { ...period };
  const isFullMonth = start.day === 1 && end.day === lastDayOfMonth(end.year, end.month);
  return monthRange(next.year, next.month, start.day, isFullMonth ? 31 : end.day);
}

export function comparisonPeriodDays(period: ComparisonPeriodInput): number {
  const toUtc = (date: string) => {
    const { year, month, day } = parts(date);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(period.end) - toUtc(period.start)) / 86_400_000) + 1;
}

export function comparisonPeriodLabels(periods: ComparisonPeriodInput[]): string[] {
  const years = new Set(periods.flatMap((period) => [period.start.slice(0, 4), period.end.slice(0, 4)]));
  const showYear = years.size > 1;
  return periods.map((period) => {
    const start = parts(period.start);
    const end = parts(period.end);
    const yearSuffix = showYear ? `/${String(end.year).slice(2)}` : "";
    const sameMonth = start.year === end.year && start.month === end.month;
    if (sameMonth && start.day === 1 && end.day === lastDayOfMonth(end.year, end.month)) {
      return showYear ? `${MONTH_NAMES[end.month - 1].slice(0, 3)}/${String(end.year).slice(2)}` : MONTH_NAMES[end.month - 1];
    }
    if (sameMonth) return `${pad(start.day)} a ${pad(end.day)}/${pad(end.month)}${yearSuffix}`;
    return `${pad(start.day)}/${pad(start.month)} a ${pad(end.day)}/${pad(end.month)}${yearSuffix}`;
  });
}

export function percentChange(previous: number, current: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
