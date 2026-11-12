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
  return `<span class="site-ticker__item" title="${escape(title)}"><span class="site-ticker__label">${escape(quote.label)}</span><span class="site-ticker__value">${escape(formatValue(quote))}</span>${changeText ? `<span class="site-ticker__change site-ticker__change--${direction}">${arrow} ${changeText}</span>` : ""}</span>`;
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
