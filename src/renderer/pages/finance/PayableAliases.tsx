import type { FinancePageProps } from "./types";
import { CostCentersPage } from "./CostCentersPage";
import { ExpenseCategoriesPage } from "./ExpenseCategoriesPage";
import { FinancialAccountsPage } from "./FinancialAccountsPage";
import { FinancialCalendarPage } from "./FinancialCalendarPage";
import { FinancialReportsPage } from "./FinancialReportsPage";
import { InstallmentGroupDetailsPage } from "./InstallmentGroupDetailsPage";
import { InstallmentGroupsPage } from "./InstallmentGroupsPage";
import { PayableCreatePage } from "./PayableCreatePage";
import { PayableDetailsPage } from "./PayableDetailsPage";
import { PayablePaymentDetailsPage } from "./PayablePaymentDetailsPage";
import { PayablePaymentsPage } from "./PayablePaymentsPage";
import { PayablesPage } from "./PayablesPage";
import { RecurringPayableDetailsPage } from "./RecurringPayableDetailsPage";
import { RecurringPayablesPage } from "./RecurringPayablesPage";

export const FinancialCalendar = FinancialCalendarPage;
export const ExpenseCategories = ExpenseCategoriesPage;
export const CostCenters = CostCentersPage;
export const FinancialAccounts = FinancialAccountsPage;
export const FinancialReports = FinancialReportsPage;
export const Installments = InstallmentGroupsPage;
export const Payables = PayablesPage;
export const Payments = PayablePaymentsPage;
export const Recurring = RecurringPayablesPage;

export function PayableNew({ data }: FinancePageProps): JSX.Element { return <PayableCreatePage data={data} />; }
export function PayableDetails({ data, id }: FinancePageProps & { id: string | null }): JSX.Element { return <PayableDetailsPage data={data} id={id} />; }
export function PaymentDetails({ data, id }: FinancePageProps & { id: string | null }): JSX.Element { return <PayablePaymentDetailsPage data={data} id={id} />; }
export function RecurringDetails({ data, id }: FinancePageProps & { id: string | null }): JSX.Element { return <RecurringPayableDetailsPage data={data} id={id} />; }
export function InstallmentDetails({ data, id }: FinancePageProps & { id: string | null }): JSX.Element { return <InstallmentGroupDetailsPage data={data} id={id} />; }
