/* global console, fetch */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { getVariant, variants } from "./variant-config.mjs";

const variantName = process.argv[2] ?? "multiempresa";
const mode = process.argv.includes("--installer") ? "installer" : "dir";
const skipBuild = process.argv.includes("--skip-build");
const collectorOnly = process.argv.includes("--collector-only");
const variant = getVariant(variantName);
const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const outputDir = join(root, "release", variant.variant, version);
const configPath = join(outputDir, `electron-builder.${variant.variant}.json`);
const UPDATE_FEED_OWNER = "GabrielCastro85";
const UPDATE_FEED_REPO = "SistemaOperacoesCafe-releases";

if (collectorOnly) {
  const token = readGithubToken();
  const executablePath = join(root, "output", "collector", `ColetorGraoBase-${version}-portable.exe`);
  if (!existsSync(executablePath)) run("npm", ["run", "collector:build"]);
  await publishCollectorAssets(token, `v${version}`);
  process.exit(0);
}

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
    await uploadReleaseAsset(token, release.id, assetPath);
    console.log(`Arquivo do coletor publicado: ${name}`);
  }
}

function uploadReleaseAsset(token, releaseId, assetPath) {
  const name = basename(assetPath);
  const size = statSync(assetPath).size;
  const path = `/repos/${UPDATE_FEED_OWNER}/${UPDATE_FEED_REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
  return new Promise((resolve, reject) => {
    const request = httpsRequest({
      hostname: "uploads.github.com",
      path,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "sistema-operacoes-cafe-release-script",
        "Content-Type": "application/octet-stream",
        "Content-Length": size
      }
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode === 201) resolve();
        else reject(new Error(`Falha ao publicar ${name} (${response.statusCode}): ${body.slice(0, 300)}`));
      });
    });
    request.on("error", reject);
    createReadStream(assetPath).on("error", reject).pipe(request);
  });
}

function latestDatabaseMigrationVersion() {
  const source = readFileSync(join(root, "electron", "main", "database", "migrations.ts"), "utf8");
  const names = Array.from(source.matchAll(/^\s*name:\s*"([^"]+)",?\s*$/gm), (match) => match[1]);
  return names.at(-1) ?? null;
}

function releaseNotes(currentVariant, releaseVersion) {
  const highlights = releaseVersion === "1.1.60"
    ? `- A tela Notas e operacoes passa a abrir diretamente em Notas emitidas.
- Saldos manuais e movimentos de NF-e de armazem passam a ser vinculados pelo CNPJ, mesmo quando os nomes sao diferentes.
- Retornos com descricao generica reaproveitam a classificacao manual quando ha um unico produto identificado no armazem.
- Evita criar uma segunda linha negativa quando uma nota de retorno deve abater o saldo informado manualmente.
- Novos ajustes manuais exigem o CNPJ completo do armazem para garantir o vinculo com futuras NF-e.`
    : releaseVersion === "1.1.59"
    ? `- Remove a consulta direta de NF-e na SEFAZ para evitar disputa de NSU com a Vulpe, que permanece como fonte prioritaria dos XMLs.
- Reconhece automaticamente notas de remessa e retorno de armazem pelo CFOP durante a importacao do XML.
- Movimentacoes de armazem deixam de exigir fornecedor e campos comerciais.
- A tela mostra se as sacas serao acrescentadas ou descontadas sem gerar compra, venda ou cobranca.`
    : releaseVersion === "1.1.58"
    ? `- Consulta diretamente na SEFAZ as NF-e recebidas por cada CNPJ proprio usando o certificado digital instalado no Windows.
- Permite buscar novas notas pela distribuicao de documentos fiscais ou localizar uma NF-e pela chave de acesso.
- XMLs completos entram na fila normal de revisao e importacao, sem exigir selecao manual do arquivo.
- Quando a SEFAZ exigir Ciencia da Operacao, o programa pede confirmacao explicita antes de registrar o evento.`
    : releaseVersion === "1.1.57"
    ? `- Reorganiza a tela de notas em areas separadas para notas recebidas, notas emitidas, lancamento manual e planilhas.
- A busca automatica filtra entradas e saidas por empresa e identifica razao social e CNPJ exatos do fornecedor ou cliente.
- O lancamento manual exige a escolha do CNPJ correto, evitando misturar filiais de um mesmo fornecedor ou cliente.
- Prepara o coletor para as notas da Villa Coffee SP e oculta cadastros tecnicos de XML da lista de CNPJs proprios.`
    : releaseVersion === "1.1.56"
    ? `- Corrige os paineis do controle de cafes armazenados que ficavam comprimidos em janelas com menor altura.
- Reconhece referencias de remessa com separador de milhar, como NF-e REMESSA 1.344.
- Retornos simbolicos vinculam corretamente a remessa original e atualizam o estoque armazenado.
- Reduz varreduras completas do banco durante a sincronizacao para diminuir pequenas travadas.`
    : releaseVersion === "1.1.55"
    ? `- Novo controle de cafes armazenados em terceiros, com saldo por armazem, empresa e produto em quilos e sacas.
- Reconhecimento automatico das NF-e de remessa, retorno fisico, remessa simbolica e retorno simbolico.
- O coletor passa a reconhecer notas em que a empresa e emitente ou destinataria e aplica cancelamentos ao estoque.
- Movimentos simbolicos sem referencia clara ficam separados para conferencia manual.
- Sincronizacao e consultas automaticas foram ajustadas para reduzir travamentos e uso de memoria.`
    : releaseVersion === "1.1.54"
    ? `- A conferencia de repasses reune notas da Villa Coffee e da Grao & Grao para o mesmo cliente ou fornecedor e identifica a origem de cada nota.
- Nos pagamentos, somente o valor precisa ser informado; os demais campos passam a ser opcionais.
- O campo de valor vazio recebe um alerta visual, e a tecla Tab cria automaticamente a proxima linha de pagamento.`
    : releaseVersion === "1.1.53"
    ? `- A lista de fechamentos passa a mostrar o comprador nas vendas e o vendedor nas compras.
- O PDF de fechamento ganha uma terceira area de assinatura para o corretor.
- O rodape do fechamento foi simplificado para exibir somente a marca discreta Gerado por Graonex.`
    : releaseVersion === "1.1.52"
    ? `- A conferencia de repasses passa a aceitar notas de saida de clientes e notas de entrada de fornecedores.
- Adicionada a opcao de criar uma conferencia sem notas fiscais, informando diretamente um valor inicial.
- Novos pagamentos podem ser incluidos posteriormente e sao abatidos automaticamente do saldo da conferencia manual.
- O historico identifica se a origem do valor foi uma lista de notas ou um valor informado manualmente.`
    : releaseVersion === "1.1.49"
    ? `- A lista de fechamentos pode ser filtrada por empresa e periodo e ordenada pela numeracao ou pela data.
- Fechamentos de compra deixam de mostrar os dados bancarios da empresa compradora e passam a indicar que o deposito sera combinado com o vendedor.
- Os arquivos de previa e confirmacao passam a incluir a numeracao completa do fechamento e a contraparte no nome sugerido.`
    : releaseVersion === "1.1.48"
    ? `- O card Valor total dos servicos soma todos os servicos do periodo selecionado.
- O total inclui operacoes ja cobradas e ainda nao cobradas.
- Villa Coffee e Grao & Grao, com todos os seus CNPJs, entram no mesmo valor corporativo.`
    : releaseVersion === "1.1.47"
    ? `- Cada regra por saca pode ter um valor normal e outro valor quando o servico inclui financeiro.
- A condicao com financeiro e marcada manualmente durante a revisao do XML e pode ser corrigida depois na nota.
- Ao alterar a marcacao, o sistema recalcula automaticamente o servico antes da cobranca.
- O dashboard passa a mostrar o valor bruto de todos os servicos do periodo, sem descontar valores recebidos.`
    : releaseVersion === "1.1.46"
    ? `- Acrescimos e emprestimos vinculados a cobranca agora podem ser selecionados diretamente para baixa.
- O pagamento pode incluir somente o acrescimo ou combinar notas e acrescimos na mesma operacao.
- Recibos identificam o acrescimo separadamente e nao atribuem seu valor novamente as notas fiscais.`
    : releaseVersion === "1.1.43"
    ? `- Dashboard avisa quando existem notas do mes anterior que ainda nao entraram em uma cobranca.
- Pendencias sao agrupadas por cliente e mostram notas, DAE de frete e valor total.
- O botao Gerar cobranca abre o cliente e o periodo corretos diretamente na tela de cobrancas.
- A opcao Ignorar cobranca oculta as pendencias escolhidas e mantem a decisao sincronizada entre os computadores.`
    : releaseVersion === "1.1.42"
    ? `- O controle interno passa a incluir somente cobrancas com saldo realmente em aberto.
- Cobrancas quitadas sao descartadas e cobrancas fora do periodo so entram quando a opcao correspondente for marcada.
- A planilha mostra o saldo restante e a impressao foi compactada para papel A4 vertical.`
    : releaseVersion === "1.1.41"
    ? `- Adiciona a opcao Estornar baixa no historico de pagamentos da cobranca.
- Ao estornar, o valor volta para o saldo em aberto e a cobranca e reaberta automaticamente.
- O pagamento original e o motivo do estorno permanecem registrados para auditoria.`
    : releaseVersion === "1.1.40"
    ? `- Adiciona um controle interno de pagamentos pronto para impressao na tela de cobrancas.
- Permite escolher o periodo das cobrancas e incluir, opcionalmente, todas as cobrancas ainda em aberto.
- Cada cobranca mostra cliente, periodo, valor e duas linhas para registrar pagamentos parciais e suas datas.
- O controle pode ser enviado diretamente para a impressora ou exportado para Excel.`
    : releaseVersion === "1.1.39"
    ? `- Cobrancas de operacoes terceirizadas passam a mostrar a razao social do destinatario registrada no XML.
- A lista de notas, a previa em PDF, a imagem e a cobranca definitiva identificam corretamente a empresa que recebeu a NF-e.
- O cliente/corretor continua sendo o responsavel financeiro pela cobranca, sem substituir o destinatario fiscal no documento.`
    : releaseVersion === "1.1.38"
    ? `- Detecta quando o processo do coletor continua aberto, mas parou de varrer e de se comunicar.
- Reinicia automaticamente o coletor depois de dez minutos sem atividade.
- Limita o tempo das conexoes para impedir que uma falha de rede deixe a coleta travada.`
    : releaseVersion === "1.1.37"
    ? `- Corrige o coletor que podia ser encerrado pelo Agendador do Windows poucos minutos depois de iniciar.
- O coletor passa a manter uma vigilancia interna e tenta se reabrir quando o processo encerra inesperadamente.
- Instalacoes antigas tem o limite de execucao das tarefas reparado automaticamente quando houver permissao.`
    : releaseVersion === "1.1.36"
    ? `- PDFs de cobranca passam a listar tambem as notas ja pagas no periodo, em uma secao informativa separada.
- Monitor do coletor permite buscar notas, procurar atualizacoes e reiniciar o agente remotamente.
- Diagnostico remoto mostra inicio, tempo ativo, inicializacao automatica, ultimo comando e registros recentes.
- Instalacao do coletor usa uma pasta local do Windows e vigilancia a cada dois minutos para iniciar mesmo sem login.`
    : releaseVersion === "1.1.35"
    ? `- Confirmacoes de negocio agora permitem fechamentos de compra com ou sem nota fiscal.\n- DAE de frete pode ser informado durante a importacao da NF-e e entra na cobranca do cliente.\n- Dashboard soma somente as sacas vendidas, sem misturar compras no indicador comercial.\n- Sincronizacao central suporta lotes maiores de alteracoes com retomada segura.`
    : releaseVersion === "1.1.34"
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
