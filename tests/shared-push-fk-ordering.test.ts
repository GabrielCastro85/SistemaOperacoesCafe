// Regressao pra classe de bug real encontrada em producao (2026-08-06): um
// metodo push*ToShared gravava um vinculo (deal_confirmation_fiscal_documents,
// client_charge_operations, account_payable_operations) usando o id local da
// nota/operacao sem garantir que ela ja existe no Supabase primeiro -- se a
// nota nunca tinha sido empurrada antes, a FK do servidor recusava o vinculo
// e a emissao/geracao inteira travava. Este arquivo prova que
// pushClientChargeToShared e pushAccountPayableToShared empurram a nota (e a
// operacao) ANTES do vinculo, mesmo quando ela nunca foi sincronizada antes.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import type { SharedRepository } from "../electron/main/services/sharedRepository";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

// Simula o Supabase de verdade rejeitando um vinculo cuja nota ainda nao foi
// gravada -- e' exatamente o "violates foreign key constraint" visto em
// producao. Se o codigo empurrar o vinculo ANTES da nota, o teste falha aqui
// (nao so' numa asercao de ordem depois).
class FkEnforcingFakeSharedRepository {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();
  pushOrder: Array<{ table: string; id: string }> = [];

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });

  async findOne(table: string, match: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows.find((row) => Object.entries(match).every(([key, value]) => String(row[key] ?? "") === String(value ?? ""))) ?? null;
  }

  async listAll(table: string): Promise<Array<Record<string, unknown>>> {
    return [...(this.tables.get(table)?.values() ?? [])];
  }

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (table === "client_charge_operations" || table === "account_payable_operations") {
      const operationId = String(row.operation_id);
      const operation = this.tables.get("operations")?.get(operationId);
      if (!operation) throw new Error(`violates foreign key constraint ${table}_operation_id_fkey`);
      const fiscalDocumentId = String(operation.fiscal_document_id);
      if (!this.tables.get("fiscal_documents")?.has(fiscalDocumentId)) {
        throw new Error(`violates foreign key constraint ${table}_operation_id_fkey (fiscal_documents ausente)`);
      }
    }
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    const stored = { ...row };
    this.tables.get(table)!.set(String(row.id), stored);
    this.pushOrder.push({ table, id: String(row.id) });
    return stored;
  }

  async upsertRows(table: string, rows: Array<Record<string, unknown>>): Promise<void> {
    for (const row of rows) await this.upsertRow(table, row);
  }

  async insertIfMissing(table: string, row: Record<string, unknown>): Promise<void> {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    const map = this.tables.get(table)!;
    if (!map.has(String(row.id))) {
      map.set(String(row.id), { ...row });
      this.pushOrder.push({ table, id: String(row.id) });
    }
  }

  async updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = this.tables.get(table)?.get(id) ?? { id };
    const updated = { ...existing, ...patch, id };
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    this.tables.get(table)!.set(id, updated);
    return updated;
  }

  async deleteWhere(table: string, match: Record<string, unknown>): Promise<void> {
    const rows = this.tables.get(table);
    if (!rows) return;
    const [key, value] = Object.entries(match)[0];
    for (const [id, row] of [...rows.entries()]) if (row[key] === value) rows.delete(id);
  }

  async pullChangesSince(): Promise<Array<Record<string, unknown>>> {
    return [];
  }
}

async function setup() {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-push-fk-order-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const cloud = new FkEnforcingFakeSharedRepository();
  const repo = new AppRepository(db, dirs, cloud as unknown as SharedRepository);
  repo.saveInstallationProfile({ installationName: "Villa", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  return { repo, db, cloud, product };
}

describe("push*ToShared empurra a nota vinculada antes do vinculo (nunca sincronizada antes)", () => {
  it("pushClientChargeToShared: nota nunca empurrada antes nao trava a cobranca", async () => {
    const { repo, db, cloud, product } = await setup();
    const client = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Cobranca", notes: null, roles: ["CLIENT"], isActive: true });
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: client.id, ownLegalEntityId: null, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: client.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "COB-FK-1", series: "1", issueDate: "2026-07-16", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "Cafe", quantity: "10.5", unit: "SACK", unitPriceDecimal: "1000.000", totalAmountCents: 100000, sacksQuantity: "10.5" });
    repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: client.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: "10.5", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.confirmFiscalDocument(doc.document.id);
    // A nota (fiscal_documents) NUNCA foi empurrada pro Supabase simulado --
    // esse e' exatamente o cenario real: importar/confirmar sem rede, so'
    // gerar a cobranca depois que a rede volta.
    expect(cloud.pushOrder.some((entry) => entry.table === "fiscal_documents")).toBe(false);

    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: client.id, periodStart: "2026-07-01", periodEnd: "2026-07-31" });
    const draft = repo.createClientChargeDraft({ organizationId: villaId, ownLegalEntityId, clientPartnerId: client.id, billingProfileId: null, periodicity: "MONTHLY", periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", notes: null, internalNotes: null, operationIds: eligible.map((op) => op.id) });

    // Antes da correcao, isso lancava "violates foreign key constraint" (a
    // FakeSharedRepository reproduz a mesma checagem que o Postgres real faz).
    await expect(repo.pushClientChargeToShared(draft.charge.id)).resolves.toBeUndefined();

    const fiscalDocIndex = cloud.pushOrder.findIndex((entry) => entry.table === "fiscal_documents" && entry.id === doc.document.id);
    const linkIndex = cloud.pushOrder.findIndex((entry) => entry.table === "client_charge_operations");
    expect(fiscalDocIndex).toBeGreaterThanOrEqual(0);
    expect(linkIndex).toBeGreaterThan(fiscalDocIndex);
    db.close();
  });

  it("pushAccountPayableToShared: nota nunca empurrada antes nao trava a conta a pagar", async () => {
    const { repo, db, cloud } = await setup();
    const supplier = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Fornecedor Compra", notes: null, roles: ["SUPPLIER"], isActive: true });
    const category = (await repo.listExpenseCategories(villaId))[0];
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: supplier.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 1, notes: null, isActive: true });

    const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: supplier.id, partnerLegalEntityId: null, operationType: "PURCHASE", accessKey: null, documentNumber: "ENT-FK-1", series: "1", issueDate: "2026-07-16", totalAmountCents: 500000, hasPendingIssues: false, pendingNotes: null, notes: null });
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: null, description: "Cafe", quantity: "1000", unit: "SACK", unitPriceDecimal: "5.00", totalAmountCents: 500000, sacksQuantity: "1000" });
    const operation = repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: supplier.id, productId: null, operationType: "PURCHASE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: "1000", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.confirmFiscalDocument(doc.document.id);
    expect(cloud.pushOrder.some((entry) => entry.table === "fiscal_documents")).toBe(false);

    const settled = await repo.generatePurchaseSettlement({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: supplier.id, operationIds: [operation.id], categoryId: category.id, dueDate: "2026-09-25", notes: "Acerto semanal" });

    await expect(repo.pushAccountPayableToShared(settled.payable.id)).resolves.toBeUndefined();

    const fiscalDocIndex = cloud.pushOrder.findIndex((entry) => entry.table === "fiscal_documents" && entry.id === doc.document.id);
    const linkIndex = cloud.pushOrder.findIndex((entry) => entry.table === "account_payable_operations");
    expect(fiscalDocIndex).toBeGreaterThanOrEqual(0);
    expect(linkIndex).toBeGreaterThan(fiscalDocIndex);
    db.close();
  });
});
