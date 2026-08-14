import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { formatCurrencyBr } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { Card } from "./renderer/design-system/components/Card";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import { CheckCircleIcon, CoinsIcon, InvoiceIcon, WalletIcon } from "./renderer/design-system/components/Icons";

const OPEN_CHARGE_STATUSES = ["DRAFT", "PENDING_REVIEW", "ISSUED", "PARTIALLY_PAID", "OVERDUE"];
const OPEN_CONFIRMATION_STATUSES = ["DRAFT", "PENDING_REVIEW", "ISSUED", "SENT_FOR_SIGNATURE"];
const OPEN_PAYABLE_STATUSES = ["DRAFT", "SCHEDULED", "OPEN", "PARTIALLY_PAID", "OVERDUE", "CONTESTED"];
const AGGREGATE_LIMIT = 2000;
const RECENT_DAYS = 30;

interface DashboardSummary {
  openChargesCount: number;
  openChargesAmountCents: number;
  openConfirmationsCount: number;
  waitingSignatureCount: number;
  openPayablesCount: number;
  openPayablesAmountCents: number;
  recentInvoicesCount: number;
}

export function DashboardTab(): JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setError(null);
    const recentSince = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [chargesResult, confirmationsResult, payablesResult, invoicesResult] = await Promise.all([
      supabase.from("client_charges").select("status, open_amount_cents").limit(AGGREGATE_LIMIT),
      supabase.from("deal_confirmations").select("status").limit(AGGREGATE_LIMIT),
      supabase.from("accounts_payable").select("status, open_amount_cents").limit(AGGREGATE_LIMIT),
      supabase.from("fiscal_documents").select("id", { count: "exact", head: true }).neq("status", "CANCELED").gte("issue_date", recentSince)
    ]);
    const firstError =
      chargesResult.error?.message ?? confirmationsResult.error?.message ?? payablesResult.error?.message ?? invoicesResult.error?.message;
    if (firstError) {
      setError(firstError);
      return;
    }

    const openCharges = (chargesResult.data ?? []).filter((row) => OPEN_CHARGE_STATUSES.includes(row.status));
    const openConfirmations = (confirmationsResult.data ?? []).filter((row) => OPEN_CONFIRMATION_STATUSES.includes(row.status));
    const openPayables = (payablesResult.data ?? []).filter((row) => OPEN_PAYABLE_STATUSES.includes(row.status));

    setSummary({
      openChargesCount: openCharges.length,
      openChargesAmountCents: openCharges.reduce((sum, row) => sum + (row.open_amount_cents ?? 0), 0),
      openConfirmationsCount: openConfirmations.length,
      waitingSignatureCount: (confirmationsResult.data ?? []).filter((row) => row.status === "SENT_FOR_SIGNATURE").length,
      openPayablesCount: openPayables.length,
      openPayablesAmountCents: openPayables.reduce((sum, row) => sum + (row.open_amount_cents ?? 0), 0),
      recentInvoicesCount: invoicesResult.count ?? 0
    });
  }

  return (
    <>
      <PageHeader eyebrow="Visão geral" title="Dashboard" description="Resumo do que está em aberto agora, com base nos dados sincronizados do PC principal." />
      {error ? <Alert tone="danger" title="Falha ao carregar o dashboard">{error}</Alert> : null}
      {!error && !summary ? <LoadingState label="Carregando indicadores..." /> : null}
      {summary ? (
        <div className="dashboard-grid dashboard-grid--hero">
          <Card>
            <span className="kpi-icon">
              <WalletIcon />
            </span>
            <span>Cobranças em aberto</span>
            <strong>{formatCurrencyBr(summary.openChargesAmountCents)}</strong>
            <small>{summary.openChargesCount} cobrança(s) ainda não pagas</small>
          </Card>
          <Card>
            <span className="kpi-icon">
              <CheckCircleIcon />
            </span>
            <span>Confirmações em aberto</span>
            <strong>{summary.openConfirmationsCount}</strong>
            <small>{summary.waitingSignatureCount} aguardando assinatura</small>
          </Card>
          <Card>
            <span className="kpi-icon">
              <CoinsIcon />
            </span>
            <span>Contas a pagar em aberto</span>
            <strong>{formatCurrencyBr(summary.openPayablesAmountCents)}</strong>
            <small>{summary.openPayablesCount} conta(s) a pagar</small>
          </Card>
          <Card>
            <span className="kpi-icon">
              <InvoiceIcon />
            </span>
            <span>Notas lançadas</span>
            <strong>{summary.recentInvoicesCount}</strong>
            <small>Últimos {RECENT_DAYS} dias</small>
          </Card>
        </div>
      ) : null}
    </>
  );
}
