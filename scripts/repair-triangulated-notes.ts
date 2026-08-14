// Conserto retroativo pra nota triangulada importada ANTES do fix de
// reconhecimento de parceiro entre empresas (Villa/Grao & Grao). O fix so'
// vale pra importacoes novas -- nota que ja ficou salva sem a segunda perna
// (secondary_responsible_partner_id nulo) continua faltando ate alguem
// completar manualmente ou rodar este script.
//
// So' repara nota cuja empresa propria (own_legal_entity_id) ja esta certa
// (Villa ou Grao & Grao de verdade) -- nao mexe em nota cujo own_legal_entity_id
// ficou apontando pra uma empresa terceirizada fabricada, isso e' uma
// correcao diferente e mais arriscada (pode ja ter cobranca/acerto feito em
// cima da operacao errada), fora do escopo deste script.
//
// Uso:
//   npx tsx scripts/repair-triangulated-notes.ts                 (so' mostra o que seria feito, nao altera nada)
//   npx tsx scripts/repair-triangulated-notes.ts --apply          (aplica de verdade)
//   npx tsx scripts/repair-triangulated-notes.ts --userData "C:\caminho\para\a\instalacao" --apply
//
// Por padrao, aponta para a instalacao de PRODUCAO
// (%APPDATA%\Sistema de Operacoes de Cafe Multiempresa). Feche o aplicativo
// antes de rodar este script.

import { copyFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

function parseArgs(): { userData: string; apply: boolean } {
  const args = process.argv.slice(2);
  const getFlag = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const userData = getFlag("--userData") ?? join(homedir(), "AppData", "Roaming", "Sistema de Operacoes de Cafe Multiempresa");
  return { userData, apply: args.includes("--apply") };
}

function main(): void {
  const { userData, apply } = parseArgs();
  const dirs = resolveAppDirectories(userData);
  if (!existsSync(dirs.databasePath)) {
    console.error(`Banco nao encontrado em: ${dirs.databasePath}`);
    console.error('Use --userData "<pasta>" para apontar para a instalacao correta.');
    process.exit(1);
  }

  console.log(`Banco: ${dirs.databasePath}`);
  console.log(apply ? "Modo: APLICAR (vai alterar o banco)" : "Modo: SOMENTE LEITURA (nada sera alterado -- rode com --apply pra aplicar de verdade)");

  if (apply) {
    const backupPath = `${dirs.databasePath}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    copyFileSync(dirs.databasePath, backupPath);
    console.log(`Backup criado antes de qualquer alteracao: ${backupPath}`);
  }

  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db);

  const result = repo.repairMissingTriangulatedSecondaryLegs({ apply });

  console.log(`\n${result.scanned} nota(s) sem segunda perna encontrada(s) no banco pra revisar.`);
  if (result.repaired.length === 0) {
    console.log("Nenhuma nota elegivel pra reparo automatico (a contraparte precisa estar cadastrada com o papel oposto -- fornecedor/cliente -- pra ser reconhecida como a segunda perna).");
  } else {
    console.log(`\n${apply ? "Reparada(s)" : "Seria(m) reparada(s)"} ${result.repaired.length} nota(s):\n`);
    result.repaired.forEach((item) => {
      const operationLabel = item.secondaryOperationType === "PURCHASE" ? "compra" : "venda";
      console.log(`  NF ${item.documentNumber} (${item.ownLegalEntityName}) -- segunda perna: ${item.secondaryPartnerName} (${operationLabel})`);
    });
  }

  db.close();

  if (!apply && result.repaired.length > 0) {
    console.log("\nNada foi alterado. Rode de novo com --apply pra aplicar de verdade.");
  }
}

main();
