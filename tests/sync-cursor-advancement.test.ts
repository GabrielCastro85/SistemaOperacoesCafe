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

// Fake que so' devolve dados controlados pra UMA tabela (business_partner_roles) e
// nada pras demais -- e' o suficiente pra exercitar syncTableDown isoladamente.
class FakeSharedRepository {
  callsSince: string[] = [];
  rowsToReturn: Array<Record<string, unknown>> = [];
  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });
  async pullChangesSince(table: string, _timestampColumn: string, since: string): Promise<Array<Record<string, unknown>>> {
    if (table !== "business_partner_roles") return [];
    this.callsSince.push(since);
    return this.rowsToReturn.filter((row) => String(row.created_at) > since);
  }
}

describe("cursor de sincronizacao (syncTableDown) nao pula linha que falhou no meio do lote", () => {
  it("nao avanca o cursor alem de uma linha que falhou, mesmo se uma linha MAIS RECENTE no mesmo lote teve sucesso", async () => {
    const userData = mkdtempSync(join(tmpdir(), "operacoes-cursor-"));
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
    const partner = await offlineRepo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["CLIENT"], isActive: true });

    const fake = new FakeSharedRepository();
    // Linha A (timestamp MENOR) tem um role invalido -- viola o CHECK
    // constraint local e falha ao aplicar. Linha B (timestamp MAIOR, mesmo
    // lote) tem um role valido e aplica com sucesso. Sem a correcao, o
    // cursor pularia pro timestamp de B, e a linha A nunca mais seria
    // buscada de novo (permanentemente perdida).
    fake.rowsToReturn = [
      { id: "aaaaaaaa-0000-4000-8000-000000000001", business_partner_id: partner.id, role: "ROLE_INVALIDO_PROPOSITAL", created_at: "2026-01-01T00:00:01.000Z" },
      { id: "aaaaaaaa-0000-4000-8000-000000000002", business_partner_id: partner.id, role: "SUPPLIER", created_at: "2026-01-01T00:00:02.000Z" }
    ];
    const onlineRepo = new AppRepository(db, directories, fake as unknown as SharedRepository);

    await onlineRepo.syncSharedDataDown();

    // A linha valida (B) foi aplicada.
    const roles = db.prepare("SELECT role FROM business_partner_roles WHERE business_partner_id = ?").all(partner.id).map((r) => (r as { role: string }).role);
    expect(roles).toContain("SUPPLIER");
    expect(roles).not.toContain("ROLE_INVALIDO_PROPOSITAL");

    // Corrige a linha A (simula o dado ficando valido, ou so' confirma que ela
    // sera' tentada de novo): roda uma segunda sincronizacao.
    fake.rowsToReturn[0].role = "SUPPLIER";
    fake.callsSince = [];
    await onlineRepo.syncSharedDataDown();

    // Se o cursor tivesse pulado pra frente da linha A na primeira rodada,
    // essa segunda chamada teria usado "since" = timestamp de B (ou mais),
    // e a query real (WHERE updated_at > since) jamais devolveria A de novo.
    // Aqui o fake simula a query com >, entao verificamos que o "since"
    // passado na segunda chamada e' ANTERIOR ao timestamp da linha A.
    const secondCallSince = fake.callsSince[0];
    expect(secondCallSince < "2026-01-01T00:00:01.000Z").toBe(true);

    db.close();
  });

  it("reconcilia business_partner_roles pelo par (business_partner_id, role) em vez do id, ja que o Postgres gera seu proprio id pra essa tabela", async () => {
    // Reproduz o travamento real: este PC cria uma role localmente (id local
    // proprio) e a empurra pro Supabase sem enviar o id (insertRow simples,
    // sem upsert) -- o Postgres gera um id novo pra ela. Quando esse mesmo PC
    // (ou outro) depois PUXA essa linha de volta, o id que chega e' diferente
    // do id local ja existente pra esse (business_partner_id, role). Mirar o
    // upsert no id (em vez da chave natural) fazia isso virar um INSERT novo,
    // que violava o indice unico (business_partner_id, role) pra sempre --
    // exatamente o que travou a sincronizacao de business_partner_roles em
    // producao (cliente INCONFEX, role CLIENT).
    const userData = mkdtempSync(join(tmpdir(), "operacoes-role-reconcile-"));
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
    const partner = await offlineRepo.createBusinessPartner({ organizationId: villaId, displayName: "Inconfex", notes: null, roles: ["CLIENT"], isActive: true });
    const localRoleId = (db.prepare("SELECT id FROM business_partner_roles WHERE business_partner_id = ? AND role = 'CLIENT'").get(partner.id) as { id: string }).id;

    const fake = new FakeSharedRepository();
    const cloudGeneratedId = "cccccccc-0000-4000-8000-000000000099";
    fake.rowsToReturn = [
      { id: cloudGeneratedId, business_partner_id: partner.id, role: "CLIENT", created_at: "2026-01-01T00:00:05.000Z" }
    ];
    const onlineRepo = new AppRepository(db, directories, fake as unknown as SharedRepository);

    await onlineRepo.syncSharedDataDown();

    const roles = db.prepare("SELECT id, role FROM business_partner_roles WHERE business_partner_id = ?").all(partner.id) as Array<{ id: string; role: string }>;
    expect(roles).toHaveLength(1);
    expect(roles[0].role).toBe("CLIENT");
    expect(roles[0].id).toBe(cloudGeneratedId);
    expect(roles[0].id).not.toBe(localRoleId);

    db.close();
  });
});

// Fake generico (qualquer tabela) pra exercitar resetSyncCursorsAndResync --
// simula um PC cujo cursor de "legal_entities" ja avancou alem de uma linha
// antiga (ex: comecou a sincronizar essa tabela so' depois dela ja ter
// historico no Supabase), entao um "Sincronizar agora" normal nunca mais
// buscaria essa linha de volta.
class GenericFakeSharedRepository {
  rowsByTable: Record<string, Array<Record<string, unknown>>> = {};
  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });
  async pullChangesSince(table: string, _timestampColumn: string, since: string): Promise<Array<Record<string, unknown>>> {
    return (this.rowsByTable[table] ?? []).filter((row) => String(row.updated_at) > since);
  }
}

describe("resetSyncCursorsAndResync (sincronizacao completa manual)", () => {
  it("rebaixa uma linha antiga que o cursor ja tinha 'pulado', mesmo sem nenhuma mudanca nova", async () => {
    const userData = mkdtempSync(join(tmpdir(), "operacoes-full-resync-"));
    tempDirs.push(userData);
    const directories = resolveAppDirectories(userData);
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);

    const fake = new GenericFakeSharedRepository();
    const staleEntityId = "dddddddd-0000-4000-8000-000000000001";
    fake.rowsByTable.legal_entities = [{
      id: staleEntityId,
      organization_id: villaId,
      trade_name: "Empresa Antiga Nunca Baixada",
      legal_name: "Empresa Antiga Nunca Baixada LTDA",
      cnpj: "11222333000181",
      address_line: "Rua Antiga",
      address_number: "1",
      district: "Centro",
      city: "Belo Horizonte",
      state: "MG",
      postal_code: "30000000",
      document_prefix: null,
      is_active: 1,
      created_at: "2020-01-01T00:00:00.000Z",
      updated_at: "2020-01-01T00:00:00.000Z"
    }];
    const repo = new AppRepository(db, directories, fake as unknown as SharedRepository);

    // Simula o cursor deste PC ja tendo avancado alem da linha antiga (ex:
    // essa tabela so' entrou no hot-sync depois que a linha ja existia la').
    db.prepare(
      `INSERT INTO app_settings (id, key, value, value_type, created_at, updated_at) VALUES (@id, @key, @value, 'string', @now, @now)`
    ).run({ id: "seed-cursor", key: "sync_cursor_legal_entities", value: "2025-01-01T00:00:00.000Z", now: new Date().toISOString() });

    // "Sincronizar agora" normal nao acha nada (cursor ja passou da linha antiga).
    const normalPull = await repo.syncSharedDataDown();
    expect(db.prepare("SELECT id FROM legal_entities WHERE id = ?").get(staleEntityId)).toBeUndefined();
    expect(normalPull.find((entry) => entry.table === "legal_entities")?.pulled).toBe(0);

    // Sincronizacao completa esquece o cursor e traz a linha antiga de volta.
    const fullPull = await repo.resetSyncCursorsAndResync();
    expect(db.prepare("SELECT trade_name FROM legal_entities WHERE id = ?").get(staleEntityId)).toMatchObject({ trade_name: "Empresa Antiga Nunca Baixada" });
    expect(fullPull.find((entry) => entry.table === "legal_entities")?.pulled).toBe(1);

    db.close();
  });
});
