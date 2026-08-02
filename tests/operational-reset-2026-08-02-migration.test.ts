import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { migrations } from "../electron/main/database/migrations";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
const BEFORE_CUTOFF = "2026-08-01T19:00:00.000Z";

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase> } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-reset-2026-08-02-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({
    installationName: "Villa",
    appVariant: "villa",
    defaultOrganizationId: villaId,
    defaultLegalEntityId: ownLegalEntityId,
    allowOrganizationSwitch: false,
    allowLegalEntitySwitch: true,
    completedSetup: true
  });
  return { repo, db };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

function runMigration(db: ReturnType<typeof initializeDatabase>): void {
  const migration = migrations.find((item) => item.name === "039_operational_reset_2026_08_02");
  if (!migration) throw new Error("Migration 039_operational_reset_2026_08_02 nao encontrada.");
  migration.up(db);
}

describe("039_operational_reset_2026_08_02 (mesmo reset da madrugada, mas so' pro que ja existia antes dele)", () => {
  it("apaga nota lancada antes do reset, mas preserva nota lancada depois -- nao apaga trabalho novo de PC que so' atualiza mais tarde", async () => {
    const { repo, db } = setup();
    const product = repo.listProducts({ organizationId: villaId })[0];
    const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente Teste", notes: null, roles: ["CLIENT"], isActive: true });

    // Nota "de ontem" (antes do reset da madrugada) -- deve sumir.
    const oldDoc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partner.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "500", series: "1", issueDate: "2026-08-01", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
    const oldItem = repo.addFiscalDocumentItem({ fiscalDocumentId: oldDoc.document.id, productId: product.id, description: "Cafe", quantity: "100", unit: "SACK", unitPriceDecimal: "1000", totalAmountCents: 100000, sacksQuantity: "100" });
    repo.addOperation({ fiscalDocumentId: oldDoc.document.id, fiscalDocumentItemId: oldItem.id, ownLegalEntityId, responsiblePartnerId: partner.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-08-01", quantitySacks: "100", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    db.prepare("UPDATE fiscal_documents SET updated_at = ? WHERE id = ?").run(BEFORE_CUTOFF, oldDoc.document.id);
    db.prepare("UPDATE fiscal_document_items SET updated_at = ? WHERE fiscal_document_id = ?").run(BEFORE_CUTOFF, oldDoc.document.id);
    db.prepare("UPDATE operations SET updated_at = ? WHERE fiscal_document_id = ?").run(BEFORE_CUTOFF, oldDoc.document.id);

    // Nota lancada "hoje", depois do reset -- deve continuar existindo mesmo
    // depois da migracao rodar (simula um PC que so' atualiza pro instalador
    // novo mais tarde no dia, ja tendo lancado algo legitimo nesse meio tempo).
    const newDoc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partner.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "501", series: "1", issueDate: "2026-08-02", totalAmountCents: 200000, hasPendingIssues: false, pendingNotes: null, notes: null });

    expect(db.prepare("SELECT COUNT(*) AS c FROM fiscal_documents").get()).toMatchObject({ c: 2 });

    runMigration(db);

    const remaining = db.prepare("SELECT id FROM fiscal_documents").all() as Array<{ id: string }>;
    expect(remaining.map((row) => row.id)).toEqual([newDoc.document.id]);
    expect(db.prepare("SELECT COUNT(*) AS c FROM fiscal_document_items").get()).toMatchObject({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM operations").get()).toMatchObject({ c: 0 });

    // Cadastros nunca sao tocados por essa migracao, independente de data.
    expect(db.prepare("SELECT COUNT(*) AS c FROM business_partners").get()).toMatchObject({ c: 1 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM organizations").get()).not.toMatchObject({ c: 0 });

    db.close();
  });
});
