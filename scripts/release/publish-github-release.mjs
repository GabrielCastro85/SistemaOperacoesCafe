/* global console, fetch, process */
import fs from 'node:fs';
import path from 'node:path';

const version = process.argv[2];
if (!version) throw new Error('Informe a versão a publicar.');

const env = fs.readFileSync('.env', 'utf8');
const tokenMatch = env.match(/^(?:GH_TOKEN|GITHUB_TOKEN)=(.+)$/m);
if (!tokenMatch) throw new Error('Token GitHub não encontrado no .env');
const token = tokenMatch[1].trim().replace(/^["']|["']$/g, '');
const owner = 'GabrielCastro85';
const repo = 'SistemaOperacoesCafe-releases';
const tag = `v${version}`;
const releaseNotes = version === '1.1.21'
  ? 'Corrige confirmações que voltavam a aparecer como rascunho depois da emissão. O aplicativo agora só marca o fechamento como emitido após gravar e registrar o PDF definitivo; o estado emitido, o vínculo com o documento e o histórico são concluídos juntos.'
  : version === '1.1.20'
  ? 'Corrige a perda de observações nas confirmações de negócio. Os campos da tela agora são gravados no mesmo comando que gera a prévia ou emite o PDF, e a sincronização central preserva alterações locais ainda não enviadas em vez de substituí-las por uma versão anterior.'
  : version === '1.1.19'
  ? 'Simplifica a emissão das confirmações de negócio: a prévia e a emissão salvam automaticamente as observações e demais campos do fechamento, a mesma nota fiscal pode participar de confirmações diferentes e agora há um acesso direto para criar confirmações sem nota fiscal antes das assinaturas.'
  : version === '1.1.18'
  ? 'Corrige o bloqueio de login em outro computador causado por relacoes de arquivos e historicos locais durante a carga dos dados centrais. Tambem impede que as atualizacoes automaticas do diagnostico e do resumo financeiro cubram e bloqueiem o Dashboard. Os arquivos locais sao preservados e as relacoes realmente centrais continuam validadas.'
  : version === '1.1.17'
  ? 'Corrige o erro SYNC_CONFLICT que bloqueava o login ao sincronizar historicos locais de importacao XML entre computadores. Jobs, caminhos e arquivos intermediarios permanecem locais; notas, eventos e operacoes resultantes continuam sincronizados normalmente. O servidor mantem compatibilidade com computadores ainda na versao 1.1.16.'
  : version === '1.1.15'
  ? 'Corrige o botao de copiar diagnostico usando a area de transferencia nativa e exibindo confirmacao. A tela Sobre passa a mostrar o estado, a revisao e o detalhe da sincronizacao central. Quando a sincronizacao falha durante o login, o aplicativo informa o erro e impede a abertura silenciosa com dados locais incompletos. Esta versao melhora o diagnostico; falhas de sincronizacao existentes ainda precisam ser avaliadas pelo detalhe apresentado.'
  : version === '1.1.14'
  ? 'Corrige a sincronizacao entre computadores para aplicar lotes relacionados por completo, evitando que um PC fique preso em uma revisao antiga. O total a receber passa a buscar a revisao central mais recente e a se atualizar automaticamente no Dashboard. Credenciais centrais tambem ficam separadas por usuario.'
  : version === '1.1.13'
  ? 'O PDF de cobranca agora inclui somente as notas do periodo selecionado, sem misturar notas antigas ja pagas. Descontos e acrescimos aparecem junto das notas, com valor e justificativa. A identificacao correta de emitente e destino nas notas terceirizadas vale para todos os clientes.'
  : version === '1.1.12'
  ? 'Corrige o sentido comercial das notas trianguladas e terceirizadas nas cobrancas. A tela e os documentos gerados agora mostram o emitente real da nota e o cliente responsavel como destino, evitando apresentar a empresa interna como participante da NF fisica.'
  : version === '1.0.81'
  ? 'Substitui o card de confirmacoes do dashboard pelo valor recebido no periodo. O novo indicador aparece ao lado do valor a receber e segue automaticamente as datas selecionadas no filtro superior.'
  : version === '1.0.80'
  ? 'Os recibos em imagem agora sao gerados em PNG, sem barras de rolagem. Ao salvar PDF ou imagem, o sistema abre a janela de escolha do destino e sugere o nome do cliente acompanhado da data de geracao.'
  : version === '1.0.79'
  ? 'Corrige a abertura de cobrancas pelo historico, restaurando o cliente, periodo, notas e valores da cobranca. Os pagamentos passam a exibir recibos em PDF e imagem para nova consulta, inclusive em registros antigos, e os horarios dos documentos usam o fuso de Brasilia.'
  : version === '1.0.78'
  ? 'Os PDFs de cobranca passam a identificar sempre o cliente/corretor, independentemente das empresas vinculadas. Cada recebimento agora gera recibo em PDF e imagem com o mesmo visual do sistema, discriminando notas, valores recebidos e pagamentos parciais.'
  : version === '1.0.77'
  ? 'Corrige o botão Registrar devolução no aplicativo instalado, expondo corretamente os comandos de inclusão e remoção de devoluções pela ponte segura do Electron.'
  : version === '1.0.76'
  ? 'Adiciona devolucoes manuais de cafe por nota, informadas em sacas ou quilos (60 kg por saca). O sistema preserva a quantidade original, calcula o saldo liquido, atualiza cobrancas abertas e mantem o historico com data e motivo; notas com pagamento ficam protegidas.'
  : version === '1.0.75'
  ? 'Faz os cards Total a receber e Recebido da tela de cobrancas seguirem automaticamente o periodo informado nos filtros de inicio e fim.'
  : version === '1.0.74'
  ? 'Corrige a quebra de nomes longos no PDF de controle para manter palavras como LTDA inteiras, eliminando letras isoladas em uma linha e preservando o destinatário em negrito.'
  : version === '1.0.73'
  ? 'Corrige as cores das linhas no PDF de controle para seguir a empresa exibida: Grão & Grão em verde, Villa em marrom e terceiros em azul. O destinatário da nota agora aparece em negrito para facilitar a distinção do emitente.'
  : version === '1.0.72'
  ? 'Atualiza o PDF de controle por cliente para o mesmo padrão visual das cobranças e confirmações, com identidade da marca, cabeçalho, cartões de contexto, tabela colorida por empresa emissora, resumo e rodapé paginado.'
  : version === '1.0.71'
  ? 'Melhora a identificação das cobranças pelo cliente e período, adiciona relatório PDF individual por cliente, mantém as cores conforme a empresa emissora, aprimora o histórico e a abertura das cobranças e corrige o espaçamento do card de alertas no dashboard.'
  : version === '1.0.70'
  ? 'Mostra as notas pagas no período filtrado da cobrança em uma área própria, com quantidade de notas, total de sacas pagas, valor recebido e o detalhamento de cada nota quitada.'
  : version === '1.0.69'
  ? 'Adiciona pesquisa por cliente ou corretor no resumo de cobranças e organiza a lista automaticamente em ordem alfabética, ignorando diferenças de maiúsculas e acentos.'
  : version === '1.0.68'
  ? 'Adiciona seleção de notas na cobrança aberta para registrar recebimentos. É possível marcar uma a uma ou selecionar todas, e o valor sugerido corresponde à soma das notas escolhidas.'
  : version === '1.0.67'
  ? 'Corrige o lançamento manual de notas para aceitar valores decimais digitados no padrão brasileiro, como 950,00, tanto no preço unitário quanto na quantidade e no número de sacas.'
  : version === '1.0.66'
  ? 'Retira notas integralmente pagas do total em aberto e apresenta essas notas em uma seção separada do PDF e da planilha, com número da NF, cliente, cobrança e valor pago. O campo de recebimento agora vem preenchido com o saldo integral para evitar erros de digitação.'
  : version === '1.0.65'
    ? 'Organiza as notas da cobrança primeiro pela data de emissão e, dentro de cada dia, pelo número da nota em ordem crescente. A ordem é mantida na seleção e na cobrança preparada.'
    : version === '1.0.64'
    ? 'Corrige notas de café Arábica ou Conilon classificadas incorretamente como Acréscimo de peso por herança de uma NF-e referenciada. A identificação do próprio item passa a prevalecer e registros antigos afetados são reparados automaticamente sem alterar pagamentos concluídos.'
    : version === '1.0.63'
    ? 'Corrige cobranças integralmente pagas que apareciam como pagamento parcial. Pagamentos iniciados em rascunhos passam pela emissão antes da baixa, casos antigos são recuperados ao abrir a cobrança e as cores das notas voltam a seguir a empresa emissora.'
    : 'Corrige a atualização das notas antigas não pagas para o valor atual da regra por saca. Ao consultar as cobranças, notas ainda abertas e não cobradas são recalculadas automaticamente; cobranças pagas permanecem preservadas.';
const api = `https://api.github.com/repos/${owner}/${repo}`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'SistemaOperacoesCafe-release',
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

let release;
const existing = await fetch(`${api}/releases/tags/${tag}`, { headers });
if (existing.ok) {
  release = await existing.json();
} else if (existing.status === 404) {
  release = await request(`${api}/releases`, {
    method: 'POST',
    body: JSON.stringify({
      tag_name: tag,
      name: `Sistema Operações Café ${version}`,
      draft: true,
      prerelease: false,
      body: releaseNotes,
    }),
  });
} else {
  throw new Error(`${existing.status} ${await existing.text()}`);
}

const directory = path.join('release', 'multiempresa', version);
const filenames = [
  `SistemaOperacoesCafe-Setup-${version}-x64.exe`,
  `SistemaOperacoesCafe-Setup-${version}-x64.exe.blockmap`,
  'latest.yml',
];

for (const filename of filenames) {
  const oldAsset = release.assets?.find((asset) => asset.name === filename);
  if (oldAsset) await request(`${api}/releases/assets/${oldAsset.id}`, { method: 'DELETE' });
  const contents = fs.readFileSync(path.join(directory, filename));
  await request(
    `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(filename)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': filename.endsWith('.yml') ? 'text/yaml' : 'application/octet-stream' },
      body: contents,
    },
  );
}

await request(`${api}/releases/${release.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    name: `Sistema Operações Café ${version}`,
    body: releaseNotes,
    draft: false,
    prerelease: false,
    make_latest: 'true',
  }),
});

console.log(`Versão ${version} publicada com sucesso.`);
