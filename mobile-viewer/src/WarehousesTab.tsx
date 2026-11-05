import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCnpj } from "./shared/utils/format";
import { formatDateBr } from "./viewerFormat";
import { Alert } from "./renderer/design-system/components/Alert";
import { Badge, StatusBadge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { Card } from "./renderer/design-system/components/Card";
import { EmptyState } from "./renderer/design-system/components/EmptyState";
import { FilterBar } from "./renderer/design-system/components/FilterBar";
import { LoadingState } from "./renderer/design-system/components/LoadingState";
import { PageHeader } from "./renderer/design-system/components/PageHeader";

type MovementStatus = "ALL" | "ACTIVE" | "PENDING_REVIEW" | "CANCELED";

interface WarehouseBalance {
  ownLegalEntityId: string;
  ownLegalEntityName: string;
  warehouseName: string;
  warehouseCnpj: string | null;
  productDescription: string;
  quantityKg: number;
  quantitySacks: number;
}

interface WarehouseMovement {
  id: string;
  ownLegalEntityName: string;
  documentNumber: string;
  series: string | null;
  issueDate: string;
  warehouseName: string;
  warehouseCnpj: string | null;
  productDescription: string;
  cfop: string;
  movementType: string;
  movementKind: string;
  quantityKg: number;
  referencedDocumentNumber: string | null;
  status: string;
  notes: string | null;
  origin: string;
}

interface WarehouseResponse {
  summary: {
    totalKg: number;
    totalSacks: number;
    warehouseCount: number;
    activeMovementCount: number;
    pendingReviewCount: number;
    balances: WarehouseBalance[];
  };
  warehouses: Array<{ cnpj: string; name: string }>;
  movements: WarehouseMovement[];
}

const STATUS_LABELS: Record<MovementStatus, string> = { ALL: "Todas", ACTIVE: "Ativas", PENDING_REVIEW: "Conferir", CANCELED: "Canceladas" };

function currentYear(): { start: string; end: string } {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  return { start: `${year}-01-01`, end: today };
}

function quantity(value: number, maximumFractionDigits = 3): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits });
}

function movementLabel(row: WarehouseMovement): string {
  if (row.origin === "MANUAL") return row.movementType === "DEPOSIT" ? "Ajuste manual (+)" : "Ajuste manual (−)";
  if (row.movementType === "DEPOSIT") return row.movementKind === "SYMBOLIC" ? "Remessa simbólica" : "Remessa para depósito";
  return row.movementKind === "SYMBOLIC" ? "Retorno simbólico / baixa" : "Retorno físico";
}

export function WarehousesTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const initial = currentYear();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [warehouseCnpj, setWarehouseCnpj] = useState("");
  const [status, setStatus] = useState<MovementStatus>("ALL");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<WarehouseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!organizationId) return;
    setError(null);
    setData(null);
    try {
      setData(await apiJson(`/v1/viewer/warehouses?${queryString({
        organizationId, legalEntityId, periodStart, periodEnd, warehouseCnpj: warehouseCnpj || undefined, status
      })}`));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Falha ao carregar os cafés armazenados.");
    }
  }, [organizationId, legalEntityId, periodStart, periodEnd, warehouseCnpj, status]);

  useEffect(() => { void load(); }, [load]);

  const movements = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return data?.movements ?? [];
    return (data?.movements ?? []).filter((row) => [row.documentNumber, row.warehouseName, row.warehouseCnpj,
      row.ownLegalEntityName, row.productDescription, row.cfop, row.referencedDocumentNumber, row.notes]
      .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(term));
  }, [data, search]);

  return (
    <>
      <PageHeader eyebrow="Estoque em terceiros" title="Cafés armazenados" description="Consulte saldos e movimentações reconhecidas pelas NF-e de remessa, retorno e baixa simbólica." />
      <Alert tone="info" title="Consulta segura">Ajustes de saldo e conferências continuam sendo feitos no aplicativo.</Alert>
      <FilterBar activeCount={(warehouseCnpj ? 1 : 0) + (status !== "ALL" ? 1 : 0) + (search.trim() ? 1 : 0)} onClear={() => { setWarehouseCnpj(""); setStatus("ALL"); setSearch(""); }}>
        <div className="viewer-period-filter viewer-period-filter--inline">
          <label>Movimentos de<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>Até<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        </div>
        <select className="ui-input" value={warehouseCnpj} onChange={(event) => setWarehouseCnpj(event.target.value)}>
          <option value="">Todos os armazéns</option>
          {(data?.warehouses ?? []).map((warehouse) => <option key={warehouse.cnpj} value={warehouse.cnpj}>{warehouse.name} · {formatCnpj(warehouse.cnpj)}</option>)}
        </select>
        <input className="ui-input" type="search" placeholder="Buscar NF, armazém, empresa ou produto..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="viewer-chip-row">
          {(Object.keys(STATUS_LABELS) as MovementStatus[]).map((mode) => (
            <Button key={mode} variant={status === mode ? "primary" : "secondary"} onClick={() => setStatus(mode)}>{STATUS_LABELS[mode]}</Button>
          ))}
        </div>
      </FilterBar>
      {error ? <Alert tone="danger" title="Falha ao carregar cafés armazenados">{error}</Alert> : null}
      {!error && !data ? <LoadingState label="Carregando saldos e movimentações..." /> : null}
      {data ? (
        <div className="viewer-warehouse-kpis">
          <Card eyebrow="Saldo armazenado"><strong>{quantity(data.summary.totalSacks)} sacas</strong><small>{quantity(data.summary.totalKg)} kg</small></Card>
          <Card eyebrow="Armazéns com saldo"><strong>{data.summary.warehouseCount.toLocaleString("pt-BR")}</strong><small>Locais identificados</small></Card>
          <Card eyebrow="Movimentos ativos"><strong>{data.summary.activeMovementCount.toLocaleString("pt-BR")}</strong><small>Remessas e retornos</small></Card>
          <Card eyebrow="Precisam de conferência"><strong>{data.summary.pendingReviewCount.toLocaleString("pt-BR")}</strong><small>Referência não identificada</small></Card>
        </div>
      ) : null}
      {data ? (
        <Card eyebrow="Posição atual" title="Saldo por armazém" actions={<span className="viewer-card-line--muted">1 saca = 60 kg</span>}>
          {data.summary.balances.length === 0 ? <EmptyState title="Nenhum saldo armazenado" description="Não há saldo ativo para a empresa selecionada." /> : (
            <div className="viewer-warehouse-balances">
              {data.summary.balances.map((row) => (
                <article key={`${row.ownLegalEntityId}:${row.warehouseCnpj}:${row.productDescription}`}>
                  <span><strong>{row.warehouseName}</strong><small>{row.warehouseCnpj ? formatCnpj(row.warehouseCnpj) : "CNPJ não informado"}</small></span>
                  <span><strong>{row.productDescription}</strong><small>{row.ownLegalEntityName}</small></span>
                  <span><strong>{quantity(row.quantitySacks)} sacas</strong><small>{quantity(row.quantityKg)} kg</small></span>
                </article>
              ))}
            </div>
          )}
        </Card>
      ) : null}
      {data && movements.length === 0 ? <EmptyState title="Nenhuma movimentação encontrada" description="Ajuste o período, o armazém, a situação ou a busca." /> : null}
      {data && movements.length > 0 ? (
        <Card eyebrow="Auditoria" title="Movimentações reconhecidas" actions={<span>{movements.length.toLocaleString("pt-BR")} item(ns)</span>}>
          <div className="viewer-warehouse-movements">
            {movements.map((row) => (
              <article key={row.id} className={row.status === "CANCELED" ? "is-canceled" : row.status === "PENDING_REVIEW" ? "needs-review" : ""}>
                <span><strong>{row.origin === "MANUAL" ? "Ajuste manual" : `NF ${row.documentNumber}${row.series ? `/${row.series}` : ""}`}</strong><small>{formatDateBr(row.issueDate)}{row.cfop ? ` · CFOP ${row.cfop}` : ""}</small></span>
                <span><strong>{row.warehouseName}</strong><small>{row.warehouseCnpj ? formatCnpj(row.warehouseCnpj) : row.ownLegalEntityName}</small></span>
                <span><Badge tone={row.movementType === "DEPOSIT" ? "success" : "info"}>{movementLabel(row)}</Badge><small>{row.productDescription}</small></span>
                <span><strong>{row.movementType === "RETURN" ? "− " : "+ "}{quantity(row.quantityKg / 60)} sc</strong><small>{quantity(row.quantityKg)} kg</small></span>
                <span><StatusBadge status={row.status} />{row.referencedDocumentNumber ? <small>Referência: NF {row.referencedDocumentNumber}</small> : null}</span>
              </article>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
