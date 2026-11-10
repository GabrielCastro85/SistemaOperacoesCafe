// Telas longas no site:
//  - "Nesta pagina": barra fixa abaixo do topo com um atalho para cada secao
//    (aparece quando a tela tem 3 secoes ou mais) e a secao atual destacada;
//  - secoes que abrem e fecham clicando no titulo, lembradas por tela;
//  - (no CSS) botoes principais presos no rodape da secao enquanto se rola.
// A barra fica fora da arvore do React (anexada ao body) para nao interferir nas telas.

const HEADINGS = ".content-section .admin-block > h3, .content-section .ui-page-section > header, .content-section .warehouse-panel > .warehouse-panel__heading";
// Atalhos do indice: qualquer titulo de secao da tela (h2/h3), fora de janelas, tabelas e resumos.
const ANCHORS = ".content-section :is(h2, h3)";
const ANCHOR_EXCLUDE = ".ui-page-header, .ui-dialog, .ui-drawer, .partner-modal, table, .table, .cards, .metrics-grid, .site-section-nav";
const STORAGE_KEY = "operacoes-cafe-site-secoes-fechadas";
const MIN_SECTIONS = 3;

interface SectionRef { section: HTMLElement; heading: HTMLElement; title: string }

function routeKey(): string {
  return (location.hash || "#/").split("?")[0];
}

// Secoes que comecam recolhidas (correcoes raras que empurravam o principal
// para baixo). Depois que o usuario abre ou fecha, vale a escolha dele.
const DEFAULT_CLOSED: Record<string, string[]> = {
  "#/warehouse-stock": ["Ajustar estoque manualmente"]
};

function readClosed(): Record<string, string[]> {
  let stored: Record<string, string[]> = {};
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string[]>; } catch { stored = {}; }
  return { ...DEFAULT_CLOSED, ...stored };
}

function writeClosed(value: Record<string, string[]>): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* sem armazenamento: so nesta visita */ }
}

function headingTitle(heading: HTMLElement): string {
  const target = heading.matches("header, .warehouse-panel__heading") ? heading.querySelector("h2") : heading;
  return (target?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function visibleSections(): SectionRef[] {
  return [...document.querySelectorAll<HTMLElement>(HEADINGS)]
    .filter((heading) => heading.offsetParent !== null)
    .map((heading) => ({ heading, section: heading.parentElement as HTMLElement, title: headingTitle(heading) }))
    .filter((item) => item.title);
}

function setCollapsed(item: SectionRef, collapsed: boolean, remember: boolean): void {
  item.section.classList.toggle("site-collapsed", collapsed);
  item.heading.setAttribute("aria-expanded", String(!collapsed));
  if (!remember) return;
  const closed = readClosed();
  const key = routeKey();
  const titles = new Set(closed[key] ?? []);
  if (collapsed) titles.add(item.title); else titles.delete(item.title);
  closed[key] = [...titles];
  writeClosed(closed);
}

function applyRemembered(sections: SectionRef[]): void {
  const titles = new Set(readClosed()[routeKey()] ?? []);
  for (const item of sections) {
    item.heading.classList.add("site-collapsible");
    if (!item.heading.hasAttribute("tabindex")) item.heading.setAttribute("tabindex", "0");
    item.heading.setAttribute("role", "button");
    const shouldClose = titles.has(item.title);
    if (item.section.classList.contains("site-collapsed") !== shouldClose) setCollapsed(item, shouldClose, false);
    else item.heading.setAttribute("aria-expanded", String(!shouldClose));
  }
}

let nav: HTMLElement | null = null;
let currentSections: SectionRef[] = [];
let anchors: Array<{ element: HTMLElement; title: string }> = [];

function visibleAnchors(): Array<{ element: HTMLElement; title: string }> {
  return [...document.querySelectorAll<HTMLElement>(ANCHORS)]
    .filter((heading) => heading.offsetParent !== null && !heading.closest(ANCHOR_EXCLUDE))
    .map((heading) => {
      const owner = heading.closest<HTMLElement>(".admin-block, .ui-page-section");
      const isSectionTitle = owner && (heading.parentElement === owner || heading.parentElement?.parentElement === owner);
      return { element: isSectionTitle ? owner : heading, title: (heading.textContent ?? "").replace(/\s+/g, " ").trim() };
    })
    .filter((item) => item.title && item.title.length <= 60);
}

function renderNav(sections: Array<{ element: HTMLElement; title: string }>): void {
  const main = document.querySelector<HTMLElement>(".main-area");
  const topbar = document.querySelector<HTMLElement>(".app-topbar");
  if (sections.length < MIN_SECTIONS || !main || !topbar) {
    nav?.remove();
    nav = null;
    document.documentElement.classList.remove("site-has-section-nav");
    return;
  }
  if (!nav) {
    nav = document.createElement("nav");
    nav.className = "site-section-nav";
    nav.setAttribute("aria-label", "Seções desta página");
    document.body.appendChild(nav);
  }
  const signature = sections.map((item) => item.title).join("\u0000");
  if (nav.dataset.signature !== signature) {
    nav.dataset.signature = signature;
    nav.replaceChildren();
    const label = document.createElement("span");
    label.className = "site-section-nav__label";
    label.textContent = "Nesta página";
    nav.appendChild(label);
    sections.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.title;
      button.dataset.index = String(index);
      button.addEventListener("click", () => {
        const target = anchors[index];
        if (!target) return;
        const collapsed = currentSections.find((item) => item.section === target.element && item.section.classList.contains("site-collapsed"));
        if (collapsed) setCollapsed(collapsed, false, true);
        target.element.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      nav!.appendChild(button);
    });
  }
  const mainBox = main.getBoundingClientRect();
  const topBox = topbar.getBoundingClientRect();
  nav.style.left = `${mainBox.left}px`;
  nav.style.top = `${topBox.bottom}px`;
  nav.style.width = `${mainBox.width}px`;
  document.documentElement.classList.add("site-has-section-nav");
  highlight();
}

function highlight(): void {
  if (!nav) return;
  const limit = (nav.getBoundingClientRect().bottom || 0) + 24;
  let active = 0;
  anchors.forEach((item, index) => { if (item.element.getBoundingClientRect().top <= limit) active = index; });
  nav.querySelectorAll<HTMLButtonElement>("button").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.index) === active));
}

function refresh(): void {
  currentSections = visibleSections();
  applyRemembered(currentSections);
  anchors = visibleAnchors();
  renderNav(anchors);
}

export function startSitePage(): void {
  let timer = 0;
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(refresh, 150); };
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("hashchange", schedule);
  document.addEventListener("scroll", () => requestAnimationFrame(highlight), true);

  const toggleFrom = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element || element.closest("button, a, input, select, textarea, label")) return false;
    const heading = element.closest<HTMLElement>(".site-collapsible");
    if (!heading) return false;
    const item = currentSections.find((section) => section.heading === heading)
      ?? { heading, section: heading.parentElement as HTMLElement, title: headingTitle(heading) };
    setCollapsed(item, !item.section.classList.contains("site-collapsed"), true);
    schedule();
    return true;
  };
  document.addEventListener("click", (event) => { toggleFrom(event.target); });
  document.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && toggleFrom(event.target)) event.preventDefault();
  });
  schedule();
}
