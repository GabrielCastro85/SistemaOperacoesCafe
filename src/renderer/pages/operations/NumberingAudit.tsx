import { useState } from "react";
import type { LegalEntity } from "../../../shared/types/domain";
import { formatCnpj, formatDateOnlyBr } from "../../../shared/utils/format";
import { AdminBlock } from "../../components/layout/SectionPrimitives";

type Audit = Awaited<ReturnType<typeof window.operationsCafe.getFiscalNumberingAudit>>;

// Faixas compactas: [5,6,7,9] -> "5 a 7, 9".
function ranges(numbers: number[]): string {
  const parts: string[] = [];
  for (let index = 0; index < numbers.length; index += 1) {
    const start = numbers[index];
    let end = start;
    while (index + 1 < numbers.length && numbers[index + 1] === end + 1) { index += 1; end = numbers[index]; }
    parts.push(start === end ? String(start) : `${start} a ${end}`);
  }
  return parts.join(", ");
}

// Agrupa os numeros que faltam pelo motivo; os que pedem conferencia vem primeiro.
function groupByReason(items: Array<{ number: number; reason: string; actionable: boolean }>): Array<[string, Array<{ number: number; reason: string; actionable: boolean }>]> {
  const groups = new Map<string, Array<{ number: number; reason: string; actionable: boolean }>>();
  for (const item of items) groups.set(item.reason, [...(groups.get(item.reason) ?? []), item]);
  return [...groups.entries()].sort((left, right) => Number(right[1][0].actionable) - Number(left[1][0].actionable) || right[1].length - left[1].length);
}

function firstOfMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
}

// Conferencia de numeracao: as notas emitidas por uma empresa propria sao
// numeradas em sequencia; qualquer numero que falta no sistema e uma nota nao
// lancada, cancelada ou inutilizada. Mostra quais sao para conferir.
export function NumberingAudit({ legalEntities }: { legalEntities: LegalEntity[] }): JSX.Element {
  const ownEntities = legalEntities.filter((entity) => entity.cnpj && entity.documentPrefix !== "TERC-XML");
  const [entityId, setEntityId] = useState(ownEntities[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(): Promise<void> {
    setError(null);
    try {
      setAudit(await window.operationsCafe.getFiscalNumberingAudit({ ownLegalEntityId: entityId, periodStart, periodEnd }));
    } catch (failure) {
      setAudit(null);
      setError(failure instanceof Error ? failure.message : "Não foi possível conferir a numeração.");
    }
  }

  return (
    <AdminBlock title="Conferência de numeração das notas emitidas">
      <p className="muted">Escolha a empresa e o período. O sistema lista os números de nota que não estão lançados e, quando tem o XML, diz o motivo (entre empresas próprias, não é venda...). Em destaque ficam os que precisam de conferência: vendas com XML que não foram lançadas e números sem XML no sistema (inutilizados ou que o coletor ainda não trouxe).</p>
      <div className="numbering-audit__form">
        <label>Empresa
          <select value={entityId} onChange={(event) => setEntityId(event.target.value)}>
            {ownEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.tradeName || entity.legalName} - {formatCnpj(entity.cnpj)}</option>)}
          </select>
        </label>
        <label>Data inicial<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
        <label>Data final<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        <button className="primary" disabled={!entityId || !periodStart || !periodEnd} onClick={() => void run()}>Conferir numeração</button>
      </div>
      {error ? <p className="muted">{error}</p> : null}
      {audit ? (
        audit.series.length === 0 ? <p className="muted">Nenhuma nota emitida por esta empresa no período.</p> : (
          <div className="numbering-audit__result">
            {audit.series.map((serie) => (
              <article key={serie.series} className={serie.missing.length ? "numbering-audit__serie has-missing" : "numbering-audit__serie"}>
                <header>
                  <strong>Série {serie.series}: notas {serie.first} a {serie.last}</strong>
                  <span>{formatDateOnlyBr(serie.firstDate)} a {formatDateOnlyBr(serie.lastDate)}</span>
                </header>
                <dl>
                  <div><dt>Números na faixa</dt><dd>{serie.last - serie.first + 1}</dd></div>
                  <div><dt>Lançadas</dt><dd>{serie.launched}</dd></div>
                  <div><dt>Canceladas (com evento)</dt><dd>{serie.canceled.length}</dd></div>
                  <div><dt>Marcadas para não cadastrar</dt><dd>{serie.ignored.length}</dd></div>
                  <div><dt>Fora do sistema (com motivo)</dt><dd>{serie.missing.filter((item) => !item.actionable).length}</dd></div>
                  <div><dt>Para conferir</dt><dd>{serie.missing.filter((item) => item.actionable).length}</dd></div>
                </dl>
                {serie.missing.some((item) => item.actionable) ? null : <p>Nenhuma nota de venda faltando nesta faixa.</p>}
                {groupByReason(serie.missing).map(([reason, items]) => (
                  <p key={reason} className={items[0].actionable ? "numbering-audit__actionable" : "muted"}><strong>{reason} ({items.length}):</strong> {ranges(items.map((item) => item.number))}</p>
                ))}
                {serie.canceled.length ? <p className="muted">Canceladas: {ranges(serie.canceled)}</p> : null}
                {serie.ignored.length ? <p className="muted">Marcadas para não cadastrar: {ranges(serie.ignored)}</p> : null}
              </article>
            ))}
            <p className="muted">A faixa vai do menor ao maior número lançado no período. Notas antes do primeiro ou depois do último número lançado não aparecem: amplie o período para conferir as pontas.</p>
          </div>
        )
      ) : null}
    </AdminBlock>
  );
}
