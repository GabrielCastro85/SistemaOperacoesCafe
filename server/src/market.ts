import type { FastifyInstance } from "fastify";

// Cotacoes do carrossel do site (tudo em reais): cafe arabica e conilon
// (indicadores CEPEA/Esalq, R$/saca de 60 kg), dolar, euro e ouro (AwesomeAPI)
// e Ibovespa (Yahoo Finance). O servidor busca, guarda por 10 minutos e o site
// so le daqui -- as fontes nao sao consultadas a cada visita. Cada fonte e
// independente: se uma falhar, as outras continuam e o ultimo valor bom fica.

export interface MarketQuote {
  key: string;
  label: string;
  value: number;
  /** Como mostrar o valor: dinheiro em reais ou pontos (Ibovespa). */
  format: "brl" | "points";
  unit: string | null;
  changePercent: number | null;
  /** Data/hora da cotacao na fonte (ISO). */
  asOf: string | null;
  source: string;
}

const CACHE_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const TROY_OUNCE_GRAMS = 31.1034768;

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9" }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${new URL(url).host}`);
  return response.text();
}

function brNumber(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", ".").replace("%", "").trim());
}

function brDateToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** Primeira linha (mais recente) da tabela de um indicador na pagina do CEPEA. */
export function parseCepeaTable(html: string, tableId: string): { date: string | null; value: number; changePercent: number | null } | null {
  const start = html.indexOf(`id="${tableId}"`);
  if (start < 0) return null;
  const end = html.indexOf("</table>", start);
  const cells = [...html.slice(start, end > start ? end : undefined).matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((match) => match[1].trim());
  // colunas: data, valor R$, var. dia, var. mes, valor US$
  if (cells.length < 3) return null;
  const value = brNumber(cells[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const change = brNumber(cells[2]);
  return { date: brDateToIso(cells[0]), value, changePercent: Number.isFinite(change) ? change : null };
}

async function coffeeQuotes(): Promise<MarketQuote[]> {
  const html = await fetchText("https://www.cepea.org.br/br/indicador/cafe.aspx");
  const quotes: MarketQuote[] = [];
  const arabica = parseCepeaTable(html, "imagenet-indicador1");
  const robusta = parseCepeaTable(html, "imagenet-indicador2");
  if (arabica) quotes.push({ key: "arabica", label: "Café arábica", value: arabica.value, format: "brl", unit: "saca", changePercent: arabica.changePercent, asOf: arabica.date, source: "CEPEA/Esalq" });
  if (robusta) quotes.push({ key: "conilon", label: "Café conilon", value: robusta.value, format: "brl", unit: "saca", changePercent: robusta.changePercent, asOf: robusta.date, source: "CEPEA/Esalq" });
  if (!quotes.length) throw new Error("Tabela do CEPEA nao encontrada.");
  return quotes;
}

async function currencyQuotes(): Promise<MarketQuote[]> {
  const data = JSON.parse(await fetchText("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,XAU-BRL")) as Record<string, { bid: string; pctChange: string; create_date?: string }>;
  const asOf = (item: { create_date?: string } | undefined) => item?.create_date ? `${item.create_date.replace(" ", "T")}-03:00` : null;
  const quotes: MarketQuote[] = [];
  const usd = data.USDBRL;
  const eur = data.EURBRL;
  const gold = data.XAUBRL;
  if (usd && Number(usd.bid) > 0) quotes.push({ key: "usd", label: "Dólar", value: Number(usd.bid), format: "brl", unit: null, changePercent: Number(usd.pctChange), asOf: asOf(usd), source: "AwesomeAPI" });
  if (eur && Number(eur.bid) > 0) quotes.push({ key: "eur", label: "Euro", value: Number(eur.bid), format: "brl", unit: null, changePercent: Number(eur.pctChange), asOf: asOf(eur), source: "AwesomeAPI" });
  if (gold && Number(gold.bid) > 0) quotes.push({ key: "gold", label: "Ouro", value: Number(gold.bid) / TROY_OUNCE_GRAMS, format: "brl", unit: "grama", changePercent: Number(gold.pctChange), asOf: asOf(gold), source: "AwesomeAPI" });
  return quotes;
}

async function yahooQuote(symbol: string): Promise<{ price: number; changePercent: number | null; asOf: string | null }> {
  const data = JSON.parse(await fetchText(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`)) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; regularMarketTime?: number } }> };
  };
  const meta = data.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`${symbol} sem valor.`);
  const previous = Number(meta?.chartPreviousClose ?? meta?.previousClose);
  return {
    price,
    changePercent: Number.isFinite(previous) && previous > 0 ? ((price - previous) / previous) * 100 : null,
    asOf: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null
  };
}

async function ibovespaQuote(): Promise<MarketQuote[]> {
  const quote = await yahooQuote("^BVSP");
  return [{ key: "ibov", label: "Ibovespa", value: quote.price, format: "points", unit: "pts", changePercent: quote.changePercent, asOf: quote.asOf, source: "Yahoo Finance" }];
}

// Reserva para dolar, euro e ouro: a AwesomeAPI recusa pedidos de servidores
// de nuvem (Railway). Ouro: contrato futuro em US$/onca convertido para R$/grama.
async function currencyQuotesFromYahoo(): Promise<MarketQuote[]> {
  const [usd, eur, gold] = await Promise.all([yahooQuote("BRL=X"), yahooQuote("EURBRL=X"), yahooQuote("GC=F")]);
  const goldChange = gold.changePercent !== null && usd.changePercent !== null
    ? ((1 + gold.changePercent / 100) * (1 + usd.changePercent / 100) - 1) * 100
    : gold.changePercent;
  return [
    { key: "usd", label: "Dólar", value: usd.price, format: "brl", unit: null, changePercent: usd.changePercent, asOf: usd.asOf, source: "Yahoo Finance" },
    { key: "eur", label: "Euro", value: eur.price, format: "brl", unit: null, changePercent: eur.changePercent, asOf: eur.asOf, source: "Yahoo Finance" },
    { key: "gold", label: "Ouro", value: (gold.price * usd.price) / TROY_OUNCE_GRAMS, format: "brl", unit: "grama", changePercent: goldChange, asOf: gold.asOf, source: "Yahoo Finance" }
  ];
}

async function currencyQuotesWithFallback(): Promise<MarketQuote[]> {
  try {
    const quotes = await currencyQuotes();
    if (quotes.length === 3) return quotes;
  } catch { /* usa a reserva */ }
  return currencyQuotesFromYahoo();
}

const ORDER = ["arabica", "conilon", "usd", "eur", "gold", "ibov"];
const lastGood = new Map<string, MarketQuote>();
let fetchedAt = 0;
let refreshing: Promise<void> | null = null;

async function refresh(log: FastifyInstance["log"]): Promise<void> {
  const results = await Promise.allSettled([coffeeQuotes(), currencyQuotesWithFallback(), ibovespaQuote()]);
  for (const result of results) {
    if (result.status === "fulfilled") result.value.forEach((quote) => lastGood.set(quote.key, quote));
    else log.warn({ err: result.reason instanceof Error ? result.reason.message : String(result.reason) }, "Cotacao indisponivel");
  }
  fetchedAt = Date.now();
}

export function registerMarketRoutes(app: FastifyInstance): void {
  // Publico: so dados de mercado, sem nada das empresas.
  app.get("/v1/market/quotes", async (_request, reply) => {
    const stale = Date.now() - fetchedAt > CACHE_MS;
    if (stale && !refreshing) refreshing = refresh(app.log).finally(() => { refreshing = null; });
    // Primeira chamada (sem nada guardado): espera; depois responde na hora e atualiza por tras.
    if (!lastGood.size && refreshing) await refreshing;
    reply.header("Cache-Control", "public, max-age=300");
    return {
      updatedAt: fetchedAt ? new Date(fetchedAt).toISOString() : null,
      quotes: ORDER.map((key) => lastGood.get(key)).filter((quote): quote is MarketQuote => Boolean(quote))
    };
  });
}
