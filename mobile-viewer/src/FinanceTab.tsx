import { useCallback, useEffect, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { Card } from "./renderer/design-system/components/Card";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import { CoinsIcon, ReportIcon, WalletIcon } from "./renderer/design-system/components/Icons";
import { companyColorClass } from "./companyColor";

interface EntityBreakdown {
  name: string;
  receivableCents: number;
  payableCents: number;
}

interface FinanceSummary {
  totalReceivableCents: number;
  totalPayableCents: number;
  byEntity: EntityBreakdown[];
}

export function FinanceTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    setSummary(null);
    try {
      setSummary(await apiJson<FinanceSummary>(`/v1/viewer/finance?${queryString({ organizationId, legalEntityId })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar a visão financeira.");
    }
  }, [organizationId, legalEntityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const netCents = summary ? summary.totalReceivableCents - summary.totalPayableCents : 0;

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Visão financeira" description="Resumo de recebimentos e pagamentos em aberto, consolidado por empresa." />
      {error ? <Alert tone="danger" title="Falha ao carregar a visão financeira">{error}</Alert> : null}
      {!error && !summary ? <LoadingState label="Carregando indicadores financeiros..." /> : null}
      {summary ? (
        <>
          <div className="dashboard-grid dashboard-grid--hero">
            <Card>
              <span className="kpi-icon">
                <WalletIcon />
              </span>
              <span>Total a receber</span>
              <strong>{formatCurrencyBr(summary.totalReceivableCents)}</strong>
              <small>Cobranças ainda em aberto</small>
            </Card>
            <Card>
              <span className="kpi-icon">
                <CoinsIcon />
              </span>
              <span>Total a pagar</span>
              <strong>{formatCurrencyBr(summary.totalPayableCents)}</strong>
              <small>Contas a pagar em aberto</small>
            </Card>
            <Card>
              <span className="kpi-icon">
                <ReportIcon />
              </span>
              <span>Saldo líquido</span>
              <strong className={netCents >= 0 ? "viewer-amount-positive" : "viewer-amount-negative"}>{formatCurrencyBr(netCents)}</strong>
              <small>{netCents >= 0 ? "A receber supera a pagar" : "A pagar supera a receber"}</small>
            </Card>
          </div>

          <Card eyebrow="Por empresa" title="Detalhamento">
            {summary.byEntity.length === 0 ? (
              <p className="viewer-card-line viewer-card-line--muted">Nenhum valor em aberto no momento.</p>
            ) : (
              <div className="viewer-card-grid">
                {summary.byEntity.map((entity) => (
                  <Card key={entity.name} title={entity.name} className={companyColorClass(entity.name)}>
                    <p className="viewer-card-line">A receber: {formatCurrencyBr(entity.receivableCents)}</p>
                    <p className="viewer-card-line">A pagar: {formatCurrencyBr(entity.payableCents)}</p>
                    <p className="viewer-card-line">
                      <strong>Saldo: {formatCurrencyBr(entity.receivableCents - entity.payableCents)}</strong>
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : null}
    </>
  );
}
