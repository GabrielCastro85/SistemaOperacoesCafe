// Regressao pro bug real encontrado em producao em 2026-08-06 (durante um
// teste guiado manual, gerando o primeiro acerto de compra de uma
// organizacao nova): ensureDefaultExpenseCategories usava insertRow (INSERT
// puro) pra criar as 11 categorias-padrao com id deterministico. O id
// deterministico evita que dois PCs criem "a mesma" categoria com ids
// DIFERENTES antes de sincronizar -- mas nao evita a linha ja existir do
// lado do servidor no momento do insert (outro PC criou primeiro, ou um pull
// anterior ainda nao foi refletido no SQLite local): o insertRow puro
// colidia no indice unico (organization_id, code) com "Ja existe um
// registro com esses dados" (visto 11 vezes seguidas, uma por categoria).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { deterministicUuid } from "../electron/main/services/deterministicId";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import type { SharedRepository } from "../electron/main/services/sharedRepository";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

// Reproduz o comportamento real do Postgres: expense_categories tem indice
// unico (organization_id, code). insertRow "cru" (o jeito antigo, com bug)
// vira um INSERT que colide se a linha ja existir -- upsertRow (o jeito
// corrigido) vira ON CONFLICT DO UPDATE, seguro porque expense_categories
// tem policy de escrita completa (nao e' append-only, ver migration 0010).
class DuplicateKeyEnforcingFakeSharedRepository {
  private rows = new Map<string, Record<string, unknown>>();

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });

  seedExisting(row: Record<string, unknown>): void {
    this.rows.set(String(row.id), row);
  }

  get(id: string): Record<string, unknown> | undefined {
    return this.rows.get(id);
  }

  async insertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (table === "expense_categories" && this.rows.has(String(row.id))) {
      throw new Error('duplicate key value violates unique constraint "expense_categories_organization_id_code_key"');
    }
    this.rows.set(String(row.id), row);
    return row;
  }

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.rows.set(String(row.id), row);
    return row;
  }

  async listAll(): Promise<Array<Record<string, unknown>>> {
    return [];
  }

  async pullChangesSince(): Promise<Array<Record<string, unknown>>> {
    return [];
  }
}

describe("ensureDefaultExpenseCategories quando a categoria padrao ja existe no servidor", () => {
  it("gerar o primeiro acerto de compra nao trava mesmo com a categoria ja criada remotamente (pull ainda nao refletido localmente)", async () => {
    const userData = mkdtempSync(join(tmpdir(), "operacoes-expense-categories-"));
    tempDirs.push(userData);
    const dirs = resolveAppDirectories(userData);
    ensureAppDirectories(dirs);
    const db = initializeDatabase(dirs);
    const cloud = new DuplicateKeyEnforcingFakeSharedRepository();
    const repo = new AppRepository(db, dirs, cloud as unknown as SharedRepository);
    repo.saveInstallationProfile({ installationName: "Villa", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });

    try {
      // Simula o servidor ja tendo a categoria "RENT" (outro PC criou
      // primeiro, ou um pull anterior nesta mesma sessao ainda nao foi
      // refletido no SQLite local) -- mesmo id deterministico que
      // ensureDefaultExpenseCategories vai calcular. Nome "desatualizado" de
      // proposito pra' distinguir "nunca chegou a empurrar" de "empurrou e
      // corrigiu" (trySharedReferenceWrite so' loga aviso e segue --
      // resolves.not.toThrow() sozinho nao provaria nada aqui).
      const rentId = deterministicUuid("expenseCategory", villaId, "RENT");
      cloud.seedExisting({ id: rentId, organization_id: villaId, code: "RENT", name: "DESATUALIZADO" });

      const categories = await repo.listExpenseCategories(villaId);
      expect(categories.length).toBeGreaterThanOrEqual(11);
      expect(categories.some((category) => category.code === "RENT")).toBe(true);

      // Antes da correcao (insertRow puro), o push da categoria RENT
      // colidia com "duplicate key value violates unique constraint" e o
      // erro so' era logado como aviso (trySharedReferenceWrite) -- a linha
      // no servidor simulado ficava presa com o nome desatualizado pra
      // sempre (so' se corrigiria na proxima sincronizacao completa manual).
      // Com upsertRow, o push corrige a linha na hora.
      expect(cloud.get(rentId)?.name).toBe("Aluguel");
    } finally {
      db.close();
    }
  });
});
