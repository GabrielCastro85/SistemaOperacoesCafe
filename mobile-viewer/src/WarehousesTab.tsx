import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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

interface AdjustmentForm {
  warehouseName: string;
  warehouseCnpj: string;
  productDescription: string;
  adjustmentMode: "SET_BALANCE" | "ADD" | "REMOVE";
  unit: "SACK" | "KG";
  quantity: string;
  issueDate: string;
  reason: string;
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
  const [notice, setNotice] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyAdjustment = useCallback((): AdjustmentForm => ({
    warehouseName: "", warehouseCnpj: "", productDescription: "ARABICA", adjustmentMode: "SET_BALANCE",
    unit: "SACK", quantity: "", issueDate: new Date().toISOString().slice(0, 10), reason: ""
  }), []);
  const [form, setForm] = useState<AdjustmentForm>(() => emptyAdjustment());

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

  const editBalance = (row?: WarehouseBalance): void => {
    setNotice(null);
    setError(null);
    setForm(row ? {
      warehouseName: row.warehouseName, warehouseCnpj: row.warehouseCnpj ?? "", productDescription: row.productDescription,
      adjustmentMode: "SET_BALANCE", unit: "SACK", quantity: String(Number(row.quantitySacks.toFixed(6))),
      issueDate: new Date().toISOString().slice(0, 10), reason: ""
    } : emptyAdjustment());
    setShowEditor(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveAdjustment = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!legalEntityId) { setError("Selecione uma empresa própria antes de ajustar o saldo."); return; }
    const parsedQuantity = Number(form.quantity.replace(",", "."));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) { setError("Informe uma quantidade maior que zero."); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      await apiJson("/v1/manage/warehouse-adjustments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId, legalEntityId, warehouseName: form.warehouseName, warehouseCnpj: form.warehouseCnpj,
          productDescription: form.productDescription, adjustmentMode: form.adjustmentMode, unit: form.unit,
          quantity: parsedQuantity, issueDate: form.issueDate, reason: form.reason
        })
      });
      setNotice("Ajuste registrado e enviado para a sincronização dos computadores.");
      setShowEditor(false); setForm(emptyAdjustment()); await load();
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao registrar o ajuste."); }
    finally { setSaving(false); }
  };

  const movements = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return data?.movements ?? [];
    return (data?.movements ?? []).filter((row) => [row.documentNumber, row.warehouseName, row.warehouseCnpj,
      row.ownLegalEntityName, row.productDescription, row.cfop, row.referencedDocumentNumber, row.notes]
      .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(term));
  }, [data, search]);

  return (
    <>
      <PageHeader eyebrow="Estoque em terceiros" title="Cafés armazenados" description="Consulte saldos e movimentações e faça correções auditáveis pelo navegador."
        actions={<Button variant="primary" onClick={() => showEditor ? setShowEditor(false) : editBalance()}>{showEditor ? "Fechar ajuste" : "Ajustar estoque"}</Button>} />
      {showEditor ? (
        <Card eyebrow="Correção auditável" title="Ajustar estoque manualmente" className="viewer-editor-card">
          <form onSubmit={(event) => void saveAdjustment(event)}>
            <div className="viewer-form-grid">
              <label>Armazém<input className="ui-input" required value={form.warehouseName} onChange={(event) => setForm({ ...form, warehouseName: event.target.value })} /></label>
              <label>CNPJ do armazém<input className="ui-input" inputMode="numeric" placeholder="Opcional, recomendado" value={form.warehouseCnpj} onChange={(event) => setForm({ ...form, warehouseCnpj: event.target.value })} /></label>
              <label>Produto<input className="ui-input" required value={form.productDescription} onChange={(event) => setForm({ ...form, productDescription: event.target.value })} /></label>
              <label>Tipo de ajuste<select className="ui-input" value={form.adjustmentMode} onChange={(event) => setForm({ ...form, adjustmentMode: event.target.value as AdjustmentForm["adjustmentMode"] })}>
                <option value="SET_BALANCE">Definir saldo total</option><option value="ADD">Somar ao saldo</option><option value="REMOVE">Retirar do saldo</option>
              </select></label>
              <label>Unidade<select className="ui-input" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as AdjustmentForm["unit"] })}>
                <option value="SACK">Sacas (60 kg)</option><option value="KG">Quilogramas</option>
              </select></label>
              <label>Quantidade<input className="ui-input" required inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
              <label>Data<input className="ui-input" type="date" required value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></label>
            </div>
            <label>Motivo<textarea className="ui-input" required placeholder="Explique a correção para a auditoria" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
            <div className="viewer-form-actions"><Button onClick={() => setShowEditor(false)}>Cancelar</Button><Button type="submit" variant="primary" loading={saving}>Salvar ajuste</Button></div>
          </form>
        </Card>
      ) : null}
      {notice ? <Alert tone="success" title="Estoque atualizado">{notice}</Alert> : null}
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
                  <span><strong>{quantity(row.quantitySacks)} sacas</strong><small>{quantity(row.quantityKg)} kg</small><Button onClick={() => editBalance(row)}>Ajustar</Button></span>
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
