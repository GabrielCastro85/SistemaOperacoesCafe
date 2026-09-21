import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import ExcelJS from "exceljs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { getPartnerPeriodReport } from "../electron/main/services/partnerPeriodReport";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
const villaEsLegalEntityId = "33333333-3333-4333-8333-333333333332";
const graoId = "22222222-2222-4222-8222-222222222222";
const graoMgLegalEntityId = "44444444-4444-4444-8444-444444444441";
const graoSpLegalEntityId = "44444444-4444-4444-8444-444444444442";

async function setup(organizationId = villaId, defaultLegalEntityId = ownLegalEntityId): Promise<{ repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string }> {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-charge-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: organizationId, defaultLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const partner = await repo.createBusinessPartner({ organizationId, displayName: "Cliente Cobranca", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId })[0];
  await repo.createServiceRateRule({ organizationId, businessPartnerId: partner.id, ownLegalEntityId: null, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
  return { repo, db, partnerId: partner.id, productId: product.id };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("client charges and ledger", () => {
  it("reports paid and unpaid notes without creating charges, respecting period and billing filter", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      for (const number of ["REPORT-PAID", "REPORT-PARTIAL", "REPORT-OPEN", "REPORT-CANCELLED"]) createConfirmedOperation(repo, partnerId, productId, number, "10");
      createConfirmedOperation(repo, partnerId, productId, "REPORT-OTHER-MONTH", "10", "EXTERNAL", ownLegalEntityId, villaId, "2026-06-16");
      const filters = { organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" };
      const operations = repo.findEligibleOperations(filters);
      for (const number of ["REPORT-PAID", "REPORT-PARTIAL"]) {
        const operation = operations.find((op) => repo.getFiscalDocument(op.fiscalDocumentId).document.documentNumber === number)!;
        const draft = repo.createClientChargeDraft({ ...filters, billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: [operation.id] });
        const amount = number === "REPORT-PAID" ? draft.charge.finalAmountCents : 100;
        const payment = repo.createClientPayment({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, paymentDate: "2026-08-01", amountCents: amount, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
        repo.allocatePayment({ clientPaymentId: payment.id, clientChargeId: draft.charge.id, amountCents: amount });
        await repo.issueClientCharge(draft.charge.id);
      }
      const cancelled = operations.find((op) => repo.getFiscalDocument(op.fiscalDocumentId).document.documentNumber === "REPORT-CANCELLED")!;
      repo.cancelFiscalDocument(cancelled.fiscalDocumentId, "Teste");
      const before = db.prepare("SELECT * FROM operations ORDER BY id").all();
      const beforeCharges = db.prepare("SELECT * FROM client_charges ORDER BY id").all();
      const full = getPartnerPeriodReport(repo, { ...filters, includeAlreadyBilled: true });
      expect(full.rows.map((row) => [row.number, row.status])).toEqual([
        ["REPORT-OPEN", "Nao cobrada"], ["REPORT-PAID", "Quitada"], ["REPORT-PARTIAL", "Cobranca parcial"]
      ]);
      expect(getPartnerPeriodReport(repo, { ...filters, includeAlreadyBilled: false }).rows.map((row) => row.number)).toEqual(["REPORT-OPEN", "REPORT-PARTIAL"]);
      expect(db.prepare("SELECT * FROM operations ORDER BY id").all()).toEqual(before);
      expect(db.prepare("SELECT * FROM client_charges ORDER BY id").all()).toEqual(beforeCharges);
    } finally { db.close(); }
  });
  it("marks a draft paid in full as paid when it is issued", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      createConfirmedOperation(repo, partnerId, productId, "PAID-DRAFT", "10");
      const filters = { organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" };
      const operations = repo.findEligibleOperations(filters);
      const draft = repo.createClientChargeDraft({ ...filters, billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: operations.map((operation) => operation.id) });
      const payment = repo.createClientPayment({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, paymentDate: "2026-08-01", amountCents: draft.charge.finalAmountCents, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
      const allocated = repo.allocatePayment({ clientPaymentId: payment.id, clientChargeId: draft.charge.id, amountCents: draft.charge.finalAmountCents });
      expect(allocated.charge.status).toBe("DRAFT");
      expect(allocated.charge.openAmountCents).toBe(0);

      const issued = await repo.issueClientCharge(draft.charge.id);
      expect(issued.charge.status).toBe("PAID");
      expect(issued.charge.paidAmountCents).toBe(issued.charge.finalAmountCents);
      expect(issued.charge.openAmountCents).toBe(0);
    } finally { db.close(); }
  });

  it("generates a branded receipt with the client name and partial note payment", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      createConfirmedOperation(repo, partnerId, productId, "RECIBO-101", "100");
      const filters = { organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" };
      const operation = repo.findEligibleOperations(filters)[0];
      const draft = repo.createClientChargeDraft({ ...filters, billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: [operation.id] });
      const issued = await repo.issueClientCharge(draft.charge.id);
      const payment = repo.createClientPayment({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, paymentDate: "2026-08-01", amountCents: 10000, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: "NF RECIBO-101", notes: null, attachmentPath: null });
      repo.allocatePayment({ clientPaymentId: payment.id, clientChargeId: issued.charge.id, amountCents: 10000 });
      const receipt = await repo.generateClientPaymentReceipt(payment.id);
      expect(receipt.receiptPdfFilePath && existsSync(receipt.receiptPdfFilePath)).toBe(true);
      expect(receipt.receiptImageFilePath && existsSync(receipt.receiptImageFilePath)).toBe(true);
      const imageText = readFileSync(receipt.receiptImageFilePath!, "utf8");
      expect(imageText).toContain("Cliente Cobranca");
      expect(imageText).toContain("RECIBO-101");
      expect(imageText).toContain("Pagamento parcial");
    } finally { db.close(); }
  });

  it("reprices an open charge, preserves partial payments and freezes paid charges", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      createConfirmedOperation(repo, partnerId, productId, "REPRICE-OPEN", "500");
      const filters = { organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" };
      const operations = repo.findEligibleOperations(filters);
      const draft = repo.createClientChargeDraft({ ...filters, billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: operations.map(op => op.id) });
      const issued = await repo.issueClientCharge(draft.charge.id);
      const payment = repo.createClientPayment({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, paymentDate: "2026-08-01", amountCents: 100000, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
      repo.allocatePayment({ clientPaymentId: payment.id, clientChargeId: issued.charge.id, amountCents: 100000 });
      const rule = repo.listServiceRateRules({ businessPartnerId: partnerId })[0];
      await repo.updateServiceRateRule(rule.id, { ...rule, rateValueCents: 700 });
      const updated = repo.getClientCharge(issued.charge.id);
      expect(updated.charge.finalAmountCents).toBe(350000);
      expect(updated.charge.paidAmountCents).toBe(100000);
      expect(updated.charge.openAmountCents).toBe(250000);
      expect(updated.operations[0].serviceRateCentsSnapshot).toBe(700);
      expect(updated.charge.pdfFilePath).not.toBe(issued.charge.pdfFilePath);
      const rest = repo.createClientPayment({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, paymentDate: "2026-08-02", amountCents: 250000, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
      repo.allocatePayment({ clientPaymentId: rest.id, clientChargeId: issued.charge.id, amountCents: 250000 });
      await repo.updateServiceRateRule(rule.id, { ...rule, rateValueCents: 900 });
      const paid = repo.getClientCharge(issued.charge.id);
      expect(paid.charge.status).toBe("PAID");
      expect(paid.charge.finalAmountCents).toBe(350000);
      expect(paid.operations[0].serviceRateCentsSnapshot).toBe(700);
    } finally { db.close(); }
  });

  it("reserves only selected notes and leaves the others available in the same period", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      createConfirmedOperation(repo, partnerId, productId, "SELECT-1", "500");
      createConfirmedOperation(repo, partnerId, productId, "SELECT-2", "200");
      const filters = { organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" };
      const operations = repo.findEligibleOperations(filters);
      const selected = operations.find((operation) => operation.quantitySacks === "500")!;
      const draft = repo.createClientChargeDraft({ ...filters, billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: [selected.id] });
      expect(draft.operations).toHaveLength(1);
      expect(draft.charge.subtotalServicesCents).toBe(250000);
      const remaining = repo.findEligibleOperations(filters);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].quantitySacks).toBe("200");
    } finally { db.close(); }
  });

  it("exports contract references and the 500 sacks times five reais service fee", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      createConfirmedOperation(repo, partnerId, productId, "QA-500", "500");
      const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
      const document = repo.getFiscalDocument(eligible[0].fiscalDocumentId).document;
      repo.updateFiscalDocument(document.id, { ...document, contractNumber: "MCU-103265", billingObservations: "Lote 123\nContrato complementar ABC-456" });
      db.prepare("UPDATE fiscal_documents SET status = 'DRAFT' WHERE id = ?").run(document.id);
      db.prepare("UPDATE operations SET status = 'DRAFT' WHERE fiscal_document_id = ?").run(document.id);
      expect(repo.findEligibleOperations({ organizationId: villaId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" })).toHaveLength(1);
      const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
      const issued = await repo.issueClientCharge(draft.charge.id);
      expect(issued.charge.subtotalServicesCents).toBe(250000);
      expect(issued.operations[0].billingObservationsSnapshot).toBe("Lote 123\nContrato complementar ABC-456");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(issued.charge.excelFilePath!);
      const sheet = workbook.getWorksheet("Operacoes");
      expect(sheet?.getRow(2).getCell(10).value).toBe("MCU-103265");
      expect(sheet?.getRow(2).getCell(11).value).toBe("Lote 123\nContrato complementar ABC-456");
      expect(sheet?.getRow(2).getCell(9).value).toBe(2500);
      if (process.env.CAFE_QA_REPORT_DIR) {
        mkdirSync(process.env.CAFE_QA_REPORT_DIR, { recursive: true });
        copyFileSync(issued.charge.pdfFilePath!, join(process.env.CAFE_QA_REPORT_DIR, "cobranca-exemplo.pdf"));
        copyFileSync(issued.charge.excelFilePath!, join(process.env.CAFE_QA_REPORT_DIR, "cobranca-exemplo.xlsx"));
        copyFileSync(issued.charge.imageFilePath!, join(process.env.CAFE_QA_REPORT_DIR, `cobranca-exemplo${extname(issued.charge.imageFilePath!)}`));
      }
    } finally { db.close(); }
  });
  it("suggests periods including leap-year monthly and biweekly windows", async () => {
    const { repo, db, partnerId } = await setup();
    expect(repo.suggestChargePeriods({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodicity: "MONTHLY", referenceDate: "2024-02-20" })[0]).toMatchObject({ periodStart: "2024-02-01", periodEnd: "2024-02-29" });
    expect(repo.suggestChargePeriods({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodicity: "BIWEEKLY", referenceDate: "2026-07-20" })[0]).toMatchObject({ periodStart: "2026-07-16", periodEnd: "2026-07-31" });
    db.close();
  });

  it("reserves operations, applies credit, issues documents and receives partial payment", async () => {
    const { repo, db, partnerId, productId } = await setup();
    createConfirmedOperation(repo, partnerId, productId, "7001", "10.5");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    expect(eligible).toHaveLength(1);
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
    expect(draft.charge.subtotalServicesCents).toBe(5250);
    expect(repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" })).toHaveLength(0);
    const credit = repo.createAdvance({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, clientChargeId: null, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amountCents: 2000, entryDate: "2026-07-10", description: "Adiantamento", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: 2000 });
    const withCredit = repo.applyCredit({ ledgerEntryId: credit.id, clientChargeId: draft.charge.id, amountCents: 1500 });
    expect(withCredit.charge.finalAmountCents).toBe(3750);
    const issued = await repo.issueClientCharge(draft.charge.id);
    expect(issued.charge.chargeNumber).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS total FROM document_sequences WHERE document_type = 'CLIENT_CHARGE'").get()).toEqual({ total: 0 });
    expect(repo.listLedgerEntries({ organizationId: villaId, clientPartnerId: partnerId }).find((entry) => entry.entryType === "SERVICE_CHARGE")?.description).toBe("Cobranca 01/07/2026 a 31/07/2026");
    expect(issued.charge.pdfFilePath && existsSync(issued.charge.pdfFilePath)).toBe(true);
    expect(issued.charge.excelFilePath && existsSync(issued.charge.excelFilePath)).toBe(true);
    expect(issued.charge.imageFilePath && existsSync(issued.charge.imageFilePath)).toBe(true);
    const payment = repo.createClientPayment({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, paymentDate: "2026-08-01", amountCents: 1000, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
    const paid = repo.allocatePayment({ clientPaymentId: payment.id, clientChargeId: issued.charge.id, amountCents: 1000 });
    expect(paid.charge.status).toBe("PARTIALLY_PAID");
    expect(paid.charge.openAmountCents).toBe(2750);
    db.close();
  });

  it("deleteClientCharge remove a cobranca de vez, libera a operacao, estorna o credito usado e apaga os arquivos gerados", async () => {
    const { repo, db, partnerId, productId } = await setup();
    createConfirmedOperation(repo, partnerId, productId, "7002", "10.5");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
    const operationId = eligible[0].id;
    const credit = repo.createAdvance({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, clientChargeId: null, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amountCents: 2000, entryDate: "2026-07-10", description: "Adiantamento", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: 2000 });
    repo.applyCredit({ ledgerEntryId: credit.id, clientChargeId: draft.charge.id, amountCents: 1500 });
    const issued = await repo.issueClientCharge(draft.charge.id);
    const pdfPath = issued.charge.pdfFilePath as string;
    const excelPath = issued.charge.excelFilePath as string;
    const imagePath = issued.charge.imageFilePath as string;
    expect(existsSync(pdfPath)).toBe(true);

    repo.deleteClientCharge(issued.charge.id);

    expect(() => repo.getClientCharge(issued.charge.id)).toThrow();
    const releasedOperation = repo.listOperations({ organizationId: villaId }).find((item) => item.id === operationId);
    if (!releasedOperation) throw new Error("Operacao nao encontrada apos exclusao da cobranca.");
    expect(releasedOperation.billingStatus).toBe("UNBILLED");
    expect(releasedOperation.clientChargeId).toBeNull();
    const refreshedCredit = repo.listLedgerEntries({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId }).find((entry) => entry.id === credit.id);
    expect(refreshedCredit?.availableAmountCents).toBe(2000);
    expect(existsSync(pdfPath)).toBe(false);
    expect(existsSync(excelPath)).toBe(false);
    expect(existsSync(imagePath)).toBe(false);
    db.close();
  });

  it("deleteClientCharge bloqueia cobranca com pagamento registrado -- so' cancelClientCharge preserva o rastro nesse caso", async () => {
    const { repo, db, partnerId, productId } = await setup();
    createConfirmedOperation(repo, partnerId, productId, "7003", "10.5");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });
    const issued = await repo.issueClientCharge(draft.charge.id);
    const payment = repo.createClientPayment({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, paymentDate: "2026-08-01", amountCents: 1000, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
    repo.allocatePayment({ clientPaymentId: payment.id, clientChargeId: issued.charge.id, amountCents: 1000 });
    expect(() => repo.deleteClientCharge(issued.charge.id)).toThrow(/pagamento registrado/);
    db.close();
  });

  it("applies surcharge ledger entries to increase a client charge", async () => {
    const { repo, db, partnerId, productId } = await setup();
    createConfirmedOperation(repo, partnerId, productId, "7002", "10.5");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });

    const surcharge = repo.createLedgerEntry({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, clientChargeId: null, entryType: "SURCHARGE", effect: "INCREASE_RECEIVABLE", amountCents: 1200, entryDate: "2026-07-20", description: "Acrescimo comercial", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: 1200, status: "CONFIRMED" });
    const withSurcharge = repo.applyCredit({ ledgerEntryId: surcharge.id, clientChargeId: draft.charge.id, amountCents: 1200 });

    expect(withSurcharge.charge.subtotalServicesCents).toBe(5250);
    expect(withSurcharge.charge.finalAmountCents).toBe(6450);
    expect(withSurcharge.adjustments).toEqual(expect.arrayContaining([
      expect.objectContaining({ adjustmentType: "SURCHARGE", effect: "INCREASE_RECEIVABLE", amountCents: 1200 })
    ]));
    expect(repo.listLedgerEntries({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId }).find((entry) => entry.id === surcharge.id)?.availableAmountCents).toBe(0);
    db.close();
  });

  it("listLedgerEntries filtra por periodo (entry_date)", async () => {
    const { repo, db, partnerId } = await setup();
    repo.createAdvance({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, clientChargeId: null, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amountCents: 1000, entryDate: "2026-06-15", description: "Adiantamento junho", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: 1000 });
    repo.createAdvance({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, clientChargeId: null, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amountCents: 2000, entryDate: "2026-07-15", description: "Adiantamento julho", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: 2000 });

    const all = repo.listLedgerEntries({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId });
    expect(all).toHaveLength(2);

    const julyOnly = repo.listLedgerEntries({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    expect(julyOnly).toHaveLength(1);
    expect(julyOnly[0].description).toBe("Adiantamento julho");
    db.close();
  });

  it("adiantamento criado como DRAFT (checkbox desmarcado) nao entra no saldo ate ser confirmado", async () => {
    const { repo, db, partnerId } = await setup();
    const draft = repo.createAdvance({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, clientChargeId: null, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amountCents: 5000, entryDate: "2026-07-10", description: "Emprestimo", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: 5000, status: "DRAFT" });
    expect(draft.status).toBe("DRAFT");

    const confirmed = repo.createAdvance({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, clientChargeId: null, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amountCents: 3000, entryDate: "2026-07-10", description: "Adiantamento imediato", referenceNumber: null, notes: null, attachmentPath: null, availableAmountCents: 3000 });
    expect(confirmed.status).toBe("CONFIRMED");

    const entries = repo.listLedgerEntries({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId });
    const confirmedBalance = entries.filter((entry) => entry.status === "CONFIRMED").reduce((sum, entry) => sum + (entry.effect === "INCREASE_RECEIVABLE" ? entry.amountCents : -entry.amountCents), 0);
    // So' o adiantamento confirmado abate o saldo -- o DRAFT fica registrado mas fora da conta ate ser confirmado depois.
    expect(confirmedBalance).toBe(-3000);
    db.close();
  });

  it("summarizes internal/external sacks and value per client, zeroing clients without operations in the period", async () => {
    const { repo, db, partnerId, productId } = await setup();
    const otherPartner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Sem Operacao", notes: null, roles: ["CLIENT"], isActive: true });
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partnerId, ownLegalEntityId: null, productId, operationScope: "INTERNAL", rateType: "PER_SACK", rateValueCents: 300, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    createConfirmedOperation(repo, partnerId, productId, "9001", "10.5", "EXTERNAL");
    createConfirmedOperation(repo, partnerId, productId, "9002", "4.5", "INTERNAL");

    const summary = repo.getPartnerRateSummary({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const withOperations = summary.find((row) => row.partnerId === partnerId);
    const withoutOperations = summary.find((row) => row.partnerId === otherPartner.id);
    expect(withOperations).toMatchObject({ externalSacks: "10.5", internalSacks: "4.5", externalAmountCents: 5250, internalAmountCents: 1350, totalAmountCents: 6600, operationCount: 2 });
    expect(withoutOperations).toMatchObject({ externalSacks: "0", internalSacks: "0", totalAmountCents: 0, operationCount: 0 });

    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: eligible.map((item) => item.id) });

    const afterBilling = repo.getPartnerRateSummary({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    expect(afterBilling.find((row) => row.partnerId === partnerId)?.operationCount).toBe(0);
    const includingBilled = repo.getPartnerRateSummary({ organizationId: villaId, ownLegalEntityId, periodStart: "2026-07-01", periodEnd: "2026-07-31", includeAlreadyBilled: true });
    expect(includingBilled.find((row) => row.partnerId === partnerId)?.operationCount).toBe(2);
    db.close();
  });

  it("lists client operations across legal entities for billing diagnostics", async () => {
    const { repo, db, partnerId, productId } = await setup();
    createConfirmedOperation(repo, partnerId, productId, "9101", "310", "EXTERNAL");
    const operations = repo.listOperations({ organizationId: villaId, responsiblePartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31", status: "all", billingStatus: "all" });
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      responsiblePartnerId: partnerId,
      quantitySacks: "310",
      appliedRateValueCents: 500,
      serviceAmountCents: 155000,
      billingStatus: "UNBILLED"
    });
    db.close();
  });

  it("does not apply a future rate to older unbilled operations", async () => {
    const { repo, db, productId } = await setup();
    const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Regra Posterior", notes: null, roles: ["CLIENT"], isActive: true });
    createConfirmedOperation(repo, partner.id, productId, "9201", "330", "EXTERNAL");
    expect(repo.listOperations({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partner.id, status: "all", billingStatus: "all" })[0].serviceAmountCents).toBe(0);

    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-23", effectiveTo: null, priority: 10, notes: null, isActive: true });
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partner.id, periodStart: "2026-07-01", periodEnd: "2026-07-31" });

    expect(eligible).toHaveLength(0);
    expect(repo.listOperations({ responsiblePartnerId: partner.id })[0].serviceAmountCents).toBe(0);
    db.close();
  });

  it("keeps Villa MG and Villa ES billing and sacks indicators independent", async () => {
    const { repo, db, partnerId, productId } = await setup();
    createConfirmedOperation(repo, partnerId, productId, "9301", "100", "EXTERNAL", ownLegalEntityId);
    createConfirmedOperation(repo, partnerId, productId, "9302", "250", "EXTERNAL", villaEsLegalEntityId);

    const mgSummary = repo.getBillingSummary({ organizationId: villaId, ownLegalEntityId });
    const esSummary = repo.getBillingSummary({ organizationId: villaId, ownLegalEntityId: villaEsLegalEntityId });
    expect(mgSummary.unbilledOperations).toBe(1);
    expect(mgSummary.unbilledSacks).toBe("100");
    expect(mgSummary.openCents).toBe(50000);
    expect(esSummary.unbilledOperations).toBe(1);
    expect(esSummary.unbilledSacks).toBe("250");
    expect(esSummary.openCents).toBe(125000);

    const mgMonthly = repo.getMonthlyOperationTotals(villaId, 2026, ownLegalEntityId);
    const esMonthly = repo.getMonthlyOperationTotals(villaId, 2026, villaEsLegalEntityId);
    expect(mgMonthly[6]).toMatchObject({ sacksDecimal: "100", amountCents: 50000, operationCount: 1 });
    expect(esMonthly[6]).toMatchObject({ sacksDecimal: "250", amountCents: 125000, operationCount: 1 });
    db.close();
  });

  it("keeps Grao & Grao MG and SP billing and sacks indicators independent", async () => {
    const { repo, db, partnerId, productId } = await setup(graoId, graoMgLegalEntityId);
    createConfirmedOperation(repo, partnerId, productId, "9401", "80", "EXTERNAL", graoMgLegalEntityId, graoId);
    createConfirmedOperation(repo, partnerId, productId, "9402", "175", "EXTERNAL", graoSpLegalEntityId, graoId);

    const mgSummary = repo.getBillingSummary({ organizationId: graoId, ownLegalEntityId: graoMgLegalEntityId });
    const spSummary = repo.getBillingSummary({ organizationId: graoId, ownLegalEntityId: graoSpLegalEntityId });
    expect(mgSummary.unbilledOperations).toBe(1);
    expect(mgSummary.unbilledSacks).toBe("80");
    expect(mgSummary.openCents).toBe(40000);
    expect(spSummary.unbilledOperations).toBe(1);
    expect(spSummary.unbilledSacks).toBe("175");
    expect(spSummary.openCents).toBe(87500);

    const mgDocs = repo.listFiscalDocuments({ organizationId: graoId, ownLegalEntityId: graoMgLegalEntityId });
    const spDocs = repo.listFiscalDocuments({ organizationId: graoId, ownLegalEntityId: graoSpLegalEntityId });
    expect(mgDocs.map((doc) => doc.documentNumber)).toEqual(["9401"]);
    expect(spDocs.map((doc) => doc.documentNumber)).toEqual(["9402"]);
    db.close();
  });

  it("refreshes unbilled operation service values when a rate rule is created after the note", async () => {
    const { repo, db, productId } = await setup();
    const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Diamante", notes: null, roles: ["CLIENT"], isActive: true });
    createConfirmedOperation(repo, partner.id, productId, "9102", "310", "EXTERNAL");
    expect(repo.listOperations({ organizationId: villaId, responsiblePartnerId: partner.id })[0].serviceAmountCents).toBe(0);
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: partner.id, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partner.id, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    expect(eligible).toHaveLength(1);
    expect(eligible[0].appliedRateValueCents).toBe(500);
    expect(eligible[0].serviceAmountCents).toBe(155000);
    const summary = repo.getBillingSummary(villaId);
    expect(summary.openCents).toBe(155000);
    expect(summary.unbilledOperations).toBe(1);
    expect(summary.unbilledSacks).toBe("310");
    db.close();
  });

  it("keeps paid notes out of the open total and exports them in a separate worksheet", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      const filters = { organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" };
      createConfirmedOperation(repo, partnerId, productId, "6769", "500");
      const paidOperation = repo.findEligibleOperations(filters)[0];
      const paidDraft = repo.createClientChargeDraft({ ...filters, billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: [paidOperation.id] });
      const paidCharge = await repo.issueClientCharge(paidDraft.charge.id);
      const payment = repo.createClientPayment({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, paymentDate: "2026-08-01", amountCents: paidCharge.charge.finalAmountCents, paymentMethod: "PIX", bankAccountDescription: null, transactionReference: null, notes: null, attachmentPath: null });
      repo.allocatePayment({ clientPaymentId: payment.id, clientChargeId: paidCharge.charge.id, amountCents: paidCharge.charge.finalAmountCents });

      createConfirmedOperation(repo, partnerId, productId, "6823", "200");
      const openOperation = repo.findEligibleOperations(filters)[0];
      const openDraft = repo.createClientChargeDraft({ ...filters, billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: [openOperation.id] });
      const adjustedDraft = repo.addChargeAdjustment({
        clientChargeId: openDraft.charge.id,
        ledgerEntryId: null,
        adjustmentType: "DISCOUNT",
        effect: "REDUCE_RECEIVABLE",
        description: "Desconto",
        reason: "Ajuste de qualidade informado pelo cliente",
        amountCents: 5000,
        sortOrder: 20
      });
      expect(adjustedDraft.adjustments[0].reason).toBe("Ajuste de qualidade informado pelo cliente");
      const openCharge = await repo.issueClientCharge(openDraft.charge.id);
      expect(openCharge.charge.openAmountCents).toBe(95000);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(openCharge.charge.excelFilePath!);
      const paidNotes = workbook.getWorksheet("Notas pagas");
      expect(paidNotes?.getRow(2).getCell(2).value).toBe("6769");
      expect(paidNotes?.getRow(2).getCell(3).value).toBe("Cliente Cobranca");
      expect(paidNotes?.getRow(2).getCell(4).value).toBe(2500);
      if (process.env.CAFE_QA_REPORT_DIR) {
        mkdirSync(process.env.CAFE_QA_REPORT_DIR, { recursive: true });
        copyFileSync(openCharge.charge.pdfFilePath!, join(process.env.CAFE_QA_REPORT_DIR, "cobranca-com-notas-pagas.pdf"));
      }
    } finally { db.close(); }
  });

  it("orders billing notes by date and then by ascending invoice number", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      createConfirmedOperation(repo, partnerId, productId, "6610", "100", "EXTERNAL", ownLegalEntityId, villaId, "2026-07-01");
      createConfirmedOperation(repo, partnerId, productId, "6609", "100", "EXTERNAL", ownLegalEntityId, villaId, "2026-07-01");
      createConfirmedOperation(repo, partnerId, productId, "6645", "100", "EXTERNAL", ownLegalEntityId, villaId, "2026-07-02");
      createConfirmedOperation(repo, partnerId, productId, "6644", "100", "EXTERNAL", ownLegalEntityId, villaId, "2026-07-02");
      const filters = { organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" };
      const operations = repo.findEligibleOperations(filters);
      const numbers = operations.map((operation) => repo.getFiscalDocument(operation.fiscalDocumentId).document.documentNumber);
      expect(numbers).toEqual(["6609", "6610", "6644", "6645"]);

      const draft = repo.createClientChargeDraft({ ...filters, billingProfileId: null, periodicity: "MONTHLY", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: operations.map((operation) => operation.id) });
      expect(draft.operations.map((operation) => operation.fiscalDocumentNumberSnapshot)).toEqual(["6609", "6610", "6644", "6645"]);
    } finally { db.close(); }
  });

  it("uses the billed client as the destination of a triangulated third-party invoice", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      const supplier = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Corretor do emitente", notes: null, roles: ["SUPPLIER"], isActive: true });
      createConfirmedOperation(repo, partnerId, productId, "TRI-428", "500");
      const operation = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" })[0];
      db.prepare(`UPDATE fiscal_documents SET secondary_responsible_partner_id = ?, secondary_operation_type = 'PURCHASE',
        fiscal_snapshot_json = ? WHERE id = ?`).run(supplier.id, JSON.stringify({
          issuer: { legalName: "MUNIZ COMERCIO DE GRAOS LTDA", cnpjCpf: "11111111000111" },
          recipient: { legalName: "JH CAFE LTDA", cnpjCpf: "22222222000122" }
        }), operation.fiscalDocumentId);

      const report = getPartnerPeriodReport(repo, {
        organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId,
        periodStart: "2026-07-01", periodEnd: "2026-07-31", includeAlreadyBilled: true
      });
      expect(report.rows[0].issuer).toBe("MUNIZ COMERCIO DE GRAOS LTDA");
      expect(report.rows[0].destination).toBe("Cliente Cobranca");

      const draft = repo.createClientChargeDraft({
        organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null,
        periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31",
        dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: [operation.id]
      });

      expect(draft.operations[0].issuerNameSnapshot).toBe("MUNIZ COMERCIO DE GRAOS LTDA");
      expect(draft.operations[0].destinationNameSnapshot).toBe("Cliente Cobranca");
    } finally { db.close(); }
  });

  it("refreshes a stale unbilled note from the current value of its linked rule while searching charges", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      createConfirmedOperation(repo, partnerId, productId, "STALE-RATE", "500");
      const operationId = (db.prepare(`SELECT o.id FROM operations o JOIN fiscal_documents f ON f.id = o.fiscal_document_id
        WHERE f.document_number = 'STALE-RATE'`).get() as { id: string }).id;
      const rule = repo.listServiceRateRules({ businessPartnerId: partnerId })[0];
      db.prepare("UPDATE service_rate_rules SET rate_value_cents = 300 WHERE id = ?").run(rule.id);
      const before = db.prepare("SELECT applied_rate_value_cents FROM operations WHERE id = ?").get(operationId) as { applied_rate_value_cents: number };
      expect(before.applied_rate_value_cents).toBe(500);
      const found = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
      expect(found).toHaveLength(1);
      expect(found[0].appliedRateValueCents).toBe(300);
      expect(found[0].serviceAmountCents).toBe(150000);
    } finally { db.close(); }
  });

  it("releases reserved operations when draft is cancelled", async () => {
    const { repo, db, partnerId, productId } = await setup();
    createConfirmedOperation(repo, partnerId, productId, "8001", "2");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "CUSTOM", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: null, notes: null, internalNotes: null, operationIds: [eligible[0].id] });
    repo.cancelClientCharge(draft.charge.id, "Rascunho incorreto");
    expect(repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" })).toHaveLength(1);
    db.close();
  });

  it("subtracts manual returns in sacks or kilograms and recalculates an open charge", async () => {
    const { repo, db, partnerId, productId } = await setup();
    try {
      createConfirmedOperation(repo, partnerId, productId, "RETURN-500", "500");
      const operation = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-07-01", periodEnd: "2026-07-31" })[0];
      let detail = repo.addFiscalDocumentReturn({ fiscalDocumentId: operation.fiscalDocumentId, returnDate: "2026-07-17", inputUnit: "SACKS", inputQuantity: "100", reason: "Cafe recusado" });
      expect(detail.operations.find((item) => item.id === operation.id)?.quantitySacks).toBe("400");
      expect(detail.operations.find((item) => item.id === operation.id)?.serviceAmountCents).toBe(200000);
      const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: [operation.id] });
      detail = repo.addFiscalDocumentReturn({ fiscalDocumentId: operation.fiscalDocumentId, returnDate: "2026-07-18", inputUnit: "KG", inputQuantity: "6000", reason: "Segunda devolucao" });
      expect(detail.operations[0].quantitySacks).toBe("300");
      expect(repo.getClientCharge(draft.charge.id).charge.finalAmountCents).toBe(150000);
      const firstReturn = detail.returns[0];
      detail = repo.deleteFiscalDocumentReturn(firstReturn.id);
      expect(detail.operations[0].quantitySacks).toBe("400");
      expect(repo.getClientCharge(draft.charge.id).charge.finalAmountCents).toBe(200000);
    } finally { db.close(); }
  });

});

function createConfirmedOperation(repo: AppRepository, partnerId: string, productId: string, documentNumber: string, sacks: string, operationScope: "INTERNAL" | "EXTERNAL" = "EXTERNAL", targetOwnLegalEntityId = ownLegalEntityId, organizationId = villaId, operationDate = "2026-07-16"): void {
  const doc = repo.createFiscalDocument({ organizationId, ownLegalEntityId: targetOwnLegalEntityId, responsiblePartnerId: partnerId, partnerLegalEntityId: null, accessKey: null, documentNumber, series: "1", issueDate: operationDate, totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
  const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId, description: "Cafe", quantity: sacks, unit: "SACK", unitPriceDecimal: "1000.000", totalAmountCents: 100000, sacksQuantity: sacks });
  repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId: targetOwnLegalEntityId, responsiblePartnerId: partnerId, productId, operationType: "SALE", operationScope, operationDate, quantitySacks: sacks, manualRateValueCents: null, manualOverrideReason: null, notes: null });
  repo.confirmFiscalDocument(doc.document.id);
}
