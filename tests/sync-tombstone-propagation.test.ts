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

// Nuvem compartilhada entre duas instancias de AppRepository (dois "PCs"
// separados, cada um com seu proprio SQLite local) -- mesmo espirito de
// FlakyFakeCloud em tests/shared-push-outbox.test.ts, mas sem a flakiness
// (aqui o interesse e' testar a propagacao de exclusao em si, nao reenvio).
class TwoPcFakeCloud {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();
  bulkCalls: Array<{ table: string; rows: Array<Record<string, unknown>> }> = [];

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    const key = table === "sync_tombstones" ? `${row.table_name}:${row.row_id}` : String(row.id);
    this.tables.get(table)!.set(key, row);
    return row;
  }

  async upsertRows(table: string, rows: Array<Record<string, unknown>>): Promise<void> {
    this.bulkCalls.push({ table, rows });
    for (const row of rows) await this.upsertRow(table, row);
  }

  async pullChangesSince(table: string, timestampColumn: string, since: string): Promise<Record<string, unknown>[]> {
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows
      .filter((row) => String(row[timestampColumn]) > since)
      .sort((a, b) => String(a[timestampColumn]).localeCompare(String(b[timestampColumn])));
  }
}

function setupPc(cloud: TwoPcFakeCloud, name: string): { db: ReturnType<typeof initializeDatabase>; repo: AppRepository } {
  const userData = mkdtempSync(join(tmpdir(), `operacoes-tombstone-${name}-`));
  tempDirs.push(userData);
  const directories = resolveAppDirectories(userData);
  ensureAppDirectories(directories);
  const db = initializeDatabase(directories);
  const repo = new AppRepository(db, directories, cloud as unknown as SharedRepository);
  repo.saveInstallationProfile({
    installationName: "Villa",
    appVariant: "villa",
    defaultOrganizationId: villaId,
    defaultLegalEntityId: ownLegalEntityId,
    allowOrganizationSwitch: false,
    allowLegalEntitySwitch: true,
    completedSetup: true
  });
  return { db, repo };
}

describe("propagacao de exclusao entre PCs (sync_tombstones)", () => {
  it("PC A apaga uma nota e empurra o tombstone -- PC B puxa no proximo ciclo normal e apaga a copia local sozinho", async () => {
    const cloud = new TwoPcFakeCloud();
    const pcA = setupPc(cloud, "a1");
    const pcB = setupPc(cloud, "b1");
    try {
      const partner = await pcA.repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Tombstone", notes: null, roles: ["CLIENT"], isActive: true });
      const doc = pcA.repo.createFiscalDocument({
        organizationId: villaId,
        ownLegalEntityId,
        responsiblePartnerId: partner.id,
        partnerLegalEntityId: null,
        accessKey: null,
        documentNumber: "900",
        series: "1",
        issueDate: "2026-08-01",
        totalAmountCents: 100000,
        hasPendingIssues: false,
        pendingNotes: null,
        notes: null
      });
      // Empurra em lote (nao so' a nota) -- a nota referencia o parceiro por
      // FK, e o PC B precisa ter o parceiro localmente antes de conseguir
      // aplicar a nota vinda do pull.
      await pcA.repo.pushAllLocalReferenceDataToShared();

      // PC B sincroniza normalmente ANTES da exclusao -- ja tem a nota localmente.
      await pcB.repo.syncSharedDataDown();
      expect(() => pcB.repo.getFiscalDocument(doc.document.id)).not.toThrow();

      // PC A apaga (mesmo fluxo do handler IPC: deleta local, depois empurra o tombstone).
      pcA.repo.deleteFiscalDocument(doc.document.id);
      await pcA.repo.pushTombstone("fiscal_documents", doc.document.id);

      // PC B nunca recebe nenhuma acao manual -- so' o proximo ciclo normal de
      // sincronizacao (poll de 20s ou "Sincronizar agora").
      await pcB.repo.syncSharedDataDown();
      expect(() => pcB.repo.getFiscalDocument(doc.document.id)).toThrow();
    } finally {
      pcA.db.close();
      pcB.db.close();
    }
  });

  it("PC B com copia local desatualizada NUNCA ressuscita a nota apagada -- pushAllLocalReferenceDataToShared se autocura em vez de reenviar", async () => {
    const cloud = new TwoPcFakeCloud();
    const pcA = setupPc(cloud, "a2");
    const pcB = setupPc(cloud, "b2");
    try {
      const partner = await pcA.repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Ressurreicao", notes: null, roles: ["CLIENT"], isActive: true });
      const doc = pcA.repo.createFiscalDocument({
        organizationId: villaId,
        ownLegalEntityId,
        responsiblePartnerId: partner.id,
        partnerLegalEntityId: null,
        accessKey: null,
        documentNumber: "901",
        series: "1",
        issueDate: "2026-08-01",
        totalAmountCents: 200000,
        hasPendingIssues: false,
        pendingNotes: null,
        notes: null
      });
      // Empurra em lote (nao so' a nota) -- a nota referencia o parceiro por
      // FK, e o PC B precisa ter o parceiro localmente antes de conseguir
      // aplicar a nota vinda do pull.
      await pcA.repo.pushAllLocalReferenceDataToShared();

      // PC B sincronizou ANTES da exclusao -- fica com uma copia local que
      // vira desatualizada (cenario real: um PC que fica um tempo sem abrir
      // enquanto a exclusao/reset acontece em outro lugar).
      await pcB.repo.syncSharedDataDown();
      expect(() => pcB.repo.getFiscalDocument(doc.document.id)).not.toThrow();

      pcA.repo.deleteFiscalDocument(doc.document.id);
      await pcA.repo.pushTombstone("fiscal_documents", doc.document.id);

      // PC B nunca roda syncSharedDataDown de novo -- so' clica "Sincronizar
      // agora" (pushAllLocalReferenceDataToShared), que ANTES desta correcao
      // reenviaria a copia zumbi de volta pro Supabase (era exatamente esse
      // buraco que ressuscitou o reset de dados de teste em 2026-08-02).
      // (bulkCallsBefore marca onde o push do PC A parou, ja que bulkCalls e'
      // compartilhado entre os dois PCs na mesma nuvem fake.)
      const bulkCallsBefore = cloud.bulkCalls.length;
      const results = await pcB.repo.pushAllLocalReferenceDataToShared();

      const resurrected = cloud.bulkCalls.slice(bulkCallsBefore).some(
        (call) => call.table === "fiscal_documents" && call.rows.some((row) => row.id === doc.document.id)
      );
      expect(resurrected).toBe(false);
      expect(results.find((r) => r.table === "fiscal_documents")?.pushed ?? 0).toBe(0);

      // PC B se autocurou -- a copia local zumbi tambem sumiu, nao so' deixou
      // de ser reenviada.
      expect(() => pcB.repo.getFiscalDocument(doc.document.id)).toThrow();
    } finally {
      pcA.db.close();
      pcB.db.close();
    }
  });

  it("aplica o tombstone de uma nota vinculada a confirmacao de negocio sem violar FK -- reproduz o bug real do reset de 2026-08-02", async () => {
    // deleteFiscalDocument() (uso normal, via app) RECUSA apagar uma nota
    // vinculada a confirmacao de negocio. Mas o reset admin (ver
    // scripts/supabase/reset-test-data.mjs) apaga direto no Postgres, sem
    // passar por essa checagem -- exatamente o que aconteceu em producao em
    // 2026-08-02 e travou a aplicacao do tombstone com "FOREIGN KEY
    // constraint failed" (deal_confirmation_fiscal_documents/
    // deal_confirmation_operations ainda referenciavam a nota localmente).
    const cloud = new TwoPcFakeCloud();
    const pcA = setupPc(cloud, "a3");
    const pcB = setupPc(cloud, "b3");
    try {
      const partner = await pcA.repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Vinculado", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
      const product = pcA.repo.listProducts({ organizationId: villaId })[0];
      const doc = pcA.repo.createFiscalDocument({
        organizationId: villaId,
        ownLegalEntityId,
        responsiblePartnerId: partner.id,
        partnerLegalEntityId: null,
        accessKey: null,
        documentNumber: "902",
        series: "1",
        issueDate: "2026-08-01",
        totalAmountCents: 500000,
        hasPendingIssues: false,
        pendingNotes: null,
        notes: null
      });
      const item = pcA.repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "Cafe", quantity: "5", unit: "SACK", unitPriceDecimal: "1000", totalAmountCents: 500000, sacksQuantity: "5" });
      pcA.repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: partner.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-08-01", quantitySacks: "5", manualRateValueCents: null, manualOverrideReason: null, notes: null });
      pcA.repo.confirmFiscalDocument(doc.document.id);
      pcA.repo.createDealConfirmationFromFiscalDocuments({ organizationId: villaId, ownLegalEntityId, operationIds: [], fiscalDocumentIds: [doc.document.id] });

      await pcA.repo.pushAllLocalReferenceDataToShared();
      await pcB.repo.syncSharedDataDown();
      expect(() => pcB.repo.getFiscalDocument(doc.document.id)).not.toThrow();

      // Simula o reset admin apagando a nota direto no Postgres e gravando o
      // tombstone (nao passa por deleteFiscalDocument -- PC B ainda tem
      // localmente o vinculo com a confirmacao de negocio).
      await cloud.upsertRow("sync_tombstones", { table_name: "fiscal_documents", row_id: doc.document.id, deleted_at: new Date().toISOString() });

      const results = await pcB.repo.syncSharedDataDown();
      expect(results.find((r) => r.table === "sync_tombstones")?.pulled).toBe(1);
      expect(() => pcB.repo.getFiscalDocument(doc.document.id)).toThrow();
      expect(pcB.db.prepare("SELECT COUNT(*) AS c FROM deal_confirmation_fiscal_documents WHERE fiscal_document_id = ?").get(doc.document.id)).toMatchObject({ c: 0 });
      expect(pcB.db.prepare("SELECT COUNT(*) AS c FROM deal_confirmation_operations").get()).toMatchObject({ c: 0 });
    } finally {
      pcA.db.close();
      pcB.db.close();
    }
  });
});
