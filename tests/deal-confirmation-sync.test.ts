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

// Mesmo padrao de tests/user-sync.test.ts: um Map por tabela simulando o
// Supabase, compartilhado entre os dois PCs simulados. rpc() so' precisa
// cobrir create_business_partner aqui (o que createBusinessPartner usa por
// baixo) pra criar vendedor/comprador que a confirmacao referencia.
class FakeCloud implements Pick<SharedRepository, "upsertRow" | "pullChangesSince" | "checkConnectivity" | "rpc"> {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();
  // Espelha o indice unico parcial de
  // 0027_fiscal_document_claim_uniqueness.sql: so' UMA confirmacao ativa por
  // vez pode reivindicar uma nota fiscal. is_active nao existe nas linhas
  // locais (coluna so' de producao), entao aqui basta checar se ja existe
  // outra confirmacao dona daquela nota -- suficiente pra testar a corrida,
  // ja que nenhum teste deste arquivo cancela/exclui confirmacao.
  private fiscalDocumentClaimByConfirmation = new Map<string, string>();

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });
  attemptSessionRecovery = async () => true;

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (table === "deal_confirmation_fiscal_documents") {
      const fiscalDocumentId = String(row.fiscal_document_id);
      const dealConfirmationId = String(row.deal_confirmation_id);
      const claimedBy = this.fiscalDocumentClaimByConfirmation.get(fiscalDocumentId);
      if (claimedBy && claimedBy !== dealConfirmationId) {
        throw new Error(`duplicate key value violates unique constraint "deal_confirmation_fiscal_documents_active_claim_uq"`);
      }
      this.fiscalDocumentClaimByConfirmation.set(fiscalDocumentId, dealConfirmationId);
    }
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    this.tables.get(table)!.set(String(row.id), row);
    return row;
  }

  async pullChangesSince(table: string, timestampColumn: string, since: string): Promise<Record<string, unknown>[]> {
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows.filter((row) => String(row[timestampColumn]) > since);
  }

  async rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
    if (fn === "create_business_partner" || fn === "update_business_partner") {
      const row = args.p_row as Record<string, unknown>;
      await this.upsertRow("business_partners", row);
      for (const role of args.p_roles as string[]) {
        await this.upsertRow("business_partner_roles", { id: `${row.id}-${role}`, business_partner_id: row.id, role, created_at: row.created_at });
      }
      return row as T;
    }
    throw new Error(`FakeCloud.rpc nao implementa "${fn}"`);
  }
}

function setupPc(cloud: FakeCloud): { db: ReturnType<typeof initializeDatabase>; repo: AppRepository } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-deal-sync-"));
  tempDirs.push(userData);
  const directories = resolveAppDirectories(userData);
  ensureAppDirectories(directories);
  const db = initializeDatabase(directories);
  const repo = new AppRepository(db, directories, cloud as unknown as SharedRepository);
  return { db, repo };
}

describe("sincronizacao de confirmacoes de negocio entre PCs", () => {
  it("confirmacao criada no PC A (com partes, item, clausula e assinante) aparece no PC B depois de sincronizar", async () => {
    const cloud = new FakeCloud();
    const pcA = setupPc(cloud);
    const pcB = setupPc(cloud);

    pcA.repo.saveInstallationProfile({ installationName: "Villa A", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
    pcB.repo.saveInstallationProfile({ installationName: "Villa B", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });

    const seller = await pcA.repo.createBusinessPartner({ organizationId: villaId, displayName: "Vendedora", notes: null, roles: ["SELLER"], isActive: true });
    const buyer = await pcA.repo.createBusinessPartner({ organizationId: villaId, displayName: "Compradora", notes: null, roles: ["BUYER"], isActive: true });
    const product = pcA.repo.listProducts({ organizationId: villaId })[0];

    const draft = pcA.repo.createDealConfirmationDraft({
      organizationId: villaId,
      ownLegalEntityId,
      templateId: null,
      confirmationDate: "2026-08-01",
      negotiationDate: "2026-07-30",
      deliveryLocationSnapshot: "Armazem Sul",
      deliveryStartDate: null,
      deliveryEndDate: null,
      paymentTermsSnapshot: "A vista",
      qualityTermsSnapshot: "Bebida dura",
      generalTermsSnapshot: "Termos demonstrativos",
      publicNotes: null,
      internalNotes: null
    });
    const dealConfirmationId = draft.confirmation.id;
    pcA.repo.addDealConfirmationParty({ dealConfirmationId, partyRole: "SELLER", businessPartnerId: seller.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
    pcA.repo.addDealConfirmationParty({ dealConfirmationId, partyRole: "BUYER", businessPartnerId: buyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    pcA.repo.addDealConfirmationItem({
      dealConfirmationId, sortOrder: 0, productId: product.id, productNameSnapshot: "Cafe", productDescriptionSnapshot: null,
      cropSnapshot: null, qualitySnapshot: "Bebida dura", packagingSnapshot: "Sacas", originSnapshot: null, destinationSnapshot: null,
      quantitySacksDecimal: "100", sackWeightKgDecimal: "60", unitPriceDecimal: "1000.00", totalAmountCents: null, totalOverrideReason: null,
      deliveryStartDate: null, deliveryEndDate: null, deliveryLocationSnapshot: null, notes: null
    });
    pcA.repo.addDealConfirmationClause({ dealConfirmationId, clauseNumber: "1", title: "Clausula", clauseText: "Texto demonstrativo", sortOrder: 0, isVisible: true });
    pcA.repo.addDealSigner({ dealConfirmationId, partyRole: "SELLER", name: "Assinante", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 1, signatureStatus: "PENDING", signedAt: null, notes: null });

    // Mesmo efeito de repository.pushDealConfirmationToShared(id) chamado no
    // handler IPC depois de cada escrita -- aqui basta uma vez no final, ja'
    // que ele sempre le' o estado ATUAL (nao incremental) de tudo relacionado.
    await pcA.repo.pushDealConfirmationToShared(dealConfirmationId);
    await pcB.repo.syncSharedDataDown();

    const detailOnB = pcB.repo.getDealConfirmation(dealConfirmationId);
    expect(detailOnB.confirmation.temporaryReference).toBe(draft.confirmation.temporaryReference);
    // createDealConfirmationDraft ja' cria a parte ISSUER sozinho (linha
    // own_legal_entity_id) -- some as duas que o teste adicionou (SELLER,
    // BUYER) pra dar 3.
    expect(detailOnB.parties).toHaveLength(3);
    expect(detailOnB.parties.map((p) => p.partyRole).sort()).toEqual(["BUYER", "ISSUER", "SELLER"]);
    expect(detailOnB.items).toHaveLength(1);
    expect(detailOnB.items[0].quantitySacksDecimal).toBe("100");
    expect(detailOnB.clauses).toHaveLength(1);
    expect(detailOnB.signers).toHaveLength(1);

    pcA.db.close();
    pcB.db.close();
  });

  it("bloqueia a corrida de duas confirmacoes geradas da mesma nota fiscal em PCs diferentes", async () => {
    // Reproduz o cenario que findActiveDealConfirmationForFiscalDocuments (a
    // dedup local, SELECT-then-INSERT) nao consegue cobrir sozinha: dois PCs
    // geram confirmacao a partir da MESMA nota antes de qualquer sincronizacao
    // acontecer entre eles -- cada um so' enxerga o proprio banco local, entao
    // os dois criam um rascunho novo. So' o indice unico parcial no Postgres
    // (0027_fiscal_document_claim_uniqueness.sql, simulado aqui em FakeCloud)
    // consegue detectar e bloquear isso de verdade.
    const cloud = new FakeCloud();
    const pcA = setupPc(cloud);
    const pcB = setupPc(cloud);
    pcA.repo.saveInstallationProfile({ installationName: "Villa A", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
    pcB.repo.saveInstallationProfile({ installationName: "Villa B", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
    const product = pcA.repo.listProducts({ organizationId: villaId })[0];

    const buyer = await pcA.repo.createBusinessPartner({ organizationId: villaId, displayName: "Compradora Corrida", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
    const doc = pcA.repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: buyer.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "NF-RACE-1", series: "1", issueDate: "2026-07-17", totalAmountCents: 500000, hasPendingIssues: false, pendingNotes: null, notes: null });
    const item = pcA.repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "Cafe", quantity: "5", unit: "SACK", unitPriceDecimal: "1000", totalAmountCents: 500000, sacksQuantity: "5" });
    pcA.repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: buyer.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-17", quantitySacks: "5", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    pcA.repo.confirmFiscalDocument(doc.document.id);
    await pcA.repo.pushFiscalDocumentToShared(doc.document.id);

    // Sincroniza a nota (e a compradora) pro PC B ANTES da corrida -- os dois
    // PCs ja' enxergam a mesma nota, so' nao sabem ainda que o outro vai gerar
    // uma confirmacao a partir dela ao mesmo tempo.
    await pcB.repo.syncSharedDataDown();
    expect(pcB.repo.getFiscalDocument(doc.document.id).document.id).toBe(doc.document.id);

    const confirmationA = pcA.repo.createDealConfirmationFromFiscalDocuments({ organizationId: villaId, ownLegalEntityId, operationIds: [], fiscalDocumentIds: [doc.document.id] });
    const confirmationB = pcB.repo.createDealConfirmationFromFiscalDocuments({ organizationId: villaId, ownLegalEntityId, operationIds: [], fiscalDocumentIds: [doc.document.id] });
    expect(confirmationA.confirmation.id).not.toBe(confirmationB.confirmation.id);

    await pcA.repo.pushDealConfirmationToShared(confirmationA.confirmation.id);
    await expect(pcB.repo.pushDealConfirmationToShared(confirmationB.confirmation.id)).rejects.toThrow(/deal_confirmation_fiscal_documents_active_claim_uq/);

    pcA.db.close();
    pcB.db.close();
  });
});
