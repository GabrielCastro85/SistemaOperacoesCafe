// Carrossel de cotacoes no topo do site (tudo em reais): cafe arabica e
// conilon (CEPEA), dolar, euro, ouro e Ibovespa. Os valores vem do servidor
// (GET /v1/market/quotes), que consulta as fontes e guarda por 10 minutos.

interface MarketQuote {
  key: string;
  label: string;
  value: number;
  format: "brl" | "points";
  unit: string | null;
  changePercent: number | null;
  asOf: string | null;
  source: string;
}

const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "https://mindful-peace-production.up.railway.app").replace(/\/$/, "");
const REFRESH_MS = 10 * 60 * 1000;
const UNIT_LABEL: Record<string, string> = { saca: "/saca", grama: "/g", pts: " pts" };

// Icones desenhados (SVG): bandeira em emoji nao aparece no Windows (vira "US").
const bean = (fill: string, line: string) => `<svg viewBox="0 0 16 16" aria-hidden="true"><ellipse cx="8" cy="8" rx="5.2" ry="7" transform="rotate(35 8 8)" fill="${fill}"/><path d="M5.2 12.6c2.6-1.6 1.2-5.6 5.6-9.2" fill="none" stroke="${line}" stroke-width="1.3" stroke-linecap="round"/></svg>`;
const ICONS: Record<string, string> = {
  arabica: bean("#b07a45", "#5a3518"),
  conilon: bean("#5e3a1f", "#2b190b"),
  usd: `<svg viewBox="0 0 22 15" aria-hidden="true"><rect width="22" height="15" rx="2" fill="#fff"/><g fill="#b22234">${[0, 2, 4, 6, 8, 10, 12].map((row) => `<rect y="${(row * 15) / 13}" width="22" height="${15 / 13}"/>`).join("")}</g><rect width="9.5" height="${(7 * 15) / 13}" fill="#3c3b6e"/><g fill="#fff">${[[1.6, 1.6], [4.7, 1.6], [7.8, 1.6], [3.1, 3.7], [6.2, 3.7], [1.6, 5.8], [4.7, 5.8], [7.8, 5.8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.55"/>`).join("")}</g></svg>`,
  eur: `<svg viewBox="0 0 22 15" aria-hidden="true"><rect width="22" height="15" rx="2" fill="#003399"/><g fill="#ffcc00">${Array.from({ length: 12 }, (_, index) => { const angle = (index * Math.PI) / 6; return `<circle cx="${(11 + 4.6 * Math.sin(angle)).toFixed(2)}" cy="${(7.5 - 4.6 * Math.cos(angle)).toFixed(2)}" r="0.75"/>`; }).join("")}</g></svg>`,
  gold: `<svg viewBox="0 0 20 15" aria-hidden="true"><defs><linearGradient id="site-ticker-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe58a"/><stop offset="1" stop-color="#c8901a"/></linearGradient></defs><path d="M4.5 3h11l3.5 9.5H1z" fill="url(#site-ticker-gold)" stroke="#8a5f08" stroke-width="0.8" stroke-linejoin="round"/><path d="M6 5h6" stroke="#fff6cf" stroke-width="1" stroke-linecap="round"/></svg>`,
  ibov: `<svg viewBox="0 0 22 15" aria-hidden="true"><rect width="22" height="15" rx="2" fill="#009c3b"/><path d="M11 2 20 7.5 11 13 2 7.5z" fill="#ffdf00"/><circle cx="11" cy="7.5" r="3.4" fill="#002776"/><path d="M7.8 6.9c2.2-.5 4.5-.2 6.4.9" fill="none" stroke="#fff" stroke-width="0.7"/></svg>`
};

let quotes: MarketQuote[] = [];
let lastRender = "";

function formatValue(quote: MarketQuote): string {
  if (quote.format === "points") return `${Math.round(quote.value).toLocaleString("pt-BR")}${UNIT_LABEL.pts}`;
  // Moedas (valores pequenos) com 4 casas, como nas cotacoes de cambio; o resto com 2.
  const money = quote.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: quote.value < 100 ? 4 : 2 });
  return `R$ ${money}${quote.unit ? UNIT_LABEL[quote.unit] ?? "" : ""}`;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return dayOnly ? date.toLocaleDateString("pt-BR") : date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function itemHtml(quote: MarketQuote): string {
  const change = quote.changePercent;
  const direction = change === null || Math.abs(change) < 0.005 ? "flat" : change > 0 ? "up" : "down";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "•";
  const changeText = change === null ? "" : `${Math.abs(change).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const title = `${quote.label}: ${formatValue(quote)} — ${quote.source}${quote.asOf ? `, ${formatDate(quote.asOf)}` : ""}`;
  const escape = (text: string) => text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char] ?? char);
  const icon = ICONS[quote.key] ? `<span class="site-ticker__icon site-ticker__icon--${quote.key}">${ICONS[quote.key]}</span>` : "";
  return `<span class="site-ticker__item" title="${escape(title)}">${icon}<span class="site-ticker__label">${escape(quote.label)}</span><span class="site-ticker__value">${escape(formatValue(quote))}</span>${changeText ? `<span class="site-ticker__change site-ticker__change--${direction}">${arrow} ${changeText}</span>` : ""}</span>`;
}

function render(): void {
  const topbar = document.querySelector<HTMLElement>(".app-topbar");
  if (!topbar || !quotes.length) return;
  let bar = document.querySelector<HTMLElement>(".site-ticker");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "site-ticker";
    bar.setAttribute("role", "marquee");
    bar.setAttribute("aria-label", "Cotações em reais");
  }
  if (bar.previousElementSibling !== topbar) topbar.after(bar);
  const items = quotes.map(itemHtml).join("");
  if (items === lastRender && bar.firstChild) return;
  lastRender = items;
  // Conteudo duplicado: a animacao anda metade da largura e recomeca sem emenda.
  bar.innerHTML = `<div class="site-ticker__track"><div class="site-ticker__group">${items}</div><div class="site-ticker__group" aria-hidden="true">${items}</div></div>`;
  const track = bar.querySelector<HTMLElement>(".site-ticker__track");
  if (track) track.style.setProperty("--site-ticker-duration", `${Math.max(30, quotes.length * 7)}s`);
}

async function load(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/v1/market/quotes`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { quotes?: MarketQuote[] };
    if (Array.isArray(data.quotes) && data.quotes.length) {
      quotes = data.quotes;
      render();
    }
  } catch { /* sem internet: o carrossel fica com os ultimos valores */ }
}

export function startSiteTicker(): void {
  void load();
  setInterval(() => void load(), REFRESH_MS);
  // As telas do app recriam o topo ao trocar de pagina/login: recoloca a faixa.
  new MutationObserver(() => { if (quotes.length && !document.querySelector(".app-topbar + .site-ticker")) render(); }).observe(document.body, { childList: true, subtree: true });
}
