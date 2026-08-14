import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { formatCurrencyBr } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { Card } from "./renderer/design-system/components/Card";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import { CoinsIcon, ReportIcon, WalletIcon } from "./renderer/design-system/components/Icons";
import { companyColorClass } from "./companyColor";
import type { AccountPayableStatus, ClientChargeStatus } from "./types";

const OPEN_CHARGE_STATUSES: ClientChargeStatus[] = ["DRAFT", "PENDING_REVIEW", "ISSUED", "PARTIALLY_PAID", "OVERDUE"];
const OPEN_PAYABLE_STATUSES: AccountPayableStatus[] = ["DRAFT", "SCHEDULED", "OPEN", "PARTIALLY_PAID", "OVERDUE", "CONTESTED"];
const AGGREGATE_LIMIT = 3000;

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

export function FinanceTab(): JSX.Element {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setError(null);
    const [chargesResult, payablesResult] = await Promise.all([
      supabase.from("client_charges").select("status, open_amount_cents, own_legal_entity:legal_entities(trade_name)").limit(AGGREGATE_LIMIT),
      supabase.from("accounts_payable").select("status, open_amount_cents, own_legal_entity:legal_entities(trade_name)").limit(AGGREGATE_LIMIT)
    ]);
    const firstError = chargesResult.error?.message ?? payablesResult.error?.message;
    if (firstError) {
      setError(firstError);
      return;
    }

    const byEntity = new Map<string, EntityBreakdown>();
    function entityRow(name: string): EntityBreakdown {
      const existing = byEntity.get(name);
      if (existing) return existing;
      const created: EntityBreakdown = { name, receivableCents: 0, payableCents: 0 };
      byEntity.set(name, created);
      return created;
    }

    const chargeRows = (chargesResult.data ?? []) as unknown as Array<{
      status: ClientChargeStatus;
      open_amount_cents: number;
      own_legal_entity: { trade_name: string } | null;
    }>;
    const payableRows = (payablesResult.data ?? []) as unknown as Array<{
      status: AccountPayableStatus;
      open_amount_cents: number | null;
      own_legal_entity: { trade_name: string } | null;
    }>;

    let totalReceivableCents = 0;
    for (const row of chargeRows) {
      if (!OPEN_CHARGE_STATUSES.includes(row.status)) continue;
      const amount = row.open_amount_cents ?? 0;
      totalReceivableCents += amount;
      entityRow(row.own_legal_entity?.trade_name ?? "Empresa não identificada").receivableCents += amount;
    }

    let totalPayableCents = 0;
    for (const row of payableRows) {
      if (!OPEN_PAYABLE_STATUSES.includes(row.status)) continue;
      const amount = row.open_amount_cents ?? 0;
      totalPayableCents += amount;
      entityRow(row.own_legal_entity?.trade_name ?? "Empresa não identificada").payableCents += amount;
    }

    setSummary({
      totalReceivableCents,
      totalPayableCents,
      byEntity: Array.from(byEntity.values()).sort((a, b) => b.receivableCents + b.payableCents - (a.receivableCents + a.payableCents))
    });
  }

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
