import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Badge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import type { ProductCategory, ProductRow, ProductUnit } from "./types";

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  COFFEE_ARABICA: "Café Arábica",
  COFFEE_CONILON: "Café Conilon",
  COFFEE_OTHER: "Outro café",
  OTHER: "Outro"
};

const UNIT_LABELS: Record<ProductUnit, string> = {
  SACK: "Saca",
  KG: "Kg",
  TON: "Ton",
  UNIT: "Unidade"
};

type ProductWithAliases = ProductRow & { aliases: string[] };

export function ProductsTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const [products, setProducts] = useState<ProductWithAliases[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    setProducts(null);
    try {
      setProducts(await apiJson<ProductWithAliases[]>(`/v1/viewer/products?${queryString({ organizationId, legalEntityId })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar produtos.");
    }
  }, [organizationId, legalEntityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!products) return [];
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => `${product.name} ${product.code ?? ""} ${product.aliases.join(" ")}`.toLowerCase().includes(term));
  }, [products, search]);

  return (
    <>
      <PageHeader eyebrow="Comercial" title="Produtos" description="Produtos cadastrados no PC principal." />
      {error ? <Alert tone="danger" title="Falha ao carregar produtos">{error}</Alert> : null}
      {!error && !products ? <LoadingState label="Carregando produtos..." /> : null}
      {products ? (
        <>
          <FilterBar activeCount={search.trim() ? 1 : 0} onClear={() => setSearch("")}>
            <input type="search" className="ui-input" placeholder="Buscar produto ou código..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </FilterBar>
          {filtered.length === 0 ? (
            <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca para ver outros resultados." />
          ) : (
            <div className="viewer-card-grid">
              {filtered.map((product) => (
                <Card key={product.id} title={product.name} actions={<Badge tone="neutral">{UNIT_LABELS[product.default_unit] ?? product.default_unit}</Badge>}>
                  <p className="viewer-card-line">{CATEGORY_LABELS[product.category] ?? product.category}</p>
                  {product.code ? <p className="viewer-card-line">Código: {product.code}</p> : null}
                  {product.default_sack_weight_kg ? <p className="viewer-card-line">Peso padrão da saca: {product.default_sack_weight_kg} kg</p> : null}
                  {product.aliases.length ? <p className="viewer-card-line viewer-card-line--muted">Reconhecido também como: {product.aliases.join(", ")}</p> : null}
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
