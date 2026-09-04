// Regressao pro bug real encontrado em producao em 2026-08-06: entradas na
// fila de reenvio presas repetindo "Sem permissao para esta operacao." pra
// sempre (uma delas ha' mais de 30h, 1911 tentativas). Causa raiz: duas
// tabelas append-only (sync_tombstones e payable_status_history) so' tem RLS
// policy de INSERT no Postgres, nunca de UPDATE (por design -- historico e'
// permanente). Mas o codigo usava upsertRow/upsertRows pra reenviar essas
// linhas, o que vira "INSERT ... ON CONFLICT DO UPDATE" quando a linha ja
// existe do lado do servidor -- reenvio apos resposta de rede perdida, outro
// PC que ja empurrou a mesma linha primeiro, ou (payable_status_history)
// reenviar TODO o historico de novo a cada nova mudanca na conta a pagar. Sem
// policy de UPDATE, o Postgres rejeita, e o erro parece transitorio (mesma
// mensagem generica) entao a fila reenvia pra sempre sem nunca resolver. A
// correcao troca pra insertIfMissing (ON CONFLICT DO NOTHING -- nunca toca o
// caminho de UPDATE).
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

// Reproduz o comportamento real do Postgres pras tabelas append-only: so' tem
// RLS policy de INSERT (nao existe policy de UPDATE, ver migration 0010/0017).
// upsertRow "cru" (o jeito antigo, com bug) vira ON CONFLICT DO UPDATE quando
// a linha ja existe -- sem policy de UPDATE, isso e' rejeitado com a mesma
// mensagem exata vista em producao. insertIfMissing (o jeito corrigido) vira
// ON CONFLICT DO NOTHING -- nunca toca esse caminho.
const APPEND_ONLY_TABLES = new Set(["sync_tombstones", "payable_status_history"]);

class RlsEnforcingFakeSharedRepository {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    const key = table === "sync_tombstones" ? `${row.table_name}:${row.row_id}` : String(row.id);
    const map = this.tables.get(table)!;
    if (APPEND_ONLY_TABLES.has(table) && map.has(key)) {
      throw new Error(`new row violates row-level security policy for table "${table}"`);
    }
    map.set(key, row);
    return row;
  }

  async insertIfMissing(table: string, row: Record<string, unknown>): Promise<void> {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    const key = table === "sync_tombstones" ? `${row.table_name}:${row.row_id}` : String(row.id);
    const map = this.tables.get(table)!;
    if (!map.has(key)) map.set(key, row);
  }

  async listAll(): Promise<Array<Record<string, unknown>>> {
    return [];
  }

  async pullChangesSince(): Promise<Array<Record<string, unknown>>> {
    return [];
  }

  has(table: string, key: string): boolean {
    return this.tables.get(table)?.has(key) ?? false;
  }
}

async function setup() {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-append-only-retry-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const cloud = new RlsEnforcingFakeSharedRepository();
  const repo = new AppRepository(db, dirs, cloud as unknown as SharedRepository);
  repo.saveInstallationProfile({ installationName: "Villa", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  return { repo, db, cloud };
}

describe("reenvio de tabelas append-only depois que a linha ja existe no servidor", () => {
  it("pushTombstone: reenviar o mesmo tombstone (resposta de rede perdida, ou outro PC ja empurrou primeiro) nao trava pra sempre", async () => {
    const { repo, db, cloud } = await setup();
    try {
      // 1o push: linha ainda nao existe no servidor simulado -- sucesso normal.
      await repo.pushTombstone("fiscal_documents", "doc-1");
      expect(cloud.has("sync_tombstones", "fiscal_documents:doc-1")).toBe(true);

      // Reenvio do MESMO tombstone (simula exatamente o cenario real: o
      // outbox tenta de novo depois de uma falha transitoria anterior, ou o
      // pull de outro PC ja trouxe esse tombstone antes do push deste PC
      // terminar). Antes da correcao isso lancava "new row violates
      // row-level security policy" e ficava preso no outbox pra sempre.
      await expect(repo.pushTombstone("fiscal_documents", "doc-1")).resolves.toBeUndefined();

      const pending = db.prepare("SELECT * FROM shared_push_outbox WHERE entity_id = ?").all("fiscal_documents:doc-1");
      expect(pending).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it("pushAccountPayableToShared: reenviar a conta a pagar uma segunda vez (historico ja existe no servidor) nao trava", async () => {
    const { repo, db } = await setup();
    try {
      const supplier = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Fornecedor Historico", notes: null, roles: ["SUPPLIER"], isActive: true });
      const category = (await repo.listExpenseCategories(villaId))[0];
      await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: supplier.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId: null, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 1, notes: null, isActive: true });

      const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: supplier.id, partnerLegalEntityId: null, operationType: "PURCHASE", accessKey: null, documentNumber: "HIST-1", series: "1", issueDate: "2026-07-16", totalAmountCents: 500000, hasPendingIssues: false, pendingNotes: null, notes: null });
      const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: null, description: "Cafe", quantity: "1000", unit: "SACK", unitPriceDecimal: "5.00", totalAmountCents: 500000, sacksQuantity: "1000" });
      const operation = repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: supplier.id, productId: null, operationType: "PURCHASE", operationScope: "EXTERNAL", operationDate: "2026-07-16", quantitySacks: "1000", manualRateValueCents: null, manualOverrideReason: null, notes: null });
      repo.confirmFiscalDocument(doc.document.id);

      const settled = await repo.generatePurchaseSettlement({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: supplier.id, operationIds: [operation.id], categoryId: category.id, dueDate: "2026-09-25", notes: "Acerto semanal" });

      // 1o push: historico ainda nao existe no servidor simulado -- sucesso normal.
      await expect(repo.pushAccountPayableToShared(settled.payable.id)).resolves.toBeUndefined();

      // 2o push da MESMA conta a pagar (cenario real: qualquer mudanca
      // seguinte -- pagamento, "Sincronizar agora", reenvio apos falha --
      // reenvia o metodo inteiro, incluindo o historico ja existente no
      // servidor). Antes da correcao isso lancava "new row violates
      // row-level security policy" pro historico e ficava preso no outbox.
      await expect(repo.pushAccountPayableToShared(settled.payable.id)).resolves.toBeUndefined();

      const pending = db.prepare("SELECT * FROM shared_push_outbox WHERE entity_id = ?").all(settled.payable.id);
      expect(pending).toHaveLength(0);
    } finally {
      db.close();
    }
  });
});
