import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { seedClientMasterDataIfNeeded } from "../electron/main/services/clientSeed";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("seed de dados-base em banco novo (primeira instalacao)", () => {
  it("nao quebra com NOT NULL em partner_legal_entities.organization_id (regressao da migration 031)", () => {
    // Reproduz exatamente o crash de producao: banco SQLite totalmente novo
    // (sem nenhum dado local ainda), igual ao que acontece na primeira
    // abertura do app em qualquer PC. seedClientMasterDataIfNeeded roda
    // dentro do bootstrap() de electron/main/index.ts logo depois das
    // migrations -- se ele quebrar aqui, o app nunca chega a abrir.
    const userData = mkdtempSync(join(tmpdir(), "operacoes-client-seed-"));
    tempDirs.push(userData);
    const directories = resolveAppDirectories(userData);
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);

    expect(() => seedClientMasterDataIfNeeded(db)).not.toThrow();

    const seeded = db.prepare("SELECT COUNT(*) AS total FROM partner_legal_entities").get() as { total: number };
    expect(seeded.total).toBeGreaterThan(0);

    const withoutOrganization = db.prepare("SELECT COUNT(*) AS total FROM partner_legal_entities WHERE organization_id IS NULL").get() as { total: number };
    expect(withoutOrganization.total).toBe(0);

    // Idempotente: rodar de novo nao deve duplicar nem quebrar.
    const changedOnSecondRun = seedClientMasterDataIfNeeded(db);
    expect(changedOnSecondRun).toBe(0);

    db.close();
  });
});
