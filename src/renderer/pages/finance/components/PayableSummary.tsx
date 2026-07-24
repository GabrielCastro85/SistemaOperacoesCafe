import type { AccountPayable } from "../../../../shared/types/domain";
import { DefinitionList, PageSection } from "../../../design-system";
import { formatCurrencyFromCents, formatDateOnlyBr } from "../../../../shared/utils/format";

export function PayableSummary({ payable }: { payable: AccountPayable | null }): JSX.Element {
  return (
    <PageSection title="Resumo" description="Dados principais da conta.">
      <DefinitionList items={[
        { label: "Descricao", value: payable?.description ?? "-" },
        { label: "Fornecedor", value: payable?.payeeNameSnapshot ?? "-" },
        { label: "Vencimento", value: formatDateOnlyBr(payable?.dueDate) },
        { label: "Status", value: payable?.status ?? "-" },
        { label: "Saldo", value: formatCurrencyFromCents(payable?.openAmountCents ?? 0) }
      ]} />
    </PageSection>
  );
}
