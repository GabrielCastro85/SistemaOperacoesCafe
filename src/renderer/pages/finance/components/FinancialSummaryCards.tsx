import type { CSSProperties } from "react";
import type { FinancialSummary } from "../../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../../shared/utils/format";
import { Card } from "../../../design-system";

const gridStyle: CSSProperties = {
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  alignItems: "stretch"
};

const wrapperStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden"
};

const valueStyle: CSSProperties = {
  display: "block",
  minWidth: 0,
  maxWidth: "100%",
  fontSize: "clamp(1.05rem, 1.45vw, 1.55rem)",
  lineHeight: 1.08,
  letterSpacing: "-0.03em",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

function SummaryCard({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description?: string;
}): JSX.Element {
  return (
    <div style={wrapperStyle}>
      <Card>
        <span>{label}</span>
        <strong style={valueStyle} title={value}>
          {value}
        </strong>
        {description ? <small>{description}</small> : null}
      </Card>
    </div>
  );
}

export function FinancialSummaryCards({ summary }: { summary: FinancialSummary | null }): JSX.Element {
  return (
    <div className="cards" style={gridStyle}>
      <SummaryCard
        label="Total a pagar no mes"
        value={formatCurrencyFromCents(summary?.payableThisMonthCents ?? 0)}
      />
      <SummaryCard
        label="Pago no mes"
        value={formatCurrencyFromCents(summary?.paidThisMonthCents ?? 0)}
      />
      <SummaryCard
        label="Saldo aberto"
        value={formatCurrencyFromCents(summary?.openCents ?? 0)}
      />
      <SummaryCard
        label="Vencido"
        value={formatCurrencyFromCents(summary?.overdueCents ?? 0)}
      />
      <SummaryCard
        label="Proximos 7 dias"
        value={formatCurrencyFromCents(summary?.dueNext7DaysCents ?? 0)}
      />
      <SummaryCard
        label="Recebimentos previstos"
        value={formatCurrencyFromCents(summary?.receivableOpenCents ?? 0)}
      />
      <SummaryCard
        label="Pagamentos previstos"
        value={formatCurrencyFromCents(summary?.payableOpenCents ?? 0)}
      />
      <SummaryCard
        label="Resultado projetado"
        value={formatCurrencyFromCents(summary?.projectedResultCents ?? 0)}
        description="Fluxo gerencial projetado, nao saldo bancario real."
      />
    </div>
  );
}
