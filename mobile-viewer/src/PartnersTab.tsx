import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { Badge } from "./renderer/design-system/components/Badge";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { Alert } from "./renderer/design-system/components/Alert";
import type { BusinessPartnerRole, BusinessPartnerRow } from "./types";

const PAGE_SIZE = 300;

const ROLE_LABELS: Record<BusinessPartnerRole, string> = {
  CLIENT: "Cliente",
  SUPPLIER: "Fornecedor",
  SELLER: "Vendedor",
  BUYER: "Comprador",
  DESTINATION: "Destino",
  CARRIER: "Transportadora",
  SERVICE_PROVIDER: "Prestador de serviço",
  OTHER: "Outro"
};

type FilterMode = "ALL" | "CLIENT" | "SUPPLIER";

const FILTER_LABELS: Record<FilterMode, string> = { ALL: "Todos", CLIENT: "Clientes", SUPPLIER: "Fornecedores" };

export function PartnersTab(): JSX.Element {
  const [partners, setPartners] = useState<BusinessPartnerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("ALL");

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setError(null);
    const { data, error: loadError } = await supabase
      .from("business_partners")
      .select("id, display_name, document_number, email, phone, city, state, is_active, roles:business_partner_roles(role)")
      .eq("is_active", true)
      .order("display_name")
      .limit(PAGE_SIZE);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setPartners((data ?? []) as unknown as BusinessPartnerRow[]);
  }

  const filtered = useMemo(() => {
    if (!partners) return [];
    const term = search.trim().toLowerCase();
    return partners.filter((partner) => {
      const roles = partner.roles.map((entry) => entry.role);
      if (filter !== "ALL" && !roles.includes(filter)) return false;
      if (term) {
        const haystack = `${partner.display_name} ${partner.document_number ?? ""} ${partner.city ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [partners, search, filter]);

  return (
    <>
      <PageHeader eyebrow="Comercial" title="Cadastros comerciais" description="Clientes, fornecedores e demais parceiros cadastrados no PC principal." />
      {error ? <Alert tone="danger" title="Falha ao carregar cadastros">{error}</Alert> : null}
      {!error && !partners ? <LoadingState label="Carregando cadastros..." /> : null}
      {partners ? (
        <>
          <FilterBar
            activeCount={(filter !== "ALL" ? 1 : 0) + (search.trim() ? 1 : 0)}
            onClear={() => {
              setSearch("");
              setFilter("ALL");
            }}
          >
            <input type="search" className="ui-input" placeholder="Buscar nome, documento ou cidade..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="viewer-chip-row">
              {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
                <Button key={mode} variant={filter === mode ? "primary" : "secondary"} onClick={() => setFilter(mode)}>
                  {FILTER_LABELS[mode]}
                </Button>
              ))}
            </div>
          </FilterBar>
          {filtered.length === 0 ? (
            <EmptyState title="Nenhum cadastro encontrado" description="Ajuste a busca ou o filtro para ver outros resultados." />
          ) : (
            <div className="viewer-card-grid">
              {filtered.map((partner) => (
                <Card
                  key={partner.id}
                  title={partner.display_name}
                  actions={
                    <div className="viewer-chip-row">
                      {partner.roles.map((entry) => (
                        <Badge key={entry.role} tone="info">
                          {ROLE_LABELS[entry.role] ?? entry.role}
                        </Badge>
                      ))}
                    </div>
                  }
                >
                  <p className="viewer-card-line">{partner.document_number ?? "Sem documento"}</p>
                  {partner.city ? (
                    <p className="viewer-card-line">
                      {partner.city}
                      {partner.state ? `/${partner.state}` : ""}
                    </p>
                  ) : null}
                  {partner.email || partner.phone ? (
                    <p className="viewer-card-line">{[partner.email, partner.phone].filter(Boolean).join(" · ")}</p>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
