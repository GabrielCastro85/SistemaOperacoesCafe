import { useState } from "react";
import { Button, PageHeader } from "../../design-system";
import { ExpenseCategoriesTree } from "./components/ExpenseCategoriesTree";
import { ExpenseCategoryForm } from "./forms/ExpenseCategoryForm";
import { useFinanceData } from "./hooks/useFinanceData";
import type { FinancePageProps } from "./types";

export function ExpenseCategoriesPage({ data }: FinancePageProps): JSX.Element {
  const { finance, organizationId, reload } = useFinanceData(data);
  const [name, setName] = useState("");
  async function create(): Promise<void> {
    await window.operationsCafe.createExpenseCategory({ organizationId, parentCategoryId: null, name: name || "Nova categoria", code: null, expenseNature: "OTHER", description: null, isActive: true });
    setName("");
    await reload();
  }
  return <section className="content-section"><PageHeader eyebrow="Categorias" title="Categorias de despesas" description="Hierarquia gerencial sem ciclos; validacao definitiva no backend." actions={<Button onClick={() => void create()}>Criar categoria</Button>} /><ExpenseCategoryForm name={name} onName={setName} /><ExpenseCategoriesTree categories={finance.categories} /></section>;
}
