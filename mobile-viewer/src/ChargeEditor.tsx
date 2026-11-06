import { useEffect, useMemo, useState } from "react";
import { apiJson, downloadApiFile, fetchApiText, queryString, saveBlob } from "./api";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { Alert } from "./renderer/design-system/components/Alert";
import { Badge, StatusBadge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { ConfirmationDialog } from "./renderer/design-system/components/ConfirmationDialog";
import { Drawer } from "./renderer/design-system/components/Drawer";
import { LoadingState } from "./renderer/design-system/components/LoadingState";

// Cobrancas pelo site: rascunho, conferencia, ajustes, CT-e, creditos,
// emissao, cancelamento, documentos e baixas. As regras ficam no servidor
// (server/src/chargeManagement.ts), que repete o AppRepository.

interface ChargeOperation {
  id: string; operationId: string; operationDateSnapshot: string; fiscalDocumentNumberSnapshot: string | null;
  issuerNameSnapshot: string | null; destinationNameSnapshot: string | null; ownLegalEntityNameSnapshot: string | null;
  quantitySacksDecimalSnapshot: string; serviceRateCentsSnapshot: number; serviceAmountCentsSnapshot: number; contractNumberSnapshot: string | null;
}
interface Adjustment {
  id: string; ledgerEntryId: string | null; sourceFiscalDocumentId: string | null; ledgerEntryDate: string | null; adjustmentType: string;
  effect: "INCREASE_RECEIVABLE" | "REDUCE_RECEIVABLE"; description: string; reason: string | null; amountCents: number;
  cte: { sacks: string; unitValueCents: number; notes: Array<{ number: string; company: string; sacks: string }> } | null;
}
interface PaymentAllocation {
  id: string; clientPaymentId: string; amountCents: number; allocatedAt: string;
  payment: { id: string; paymentDate: string; amountCents: number; paymentMethod: string; transactionReference: string | null; status: string } | null;
}
interface Detail {
  charge: {
    id: string; organizationId: string; ownLegalEntityId: string; clientPartnerId: string; chargeNumber: string | null; referenceCode: string | null;
    periodStart: string; periodEnd: string; issueDate: string | null; dueDate: string | null; status: string; subtotalServicesCents: number;
    additionsCents: number; deductionsCents: number; finalAmountCents: number; paidAmountCents: number; openAmountCents: number;
    notes: string | null; internalNotes: string | null; cancellationReason: string | null;
  };
  clientName: string; legalEntityName: string; operations: ChargeOperation[]; adjustments: Adjustment[]; payments: PaymentAllocation[];
  history: Array<{ id: string; previousStatus: string | null; nextStatus: string; reason: string | null; createdAt: string }>;
  availableEntries: Array<{ id: string; entryType: string; effect: string; description: string; entryDate: string; availableAmountCents: number }>;
  availablePayments: Array<{ id: string; paymentDate: string; paymentMethod: string; transactionReference: string | null; availableAmountCents: number }>;
}
interface OpenNote { id: string; documentNumber: string; operationDate: string; destinationName: string | null; issuerName: string | null; quantitySacks: string; serviceAmountCents: number; hasPendingIssues: boolean }

export const CHARGE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", PENDING_REVIEW: "Em conferência", ISSUED: "Emitida", PARTIALLY_PAID: "Paga em parte", PAID: "Paga",
  OVERDUE: "Vencida", CANCELLED: "Cancelada", REPLACED: "Substituída"
};
const ADJUSTMENT_TYPES: Array<{ type: string; label: string; effect?: Adjustment["effect"] }> = [
  { type: "ADVANCE", label: "Adiantamento", effect: "REDUCE_RECEIVABLE" }, { type: "DISCOUNT", label: "Desconto", effect: "REDUCE_RECEIVABLE" },
  { type: "SURCHARGE", label: "Acréscimo", effect: "INCREASE_RECEIVABLE" }, { type: "REIMBURSEMENT", label: "Reembolso" },
  { type: "PREVIOUS_BALANCE", label: "Saldo anterior" }, { type: "MANUAL_ADJUSTMENT", label: "Ajuste manual" }, { type: "OTHER", label: "Outro" }
];
const PAYMENT_METHODS: Record<string, string> = { PIX: "PIX", BANK_TRANSFER: "Transferência", CASH: "Dinheiro", CHECK: "Cheque", OFFSET: "Compensação", OTHER: "Outra" };
const json = (method: string, body: unknown = {}): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const base = (id: string) => `/v1/manage/client-charges/${encodeURIComponent(id)}`;
export const moneyToCents = (value: string): number => {
  const cleaned = value.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};
export const centsToInput = (value: number): string => (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimalLabel = (value: string): string => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const company = (operation: ChargeOperation): string => operation.destinationNameSnapshot || operation.issuerNameSnapshot || operation.ownLegalEntityNameSnapshot || "—";
const defaultsToCte = (name: string): boolean => /\bvassuler\b/i.test(name.normalize("NFD").replace(/[̀-ͯ]/g, ""));
export const chargeLabel = (charge: { chargeNumber: string | null; referenceCode: string | null; periodStart: string; periodEnd: string }): string =>
  charge.chargeNumber ? `Cobrança ${charge.chargeNumber}` : charge.referenceCode ?? `Cobrança ${formatDateBr(charge.periodStart)} a ${formatDateBr(charge.periodEnd)}`;
const safeName = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// O resumo vem em SVG do servidor; o navegador desenha num canvas e salva PNG.
async function saveSvgAsPng(svg: string, width: number, height: number, name: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Não foi possível desenhar a imagem.")); image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = width * 2; canvas.height = height * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Navegador sem suporte para gerar imagem.");
    context.scale(2, 2);
    context.fillStyle = "#f8f5ed"; context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Não foi possível gerar a imagem.");
    saveBlob(blob, name);
  } finally { URL.revokeObjectURL(url); }
}

export async function printChargeControl(chargeIds: string[], filterDescription: string): Promise<void> {
  const html = await fetchApiText("/v1/manage/client-charges/control", { chargeIds, filterDescription, format: "html" });
  const frame = document.createElement("iframe");
  frame.style.position = "fixed"; frame.style.width = "0"; frame.style.height = "0"; frame.style.border = "0";
  document.body.appendChild(frame);
  frame.srcdoc = html;
  await new Promise<void>((resolve) => { frame.onload = () => resolve(); });
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 60_000);
}

export async function downloadChargeControl(chargeIds: string[], filterDescription: string): Promise<void> {
  await downloadApiFile("/v1/manage/client-charges/control", `Controle-interno-cobrancas-${new Date().toISOString().slice(0, 10)}.xlsx`, { chargeIds, filterDescription, format: "xlsx" });
}

type Dialog = "issue" | "cancel" | "delete" | null;

export function ChargeDrawer({ chargeId, organizationId, onClose, onChanged }: {
  chargeId: string | null; organizationId: string; onClose: () => void; onChanged: (message: string) => void;
}): JSX.Element | null {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [header, setHeader] = useState({ periodStart: "", periodEnd: "", dueDate: "", notes: "", internalNotes: "" });
  const [adjustment, setAdjustment] = useState({ type: "DISCOUNT", effect: "REDUCE_RECEIVABLE" as Adjustment["effect"], description: "Desconto", amount: "", reason: "" });
  const [cteSelection, setCteSelection] = useState<string[]>([]);
  const [cteUnit, setCteUnit] = useState("1,50");
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<OpenNote[] | null>(null);
  const [addSelection, setAddSelection] = useState<string[]>([]);
  const [payment, setPayment] = useState<{ amount: string; date: string; method: string; reference: string } | null>(null);

  const load = async (id: string): Promise<void> => {
    setError(null);
    try {
      const loaded = await apiJson<Detail>(base(id));
      setDetail(loaded);
      setCteSelection(loaded.operations.filter((operation) => defaultsToCte(company(operation))).map((operation) => operation.id));
      setCreditAmounts(Object.fromEntries(loaded.availableEntries.map((entry) => [entry.id, centsToInput(Math.min(entry.availableAmountCents, entry.effect === "REDUCE_RECEIVABLE" ? Math.max(loaded.charge.openAmountCents, 1) : entry.availableAmountCents))])));
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar a cobrança."); }
  };
  useEffect(() => {
    setDetail(null); setEditing(false); setDialog(null); setAdding(null); setPayment(null);
    if (chargeId) void load(chargeId);
  }, [chargeId]);

  const c = detail?.charge;
  const totals = useMemo(() => {
    const operations = detail?.operations ?? [];
    return { sacks: operations.reduce((sum, operation) => sum + Number(operation.quantitySacksDecimalSnapshot || 0), 0) };
  }, [detail]);
  if (!chargeId) return null;

  const run = async (action: () => Promise<string | void>): Promise<void> => {
    setBusy(true); setError(null);
    try {
      const message = await action();
      await load(chargeId);
      if (message) onChanged(message);
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível concluir."); }
    finally { setBusy(false); setDialog(null); setReason(""); }
  };
  const call = (path: string, method = "POST", body: unknown = {}) => apiJson<Record<string, unknown>>(`${base(chargeId)}${path}`, json(method, body));
  const editable = Boolean(c && ["DRAFT", "PENDING_REVIEW"].includes(c.status));
  const adjustable = Boolean(c && ["DRAFT", "PENDING_REVIEW", "ISSUED", "OVERDUE"].includes(c.status));
  const payable = Boolean(c && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(c.status) && c.openAmountCents > 0);
  const closed = Boolean(c && ["CANCELLED", "REPLACED"].includes(c.status));
  const label = c ? chargeLabel(c) : "Cobrança";
  const fileBase = c && detail ? safeName(`${detail.clientName}-${c.periodStart}-a-${c.periodEnd}`) : "cobranca";

  const startEditing = (): void => {
    if (!c) return;
    setHeader({ periodStart: c.periodStart, periodEnd: c.periodEnd, dueDate: c.dueDate ?? "", notes: c.notes ?? "", internalNotes: c.internalNotes ?? "" });
    setEditing(true);
  };
  const openAddNotes = async (): Promise<void> => {
    if (!c) return;
    setAddSelection([]);
    try {
      const notes = await apiJson<OpenNote[]>(`/v1/viewer/open-notes?${queryString({ organizationId, legalEntityId: c.ownLegalEntityId, periodStart: c.periodStart, periodEnd: c.periodEnd, clientId: c.clientPartnerId })}`);
      setAdding(notes.filter((note) => !note.hasPendingIssues));
    } catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar as notas em aberto."); }
  };
  const selectAdjustmentType = (type: string): void => {
    const option = ADJUSTMENT_TYPES.find((item) => item.type === type)!;
    setAdjustment((current) => ({ ...current, type, effect: option.effect ?? current.effect, description: option.label }));
  };
  const cteCents = (() => {
    const unit = moneyToCents(cteUnit);
    const sacks = (detail?.operations ?? []).filter((operation) => cteSelection.includes(operation.id)).reduce((sum, operation) => sum + Number(operation.quantitySacksDecimalSnapshot || 0), 0);
    return Math.round(sacks * unit);
  })();

  return (
    <Drawer open title={label} onClose={onClose}>
      <div className="viewer-invoice-editor">
        {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
        {!detail && !error ? <LoadingState label="Carregando cobrança..." /> : null}
        {detail && c ? (
          <>
            <div className="viewer-invoice-editor__status">
              <StatusBadge status={c.status} />
              <Badge tone="neutral">{detail.clientName}</Badge>
              <Badge tone="info">{detail.legalEntityName}</Badge>
            </div>
            {c.cancellationReason ? <Alert tone="neutral" title="Motivo do cancelamento">{c.cancellationReason}</Alert> : null}
            <dl className="viewer-invoice-editor__facts viewer-charge-totals">
              <div><dt>Serviços</dt><dd>{formatCurrencyBr(c.subtotalServicesCents)}</dd></div>
              <div><dt>Acréscimos</dt><dd>{formatCurrencyBr(c.additionsCents)}</dd></div>
              <div><dt>Descontos e créditos</dt><dd>{formatCurrencyBr(c.deductionsCents)}</dd></div>
              <div><dt>Total</dt><dd><strong>{formatCurrencyBr(c.finalAmountCents)}</strong></dd></div>
              <div><dt>Pago</dt><dd>{formatCurrencyBr(c.paidAmountCents)}</dd></div>
              <div><dt>Em aberto</dt><dd><strong>{formatCurrencyBr(c.openAmountCents)}</strong></dd></div>
            </dl>
            <footer className="viewer-invoice-editor__footer">
              <Button loading={busy} onClick={() => void run(async () => { await downloadApiFile(`${base(chargeId)}/pdf`, `${fileBase}${editable ? "-previa" : ""}.pdf`); })}>{editable ? "Prévia em PDF" : "PDF"}</Button>
              <Button onClick={() => void run(async () => { await downloadApiFile(`${base(chargeId)}/excel`, `${fileBase}.xlsx`); })}>Excel</Button>
              <Button onClick={() => void run(async () => { const image = await apiJson<{ svg: string; width: number; height: number; fileName: string }>(`${base(chargeId)}/image`); await saveSvgAsPng(image.svg, image.width, image.height, image.fileName); })}>Imagem</Button>
              {c.status === "DRAFT" ? <Button onClick={() => void run(async () => { await call("/submit-review"); return `${label} enviada para conferência.`; })}>Enviar para conferência</Button> : null}
              {editable ? <Button variant="primary" onClick={() => setDialog("issue")}>Emitir</Button> : null}
              {payable ? <Button variant="primary" onClick={() => setPayment({ amount: centsToInput(c.openAmountCents), date: new Date().toISOString().slice(0, 10), method: "PIX", reference: "" })}>Registrar pagamento</Button> : null}
              {!closed && c.paidAmountCents === 0 ? <Button onClick={() => setDialog("cancel")}>Cancelar cobrança</Button> : null}
              {c.paidAmountCents === 0 && c.status !== "PAID" ? <Button variant="danger" onClick={() => setDialog("delete")}>Excluir</Button> : null}
            </footer>

            {payment ? (
              <div className="viewer-invoice-editor__section">
                <strong>Registrar pagamento</strong>
                <div className="viewer-confirmation-add">
                  <input className="ui-input" type="date" value={payment.date} onChange={(event) => setPayment({ ...payment, date: event.target.value })} />
                  <input className="ui-input" inputMode="decimal" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} aria-label="Valor recebido" />
                  <select className="ui-select" value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}>
                    {Object.entries(PAYMENT_METHODS).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
                  </select>
                  <input className="ui-input" placeholder="Referência (opcional)" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} />
                  <Button onClick={() => setPayment(null)}>Fechar</Button>
                  <Button variant="primary" loading={busy} onClick={() => void run(async () => {
                    const amountCents = moneyToCents(payment.amount);
                    if (amountCents <= 0) throw new Error("Informe um valor maior que zero.");
                    await apiJson("/v1/manage/client-payments", json("POST", { chargeId, paymentDate: payment.date, amountCents, paymentMethod: payment.method, transactionReference: payment.reference }));
                    setPayment(null);
                    return `Pagamento de ${formatCurrencyBr(amountCents)} registrado.`;
                  })}>Confirmar</Button>
                </div>
              </div>
            ) : null}

            <div className="viewer-invoice-editor__section">
              <strong>Dados da cobrança {editable && !editing ? <Button variant="ghost" onClick={startEditing}>Editar</Button> : null}</strong>
              {!editing ? (
                <dl className="viewer-invoice-editor__facts">
                  <div><dt>Período</dt><dd>{formatDateBr(c.periodStart)} a {formatDateBr(c.periodEnd)}</dd></div>
                  <div><dt>Vencimento</dt><dd>{c.dueDate ? formatDateBr(c.dueDate) : "—"}</dd></div>
                  <div><dt>Emissão</dt><dd>{c.issueDate ? formatDateBr(c.issueDate) : "Não emitida"}</dd></div>
                  <div><dt>Sacas</dt><dd>{totals.sacks.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</dd></div>
                  <div className="viewer-invoice-editor__wide"><dt>Observação (sai no PDF)</dt><dd>{c.notes ?? "—"}</dd></div>
                  <div className="viewer-invoice-editor__wide"><dt>Observação interna</dt><dd>{c.internalNotes ?? "—"}</dd></div>
                </dl>
              ) : (
                <div className="viewer-invoice-editor__grid">
                  <label>Período de<input className="ui-input" type="date" value={header.periodStart} onChange={(event) => setHeader({ ...header, periodStart: event.target.value })} /></label>
                  <label>até<input className="ui-input" type="date" value={header.periodEnd} onChange={(event) => setHeader({ ...header, periodEnd: event.target.value })} /></label>
                  <label>Vencimento<input className="ui-input" type="date" value={header.dueDate} onChange={(event) => setHeader({ ...header, dueDate: event.target.value })} /></label>
                  <span />
                  <label className="viewer-invoice-editor__wide">Observação (sai no PDF)<textarea className="ui-input" rows={2} value={header.notes} onChange={(event) => setHeader({ ...header, notes: event.target.value })} /></label>
                  <label className="viewer-invoice-editor__wide">Observação interna<textarea className="ui-input" rows={2} value={header.internalNotes} onChange={(event) => setHeader({ ...header, internalNotes: event.target.value })} /></label>
                  <footer className="viewer-invoice-editor__footer viewer-invoice-editor__wide">
                    <Button onClick={() => setEditing(false)}>Descartar</Button>
                    <Button variant="primary" loading={busy} onClick={() => void run(async () => {
                      await call("", "PUT", { periodStart: header.periodStart, periodEnd: header.periodEnd, dueDate: header.dueDate || null, notes: header.notes, internalNotes: header.internalNotes });
                      setEditing(false);
                    })}>Salvar</Button>
                  </footer>
                </div>
              )}
            </div>

            <div className="viewer-invoice-editor__section">
              <strong>Notas ({detail.operations.length}) {editable && !adding ? <Button variant="ghost" onClick={() => void openAddNotes()}>Adicionar notas</Button> : null}</strong>
              {detail.operations.map((operation) => (
                <div className="viewer-invoice-editor__line" key={operation.id}>
                  <span><strong>NF {operation.fiscalDocumentNumberSnapshot ?? "—"}</strong><small>{formatDateBr(operation.operationDateSnapshot)}{operation.contractNumberSnapshot ? ` · Contrato ${operation.contractNumberSnapshot}` : ""}</small></span>
                  <span>{company(operation)}<small>{decimalLabel(operation.quantitySacksDecimalSnapshot)} sacas · {formatCurrencyBr(operation.serviceRateCentsSnapshot)}/saca</small></span>
                  <span>{formatCurrencyBr(operation.serviceAmountCentsSnapshot)}{editable ? <Button variant="ghost" onClick={() => void run(async () => { await call("/operations/release", "POST", { operationIds: [operation.operationId] }); return `NF ${operation.fiscalDocumentNumberSnapshot ?? ""} saiu da cobrança e voltou para as notas em aberto.`; })}>Tirar</Button> : null}</span>
                </div>
              ))}
              {adding ? (
                <div className="viewer-spreadsheet-rows">
                  {adding.length === 0 ? <small>Nenhuma outra nota em aberto deste cliente no período da cobrança.</small> : adding.map((note) => (
                    <label className="viewer-invoice-editor__line viewer-confirmation-pick" key={note.id}>
                      <span><strong><input type="checkbox" checked={addSelection.includes(note.id)} onChange={(event) => setAddSelection((current) => event.target.checked ? [...current, note.id] : current.filter((id) => id !== note.id))} /> NF {note.documentNumber}</strong><small>{formatDateBr(note.operationDate)}</small></span>
                      <span>{note.destinationName ?? note.issuerName ?? "—"}<small>{decimalLabel(note.quantitySacks)} sacas</small></span>
                      <span>{formatCurrencyBr(note.serviceAmountCents)}</span>
                    </label>
                  ))}
                  <footer className="viewer-invoice-editor__footer">
                    <Button onClick={() => setAdding(null)}>Fechar</Button>
                    <Button variant="primary" disabled={!addSelection.length} loading={busy} onClick={() => void run(async () => { await call("/operations", "POST", { operationIds: addSelection }); setAdding(null); return `${addSelection.length} nota(s) adicionada(s) à cobrança.`; })}>Adicionar {addSelection.length || ""}</Button>
                  </footer>
                </div>
              ) : null}
            </div>

            <div className="viewer-invoice-editor__section">
              <strong>Acréscimos, descontos e créditos</strong>
              {detail.adjustments.length === 0 ? <small>Nenhum ajuste.</small> : null}
              {detail.adjustments.map((item) => (
                <div className="viewer-invoice-editor__line" key={item.id}>
                  <span><strong>{item.description}</strong><small>{item.sourceFiscalDocumentId ? "Vem da nota fiscal" : item.ledgerEntryId ? `Conta-corrente${item.ledgerEntryDate ? ` de ${formatDateBr(item.ledgerEntryDate)}` : ""}` : item.reason ?? ""}</small></span>
                  <span>{item.cte ? <small>{item.cte.notes.map((note) => `NF ${note.number}`).join(", ")}</small> : null}</span>
                  <span>{item.effect === "INCREASE_RECEIVABLE" ? "+" : "−"} {formatCurrencyBr(item.amountCents)}
                    {adjustable && !item.sourceFiscalDocumentId ? <Button variant="ghost" onClick={() => void run(async () => { await call(`/adjustments/${item.id}`, "DELETE"); return `Ajuste "${item.description}" removido.`; })}>Remover</Button> : null}</span>
                </div>
              ))}
              {adjustable ? (
                <>
                  <div className="viewer-confirmation-add">
                    <select className="ui-select" value={adjustment.type} onChange={(event) => selectAdjustmentType(event.target.value)}>
                      {ADJUSTMENT_TYPES.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
                    </select>
                    {!ADJUSTMENT_TYPES.find((item) => item.type === adjustment.type)?.effect ? (
                      <select className="ui-select" value={adjustment.effect} onChange={(event) => setAdjustment({ ...adjustment, effect: event.target.value as Adjustment["effect"] })}>
                        <option value="INCREASE_RECEIVABLE">Aumenta o valor</option><option value="REDUCE_RECEIVABLE">Reduz o valor</option>
                      </select>
                    ) : null}
                    <input className="ui-input" placeholder="Descrição" value={adjustment.description} onChange={(event) => setAdjustment({ ...adjustment, description: event.target.value })} />
                    <input className="ui-input" inputMode="decimal" placeholder="Valor (R$)" value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} />
                    <input className="ui-input" placeholder="Motivo" value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} />
                    <Button loading={busy} disabled={moneyToCents(adjustment.amount) <= 0 || !adjustment.description.trim()} onClick={() => void run(async () => {
                      await call("/adjustments", "POST", { adjustmentType: adjustment.type, effect: adjustment.effect, description: adjustment.description, amountCents: moneyToCents(adjustment.amount), reason: adjustment.reason });
                      setAdjustment((current) => ({ ...current, amount: "", reason: "" }));
                      return `${adjustment.description} de ${formatCurrencyBr(moneyToCents(adjustment.amount))} aplicado.`;
                    })}>Aplicar</Button>
                  </div>
                  {detail.availableEntries.length ? (
                    <>
                      <small>Saldo disponível na conta-corrente do cliente:</small>
                      {detail.availableEntries.map((entry) => (
                        <div className="viewer-invoice-editor__line" key={entry.id}>
                          <span><strong>{entry.description}</strong><small>{formatDateBr(entry.entryDate)} · {entry.effect === "REDUCE_RECEIVABLE" ? "abate da cobrança" : "soma na cobrança"}</small></span>
                          <span>Disponível {formatCurrencyBr(entry.availableAmountCents)}</span>
                          <span className="viewer-charge-inline">
                            <input className="ui-input" inputMode="decimal" aria-label="Valor a usar" value={creditAmounts[entry.id] ?? ""} onChange={(event) => setCreditAmounts({ ...creditAmounts, [entry.id]: event.target.value })} />
                            <Button loading={busy} onClick={() => void run(async () => { const amountCents = moneyToCents(creditAmounts[entry.id] ?? ""); await call("/credits", "POST", { ledgerEntryId: entry.id, amountCents }); return `${formatCurrencyBr(amountCents)} da conta-corrente usados na cobrança.`; })}>Usar</Button>
                          </span>
                        </div>
                      ))}
                    </>
                  ) : null}
                </>
              ) : null}
            </div>

            {adjustable && detail.operations.length ? (
              <div className="viewer-invoice-editor__section">
                <strong>CT-e</strong>
                <small>Marque as notas que tiveram CT-e. O valor é sacas × valor por saca e entra como acréscimo.</small>
                <div className="viewer-chip-row">
                  {detail.operations.map((operation) => (
                    <label key={operation.id} className="viewer-checkbox">
                      <input type="checkbox" checked={cteSelection.includes(operation.id)} onChange={(event) => setCteSelection((current) => event.target.checked ? [...current, operation.id] : current.filter((id) => id !== operation.id))} />
                      NF {operation.fiscalDocumentNumberSnapshot} ({decimalLabel(operation.quantitySacksDecimalSnapshot)} sc)
                    </label>
                  ))}
                </div>
                <div className="viewer-confirmation-add">
                  <label>Valor por saca<input className="ui-input" inputMode="decimal" value={cteUnit} onChange={(event) => setCteUnit(event.target.value)} /></label>
                  <span>Total do CT-e: <strong>{formatCurrencyBr(cteCents)}</strong></span>
                  <Button loading={busy} disabled={!cteSelection.length || cteCents <= 0} onClick={() => void run(async () => { await call("/cte", "POST", { linkIds: cteSelection, unitValueCents: moneyToCents(cteUnit) }); return `CT-e de ${formatCurrencyBr(cteCents)} lançado.`; })}>Lançar CT-e</Button>
                </div>
              </div>
            ) : null}

            <div className="viewer-invoice-editor__section">
              <strong>Pagamentos</strong>
              {detail.payments.length === 0 ? <small>Nenhum pagamento registrado.</small> : null}
              {detail.payments.map((item) => (
                <div className="viewer-invoice-editor__line" key={item.id}>
                  <span><strong>{item.payment ? formatDateBr(item.payment.paymentDate) : formatDateBr(item.allocatedAt.slice(0, 10))}</strong><small>{item.payment ? PAYMENT_METHODS[item.payment.paymentMethod] ?? item.payment.paymentMethod : ""}{item.payment?.transactionReference ? ` · ${item.payment.transactionReference}` : ""}</small></span>
                  <span>{item.payment && item.payment.amountCents !== item.amountCents ? <small>Pagamento total de {formatCurrencyBr(item.payment.amountCents)}</small> : null}</span>
                  <span>{formatCurrencyBr(item.amountCents)}<Button variant="ghost" onClick={() => {
                    const typed = window.prompt("Motivo do estorno deste pagamento (estorna o pagamento inteiro em todas as cobranças):")?.trim();
                    if (typed) void run(async () => { await apiJson(`/v1/manage/client-payments/${encodeURIComponent(item.clientPaymentId)}/cancel`, json("POST", { reason: typed })); return "Pagamento estornado."; });
                  }}>Estornar</Button></span>
                </div>
              ))}
              {payable && detail.availablePayments.length ? (
                <>
                  <small>Pagamentos do cliente com sobra para baixar nesta cobrança:</small>
                  {detail.availablePayments.map((item) => (
                    <div className="viewer-invoice-editor__line" key={item.id}>
                      <span><strong>{formatDateBr(item.paymentDate)}</strong><small>{PAYMENT_METHODS[item.paymentMethod] ?? item.paymentMethod}{item.transactionReference ? ` · ${item.transactionReference}` : ""}</small></span>
                      <span>Sobra {formatCurrencyBr(item.availableAmountCents)}</span>
                      <span><Button loading={busy} onClick={() => void run(async () => {
                        const amountCents = Math.min(item.availableAmountCents, c.openAmountCents);
                        await apiJson(`/v1/manage/client-payments/${encodeURIComponent(item.id)}/allocate`, json("POST", { chargeId, amountCents }));
                        return `${formatCurrencyBr(amountCents)} baixados nesta cobrança.`;
                      })}>Baixar {formatCurrencyBr(Math.min(item.availableAmountCents, c.openAmountCents))}</Button></span>
                    </div>
                  ))}
                </>
              ) : null}
            </div>

            <div className="viewer-invoice-editor__section">
              <strong>Histórico</strong>
              {detail.history.map((item) => (
                <div className="viewer-invoice-editor__line" key={item.id}>
                  <span><strong>{CHARGE_STATUS_LABELS[item.nextStatus] ?? item.nextStatus}</strong><small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small></span>
                  <span>{item.reason ?? ""}</span><span />
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <ConfirmationDialog open={dialog === "issue"} title="Emitir cobrança" confirmLabel="Emitir" onCancel={() => setDialog(null)}
        onConfirm={() => void run(async () => { await call("/issue"); return `${label} emitida. As notas ficam como cobradas.`; })}>
        As notas ficam marcadas como cobradas e o valor entra na conta-corrente do cliente.
      </ConfirmationDialog>
      <ConfirmationDialog open={dialog === "cancel"} title="Cancelar cobrança" confirmLabel="Cancelar cobrança" onCancel={() => setDialog(null)}
        onConfirm={() => { if (reason.trim().length >= 3) void run(async () => { await call("/cancel", "POST", { reason }); return `${label} cancelada. As notas voltaram para as notas em aberto.`; }); }}>
        <p>As notas voltam para as notas em aberto e os créditos usados voltam para a conta-corrente.</p>
        <textarea className="ui-input" rows={3} placeholder="Motivo (obrigatório)" value={reason} onChange={(event) => setReason(event.target.value)} />
      </ConfirmationDialog>
      <ConfirmationDialog open={dialog === "delete"} title="Excluir cobrança" confirmLabel="Excluir" onCancel={() => setDialog(null)}
        onConfirm={() => void run(async () => { await call("", "DELETE"); onClose(); return `${label} excluída. As notas voltaram para as notas em aberto.`; })}>
        A cobrança e o histórico dela são apagados de vez. As notas voltam para as notas em aberto.
      </ConfirmationDialog>
    </Drawer>
  );
}

interface OpenCharge { id: string; chargeNumber: string | null; referenceCode: string | null; periodStart: string; periodEnd: string; dueDate: string | null; status: string; openAmountCents: number }

// Um recebimento distribuido entre as cobrancas abertas do cliente, da mais antiga para a mais nova.
export function ReceivePaymentDrawer({ open, organizationId, legalEntityId, clientId, clientName, charges, onClose, onDone }: {
  open: boolean; organizationId: string; legalEntityId: string; clientId: string; clientName: string; charges: OpenCharge[]; onClose: () => void; onDone: (message: string) => void;
}): JSX.Element | null {
  const payable = useMemo(() => charges.filter((charge) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(charge.status) && charge.openAmountCents > 0)
    .sort((left, right) => left.periodStart.localeCompare(right.periodStart)), [charges]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("PIX");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [split, setSplit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setAmount(""); setSplit({}); setError(null); setReference(""); setNotes(""); } }, [open]);
  if (!open) return null;
  const distribute = (value: string): void => {
    setAmount(value);
    let remaining = moneyToCents(value);
    const next: Record<string, string> = {};
    for (const charge of payable) {
      const take = Math.min(remaining, charge.openAmountCents);
      next[charge.id] = take > 0 ? centsToInput(take) : "";
      remaining -= take;
    }
    setSplit(next);
  };
  const totalCents = moneyToCents(amount);
  const allocations = payable.map((charge) => ({ chargeId: charge.id, amountCents: moneyToCents(split[charge.id] ?? "") })).filter((item) => item.amountCents > 0);
  const allocatedCents = allocations.reduce((sum, item) => sum + item.amountCents, 0);
  const save = async (): Promise<void> => {
    setBusy(true); setError(null);
    try {
      await apiJson("/v1/manage/client-payments/batch", json("POST", {
        organizationId, legalEntityId, clientPartnerId: clientId, paymentDate: date, amountCents: totalCents, paymentMethod: method,
        transactionReference: reference, notes, allocations
      }));
      const leftover = totalCents - allocatedCents;
      onDone(`Recebimento de ${formatCurrencyBr(totalCents)} de ${clientName} baixado em ${allocations.length} cobrança(s)${leftover > 0 ? `; sobra de ${formatCurrencyBr(leftover)} fica disponível para baixar depois` : ""}.`);
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível registrar o recebimento."); }
    finally { setBusy(false); }
  };
  return (
    <Drawer open title={`Receber de ${clientName}`} onClose={onClose}>
      <div className="viewer-invoice-editor">
        {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
        <div className="viewer-invoice-editor__grid">
          <label>Valor recebido<input className="ui-input" inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => distribute(event.target.value)} /></label>
          <label>Data<input className="ui-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>Forma<select className="ui-select" value={method} onChange={(event) => setMethod(event.target.value)}>
            {Object.entries(PAYMENT_METHODS).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
          </select></label>
          <label>Referência<input className="ui-input" placeholder="Opcional" value={reference} onChange={(event) => setReference(event.target.value)} /></label>
          <label className="viewer-invoice-editor__wide">Observação<input className="ui-input" placeholder="Opcional" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        </div>
        <small>O valor é distribuído da cobrança mais antiga para a mais nova. Ajuste quanto vai em cada uma; o que sobrar fica disponível para baixar depois.</small>
        {payable.length === 0 ? <Alert tone="info" title="Nada em aberto">Este cliente não tem cobranças emitidas com saldo em aberto no filtro atual.</Alert> : null}
        {payable.map((charge) => (
          <div className="viewer-invoice-editor__line" key={charge.id}>
            <span><strong>{chargeLabel(charge)}</strong><small>{CHARGE_STATUS_LABELS[charge.status] ?? charge.status}{charge.dueDate ? ` · vence ${formatDateBr(charge.dueDate)}` : ""}</small></span>
            <span>Em aberto {formatCurrencyBr(charge.openAmountCents)}</span>
            <span><input className="ui-input" inputMode="decimal" aria-label="Valor a baixar" value={split[charge.id] ?? ""} onChange={(event) => setSplit({ ...split, [charge.id]: event.target.value })} /></span>
          </div>
        ))}
        <dl className="viewer-invoice-editor__facts">
          <div><dt>Distribuído</dt><dd>{formatCurrencyBr(allocatedCents)}</dd></div>
          <div><dt>Sobra</dt><dd>{formatCurrencyBr(Math.max(0, totalCents - allocatedCents))}</dd></div>
        </dl>
        {allocatedCents > totalCents ? <Alert tone="warning" title="Distribuição maior que o recebido">Reduza os valores das cobranças.</Alert> : null}
        <footer className="viewer-invoice-editor__footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} disabled={totalCents <= 0 || allocatedCents > totalCents} onClick={() => void save()}>Registrar recebimento</Button>
        </footer>
      </div>
    </Drawer>
  );
}
