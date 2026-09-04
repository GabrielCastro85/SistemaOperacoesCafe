import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import type { SharedRepository } from "../electron/main/services/sharedRepository";

// Cobre o self-healing de sessao (ver SharedRepository.attemptSessionRecovery
// em sharedRepository.ts): antes desta correcao, uma sessao Supabase perdida
// por qualquer motivo transitorio (ex: rede ainda nao pronta logo apos o
// processo relancar por causa de uma atualizacao via quitAndInstall) ficava
// presa "deslogada" pelo resto do processo -- syncSharedDataDown() so' fazia
// query direto, sem nunca tentar recuperar a sessao. Agora cada ciclo de
// sync (chamado a cada 20s, ver startSharedDataSync em main/index.ts) tenta
// recuperar primeiro.
const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

class FakeSharedRepository {
  recoveryCalls = 0;
  private sessionPresent: boolean;

  constructor(sessionPresent: boolean) {
    this.sessionPresent = sessionPresent;
  }

  checkConnectivity = async () => ({ online: true, authenticated: this.sessionPresent, error: null });

  async getSession(): Promise<{ user: { email: string } } | null> {
    return this.sessionPresent ? { user: { email: "gabriel_castro8@hotmail.com" } } : null;
  }

  async attemptSessionRecovery(): Promise<boolean> {
    this.recoveryCalls += 1;
    // Simula a recuperacao ter sucesso na primeira chamada apos a sessao ter
    // caido -- exatamente o cenario "hiccup transitorio logo apos o relance".
    this.sessionPresent = true;
    return this.sessionPresent;
  }

  async pullChangesSince(): Promise<Array<Record<string, unknown>>> {
    return [];
  }
}

function setup(sessionPresent: boolean): { db: ReturnType<typeof initializeDatabase>; repo: AppRepository; cloud: FakeSharedRepository } {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-session-recovery-"));
  tempDirs.push(userData);
  const directories = resolveAppDirectories(userData);
  ensureAppDirectories(directories);
  const db = initializeDatabase(directories);
  const cloud = new FakeSharedRepository(sessionPresent);
  const repo = new AppRepository(db, directories, cloud as unknown as SharedRepository);
  repo.saveInstallationProfile({ installationName: "Villa", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  return { db, repo, cloud };
}

describe("reconexao automatica da sessao Supabase", () => {
  it("syncSharedDataDown tenta recuperar a sessao antes de puxar dados", async () => {
    const { db, repo, cloud } = setup(false);
    expect(await repo.isSharedConnected()).toBe(false);

    await repo.syncSharedDataDown();

    expect(cloud.recoveryCalls).toBe(1);
    expect(await repo.isSharedConnected()).toBe(true);
    db.close();
  });

  it("cada ciclo de sync tenta recuperar de novo, mesmo sem sessao nenhuma", async () => {
    const { db, repo, cloud } = setup(false);
    cloud.attemptSessionRecovery = async () => {
      cloud.recoveryCalls += 1;
      return false;
    };

    await repo.syncSharedDataDown();
    await repo.syncSharedDataDown();
    await repo.syncSharedDataDown();

    expect(cloud.recoveryCalls).toBe(3);
    expect(await repo.isSharedConnected()).toBe(false);
    db.close();
  });
});
