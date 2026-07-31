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

// Duplo fake e' o mesmo de SharedRepository nos pontos que pushAllLocalReferenceDataToShared
// realmente chama -- registra cada chamada em vez de bater no Supabase de verdade.
class FakeSharedRepository {
  upserted: Array<{ table: string; id: string }> = [];
  bulkCalls: Array<{ table: string; rows: Array<Record<string, unknown>>; onConflict?: string }> = [];
  tables: Record<string, Array<Record<string, unknown>>> = {};
  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.upserted.push({ table, id: String(row.id) });
    return row;
  }
  async upsertRows(table: string, rows: Array<Record<string, unknown>>, onConflict?: string): Promise<void> {
    this.bulkCalls.push({ table, rows, onConflict });
    for (const row of rows) this.upserted.push({ table, id: String(row.id) });
  }
  async listAll(table: string): Promise<Array<Record<string, unknown>>> {
    return this.tables[table] ?? [];
  }
}

describe("shared sync reconciliation", () => {
  it("retries a fiscal document (and its operation) that was created before a shared connection existed, when 'Sincronizar agora' runs", async () => {
    const userData = mkdtempSync(join(tmpdir(), "operacoes-sync-reconcile-"));
    tempDirs.push(userData);
    const directories = resolveAppDirectories(userData);
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);

    // Sem sharedRepository conectado (como um PC offline, ou um push que falhou
    // silenciosamente na hora): a nota e' criada so' localmente.
    const offlineRepo = new AppRepository(db);
    offlineRepo.saveInstallationProfile({
      installationName: "Villa",
      appVariant: "villa",
      defaultOrganizationId: villaId,
      defaultLegalEntityId: ownLegalEntityId,
      allowOrganizationSwitch: false,
      allowLegalEntitySwitch: true,
      completedSetup: true
    });
    const partner = await offlineRepo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Reconciliacao", notes: null, roles: ["CLIENT"], isActive: true });
    const doc = offlineRepo.createFiscalDocument({
      organizationId: villaId,
      ownLegalEntityId,
      responsiblePartnerId: partner.id,
      partnerLegalEntityId: null,
      accessKey: null,
      documentNumber: "7001",
      series: "1",
      issueDate: "2026-07-20",
      totalAmountCents: 500000,
      hasPendingIssues: false,
      pendingNotes: null,
      notes: null
    });

    // Agora conecta um SharedRepository (real na producao) e roda a mesma
    // reconciliacao que o botao "Sincronizar agora" dispara.
    const fake = new FakeSharedRepository();
    const onlineRepo = new AppRepository(db, directories, fake as unknown as SharedRepository);
    const results = await onlineRepo.pushAllLocalReferenceDataToShared();

    const fiscalDocsResult = results.find((r) => r.table === "fiscal_documents");
    expect(fiscalDocsResult?.pushed).toBe(1);
    expect(fiscalDocsResult?.error).toBeNull();
    expect(fake.upserted.some((row) => row.table === "fiscal_documents" && row.id === doc.document.id)).toBe(true);

    // document_sequences so' pode ser escrita via RPC no Supabase (RLS nao
    // tem policy de insert/update de proposito, ver migration 0004) --
    // tentar empurra-la sempre falha com "Sem permissao para esta operacao.".
    // A reconciliacao deve pular essa tabela em vez de reportar erro.
    const sequencesResult = results.find((r) => r.table === "document_sequences");
    expect(sequencesResult?.error).toBeNull();
    expect(fake.bulkCalls.some((call) => call.table === "document_sequences")).toBe(false);

    db.close();
  });

  it("reconciles business_partner_roles by the natural key (business_partner_id, role) instead of the local id, since Postgres generates its own id for that table", async () => {
    // business_partner_roles e' a unica tabela onde o Postgres gera seu proprio
    // id (create_business_partner/addBusinessPartnerRole nunca enviam o id
    // local -- ver sharedRepository.ts). Se a reconciliacao em lote reenviasse
    // o id local aqui, cada rodada de "Sincronizar agora" criaria uma linha
    // NOVA em vez de atualizar a existente, violando o indice unico
    // (business_partner_id, role) -- exatamente o erro "Ja existe um registro
    // com esses dados" visto em producao.
    const userData = mkdtempSync(join(tmpdir(), "operacoes-sync-reconcile-roles-"));
    tempDirs.push(userData);
    const directories = resolveAppDirectories(userData);
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);

    const offlineRepo = new AppRepository(db);
    offlineRepo.saveInstallationProfile({
      installationName: "Villa",
      appVariant: "villa",
      defaultOrganizationId: villaId,
      defaultLegalEntityId: ownLegalEntityId,
      allowOrganizationSwitch: false,
      allowLegalEntitySwitch: true,
      completedSetup: true
    });
    await offlineRepo.createBusinessPartner({ organizationId: villaId, displayName: "Fornecedor Reconciliacao", notes: null, roles: ["CLIENT", "SUPPLIER"], isActive: true });

    const fake = new FakeSharedRepository();
    const onlineRepo = new AppRepository(db, directories, fake as unknown as SharedRepository);
    await onlineRepo.pushAllLocalReferenceDataToShared();

    const rolesCall = fake.bulkCalls.find((call) => call.table === "business_partner_roles");
    expect(rolesCall?.onConflict).toBe("business_partner_id,role");
    expect(rolesCall?.rows.length).toBe(2);
    for (const row of rolesCall?.rows ?? []) {
      expect(row.id).toBeUndefined();
      expect(row.business_partner_id).toBeTruthy();
      expect(row.role).toBeTruthy();
    }

    db.close();
  });

  it("adopts the Supabase id for a third-party (TERC-XML) legal entity that was independently created here with a different id, redirecting fiscal_documents before pushing", async () => {
    // Reproduz o bug real visto em producao: um CNPJ terceirizado (Bravus) foi
    // criado localmente ANTES da correcao de id deterministico -- esse PC tem
    // seu proprio id aleatorio pra' esse CNPJ, mas o Supabase ja tem OUTRO PC
    // que sincronizou o mesmo CNPJ sob um id diferente. Empurrar direto
    // colidiria no indice unico de cnpj ("Ja existe um registro com esses
    // dados"), e a nota fiscal que referencia esse own_legal_entity_id nunca
    // conseguiria subir (violacao de FK em cascata).
    const userData = mkdtempSync(join(tmpdir(), "operacoes-sync-reconcile-legal-entity-"));
    tempDirs.push(userData);
    const directories = resolveAppDirectories(userData);
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);

    const offlineRepo = new AppRepository(db);
    offlineRepo.saveInstallationProfile({
      installationName: "Villa",
      appVariant: "villa",
      defaultOrganizationId: villaId,
      defaultLegalEntityId: ownLegalEntityId,
      allowOrganizationSwitch: false,
      allowLegalEntitySwitch: true,
      completedSetup: true
    });
    const partner = await offlineRepo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Terceirizada", notes: null, roles: ["CLIENT"], isActive: true });

    const localWrongId = "aaaaaaaa-0000-4000-8000-000000000001";
    const cnpj = "67645189000140";
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO legal_entities (id, organization_id, legal_name, trade_name, cnpj, state_registration, municipal_registration, email, phone,
        address_line, address_number, address_complement, district, city, state, postal_code, document_prefix, is_active, is_draft, created_at, updated_at)
      VALUES (?, ?, 'BRAVUS COFFEE COMERCIO LTDA', 'BRAVUS COFFEE COMERCIO LTDA', ?, NULL, NULL, NULL, NULL,
        'Endereco nao informado', 'S/N', NULL, 'Nao informado', 'Varginha', 'MG', '37000000', 'TERC-XML', 1, 1, ?, ?)
    `).run(localWrongId, villaId, cnpj, now, now);

    const doc = offlineRepo.createFiscalDocument({
      organizationId: villaId,
      ownLegalEntityId: localWrongId,
      responsiblePartnerId: partner.id,
      partnerLegalEntityId: null,
      accessKey: null,
      documentNumber: "89",
      series: "1",
      issueDate: "2026-07-28",
      totalAmountCents: 250000,
      hasPendingIssues: false,
      pendingNotes: null,
      notes: null
    });

    const supabaseCanonicalId = "cb7bf047-a504-4992-9e64-9dd5ec158aeb";
    const fake = new FakeSharedRepository();
    fake.tables.legal_entities = [{ id: supabaseCanonicalId, cnpj, organization_id: villaId }];
    const onlineRepo = new AppRepository(db, directories, fake as unknown as SharedRepository);
    const results = await onlineRepo.pushAllLocalReferenceDataToShared();

    const legalEntitiesResult = results.find((r) => r.table === "legal_entities");
    expect(legalEntitiesResult?.error).toBeNull();
    const legalEntitiesCall = fake.bulkCalls.find((call) => call.table === "legal_entities");
    expect(legalEntitiesCall?.rows.some((row) => row.id === localWrongId)).toBe(false);
    expect(legalEntitiesCall?.rows.some((row) => row.id === supabaseCanonicalId)).toBe(true);

    const updatedDoc = offlineRepo.getFiscalDocument(doc.document.id);
    expect(updatedDoc.document.ownLegalEntityId).toBe(supabaseCanonicalId);
    expect(() => offlineRepo.getLegalEntity(localWrongId)).toThrow();

    db.close();
  });

  it("adopts the Supabase id for a default expense category that was independently created here with a different id (created before the deterministic-id fix)", async () => {
    // Mesmo bug/correcao de legal_entities, agora pra expense_categories:
    // ensureDefaultExpenseCategories usava randomUUID() ate' esta sessao --
    // categorias criadas ANTES dessa correcao ainda tem id aleatorio antigo
    // aqui, e colidem quando outro PC ja sincronizou a mesma categoria
    // (organization_id, code) sob um id deterministico diferente.
    const userData = mkdtempSync(join(tmpdir(), "operacoes-sync-reconcile-expense-"));
    tempDirs.push(userData);
    const directories = resolveAppDirectories(userData);
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);

    const offlineRepo = new AppRepository(db);
    offlineRepo.saveInstallationProfile({
      installationName: "Villa",
      appVariant: "villa",
      defaultOrganizationId: villaId,
      defaultLegalEntityId: ownLegalEntityId,
      allowOrganizationSwitch: false,
      allowLegalEntitySwitch: true,
      completedSetup: true
    });

    const localWrongId = "bbbbbbbb-0000-4000-8000-000000000001";
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO expense_categories (id, organization_id, parent_category_id, name, code, expense_nature, description, is_active, created_at, updated_at)
      VALUES (?, ?, NULL, 'Aluguel', 'RENT', 'FIXED', NULL, 1, ?, ?)
    `).run(localWrongId, villaId, now, now);

    const supabaseCanonicalId = "cccccccc-0000-4000-8000-000000000002";
    const fake = new FakeSharedRepository();
    fake.tables.expense_categories = [{ id: supabaseCanonicalId, organization_id: villaId, code: "RENT" }];
    const onlineRepo = new AppRepository(db, directories, fake as unknown as SharedRepository);
    const results = await onlineRepo.pushAllLocalReferenceDataToShared();

    const expenseCategoriesResult = results.find((r) => r.table === "expense_categories");
    expect(expenseCategoriesResult?.error).toBeNull();
    const expenseCategoriesCall = fake.bulkCalls.find((call) => call.table === "expense_categories");
    expect(expenseCategoriesCall?.rows.some((row) => row.id === localWrongId)).toBe(false);
    expect(expenseCategoriesCall?.rows.some((row) => row.id === supabaseCanonicalId)).toBe(true);

    const remainingCategory = db.prepare("SELECT id FROM expense_categories WHERE organization_id = ? AND code = 'RENT'").get(villaId) as { id: string };
    expect(remainingCategory.id).toBe(supabaseCanonicalId);

    db.close();
  });

  it("sends a large table in chunks of 100 rows instead of one giant request, so one slow/oversized request can't fail the whole table", async () => {
    // xml_import_files guarda o XML extraido inteiro por arquivo -- com
    // centenas de notas, um unico upsertRows com a tabela inteira arrisca
    // estourar tempo/tamanho e falhar tudo de uma vez ("Sem conexao com o
    // servidor", visto em producao com ~630 arquivos numa rodada so).
    const userData = mkdtempSync(join(tmpdir(), "operacoes-sync-reconcile-chunks-"));
    tempDirs.push(userData);
    const directories = resolveAppDirectories(userData);
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);

    const offlineRepo = new AppRepository(db);
    offlineRepo.saveInstallationProfile({
      installationName: "Villa",
      appVariant: "villa",
      defaultOrganizationId: villaId,
      defaultLegalEntityId: ownLegalEntityId,
      allowOrganizationSwitch: false,
      allowLegalEntitySwitch: true,
      completedSetup: true
    });
    const partner = await offlineRepo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Volume", notes: null, roles: ["CLIENT"], isActive: true });
    const total = 250;
    const insert = db.prepare(`
      INSERT INTO fiscal_documents (id, organization_id, own_legal_entity_id, responsible_partner_id, partner_legal_entity_id, document_type,
        access_key, document_number, series, issue_date, total_amount_cents, status, has_pending_issues, pending_notes, duplicate_warning,
        notes, source, direction, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, 'MANUAL_INVOICE', NULL, ?, '1', '2026-07-01', 100000, 'DRAFT', 0, NULL, 0, NULL, 'MANUAL', 'OUTBOUND', ?, ?)
    `);
    const now = new Date().toISOString();
    for (let i = 0; i < total; i += 1) {
      insert.run(`dddddddd-0000-4000-8000-${String(i).padStart(12, "0")}`, villaId, ownLegalEntityId, partner.id, `${9000 + i}`, now, now);
    }

    const fake = new FakeSharedRepository();
    const onlineRepo = new AppRepository(db, directories, fake as unknown as SharedRepository);
    const results = await onlineRepo.pushAllLocalReferenceDataToShared();

    const fiscalDocsResult = results.find((r) => r.table === "fiscal_documents");
    expect(fiscalDocsResult?.pushed).toBe(total);
    const fiscalDocsCalls = fake.bulkCalls.filter((call) => call.table === "fiscal_documents");
    expect(fiscalDocsCalls.length).toBe(Math.ceil(total / 100));
    for (const call of fiscalDocsCalls) expect(call.rows.length).toBeLessThanOrEqual(100);

    db.close();
  });
});
