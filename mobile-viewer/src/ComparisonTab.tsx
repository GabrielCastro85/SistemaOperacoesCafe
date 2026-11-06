import { useCallback, useEffect, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";

interface PeriodSummary {
  start: string; end: string; operationCount: number; sacks: number; amountCents: number;
  clients: Array<{ name: string; sacks: number; amountCents: number }>;
  companies: Array<{ name: string; sacks: number; amountCents: number }>;
}
interface ComparisonResponse { first: PeriodSummary; second: PeriodSummary }

function iso(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function defaults(): { firstStart: string; firstEnd: string; secondStart: string; secondEnd: string } {
  const now = new Date();
  const prior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const priorEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  return { firstStart: iso(prior), firstEnd: iso(priorEnd), secondStart: iso(new Date(now.getFullYear(), now.getMonth(), 1)), secondEnd: iso(now) };
}
function percent(current: number, previous: number): string {
  if (!previous) return current ? "+100%" : "0%";
  const value = ((current - previous) / previous) * 100;
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function ComparisonTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const [dates, setDates] = useState(defaults);
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setData(null); setError(null);
    try { setData(await apiJson<ComparisonResponse>(`/v1/viewer/comparison?${queryString({ organizationId, legalEntityId, ...dates })}`)); }
    catch (value) { setError(value instanceof Error ? value.message : "Falha ao gerar o comparativo."); }
  }, [organizationId, legalEntityId, dates]);
  useEffect(() => { void load(); }, [load]);
  return <>
    <PageHeader eyebrow="Visão geral" title="Comparativo de períodos" description="Compare volume, serviços, empresas e clientes entre dois intervalos." />
    <FilterBar activeCount={4} onClear={() => setDates(defaults())}>
      {(["firstStart", "firstEnd", "secondStart", "secondEnd"] as const).map((key) => <label key={key} className="viewer-field"><span>{key === "firstStart" ? "Período anterior — início" : key === "firstEnd" ? "Período anterior — fim" : key === "secondStart" ? "Período atual — início" : "Período atual — fim"}</span><input className="ui-input" type="date" value={dates[key]} onChange={(event) => setDates((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
    </FilterBar>
    {error ? <Alert tone="danger" title="Falha ao gerar comparativo">{error}</Alert> : null}
    {!error && !data ? <LoadingState label="Calculando períodos..." /> : null}
    {data ? <>
      <div className="dashboard-grid dashboard-grid--hero">
        <Card title="Sacas vendidas"><strong>{data.second.sacks.toLocaleString("pt-BR")}</strong><small>{percent(data.second.sacks, data.first.sacks)} em relação ao período anterior</small></Card>
        <Card title="Serviços"><strong>{formatCurrencyBr(data.second.amountCents)}</strong><small>{percent(data.second.amountCents, data.first.amountCents)} em relação ao período anterior</small></Card>
        <Card title="Operações"><strong>{data.second.operationCount.toLocaleString("pt-BR")}</strong><small>{percent(data.second.operationCount, data.first.operationCount)} em relação ao período anterior</small></Card>
      </div>
      <div className="viewer-card-grid">
        {[data.first, data.second].map((period, index) => <Card key={period.start} eyebrow={index ? "Período atual" : "Período anterior"} title={`${formatDateBr(period.start)} a ${formatDateBr(period.end)}`}>
          <p className="viewer-card-line"><strong>{period.sacks.toLocaleString("pt-BR")} sacas · {formatCurrencyBr(period.amountCents)}</strong></p>
          <p className="viewer-card-line">{period.operationCount} operação(ões)</p>
          <p className="viewer-card-line viewer-card-line--muted">Empresas: {period.companies.map((row) => `${row.name} (${row.sacks.toLocaleString("pt-BR")} sc)`).join(" · ") || "Sem movimento"}</p>
          <p className="viewer-card-line">Principais clientes:</p>
          {period.clients.slice(0, 5).map((client) => <p key={client.name} className="viewer-card-line viewer-card-line--muted">{client.name}: {client.sacks.toLocaleString("pt-BR")} sc · {formatCurrencyBr(client.amountCents)}</p>)}
        </Card>)}
      </div>
    </> : null}
  </>;
}
