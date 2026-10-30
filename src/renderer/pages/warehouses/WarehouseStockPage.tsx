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
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");
  const [adjustment, setAdjustment] = useState({
    ownLegalEntityId: legalEntities[0]?.id ?? "", warehouseName: "", warehouseCnpj: "", productDescription: "",
    adjustmentMode: "SET_BALANCE" as "SET_BALANCE" | "ADD" | "REMOVE", unit: "SACK" as "SACK" | "KG",
    quantity: "", issueDate: today(), reason: ""
  });

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
      setMessageKind("error");
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
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar o movimento.");
      setLoading(false);
    }
  };

  const createAdjustment = async (): Promise<void> => {
    setLoading(true);
    setMessage(null);
    try {
      await window.operationsCafe.createWarehouseAdjustment({ organizationId, ...adjustment, warehouseCnpj: adjustment.warehouseCnpj || null });
      setMessageKind("success");
      setMessage("Ajuste manual registrado. O saldo e o histórico foram atualizados.");
      setAdjustment((current) => ({ ...current, quantity: "", reason: "" }));
      await load();
      setMessageKind("success");
      setMessage("Ajuste manual registrado. O saldo e o histórico foram atualizados.");
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar o ajuste manual.");
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
      {message ? <div className={`warehouse-feedback warehouse-feedback--${messageKind}`}>{message}</div> : null}

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

      <section className="warehouse-panel warehouse-adjustment">
        <div className="warehouse-panel__heading"><div><span>Correção auditável</span><h2>Ajustar estoque manualmente</h2></div><small>Não altera nem apaga as NF-e originais</small></div>
        <div className="warehouse-adjustment__form">
          <label><span>Empresa proprietária</span><select value={adjustment.ownLegalEntityId} onChange={(event) => setAdjustment({ ...adjustment, ownLegalEntityId: event.target.value })}>{legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.tradeName}</option>)}</select></label>
          <label><span>Armazém</span><input list="warehouse-adjustment-names" value={adjustment.warehouseName} onChange={(event) => setAdjustment({ ...adjustment, warehouseName: event.target.value })} placeholder="Nome do armazém" /><datalist id="warehouse-adjustment-names">{[...new Set([...summary.balances.map((row) => row.warehouseName), ...movements.map((row) => row.warehouseName)])].map((name) => <option key={name} value={name} />)}</datalist></label>
          <label><span>CNPJ do armazém</span><input value={adjustment.warehouseCnpj} onChange={(event) => setAdjustment({ ...adjustment, warehouseCnpj: event.target.value })} placeholder="Obrigatório para vincular futuras NF-e" /></label>
          <label><span>Produto</span><input list="warehouse-adjustment-products" value={adjustment.productDescription} onChange={(event) => setAdjustment({ ...adjustment, productDescription: event.target.value })} placeholder="Ex.: Café Arábica" /><datalist id="warehouse-adjustment-products">{[...new Set(summary.balances.map((row) => row.productDescription))].map((name) => <option key={name} value={name} />)}</datalist></label>
          <label><span>Tipo de ajuste</span><select value={adjustment.adjustmentMode} onChange={(event) => setAdjustment({ ...adjustment, adjustmentMode: event.target.value as typeof adjustment.adjustmentMode })}><option value="SET_BALANCE">Definir saldo correto</option><option value="ADD">Acrescentar ao saldo</option><option value="REMOVE">Retirar do saldo</option></select></label>
          <label><span>Quantidade</span><input inputMode="decimal" value={adjustment.quantity} onChange={(event) => setAdjustment({ ...adjustment, quantity: event.target.value })} placeholder="0,000" /></label>
          <label><span>Unidade</span><select value={adjustment.unit} onChange={(event) => setAdjustment({ ...adjustment, unit: event.target.value as typeof adjustment.unit })}><option value="SACK">Sacas (60 kg)</option><option value="KG">Quilogramas</option></select></label>
          <DateInput label="Data do ajuste" value={adjustment.issueDate} onChange={(event) => setAdjustment({ ...adjustment, issueDate: event.target.value })} />
          <label className="warehouse-adjustment__reason"><span>Motivo obrigatório</span><input value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} placeholder="Ex.: conferência física do armazém" /></label>
          <button type="button" onClick={() => void createAdjustment()} disabled={loading || !adjustment.ownLegalEntityId || !adjustment.warehouseName.trim() || adjustment.warehouseCnpj.replace(/\D/g, "").length !== 14 || !adjustment.productDescription.trim() || !adjustment.quantity.trim() || adjustment.reason.trim().length < 3}>{loading ? "Registrando..." : "Registrar ajuste"}</button>
        </div>
      </section>

      <section className="warehouse-panel">
        <div className="warehouse-panel__heading"><div><span>Posição atual</span><h2>Saldo por armazém</h2></div><small>1 saca = 60 kg</small></div>
        <div className="warehouse-table-wrap">
          <table className="warehouse-table"><thead><tr><th>Armazém</th><th>Empresa</th><th>Produto</th><th className="number">Kg</th><th className="number">Sacas</th><th>Ação</th></tr></thead>
            <tbody>{summary.balances.length ? summary.balances.map((row) => <tr key={`${row.ownLegalEntityId}:${row.warehouseCnpj}:${row.productDescription}`}><td><strong>{row.warehouseName}</strong><small>{row.warehouseCnpj ? formatCnpj(row.warehouseCnpj) : "CNPJ não informado"}</small></td><td>{row.ownLegalEntityName}</td><td>{row.productDescription}</td><td className="number">{quantity(row.quantityKg)}</td><td className="number"><strong>{quantity(row.quantitySacks)}</strong></td><td><button type="button" className="warehouse-review-button" onClick={() => { setAdjustment({ ...adjustment, ownLegalEntityId: row.ownLegalEntityId, warehouseName: row.warehouseName, warehouseCnpj: row.warehouseCnpj ?? "", productDescription: row.productDescription, adjustmentMode: "SET_BALANCE", unit: "SACK", quantity: row.quantitySacks }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Ajustar saldo</button></td></tr>) : <tr><td colSpan={6} className="empty">Nenhum saldo armazenado reconhecido.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <section className="warehouse-panel">
        <div className="warehouse-panel__heading"><div><span>Auditoria</span><h2>Movimentações reconhecidas</h2></div><small>{movements.length} item(ns) no filtro</small></div>
        <div className="warehouse-table-wrap">
          <table className="warehouse-table"><thead><tr><th>NF-e</th><th>Data</th><th>Armazém</th><th>Movimento</th><th>Produto / referência</th><th className="number">Quantidade</th><th>Status</th></tr></thead>
            <tbody>{movements.length ? movements.map((row) => (
              <tr key={row.id} className={row.status === "PENDING_REVIEW" ? "needs-review" : row.status === "CANCELED" ? "is-canceled" : ""}>
                <td><strong>{row.origin === "MANUAL" ? "Ajuste manual" : `NF ${row.documentNumber}`}</strong><small>{row.origin === "MANUAL" ? "Correção registrada no sistema" : `CFOP ${row.cfop}`}</small></td>
                <td>{formatDateOnlyBr(row.issueDate)}</td>
                <td><strong>{row.warehouseName}</strong><small>{row.ownLegalEntityName}</small></td>
                <td><span className={`warehouse-movement warehouse-movement--${row.movementType.toLowerCase()}`}>{row.origin === "MANUAL" ? (row.movementType === "DEPOSIT" ? "Ajuste manual (+)" : "Ajuste manual (−)") : movementLabel(row)}</span></td>
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
