import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { groupCteNotes } from "../electron/main/services/chargeCteSheet";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

async function setup() {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-pht-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true } as never);
  const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "ABC", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  return { repo, db, partnerId: partner.id, productId: product.id };
}

// Venda confirmada de 10 sacas (como na importacao de XML).
function createSale(repo: AppRepository, db: ReturnType<typeof initializeDatabase>, partnerId: string, productId: string, documentNumber: string): string {
  const sacks = "10";
  const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partnerId, partnerLegalEntityId: null, accessKey: null, documentNumber, series: "1", issueDate: "2026-10-19", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
  db.prepare("UPDATE fiscal_documents SET direction = (SELECT direction FROM fiscal_documents WHERE id = ?) WHERE id = ?").run(doc.document.id, doc.document.id);
  const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId, description: "Cafe", quantity: sacks, unit: "SACK", unitPriceDecimal: "1000.000", totalAmountCents: 100000, sacksQuantity: sacks });
  repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: partnerId, productId, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-10-19", quantitySacks: sacks, manualRateValueCents: null, manualOverrideReason: null, notes: null });
  repo.confirmFiscalDocument(doc.document.id);
  return doc.document.id;
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("grupo de notas do CT-e", () => {
  it("agrupa por NF e empresa somando as sacas, em ordem de data e NF", () => {
    const rows = groupCteNotes([
      { date: "2026-10-20", company: "GRAO", sacks: "5", destination: "VASSULER", nf: "7439" },
      { date: "2026-10-19", company: "GRAO", sacks: "500", destination: "VASSULER", nf: "7438" },
      { date: "2026-10-19", company: "GRAO", sacks: "250", destination: "VASSULER", nf: "7438" }
    ]);
    expect(rows.map((row) => [row.nf, row.sacks])).toEqual([["7438", "750"], ["7439", "5"]]);
    expect(rows[0].date).toBe("2026-10-19");
  });
});

describe("PHT (CT-e) junto com a cobranca da ABC", () => {
  it("cobra todas as notas da ABC normalmente e gera a PHT so com as marcadas para o CT-e", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId: null, operationScope: "ALL", rateType: "PER_SACK", rateValueCents: 600, effectiveFrom: "2026-10-01", effectiveTo: null, priority: 1, isActive: true, notes: null, destinationStateUf: null } as never);
      const cteDoc = createSale(repo, db, partnerId, productId, "7438");
      const cteDoc2 = createSale(repo, db, partnerId, productId, "7439");
      const billDoc = createSale(repo, db, partnerId, productId, "8000");
      const operationsByDoc = (documentId: string) => repo.listOperations({ responsiblePartnerId: partnerId }).filter((item) => item.fiscalDocumentId === documentId).map((item) => item.id);
      const filters = { organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-10-01", periodEnd: "2026-10-31" };
      expect(repo.findEligibleOperations(filters).length).toBe(3);

      const cteIds = [...operationsByDoc(cteDoc), ...operationsByDoc(cteDoc2)];
      const draft = repo.createClientChargeDraft({
        ...filters, billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-11-05", notes: null, internalNotes: null,
        operationIds: [...operationsByDoc(billDoc), ...cteIds],
        cteOperationIds: cteIds,
        cteUnitValueCents: 150
      } as never);

      // A ABC cobra as 3 notas a R$ 6,00/saca (6.000 centavos cada), inclusive as do CT-e; o CT-e nao soma no total.
      const charge = repo.getClientCharge(draft.charge.id);
      expect(charge.operations.map((item) => item.fiscalDocumentNumberSnapshot).sort()).toEqual(["7438", "7439", "8000"]);
      expect(charge.adjustments.some((item) => item.description.startsWith("CT-e"))).toBe(false);
      expect(charge.charge.finalAmountCents).toBe(18000);

      // As notas ficam na cobranca: nao aparecem mais como elegiveis.
      expect(repo.findEligibleOperations(filters)).toEqual([]);

      // A planilha PHT sai das notas marcadas: 2 NFs, 20 sacas, R$ 1,50 por saca = R$ 30,00.
      const bytes = await repo.buildChargeCteDocument(draft.charge.id, "xlsx");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes.bytes as unknown as ArrayBuffer);
      const sheet = workbook.getWorksheet("PHT")!;
      expect(sheet.getCell("C5").value).toBe(7438);
      expect(sheet.getCell("C6").value).toBe(7439);
      expect(sheet.getCell("E5").value).toBe(10);
      expect((sheet.getCell("E8").value as { result: number }).result).toBe(20);
      expect(sheet.getCell("E9").value).toBe(1.5);
      expect((sheet.getCell("E10").value as { result: number }).result).toBe(30);

      const pdf = await repo.buildChargeCteDocument(draft.charge.id, "pdf");
      expect(Buffer.from(pdf.bytes.slice(0, 4)).toString()).toBe("%PDF");

      // Cancelar a cobranca solta as notas e a planilha PHT deixa de existir.
      repo.cancelClientCharge(draft.charge.id, "teste");
      expect(repo.findEligibleOperations(filters).length).toBe(3);
      await expect(repo.buildChargeCteDocument(draft.charge.id, "pdf")).rejects.toThrow(/nao tem notas de CT-e/);
      expect(db.prepare("SELECT status FROM cte_sheets WHERE client_charge_id = ?").get(draft.charge.id)).toEqual({ status: "CANCELED" });
    } finally { db.close(); }
  });

  it("nao gera PHT para cobranca sem notas de CT-e", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId: null, operationScope: "ALL", rateType: "PER_SACK", rateValueCents: 600, effectiveFrom: "2026-10-01", effectiveTo: null, priority: 1, isActive: true, notes: null, destinationStateUf: null } as never);
      const doc = createSale(repo, db, partnerId, productId, "9000");
      const ops = repo.listOperations({ responsiblePartnerId: partnerId }).filter((item) => item.fiscalDocumentId === doc).map((item) => item.id);
      const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-10-01", periodEnd: "2026-10-31", billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-11-05", notes: null, internalNotes: null, operationIds: ops } as never);
      await expect(repo.buildChargeCteDocument(draft.charge.id, "pdf")).rejects.toThrow(/nao tem notas de CT-e/);
    } finally { db.close(); }
  });
});
