import type { BootstrapData } from "../../../shared/types/domain";
import { parseCurrencyToCents } from "../../../shared/utils/format";
import type { PayableDraftFormState } from "./hooks/usePayableDraftForm";
import { getFinanceContext } from "./hooks/useFinanceData";

export async function createPayableFromForm(data: BootstrapData, form: PayableDraftFormState, confirm: boolean): Promise<void> {
  const { organizationId, ownLegalEntityId } = getFinanceContext(data);
  const detail = await window.operationsCafe.createAccountPayableDraft({
    organizationId,
    ownLegalEntityId,
    supplierPartnerId: null,
    supplierLegalEntityId: null,
    payeeNameSnapshot: form.payee,
    payeeTaxIdSnapshot: null,
    categoryId: form.categoryId,
    defaultCostCenterId: form.costCenterId || null,
    defaultLocationId: null,
    source: "MANUAL",
    description: form.description,
    documentType: null,
    documentNumber: null,
    competenceDate: `${form.dueDate.slice(0, 8)}01`,
    issueDate: null,
    dueDate: form.dueDate,
    originalAmountCents: parseCurrencyToCents(form.amount),
    discountCents: 0,
    interestCents: 0,
    penaltyCents: 0,
    otherAdditionsCents: 0,
    amountStatus: "CONFIRMED",
    notes: null,
    internalNotes: null
  });
  if (confirm) await window.operationsCafe.confirmAccountPayable(detail.payable.id);
}

export async function createRecurringFromForm(data: BootstrapData, form: PayableDraftFormState): Promise<void> {
  const { organizationId, ownLegalEntityId } = getFinanceContext(data);
  const template = await window.operationsCafe.createPayableRecurringTemplate({
    organizationId,
    ownLegalEntityId,
    supplierPartnerId: null,
    supplierLegalEntityId: null,
    payeeNameSnapshot: form.payee,
    categoryId: form.categoryId,
    defaultCostCenterId: form.costCenterId || null,
    defaultLocationId: null,
    description: form.description,
    amountMode: "FIXED",
    fixedAmountCents: parseCurrencyToCents(form.amount),
    estimatedAmountCents: null,
    frequency: "MONTHLY",
    dueDay: Number(form.dueDate.slice(-2)),
    generationLeadDays: 7,
    startDate: `${form.dueDate.slice(0, 8)}01`,
    endDate: null,
    autoGenerateOnOpen: false,
    isActive: true
  });
  await window.operationsCafe.generatePayableRecurringPeriod(template.id, 3);
}

export async function createInstallmentsFromForm(data: BootstrapData, form: PayableDraftFormState, count = 3): Promise<void> {
  const { organizationId, ownLegalEntityId } = getFinanceContext(data);
  await window.operationsCafe.createPayableInstallmentGroup({
    organizationId,
    ownLegalEntityId,
    supplierPartnerId: null,
    supplierLegalEntityId: null,
    payeeNameSnapshot: form.payee,
    categoryId: form.categoryId,
    defaultCostCenterId: form.costCenterId || null,
    defaultLocationId: null,
    description: form.description,
    totalAmountCents: parseCurrencyToCents(form.amount),
    installmentCount: count,
    firstDueDate: form.dueDate,
    intervalType: "MONTHLY"
  });
}
