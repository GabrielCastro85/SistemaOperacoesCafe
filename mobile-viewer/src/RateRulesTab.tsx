import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { Badge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import type { BusinessPartnerRow, ProductRow, RateRuleRow } from "./types";

export interface RateRulesTabProps { table: "service_rate_rules" | "purchase_rate_rules"; eyebrow: string; title: string; description: string; organizationId: string; legalEntityId?: string; }
type RuleForm = { id?: string; partnerId: string; productId: string; scope: "INTERNAL" | "EXTERNAL" | "ALL"; rate: string; financialRate: string; start: string; end: string; priority: string; notes: string; };
const today = () => new Date().toISOString().slice(0, 10);

export function RateRulesTab({ table, eyebrow, title, description, organizationId, legalEntityId }: RateRulesTabProps): JSX.Element {
  const [rules, setRules] = useState<RateRuleRow[] | null>(null); const [partners, setPartners] = useState<BusinessPartnerRow[]>([]); const [products, setProducts] = useState<ProductRow[]>([]);
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null); const [search, setSearch] = useState(""); const [form, setForm] = useState<RuleForm | null>(null); const [saving, setSaving] = useState(false);
  const kind = table === "service_rate_rules" ? "SERVICE" : "PURCHASE";
  const load = useCallback(async () => {
    setError(null);
    try {
      const scope = queryString({ organizationId, legalEntityId });
      const [loadedRules, loadedPartners, loadedProducts] = await Promise.all([
        apiJson<RateRuleRow[]>(`/v1/viewer/rate-rules?${scope}&kind=${kind}`), apiJson<BusinessPartnerRow[]>(`/v1/viewer/partners?${scope}`), apiJson<ProductRow[]>(`/v1/viewer/products?${scope}`)
      ]);
      setRules(loadedRules); setPartners(loadedPartners); setProducts(loadedProducts);
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar regras."); }
  }, [organizationId, legalEntityId, kind]);
  useEffect(() => { setRules(null); setForm(null); void load(); }, [load]);
  const filtered = useMemo(() => { if (!rules) return []; const term = search.trim().toLowerCase(); return !term ? rules : rules.filter((rule) => `${rule.business_partner?.display_name ?? ""} ${rule.product?.name ?? ""}`.toLowerCase().includes(term)); }, [rules, search]);
  const newRule = (): RuleForm => ({ partnerId: partners[0]?.id ?? "", productId: "", scope: "ALL", rate: "", financialRate: "", start: today(), end: "", priority: "0", notes: "" });
  function edit(rule: RateRuleRow): void { setForm({ id: rule.id, partnerId: rule.business_partner_id, productId: rule.product_id ?? "", scope: rule.operation_scope ?? "ALL", rate: (rule.rate_value_cents / 100).toFixed(2).replace(".", ","), financialRate: rule.financial_rate_value_cents == null ? "" : (rule.financial_rate_value_cents / 100).toFixed(2).replace(".", ","), start: rule.effective_from, end: rule.effective_to ?? "", priority: String(rule.priority), notes: "" }); }
  const money = (value: string): number => Math.round(Number(value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value) * 100);
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault(); if (!form) return; setSaving(true); setError(null); setNotice(null);
    try {
      const body = { organizationId, legalEntityId, kind, businessPartnerId: form.partnerId, productId: form.productId || null, operationScope: form.scope,
        rateValueCents: money(form.rate), financialRateValueCents: form.financialRate ? money(form.financialRate) : null,
        effectiveFrom: form.start, effectiveTo: form.end || null, priority: Number(form.priority || 0), notes: form.notes, isActive: true };
      await apiJson(form.id ? `/v1/manage/rate-rules/${encodeURIComponent(form.id)}` : "/v1/manage/rate-rules", { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setNotice(form.id ? "Regra atualizada e sincronizada." : "Regra criada e sincronizada."); setForm(null); await load();
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível salvar a regra."); }
    finally { setSaving(false); }
  }
  return <>
    <PageHeader eyebrow={eyebrow} title={title} description={description} actions={<Button variant="primary" onClick={() => setForm(newRule())} disabled={!partners.length}>Nova regra</Button>} />
    {error ? <Alert tone="danger" title="Falha na regra">{error}</Alert> : null}{notice ? <Alert tone="success" title="Alteração concluída">{notice}</Alert> : null}
    {form ? <Card title={form.id ? "Editar regra" : "Nova regra"} className="viewer-editor-card"><form onSubmit={(event) => void save(event)}><div className="viewer-form-grid">
      <label>{kind === "SERVICE" ? "Cliente" : "Fornecedor"}<select className="ui-input" required value={form.partnerId} onChange={(event) => setForm({ ...form, partnerId: event.target.value })}>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name}</option>)}</select></label>
      <label>Produto<select className="ui-input" value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}><option value="">Todos os produtos</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      <label>Escopo<select className="ui-input" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as RuleForm["scope"] })}><option value="ALL">Todos</option><option value="INTERNAL">Mesma UF</option><option value="EXTERNAL">Outra UF</option></select></label>
      <label>Valor por saca (R$)<input className="ui-input" required inputMode="decimal" value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} /></label>
      {kind === "SERVICE" ? <label>Valor com financeiro (R$)<input className="ui-input" inputMode="decimal" value={form.financialRate} onChange={(event) => setForm({ ...form, financialRate: event.target.value })} /></label> : null}
      <label>Início<input className="ui-input" type="date" required value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label><label>Fim<input className="ui-input" type="date" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></label><label>Prioridade<input className="ui-input" type="number" min="0" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /></label>
    </div><label>Observações<textarea className="ui-input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="viewer-form-actions"><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit" variant="primary" loading={saving}>Salvar regra</Button></div></form></Card> : null}
    {!error && !rules ? <LoadingState label="Carregando regras..." /> : null}
    {rules ? <><FilterBar activeCount={search.trim() ? 1 : 0} onClear={() => setSearch("")}><input type="search" className="ui-input" placeholder="Buscar cliente/fornecedor ou produto..." value={search} onChange={(event) => setSearch(event.target.value)} /></FilterBar>{filtered.length === 0 ? <EmptyState title="Nenhuma regra encontrada" description="Crie a primeira regra para este contexto." /> : <div className="viewer-card-grid">{filtered.map((rule) => <Card key={rule.id} title={rule.business_partner?.display_name ?? "Parceiro"} actions={<Button onClick={() => edit(rule)}>Editar</Button>}><Badge tone="success">{formatCurrencyBr(rule.rate_value_cents)}/saca</Badge>{rule.financial_rate_value_cents != null ? <p className="viewer-card-line">Com financeiro: {formatCurrencyBr(rule.financial_rate_value_cents)}/saca</p> : null}<p className="viewer-card-line">{rule.product?.name ?? "Todos os produtos"}</p><p className="viewer-card-line">Vigência: {formatDateBr(rule.effective_from)} {rule.effective_to ? `a ${formatDateBr(rule.effective_to)}` : "— sem data final"}</p><p className="viewer-card-line">Prioridade: {rule.priority}</p></Card>)}</div>}</> : null}
  </>;
}
