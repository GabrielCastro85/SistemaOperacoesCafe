import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, Product } from "../../../shared/types/domain";
import { DataTable, DecimalInput, PageHeader, StatusBadge } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";

const productLabels: Record<Product["category"], string> = {
  COFFEE_ARABICA: "Cafe Arabica",
  COFFEE_CONILON: "Cafe Conilon",
  COFFEE_OTHER: "Outro cafe",
  OTHER: "Outro produto"
};

export function ProductsPage({ data, refresh }: { data: BootstrapData; refresh: () => Promise<BootstrapData> }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("60");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setProducts(await window.operationsCafe.listProducts({ organizationId, status: "all" }));
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProduct(): Promise<void> {
    try {
      await window.operationsCafe.createProduct({
        organizationId,
        name,
        code: name.toUpperCase().replace(/\s+/g, "-"),
        category: "COFFEE_OTHER",
        defaultUnit: "SACK",
        defaultSackWeightKg: Number(weight.replace(",", ".")),
        description: null,
        isActive: true
      });
      setName("");
      setWeight("60");
      setMessage("Produto salvo.");
      await load();
      await refresh();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar produto."}`);
    }
  }

  return (
    <section className="content-section settings">
      <PageHeader title="Produtos" eyebrow="Comercial" description="Cadastre produtos usados em notas, operacoes, regras por saca e confirmacoes." />
      <AdminBlock title="Novo produto">
        <FormGrid>
          <TextField label="Nome" value={name} onChange={setName} required />
          <DecimalInput label="Peso padrao da saca" value={weight} onChange={(event) => setWeight(event.target.value)} />
          <button className="primary" onClick={() => void saveProduct()} disabled={!name.trim()}>Cadastrar produto</button>
        </FormGrid>
      </AdminBlock>
      <AdminBlock title="Produtos cadastrados">
        <DataTable
          rows={products}
          getRowKey={(row) => row.id}
          columns={[
            { key: "name", header: "Nome", render: (row) => row.name },
            { key: "code", header: "Codigo", render: (row) => row.code ?? "-" },
            { key: "category", header: "Categoria", render: (row) => productLabels[row.category] },
            { key: "unit", header: "Unidade", render: (row) => row.defaultUnit },
            { key: "weight", header: "Peso saca", align: "right", render: (row) => (row.defaultSackWeightKg ? `${row.defaultSackWeightKg} kg` : "-") },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} label={row.isActive ? "Ativo" : "Inativo"} /> }
          ]}
        />
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}
