/* global console, fetch */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { getVariant, variants } from "./variant-config.mjs";

const variantName = process.argv[2] ?? "multiempresa";
const mode = process.argv.includes("--installer") ? "installer" : "dir";
const skipBuild = process.argv.includes("--skip-build");
const variant = getVariant(variantName);
const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const outputDir = join(root, "release", variant.variant, version);
const configPath = join(outputDir, `electron-builder.${variant.variant}.json`);

mkdirSync(outputDir, { recursive: true });

if (!existsSync(join(root, variant.iconPath))) {
  run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/release/generate-icons.ps1"]);
}

if (!skipBuild) {
  run("npm", ["run", "build"], { OPERACOES_CAFE_VARIANT: variant.variant, VITE_APP_BUILD_VARIANT: variant.variant });
}

run("npm", ["run", "rebuild:electron"]);

// Feed de atualizacao automatica: GitHub Releases num repositorio publico
// dedicado so' a guardar instaladores (nao tem o codigo-fonte, que continua
// no repositorio privado/principal). Publico porque o electron-updater dos
// PCs baixa os assets sem token nenhum -- um repo privado exigiria embutir
// uma credencial no app instalado, o que nao vale a pena aqui.
const UPDATE_FEED_OWNER = "GabrielCastro85";
const UPDATE_FEED_REPO = "SistemaOperacoesCafe-releases";

const config = {
  appId: variant.appId,
  productName: variant.productName,
  executableName: variant.executableName,
  copyright: variant.copyright,
  directories: { output: `release/${variant.variant}/${version}` },
  files: ["dist/**", "dist-electron/**", "package.json"],
  publish: {
    provider: "github",
    owner: UPDATE_FEED_OWNER,
    repo: UPDATE_FEED_REPO,
    // Por padrao o electron-builder cria a release como rascunho (draft) --
    // rascunho fica invisivel pro electron-updater (e pra API publica), entao
    // sem isso o feed de atualizacao nunca encontraria a versao nova. Como a
    // versao sempre carrega um sufixo de prerelease (-beta.N), publica como
    // prerelease do GitHub em vez de "release" definitiva.
    releaseType: "release"
  },
  extraMetadata: {
    name: pkg.name,
    version,
    productName: variant.productName,
    operacoesCafeVariant: variant.variant,
    description: variant.description,
    author: pkg.author,
    license: pkg.license
  },
  asar: true,
  // O modulo nativo ja foi compilado explicitamente por rebuild:electron
  // logo acima. Impede o electron-builder de recompila-lo novamente usando
  // o ABI do Node que esta executando o empacotamento.
  npmRebuild: false,
  asarUnpack: ["node_modules/better-sqlite3/**"],
  extraResources: [{ from: variant.iconPath, to: `icons/${basename(variant.iconPath)}` }],
  afterPack: "scripts/after-pack-prune.mjs",
  compression: "maximum",
  removePackageScripts: true,
  win: {
    target: mode === "installer" ? [{ target: "nsis", arch: ["x64"] }] : [{ target: "dir", arch: ["x64"] }],
    icon: variant.iconPath,
    artifactName: `${variant.artifactPrefix}-Setup-${version}-${"${arch}"}.${"${ext}"}`,
    requestedExecutionLevel: "asInvoker",
    legalTrademarks: ""
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: variant.displayName,
    uninstallDisplayName: variant.displayName,
    runAfterFinish: true,
    language: "1046",
    deleteAppDataOnUninstall: false,
    installerIcon: variant.iconPath,
    uninstallerIcon: variant.iconPath
  }
};

writeFileSync(configPath, JSON.stringify(config, null, 2));
// --publish always so' publica de verdade quando --installer foi pedido e
// --skip-upload nao foi passado; nos demais casos (--dir, ou build local pra
// testar) so' gera o .yml de metadados sem tentar criar release no GitHub.
const shouldPublish = mode === "installer" && !process.argv.includes("--skip-upload");
const githubToken = shouldPublish ? readGithubToken() : "";
run("npx", ["electron-builder", "--win", "--config", configPath, "--publish", shouldPublish ? "always" : "never"], {
  OPERACOES_CAFE_VARIANT: variant.variant,
  VITE_APP_BUILD_VARIANT: variant.variant,
  GH_TOKEN: githubToken
});
run("npm", ["run", "smoke:packaged", "--", variant.variant]);

if (shouldPublish) {
  // electron-builder sempre cria a release como rascunho (draft) primeiro e
  // so' publica de verdade no final do processo -- na pratica isso as vezes
  // nao acontece (observado com token fine-grained), deixando a release
  // presa como draft e invisivel pro electron-updater. Garante aqui via API
  // direta que ela fica publicada, independente do comportamento interno do
  // electron-builder.
  await publishGithubRelease(githubToken, `v${version}`);
  run("npm", ["run", "collector:build"]);
  await publishCollectorAssets(githubToken, `v${version}`);
}

writeReleaseFiles(outputDir, variant, version, mode);

async function publishGithubRelease(token, tagName) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "sistema-operacoes-cafe-release-script"
  };
  const getResponse = await fetch(`https://api.github.com/repos/${UPDATE_FEED_OWNER}/${UPDATE_FEED_REPO}/releases/tags/${tagName}`, { headers });
  if (!getResponse.ok) {
    console.error(`Nao foi possivel localizar a release ${tagName} no GitHub pra confirmar publicacao (status ${getResponse.status}).`);
    return;
  }
  const release = await getResponse.json();
  if (!release.draft) {
    console.log(`Release ${tagName} ja estava publicada (nao era rascunho).`);
    return;
  }
  const patchResponse = await fetch(`https://api.github.com/repos/${UPDATE_FEED_OWNER}/${UPDATE_FEED_REPO}/releases/${release.id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      draft: false,
      prerelease: version.includes("-"),
      name: `${variant.displayName} ${version}`,
      body: releaseNotes(variant, version)
    })
  });
  if (!patchResponse.ok) {
    console.error(`Falha ao publicar a release ${tagName} (status ${patchResponse.status}) -- ela ficou como rascunho, publique manualmente no GitHub.`);
    return;
  }
  console.log(`Release ${tagName} publicada (deixou de ser rascunho).`);
}

function readGithubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) {
    console.error("GH_TOKEN nao encontrado (nem em process.env, nem em .env) -- necessario pra publicar a release no GitHub.");
    process.exit(1);
  }
  const line = readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("GH_TOKEN="));
  if (!line) {
    console.error("GH_TOKEN nao encontrado no .env -- necessario pra publicar a release no GitHub.");
    process.exit(1);
  }
  return line.slice("GH_TOKEN=".length).trim();
}

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv }
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function writeReleaseFiles(dir, currentVariant, releaseVersion, channel) {
  const expectedInstallerName = `${currentVariant.artifactPrefix}-Setup-${releaseVersion}-x64.exe`;
  const artifacts = readdirSync(dir)
    .filter((name) => {
      if (channel === "installer") return name === expectedInstallerName;
      return name === "win-unpacked";
    })
    .map((name) => join(dir, name));
  const sums = artifacts.map((artifact) => `${sha256Path(artifact)}  ${basename(artifact)}`).join("\n");
  writeFileSync(join(dir, "SHA256SUMS.txt"), `${sums}\n`);
  const installer = artifacts.find((item) => item.endsWith(".exe")) ?? artifacts[0] ?? "";
  const manifest = {
    releaseVersion,
    releaseDate: new Date().toISOString(),
    channel,
    applicationVariant: currentVariant.variant,
    productName: currentVariant.productName,
    appId: currentVariant.appId,
    architecture: "x64",
    operatingSystem: "win32",
    minimumOperatingSystem: "Windows 10 x64",
    artifactFileName: installer ? basename(installer) : null,
    artifactSize: installer ? sizeOfPath(installer) : 0,
    artifactSha256: installer ? sha256Path(installer) : null,
    signed: false,
    signingSubject: null,
    databaseMigrationVersion: latestDatabaseMigrationVersion(),
    backupFormatVersion: 1,
    confirmationDocumentVersion: 1,
    buildCommit: gitCommit(),
    buildTimestamp: new Date().toISOString(),
    notesFile: "release-notes.md",
    knownLimitations: ["Artefato local nao assinado; Windows SmartScreen pode exibir alerta."]
  };
  mkdirSync(join(root, "release", "manifests"), { recursive: true });
  writeFileSync(join(dir, "release-manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(root, "release", "manifests", `${currentVariant.variant}-${releaseVersion}.json`), JSON.stringify(manifest, null, 2));
  writeFileSync(join(dir, "release-notes.md"), releaseNotes(currentVariant, releaseVersion));
}

function sha256Path(path) {
  const hash = createHash("sha256");
  if (statSync(path).isDirectory()) {
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

function sizeOfPath(path) {
  const stat = statSync(path);
  return stat.isDirectory() ? walk(path).reduce((sum, file) => sum + statSync(file).size, 0) : stat.size;
}

function gitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", shell: process.platform === "win32" });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function publishCollectorAssets(token, tagName) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "sistema-operacoes-cafe-release-script"
  };
  const releaseResponse = await fetch(`https://api.github.com/repos/${UPDATE_FEED_OWNER}/${UPDATE_FEED_REPO}/releases/tags/${tagName}`, { headers });
  if (!releaseResponse.ok) throw new Error(`Release ${tagName} nao encontrada para publicar o coletor.`);
  const release = await releaseResponse.json();
  const executableName = `ColetorGraoBase-${version}-portable.exe`;
  const executablePath = join(root, "output", "collector", executableName);
  if (!existsSync(executablePath)) throw new Error(`Executavel do coletor nao encontrado: ${executablePath}`);
  const checksum = sha256Path(executablePath);
  const checksumPath = `${executablePath}.sha256`;
  writeFileSync(checksumPath, `${checksum}  ${executableName}\n`, "utf8");

  for (const assetPath of [executablePath, checksumPath]) {
    const name = basename(assetPath);
    const existing = Array.isArray(release.assets) ? release.assets.find((asset) => asset.name === name) : null;
    if (existing) {
      const deletion = await fetch(`https://api.github.com/repos/${UPDATE_FEED_OWNER}/${UPDATE_FEED_REPO}/releases/assets/${existing.id}`, { method: "DELETE", headers });
      if (!deletion.ok && deletion.status !== 404) throw new Error(`Falha ao substituir o arquivo ${name} (${deletion.status}).`);
    }
    const content = readFileSync(assetPath);
    const upload = await fetch(`https://uploads.github.com/repos/${UPDATE_FEED_OWNER}/${UPDATE_FEED_REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Length": String(content.length) },
      body: content
    });
    if (!upload.ok) throw new Error(`Falha ao publicar ${name} (${upload.status}): ${(await upload.text()).slice(0, 300)}`);
    console.log(`Arquivo do coletor publicado: ${name}`);
  }
}

function latestDatabaseMigrationVersion() {
  const source = readFileSync(join(root, "electron", "main", "database", "migrations.ts"), "utf8");
  const names = Array.from(source.matchAll(/^\s*name:\s*"([^"]+)",?\s*$/gm), (match) => match[1]);
  return names.at(-1) ?? null;
}

function releaseNotes(currentVariant, releaseVersion) {
  const highlights = releaseVersion === "1.1.34"
    ? `- Monitor remoto mostra se o coletor da Grao & Grao esta online e quando funcionou pela ultima vez.\n- Coletor passa a atualizar automaticamente pelas proximas versoes.\n- Inicializacao do coletor no Windows ganhou mecanismos redundantes e verificacao apos a instalacao.`
    : releaseVersion === "1.1.32"
    ? `- Login continua disponivel com a ultima copia sincronizada durante oscilacoes temporarias do servidor.\n- Dashboard destaca contas a pagar e resume as cobrancas vencidas.\n- Financeiro reorganizado, com textos em portugues, valores legiveis, baixa e edicao de contas mais acessiveis.\n- Historico de cobrancas ganhou pesquisa, filtros e carregamento por etapas.\n- Importacao de NF-e diferencia avisos e duplicidades e destaca a busca em todas as empresas.`
    : `- Build Windows x64 unico para o Sistema de Operacoes de Cafe.\n- Villa Coffee e Grao & Grao permanecem como empresas/branding dentro do mesmo app.`;
  return `# ${currentVariant.displayName} ${releaseVersion}

Canal: ${mode}

## Destaques

${highlights}
- UserData preservado em ${currentVariant.userDataDirectoryName}.
- Backup local recomendado antes de atualizar.
- Artefato sem assinatura de codigo nesta etapa.

## Limitacoes

- Sem certificado Authenticode configurado.
`;
}

export { variants };
