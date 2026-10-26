import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
afterEach(() => tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("transfer reconciliations", () => {
  it("creates a reconciliation from a manual amount and reduces its balance with later payments", async () => {
    const userData = mkdtempSync(join(tmpdir(), "operacoes-transfer-manual-"));
    tempDirs.push(userData);
    const dirs = resolveAppDirectories(userData);
    ensureAppDirectories(dirs);
    const db = initializeDatabase(dirs);
    const repo = new AppRepository(db, dirs);
    try {
      const organizationId = "11111111-1111-4111-8111-111111111111";
      const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
      repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: organizationId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
      const partner = await repo.createBusinessPartner({ organizationId, displayName: "Cliente Valor Manual", notes: null, roles: ["CLIENT"], isActive: true });

      const first = repo.saveTransferReconciliation({
        organizationId,
        clientPartnerId: partner.id,
        sourceMode: "MANUAL",
        manualSourceCents: 100_000_00,
        referenceDate: "2026-10-26",
        status: "COMPLETED",
        invoices: [],
        payments: [{ beneficiaryName: "Primeiro pagamento", amountCents: 30_000_00 }]
      });
      expect(first.reconciliation).toMatchObject({ sourceMode: "MANUAL", manualSourceCents: 100_000_00, totalSourceCents: 100_000_00, totalPaymentsCents: 30_000_00, balanceCents: 70_000_00 });
      expect(first.invoices).toHaveLength(0);

      const updated = repo.saveTransferReconciliation({
        id: first.reconciliation.id,
        organizationId,
        clientPartnerId: partner.id,
        counterpartyRole: "CLIENT",
        sourceMode: "MANUAL",
        manualSourceCents: 100_000_00,
        referenceDate: "2026-10-26",
        status: "COMPLETED",
        invoices: [],
        payments: [
          { id: first.payments[0].id, beneficiaryName: "Primeiro pagamento", amountCents: 30_000_00 },
          { beneficiaryName: "Segundo pagamento", amountCents: 25_000_00 }
        ]
      });
      expect(updated.reconciliation).toMatchObject({ totalSourceCents: 100_000_00, totalPaymentsCents: 55_000_00, balanceCents: 45_000_00 });
      expect(updated.payments).toHaveLength(2);
      expect(repo.listTransferReconciliationClientBalances(organizationId)[0]).toMatchObject({ creditCents: 45_000_00, netBalanceCents: 45_000_00 });
    } finally { db.close(); }
  });

  it("lists inbound purchase notes for suppliers and preserves the selected counterparty role", async () => {
    const userData = mkdtempSync(join(tmpdir(), "operacoes-transfer-supplier-"));
    tempDirs.push(userData);
    const dirs = resolveAppDirectories(userData);
    ensureAppDirectories(dirs);
    const db = initializeDatabase(dirs);
    const repo = new AppRepository(db, dirs);
    try {
      const organizationId = "11111111-1111-4111-8111-111111111111";
      const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
      repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: organizationId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
      const supplier = await repo.createBusinessPartner({ organizationId, displayName: "Fornecedor Repasse", notes: null, roles: ["CLIENT", "SUPPLIER"], isActive: true });
      const product = repo.listProducts({ organizationId })[0];
      const doc = repo.createFiscalDocument({ organizationId, ownLegalEntityId, responsiblePartnerId: supplier.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "7001", series: "1", issueDate: "2026-10-25", totalAmountCents: 90_000_00, hasPendingIssues: false, pendingNotes: null, notes: null });
      const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "Cafe comprado", quantity: "1", unit: "SACK", unitPriceDecimal: "90000.00", totalAmountCents: 90_000_00, sacksQuantity: "1" });
      repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: supplier.id, productId: product.id, operationType: "PURCHASE", operationScope: "EXTERNAL", operationDate: "2026-10-25", quantitySacks: "1", manualRateValueCents: null, manualOverrideReason: null, notes: null });
      repo.confirmFiscalDocument(doc.document.id);

      expect(repo.listTransferReconciliationInvoices({ organizationId, clientPartnerId: supplier.id })).toHaveLength(0);
      const inbound = repo.listTransferReconciliationInvoices({ organizationId, clientPartnerId: supplier.id, counterpartyRole: "SUPPLIER" });
      expect(inbound).toHaveLength(1);
      expect(inbound[0]).toMatchObject({ fiscalDocumentId: doc.document.id, documentNumber: "7001", availableCents: 90_000_00 });

      const saved = repo.saveTransferReconciliation({ organizationId, clientPartnerId: supplier.id, counterpartyRole: "SUPPLIER", referenceDate: "2026-10-26", status: "COMPLETED", invoices: [{ fiscalDocumentId: doc.document.id, sourceAmountCents: 50_000_00 }], payments: [{ beneficiaryName: "Fornecedor Repasse", amountCents: 50_000_00 }] });
      expect(saved.reconciliation.counterpartyRole).toBe("SUPPLIER");
      expect(repo.listTransferReconciliationInvoices({ organizationId, clientPartnerId: supplier.id, counterpartyRole: "SUPPLIER" })[0].availableCents).toBe(40_000_00);
      expect(repo.listTransferReconciliationClientBalances(organizationId)).toHaveLength(0);
    } finally { db.close(); }
  });

  it("reuses a note in partial reconciliations and never creates billing movements", async () => {
    const userData = mkdtempSync(join(tmpdir(), "operacoes-transfer-"));
    tempDirs.push(userData);
    const dirs = resolveAppDirectories(userData);
    ensureAppDirectories(dirs);
    const db = initializeDatabase(dirs);
    const repo = new AppRepository(db, dirs);
    try {
      const organizationId = "11111111-1111-4111-8111-111111111111";
      const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
      repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: organizationId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
      const partner = await repo.createBusinessPartner({ organizationId, displayName: "Cliente Repasse", notes: null, roles: ["CLIENT"], isActive: true });
      const product = repo.listProducts({ organizationId })[0];
      const doc = repo.createFiscalDocument({ organizationId, ownLegalEntityId, responsiblePartnerId: partner.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "9001", series: "1", issueDate: "2026-09-17", totalAmountCents: 500_000_00, hasPendingIssues: false, pendingNotes: null, notes: null });
      const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "Cafe", quantity: "1", unit: "SACK", unitPriceDecimal: "500000.00", totalAmountCents: 500_000_00, sacksQuantity: "1" });
      repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: partner.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-09-17", quantitySacks: "1", manualRateValueCents: null, manualOverrideReason: null, notes: null });
      repo.confirmFiscalDocument(doc.document.id);

      const first = repo.saveTransferReconciliation({ organizationId, clientPartnerId: partner.id, referenceDate: "2026-09-17", status: "COMPLETED", invoices: [{ fiscalDocumentId: doc.document.id, sourceAmountCents: 300_000_00 }], payments: [{ beneficiaryName: "Joao", amountCents: 280_000_00 }] });
      expect(first.reconciliation.balanceCents).toBe(20_000_00);
      expect(repo.listTransferReconciliationInvoices({ organizationId, clientPartnerId: partner.id })[0].availableCents).toBe(220_000_00);

      const second = repo.saveTransferReconciliation({ organizationId, clientPartnerId: partner.id, referenceDate: "2026-09-18", notes: "Parcela final", status: "COMPLETED", invoices: [{ fiscalDocumentId: doc.document.id, sourceAmountCents: 200_000_00 }], payments: [{ beneficiaryName: "Maria", amountCents: 210_000_00 }] });
      expect(repo.listTransferReconciliationClientBalances(organizationId)[0]).toMatchObject({ creditCents: 20_000_00, debitCents: 10_000_00, netBalanceCents: 10_000_00 });
      expect(repo.getTransferReconciliation(second.reconciliation.id).payments[0]).toMatchObject({ beneficiaryName: "Maria", amountCents: 210_000_00 });
      expect(repo.listTransferReconciliationInvoices({ organizationId, clientPartnerId: partner.id })[0].availableCents).toBe(20_000_00);
      const draft = repo.saveTransferReconciliation({ organizationId, clientPartnerId: partner.id, referenceDate: "2026-09-19", status: "DRAFT", invoices: [{ fiscalDocumentId: doc.document.id, sourceAmountCents: 10_000_00 }], payments: [] });
      expect(repo.listTransferReconciliationClientBalances(organizationId)[0]).toMatchObject({ netBalanceCents: 10_000_00, openReconciliations: 1 });
      repo.cancelTransferReconciliation(draft.reconciliation.id);
      expect(repo.listTransferReconciliationClientBalances(organizationId)[0]).toMatchObject({ netBalanceCents: 10_000_00, openReconciliations: 0 });
      expect(repo.listTransferReconciliationInvoices({ organizationId, clientPartnerId: partner.id })[0].availableCents).toBe(20_000_00);
      repo.deleteTransferReconciliation(second.reconciliation.id);
      expect(() => repo.getTransferReconciliation(second.reconciliation.id)).toThrow("Conferencia de repasse nao encontrada");
      expect(repo.listTransferReconciliationInvoices({ organizationId, clientPartnerId: partner.id })[0].availableCents).toBe(220_000_00);
      expect(db.prepare("SELECT COUNT(*) AS count FROM client_charges").get()).toMatchObject({ count: 0 });
      expect(db.prepare("SELECT COUNT(*) AS count FROM client_ledger_entries").get()).toMatchObject({ count: 0 });
      expect(db.prepare("SELECT COUNT(*) AS count FROM accounts_payable").get()).toMatchObject({ count: 0 });
    } finally { db.close(); }
  });
});
