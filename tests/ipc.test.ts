import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { createDiagnostics } from "../electron/main/ipc/handlers";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import { SharedRepository } from "../electron/main/services/sharedRepository";
import { buildVariantConfigs } from "../src/shared/buildVariants";

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("diagnostics IPC handler logic", () => {
  it("returns safe diagnostic information", () => {
    const userData = mkdtempSync(join(tmpdir(), "operacoes-cafe-ipc-"));
    tempDirs.push(userData);
    const directories = resolveAppDirectories(userData);
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);
    const repo = new AppRepository(db);
    repo.saveInstallationProfile({
      installationName: "Teste IPC",
      appVariant: "villa",
      defaultOrganizationId: "11111111-1111-4111-8111-111111111111",
      defaultLegalEntityId: "33333333-3333-4333-8333-333333333331",
      allowOrganizationSwitch: false,
      allowLegalEntitySwitch: true,
      completedSetup: true
    });
    const diagnostics = createDiagnostics({ version: "1.0.0-rc.1", directories, db, buildVariant: buildVariantConfigs.multiempresa, sharedRepository: new SharedRepository(directories) }, repo);
    expect(diagnostics.databaseStatus).toBe("ok");
    expect(diagnostics.activeVariant).toBe("multiempresa");
    expect(diagnostics.productName).toBe("Sistema de Operacoes de Cafe");
    expect(diagnostics.appId).toBe("br.com.operacoescafe.multiempresa");
    expect(diagnostics.executableName).toBe("SistemaOperacoesCafe");
    expect(diagnostics.signatureStatus).toBe("UNSIGNED");
    expect(diagnostics.databasePath).toContain("operations.sqlite");
    db.close();
  });
});
