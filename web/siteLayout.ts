// Partes do layout que so existem no site:
//  - entrada (login e escolha de empresa): painel com a marca Graonex ao lado
//    do formulario (no celular vira uma faixa no alto);
//  - celular/tablet: o menu lateral vira uma gaveta aberta pelo botao do topo.
// Os elementos sao acrescentados ao lado dos do app, sem mudar as telas.

const MENU_OPEN = "site-menu-open";

function ensureAuthBrand(): void {
  const shell = document.querySelector<HTMLElement>(".auth-shell");
  if (!shell || shell.querySelector(".site-auth-brand")) return;
  const aside = document.createElement("aside");
  aside.className = "site-auth-brand";
  aside.setAttribute("aria-hidden", "true");
  const icon = document.createElement("img");
  icon.src = "/assets/branding/graonex/icon.png";
  icon.alt = "";
  const word = document.createElement("div");
  word.className = "site-auth-brand__word";
  word.append("GRÃONE", Object.assign(document.createElement("span"), { textContent: "X" }));
  const tagline = document.createElement("p");
  tagline.textContent = "Notas, cobranças, confirmações e financeiro das suas empresas de café em um só lugar.";
  const companies = document.createElement("small");
  companies.textContent = "Villa Coffee · Grão & Grão";
  aside.append(icon, word, tagline, companies);
  shell.prepend(aside);
}

function ensureMenuButton(): void {
  const topbar = document.querySelector<HTMLElement>(".app-topbar");
  if (!topbar || topbar.querySelector(".site-menu-toggle")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "site-menu-toggle";
  button.setAttribute("aria-label", "Abrir menu");
  button.innerHTML = "<span></span><span></span><span></span>";
  button.addEventListener("click", () => {
    document.documentElement.classList.toggle(MENU_OPEN);
    button.setAttribute("aria-expanded", String(document.documentElement.classList.contains(MENU_OPEN)));
  });
  topbar.prepend(button);
}

function ensureBackdrop(): void {
  if (document.querySelector(".site-menu-backdrop")) return;
  const backdrop = document.createElement("div");
  backdrop.className = "site-menu-backdrop";
  backdrop.addEventListener("click", closeMenu);
  document.body.appendChild(backdrop);
}

function closeMenu(): void {
  document.documentElement.classList.remove(MENU_OPEN);
  document.querySelector(".site-menu-toggle")?.setAttribute("aria-expanded", "false");
}

// ---------- Menu do usuario no topo ----------
// "Trocar senha / Bloquear / Sair" ficam dentro de um menu aberto pelo nome do
// usuario, em vez de tres botoes ocupando o topo o tempo todo.
const USER_OPEN = "site-user-open";

function closeUserMenu(): void {
  document.documentElement.classList.remove(USER_OPEN);
  document.querySelector(".context-pill--user")?.setAttribute("aria-expanded", "false");
}

function ensureUserMenu(): void {
  const pill = document.querySelector<HTMLElement>(".app-topbar .context-pill--user");
  if (!pill || pill.dataset.siteUserMenu) return;
  pill.dataset.siteUserMenu = "1";
  pill.setAttribute("role", "button");
  pill.setAttribute("tabindex", "0");
  pill.setAttribute("aria-haspopup", "menu");
  pill.setAttribute("aria-expanded", "false");
  pill.title = "Conta: trocar senha, bloquear ou sair";
  const toggle = () => {
    const open = document.documentElement.classList.toggle(USER_OPEN);
    pill.setAttribute("aria-expanded", String(open));
  };
  pill.addEventListener("click", toggle);
  pill.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } });
}

// ---------- Grupos do menu lateral que abrem e fecham ----------
// O menu tem 18 telas; cada grupo (Visao geral, Operacoes, Comercial...) pode
// ser recolhido. A escolha fica salva neste navegador. O grupo da tela aberta
// sempre mostra a tela ativa.
const NAV_STATE_KEY = "site-nav-collapsed-groups";

function readCollapsedGroups(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(NAV_STATE_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}

function saveCollapsedGroups(groups: Set<string>): void {
  try { localStorage.setItem(NAV_STATE_KEY, JSON.stringify([...groups])); } catch { /* sem armazenamento */ }
}

function ensureNavGroups(): void {
  const collapsed = readCollapsedGroups();
  document.querySelectorAll<HTMLElement>(".app-sidebar__nav section").forEach((section) => {
    const title = section.querySelector<HTMLElement>(".nav-group-title");
    if (!title) return;
    const name = (title.textContent ?? "").trim();
    if (!title.dataset.siteGroup) {
      title.dataset.siteGroup = name;
      title.setAttribute("role", "button");
      title.setAttribute("tabindex", "0");
      title.title = "Mostrar ou esconder este grupo";
    }
    const isCollapsed = collapsed.has(name);
    if (section.classList.contains("site-group-collapsed") !== isCollapsed) section.classList.toggle("site-group-collapsed", isCollapsed);
    title.setAttribute("aria-expanded", String(!isCollapsed));
  });
}

function toggleNavGroup(name: string): void {
  const collapsed = readCollapsedGroups();
  if (collapsed.has(name)) collapsed.delete(name); else collapsed.add(name);
  saveCollapsedGroups(collapsed);
  ensureNavGroups();
}

// ---------- Monitor do coletor compacto ----------
// Botao "Detalhes" no cabecalho do monitor: mostra/esconde os 8 indicadores,
// a lista de CNPJs e o diagnostico de cada coletor.
function ensureMonitorToggle(): void {
  document.querySelectorAll<HTMLElement>(".collector-monitor").forEach((monitor) => {
    const heading = monitor.querySelector<HTMLElement>(".collector-monitor__heading");
    if (!heading || heading.querySelector(".site-monitor-toggle")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "site-monitor-toggle";
    button.textContent = "Detalhes";
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      const open = monitor.classList.toggle("site-monitor-open");
      button.textContent = open ? "Ocultar detalhes" : "Detalhes";
      button.setAttribute("aria-expanded", String(open));
    });
    heading.appendChild(button);
  });
}

// ---------- Resumo ----------
// Marca os cartoes pelo titulo para o CSS esconder os que so explicam
// ("Fluxo operacional", "Estrutura ativa") e subir "Sacas por periodo".
// Os quatro numeros do topo viram atalhos para a tela correspondente.
const DASHBOARD_CARDS: Array<[RegExp, string]> = [
  [/fluxo operacional/i, "fluxo"],
  [/estrutura ativa/i, "estrutura"],
  [/sacas por per[ií]odo/i, "sacas-periodo"],
  [/opera[cç][oõ]es e sacas/i, "grafico"],
  [/status operacional/i, "status"]
];
const HERO_LINKS: Array<[RegExp, string, string]> = [
  [/sacas vendidas/i, "#/operations", "Abrir notas e operações"],
  [/valor total dos servi[cç]os/i, "#/charges", "Abrir cobranças"],
  [/a receber/i, "#/charges", "Abrir cobranças"],
  [/recebido/i, "#/client-ledger", "Abrir conta-corrente"]
];

function ensureDashboard(): void {
  document.querySelectorAll<HTMLElement>(".dashboard-workspace > .ui-card:not([data-site-card])").forEach((card) => {
    const title = card.querySelector("h2, h3")?.textContent ?? "";
    const match = DASHBOARD_CARDS.find(([pattern]) => pattern.test(title));
    if (match) card.dataset.siteCard = match[1];
  });
  document.querySelectorAll<HTMLElement>(".dashboard-grid--hero > .ui-card:not([data-site-link])").forEach((card) => {
    const text = card.textContent ?? "";
    const link = HERO_LINKS.find(([pattern]) => pattern.test(text));
    if (!link) return;
    card.dataset.siteLink = link[1];
    card.setAttribute("role", "link");
    card.setAttribute("tabindex", "0");
    card.title = link[2];
    const go = () => { window.location.hash = link[1]; };
    card.addEventListener("click", go);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter") go(); });
  });
}

// ---------- Acoes das linhas das tabelas ----------
// Linhas com 3 ou mais botoes (ex.: Editar / Arquivar / Excluir) quebravam em
// duas linhas e so cabiam 3 clientes na tela. Fica o primeiro botao e um "⋯"
// que abre os demais. Os botoes continuam os mesmos do app (so ficam escondidos).
// Com dois botoes, so quando o segundo e de excluir/cancelar: fica Editar/Abrir
// a vista e o perigoso dentro do "⋯" (evita clique sem querer e linha alta).
const isDangerButton = (button: HTMLButtonElement): boolean =>
  button.classList.contains("danger") || button.classList.contains("danger-action") || button.dataset.tone === "danger";

function ensureRowMenus(): void {
  document.querySelectorAll<HTMLElement>(".content-section :is(.row-actions, td .actions, .table-row > .actions)").forEach((cell) => {
    const buttons = [...cell.querySelectorAll<HTMLButtonElement>(":scope > button, :scope > span > button")].filter((button) => !button.classList.contains("site-row-more"));
    const existing = cell.querySelector<HTMLButtonElement>(":scope > .site-row-more");
    const collapse = buttons.length >= 3 || (buttons.length === 2 && !isDangerButton(buttons[0]) && isDangerButton(buttons[1]));
    if (!collapse) { existing?.remove(); cell.classList.remove("site-row-menu"); return; }
    cell.classList.add("site-row-menu");
    if (existing) return;
    const more = document.createElement("button");
    more.type = "button";
    more.className = "site-row-more";
    more.textContent = "⋯";
    more.title = "Mais ações";
    more.setAttribute("aria-label", "Mais ações");
    more.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !cell.classList.contains("site-row-open");
      document.querySelectorAll(".site-row-open").forEach((other) => other.classList.remove("site-row-open"));
      cell.classList.toggle("site-row-open", open);
    });
    cell.appendChild(more);
  });
}

// ---------- Busca de notas: seletor de empresa + um botao ----------
// Os 6 botoes "Emitidas por ..." / "Recebidas por ..." viram um seletor e o
// botao "Buscar notas", que aciona o botao original escolhido (escondido).
const SEARCH_CHOICE_KEY = "site-vulpe-search-choice";

function ensureSearchPicker(): void {
  document.querySelectorAll<HTMLElement>(".vulpe-search-actions").forEach((bar) => {
    const originals = [...bar.querySelectorAll<HTMLButtonElement>(":scope > button:not(.site-search-go)")];
    if (originals.length < 2) return;
    let picker = bar.querySelector<HTMLElement>(":scope > .site-search-picker");
    const labels = originals.map((button) => (button.textContent ?? "").replace(/\s+/g, " ").trim());
    if (picker && picker.dataset.labels === labels.join("|")) {
      const go = picker.querySelector<HTMLButtonElement>("button");
      if (go) go.disabled = originals.some((button) => button.disabled);
      return;
    }
    picker?.remove();
    bar.classList.add("site-search-bar");
    picker = document.createElement("div");
    picker.className = "site-search-picker";
    picker.dataset.labels = labels.join("|");
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Empresa da busca");
    // Mostra so o nome da empresa: "Emitidas por Villa MG" -> "Villa MG".
    labels.forEach((label, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = label.replace(/^(emitidas|recebidas) por\s+/i, "");
      select.appendChild(option);
    });
    let remembered = "";
    try { remembered = localStorage.getItem(SEARCH_CHOICE_KEY) ?? ""; } catch { remembered = ""; }
    const rememberedIndex = labels.findIndex((label) => label.replace(/^(emitidas|recebidas) por\s+/i, "") === remembered);
    if (rememberedIndex >= 0) select.value = String(rememberedIndex);
    select.addEventListener("change", () => {
      try { localStorage.setItem(SEARCH_CHOICE_KEY, select.selectedOptions[0]?.textContent ?? ""); } catch { /* sem armazenamento */ }
    });
    const go = document.createElement("button");
    go.type = "button";
    go.className = "primary site-search-go";
    go.textContent = /recebidas/i.test(labels[0]) ? "Buscar notas recebidas" : "Buscar notas emitidas";
    go.addEventListener("click", () => {
      const current = [...bar.querySelectorAll<HTMLButtonElement>(":scope > button:not(.site-search-go)")];
      current[Number(select.value)]?.click();
    });
    picker.append(select, go);
    bar.prepend(picker);
  });
}

// ---------- Opcoes que so existem no programa do computador ----------
// Backup, restauracao, pastas e perfil da instalacao sao do PC; no site davam
// "funcao nao disponivel". Saem das Configuracoes e do menu de administracao.
const DESKTOP_ONLY = /^(backups|criar backup|restaurar|reten[cç][aã]o|diret[oó]rios|perfil da instala[cç][aã]o)$/i;

function ensureDesktopOnlyHidden(): void {
  document.querySelectorAll<HTMLButtonElement>(".content-section .cards button:not([data-site-checked]), .app-sidebar__nav button:not([data-site-checked])").forEach((button) => {
    button.dataset.siteChecked = "1";
    const label = (button.querySelector(".nav-label")?.textContent ?? button.textContent ?? "").replace(/\s+/g, " ").trim();
    if (DESKTOP_ONLY.test(label)) button.classList.add("site-desktop-only");
  });
}

// ---------- Telas vazias ----------
// Mensagens "Nenhum.../Nenhuma..." sozinhas numa lista, tabela ou cartao ganham
// o mesmo visual do aviso vazio do Resumo (caixa tracejada, centralizada).
const EMPTY_TEXT = /^(Nenhum|Nenhuma)\b/i;
function ensureEmptyStates(): void {
  document.querySelectorAll<HTMLElement>(".content-section p:not([data-site-empty]), .content-section .table-row > span:only-child:not([data-site-empty]), .content-section td[colspan]:not([data-site-empty]), .content-section .table > p:not([data-site-empty])").forEach((element) => {
    element.dataset.siteEmpty = "0";
    if (element.closest(".ui-empty, .site-empty, .partner-search__panel, .ui-dialog, .site-ticker")) return;
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!EMPTY_TEXT.test(text) || text.length > 140 || element.querySelector("button, input, select, a")) return;
    // Paragrafo solto so vira aviso quando e o unico texto do bloco (nao explicacoes no meio de formularios).
    if (element.tagName === "P" && element.parentElement && element.parentElement.querySelectorAll(":scope > p, :scope > div, :scope > section").length > 2) return;
    element.dataset.siteEmpty = "1";
    element.classList.add("site-empty");
    element.closest(".table-row")?.classList.add("site-empty-row");
  });
}

// ---------- Cobrancas ----------
// "Dados para pagamento" vira uma linha so (titulo + botao), sem o texto longo no meio do fluxo.
function ensureChargesLayout(): void {
  document.querySelectorAll<HTMLElement>(".charge-diagnostics:not([data-site-bank])").forEach((box) => {
    if (/dados para pagamento/i.test(box.querySelector("h3")?.textContent ?? "")) box.dataset.siteBank = "1";
  });
}

export function startSiteLayout(): void {
  const ensure = () => { ensureAuthBrand(); ensureMenuButton(); ensureBackdrop(); ensureUserMenu(); ensureNavGroups(); ensureMonitorToggle(); ensureDashboard(); ensureRowMenus(); ensureChargesLayout(); ensureDesktopOnlyHidden(); ensureSearchPicker(); ensureEmptyStates(); };
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const groupTitle = target?.closest<HTMLElement>(".app-sidebar__nav .nav-group-title[data-site-group]");
    if (groupTitle) { toggleNavGroup(groupTitle.dataset.siteGroup ?? ""); return; }
    // Menu do usuario: fecha ao escolher uma opcao ou clicar fora dele.
    if (target?.closest(".topbar-actions button") || !target?.closest(".context-pill--user, .topbar-actions")) closeUserMenu();
    // Menu "⋯" das linhas: fecha ao escolher uma acao ou clicar fora.
    if (!target?.closest(".site-row-more")) document.querySelectorAll(".site-row-open").forEach((cell) => cell.classList.remove("site-row-open"));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { closeUserMenu(); document.querySelectorAll(".site-row-open").forEach((cell) => cell.classList.remove("site-row-open")); }
    const title = (event.target as HTMLElement | null)?.closest<HTMLElement>(".nav-group-title[data-site-group]");
    if (title && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); toggleNavGroup(title.dataset.siteGroup ?? ""); }
  });
  new MutationObserver(ensure).observe(document.body, { childList: true, subtree: true });
  // Ao escolher uma tela no menu do celular, a gaveta fecha (o app troca de tela
  // por history.pushState, sem evento de hash; por isso o clique no item tambem fecha).
  window.addEventListener("hashchange", closeMenu);
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".app-sidebar__nav section button, .app-sidebar__footer button")) closeMenu();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
  ensure();
}
