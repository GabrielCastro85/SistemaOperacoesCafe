// Busca de telas do site ("Ir para..."): botao no menu lateral e atalho
// Ctrl+K. Lista todas as telas do menu do app (inclusive as de administracao,
// mesmo com o grupo fechado) e abre a escolhida pelo endereco (#/rota).

import { navigationGroups } from "../src/renderer/app/navigation";
import { accentText } from "./siteText";

interface Entry { label: string; group: string; path: string; search: string }

const plain = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const entries: Entry[] = navigationGroups.flatMap((group) => group.items.map((item) => ({
  label: accentText(item.label), group: accentText(group.title), path: item.path,
  search: plain(`${item.label} ${group.title} ${item.legacyMenu}`)
})));

let overlay: HTMLDivElement | null = null;

function close(): void {
  overlay?.remove();
  overlay = null;
}

function go(entry: Entry): void {
  close();
  window.location.hash = `#${entry.path}`;
}

function open(): void {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.className = "site-command";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Ir para uma tela");
  const panel = document.createElement("div");
  panel.className = "site-command__panel";
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Ir para... (digite o nome da tela)";
  input.setAttribute("aria-label", "Nome da tela");
  const list = document.createElement("div");
  list.className = "site-command__list";
  list.setAttribute("role", "listbox");
  panel.append(input, list);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  let filtered: Entry[] = entries;
  let active = 0;
  const draw = () => {
    const term = plain(input.value.trim());
    filtered = term ? entries.filter((entry) => term.split(/\s+/).every((word) => entry.search.includes(word))) : entries;
    active = Math.min(active, Math.max(0, filtered.length - 1));
    list.replaceChildren(...(filtered.length ? filtered.map((entry, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `site-command__item${index === active ? " is-active" : ""}`;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(index === active));
      const name = document.createElement("strong");
      name.textContent = entry.label;
      const group = document.createElement("small");
      group.textContent = entry.group;
      button.append(name, group);
      button.addEventListener("mouseenter", () => { active = index; draw(); });
      button.addEventListener("click", () => go(entry));
      return button;
    }) : [Object.assign(document.createElement("p"), { className: "site-command__empty", textContent: "Nenhuma tela com esse nome." })]));
    list.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
  };
  input.addEventListener("input", () => { active = 0; draw(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); active = Math.min(active + 1, filtered.length - 1); draw(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); active = Math.max(active - 1, 0); draw(); }
    else if (event.key === "Enter" && filtered[active]) { event.preventDefault(); go(filtered[active]); }
    else if (event.key === "Escape") { event.preventDefault(); close(); }
  });
  overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) close(); });
  draw();
  input.focus();
}

// Botao "Ir para..." no menu lateral (abaixo do nome do sistema).
function ensureButton(): void {
  const sidebar = document.querySelector(".app-sidebar");
  const brand = sidebar?.querySelector(".app-sidebar__brand");
  if (!sidebar || !brand || sidebar.querySelector(".site-command-trigger")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "site-command-trigger";
  button.title = "Ir para uma tela (Ctrl+K)";
  const label = document.createElement("span");
  label.textContent = "Ir para...";
  const key = document.createElement("kbd");
  key.textContent = "Ctrl K";
  button.append(label, key);
  button.addEventListener("click", open);
  brand.insertAdjacentElement("afterend", button);
}

export function startSiteCommand(): void {
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      if (!document.querySelector(".app-sidebar")) return;
      event.preventDefault();
      if (overlay) close(); else open();
    }
  });
  new MutationObserver(ensureButton).observe(document.body, { childList: true, subtree: true });
  ensureButton();
}
