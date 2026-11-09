// Da a cada botao do app o "tom" da funcao dele, pelo texto do botao, para o
// tema do site (web/site-theme.css) pintar cada tipo de um jeito:
//   primary -> acao principal (salvar, emitir, gerar, confirmar...)
//   danger  -> acao que apaga ou desfaz (excluir, estornar, cancelar algo)
//   accent  -> consulta/proximo passo sem gravar (buscar, abrir, previa...)
//   quiet   -> so sai/limpa (cancelar, fechar, voltar, limpar)
// Botoes que o app ja marca (primary, danger, abas, menu) ficam como estao.

const PRIMARY = /^(\+\s*)?(salvar|emitir|gerar|confirmar|registrar|concluir|importar|criar|lan[cç]ar|cadastrar|enviar|aplicar|receber|entrar|nova|novo|adicionar|incluir|vincular|baixar pagamento|finalizar|aprovar|autorizar|cobrar)\b/i;
const DANGER = /^(excluir|estornar|remover|apagar|descartar|desvincular|inativar|desativar|bloquear cobran|cancelar\s+\S+|reverter)/i;
const ACCENT = /^(selecionar|escolher|anexar|buscar|pesquisar|consultar|filtrar|atualizar|sugerir|carregar|ver |abrir|visualizar|pr[eé]via|conferir|calcular)/i;
const QUIET = /^(cancelar|fechar|voltar|limpar|n[aã]o|agora n[aã]o|ocultar|esconder|mostrar menos)$/i;
const SKIP = ".app-sidebar__nav button, .site-menu-toggle, .org-picker-card, .company-switcher button, .site-command button, .site-command-trigger, .site-section-nav button, .site-toast button, .settings-tabs button, .ui-tabs button, .sidebar-collapse, .company-choice, .auth-password-toggle, .partner-modal__close, .ui-icon-button, .alert-item, .xml-batch-row, .xml-queue-list button";
const ALREADY = /(^|\s)(primary|danger|danger-action|ui-button--(primary|danger|ghost))(\s|$)|--primary|--danger/;

function label(button: HTMLButtonElement): string {
  return (button.textContent ?? "").replace(/\s+/g, " ").trim();
}

function classify(button: HTMLButtonElement): void {
  if (button.matches(SKIP) || ALREADY.test(button.className)) {
    if (button.dataset.tone) delete button.dataset.tone;
    return;
  }
  const text = label(button);
  const tone = QUIET.test(text) ? "quiet" : DANGER.test(text) ? "danger" : PRIMARY.test(text) ? "primary" : ACCENT.test(text) ? "accent" : "";
  if (tone && button.dataset.tone !== tone) button.dataset.tone = tone;
  else if (!tone && button.dataset.tone) delete button.dataset.tone;
}

function scan(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>("button").forEach(classify);
}

export function startSiteEnhancer(): void {
  document.documentElement.classList.add("site");
  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; scan(document); });
  };
  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  schedule();
}
