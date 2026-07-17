import type { ExpenseCategory } from "../../../../shared/types/domain";
import { TreeView } from "../../../design-system";

export function ExpenseCategoriesTree({ categories }: { categories: ExpenseCategory[] }): JSX.Element {
  return <TreeView items={categories.map((item) => ({ id: item.id, label: `${item.code ? `${item.code} - ` : ""}${item.name}`, parentId: item.parentCategoryId, meta: `${item.expenseNature} · ${item.isActive ? "Ativa" : "Inativa"}` }))} />;
}
