import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
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

export function ReportsTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const [year, setYear] = useState(currentYear());
  const [rows, setRows] = useState<MonthRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetYear: number): Promise<void> => {
    setError(null);
    setRows(null);
    try {
      setRows(await apiJson<MonthRow[]>(`/v1/viewer/reports?${queryString({ organizationId, legalEntityId, year: String(targetYear) })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar o relatório.");
    }
  }, [organizationId, legalEntityId]);

  useEffect(() => {
    void load(year);
  }, [load, year]);

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
