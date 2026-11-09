// Avisos flutuantes do site. As telas do app mostram o resultado de uma acao
// num paragrafo no topo da pagina (Feedback, .feedback / .transfer-message),
// que muitas vezes fica fora da vista. Aqui cada mensagem nova vira um aviso no
// canto da tela: verde (sucesso, some sozinho) ou vermelho (erro, fica ate
// fechar). O paragrafo original continua na pagina (o tema o deixa discreto).

import { accentText } from "./siteText";

const SOURCES = ".feedback, .transfer-message, .ui-alert--success, .warehouse-feedback, .period-comparison__message, p.success";
const ERROR = /^(erro\b|falha|n[aã]o foi poss[ií]vel|nao foi possivel|n[aã]o (h[aá]|existe|encontr)|selecione|informe|preencha|escolha|confira|cadastre|revise)|inv[aá]lid|obrigat[oó]ri|bloquead|negad|n[aã]o pode|sem permiss/i;
const WARNING = /^(aten[cç][aã]o|aviso|cuidado)|pendente|pendenc/i;
const lastText = new WeakMap<Element, string>();
// O mesmo texto em pouco tempo (mensagem remontada pela tela) vira um aviso so.
const recent = new Map<string, number>();
let container: HTMLDivElement | null = null;

function host(): HTMLDivElement {
  if (container && container.isConnected) return container;
  container = document.createElement("div");
  container.className = "site-toasts";
  container.setAttribute("role", "region");
  container.setAttribute("aria-label", "Avisos");
  document.body.appendChild(container);
  return container;
}

export function showToast(text: string, tone: "success" | "error" | "warning" = "success"): void {
  const now = Date.now();
  if ((recent.get(text) ?? 0) > now - 8000) return;
  recent.set(text, now);
  const toast = document.createElement("div");
  toast.className = `site-toast site-toast--${tone}`;
  toast.setAttribute("role", tone === "error" ? "alert" : "status");
  const icon = document.createElement("span");
  icon.className = "site-toast__icon";
  icon.textContent = tone === "error" ? "!" : tone === "warning" ? "i" : "✓";
  const body = document.createElement("p");
  body.textContent = text;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "site-toast__close";
  close.setAttribute("aria-label", "Fechar aviso");
  close.textContent = "×";
  const dismiss = () => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 180);
  };
  close.addEventListener("click", dismiss);
  toast.append(icon, body, close);
  const list = host();
  list.appendChild(toast);
  while (list.children.length > 4) list.firstElementChild?.remove();
  if (tone !== "error") window.setTimeout(dismiss, tone === "warning" ? 9000 : 6000);
}

function check(element: Element): void {
  // Com acento ja aplicado: assim a correcao de acentos no paragrafo nao gera um segundo aviso.
  const text = accentText((element.textContent ?? "").replace(/\s+/g, " ").trim());
  if (!text || lastText.get(element) === text) return;
  lastText.set(element, text);
  const plain = text.replace(/^erro:\s*/i, "Erro: ");
  showToast(plain, ERROR.test(text) ? "error" : WARNING.test(text) ? "warning" : "success");
}

export function startSiteToasts(): void {
  let scheduled = false;
  const scan = () => { scheduled = false; document.querySelectorAll(SOURCES).forEach(check); };
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
}
