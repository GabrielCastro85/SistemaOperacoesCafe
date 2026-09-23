import { useCallback, useEffect, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr } from "./viewerFormat";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { Card } from "./renderer/design-system/components/Card";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import { CoinsIcon, InvoiceIcon, PackageIcon, WalletIcon } from "./renderer/design-system/components/Icons";

interface DashboardSummary {
  sacks: number;
  operationCount: number;
  receivableCents: number;
  receivedCents: number;
  generatedServiceCents: number;
  unbilledCount: number;
  overdueCents: number;
}

function currentMonth(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${String(lastDay).padStart(2, "0")}` };
}

export function DashboardTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentMonth();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    setSummary(null);
    try {
      setSummary(await apiJson(`/v1/viewer/dashboard?${queryString({ organizationId, legalEntityId, periodStart, periodEnd })}`));
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar o dashboard."); }
  }, [organizationId, legalEntityId, periodStart, periodEnd]);

  useEffect(() => { if (organizationId) void load(); }, [organizationId, load]);

  return (
    <>
      <PageHeader eyebrow="Visão geral" title="Dashboard" description="Sacas, valores a receber e recebimentos do período selecionado." />
      <div className="viewer-period-filter">
        <label>Início<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
        <label>Fim<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
      </div>
      {error ? <Alert tone="danger" title="Falha ao carregar o dashboard">{error}</Alert> : null}
      {!error && !summary ? <LoadingState label="Carregando indicadores..." /> : null}
      {summary ? (
        <div className="dashboard-grid dashboard-grid--hero">
          <Card><span className="kpi-icon"><PackageIcon /></span><span>Sacas no período</span><strong>{summary.sacks.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</strong><small>{summary.operationCount} operação(ões)</small></Card>
          <Card><span className="kpi-icon"><WalletIcon /></span><span>Total a receber</span><strong>{formatCurrencyBr(summary.receivableCents)}</strong><small>Todas as empresas · {summary.unbilledCount} operação(ões) sem cobrança</small></Card>
          <Card><span className="kpi-icon"><CoinsIcon /></span><span>Recebido no período</span><strong>{formatCurrencyBr(summary.receivedCents)}</strong><small>Todas as empresas</small></Card>
          <Card><span className="kpi-icon"><InvoiceIcon /></span><span>Serviços gerados</span><strong>{formatCurrencyBr(summary.generatedServiceCents)}</strong><small>Vencido: {formatCurrencyBr(summary.overdueCents)}</small></Card>
        </div>
      ) : null}
    </>
  );
}
