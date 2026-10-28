import { useCallback, useEffect, useMemo, useState } from "react";
import type { BootstrapData, WarehouseMovement, WarehouseSummary } from "../../../shared/types/domain";
import { formatCnpj, formatDateOnlyBr } from "../../../shared/utils/format";
import { Card, DateInput, PageHeader } from "../../design-system";

const today = (): string => new Date().toISOString().slice(0, 10);
const yearStart = (): string => `${new Date().getFullYear()}-01-01`;
const emptySummary: WarehouseSummary = { totalKg: "0", totalSacks: "0", warehouseCount: 0, activeMovementCount: 0, pendingReviewCount: 0, balances: [] };

function quantity(value: string, maximumFractionDigits = 3): string {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits });
}

function movementLabel(row: WarehouseMovement): string {
  if (row.movementType === "DEPOSIT") return row.movementKind === "SYMBOLIC" ? "Remessa simbólica" : "Remessa para depósito";
  return row.movementKind === "SYMBOLIC" ? "Retorno simbólico / baixa" : "Retorno físico";
}

export function WarehouseStockPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const legalEntities = data.legalEntities.filter((entity) => entity.organizationId === organizationId && entity.isActive);
  const [ownLegalEntityId, setOwnLegalEntityId] = useState("");
  const [warehouseCnpj, setWarehouseCnpj] = useState("");
  const [periodStart, setPeriodStart] = useState(yearStart);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "CANCELED" | "PENDING_REVIEW">("ALL");
  const [summary, setSummary] = useState<WarehouseSummary>(emptySummary);
  const [movements, setMovements] = useState<WarehouseMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setMessage(null);
    try {
      const [nextSummary, nextMovements] = await Promise.all([
        window.operationsCafe.getWarehouseSummary({ organizationId, ownLegalEntityId: ownLegalEntityId || null }),
        window.operationsCafe.listWarehouseMovements({
          organizationId, ownLegalEntityId: ownLegalEntityId || null, warehouseCnpj: warehouseCnpj || null,
          periodStart: periodStart || null, periodEnd: periodEnd || null, status
        })
      ]);
      setSummary(nextSummary);
      setMovements(nextMovements);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os cafés armazenados.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, ownLegalEntityId, warehouseCnpj, periodStart, periodEnd, status]);

  useEffect(() => { void load(); }, [load]);

  const reviewMovement = async (row: WarehouseMovement): Promise<void> => {
    const reference = window.prompt(`Informe o número da NF de remessa original vinculada à NF ${row.documentNumber}:`, row.referencedDocumentNumber ?? "");
    if (!reference?.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await window.operationsCafe.reviewWarehouseMovement({ id: row.id, referencedDocumentNumber: reference.trim() });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar o movimento.");
      setLoading(false);
    }
  };

  const warehouses = useMemo(() => {
    const found = new Map<string, { cnpj: string; name: string }>();
    for (const row of movements) if (row.warehouseCnpj) found.set(row.warehouseCnpj, { cnpj: row.warehouseCnpj, name: row.warehouseName });
    for (const row of summary.balances) if (row.warehouseCnpj) found.set(row.warehouseCnpj, { cnpj: row.warehouseCnpj, name: row.warehouseName });
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [movements, summary.balances]);

  return (
    <section className="content-section warehouse-stock-page">
      <PageHeader eyebrow="Estoque em terceiros" title="Cafés armazenados" description="Controle automático pelas NF-e de remessa, retorno e baixa simbólica. Estas notas não geram cobrança nem operação comercial." />
      {message ? <div className="warehouse-feedback">{message}</div> : null}

      <div className="warehouse-filters">
        <label><span>Empresa proprietária</span><select value={ownLegalEntityId} onChange={(event) => setOwnLegalEntityId(event.target.value)}><option value="">Todas as empresas</option>{legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.tradeName}</option>)}</select></label>
        <label><span>Armazém</span><select value={warehouseCnpj} onChange={(event) => setWarehouseCnpj(event.target.value)}><option value="">Todos os armazéns</option>{warehouses.map((warehouse) => <option key={warehouse.cnpj} value={warehouse.cnpj}>{warehouse.name}</option>)}</select></label>
        <DateInput label="Movimentos de" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
        <DateInput label="Até" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
        <label><span>Situação</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="ALL">Todas</option><option value="ACTIVE">Ativas</option><option value="PENDING_REVIEW">Conferir</option><option value="CANCELED">Canceladas</option></select></label>
        <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</button>
      </div>

      <div className="dashboard-grid dashboard-grid--hero warehouse-kpis">
        <Card><span>Saldo armazenado</span><strong>{quantity(summary.totalSacks)} sacas</strong><small>{quantity(summary.totalKg)} kg</small></Card>
        <Card><span>Armazéns com saldo</span><strong>{summary.warehouseCount}</strong><small>Locais de terceiros identificados</small></Card>
        <Card><span>Movimentos ativos</span><strong>{summary.activeMovementCount}</strong><small>Remessas e retornos reconhecidos</small></Card>
        <Card><span>Precisam de conferência</span><strong>{summary.pendingReviewCount}</strong><small>Referência da remessa não identificada</small></Card>
      </div>

      <section className="warehouse-panel">
        <div className="warehouse-panel__heading"><div><span>Posição atual</span><h2>Saldo por armazém</h2></div><small>1 saca = 60 kg</small></div>
        <div className="warehouse-table-wrap">
          <table className="warehouse-table"><thead><tr><th>Armazém</th><th>Empresa</th><th>Produto</th><th className="number">Kg</th><th className="number">Sacas</th></tr></thead>
            <tbody>{summary.balances.length ? summary.balances.map((row) => <tr key={`${row.ownLegalEntityId}:${row.warehouseCnpj}:${row.productDescription}`}><td><strong>{row.warehouseName}</strong><small>{row.warehouseCnpj ? formatCnpj(row.warehouseCnpj) : "CNPJ não informado"}</small></td><td>{row.ownLegalEntityName}</td><td>{row.productDescription}</td><td className="number">{quantity(row.quantityKg)}</td><td className="number"><strong>{quantity(row.quantitySacks)}</strong></td></tr>) : <tr><td colSpan={5} className="empty">Nenhum saldo armazenado reconhecido.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <section className="warehouse-panel">
        <div className="warehouse-panel__heading"><div><span>Auditoria</span><h2>Movimentações reconhecidas</h2></div><small>{movements.length} item(ns) no filtro</small></div>
        <div className="warehouse-table-wrap">
          <table className="warehouse-table"><thead><tr><th>NF-e</th><th>Data</th><th>Armazém</th><th>Movimento</th><th>Produto / referência</th><th className="number">Quantidade</th><th>Status</th></tr></thead>
            <tbody>{movements.length ? movements.map((row) => (
              <tr key={row.id} className={row.status === "PENDING_REVIEW" ? "needs-review" : row.status === "CANCELED" ? "is-canceled" : ""}>
                <td><strong>NF {row.documentNumber}</strong><small>CFOP {row.cfop}</small></td>
                <td>{formatDateOnlyBr(row.issueDate)}</td>
                <td><strong>{row.warehouseName}</strong><small>{row.ownLegalEntityName}</small></td>
                <td><span className={`warehouse-movement warehouse-movement--${row.movementType.toLowerCase()}`}>{movementLabel(row)}</span></td>
                <td>{row.productDescription}<small>{row.referencedDocumentNumber ? `Referência: NF ${row.referencedDocumentNumber}` : row.notes ?? "Sem referência informada"}</small></td>
                <td className="number"><strong>{row.movementType === "RETURN" ? "− " : "+ "}{quantity(String(Number(row.quantityKg) / 60))} sc</strong><small>{quantity(row.quantityKg)} kg</small></td>
                <td><span className={`warehouse-status warehouse-status--${row.status.toLowerCase()}`}>{row.status === "ACTIVE" ? "Ativa" : row.status === "CANCELED" ? "Cancelada" : "Conferir"}</span>{row.status === "PENDING_REVIEW" ? <button type="button" className="warehouse-review-button" onClick={() => void reviewMovement(row)} disabled={loading}>Informar referência</button> : null}</td>
              </tr>
            )) : <tr><td colSpan={7} className="empty">Nenhum movimento encontrado no período.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
