import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { companyColorClass } from "./companyColor";
import { ConfirmationDrawer, NewConfirmationDrawer } from "./ConfirmationEditor";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { Alert } from "./renderer/design-system/components/Alert";
import { StatusBadge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { Card } from "./renderer/design-system/components/Card";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { PageHeader } from "./renderer/design-system/components/PageHeader";

type FilterMode = "OPEN" | "SIGNED" | "ALL";

interface ConfirmationRow {
  id: string;
  confirmationNumber: string | null;
  temporaryReference: string;
  confirmationDate: string;
  status: string;
  signatureStatus: string;
  ownLegalEntityName: string;
  counterpartyName: string;
  counterpartyRole: string | null;
  totalQuantitySacks: string;
  totalCommercialAmountCents: number;
}

const FILTER_LABELS: Record<FilterMode, string> = {
  OPEN: "Em aberto",
  SIGNED: "Assinadas",
  ALL: "Todas"
};

function currentYear(): { start: string; end: string } {
  const year = new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function ConfirmationsTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentYear();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [filter, setFilter] = useState<FilterMode>("OPEN");
  const [search, setSearch] = useState("");
  const [confirmations, setConfirmations] = useState<ConfirmationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!organizationId) return;
    setError(null);
    setConfirmations(null);
    try {
      setConfirmations(await apiJson(`/v1/viewer/confirmations?${queryString({
        organizationId,
        legalEntityId,
        periodStart,
        periodEnd,
        status: filter
      })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar as confirmações.");
    }
  }, [organizationId, legalEntityId, periodStart, periodEnd, filter]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return confirmations ?? [];
    return (confirmations ?? []).filter((confirmation) => `${confirmation.confirmationNumber ?? confirmation.temporaryReference} ${confirmation.counterpartyName} ${confirmation.ownLegalEntityName}`
      .toLocaleLowerCase("pt-BR").includes(term));
  }, [confirmations, search]);

  return (
    <>
      <PageHeader eyebrow="Comercial" title="Confirmações" description="Crie, edite, emita e acompanhe as confirmações de negócio. Clique numa confirmação para abrir." actions={
        <Button variant="primary" onClick={() => { setCreating(true); setSuccess(null); }}>Nova confirmação</Button>
      } />
      {success ? <Alert tone="success" title="Confirmação atualizada">{success}</Alert> : null}
      <NewConfirmationDrawer open={creating} organizationId={organizationId} legalEntityId={legalEntityId} onClose={() => setCreating(false)}
        onCreated={(id) => { setCreating(false); setSuccess("Rascunho criado. Inclua comprador e vendedor e revise antes de emitir."); setSelectedId(id); void load(); }} />
      <ConfirmationDrawer confirmationId={selectedId} organizationId={organizationId} legalEntityId={legalEntityId} onClose={() => setSelectedId(null)}
        onChanged={(message) => { setSuccess(message); void load(); }} onOpen={(id) => { setSelectedId(id); void load(); }} />
      <FilterBar activeCount={(filter !== "ALL" ? 1 : 0) + (search.trim() ? 1 : 0)} onClear={() => { setFilter("ALL"); setSearch(""); }}>
        <div className="viewer-period-filter viewer-period-filter--inline">
          <label>Início<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>Fim<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        </div>
        <input className="ui-input" type="search" placeholder="Buscar número, empresa ou contraparte..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="viewer-chip-row">
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
            <Button key={mode} variant={filter === mode ? "primary" : "secondary"} onClick={() => setFilter(mode)}>{FILTER_LABELS[mode]}</Button>
          ))}
        </div>
      </FilterBar>
      {error ? <Alert tone="danger" title="Falha ao carregar confirmações">{error}</Alert> : null}
      {!error && !confirmations ? <LoadingState label="Carregando confirmações..." /> : null}
      {confirmations && filtered.length === 0 ? <EmptyState title="Nenhuma confirmação encontrada" description="Ajuste o período, o status ou a busca." /> : null}
      {confirmations && filtered.length > 0 ? (
        <div className="viewer-card-grid">
          {filtered.map((confirmation) => (
            <Card
              key={confirmation.id}
              title={confirmation.confirmationNumber ?? confirmation.temporaryReference}
              actions={<StatusBadge status={confirmation.status} />}
              className={`viewer-confirmation-card ${companyColorClass(confirmation.ownLegalEntityName)}`}
            >
              <button type="button" className="viewer-confirmation-card__open" aria-label={`Abrir ${confirmation.confirmationNumber ?? confirmation.temporaryReference}`} onClick={() => { setSelectedId(confirmation.id); setSuccess(null); }} />
              <p className="viewer-card-line"><strong>{confirmation.counterpartyName}</strong></p>
              <p className="viewer-card-line viewer-card-line--muted">{confirmation.ownLegalEntityName} · {formatDateBr(confirmation.confirmationDate)}</p>
              <p className="viewer-card-line">{Number(confirmation.totalQuantitySacks).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} sacas</p>
              <p className="viewer-card-line"><strong>{formatCurrencyBr(confirmation.totalCommercialAmountCents)}</strong></p>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}
