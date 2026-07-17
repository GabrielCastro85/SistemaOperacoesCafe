import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { variants } from "../release/variant-config.mjs";

/* global console */

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const requiredDocs = [
  "docs/USER_MANUAL.md",
  "docs/QUICK_START.md",
  "docs/DAILY_OPERATION_CHECKLIST.md",
  "docs/USER_ACCEPTANCE_TEST.md",
  "docs/RELEASE_1_0_CHECKLIST.md",
  "docs/RELEASE_1_0_ISSUES.md",
  "docs/SECURITY_REVIEW_1_0.md",
  "docs/HOMOLOGATION_REPORT_1_0.md"
];
const errors = [];

if (pkg.version !== "1.0.0-rc.1" && pkg.version !== "1.0.0") errors.push(`Versao inesperada: ${pkg.version}.`);
for (const doc of requiredDocs) {
  if (!existsSync(join(root, doc))) errors.push(`Documento ausente: ${doc}.`);
}
for (const variant of Object.values(variants)) {
  if (!existsSync(join(root, variant.iconPath))) errors.push(`Icone ausente: ${variant.iconPath}.`);
}
if (!readFileSync(join(root, "docs/HOMOLOGATION_REPORT_1_0.md"), "utf8").includes("NO-GO")) {
  errors.push("Relatorio de homologacao deve registrar decisao GO/NO-GO.");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Homologation readiness passou para ${pkg.version}.`);
