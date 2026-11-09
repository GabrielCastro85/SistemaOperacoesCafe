// Acentos nos textos das telas do site. O app foi escrito, em boa parte, sem
// acento ("Cobranca", "Historico", "nao") e as mensagens do servidor tambem.
// Corrigir no codigo arriscaria quebrar textos usados como chave; aqui so muda
// o que aparece na tela:
//  - so no texto exibido e nos atributos placeholder/title/aria-label;
//  - nunca no que se digita (input, textarea, select);
//  - palavras TODAS EM MAIUSCULAS ficam como estao (nomes de clientes e empresas).

const WORDS: Record<string, string> = {
  acao: "ação", acoes: "ações", acrescimo: "acréscimo", acrescimos: "acréscimos", administracao: "administração",
  agua: "água", analise: "análise", apos: "após", armazem: "armazém", armazens: "armazéns", ate: "até",
  atencao: "atenção", atualizacao: "atualização", atualizacoes: "atualizações", automatica: "automática", automatico: "automático",
  balanco: "balanço", bancaria: "bancária", bancarias: "bancárias", bancario: "bancário", bancarios: "bancários", basico: "básico",
  cafe: "café", cafes: "cafés", calculo: "cálculo",
  classificacao: "classificação", clausula: "cláusula", clausulas: "cláusulas", cobranca: "cobrança", cobrancas: "cobranças",
  codigo: "código", comissao: "comissão", comissoes: "comissões", comparacao: "comparação", competencia: "competência",
  conexao: "conexão", conferencia: "conferência", conferencias: "conferências", configuracao: "configuração", configuracoes: "configurações",
  confirmacao: "confirmação", confirmacoes: "confirmações", conteudo: "conteúdo", contabil: "contábil", cotacao: "cotação",
  credito: "crédito", creditos: "créditos", debito: "débito", debitos: "débitos", descricao: "descrição",
  destinatario: "destinatário", diferenca: "diferença", disponivel: "disponível", disponiveis: "disponíveis", divergencia: "divergência",
  divergencias: "divergências", edicao: "edição", emissao: "emissão", emprestimo: "empréstimo", emprestimos: "empréstimos",
  endereco: "endereço", espirito: "espírito", exclusao: "exclusão", exportacao: "exportação", grafico: "gráfico", grao: "grão",
  graos: "grãos", gestao: "gestão", historico: "histórico", identificacao: "identificação", importacao: "importação",
  importacoes: "importações", indice: "índice", informacao: "informação", informacoes: "informações", inicio: "início",
  integracao: "integração", invalida: "inválida", invalido: "inválido", lancamento: "lançamento", lancamentos: "lançamentos",
  lancada: "lançada", lancadas: "lançadas", lancado: "lançado", lancados: "lançados", liquido: "líquido", maximo: "máximo", media: "média",
  mes: "mês", minimo: "mínimo", movimentacao: "movimentação", movimentacoes: "movimentações", nao: "não",
  necessario: "necessário", negociacao: "negociação", numero: "número", numeros: "números", obrigatoria: "obrigatória",
  obrigatorio: "obrigatório", observacao: "observação", observacoes: "observações", operacao: "operação", operacoes: "operações",
  opcao: "opção", opcoes: "opções", pagina: "página", paginas: "páginas", pendencia: "pendência", pendencias: "pendências",
  periodo: "período", periodos: "períodos", possivel: "possível", previa: "prévia", previsao: "previsão", producao: "produção",
  proxima: "próxima", proximas: "próximas", proximo: "próximo", proximos: "próximos", razao: "razão", rapido: "rápido",
  recepcao: "recepção", referencia: "referência", referencias: "referências", relatorio: "relatório", relatorios: "relatórios",
  responsavel: "responsável", responsaveis: "responsáveis", revisao: "revisão", sao: "são", saida: "saída", saidas: "saídas",
  selecao: "seleção", sera: "será", serao: "serão", servico: "serviço", servicos: "serviços", simulacao: "simulação",
  sincronizacao: "sincronização", situacao: "situação", so: "só", substituicao: "substituição", tambem: "também",
  transferencia: "transferência", transferencias: "transferências", ultima: "última", ultimas: "últimas", ultimo: "último",
  ultimos: "últimos", unica: "única", unico: "único", usuario: "usuário", usuarios: "usuários", valida: "válida", valido: "válido",
  vigencia: "vigência", versao: "versão", voce: "você", ja: "já", tera: "terá", estao: "estão", entao: "então", alem: "além",
  conteudos: "conteúdos", necessaria: "necessária", veiculo: "veículo"
};

const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(${Object.keys(WORDS).join("|")})(?![\\p{L}\\p{N}])`, "giu");
const SKIP_PARENTS = new Set(["INPUT", "TEXTAREA", "SELECT", "SCRIPT", "STYLE", "CODE", "PRE"]);
const ATTRIBUTES = ["placeholder", "title", "aria-label"];

function fixWord(original: string): string {
  if (original.length > 1 && original === original.toUpperCase()) return original;
  const accented = WORDS[original.toLowerCase()];
  if (!accented) return original;
  return original[0] === original[0].toUpperCase() ? accented[0].toUpperCase() + accented.slice(1) : accented;
}

export function accentText(value: string): string {
  return value.replace(PATTERN, fixWord);
}

function fixTextNode(node: Text): void {
  const parent = node.parentElement;
  if (!parent || SKIP_PARENTS.has(parent.tagName) || parent.isContentEditable || parent.closest("[data-no-accent]")) return;
  const current = node.nodeValue ?? "";
  const next = accentText(current);
  if (next !== current) node.nodeValue = next;
}

function fixElement(element: Element): void {
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value) {
      const next = accentText(value);
      if (next !== value) element.setAttribute(name, next);
    }
  }
}

function fixTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) { fixTextNode(root as Text); return; }
  if (!(root instanceof Element) && !(root instanceof DocumentFragment) && !(root instanceof Document)) return;
  if (root instanceof Element) fixElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) fixTextNode(node as Text);
    else fixElement(node as Element);
  }
}

export function startSiteText(): void {
  const pending = new Set<Node>();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const nodes = [...pending];
    pending.clear();
    nodes.forEach((node) => { if (node.isConnected) fixTree(node); });
  };
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") pending.add(mutation.target);
      else if (mutation.type === "attributes") pending.add(mutation.target);
      else mutation.addedNodes.forEach((node) => pending.add(node));
    }
    if (!scheduled && pending.size) { scheduled = true; requestAnimationFrame(flush); }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
  fixTree(document.body);
  document.title = accentText(document.title);
}
