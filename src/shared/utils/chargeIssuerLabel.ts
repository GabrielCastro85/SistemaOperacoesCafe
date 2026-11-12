// Nome curto de quem emitiu a nota, para a cobranca: "VILLA MG", "VILLA ES",
// "GRÃO MG", "GRÃO SP" ou, quando a nota e' de terceiro, o comeco do nome do
// emitente ("PRIME COFFEE").

const strip = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

const STATE_BY_NAME: Record<string, string> = {
  "MINAS GERAIS": "MG", "ESPIRITO SANTO": "ES", "SAO PAULO": "SP", "PARANA": "PR", "BAHIA": "BA", "RIO DE JANEIRO": "RJ", "GOIAS": "GO", "RONDONIA": "RO"
};

export function isOwnBrandName(name: string): boolean {
  return ownBrand(name) !== null;
}

function ownBrand(name: string): string | null {
  const normalized = strip(name);
  if (/\bGRAO\s*(?:&|E)\s*GRAO\b/.test(normalized)) return "GRÃO";
  if (/\bVILLA\s+COFFEE\b/.test(normalized)) return "VILLA";
  return null;
}

export function ownEntityShortLabel(entity: { tradeName?: string | null; legalName?: string | null; state?: string | null }): string {
  const names = [entity.tradeName ?? "", entity.legalName ?? ""];
  const brand = names.map(ownBrand).find(Boolean) ?? thirdPartyShortName(entity.tradeName || entity.legalName || "");
  let uf = (entity.state ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) {
    const trade = strip(entity.tradeName ?? "");
    uf = Object.entries(STATE_BY_NAME).find(([name]) => trade.endsWith(name))?.[1] ?? "";
  }
  return uf ? `${brand} ${uf}` : brand;
}

const STOP_WORDS = new Set(["COMERCIO", "COMERCIAL", "COMERCIALIZACAO", "EXPORTACAO", "EXPORTADORA", "IMPORTACAO", "INDUSTRIA", "IND", "COM", "EXP", "IMP", "E", "LTDA", "ME", "EPP", "EIRELI", "SA", "S/A", "CAFE", "CAFES", "-", "&"]);
const CONNECTORS = new Set(["DE", "DO", "DA", "DOS", "DAS"]);

// "PRIME COFFEE COMERCIO E EXPORTACAO..." -> "PRIME COFFEE";
// "BOM DO GRAOS EXPORTACAO..." -> "BOM DO GRAOS".
export function thirdPartyShortName(name: string): string {
  const words = strip(name).replace(/[.,]/g, " ").split(" ").filter(Boolean);
  const picked: string[] = [];
  let significant = 0;
  for (const word of words) {
    if (STOP_WORDS.has(word)) { if (significant) break; continue; }
    if (CONNECTORS.has(word)) { if (significant) picked.push(word); continue; }
    picked.push(word);
    if (++significant === 2) break;
  }
  while (picked.length && CONNECTORS.has(picked[picked.length - 1])) picked.pop();
  return picked.join(" ") || strip(name).split(" ").slice(0, 2).join(" ") || "-";
}

// Sem o rotulo calculado pelo sistema (cobrancas antigas/outras rotas): tenta
// pelo nome gravado na cobranca, sem o estado.
export function chargeIssuerLabelFromNames(issuerName: string | null | undefined, ownEntityName: string | null | undefined): string {
  const issuer = issuerName?.trim() || "";
  if (issuer && !ownBrand(issuer)) return thirdPartyShortName(issuer);
  const own = ownEntityName?.trim() || issuer;
  return own ? ownEntityShortLabel({ tradeName: own }) : "-";
}
