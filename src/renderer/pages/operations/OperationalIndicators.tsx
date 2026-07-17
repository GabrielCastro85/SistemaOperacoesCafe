import { formatCurrencyFromCents } from "../../../shared/utils/format";

export function OperationalIndicators({ documents, pending, serviceAmountCents }: { documents: number; pending: number; serviceAmountCents: number }): JSX.Element {
  return (
    <div className="cards">
      <article><span>Notas</span><strong>{documents}</strong></article>
      <article><span>Pendências</span><strong>{pending}</strong></article>
      <article><span>Valor do serviço</span><strong>{formatCurrencyFromCents(serviceAmountCents)}</strong></article>
    </div>
  );
}
