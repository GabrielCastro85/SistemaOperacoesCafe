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

export function startSiteLayout(): void {
  const ensure = () => { ensureAuthBrand(); ensureMenuButton(); ensureBackdrop(); };
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
