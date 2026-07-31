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
});
