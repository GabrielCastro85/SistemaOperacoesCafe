import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import { chargeBankDetails, chargeBankFormValues } from "../src/shared/utils/chargeBankDetails";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

function setup() {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-charge-bank-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Villa", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  return { repo, db, dirs };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

const confirmationAccount = {
  defaultBankName: "Santander", defaultBankCode: "033", defaultBankAgency: "2479", defaultBankAccount: "130009247",
  defaultBankAccountType: "CONTA CORRENTE", defaultPixKey: "44.963.370/0005-23", defaultPixKeyType: "CNPJ"
};

describe("conta das cobrancas separada da conta das confirmacoes", () => {
  it("salvar a conta da cobranca nao altera a conta usada nas confirmacoes", async () => {
    const { repo, db } = setup();
    try {
      const entity = repo.getLegalEntity(ownLegalEntityId);
      await repo.updateLegalEntity(entity.id, { ...entity, ...confirmationAccount });

      // Sem conta propria, a cobranca usa a da confirmacao.
      const before = repo.getLegalEntity(ownLegalEntityId);
      expect(chargeBankDetails(before).bankAccount).toBe("130009247");

      // Mesmo fluxo da tela de cobranca: parte da conta atual e troca so os campos charge*.
      await repo.updateLegalEntity(before.id, { ...before, ...chargeBankFormValues(before), chargeBankAccount: "13000793-9", chargePixKey: "44.963.370/0004-42" });
      const saved = repo.getLegalEntity(ownLegalEntityId);
      expect(saved.defaultBankAccount).toBe("130009247");
      expect(saved.defaultPixKey).toBe("44.963.370/0005-23");
      expect(chargeBankDetails(saved)).toMatchObject({ bankName: "Santander", bankAgency: "2479", bankAccount: "13000793-9", pixKey: "44.963.370/0004-42" });

      const draft = repo.createDealConfirmationDraft({ organizationId: villaId, ownLegalEntityId, confirmationDate: "2026-11-03", paymentTermsSnapshot: "A prazo" });
      expect(draft.confirmation.bankAccount).toBe("130009247");
      expect(draft.confirmation.pixKey).toBe("44.963.370/0005-23");

      // Tela de empresas sem os campos charge* (versao antiga do formulario) nao apaga a conta da cobranca.
      const { chargeBankName, chargeBankCode, chargeBankAgency, chargeBankAccount, chargeBankAccountType, chargeBankHolderName, chargeBankHolderDocument, chargePixKey, chargePixKeyType, ...withoutCharge } = saved;
      void [chargeBankName, chargeBankCode, chargeBankAgency, chargeBankAccount, chargeBankAccountType, chargeBankHolderName, chargeBankHolderDocument, chargePixKey, chargePixKeyType];
      await repo.updateLegalEntity(saved.id, { ...withoutCharge, defaultBankAgency: "3318" });
      const afterConfirmationEdit = repo.getLegalEntity(ownLegalEntityId);
      expect(afterConfirmationEdit.defaultBankAgency).toBe("3318");
      expect(chargeBankDetails(afterConfirmationEdit).bankAccount).toBe("13000793-9");
    } finally {
      db.close();
    }
  });

  it("a migracao nao marca as empresas como alteradas para a sincronizacao", () => {
    const { db, dirs } = setup();
    try {
      const columns = ["charge_bank_name", "charge_bank_code", "charge_bank_agency", "charge_bank_account", "charge_bank_account_type", "charge_bank_holder_name", "charge_bank_holder_document", "charge_pix_key", "charge_pix_key_type"];
      const hash = (row: Record<string, unknown>) => createHash("sha256").update(JSON.stringify(row, Object.keys(row).sort())).digest("hex");
      const rows = db.prepare("SELECT * FROM legal_entities").all() as Array<Record<string, unknown>>;
      // Simula o estado anterior: baseline calculado sem as colunas novas, e a migracao ainda nao aplicada.
      for (const row of rows) {
        const before = Object.fromEntries(Object.entries(row).filter(([column]) => !columns.includes(column)));
        db.prepare("INSERT OR REPLACE INTO central_sync_baseline(table_name, row_key, row_sha256) VALUES ('legal_entities', ?, ?)").run(row.id, hash(before));
      }
      const dirtyRow = rows[0];
      db.prepare("UPDATE central_sync_baseline SET row_sha256 = 'pendente' WHERE table_name = 'legal_entities' AND row_key = ?").run(dirtyRow.id);
      for (const column of columns) db.exec(`ALTER TABLE legal_entities DROP COLUMN ${column}`);
      db.prepare("DELETE FROM migration_history WHERE migration_name = '061_legal_entity_charge_bank_account'").run();
      db.close();

      const reopened = { db: initializeDatabase(dirs) };
      const baseline = new Map((reopened.db.prepare("SELECT row_key AS key, row_sha256 AS sha256 FROM central_sync_baseline WHERE table_name = 'legal_entities'").all() as Array<{ key: string; sha256: string }>).map((row) => [row.key, row.sha256]));
      for (const row of reopened.db.prepare("SELECT * FROM legal_entities").all() as Array<Record<string, unknown>>) {
        if (row.id === dirtyRow.id) expect(baseline.get(String(row.id))).toBe("pendente");
        else expect(baseline.get(String(row.id))).toBe(hash(row));
      }
      reopened.db.close();
    } catch (error) {
      if (db.open) db.close();
      throw error;
    }
  });
});
