import { z } from "zod";
import {
  comparisonPeriodDays,
  comparisonPeriodLabels,
  percentChange,
  type ComparisonClientMover,
  type ComparisonPeriodInput,
  type ComparisonPeriodSummary,
  type PeriodComparisonReport
} from "../../../src/shared/utils/periodComparison.js";
import { graonexSvgFooter } from "./generatedDocumentBranding.js";

export const COMPARISON_IMAGE_WIDTH = 1600;
export const COMPARISON_IMAGE_HEIGHT = 1160;
const COMPARISON_IMAGE_SCALE = 2;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const periodComparisonInputSchema = z.object({
  periods: z.array(z.object({ start: isoDate, end: isoDate })
    .refine((period) => period.start <= period.end, "A data inicial precisa ser anterior a final."))
    .min(2, "Informe ao menos dois periodos.")
    .max(4, "Compare no maximo quatro periodos."),
  organizationId: z.string().uuid().nullable().optional(),
  ownLegalEntityId: z.string().uuid().nullable().optional()
});

export interface ComparisonSaleRow {
  fiscalDocumentId: string;
  scope: string;
  status: string;
  quantitySacks: string;
  amountCents: number;
  clientId: string;
  clientName: string;
  companyName: string;
}

export function buildPeriodComparisonReport(
  periods: ComparisonPeriodInput[],
  rowsByPeriod: ComparisonSaleRow[][],
  scopeLabel: string,
  today: string
): PeriodComparisonReport {
  const labels = comparisonPeriodLabels(periods);
  const clients = new Map<string, { name: string; sacks: number[] }>();
  const companies = new Map<string, number[]>();
  const emptySeries = () => periods.map(() => 0);

  const summaries: ComparisonPeriodSummary[] = periods.map((period, index) => {
    const rows = rowsByPeriod[index] ?? [];
    let sacks = 0;
    let internalSacks = 0;
    let externalSacks = 0;
    let amountCents = 0;
    let draftOperations = 0;
    const notes = new Set<string>();
    const activeClients = new Set<string>();
    for (const row of rows) {
      const quantity = Number(row.quantitySacks) || 0;
      sacks += quantity;
      if (row.scope === "EXTERNAL") externalSacks += quantity;
      else internalSacks += quantity;
      amountCents += row.amountCents;
      if (row.status === "DRAFT") draftOperations += 1;
      notes.add(row.fiscalDocumentId);
      activeClients.add(row.clientId);
      const client = clients.get(row.clientId) ?? { name: row.clientName, sacks: emptySeries() };
      client.sacks[index] += quantity;
      clients.set(row.clientId, client);
      const company = companies.get(row.companyName) ?? emptySeries();
      company[index] += quantity;
      companies.set(row.companyName, company);
    }
    const days = comparisonPeriodDays(period);
    return {
      ...period,
      label: labels[index],
      days,
      sacks,
      internalSacks,
      externalSacks,
      notes: notes.size,
      operations: rows.length,
      draftOperations,
      clients: activeClients.size,
      amountCents,
      dailySacks: sacks / days,
      amountPerSackCents: sacks > 0 ? amountCents / sacks : 0,
      inProgress: period.end >= today
    };
  });

  const clientList = [...clients.values()];
  const topClients = summaries.map((_, index) => clientList
    .filter((client) => client.sacks[index] > 0)
    .map((client) => ({ name: client.name, sacks: client.sacks[index] }))
    .sort((a, b) => b.sacks - a.sacks)
    .slice(0, 5));

  const lastIndex = summaries.length - 1;
  const movers: ComparisonClientMover[] = clientList.map((client) => ({
    name: client.name,
    previousSacks: client.sacks[lastIndex - 1],
    currentSacks: client.sacks[lastIndex],
    deltaSacks: client.sacks[lastIndex] - client.sacks[lastIndex - 1]
  }));
  const byDeltaDesc = (a: ComparisonClientMover, b: ComparisonClientMover) => b.deltaSacks - a.deltaSacks;
  const stillActive = movers.filter((mover) => mover.previousSacks > 0 && mover.currentSacks > 0);
  const report: PeriodComparisonReport = {
    scopeLabel,
    periods: summaries,
    companies: [...companies.entries()]
      .map(([name, sacks]) => ({ name, sacks }))
      .sort((a, b) => b.sacks.reduce((sum, value) => sum + value, 0) - a.sacks.reduce((sum, value) => sum + value, 0))
      .slice(0, 6),
    topClients,
    risers: stillActive.filter((mover) => mover.deltaSacks > 0).sort(byDeltaDesc).slice(0, 4),
    fallers: stillActive.filter((mover) => mover.deltaSacks < 0).sort(byDeltaDesc).reverse().slice(0, 4),
    absentClients: movers.filter((mover) => mover.previousSacks > 0 && mover.currentSacks === 0).sort(byDeltaDesc).reverse().slice(0, 4),
    newClients: movers.filter((mover) => mover.previousSacks === 0 && mover.currentSacks > 0).sort(byDeltaDesc).slice(0, 4),
    observations: [],
    attention: []
  };
  report.observations = buildObservations(report);
  report.attention = buildAttention(report);
  return report;
}

function hasDifferentLengths(periods: ComparisonPeriodSummary[]): boolean {
  const days = periods.map((period) => period.days);
  return Math.max(...days) - Math.min(...days) > 3;
}

function buildObservations(report: PeriodComparisonReport): string[] {
  const { periods, companies } = report;
  const last = periods[periods.length - 1];
  const previous = periods[periods.length - 2];
  const observations: string[] = [];
  const best = periods.reduce((winner, period) => period.sacks > winner.sacks ? period : winner, periods[0]);
  if (best.sacks > 0) observations.push(`${best.label} teve o maior volume: ${formatSacks(best.sacks)} sacas.`);

  const change = percentChange(previous.sacks, last.sacks);
  if (change !== null) {
    observations.push(`${last.label} ${change >= 0 ? "subiu" : "caiu"} ${formatPercent(Math.abs(change))} em sacas frente a ${previous.label} (${formatSigned(last.sacks - previous.sacks)} sacas).`);
  }
  if (hasDifferentLengths([previous, last])) {
    const dailyChange = percentChange(previous.dailySacks, last.dailySacks);
    if (dailyChange !== null) observations.push(`Na média por dia, a variação foi de ${formatSignedPercent(dailyChange)}, porque os períodos têm tamanhos diferentes.`);
  }
  observations.push(`Vendas internas variaram ${formatSigned(last.internalSacks - previous.internalSacks)} sacas e externas ${formatSigned(last.externalSacks - previous.externalSacks)}.`);
  const amountChange = percentChange(previous.amountCents, last.amountCents);
  if (amountChange !== null) {
    observations.push(`Valor financeiro: ${formatMoney(previous.amountCents)} para ${formatMoney(last.amountCents)} (${formatSignedPercent(amountChange)}), com média de R$ ${formatRate(last.amountPerSackCents)} por saca.`);
  }
  const lastIndex = periods.length - 1;
  const grower = companies
    .map((company) => ({ name: company.name, delta: company.sacks[lastIndex] - company.sacks[lastIndex - 1] }))
    .sort((a, b) => b.delta - a.delta)[0];
  if (grower && grower.delta > 0) observations.push(`${grower.name} foi a empresa que mais cresceu (${formatSigned(grower.delta)} sacas).`);
  return observations;
}

function buildAttention(report: PeriodComparisonReport): string[] {
  const { periods, absentClients, topClients } = report;
  const last = periods[periods.length - 1];
  const previous = periods[periods.length - 2];
  const attention: string[] = [];
  for (const period of periods) {
    if (period.operations === 0) attention.push(`${period.label} não tem vendas lançadas no sistema.`);
  }
  for (const period of periods) {
    if (period.inProgress) attention.push(`${period.label} ainda está em andamento: os números podem mudar.`);
  }
  if (hasDifferentLengths(periods)) {
    attention.push(`Períodos com tamanhos diferentes (${periods.map((period) => period.days).join(", ")} dias): compare pela média diária.`);
  }
  const withDrafts = periods.filter((period) => period.draftOperations > 0);
  if (withDrafts.length) {
    attention.push(`Operações em rascunho entram nos totais: ${withDrafts.map((period) => `${period.label} ${formatSacks(period.draftOperations)}`).join(", ")}.`);
  }
  const absent = absentClients[0];
  if (absent) attention.push(`${absent.name} teve ${formatSacks(absent.previousSacks)} sacas em ${previous.label} e nenhuma em ${last.label}.`);
  const leader = topClients[topClients.length - 1]?.[0];
  if (leader && last.sacks > 0 && leader.sacks / last.sacks >= 0.3) {
    attention.push(`${leader.name} concentra ${formatPercent((leader.sacks / last.sacks) * 100)} do volume de ${last.label}.`);
  }
  return attention;
}

const PERIOD_COLORS = ["#2F7BDF", "#34A853", "#F5921E", "#7C4DD6"];
const NAVY = "#123F6D";
const INK = "#1B2B3A";
const MUTED = "#5C6B7A";
const LINE = "#DDE4EB";
const UP = "#1E8E3E";
const DOWN = "#D93025";
const FONT = "'Segoe UI', Arial, sans-serif";

const number = (value: number, digits = 0) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const formatSacks = (value: number) => number(value);
const formatMoney = (cents: number) => `R$ ${number(cents / 100)}`;
const formatRate = (cents: number) => number(cents / 100, 2);
const formatPercent = (value: number) => `${number(value, 2)}%`;
const formatSigned = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${number(Math.abs(value))}`;
const formatSignedPercent = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${number(Math.abs(value), 2)}%`;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function estimateWidth(value: string, fontSize: number): number {
  return value.length * fontSize * 0.53;
}

function truncate(value: string, maxWidth: number, fontSize: number): string {
  if (estimateWidth(value, fontSize) <= maxWidth) return value;
  const chars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.53)) - 1);
  return `${value.slice(0, chars).trimEnd()}…`;
}

function wrap(value: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && estimateWidth(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

interface TextOptions {
  size?: number;
  weight?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
}

function text(value: string, x: number, y: number, options: TextOptions = {}): string {
  const { size = 14, weight = 400, fill = INK, anchor = "start" } = options;
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

function rect(x: number, y: number, width: number, height: number, fill: string, radius = 0): string {
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, width).toFixed(1)}" height="${Math.max(0, height).toFixed(1)}" rx="${radius}" fill="${fill}"/>`;
}

function panel(x: number, y: number, width: number, height: number, title: string, headerFill = NAVY): string {
  return `${rect(x, y, width, height, "#FFFFFF", 10)}<path d="M${x} ${y + 40}V${y + 10}a10 10 0 0 1 10-10H${x + width - 10}a10 10 0 0 1 10 10V${y + 40}Z" fill="${headerFill}"/>${text(title, x + 16, y + 27, { size: 18, weight: 700, fill: "#FFFFFF" })}`;
}

function arrow(x: number, y: number, up: boolean, fill: string): string {
  const path = up
    ? `M${x} ${y + 9}L${x + 9} ${y}L${x + 18} ${y + 9}M${x + 9} ${y}V${y + 20}`
    : `M${x} ${y + 11}L${x + 9} ${y + 20}L${x + 18} ${y + 11}M${x + 9} ${y + 20}V${y}`;
  return `<path d="${path}" fill="none" stroke="${fill}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}

function gridLines(x: number, top: number, width: number, height: number, max: number): string {
  let output = "";
  for (let step = 0; step <= 4; step += 1) {
    const y = top + height - (height * step) / 4;
    output += `<line x1="${x}" x2="${x + width}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${LINE}"/>`;
    output += text(number((max * step) / 4), x - 8, y + 4, { size: 11, fill: MUTED, anchor: "end" });
  }
  return output;
}

function overviewPanel(report: PeriodComparisonReport, x: number, y: number, width: number, height: number): string {
  const { periods } = report;
  const rows: Array<[string, (period: ComparisonPeriodSummary) => string, boolean]> = [
    ["Total de sacas", (period) => formatSacks(period.sacks), true],
    ["Vendas internas (sacas)", (period) => formatSacks(period.internalSacks), false],
    ["Vendas externas (sacas)", (period) => formatSacks(period.externalSacks), false],
    ["Nº de notas", (period) => formatSacks(period.notes), false],
    ["Clientes atendidos", (period) => formatSacks(period.clients), false],
    ["Média de sacas por dia", (period) => formatSacks(period.dailySacks), false],
    ["Valor financeiro (R$)", (period) => number(period.amountCents / 100), true],
    ["Média de R$ por saca", (period) => formatRate(period.amountPerSackCents), false]
  ];
  const left = x + 14;
  const labelWidth = 186;
  const columnWidth = (width - 28 - labelWidth) / periods.length;
  const headerY = y + 50;
  const rowHeight = (height - 50 - 44) / rows.length;
  let output = panel(x, y, width, height, "1. VISÃO GERAL");
  output += text("Indicador", left + 8, headerY + 23, { size: 14, weight: 700 });
  periods.forEach((period, index) => {
    const columnX = left + labelWidth + columnWidth * index;
    output += rect(columnX + 2, headerY, columnWidth - 4, 34, `${PERIOD_COLORS[index]}33`, 5);
    const size = estimateWidth(period.label, 14) > columnWidth - 8 ? 11.5 : 14;
    output += text(period.label, columnX + columnWidth / 2, headerY + 22, { size, weight: 700, anchor: "middle" });
  });
  rows.forEach(([label, value, strong], rowIndex) => {
    const rowY = headerY + 38 + rowHeight * rowIndex;
    if (rowIndex > 0) output += `<line x1="${left}" x2="${left + width - 28}" y1="${rowY.toFixed(1)}" y2="${rowY.toFixed(1)}" stroke="${LINE}"/>`;
    output += text(label, left + 8, rowY + rowHeight / 2 + 5, { size: 13.5, weight: strong ? 700 : 400 });
    periods.forEach((period, index) => {
      output += text(value(period), left + labelWidth + columnWidth * index + columnWidth / 2, rowY + rowHeight / 2 + 5, { size: strong ? 15 : 14, weight: strong ? 700 : 400, anchor: "middle" });
    });
  });
  return output;
}

function volumePanel(report: PeriodComparisonReport, x: number, y: number, width: number, height: number): string {
  const { periods } = report;
  const max = niceMax(Math.max(...periods.map((period) => period.sacks)) * 1.08);
  const chartX = x + 72;
  const chartTop = y + 92;
  const chartWidth = width - 92;
  const chartHeight = height - 138;
  const slot = chartWidth / periods.length;
  const barWidth = Math.min(92, slot * 0.68);
  let output = panel(x, y, width, height, "2. VOLUME COMERCIALIZADO");
  output += text("Quantidade de sacas em cada período.", x + 16, y + 64, { size: 13.5, fill: MUTED });
  output += gridLines(chartX, chartTop, chartWidth, chartHeight, max);
  periods.forEach((period, index) => {
    const barHeight = (period.sacks / max) * chartHeight;
    const center = chartX + slot * index + slot / 2;
    output += rect(center - barWidth / 2, chartTop + chartHeight - barHeight, barWidth, barHeight, PERIOD_COLORS[index], 3);
    output += text(formatSacks(period.sacks), center, chartTop + chartHeight - barHeight - 7, { size: 14, weight: 700, anchor: "middle" });
    output += text(truncate(period.label, slot - 4, 13), center, chartTop + chartHeight + 22, { size: 13, weight: 600, anchor: "middle" });
  });
  return output;
}

function evolutionPanel(report: PeriodComparisonReport, x: number, y: number, width: number, height: number): string {
  const { periods } = report;
  const pairCount = periods.length - 1;
  const gap = 10;
  const columnWidth = (width - 24 - gap * (pairCount - 1)) / pairCount;
  const top = y + 50;
  const bodyTop = top + 50;
  const rows: Array<[string, (period: ComparisonPeriodSummary) => number]> = [
    ["Volume de sacas", (period) => period.sacks],
    ["Sacas por dia", (period) => period.dailySacks],
    ["Valor financeiro", (period) => period.amountCents]
  ];
  const rowHeight = (y + height - 12 - bodyTop) / rows.length;
  let output = panel(x, y, width, height, "3. EVOLUÇÃO ENTRE OS PERÍODOS");
  for (let index = 0; index < pairCount; index += 1) {
    const columnX = x + 12 + (columnWidth + gap) * index;
    const previous = periods[index];
    const current = periods[index + 1];
    output += rect(columnX, top, columnWidth, height - 62, "#F4F7FA", 8);
    output += text(truncate(previous.label, columnWidth - 10, 13), columnX + columnWidth / 2, top + 20, { size: 13, weight: 700, anchor: "middle" });
    output += text(truncate(`→ ${current.label}`, columnWidth - 10, 13), columnX + columnWidth / 2, top + 38, { size: 13, weight: 700, anchor: "middle" });
    rows.forEach(([label, value], rowIndex) => {
      const change = percentChange(value(previous), value(current));
      const rowY = bodyTop + rowHeight * rowIndex;
      const color = change === null || change === 0 ? MUTED : change > 0 ? UP : DOWN;
      const center = columnX + columnWidth / 2;
      if (change !== null && change !== 0) {
        const valueText = formatSignedPercent(change);
        const size = pairCount === 1 ? 30 : pairCount === 2 ? 24 : 18;
        const totalWidth = estimateWidth(valueText, size) + 26;
        output += arrow(center - totalWidth / 2, rowY + rowHeight / 2 - 22, change > 0, color);
        output += text(valueText, center - totalWidth / 2 + 26, rowY + rowHeight / 2 - 4, { size, weight: 700, fill: color });
      } else {
        output += text(change === null ? "sem base" : "estável", center, rowY + rowHeight / 2 - 6, { size: 18, weight: 700, fill: color, anchor: "middle" });
      }
      output += text(truncate(label, columnWidth - 8, 12), center, rowY + rowHeight / 2 + 18, { size: 12, fill: MUTED, anchor: "middle" });
    });
  }
  return output;
}

function legend(periods: ComparisonPeriodSummary[], right: number, y: number): string {
  let cursor = right;
  let output = "";
  [...periods].reverse().forEach((period, reversedIndex) => {
    const color = PERIOD_COLORS[periods.length - 1 - reversedIndex];
    const labelWidth = estimateWidth(period.label, 13);
    cursor -= labelWidth;
    output += text(period.label, cursor, y, { size: 13 });
    cursor -= 20;
    output += rect(cursor, y - 11, 14, 14, color, 2);
    cursor -= 16;
  });
  return output;
}

function companiesPanel(report: PeriodComparisonReport, x: number, y: number, width: number, height: number): string {
  const { periods, companies } = report;
  // Folga para o valor escrito na vertical nao invadir a legenda.
  const max = niceMax(Math.max(1, ...companies.flatMap((company) => company.sacks)) * 1.25);
  const chartX = x + 72;
  const chartTop = y + 86;
  const chartWidth = width - 92;
  const chartHeight = height - 146;
  let output = panel(x, y, width, height, "4. VOLUME POR EMPRESA (SACAS)");
  output += legend(periods, x + width - 18, y + 66);
  output += gridLines(chartX, chartTop, chartWidth, chartHeight, max);
  if (!companies.length) return output;
  const slot = chartWidth / companies.length;
  const barWidth = Math.min(38, (slot - 14) / periods.length);
  companies.forEach((company, companyIndex) => {
    const center = chartX + slot * companyIndex + slot / 2;
    const groupLeft = center - (barWidth * periods.length) / 2;
    company.sacks.forEach((value, periodIndex) => {
      const barHeight = (value / max) * chartHeight;
      const barX = groupLeft + barWidth * periodIndex;
      output += rect(barX + 1, chartTop + chartHeight - barHeight, barWidth - 2, barHeight, PERIOD_COLORS[periodIndex], 2);
      output += `<text transform="translate(${(barX + barWidth / 2 + 3).toFixed(1)} ${(chartTop + chartHeight - barHeight - 5).toFixed(1)}) rotate(-90)" font-size="10.5" font-weight="600" fill="${INK}">${escapeXml(formatSacks(value))}</text>`;
    });
    wrap(company.name, slot - 8, 12).slice(0, 2).forEach((line, lineIndex) => {
      output += text(truncate(line, slot - 6, 12), center, chartTop + chartHeight + 20 + lineIndex * 15, { size: 12, weight: 600, anchor: "middle" });
    });
  });
  return output;
}

function clientsPanel(report: PeriodComparisonReport, x: number, y: number, width: number, height: number): string {
  const { periods, topClients } = report;
  const gap = 10;
  const columnWidth = (width - 24 - gap * (periods.length - 1)) / periods.length;
  const top = y + 50;
  let output = panel(x, y, width, height, "5. PRINCIPAIS CLIENTES POR VOLUME (SACAS)");
  const max = Math.max(1, ...topClients.flatMap((rows) => rows.map((row) => row.sacks)));
  periods.forEach((period, index) => {
    const columnX = x + 12 + (columnWidth + gap) * index;
    output += rect(columnX, top, columnWidth, height - 62, "#F4F7FA", 8);
    output += rect(columnX, top, columnWidth, 32, PERIOD_COLORS[index], 8);
    output += text(truncate(period.label, columnWidth - 10, 15), columnX + columnWidth / 2, top + 22, { size: 15, weight: 700, fill: "#FFFFFF", anchor: "middle" });
    const rowHeight = (height - 62 - 42) / 5;
    const rows = topClients[index] ?? [];
    if (!rows.length) output += text("Sem vendas", columnX + columnWidth / 2, top + 80, { size: 13, fill: MUTED, anchor: "middle" });
    rows.forEach((row, rowIndex) => {
      const rowY = top + 42 + rowHeight * rowIndex;
      const value = formatSacks(row.sacks);
      const nameWidth = columnWidth - 20 - estimateWidth(value, 13) - 6;
      output += text(truncate(`${rowIndex + 1}. ${row.name}`, nameWidth, 13), columnX + 10, rowY + 14, { size: 13, weight: 600 });
      output += text(value, columnX + columnWidth - 10, rowY + 14, { size: 13, weight: 600, anchor: "end" });
      output += rect(columnX + 10, rowY + 21, columnWidth - 20, 7, "#E1E7ED", 3);
      output += rect(columnX + 10, rowY + 21, ((columnWidth - 20) * row.sacks) / max, 7, PERIOD_COLORS[index], 3);
    });
  });
  return output;
}

function moverColumn(title: string, color: string, rows: ComparisonClientMover[], x: number, y: number, width: number, value: (mover: ComparisonClientMover) => string): string {
  let output = rect(x, y, width, 26, `${color}22`, 5);
  output += text(title, x + 8, y + 18, { size: 13, weight: 700, fill: color });
  if (!rows.length) return output + text("Nenhum", x + 8, y + 46, { size: 12.5, fill: MUTED });
  rows.forEach((mover, index) => {
    const rowY = y + 46 + index * 23;
    const label = value(mover);
    output += text(truncate(mover.name, width - estimateWidth(label, 12.5) - 20, 12.5), x + 8, rowY, { size: 12.5 });
    output += text(label, x + width - 6, rowY, { size: 12.5, weight: 700, fill: color, anchor: "end" });
  });
  return output;
}

function moversPanel(report: PeriodComparisonReport, x: number, y: number, width: number, height: number): string {
  const { periods, risers, fallers, absentClients, newClients } = report;
  const last = periods[periods.length - 1];
  const previous = periods[periods.length - 2];
  let output = panel(x, y, width, height, "6. MOVIMENTO DOS CLIENTES (SACAS)");
  output += text(truncate(`${previous.label} → ${last.label}`, width - 24, 13.5), x + 16, y + 62, { size: 13.5, fill: MUTED });
  const gap = 10;
  const columnWidth = (width - 24 - gap) / 2;
  const left = x + 12;
  const right = left + columnWidth + gap;
  const delta = (mover: ComparisonClientMover) => formatSigned(mover.deltaSacks);
  output += moverColumn("Maiores altas", UP, risers, left, y + 72, columnWidth, delta);
  output += moverColumn("Maiores quedas", DOWN, fallers, right, y + 72, columnWidth, delta);
  const bottomY = y + 72 + 146;
  output += moverColumn("Clientes novos", "#1A6FC4", newClients.slice(0, 3), left, bottomY, columnWidth, delta);
  output += moverColumn(truncate(`Sem vendas em ${last.label}`, columnWidth - 14, 13), "#B06000", absentClients.slice(0, 3), right, bottomY, columnWidth, delta);
  return output;
}

function listPanel(title: string, items: string[], x: number, y: number, width: number, height: number, bullet: string, headerFill?: string): string {
  let output = panel(x, y, width, height, title, headerFill);
  let cursor = y + 66;
  const limit = y + height - 14;
  const fontSize = 14;
  const lineHeight = 19;
  for (const item of items) {
    const lines = wrap(item, width - 56, fontSize);
    if (cursor + (lines.length - 1) * lineHeight > limit) break;
    output += `<circle cx="${x + 24}" cy="${cursor - 5}" r="6" fill="${bullet}"/>`;
    lines.forEach((line, index) => {
      output += text(line, x + 40, cursor + index * lineHeight, { size: fontSize });
    });
    cursor += lines.length * lineHeight + 10;
  }
  return output;
}

export function buildPeriodComparisonSvg(report: PeriodComparisonReport): string {
  const width = COMPARISON_IMAGE_WIDTH;
  const height = COMPARISON_IMAGE_HEIGHT;
  const { periods } = report;
  const margin = 12;
  const gap = 12;
  const title = `COMPARATIVO DE VENDAS – ${periods.map((period) => period.label).join(" x ")}`;
  const titleSize = Math.min(36, (width - 240) / (title.length * 0.6));
  const formatDate = (date: string) => date.split("-").reverse().join("/");
  const subtitle = `${report.scopeLabel} | ${periods.map((period) => `${formatDate(period.start)} a ${formatDate(period.end)}`).join("  •  ")}`;
  const usable = width - margin * 2;
  const rowOneY = 100;
  const rowOneHeight = 372;
  const rowTwoY = rowOneY + rowOneHeight + gap;
  const rowTwoHeight = 296;
  const rowThreeY = rowTwoY + rowTwoHeight + gap;
  const rowThreeHeight = 332;

  const overviewWidth = 640;
  const volumeWidth = 450;
  const evolutionWidth = usable - overviewWidth - volumeWidth - gap * 2;
  const companiesWidth = 780;
  const clientsWidth = usable - companiesWidth - gap;
  const moversWidth = 560;
  const observationsWidth = 520;
  const attentionWidth = usable - moversWidth - observationsWidth - gap * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">
    ${rect(0, 0, width, height, "#EDF1F5")}
    <defs><linearGradient id="comparisonHeader" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0F3358"/><stop offset="1" stop-color="#1A5A8E"/></linearGradient></defs>
    ${rect(0, 0, width, 88, "url(#comparisonHeader)")}
    <g transform="rotate(-25 74 44)"><ellipse cx="62" cy="44" rx="17" ry="24" fill="#B9794A"/><path d="M62 21C54 36 70 50 62 67" fill="none" stroke="#6B3F22" stroke-width="3"/></g>
    <g transform="rotate(20 96 50)"><ellipse cx="98" cy="52" rx="13" ry="19" fill="#C98A58"/><path d="M98 34C92 46 104 56 98 70" fill="none" stroke="#6B3F22" stroke-width="2.5"/></g>
    ${text(truncate(title, width - 160, titleSize), 130, 44, { size: titleSize, weight: 700, fill: "#FFFFFF" })}
    ${text(truncate(subtitle, width - 160, 15.5), 130, 72, { size: 15.5, fill: "#DCE8F3" })}
    ${overviewPanel(report, margin, rowOneY, overviewWidth, rowOneHeight)}
    ${volumePanel(report, margin + overviewWidth + gap, rowOneY, volumeWidth, rowOneHeight)}
    ${evolutionPanel(report, margin + overviewWidth + volumeWidth + gap * 2, rowOneY, evolutionWidth, rowOneHeight)}
    ${companiesPanel(report, margin, rowTwoY, companiesWidth, rowTwoHeight)}
    ${clientsPanel(report, margin + companiesWidth + gap, rowTwoY, clientsWidth, rowTwoHeight)}
    ${moversPanel(report, margin, rowThreeY, moversWidth, rowThreeHeight)}
    ${listPanel("7. PRINCIPAIS OBSERVAÇÕES", report.observations, margin + moversWidth + gap, rowThreeY, observationsWidth, rowThreeHeight, "#2F7BDF")}
    ${listPanel("8. PONTOS DE ATENÇÃO", report.attention.length ? report.attention : ["Nenhum ponto de atenção identificado."], margin + moversWidth + observationsWidth + gap * 2, rowThreeY, attentionWidth, rowThreeHeight, "#7C4DD6", "#3D2C7A")}
    ${graonexSvgFooter(width, height - 10)}
  </svg>`;
}

/**
 * Desenha o SVG num canvas em vez de capturar a janela: no Windows a janela
 * oculta fica limitada ao tamanho da tela e cortaria a parte de baixo da imagem.
 */
export async function renderPeriodComparisonImage(svg: string): Promise<import("electron").NativeImage> {
  const { BrowserWindow, nativeImage } = await import("electron");
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  try {
    await win.loadURL("about:blank");
    const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const dataUrl = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = ${COMPARISON_IMAGE_WIDTH * COMPARISON_IMAGE_SCALE};
        canvas.height = ${COMPARISON_IMAGE_HEIGHT * COMPARISON_IMAGE_SCALE};
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => reject(new Error("Falha ao desenhar o comparativo."));
      image.src = ${JSON.stringify(source)};
    })`) as string;
    return nativeImage.createFromDataURL(dataUrl);
  } finally {
    win.destroy();
  }
}
