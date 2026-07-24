import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const graoId = "22222222-2222-4222-8222-222222222222";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase> } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-payable-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Villa", appVariant: "villa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: false, allowLegalEntitySwitch: true, completedSetup: true });
  return { repo, db };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("accounts payable", () => {
  it("creates categories, cost centers and financial accounts with scope validation", () => {
    const { repo, db } = setup();
    const categories = repo.listExpenseCategories(villaId);
    expect(categories.map((item) => item.name)).toContain("Aluguel");
    const center = repo.createCostCenter({ organizationId: villaId, ownLegalEntityId, locationId: null, parentCostCenterId: null, name: "Escritorio Manhuacu", code: "MANHUACU", description: null, isActive: true });
    expect(center.isActive).toBe(true);
    const account = repo.createFinancialAccount({ organizationId: villaId, ownLegalEntityId, name: "Caixa interno", accountType: "CASH", bankName: null, branch: null, accountIdentifierMasked: null, pixKeyDescription: null, notes: null, isActive: true });
    expect(account.accountType).toBe("CASH");
    db.close();
  });

  it("creates, confirms, allocates and pays an account payable", () => {
    const { repo, db } = setup();
    const category = repo.listExpenseCategories(villaId)[0];
    const center = repo.createCostCenter({ organizationId: villaId, ownLegalEntityId, locationId: null, parentCostCenterId: null, name: "Administrativo", code: null, description: null, isActive: true });
    const draft = repo.createAccountPayableDraft({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: null, supplierLegalEntityId: null, payeeNameSnapshot: "Imobiliaria", payeeTaxIdSnapshot: null, categoryId: category.id, defaultCostCenterId: center.id, defaultLocationId: null, source: "MANUAL", description: "Aluguel", documentType: "BOLETO", documentNumber: "A-1", competenceDate: "2026-08-01", issueDate: null, dueDate: "2026-08-10", originalAmountCents: 100000, discountCents: 5000, interestCents: 1000, penaltyCents: 0, otherAdditionsCents: 0, amountStatus: "CONFIRMED", notes: null, internalNotes: null });
    expect(draft.payable.finalAmountCents).toBe(96000);
    repo.addPayableAllocation({ accountPayableId: draft.payable.id, costCenterId: center.id, locationId: null, allocationAmountCents: 96000, allocationBasisPoints: 10000, description: "Administrativo" });
    const confirmed = repo.confirmAccountPayable(draft.payable.id);
    expect(confirmed.payable.status).toBe("OPEN");
    const payment = repo.createPayablePayment({ organizationId: villaId, ownLegalEntityId, financialAccountId: null, paymentDate: "2026-07-09", amountCents: 40000, paymentMethod: "PIX", transactionReference: null, payeeNameSnapshot: "Imobiliaria", notes: null, attachmentPath: null, attachmentHash: null });
    const partial = repo.allocatePayablePayment({ payablePaymentId: payment.id, accountPayableId: draft.payable.id, amountCents: 40000 });
    expect(partial.payable.status).toBe("PARTIALLY_PAID");
    expect(partial.payable.openAmountCents).toBe(56000);
    db.close();
  });

  it("creates an account payable with a shared supplier from another organization", () => {
    const { repo, db } = setup();
    const category = repo.listExpenseCategories(villaId)[0];
    const supplier = repo.createBusinessPartner({ organizationId: graoId, displayName: "Fornecedor Compartilhado", notes: null, roles: ["SUPPLIER"], isActive: true });
    const draft = repo.createAccountPayableDraft({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: supplier.id, supplierLegalEntityId: null, payeeNameSnapshot: supplier.displayName, payeeTaxIdSnapshot: null, categoryId: category.id, defaultCostCenterId: null, defaultLocationId: null, source: "MANUAL", description: "Servico compartilhado", documentType: "BOLETO", documentNumber: "SUP-1", competenceDate: "2026-08-01", issueDate: null, dueDate: "2026-08-10", originalAmountCents: 45000, discountCents: 0, interestCents: 0, penaltyCents: 0, otherAdditionsCents: 0, amountStatus: "CONFIRMED", notes: null, internalNotes: null });
    expect(draft.payable.supplierPartnerId).toBe(supplier.id);
    db.close();
  });

  it("generates recurring payables and exact installments", () => {
    const { repo, db } = setup();
    const category = repo.listExpenseCategories(villaId)[0];
    const template = repo.createPayableRecurringTemplate({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: null, supplierLegalEntityId: null, payeeNameSnapshot: "Energia", categoryId: category.id, defaultCostCenterId: null, defaultLocationId: null, description: "Energia mensal", amountMode: "VARIABLE", fixedAmountCents: null, estimatedAmountCents: 75000, frequency: "MONTHLY", dueDay: 31, generationLeadDays: 7, startDate: "2026-01-01", endDate: null, autoGenerateOnOpen: false, isActive: true });
    const preview = repo.previewPayableRecurringGeneration(template.id, 2);
    expect(preview[1].dueDate).toBe("2026-02-28");
    const generated = repo.generatePayableRecurringPeriod(template.id, 2);
    expect(generated).toHaveLength(2);
    expect(repo.generatePayableRecurringPeriod(template.id, 2)).toHaveLength(2);
    const installment = repo.createPayableInstallmentGroup({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: null, supplierLegalEntityId: null, payeeNameSnapshot: "Fornecedor", categoryId: category.id, defaultCostCenterId: null, defaultLocationId: null, description: "Compra parcelada", totalAmountCents: 10000, installmentCount: 3, firstDueDate: "2026-07-31", intervalType: "MONTHLY" });
    expect(installment.payables.map((item) => item.originalAmountCents)).toEqual([3333, 3333, 3334]);
    db.close();
  });

  it("copies payable and payment attachments, rejects invalid files and keeps internal copy", () => {
    const { repo, db } = setup();
    const category = repo.listExpenseCategories(villaId)[0];
    const sourcePdf = join(tempDirs[0], "boleto.pdf");
    const invalid = join(tempDirs[0], "script.exe");
    writeFileSync(sourcePdf, "%PDF-1.4 teste");
    writeFileSync(invalid, "nope");
    const detail = repo.createAccountPayableDraft({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: null, supplierLegalEntityId: null, payeeNameSnapshot: "Fornecedor", payeeTaxIdSnapshot: null, categoryId: category.id, defaultCostCenterId: null, defaultLocationId: null, source: "MANUAL", description: "Boleto com anexo", documentType: "BOLETO", documentNumber: "B-1", competenceDate: "2026-08-01", issueDate: null, dueDate: "2026-08-20", originalAmountCents: 12000, discountCents: 0, interestCents: 0, penaltyCents: 0, otherAdditionsCents: 0, amountStatus: "CONFIRMED", notes: null, internalNotes: null });
    const attachment = repo.addPayableAttachment({ sourcePath: sourcePdf, accountPayableId: detail.payable.id, attachmentType: "BILL", description: "Boleto" });
    expect(attachment.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(attachment.storedFilePath)).toBe(true);
    unlinkSync(sourcePdf);
    expect(existsSync(attachment.storedFilePath)).toBe(true);
    expect(() => repo.addPayableAttachment({ sourcePath: invalid, accountPayableId: detail.payable.id, attachmentType: "OTHER", description: null })).toThrow(/Formato/);
    repo.confirmAccountPayable(detail.payable.id);
    const payment = repo.createPayablePayment({ organizationId: villaId, ownLegalEntityId, financialAccountId: null, paymentDate: "2026-08-15", amountCents: 12000, paymentMethod: "PIX", transactionReference: null, payeeNameSnapshot: "Fornecedor", notes: null, attachmentPath: null, attachmentHash: null });
    repo.allocatePayablePayment({ payablePaymentId: payment.id, accountPayableId: detail.payable.id, amountCents: 12000 });
    const proof = join(tempDirs[0], "comprovante.png");
    writeFileSync(proof, Buffer.from([137, 80, 78, 71]));
    const paymentAttachment = repo.addPayablePaymentAttachment({ sourcePath: proof, payablePaymentId: payment.id, attachmentType: "RECEIPT", description: "Comprovante" });
    expect(repo.listPayablePaymentAttachments(payment.id)).toHaveLength(1);
    expect(paymentAttachment.attachmentKind).toBe("PAYMENT_PROOF");
    expect(() => repo.removePayableAttachment(attachment.id, null)).toThrow(/motivo/);
    repo.removePayableAttachment(attachment.id, "Documento substituido");
    expect(repo.listPayableAttachments(detail.payable.id)).toHaveLength(0);
    db.close();
  });

  it("generates financial PDF and Excel reports with persisted history", async () => {
    const { repo, db } = setup();
    const category = repo.listExpenseCategories(villaId)[0];
    const detail = repo.createAccountPayableDraft({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: null, supplierLegalEntityId: null, payeeNameSnapshot: "Contabilidade", payeeTaxIdSnapshot: null, categoryId: category.id, defaultCostCenterId: null, defaultLocationId: null, source: "MANUAL", description: "Honorarios contabeis", documentType: null, documentNumber: null, competenceDate: "2026-08-01", issueDate: null, dueDate: "2026-08-25", originalAmountCents: 30000, discountCents: 0, interestCents: 0, penaltyCents: 0, otherAdditionsCents: 0, amountStatus: "CONFIRMED", notes: null, internalNotes: null });
    repo.confirmAccountPayable(detail.payable.id);
    const filters = { organizationId: villaId, ownLegalEntityId, dateStart: "2026-08-01", dateEnd: "2026-08-31", categoryId: null, locationId: null, costCenterId: null, supplierPartnerId: null, status: null };
    const preview = repo.previewFinancialReport(filters);
    expect(preview.recordCount).toBeGreaterThanOrEqual(1);
    const pdf = await repo.generateFinancialReport({ reportType: "ACCOUNTS_PAYABLE", format: "PDF", filters });
    const excel = await repo.generateFinancialReport({ reportType: "ACCOUNTS_PAYABLE", format: "EXCEL", filters });
    expect(existsSync(pdf.storedFilePath)).toBe(true);
    expect(existsSync(excel.storedFilePath)).toBe(true);
    expect(pdf.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repo.listFinancialReportGenerations({ organizationId: villaId, ownLegalEntityId })).toHaveLength(2);
    db.close();
  });
});
