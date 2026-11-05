import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./storage";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Badge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import type { RateRuleRow } from "./types";

export interface RateRulesTabProps {
  table: "service_rate_rules" | "purchase_rate_rules";
  eyebrow: string;
  title: string;
  description: string;
  organizationId: string;
  legalEntityId?: string;
}

export function RateRulesTab({ table, eyebrow, title, description, organizationId, legalEntityId }: RateRulesTabProps): JSX.Element {
  const [rules, setRules] = useState<RateRuleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    setRules(null);
    try {
      const kind = table === "service_rate_rules" ? "SERVICE" : "PURCHASE";
      setRules(await apiJson<RateRuleRow[]>(`/v1/viewer/rate-rules?${queryString({ organizationId, legalEntityId, kind })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar regras.");
    }
  }, [table, organizationId, legalEntityId]);

  useEffect(() => {
    setRules(null);
    void load();
  }, [load]);

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
