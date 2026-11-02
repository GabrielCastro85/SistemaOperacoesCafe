import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import { buildPeriodComparisonReport, buildPeriodComparisonSvg, periodComparisonInputSchema, periodComparisonTheme, type ComparisonSaleRow } from "../electron/main/services/periodComparison";
import { PeriodComparisonPage } from "../src/renderer/pages/comparison/PeriodComparisonPage";
import type { BootstrapData } from "../src/shared/types/domain";
import { applyDayRangeToPeriods, nextComparisonPeriod, comparisonPeriodDays, comparisonPeriodLabels, comparisonPresetPeriods, percentChange } from "../src/shared/utils/periodComparison";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

// O icone do rodape e' base64 e pode conter "NaN" por acaso.
const visibleSvg = (svg: string): string => svg.replace(/href="[^"]*"/g, "");
const villaTheme = periodComparisonTheme({ primaryColor: "#0F0D0A", secondaryColor: "#D4A875", accentColor: "#16B86A" });
const graoTheme = periodComparisonTheme({ primaryColor: "#073F28", secondaryColor: "#9A7449", accentColor: "#05B866" }, "data:image/png;base64,AAAA");

function sale(overrides: Partial<ComparisonSaleRow>): ComparisonSaleRow {
  return { fiscalDocumentId: "nota-1", scope: "INTERNAL", status: "CONFIRMED", quantitySacks: "100", amountCents: 30000, clientId: "cliente-a", clientName: "Cliente A", companyName: "Villa MG", ...overrides };
}

describe("period comparison dates", () => {
  it("builds presets for the same days and for full months, respecting shorter months", () => {
    expect(comparisonPresetPeriods("sameDaysLastMonth", "2026-10-31")).toEqual([{ start: "2026-09-01", end: "2026-09-30" }, { start: "2026-10-01", end: "2026-10-31" }]);
    expect(comparisonPresetPeriods("lastThreeMonths", "2026-01-15")).toEqual([
      { start: "2025-10-01", end: "2025-10-31" },
      { start: "2025-11-01", end: "2025-11-30" },
      { start: "2025-12-01", end: "2025-12-31" }
    ]);
    expect(comparisonPresetPeriods("sameDaysLastYear", "2026-10-20")).toEqual([{ start: "2025-10-01", end: "2025-10-20" }, { start: "2026-10-01", end: "2026-10-20" }]);
  });

  it("applies one day range to the month of each period", () => {
    expect(applyDayRangeToPeriods([{ start: "2026-02-10", end: "2026-02-12" }, { start: "2026-03-01", end: "2026-03-31" }], 1, 30)).toEqual([
      { start: "2026-02-01", end: "2026-02-28" },
      { start: "2026-03-01", end: "2026-03-30" }
    ]);
  });

  it("labels full months, partial months and different years", () => {
    expect(comparisonPeriodLabels([{ start: "2026-07-01", end: "2026-07-31" }, { start: "2026-08-01", end: "2026-08-20" }])).toEqual(["Julho", "01 a 20/08"]);
    expect(comparisonPeriodLabels([{ start: "2025-10-01", end: "2025-10-31" }, { start: "2026-10-01", end: "2026-10-20" }])).toEqual(["Out/25", "01 a 20/10/26"]);
    expect(comparisonPeriodDays({ start: "2026-02-01", end: "2026-02-28" })).toBe(28);
    expect(percentChange(0, 10)).toBeNull();
    expect(percentChange(200, 100)).toBe(-50);
    expect(nextComparisonPeriod({ start: "2026-01-01", end: "2026-01-31" })).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(nextComparisonPeriod({ start: "2026-09-01", end: "2026-09-20" })).toEqual({ start: "2026-10-01", end: "2026-10-20" });
  });

  it("rejects an inverted period and a single period", () => {
    expect(() => periodComparisonInputSchema.parse({ periods: [{ start: "2026-07-02", end: "2026-07-01" }, { start: "2026-08-01", end: "2026-08-02" }] })).toThrow();
    expect(() => periodComparisonInputSchema.parse({ periods: [{ start: "2026-07-01", end: "2026-07-02" }] })).toThrow();
  });
});

describe("period comparison report", () => {
  const periods = [{ start: "2026-07-01", end: "2026-07-20" }, { start: "2026-08-01", end: "2026-08-31" }];

  it("sums sacks, notes, clients and client movements", () => {
    const report = buildPeriodComparisonReport(periods, [
      [
        sale({ quantitySacks: "100.5", amountCents: 30000 }),
        sale({ quantitySacks: "50", amountCents: 10000, scope: "EXTERNAL" }),
        sale({ fiscalDocumentId: "nota-2", clientId: "cliente-b", clientName: "Cliente B", quantitySacks: "400", amountCents: 80000, companyName: "Prime <Coffee>" })
      ],
      [
        sale({ fiscalDocumentId: "nota-3", quantitySacks: "300", amountCents: 60000, status: "DRAFT" }),
        sale({ fiscalDocumentId: "nota-4", clientId: "cliente-c", clientName: "Cliente C", quantitySacks: "40", amountCents: 8000 })
      ]
    ], "Todas as empresas", "2026-10-31");

    expect(report.periods[0]).toMatchObject({ sacks: 550.5, internalSacks: 500.5, externalSacks: 50, notes: 2, operations: 3, clients: 2, amountCents: 120000, days: 20, inProgress: false });
    expect(report.periods[1]).toMatchObject({ sacks: 340, notes: 2, clients: 2, draftOperations: 1, days: 31 });
    expect(report.topClients[0].map((client) => client.name)).toEqual(["Cliente B", "Cliente A"]);
    expect(report.risers.map((mover) => [mover.name, mover.deltaSacks])).toEqual([["Cliente A", 149.5]]);
    expect(report.absentClients.map((mover) => mover.name)).toEqual(["Cliente B"]);
    expect(report.clientsOnlyInLast.map((mover) => mover.name)).toEqual(["Cliente C"]);
    expect(report.attention.join(" ")).toContain("Cliente B teve 400 sacas");
    expect(report.attention.join(" ")).toContain("tamanhos diferentes");
    expect(report.attention.join(" ")).toContain("rascunho");
    expect(report.observations.join(" ")).toContain("caiu");

    const svg = buildPeriodComparisonSvg(report, villaTheme);
    expect(svg).toContain("Prime &lt;Coffee&gt;");
    expect(svg).toContain("Sem vendas em 01 a 20/07");
    expect(svg).not.toContain("Clientes novos");
    expect(visibleSvg(svg)).not.toMatch(/NaN|undefined|Infinity/);
    expect(svg).toContain("#0F0D0A");

    const graoSvg = buildPeriodComparisonSvg(report, graoTheme);
    expect(graoSvg).toContain("#073F28");
    expect(graoSvg).not.toContain("#0F0D0A");
    expect(graoSvg).toContain("data:image/png;base64,AAAA");
  });

  it("renders empty periods without invalid numbers", () => {
    const report = buildPeriodComparisonReport([...periods, { start: "2026-09-01", end: "2026-09-30" }, { start: "2026-10-01", end: "2026-10-31" }], [[], [], [], []], "Villa Coffee", "2026-10-31");
    expect(report.attention[0]).toContain("não tem vendas");
    expect(report.periods[3].inProgress).toBe(true);
    expect(visibleSvg(buildPeriodComparisonSvg(report, graoTheme))).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe("period comparison data", () => {
  it("always counts active sales of every company, whatever the selected company is", async () => {
    const userData = mkdtempSync(join(tmpdir(), "operacoes-comparison-"));
    tempDirs.push(userData);
    const dirs = resolveAppDirectories(userData);
    ensureAppDirectories(dirs);
    const db = initializeDatabase(dirs);
    try {
      const repo = new AppRepository(db, dirs);
      repo.saveInstallationProfile({ installationName: "Villa", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
      const client = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Teste", notes: null, roles: ["CLIENT"], isActive: true });
      const product = repo.listProducts({ organizationId: villaId })[0];
      const addSale = (documentNumber: string, date: string, quantity: string) => {
        const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: client.id, partnerLegalEntityId: null, accessKey: null, documentNumber, series: "1", issueDate: date, totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
        const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "Cafe", quantity, unit: "SACK", unitPriceDecimal: "1000", totalAmountCents: 100000, sacksQuantity: quantity });
        repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: client.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: date, quantitySacks: quantity, manualRateValueCents: null, manualOverrideReason: null, notes: null });
        return doc.document.id;
      };
      addSale("1", "2026-07-10", "10");
      addSale("2", "2026-07-25", "20");
      addSale("3", "2026-08-05", "5");
      repo.cancelFiscalDocument(addSale("4", "2026-08-06", "99"), "Teste");

      const report = repo.getPeriodComparison({ periods: [{ start: "2026-07-01", end: "2026-07-20" }, { start: "2026-08-01", end: "2026-08-31" }] }, "2026-10-31");
      expect(report.scopeLabel).toContain("Todas as empresas");
      expect(report.scopeLabel).toContain("Villa Coffee");
      expect(report.periods.map((period) => period.sacks)).toEqual([10, 5]);
      expect(report.periods.map((period) => period.notes)).toEqual([1, 1]);
      expect(report.topClients[0][0].name).toBe("Cliente Teste");

      const graoId = "22222222-2222-4222-8222-222222222222";
      const scoped = repo.getPeriodComparison({ periods: [{ start: "2026-07-01", end: "2026-07-31" }, { start: "2026-08-01", end: "2026-08-31" }], themeOrganizationId: graoId }, "2026-10-31");
      expect(scoped.periods[0].sacks).toBe(30);
      const indicators = repo.getOperationalIndicators({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
      expect(Number(indicators.sacksDecimal)).toBe(scoped.periods[0].sacks);
      expect(indicators.serviceAmountCents).toBe(scoped.periods[0].amountCents);

      // Operacao que continuou ativa numa nota cancelada nao entra em nenhum total.
      const summaryBefore = repo.getBillingSummary({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
      const monthlyBefore = repo.getMonthlyOperationTotals(villaId, 2026, ownLegalEntityId)[6];
      const orphanDocumentId = addSale("5", "2026-07-15", "7");
      db.prepare("UPDATE operations SET service_amount_cents = 3500, applied_rate_value_cents = 500 WHERE fiscal_document_id = ?").run(orphanDocumentId);
      repo.cancelFiscalDocument(orphanDocumentId, "Cancelada em outro computador");
      db.prepare("UPDATE operations SET status = 'CONFIRMED' WHERE fiscal_document_id = ?").run(orphanDocumentId);

      const withOrphan = repo.getPeriodComparison({ periods: [{ start: "2026-07-01", end: "2026-07-31" }, { start: "2026-08-01", end: "2026-08-31" }] }, "2026-10-31");
      expect(withOrphan.periods[0].sacks).toBe(30);
      expect(withOrphan.periods[0].notes).toBe(2);
      const indicatorsWithOrphan = repo.getOperationalIndicators({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
      expect(Number(indicatorsWithOrphan.sacksDecimal)).toBe(30);
      expect(indicatorsWithOrphan.serviceAmountCents).toBe(indicators.serviceAmountCents);
      expect(indicatorsWithOrphan.allCompaniesServiceAmountCents).toBe(indicators.allCompaniesServiceAmountCents);
      expect(Number(repo.getPartnerPeriodSackSummary({ organizationId: villaId, ownLegalEntityId, businessPartnerId: client.id, periodStart: "2026-07-01", periodEnd: "2026-07-31" }).sacksDecimal)).toBe(30);
      expect(repo.getMonthlyOperationTotals(villaId, 2026, ownLegalEntityId)[6]).toEqual(monthlyBefore);
      const summaryAfter = repo.getBillingSummary({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
      expect(summaryAfter.openCents).toBe(summaryBefore.openCents);
      expect(summaryAfter.unbilledOperations).toBe(summaryBefore.unbilledOperations);
    } finally {
      db.close();
    }
  });
});

describe("period comparison page", () => {
  it("offers presets and the day range, and always explains that every company is included", () => {
    const data = {
      organizations: [{ id: villaId, displayName: "Villa Coffee" }, { id: "22222222-2222-4222-8222-222222222222", displayName: "Grao & Grao" }],
      profile: { defaultOrganizationId: villaId }
    } as unknown as BootstrapData;
    const html = renderToStaticMarkup(createElement(PeriodComparisonPage, { data }));
    expect(html).toContain("Últimos 3 meses inteiros");
    expect(html).toContain("Aplicar aos períodos");
    expect(html).toContain("Todas as empresas");
    expect(html).toContain("Grao &amp; Grao");
    expect(html).not.toContain("<select");
    expect(html).toContain("Gerar comparativo");
    expect(html).not.toContain("Salvar imagem");
  });
});
