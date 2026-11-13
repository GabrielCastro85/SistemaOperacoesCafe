import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ClientChargeDetail } from "../../../shared/types/domain";
import { chargeDaeLines } from "../../../shared/utils/chargeDaeAdjustment";
import { multiplyDecimalByCents } from "../../../shared/utils/decimal";
import { formatCurrencyFromCents, formatDateOnlyBr, parseCurrencyToCents } from "../../../shared/utils/format";

// Versao para o parceiro (ex.: Neto): a partir da cobranca dele, tira as notas
// e ajustes que ele pediu e aplica o preco por saca que ele cobra dos clientes
// dele (interno/externo). Gera PDF ou planilha no mesmo modelo, sem gravar nada
// e sem mexer na cobranca original.

const isPackaging = (operation: ClientChargeDetail["operations"][number]) =>
  Number(operation.quantitySacksDecimalSnapshot ?? 0) === 0 && operation.serviceAmountCentsSnapshot > 0 && operation.serviceRateCentsSnapshot > 0;

function adjustmentLabel(adjustment: ClientChargeDetail["adjustments"][number]): string {
  const dae = chargeDaeLines(adjustment);
  if (dae.length) return dae.map((line) => line.label).join(" + ");
  return adjustment.description;
}

const companyKey = (value: string | null | undefined) => (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

export function ChargePartnerVersionModal({ detail, onClose }: { detail: ClientChargeDetail; onClose: () => void }): JSX.Element {
  const [excludedOps, setExcludedOps] = useState<Set<string>>(new Set());
  const [excludedAdjustments, setExcludedAdjustments] = useState<Set<string>>(new Set());
  const [internalRate, setInternalRate] = useState("");
  const [externalRate, setExternalRate] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  // Preco especifico por empresa: { "GAP COFFEE LTDA": "3,00" }.
  const [companyPrices, setCompanyPrices] = useState<Record<string, string>>({});
  const [companyToAdd, setCompanyToAdd] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const hasInternal = detail.operations.some((operation) => operation.operationScopeSnapshot === "INTERNAL" && !isPackaging(operation));
  const hasExternal = detail.operations.some((operation) => operation.operationScopeSnapshot === "EXTERNAL" && !isPackaging(operation));
  const internalCents = internalRate.trim() ? parseCurrencyToCents(internalRate) : null;
  const externalCents = externalRate.trim() ? parseCurrencyToCents(externalRate) : null;

  const companies = useMemo(() => [...new Set(detail.operations.filter((operation) => !isPackaging(operation)).map((operation) => (operation.destinationNameSnapshot ?? "").trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "pt-BR")), [detail.operations]);
  const companyCents = useMemo(() => new Map(Object.entries(companyPrices).filter(([, value]) => value.trim()).map(([company, value]) => [companyKey(company), parseCurrencyToCents(value)])), [companyPrices]);

  const newAmount = (operation: ClientChargeDetail["operations"][number]): number => {
    if (isPackaging(operation)) return operation.serviceAmountCentsSnapshot;
    const rate = companyCents.get(companyKey(operation.destinationNameSnapshot)) ?? (operation.operationScopeSnapshot === "INTERNAL" ? internalCents : externalCents);
    return rate === null ? operation.serviceAmountCentsSnapshot : multiplyDecimalByCents(operation.quantitySacksDecimalSnapshot, rate);
  };

  const keptOps = detail.operations.filter((operation) => !excludedOps.has(operation.id));
  const keptAdjustments = detail.adjustments.filter((adjustment) => !excludedAdjustments.has(adjustment.id));
  const subtotal = keptOps.reduce((sum, operation) => sum + newAmount(operation), 0);
  const adjustmentsTotal = keptAdjustments.reduce((sum, adjustment) => sum + (adjustment.effect === "INCREASE_RECEIVABLE" ? adjustment.amountCents : -adjustment.amountCents), 0);
  const total = subtotal + adjustmentsTotal;

  const visibleOps = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return [...detail.operations]
      .sort((left, right) => left.operationDateSnapshot.localeCompare(right.operationDateSnapshot) || (Number(left.fiscalDocumentNumberSnapshot) || 0) - (Number(right.fiscalDocumentNumberSnapshot) || 0))
      .filter((operation) => !term || [operation.fiscalDocumentNumberSnapshot ?? "", operation.destinationNameSnapshot ?? "", operation.issuerShortLabel ?? ""].some((text) => text.toLocaleLowerCase("pt-BR").includes(term)));
  }, [detail.operations, search]);

  const toggle = (set: Set<string>, id: string, update: (next: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    update(next);
  };

  async function generate(format: "pdf" | "xlsx"): Promise<void> {
    if (!keptOps.length) { setMessage("Deixe pelo menos uma nota marcada."); return; }
    if ((internalRate.trim() && internalCents === null) || (externalRate.trim() && externalCents === null)) { setMessage("Confira os preços por saca."); return; }
    setBusy(format);
    setMessage(null);
    try {
      const saved = await window.operationsCafe.exportChargePartnerVersion({
        chargeId: detail.charge.id,
        excludedOperationIds: [...excludedOps],
        excludedAdjustmentIds: [...excludedAdjustments],
        internalRateCents: internalCents,
        externalRateCents: externalCents,
        companyRates: Object.entries(companyPrices).filter(([, value]) => value.trim()).map(([company, value]) => ({ company, rateCents: parseCurrencyToCents(value) })),
        format
      });
      setMessage(saved ? `${format === "pdf" ? "PDF" : "Planilha"} da versão do parceiro gerado. A cobrança original não mudou.` : "Geração cancelada.");
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível gerar o arquivo."}`);
    } finally { setBusy(null); }
  }

  // Desenhada direto no <body>: dentro da pagina ela ficava por baixo do topo e do "Nesta pagina".
  return createPortal(
    <div className="partner-modal-backdrop charge-partner-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="partner-modal charge-partner-modal" role="dialog" aria-modal="true" aria-label="Versão para o parceiro">
        <header className="partner-modal__header"><div><span>Cobrança · {formatDateOnlyBr(detail.charge.periodStart)} a {formatDateOnlyBr(detail.charge.periodEnd)}</span><strong>Versão para o parceiro</strong></div><button type="button" className="partner-modal__close" onClick={onClose} aria-label="Fechar">x</button></header>
        <div className="partner-modal__body charge-partner">
          <p className="muted">Tire as notas que o parceiro pediu e informe o preço por saca dele. O arquivo sai no mesmo modelo da cobrança; <strong>a cobrança original não muda</strong>. Preço em branco mantém o valor original.</p>
          <div className="charge-partner__rates">
            {hasInternal ? <label>Preço interno (R$/saca)<input inputMode="decimal" value={internalRate} onChange={(event) => setInternalRate(event.target.value)} placeholder="Ex.: 4,00" /></label> : null}
            {hasExternal ? <label>Preço externo (R$/saca)<input inputMode="decimal" value={externalRate} onChange={(event) => setExternalRate(event.target.value)} placeholder="Ex.: 12,00" /></label> : null}
            <div className="charge-partner__total"><span>Total da versão do parceiro</span><strong>{formatCurrencyFromCents(total)}</strong><small>{keptOps.length} de {detail.operations.length} notas · original {formatCurrencyFromCents(detail.charge.finalAmountCents)}</small></div>
          </div>
          <div className="charge-partner__companies">
            <div className="charge-partner__head"><strong>Preço por empresa (opcional)</strong><small className="muted">Vale no lugar do interno/externo para as notas daquela empresa.</small></div>
            <div className="charge-partner__company-add">
              <select value={companyToAdd} onChange={(event) => setCompanyToAdd(event.target.value)}>
                <option value="">Escolha a empresa</option>
                {companies.filter((company) => !(company in companyPrices)).map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
              <button type="button" disabled={!companyToAdd} onClick={() => { setCompanyPrices((current) => ({ ...current, [companyToAdd]: "" })); setCompanyToAdd(""); }}>Adicionar empresa</button>
            </div>
            {Object.keys(companyPrices).length ? <div className="charge-partner__company-list">
              {Object.entries(companyPrices).map(([company, value]) => {
                const count = detail.operations.filter((operation) => companyKey(operation.destinationNameSnapshot) === companyKey(company)).length;
                return (
                  <div key={company} className="charge-partner__company-row">
                    <span>{company}<small>{count} nota{count === 1 ? "" : "s"}</small></span>
                    <label>R$/saca<input inputMode="decimal" autoFocus={!value} value={value} onChange={(event) => setCompanyPrices((current) => ({ ...current, [company]: event.target.value }))} placeholder="0,00" /></label>
                    <button type="button" onClick={() => setCompanyPrices((current) => { const next = { ...current }; delete next[company]; return next; })} aria-label={`Remover ${company}`}>Remover</button>
                  </div>
                );
              })}
            </div> : null}
          </div>
          <div className="charge-partner__head">
            <strong>Notas</strong>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar NF, empresa ou emitente" />
            <button type="button" onClick={() => setExcludedOps(new Set())}>Marcar todas</button>
          </div>
          <div className="charge-partner__list">
            {visibleOps.map((operation) => {
              const off = excludedOps.has(operation.id);
              const amount = newAmount(operation);
              return (
                <label key={operation.id} className={`charge-partner__row${off ? " is-off" : ""}`}>
                  <input type="checkbox" checked={!off} onChange={() => toggle(excludedOps, operation.id, setExcludedOps)} />
                  <span className="charge-partner__nf">NF {operation.fiscalDocumentNumberSnapshot ?? "-"}<small>{formatDateOnlyBr(operation.operationDateSnapshot)}{operation.issuerShortLabel ? ` · ${operation.issuerShortLabel}` : ""}</small></span>
                  <span className="charge-partner__company">{operation.destinationNameSnapshot ?? "-"}<small>{isPackaging(operation) ? "Sacaria" : operation.operationScopeSnapshot === "INTERNAL" ? "Interno" : "Externo"} · {isPackaging(operation) ? "unidades" : `${operation.quantitySacksDecimalSnapshot} sc`}</small></span>
                  <span className="charge-partner__value">{formatCurrencyFromCents(amount)}{amount !== operation.serviceAmountCentsSnapshot ? <small>era {formatCurrencyFromCents(operation.serviceAmountCentsSnapshot)}</small> : null}</span>
                </label>
              );
            })}
          </div>
          {detail.adjustments.length ? <>
            <div className="charge-partner__head"><strong>DAE, CT-e e outros ajustes</strong><small className="muted">Desmarque o que não vai para o parceiro.</small></div>
            <div className="charge-partner__list">
              {detail.adjustments.map((adjustment) => {
                const off = excludedAdjustments.has(adjustment.id);
                return (
                  <label key={adjustment.id} className={`charge-partner__row${off ? " is-off" : ""}`}>
                    <input type="checkbox" checked={!off} onChange={() => toggle(excludedAdjustments, adjustment.id, setExcludedAdjustments)} />
                    <span className="charge-partner__company">{adjustmentLabel(adjustment)}</span>
                    <span className="charge-partner__value">{adjustment.effect === "INCREASE_RECEIVABLE" ? "+" : "−"} {formatCurrencyFromCents(adjustment.amountCents)}</span>
                  </label>
                );
              })}
            </div>
          </> : null}
          {message ? <div className="transfer-message" role="status">{message}</div> : null}
        </div>
        <footer className="partner-modal__footer">
          <button type="button" onClick={onClose} disabled={Boolean(busy)}>Fechar</button>
          <button type="button" onClick={() => void generate("xlsx")} disabled={Boolean(busy)}>{busy === "xlsx" ? "Gerando..." : "Gerar planilha"}</button>
          <button type="button" className="primary" onClick={() => void generate("pdf")} disabled={Boolean(busy)}>{busy === "pdf" ? "Gerando..." : "Gerar PDF"}</button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
