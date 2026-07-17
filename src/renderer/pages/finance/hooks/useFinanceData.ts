import { useCallback, useEffect, useState } from "react";
import type { AccountPayable, BootstrapData, BusinessPartner, CostCenter, ExpenseCategory, FinancialAccount, FinancialReportGeneration, FinancialSummary, PayablePayment, PayableRecurringTemplate } from "../../../../shared/types/domain";

export function getFinanceContext(data: BootstrapData): { organizationId: string; ownLegalEntityId: string } {
  return {
    organizationId: data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "",
    ownLegalEntityId: data.profile?.defaultLegalEntityId ?? data.legalEntities[0]?.id ?? ""
  };
}

export interface FinanceData {
  categories: ExpenseCategory[];
  costCenters: CostCenter[];
  accounts: FinancialAccount[];
  payables: AccountPayable[];
  payments: PayablePayment[];
  recurring: PayableRecurringTemplate[];
  reports: FinancialReportGeneration[];
  partners: BusinessPartner[];
  summary: FinancialSummary | null;
}

const emptyFinanceData: FinanceData = { categories: [], costCenters: [], accounts: [], payables: [], payments: [], recurring: [], reports: [], partners: [], summary: null };

export function useFinanceData(data: BootstrapData): { finance: FinanceData; loading: boolean; error: string | null; reload: () => Promise<void>; organizationId: string; ownLegalEntityId: string } {
  const { organizationId, ownLegalEntityId } = getFinanceContext(data);
  const [finance, setFinance] = useState<FinanceData>(emptyFinanceData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [categories, costCenters, accounts, payables, partners, summary, reports, payments, recurring] = await Promise.all([
        window.operationsCafe.listExpenseCategories(organizationId),
        window.operationsCafe.listCostCenters({ organizationId, ownLegalEntityId, status: "all" }),
        window.operationsCafe.listFinancialAccounts({ organizationId, ownLegalEntityId, status: "all" }),
        window.operationsCafe.listAccountsPayable({ organizationId, ownLegalEntityId }),
        window.operationsCafe.listBusinessPartners({ organizationId, status: "active" }),
        window.operationsCafe.getFinancialSummary(organizationId),
        window.operationsCafe.listFinancialReports({ organizationId, ownLegalEntityId }),
        window.operationsCafe.listPayablePayments({ organizationId, ownLegalEntityId }),
        window.operationsCafe.listPayableRecurringTemplates(organizationId)
      ]);
      setFinance({ categories, costCenters, accounts, payables, partners, summary, reports, payments, recurring });
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Falha ao carregar financeiro.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, ownLegalEntityId]);

  useEffect(() => {
    let active = true;
    void reload().finally(() => {
      if (!active) setLoading(false);
    });
    return () => { active = false; };
  }, [reload]);

  return { finance, loading, error, reload, organizationId, ownLegalEntityId };
}
