import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BootstrapData, Product } from "../../../shared/types/domain";
import { DataTable, DecimalInput, PageHeader, StatusBadge } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
import { formatProductUnit } from "../../../shared/utils/productLabels";
import { useAutoScroll } from "../../hooks/useAutoScroll";

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
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const scrollTo = useAutoScroll();
  const productsListRef = useRef<HTMLDivElement | null>(null);

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
      scrollTo(productsListRef);
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar produto."}`);
    }
  }

  async function toggleProduct(product: Product): Promise<void> {
    try {
      setBusyProductId(product.id);
      if (product.isActive) await window.operationsCafe.deactivateProduct(product.id);
      else await window.operationsCafe.activateProduct(product.id);
      setMessage(product.isActive ? "Produto desativado." : "Produto reativado.");
      await load();
      await refresh();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao alterar o produto."}`);
    } finally {
      setBusyProductId(null);
    }
  }

  async function permanentlyDeleteProduct(product: Product): Promise<void> {
    const confirmed = window.confirm(
      `Excluir definitivamente o produto "${product.name}"?\n\nEssa opcao so funcionara se o produto nunca tiver sido usado. Produtos com historico devem ser desativados.`
    );
    if (!confirmed) return;

    try {
      setBusyProductId(product.id);
      await window.operationsCafe.permanentlyDeleteProduct(product.id);
      setMessage("Produto excluido definitivamente.");
      await load();
      await refresh();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao excluir o produto."}`);
    } finally {
      setBusyProductId(null);
    }
  }

  return (
    <section className="content-section settings compact-crud-page products-page">
      <PageHeader title="Produtos" eyebrow="Comercial" description="Cadastre produtos usados em notas, operacoes, regras por saca e confirmacoes." />
      <AdminBlock title="Novo produto">
        <FormGrid>
          <TextField label="Nome" value={name} onChange={setName} required />
          <DecimalInput label="Peso padrao da saca" value={weight} onChange={(event) => setWeight(event.target.value)} />
          <button className="primary" onClick={() => void saveProduct()} disabled={!name.trim()}>Cadastrar produto</button>
        </FormGrid>
      </AdminBlock>
      <div ref={productsListRef}>
        <AdminBlock title="Produtos cadastrados">
          <DataTable
            rows={products}
            getRowKey={(row) => row.id}
            columns={[
              { key: "name", header: "Nome", render: (row) => row.name },
              { key: "code", header: "Codigo", render: (row) => row.code ?? "-" },
              { key: "category", header: "Categoria", render: (row) => productLabels[row.category] },
              { key: "unit", header: "Unidade", render: (row) => formatProductUnit(row.defaultUnit) },
              { key: "weight", header: "Peso saca", align: "right", render: (row) => (row.defaultSackWeightKg ? `${row.defaultSackWeightKg} kg` : "-") },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} label={row.isActive ? "Ativo" : "Inativo"} /> },
              {
                key: "actions",
                header: "Acoes",
                render: (row) => (
                  <div className="table-actions">
                    <button
                      type="button"
                      onClick={() => void toggleProduct(row)}
                      disabled={busyProductId === row.id}
                    >
                      {row.isActive ? "Desativar" : "Reativar"}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void permanentlyDeleteProduct(row)}
                      disabled={busyProductId === row.id}
                    >
                      Excluir
                    </button>
                  </div>
                )
              }
            ]}
          />
        </AdminBlock>
      </div>
      <Feedback message={message} />
    </section>
  );
}
