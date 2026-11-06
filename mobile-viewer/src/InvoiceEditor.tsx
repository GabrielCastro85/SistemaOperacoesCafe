import { useEffect, useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { Alert } from "./renderer/design-system/components/Alert";
import { Badge, StatusBadge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { ConfirmationDialog } from "./renderer/design-system/components/ConfirmationDialog";
import { Drawer } from "./renderer/design-system/components/Drawer";
import { LoadingState } from "./renderer/design-system/components/LoadingState";

// Lancamento, edicao, confirmacao, cancelamento, exclusao e troca de tarifa de
// notas pelo site. As regras ficam no servidor (server/src/invoiceManagement.ts);
// esta tela so coleta os dados e mostra as mensagens de bloqueio.

interface PartnerOption {
  id: string;
  display_name: string;
  roles: Array<{ role: string }>;
  legal_entities: Array<{ id: string; legal_name: string; cnpj: string | null }>;
}
interface ProductOption { id: string; name: string; code: string | null }
interface OwnEntity { id: string; organizationId: string; tradeName: string }

interface InvoiceDetail {
  document: {
    id: string; organizationId: string; ownLegalEntityId: string; ownLegalEntityName: string; direction: string;
    responsiblePartnerId: string; responsiblePartnerName: string | null; partnerLegalEntityId: string | null; partnerLegalEntityName: string | null;
    documentNumber: string; series: string | null; issueDate: string; accessKey: string | null; totalAmountCents: number; status: string;
    source: string; hasPendingIssues: boolean; pendingNotes: string | null; duplicateWarning: string | null; notes: string | null;
    contractNumber: string | null; billingObservations: string | null; hasFinancialService: boolean; cancelReason: string | null;
  };
  items: Array<{ id: string; productName: string | null; description: string; quantity: string; unit: string; totalAmountCents: number; sacks: string | null }>;
  operations: Array<{
    id: string; operationType: string; operationScope: string; status: string; productName: string | null; responsiblePartnerName: string | null;
    quantitySacks: string; rateCents: number; amountCents: number; manualRate: boolean; manualReason: string | null; billingStatus: string; settlementStatus: string;
  }>;
  permissions: { canEdit: boolean; canConfirm: boolean; canCancel: boolean; canDelete: boolean; lockedReason: string | null };
}

const UNIT_LABELS: Record<string, string> = { SACK: "sacas", KG: "kg", TON: "t", UNIT: "unid." };
const BILLING_LABELS: Record<string, string> = { UNBILLED: "Não cobrada", RESERVED: "Reservada", BILLED: "Cobrada" };

export function moneyToCents(value: string): number {
  const normalized = value.trim().replace(/[R$\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : NaN;
}

function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSacks(value: string | null): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

const jsonInit = (method: string, body: unknown = {}): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
});

function useCommercialOptions(organizationId: string, legalEntityId: string | undefined, enabled: boolean) {
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [entities, setEntities] = useState<OwnEntity[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !organizationId) return;
    void Promise.all([
      apiJson<PartnerOption[]>(`/v1/viewer/partners?${queryString({ organizationId, legalEntityId })}`),
      apiJson<ProductOption[]>(`/v1/viewer/products?${queryString({ organizationId, legalEntityId })}`),
      apiJson<{ legalEntities: OwnEntity[] }>("/v1/viewer/context")
    ]).then(([partnerRows, productRows, context]) => {
      setPartners(partnerRows);
      setProducts(productRows);
      setEntities(context.legalEntities.filter((entity) => entity.organizationId === organizationId));
    }).catch((value) => setError(value instanceof Error ? value.message : "Falha ao carregar os cadastros."));
  }, [enabled, organizationId, legalEntityId]);
  return { partners, products, entities, error };
}

function partnersForRole(partners: PartnerOption[], role: "CLIENT" | "SUPPLIER"): PartnerOption[] {
  return partners.filter((partner) => partner.roles.some((item) => item.role === role));
}

interface ItemDraft { productId: string; quantity: string; unit: "SACK" | "KG" | "TON" | "UNIT"; amount: string; sacks: string }
const emptyItem = (): ItemDraft => ({ productId: "", quantity: "", unit: "SACK", amount: "", sacks: "" });

export function ManualInvoiceDrawer({ open, organizationId, legalEntityId, onClose, onSaved }: {
  open: boolean; organizationId: string; legalEntityId?: string; onClose: () => void; onSaved: (message: string) => void;
}): JSX.Element | null {
  const options = useCommercialOptions(organizationId, legalEntityId, open);
  const [ownLegalEntityId, setOwnLegalEntityId] = useState(legalEntityId ?? "");
  const [operationType, setOperationType] = useState<"SALE" | "PURCHASE">("SALE");
  const [responsiblePartnerId, setResponsiblePartnerId] = useState("");
  const [partnerLegalEntityId, setPartnerLegalEntityId] = useState("");
  const [operationScope, setOperationScope] = useState<"INTERNAL" | "EXTERNAL">("INTERNAL");
  const [documentNumber, setDocumentNumber] = useState("");
  const [series, setSeries] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [accessKey, setAccessKey] = useState("");
  const [total, setTotal] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [hasFinancialService, setHasFinancialService] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOwnLegalEntityId(legalEntityId ?? ""); setOperationType("SALE"); setResponsiblePartnerId(""); setPartnerLegalEntityId("");
    setOperationScope("INTERNAL"); setDocumentNumber(""); setSeries(""); setIssueDate(new Date().toISOString().slice(0, 10)); setAccessKey("");
    setTotal(""); setContractNumber(""); setNotes(""); setHasFinancialService(false); setConfirm(false); setItems([emptyItem()]); setError(null);
  }, [open, legalEntityId]);

  const responsibleOptions = partnersForRole(options.partners, operationType === "SALE" ? "CLIENT" : "SUPPLIER");
  const counterpartyOptions = useMemo(() => options.partners.flatMap((partner) => partner.legal_entities.map((entity) => ({
    id: entity.id, label: `${entity.legal_name}${entity.cnpj ? ` · ${entity.cnpj}` : ""}`
  }))).sort((left, right) => left.label.localeCompare(right.label, "pt-BR")), [options.partners]);

  const updateItem = (index: number, patch: Partial<ItemDraft>): void => setItems((current) => current.map((item, position) => position === index ? { ...item, ...patch } : item));
  const totalCents = moneyToCents(total);
  const itemsValid = items.every((item) => item.productId && Number(item.quantity.replace(",", ".")) > 0 && (item.unit !== "UNIT" || item.sacks) && !Number.isNaN(moneyToCents(item.amount || "0")));
  const canSave = Boolean(ownLegalEntityId && responsiblePartnerId && documentNumber.trim() && issueDate && !Number.isNaN(totalCents) && itemsValid)
    && (!accessKey || /^\d{44}$/.test(accessKey.replace(/\D/g, "")));

  const save = async (): Promise<void> => {
    setBusy(true); setError(null);
    try {
      const result = await apiJson<{ status: string; pendingNotes: string | null; duplicateWarning: string | null }>("/v1/manage/invoices", jsonInit("POST", {
        organizationId, ownLegalEntityId, operationType, operationScope, responsiblePartnerId, partnerLegalEntityId: partnerLegalEntityId || null,
        documentNumber: documentNumber.trim(), series: series.trim() || null, issueDate, accessKey: accessKey.replace(/\D/g, "") || null,
        totalAmountCents: totalCents, hasFinancialService: operationType === "SALE" && hasFinancialService, contractNumber: contractNumber.trim() || null,
        notes: notes.trim() || null, confirm,
        items: items.map((item) => ({
          productId: item.productId, quantity: item.quantity.replace(",", "."), unit: item.unit,
          totalAmountCents: moneyToCents(item.amount || "0"), sacks: item.sacks ? item.sacks.replace(",", ".") : null
        }))
      }));
      const label = `NF ${documentNumber.trim()}`;
      onSaved(result.status === "CONFIRMED" ? `${label} lançada e confirmada.`
        : result.status === "PENDING" ? `${label} lançada com pendência: ${result.pendingNotes ?? "revise a nota"}.`
        : `${label} lançada como rascunho.${result.duplicateWarning ? " Atenção: possível duplicidade com outra nota." : ""}`);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Não foi possível lançar a nota.");
    } finally { setBusy(false); }
  };

  return (
    <Drawer open={open} title="Lançar nota manualmente" onClose={onClose}>
      <div className="viewer-invoice-editor">
        {options.error ? <Alert tone="danger" title="Cadastros indisponíveis">{options.error}</Alert> : null}
        {error ? <Alert tone="danger" title="Não foi possível lançar">{error}</Alert> : null}
        <div className="viewer-invoice-editor__grid">
          <label>Empresa própria
            <select className="ui-select" value={ownLegalEntityId} onChange={(event) => setOwnLegalEntityId(event.target.value)}>
              <option value="">Selecione</option>{options.entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.tradeName}</option>)}
            </select>
          </label>
          <label>Tipo
            <select className="ui-select" value={operationType} onChange={(event) => { setOperationType(event.target.value as "SALE" | "PURCHASE"); setResponsiblePartnerId(""); }}>
              <option value="SALE">Saída / venda</option><option value="PURCHASE">Entrada / compra</option>
            </select>
          </label>
          <label>{operationType === "SALE" ? "Cliente / corretor" : "Fornecedor"}
            <select className="ui-select" value={responsiblePartnerId} onChange={(event) => setResponsiblePartnerId(event.target.value)}>
              <option value="">Selecione</option>{responsibleOptions.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name}</option>)}
            </select>
          </label>
          <label>Empresa da contraparte (opcional)
            <select className="ui-select" value={partnerLegalEntityId} onChange={(event) => setPartnerLegalEntityId(event.target.value)}>
              <option value="">Não informada</option>{counterpartyOptions.map((entity) => <option key={entity.id} value={entity.id}>{entity.label}</option>)}
            </select>
          </label>
          <label>Número<input className="ui-input" value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} /></label>
          <label>Série<input className="ui-input" value={series} onChange={(event) => setSeries(event.target.value)} /></label>
          <label>Emissão<input className="ui-input" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label>
          <label>Valor total da nota (R$)<input className="ui-input" inputMode="decimal" placeholder="0,00" value={total} onChange={(event) => setTotal(event.target.value)} /></label>
          <label>Escopo
            <select className="ui-select" value={operationScope} onChange={(event) => setOperationScope(event.target.value as "INTERNAL" | "EXTERNAL")}>
              <option value="INTERNAL">Mesma UF</option><option value="EXTERNAL">Outra UF</option>
            </select>
          </label>
          <label>Contrato<input className="ui-input" value={contractNumber} onChange={(event) => setContractNumber(event.target.value)} /></label>
          <label className="viewer-invoice-editor__wide">Chave de acesso (opcional)<input className="ui-input" inputMode="numeric" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} /></label>
          <label className="viewer-invoice-editor__wide">Observações<textarea className="ui-input" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        </div>
        <div className="viewer-invoice-editor__items">
          <strong>Itens</strong>
          {items.map((item, index) => (
            <div className="viewer-invoice-editor__item" key={index}>
              <select className="ui-select" value={item.productId} onChange={(event) => updateItem(index, { productId: event.target.value })}>
                <option value="">Produto</option>{options.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
              <input className="ui-input" inputMode="decimal" placeholder="Quantidade" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} />
              <select className="ui-select" value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value as ItemDraft["unit"] })}>
                <option value="SACK">Sacas</option><option value="KG">Kg</option><option value="TON">Toneladas</option><option value="UNIT">Unidades</option>
              </select>
              <input className="ui-input" inputMode="decimal" placeholder="Valor (R$)" value={item.amount} onChange={(event) => updateItem(index, { amount: event.target.value })} />
              {item.unit === "UNIT" ? <input className="ui-input" inputMode="decimal" placeholder="Sacas" value={item.sacks} onChange={(event) => updateItem(index, { sacks: event.target.value })} /> : null}
              {items.length > 1 ? <Button variant="ghost" onClick={() => setItems((current) => current.filter((_, position) => position !== index))}>Remover</Button> : null}
            </div>
          ))}
          <Button variant="ghost" onClick={() => setItems((current) => [...current, emptyItem()])}>Adicionar item</Button>
        </div>
        <div className="viewer-xml-importer__options">
          {operationType === "SALE" ? <label><input type="checkbox" checked={hasFinancialService} onChange={(event) => setHasFinancialService(event.target.checked)} /> Esta nota possui financeiro</label> : null}
          <label><input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} /> Confirmar a nota agora</label>
        </div>
        <footer className="viewer-invoice-editor__footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} disabled={!canSave} onClick={() => void save()}>Lançar nota</Button>
        </footer>
      </div>
    </Drawer>
  );
}

type PendingAction = { kind: "confirm" } | { kind: "cancel" } | { kind: "delete" } | null;

export function InvoiceDetailDrawer({ invoiceId, organizationId, legalEntityId, onClose, onChanged }: {
  invoiceId: string | null; organizationId: string; legalEntityId?: string; onClose: () => void; onChanged: (message: string) => void;
}): JSX.Element | null {
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rateEditing, setRateEditing] = useState<{ id: string; value: string; reason: string } | null>(null);
  const options = useCommercialOptions(organizationId, legalEntityId, editing);
  const [form, setForm] = useState({
    responsiblePartnerId: "", documentNumber: "", series: "", issueDate: "", accessKey: "", total: "",
    contractNumber: "", notes: "", hasFinancialService: false, resolvePendingIssues: false
  });

  const load = async (id: string): Promise<void> => {
    setError(null);
    try { setDetail(await apiJson<InvoiceDetail>(`/v1/manage/invoices/${encodeURIComponent(id)}`)); }
    catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar a nota."); }
  };

  useEffect(() => {
    setDetail(null); setEditing(false); setPendingAction(null); setRateEditing(null); setCancelReason("");
    if (invoiceId) void load(invoiceId);
  }, [invoiceId]);

  const startEdit = (): void => {
    if (!detail) return;
    const document = detail.document;
    setForm({
      responsiblePartnerId: document.responsiblePartnerId, documentNumber: document.documentNumber, series: document.series ?? "",
      issueDate: document.issueDate, accessKey: document.accessKey ?? "", total: centsToInput(document.totalAmountCents),
      contractNumber: document.contractNumber ?? "", notes: document.notes ?? "", hasFinancialService: document.hasFinancialService, resolvePendingIssues: false
    });
    setEditing(true); setError(null);
  };

  const run = async (action: () => Promise<string>): Promise<void> => {
    if (!invoiceId) return;
    setBusy(true); setError(null);
    try {
      const message = await action();
      onChanged(message);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Não foi possível concluir.");
    } finally { setBusy(false); setPendingAction(null); }
  };

  const reload = async (message: string): Promise<string> => {
    if (invoiceId) await load(invoiceId);
    return message;
  };

  if (!invoiceId) return null;
  const document = detail?.document;
  const label = document ? `NF ${document.documentNumber}${document.series ? `/${document.series}` : ""}` : "Nota fiscal";
  const isSale = document?.direction !== "INBOUND";
  const responsibleOptions = partnersForRole(options.partners, isSale ? "CLIENT" : "SUPPLIER");
  const formTotal = moneyToCents(form.total);

  return (
    <Drawer open title={label} onClose={onClose}>
      <div className="viewer-invoice-editor">
        {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
        {!detail && !error ? <LoadingState label="Carregando nota..." /> : null}
        {detail && document ? (
          <>
            <div className="viewer-invoice-editor__status">
              <StatusBadge status={document.status} />
              <Badge tone={isSale ? "success" : "info"}>{isSale ? "Saída / venda" : "Entrada / compra"}</Badge>
              {document.hasPendingIssues ? <Badge tone="warning">Pendência</Badge> : null}
              {document.hasFinancialService ? <Badge tone="neutral">Com financeiro</Badge> : null}
            </div>
            {document.pendingNotes ? <Alert tone="warning" title="Pendência">{document.pendingNotes}</Alert> : null}
            {document.duplicateWarning ? <Alert tone="warning" title="Possível duplicidade">{document.duplicateWarning}</Alert> : null}
            {document.cancelReason ? <Alert tone="neutral" title="Motivo do cancelamento">{document.cancelReason}</Alert> : null}
            {detail.permissions.lockedReason ? <Alert tone="info" title="Alterações bloqueadas">{detail.permissions.lockedReason}</Alert> : null}

            {!editing ? (
              <dl className="viewer-invoice-editor__facts">
                <div><dt>Empresa própria</dt><dd>{document.ownLegalEntityName}</dd></div>
                <div><dt>{isSale ? "Cliente / corretor" : "Fornecedor"}</dt><dd>{document.responsiblePartnerName ?? "Não informado"}</dd></div>
                <div><dt>Contraparte</dt><dd>{document.partnerLegalEntityName ?? "Não informada"}</dd></div>
                <div><dt>Emissão</dt><dd>{formatDateBr(document.issueDate)}</dd></div>
                <div><dt>Valor da nota</dt><dd>{formatCurrencyBr(document.totalAmountCents)}</dd></div>
                <div><dt>Contrato</dt><dd>{document.contractNumber ?? "—"}</dd></div>
                <div className="viewer-invoice-editor__wide"><dt>Chave de acesso</dt><dd>{document.accessKey ?? "—"}</dd></div>
                {document.notes ? <div className="viewer-invoice-editor__wide"><dt>Observações</dt><dd>{document.notes}</dd></div> : null}
              </dl>
            ) : (
              <div className="viewer-invoice-editor__grid">
                <label>{isSale ? "Cliente / corretor" : "Fornecedor"}
                  <select className="ui-select" value={form.responsiblePartnerId} onChange={(event) => setForm({ ...form, responsiblePartnerId: event.target.value })}>
                    {responsibleOptions.some((partner) => partner.id === document.responsiblePartnerId) ? null
                      : <option value={document.responsiblePartnerId}>{document.responsiblePartnerName ?? "Atual"}</option>}
                    {responsibleOptions.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name}</option>)}
                  </select>
                </label>
                <label>Número<input className="ui-input" value={form.documentNumber} onChange={(event) => setForm({ ...form, documentNumber: event.target.value })} /></label>
                <label>Série<input className="ui-input" value={form.series} onChange={(event) => setForm({ ...form, series: event.target.value })} /></label>
                <label>Emissão<input className="ui-input" type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></label>
                <label>Valor da nota (R$)<input className="ui-input" inputMode="decimal" value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} /></label>
                <label>Contrato<input className="ui-input" value={form.contractNumber} onChange={(event) => setForm({ ...form, contractNumber: event.target.value })} /></label>
                <label className="viewer-invoice-editor__wide">Chave de acesso<input className="ui-input" inputMode="numeric" value={form.accessKey} onChange={(event) => setForm({ ...form, accessKey: event.target.value })} /></label>
                <label className="viewer-invoice-editor__wide">Observações<textarea className="ui-input" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
                <div className="viewer-xml-importer__options viewer-invoice-editor__wide">
                  {isSale ? <label><input type="checkbox" checked={form.hasFinancialService} onChange={(event) => setForm({ ...form, hasFinancialService: event.target.checked })} /> Esta nota possui financeiro</label> : null}
                  {document.hasPendingIssues ? <label><input type="checkbox" checked={form.resolvePendingIssues} onChange={(event) => setForm({ ...form, resolvePendingIssues: event.target.checked })} /> Pendências conferidas e resolvidas</label> : null}
                </div>
                <small className="viewer-invoice-editor__wide">Trocar o cliente recalcula a tarifa das operações. Faça a troca separadamente da data. Mudar o financeiro volta a nota para rascunho.</small>
                <footer className="viewer-invoice-editor__footer viewer-invoice-editor__wide">
                  <Button onClick={() => setEditing(false)}>Descartar</Button>
                  <Button variant="primary" loading={busy} disabled={!form.documentNumber.trim() || !form.issueDate || Number.isNaN(formTotal)} onClick={() => void run(async () => {
                    const result = await apiJson<{ reopened: boolean }>(`/v1/manage/invoices/${encodeURIComponent(invoiceId)}`, jsonInit("PUT", {
                      responsiblePartnerId: form.responsiblePartnerId, documentNumber: form.documentNumber.trim(), series: form.series.trim() || null,
                      issueDate: form.issueDate, accessKey: form.accessKey.replace(/\D/g, "") || null, totalAmountCents: formTotal,
                      hasFinancialService: isSale && form.hasFinancialService, contractNumber: form.contractNumber.trim() || null,
                      notes: form.notes.trim() || null, resolvePendingIssues: form.resolvePendingIssues
                    }));
                    setEditing(false);
                    return reload(result.reopened ? `${label} alterada e devolvida para rascunho. Confirme novamente.` : `${label} alterada.`);
                  })}>Salvar alterações</Button>
                </footer>
              </div>
            )}

            <div className="viewer-invoice-editor__section">
              <strong>Itens</strong>
              {detail.items.map((item) => (
                <div className="viewer-invoice-editor__line" key={item.id}>
                  <span><strong>{item.productName ?? item.description}</strong><small>{item.description}</small></span>
                  <span>{Number(item.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {UNIT_LABELS[item.unit] ?? item.unit}<small>{formatSacks(item.sacks)} sacas</small></span>
                  <span>{formatCurrencyBr(item.totalAmountCents)}</span>
                </div>
              ))}
            </div>

            <div className="viewer-invoice-editor__section">
              <strong>Operações e tarifas</strong>
              {detail.operations.map((operation) => (
                <div className="viewer-invoice-editor__line" key={operation.id}>
                  <span><strong>{operation.responsiblePartnerName ?? "—"}</strong><small>{operation.productName ?? "Produto"} · {operation.operationScope === "EXTERNAL" ? "Outra UF" : "Mesma UF"} · {BILLING_LABELS[operation.billingStatus] ?? operation.billingStatus}</small></span>
                  <span>{formatSacks(operation.quantitySacks)} sacas × {formatCurrencyBr(operation.rateCents)}<small>{operation.manualRate ? `Manual: ${operation.manualReason ?? ""}` : "Pela regra"}</small></span>
                  <span>{formatCurrencyBr(operation.amountCents)}
                    {detail.permissions.canEdit && operation.status !== "CANCELED" ? (
                      <Button variant="ghost" onClick={() => setRateEditing({ id: operation.id, value: centsToInput(operation.rateCents), reason: "" })}>Alterar tarifa</Button>
                    ) : null}
                  </span>
                  {rateEditing?.id === operation.id ? (
                    <div className="viewer-invoice-editor__rate">
                      <input className="ui-input" inputMode="decimal" aria-label="Valor por saca" value={rateEditing.value} onChange={(event) => setRateEditing({ ...rateEditing, value: event.target.value })} />
                      <input className="ui-input" placeholder="Motivo da alteração" value={rateEditing.reason} onChange={(event) => setRateEditing({ ...rateEditing, reason: event.target.value })} />
                      <Button onClick={() => setRateEditing(null)}>Cancelar</Button>
                      <Button variant="primary" loading={busy} disabled={rateEditing.reason.trim().length < 3 || Number.isNaN(moneyToCents(rateEditing.value))} onClick={() => void run(async () => {
                        await apiJson(`/v1/manage/operations/${encodeURIComponent(operation.id)}/rate`, jsonInit("PUT", {
                          manualRateValueCents: moneyToCents(rateEditing.value), reason: rateEditing.reason.trim()
                        }));
                        setRateEditing(null);
                        return reload(`Tarifa da ${label} alterada.`);
                      })}>Salvar tarifa</Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {!editing ? (
              <footer className="viewer-invoice-editor__footer">
                {detail.permissions.canEdit ? <Button onClick={startEdit}>Editar</Button> : null}
                {detail.permissions.canConfirm ? <Button variant="primary" onClick={() => setPendingAction({ kind: "confirm" })}>Confirmar nota</Button> : null}
                {detail.permissions.canCancel ? <Button onClick={() => setPendingAction({ kind: "cancel" })}>Cancelar nota</Button> : null}
                {detail.permissions.canDelete ? <Button variant="danger" onClick={() => setPendingAction({ kind: "delete" })}>Excluir</Button> : null}
              </footer>
            ) : null}
          </>
        ) : null}
      </div>
      <ConfirmationDialog open={pendingAction?.kind === "confirm"} title={`Confirmar ${label}?`} confirmLabel="Confirmar"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void run(async () => {
          await apiJson(`/v1/manage/invoices/${encodeURIComponent(invoiceId)}/confirm`, jsonInit("POST"));
          return reload(`${label} confirmada.`);
        })}>
        As operações passam a contar nos totais e ficam disponíveis para cobrança.
      </ConfirmationDialog>
      <ConfirmationDialog open={pendingAction?.kind === "cancel"} title={`Cancelar ${label}?`} confirmLabel={busy ? "Cancelando..." : "Cancelar nota"}
        onCancel={() => { setPendingAction(null); setCancelReason(""); }}
        onConfirm={() => {
          if (cancelReason.trim().length < 3) { setError("Informe o motivo do cancelamento."); setPendingAction(null); return; }
          void run(async () => {
            await apiJson(`/v1/manage/invoices/${encodeURIComponent(invoiceId)}/cancel`, jsonInit("POST", { reason: cancelReason.trim() }));
            setCancelReason("");
            return reload(`${label} cancelada.`);
          });
        }}>
        <label className="ui-field">Motivo do cancelamento
          <textarea className="ui-input" rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
        </label>
      </ConfirmationDialog>
      <ConfirmationDialog open={pendingAction?.kind === "delete"} title={`Excluir ${label}?`} confirmLabel="Excluir definitivamente"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void run(async () => {
          await apiJson(`/v1/manage/invoices/${encodeURIComponent(invoiceId)}`, jsonInit("DELETE"));
          onClose();
          return `${label} excluída.`;
        })}>
        A nota, os itens e as operações são removidos de todos os computadores. Se ela já foi cobrada ou entrou em conferência, cancele em vez de excluir.
      </ConfirmationDialog>
    </Drawer>
  );
}
