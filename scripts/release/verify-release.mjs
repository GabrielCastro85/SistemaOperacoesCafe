import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

/* global console */

const root = process.cwd();
const releaseDir = join(root, "release");
const manifestsDir = join(releaseDir, "manifests");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const verifyAll = process.argv.includes("--all");
const officialVariant = "multiempresa";
const errors = [];

if (!existsSync(manifestsDir)) errors.push("Diretorio release/manifests ausente.");

for (const manifestName of existsSync(manifestsDir) ? readdirSync(manifestsDir).filter((name) => name.endsWith(".json")) : []) {
  const manifest = JSON.parse(readFileSync(join(manifestsDir, manifestName), "utf8"));
  if (!verifyAll && manifest.releaseVersion !== pkg.version) continue;
  if (!verifyAll && manifest.applicationVariant !== officialVariant) continue;
  const variantDir = join(releaseDir, manifest.applicationVariant, manifest.releaseVersion);
  const sumsPath = join(variantDir, "SHA256SUMS.txt");
  if (!existsSync(sumsPath)) {
    errors.push(`SHA256SUMS ausente para ${manifestName}`);
    continue;
  }
  const sums = readFileSync(sumsPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
  for (const line of sums) {
    const [expected, ...fileParts] = line.split(/\s+/);
    const fileName = fileParts.join(" ");
    const artifact = join(variantDir, fileName);
    if (!existsSync(artifact)) errors.push(`Artefato ausente: ${artifact}`);
    else if (sha256Path(artifact) !== expected) errors.push(`Hash divergente: ${fileName}`);
  }
  if (!manifest.appId || !manifest.productName || !manifest.artifactSha256) errors.push(`Manifesto incompleto: ${manifestName}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Release verificado com sucesso.");

function sha256Path(path) {
  const hash = createHash("sha256");
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const file of walk(path).sort()) hash.update(file).update(readFileSync(file));
  } else {
    hash.update(readFileSync(path));
  }
  return hash.digest("hex");
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
