import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiJson, queryString } from "./api";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { Badge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import type { ProductCategory, ProductRow, ProductUnit } from "./types";

const CATEGORY_LABELS: Record<ProductCategory, string> = { COFFEE_ARABICA: "Café Arábica", COFFEE_CONILON: "Café Conilon", COFFEE_OTHER: "Outro café", OTHER: "Outro" };
const UNIT_LABELS: Record<ProductUnit, string> = { SACK: "Saca", KG: "Kg", TON: "Ton", UNIT: "Unidade" };
type ProductWithAliases = ProductRow & { aliases: string[] };
type ProductForm = { id?: string; name: string; code: string; category: ProductCategory; defaultUnit: ProductUnit; weight: string; description: string; aliases: string };
const EMPTY: ProductForm = { name: "", code: "", category: "COFFEE_ARABICA", defaultUnit: "SACK", weight: "60", description: "", aliases: "" };

export function ProductsTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const [products, setProducts] = useState<ProductWithAliases[] | null>(null);
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState(""); const [form, setForm] = useState<ProductForm | null>(null); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setError(null);
    try { setProducts(await apiJson<ProductWithAliases[]>(`/v1/viewer/products?${queryString({ organizationId, legalEntityId })}`)); }
    catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar produtos."); }
  }, [organizationId, legalEntityId]);
  useEffect(() => { setProducts(null); setForm(null); void load(); }, [load]);
  const filtered = useMemo(() => {
    if (!products) return []; const term = search.trim().toLowerCase();
    return !term ? products : products.filter((product) => `${product.name} ${product.code ?? ""} ${product.aliases.join(" ")}`.toLowerCase().includes(term));
  }, [products, search]);
  function edit(product: ProductWithAliases): void { setForm({ id: product.id, name: product.name, code: product.code ?? "", category: product.category, defaultUnit: product.default_unit, weight: product.default_sack_weight_kg?.toString() ?? "", description: product.description ?? "", aliases: product.aliases.join("\n") }); }
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault(); if (!form) return; setSaving(true); setError(null); setNotice(null);
    try {
      const body = { organizationId, legalEntityId, name: form.name, code: form.code, category: form.category, defaultUnit: form.defaultUnit,
        defaultSackWeightKg: form.weight ? Number(form.weight.replace(",", ".")) : null, description: form.description, isActive: true,
        aliases: form.aliases.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) };
      await apiJson(form.id ? `/v1/manage/products/${encodeURIComponent(form.id)}` : "/v1/manage/products", { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setNotice(form.id ? "Produto atualizado e sincronizado." : "Produto criado e sincronizado."); setForm(null); await load();
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível salvar o produto."); }
    finally { setSaving(false); }
  }
  return <>
    <PageHeader eyebrow="Comercial" title="Produtos" description="Crie produtos e nomes alternativos usados no reconhecimento das notas." actions={<Button variant="primary" onClick={() => setForm({ ...EMPTY })}>Novo produto</Button>} />
    {error ? <Alert tone="danger" title="Falha no produto">{error}</Alert> : null}{notice ? <Alert tone="success" title="Alteração concluída">{notice}</Alert> : null}
    {form ? <Card title={form.id ? "Editar produto" : "Novo produto"} className="viewer-editor-card"><form onSubmit={(event) => void save(event)}>
      <div className="viewer-form-grid"><label>Nome<input className="ui-input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Código<input className="ui-input" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label><label>Categoria<select className="ui-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ProductCategory })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Unidade<select className="ui-input" value={form.defaultUnit} onChange={(event) => setForm({ ...form, defaultUnit: event.target.value as ProductUnit })}>{Object.entries(UNIT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Peso da saca (kg)<input className="ui-input" inputMode="decimal" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} /></label></div>
      <label>Nomes alternativos, um por linha<textarea className="ui-input" value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} /></label><label>Descrição<textarea className="ui-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <div className="viewer-form-actions"><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit" variant="primary" loading={saving}>Salvar produto</Button></div>
    </form></Card> : null}
    {!error && !products ? <LoadingState label="Carregando produtos..." /> : null}
    {products ? <><FilterBar activeCount={search.trim() ? 1 : 0} onClear={() => setSearch("")}><input type="search" className="ui-input" placeholder="Buscar produto ou código..." value={search} onChange={(event) => setSearch(event.target.value)} /></FilterBar>{filtered.length === 0 ? <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca ou crie um produto." /> : <div className="viewer-card-grid">{filtered.map((product) => <Card key={product.id} title={product.name} actions={<Button onClick={() => edit(product)}>Editar</Button>}><Badge tone="neutral">{UNIT_LABELS[product.default_unit]}</Badge><p className="viewer-card-line">{CATEGORY_LABELS[product.category]}</p>{product.code ? <p className="viewer-card-line">Código: {product.code}</p> : null}{product.default_sack_weight_kg ? <p className="viewer-card-line">Peso padrão: {product.default_sack_weight_kg} kg</p> : null}{product.aliases.length ? <p className="viewer-card-line viewer-card-line--muted">Também reconhecido como: {product.aliases.join(", ")}</p> : null}</Card>)}</div>}</> : null}
  </>;
}
