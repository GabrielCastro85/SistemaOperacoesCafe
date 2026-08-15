import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useActiveContext } from "./activeContext";
import { formatCurrencyBr, formatDateBr } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Badge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import type { RateRuleRow } from "./types";

const PAGE_SIZE = 300;

export interface RateRulesTabProps {
  table: "service_rate_rules" | "purchase_rate_rules";
  eyebrow: string;
  title: string;
  description: string;
}

export function RateRulesTab({ table, eyebrow, title, description }: RateRulesTabProps): JSX.Element {
  const { organizationId, legalEntityId } = useActiveContext();
  const [rules, setRules] = useState<RateRuleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!legalEntityId) return;
    setRules(null);
    void load();
  }, [table, organizationId, legalEntityId]);

  async function load(): Promise<void> {
    setError(null);
    // own_legal_entity_id e' opcional nessas tabelas: regra sem empresa
    // definida vale pra qualquer CNPJ da organizacao, entao entra tanto
    // quando bate com a empresa ativa quanto quando fica em branco.
    const { data, error: loadError } = await supabase
      .from(table)
      .select(
        `id, rate_value_cents, effective_from, effective_to, priority, is_active,
         business_partner:business_partners(display_name),
         product:products(name)`
      )
      .eq("organization_id", organizationId)
      .or(`own_legal_entity_id.eq.${legalEntityId},own_legal_entity_id.is.null`)
      .eq("is_active", true)
      .order("effective_from", { ascending: false })
      .limit(PAGE_SIZE);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setRules((data ?? []) as unknown as RateRuleRow[]);
  }

  const filtered = useMemo(() => {
    if (!rules) return [];
    const term = search.trim().toLowerCase();
    if (!term) return rules;
    return rules.filter((rule) => `${rule.business_partner?.display_name ?? ""} ${rule.product?.name ?? ""}`.toLowerCase().includes(term));
  }, [rules, search]);

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      {error ? <Alert tone="danger" title="Falha ao carregar regras">{error}</Alert> : null}
      {!error && !rules ? <LoadingState label="Carregando regras..." /> : null}
      {rules ? (
        <>
          <FilterBar activeCount={search.trim() ? 1 : 0} onClear={() => setSearch("")}>
            <input type="search" className="ui-input" placeholder="Buscar cliente/fornecedor ou produto..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </FilterBar>
          {filtered.length === 0 ? (
            <EmptyState title="Nenhuma regra encontrada" description="Ajuste a busca para ver outros resultados." />
          ) : (
            <div className="viewer-card-grid">
              {filtered.map((rule) => (
                <Card
                  key={rule.id}
                  title={rule.business_partner?.display_name ?? "Parceiro"}
                  actions={<Badge tone="success">{formatCurrencyBr(rule.rate_value_cents)}/saca</Badge>}
                >
                  <p className="viewer-card-line">{rule.product?.name ?? "Todos os produtos"}</p>
                  <p className="viewer-card-line">
                    Vigência: {formatDateBr(rule.effective_from)} {rule.effective_to ? `a ${formatDateBr(rule.effective_to)}` : "— sem data final"}
                  </p>
                  <p className="viewer-card-line">Prioridade: {rule.priority}</p>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
