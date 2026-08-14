import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { formatCurrencyBr } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];
const AGGREGATE_LIMIT = 5000;

interface MonthRow {
  month: number;
  operationCount: number;
  sacks: number;
  amountCents: number;
  confirmationCount: number;
}

function currentYear(): number {
  return new Date().getFullYear();
}

export function ReportsTab(): JSX.Element {
  const [year, setYear] = useState(currentYear());
  const [rows, setRows] = useState<MonthRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load(year);
  }, [year]);

  async function load(targetYear: number): Promise<void> {
    setError(null);
    setRows(null);
    const yearStart = `${targetYear}-01-01`;
    const yearEnd = `${targetYear + 1}-01-01`;
    const [operationsResult, confirmationsResult] = await Promise.all([
      supabase
        .from("operations")
        .select("operation_date, quantity_sacks_decimal, service_amount_cents")
        .neq("status", "CANCELED")
        .gte("operation_date", yearStart)
        .lt("operation_date", yearEnd)
        .limit(AGGREGATE_LIMIT),
      supabase
        .from("deal_confirmations")
        .select("confirmation_date")
        .not("status", "in", "(CANCELLED,REPLACED)")
        .gte("confirmation_date", yearStart)
        .lt("confirmation_date", yearEnd)
        .limit(AGGREGATE_LIMIT)
    ]);
    const firstError = operationsResult.error?.message ?? confirmationsResult.error?.message;
    if (firstError) {
      setError(firstError);
      return;
    }

    const months: MonthRow[] = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      operationCount: 0,
      sacks: 0,
      amountCents: 0,
      confirmationCount: 0
    }));

    for (const row of operationsResult.data ?? []) {
      const monthIndex = Number(row.operation_date.slice(5, 7)) - 1;
      if (monthIndex < 0 || monthIndex > 11) continue;
      months[monthIndex].operationCount += 1;
      months[monthIndex].sacks += Number(row.quantity_sacks_decimal) || 0;
      months[monthIndex].amountCents += row.service_amount_cents ?? 0;
    }
    for (const row of confirmationsResult.data ?? []) {
      const monthIndex = Number(row.confirmation_date.slice(5, 7)) - 1;
      if (monthIndex < 0 || monthIndex > 11) continue;
      months[monthIndex].confirmationCount += 1;
    }

    setRows(months);
  }

  const yearTotals = useMemo(() => {
    if (!rows) return null;
    return rows.reduce(
      (acc, row) => ({
        operationCount: acc.operationCount + row.operationCount,
        sacks: acc.sacks + row.sacks,
        amountCents: acc.amountCents + row.amountCents,
        confirmationCount: acc.confirmationCount + row.confirmationCount
      }),
      { operationCount: 0, sacks: 0, amountCents: 0, confirmationCount: 0 }
    );
  }, [rows]);

  const yearOptions = [currentYear(), currentYear() - 1, currentYear() - 2];

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Relatórios" description="Resumo mensal de notas lançadas e confirmações emitidas." />
      <div className="viewer-chip-row viewer-year-row">
        {yearOptions.map((option) => (
          <Button key={option} variant={option === year ? "primary" : "secondary"} onClick={() => setYear(option)}>
            {option}
          </Button>
        ))}
      </div>
      {error ? <Alert tone="danger" title="Falha ao carregar o relatório">{error}</Alert> : null}
      {!error && !rows ? <LoadingState label="Carregando relatório..." /> : null}
      {rows && yearTotals ? (
        <>
          <Card eyebrow={`Total em ${year}`} title="Resumo do ano">
            <p className="viewer-card-line">{yearTotals.operationCount} nota(s) lançada(s) · {yearTotals.sacks.toLocaleString("pt-BR")} sacas</p>
            <p className="viewer-card-line">Valor total: {formatCurrencyBr(yearTotals.amountCents)}</p>
            <p className="viewer-card-line">{yearTotals.confirmationCount} confirmação(ões) emitida(s)</p>
          </Card>

          <div className="viewer-card-grid">
            {rows.map((row) => (
              <Card key={row.month} title={MONTH_LABELS[row.month - 1]}>
                <p className="viewer-card-line">{row.operationCount} nota(s) · {row.sacks.toLocaleString("pt-BR")} sacas</p>
                <p className="viewer-card-line">
                  <strong>{formatCurrencyBr(row.amountCents)}</strong>
                </p>
                <p className="viewer-card-line viewer-card-line--muted">{row.confirmationCount} confirmação(ões)</p>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
