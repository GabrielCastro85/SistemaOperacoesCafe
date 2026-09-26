import { useCallback, useEffect, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { Card } from "./renderer/design-system/components/Card";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import { Badge } from "./renderer/design-system/components/Badge";
import { CoinsIcon, PackageIcon, WalletIcon } from "./renderer/design-system/components/Icons";

interface DashboardSummary {
  sacks: number;
  operationCount: number;
  receivableCents: number;
  receivedCents: number;
  generatedServiceCents: number;
  unbilledCount: number;
  overdueCents: number;
  overdueCharges?: Array<{
    chargeId: string;
    chargeNumber: string | null;
    partnerName: string;
    dueDate: string | null;
    daysOverdue: number;
    openAmountCents: number;
  }>;
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
        <>
          <div className="dashboard-grid dashboard-grid--hero">
            <Card><span className="kpi-icon"><PackageIcon /></span><span>Sacas no período</span><strong>{summary.sacks.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</strong><small>{summary.operationCount} operação(ões)</small></Card>
            <Card><span className="kpi-icon"><WalletIcon /></span><span>Total a receber</span><strong>{formatCurrencyBr(summary.receivableCents)}</strong><small>Todas as empresas · {summary.unbilledCount} operação(ões) sem cobrança</small></Card>
            <Card><span className="kpi-icon"><CoinsIcon /></span><span>Recebido no período</span><strong>{formatCurrencyBr(summary.receivedCents)}</strong><small>Todas as empresas</small></Card>
          </div>
          {(summary.overdueCharges?.length ?? 0) > 0 ? (
            <Card eyebrow="Atenção" title="Cobranças vencidas em aberto" className="viewer-overdue-charges">
              <div className="alert-list">
                {(summary.overdueCharges ?? []).map((charge) => (
                  <div key={charge.chargeId} className="alert-item">
                    <Badge tone="danger">Cobrança vencida</Badge>
                    <span>
                      <strong>{charge.partnerName}</strong> — {formatCurrencyBr(charge.openAmountCents)} em aberto há {charge.daysOverdue} dia(s)
                      {charge.dueDate ? <small> · Vencimento {formatDateBr(charge.dueDate)}</small> : null}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </>
  );
}
