import { useEffect, useState } from "react";
import { apiJson, downloadConfirmationPdf, queryString } from "./api";
import { formatCurrencyBr, formatDateBr } from "./viewerFormat";
import { Alert } from "./renderer/design-system/components/Alert";
import { Badge, StatusBadge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { ConfirmationDialog } from "./renderer/design-system/components/ConfirmationDialog";
import { Drawer } from "./renderer/design-system/components/Drawer";
import { LoadingState } from "./renderer/design-system/components/LoadingState";

// Criacao e manutencao de confirmacoes pelo site. As regras ficam no servidor
// (server/src/confirmationManagement.ts), que repete o AppRepository.

interface Party { id: string; partyRole: string; snapshotJson: string; representativeName: string | null }
type PartySnapshot = { name?: string; taxId?: string | null; city?: string | null; state?: string | null };
const partySnapshot = (party: Party): PartySnapshot => { try { return JSON.parse(party.snapshotJson) as PartySnapshot; } catch { return {}; } };
interface Item {
  id: string; sortOrder: number; productId: string | null; productNameSnapshot: string; productDescriptionSnapshot: string | null;
  quantitySacksDecimal: string; sackWeightKgDecimal: string; unitPriceDecimal: string; totalAmountCents: number;
  totalWasManuallyOverridden: boolean; totalOverrideReason: string | null; notes: string | null;
}
interface Clause { id: string; clauseNumber: string | null; title: string | null; clauseText: string; sortOrder: number; isVisible: boolean }
interface PaymentTerm { id: string; description: string; percentageBasisPoints: number | null; amountCents: number | null; dueDate: string | null }
interface Signer { id: string; partyRole: string; name: string; documentNumber: string | null; positionTitle: string | null; email: string | null; phone: string | null; signatureOrder: number; signatureStatus: string; notes: string | null }
interface Detail {
  confirmation: {
    id: string; organizationId: string; ownLegalEntityId: string; confirmationNumber: string | null; temporaryReference: string; confirmationDate: string;
    negotiationDate: string | null; status: string; signatureStatus: string; totalQuantitySacksDecimal: string; totalCommercialAmountCents: number;
    deliveryLocationSnapshot: string | null; deliveryStartDate: string | null; deliveryEndDate: string | null; paymentTermsSnapshot: string | null;
    qualityTermsSnapshot: string | null; generalTermsSnapshot: string | null; publicNotes: string | null; internalNotes: string | null;
    brokeragePercentageBasisPoints: number | null; bankName: string | null; bankAgency: string | null; bankAccount: string | null; pixKey: string | null;
    cancellationReason: string | null;
  };
  parties: Party[]; items: Item[]; clauses: Clause[]; paymentTerms: PaymentTerm[]; signers: Signer[];
  fiscalDocuments: Array<{ id: string; documentNumber: string; issueDate: string }>;
  pendingIssues: Array<{ code: string; severity: "critical" | "warning"; message: string }>;
  permissions: { editable: boolean; canIssue: boolean; canDelete: boolean; canMarkSent: boolean; canSign: boolean; canCancel: boolean; canReplace: boolean };
}
interface Options {
  clauseTemplates: Array<{ id: string; name: string; title: string | null; clauseText: string }>;
  companies: Array<{ id: string; businessPartnerId: string | null; legalName: string; cnpj: string | null }>;
}

const ROLE_LABELS: Record<string, string> = { ISSUER: "Emissora", BROKER: "Corretor", SELLER: "Vendedor", BUYER: "Comprador", DELIVERY_RECIPIENT: "Recebedor", OTHER: "Outro", WITNESS: "Testemunha" };
const SIGNER_STATUS: Record<string, string> = { PENDING: "Pendente", SIGNED_EXTERNALLY: "Assinou", REJECTED: "Recusou", NOT_REQUIRED: "Não precisa" };
const json = (method: string, body: unknown = {}): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const base = (id: string) => `/v1/manage/confirmations/${encodeURIComponent(id)}`;
const decimalInput = (value: string): string => value.trim().replace(/\./g, "").replace(",", ".");
const moneyCents = (value: string): number => Math.round(Number(decimalInput(value.replace(/[R$\s]/g, ""))) * 100);
const decimalLabel = (value: string | number): string => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 6 });

export function NewConfirmationDrawer({ open, organizationId, legalEntityId, onClose, onCreated }: {
  open: boolean; organizationId: string; legalEntityId?: string; onClose: () => void; onCreated: (id: string) => void;
}): JSX.Element | null {
  const [entities, setEntities] = useState<Array<{ id: string; organizationId: string; tradeName: string }>>([]);
  const [ownLegalEntityId, setOwnLegalEntityId] = useState(legalEntityId ?? "");
  const [periodStart, setPeriodStart] = useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [invoices, setInvoices] = useState<Array<{ id: string; documentNumber: string; issueDate: string; counterpartyName: string; sacks: number; totalAmountCents: number; status: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setSelected([]); setError(null); setOwnLegalEntityId(legalEntityId ?? "");
    void apiJson<{ legalEntities: Array<{ id: string; organizationId: string; tradeName: string }> }>("/v1/viewer/context")
      .then((context) => setEntities(context.legalEntities.filter((entity) => entity.organizationId === organizationId))).catch(() => undefined);
  }, [open, organizationId, legalEntityId]);
  useEffect(() => {
    if (!open || !ownLegalEntityId) return;
    void apiJson<typeof invoices>(`/v1/viewer/invoices?${queryString({ organizationId, legalEntityId: ownLegalEntityId, periodStart, periodEnd, direction: "ALL", status: "ACTIVE" })}`)
      .then(setInvoices).catch((value) => setError(value instanceof Error ? value.message : "Falha ao carregar as notas."));
  }, [open, organizationId, ownLegalEntityId, periodStart, periodEnd]);
  const create = async (): Promise<void> => {
    setBusy(true); setError(null);
    try {
      const result = await apiJson<{ id: string }>("/v1/manage/confirmations", json("POST", { organizationId, ownLegalEntityId, fiscalDocumentIds: selected }));
      onCreated(result.id);
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível criar a confirmação."); }
    finally { setBusy(false); }
  };
  return (
    <Drawer open={open} title="Nova confirmação" onClose={onClose}>
      <div className="viewer-invoice-editor">
        {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
        <div className="viewer-invoice-editor__grid">
          <label>Empresa própria (emissora)
            <select className="ui-select" value={ownLegalEntityId} onChange={(event) => { setOwnLegalEntityId(event.target.value); setSelected([]); }}>
              <option value="">Selecione</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.tradeName}</option>)}
            </select>
          </label>
          <span />
          <label>Notas de<input className="ui-input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>até<input className="ui-input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        </div>
        <small>Marque as notas do negócio: os itens, sacas e valores oficiais entram na confirmação. Sem notas, a confirmação começa em branco.</small>
        <div className="viewer-spreadsheet-rows">
          {invoices.map((invoice) => (
            <label className="viewer-invoice-editor__line viewer-confirmation-pick" key={invoice.id}>
              <span><strong><input type="checkbox" checked={selected.includes(invoice.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, invoice.id] : current.filter((id) => id !== invoice.id))} /> NF {invoice.documentNumber}</strong><small>{invoice.counterpartyName}</small></span>
              <span>{decimalLabel(invoice.sacks)} sacas<small>{formatDateBr(invoice.issueDate)}</small></span>
              <span>{formatCurrencyBr(invoice.totalAmountCents)}</span>
            </label>
          ))}
          {ownLegalEntityId && invoices.length === 0 ? <small>Nenhuma nota ativa no período.</small> : null}
        </div>
        <footer className="viewer-invoice-editor__footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} disabled={!ownLegalEntityId} onClick={() => void create()}>{selected.length ? `Criar com ${selected.length} nota(s)` : "Criar em branco"}</Button>
        </footer>
      </div>
    </Drawer>
  );
}

type Dialog = { kind: "issue" } | { kind: "cancel" } | { kind: "replace" } | { kind: "delete" } | null;

export function ConfirmationDrawer({ confirmationId, organizationId, legalEntityId, onClose, onChanged, onOpen }: {
  confirmationId: string | null; organizationId: string; legalEntityId?: string; onClose: () => void; onChanged: (message: string) => void; onOpen: (id: string) => void;
}): JSX.Element | null {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [partners, setPartners] = useState<Array<{ id: string; display_name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [editingHeader, setEditingHeader] = useState(false);
  const [header, setHeader] = useState<Record<string, string>>({});
  const [party, setParty] = useState({ role: "BUYER", source: "company", ref: "", manualName: "", representative: "" });
  const [clause, setClause] = useState({ templateId: "", title: "", text: "" });
  const [term, setTerm] = useState({ description: "", percent: "", amount: "", dueDate: "" });
  const [signer, setSigner] = useState({ role: "BUYER", name: "", document: "", email: "" });
  const [itemEdit, setItemEdit] = useState<{ id: string | null; name: string; quantity: string; weight: string; price: string; total: string; reason: string } | null>(null);

  const load = async (id: string): Promise<void> => {
    setError(null);
    try { setDetail(await apiJson<Detail>(base(id))); } catch (value) { setError(value instanceof Error ? value.message : "Falha ao carregar a confirmação."); }
  };
  useEffect(() => {
    setDetail(null); setEditingHeader(false); setItemEdit(null); setDialog(null);
    if (!confirmationId) return;
    void load(confirmationId);
    void apiJson<Options>(`/v1/manage/confirmation-options?${queryString({ organizationId })}`).then(setOptions).catch(() => undefined);
    void apiJson<Array<{ id: string; display_name: string }>>(`/v1/viewer/partners?${queryString({ organizationId, legalEntityId })}`).then(setPartners).catch(() => undefined);
  }, [confirmationId, organizationId, legalEntityId]);

  if (!confirmationId) return null;
  const run = async (action: () => Promise<string | void>): Promise<void> => {
    setBusy(true); setError(null);
    try {
      const message = await action();
      await load(confirmationId);
      if (message) onChanged(message);
    } catch (value) { setError(value instanceof Error ? value.message : "Não foi possível concluir."); }
    finally { setBusy(false); setDialog(null); setReason(""); }
  };
  const call = (path: string, method = "POST", body: unknown = {}) => apiJson<Record<string, unknown>>(`${base(confirmationId)}${path}`, json(method, body));
  const c = detail?.confirmation;
  const label = c ? c.confirmationNumber ?? c.temporaryReference : "Confirmação";
  const editable = detail?.permissions.editable ?? false;

  const startHeader = (): void => {
    if (!c) return;
    setHeader({
      confirmationDate: c.confirmationDate, negotiationDate: c.negotiationDate ?? "", deliveryLocationSnapshot: c.deliveryLocationSnapshot ?? "",
      deliveryStartDate: c.deliveryStartDate ?? "", deliveryEndDate: c.deliveryEndDate ?? "", paymentTermsSnapshot: c.paymentTermsSnapshot ?? "",
      qualityTermsSnapshot: c.qualityTermsSnapshot ?? "", generalTermsSnapshot: c.generalTermsSnapshot ?? "", publicNotes: c.publicNotes ?? "",
      internalNotes: c.internalNotes ?? "", brokerage: c.brokeragePercentageBasisPoints === null ? "" : String(c.brokeragePercentageBasisPoints / 100).replace(".", ","),
      bankName: c.bankName ?? "", bankAgency: c.bankAgency ?? "", bankAccount: c.bankAccount ?? "", pixKey: c.pixKey ?? ""
    });
    setEditingHeader(true);
  };
  const nullable = (value: string | undefined): string | null => value?.trim() ? value.trim() : null;
  const itemBody = (source: { name: string; quantity: string; weight: string; price: string; total: string; reason: string }, current?: Item) => ({
    sortOrder: current?.sortOrder ?? (detail?.items.length ?? 0), productId: current?.productId ?? null, productNameSnapshot: source.name.trim(),
    productDescriptionSnapshot: current?.productDescriptionSnapshot ?? null, cropSnapshot: null, qualitySnapshot: null, packagingSnapshot: null,
    originSnapshot: null, destinationSnapshot: null, quantitySacksDecimal: decimalInput(source.quantity), sackWeightKgDecimal: decimalInput(source.weight),
    unitPriceDecimal: decimalInput(source.price || "0"), totalAmountCents: source.total.trim() ? moneyCents(source.total) : null,
    totalOverrideReason: nullable(source.reason), deliveryStartDate: null, deliveryEndDate: null, deliveryLocationSnapshot: null, notes: current?.notes ?? null
  });

  return (
    <Drawer open title={label} onClose={onClose}>
      <div className="viewer-invoice-editor">
        {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
        {!detail && !error ? <LoadingState label="Carregando confirmação..." /> : null}
        {detail && c ? (
          <>
            <div className="viewer-invoice-editor__status">
              <StatusBadge status={c.status} /><Badge tone="neutral">Assinatura: {c.signatureStatus.replaceAll("_", " ").toLowerCase()}</Badge>
              <Badge tone="info">{decimalLabel(c.totalQuantitySacksDecimal)} sacas · {formatCurrencyBr(c.totalCommercialAmountCents)}</Badge>
            </div>
            {c.cancellationReason ? <Alert tone="neutral" title="Motivo do cancelamento">{c.cancellationReason}</Alert> : null}
            {editable && detail.pendingIssues.length ? (
              <Alert tone={detail.pendingIssues.some((issue) => issue.severity === "critical") ? "danger" : "warning"} title="Antes de emitir">
                {detail.pendingIssues.map((issue) => `${issue.severity === "critical" ? "Obrigatório" : "Recomendado"}: ${issue.message}`).join(" · ")}
              </Alert>
            ) : null}
            <footer className="viewer-invoice-editor__footer">
              <Button loading={busy} onClick={() => void run(async () => { await downloadConfirmationPdf(confirmationId, `${label.replace(/\s+/g, "-")}${editable ? "-previa" : ""}.pdf`); })}>{editable ? "Prévia em PDF" : "Baixar PDF"}</Button>
              {editable && c.status === "DRAFT" ? <Button onClick={() => void run(async () => { await call("/submit-review"); return `${label} enviada para conferência.`; })}>Enviar para conferência</Button> : null}
              {detail.permissions.canIssue ? <Button variant="primary" onClick={() => setDialog({ kind: "issue" })}>Emitir</Button> : null}
              {detail.permissions.canMarkSent ? <Button onClick={() => void run(async () => { await call("/mark-sent"); return `${label} marcada como enviada para assinatura.`; })}>Enviada para assinatura</Button> : null}
              {detail.permissions.canSign ? <Button onClick={() => void run(async () => { await call("/signature-status", "POST", { signatureStatus: "SIGNED" }); return `${label} marcada como assinada.`; })}>Marcar assinada</Button> : null}
              <Button onClick={() => void run(async () => { const result = await call("/duplicate"); onOpen(String(result.newConfirmationId)); return `${label} duplicada como novo rascunho.`; })}>Duplicar</Button>
              {detail.permissions.canReplace ? <Button onClick={() => setDialog({ kind: "replace" })}>Substituir</Button> : null}
              {detail.permissions.canCancel ? <Button onClick={() => setDialog({ kind: "cancel" })}>Cancelar</Button> : null}
              {detail.permissions.canDelete ? <Button variant="danger" onClick={() => setDialog({ kind: "delete" })}>Excluir rascunho</Button> : null}
            </footer>

            <div className="viewer-invoice-editor__section">
              <strong>Dados do negócio {editable && !editingHeader ? <Button variant="ghost" onClick={startHeader}>Editar</Button> : null}</strong>
              {!editingHeader ? (
                <dl className="viewer-invoice-editor__facts">
                  <div><dt>Data</dt><dd>{formatDateBr(c.confirmationDate)}</dd></div>
                  <div><dt>Negociação</dt><dd>{c.negotiationDate ? formatDateBr(c.negotiationDate) : "—"}</dd></div>
                  <div className="viewer-invoice-editor__wide"><dt>Entrega / descarga</dt><dd>{c.deliveryLocationSnapshot ?? "—"}</dd></div>
                  <div className="viewer-invoice-editor__wide"><dt>Pagamento</dt><dd>{c.paymentTermsSnapshot ?? "—"}</dd></div>
                  <div><dt>Corretagem</dt><dd>{c.brokeragePercentageBasisPoints === null ? "—" : `${(c.brokeragePercentageBasisPoints / 100).toLocaleString("pt-BR")}%`}</dd></div>
                  <div><dt>Conta</dt><dd>{[c.bankName, c.bankAgency && `ag. ${c.bankAgency}`, c.bankAccount && `c/c ${c.bankAccount}`, c.pixKey && `PIX ${c.pixKey}`].filter(Boolean).join(" · ") || "—"}</dd></div>
                  {detail.fiscalDocuments.length ? <div className="viewer-invoice-editor__wide"><dt>Notas</dt><dd>{detail.fiscalDocuments.map((doc) => `NF ${doc.documentNumber}`).join(", ")}</dd></div> : null}
                </dl>
              ) : (
                <div className="viewer-invoice-editor__grid">
                  {([["confirmationDate", "Data", "date"], ["negotiationDate", "Negociação", "date"], ["deliveryStartDate", "Entrega de", "date"], ["deliveryEndDate", "Entrega até", "date"]] as const).map(([key, title, type]) => (
                    <label key={key}>{title}<input className="ui-input" type={type} value={header[key] ?? ""} onChange={(event) => setHeader({ ...header, [key]: event.target.value })} /></label>
                  ))}
                  {([["deliveryLocationSnapshot", "Entrega / descarga"], ["paymentTermsSnapshot", "Condição de pagamento"], ["qualityTermsSnapshot", "Qualidade"], ["generalTermsSnapshot", "Condições gerais"], ["publicNotes", "Observações (saem no PDF)"], ["internalNotes", "Observações internas"]] as const).map(([key, title]) => (
                    <label key={key} className="viewer-invoice-editor__wide">{title}<textarea className="ui-input" rows={2} value={header[key] ?? ""} onChange={(event) => setHeader({ ...header, [key]: event.target.value })} /></label>
                  ))}
                  {([["brokerage", "Corretagem (%)"], ["bankName", "Banco"], ["bankAgency", "Agência"], ["bankAccount", "Conta"], ["pixKey", "Chave PIX"]] as const).map(([key, title]) => (
                    <label key={key}>{title}<input className="ui-input" value={header[key] ?? ""} onChange={(event) => setHeader({ ...header, [key]: event.target.value })} /></label>
                  ))}
                  <footer className="viewer-invoice-editor__footer viewer-invoice-editor__wide">
                    <Button onClick={() => setEditingHeader(false)}>Descartar</Button>
                    <Button variant="primary" loading={busy} onClick={() => void run(async () => {
                      await call("", "PUT", {
                        confirmationDate: header.confirmationDate || undefined, negotiationDate: nullable(header.negotiationDate), deliveryStartDate: nullable(header.deliveryStartDate),
                        deliveryEndDate: nullable(header.deliveryEndDate), deliveryLocationSnapshot: nullable(header.deliveryLocationSnapshot), paymentTermsSnapshot: nullable(header.paymentTermsSnapshot),
                        qualityTermsSnapshot: nullable(header.qualityTermsSnapshot), generalTermsSnapshot: nullable(header.generalTermsSnapshot), publicNotes: nullable(header.publicNotes),
                        internalNotes: nullable(header.internalNotes), brokeragePercentageBasisPoints: header.brokerage.trim() ? Math.round(Number(decimalInput(header.brokerage)) * 100) : null,
                        bankName: nullable(header.bankName), bankAgency: nullable(header.bankAgency), bankAccount: nullable(header.bankAccount), pixKey: nullable(header.pixKey)
                      });
                      setEditingHeader(false);
                    })}>Salvar</Button>
                  </footer>
                </div>
              )}
            </div>

            <div className="viewer-invoice-editor__section">
              <strong>Partes</strong>
              {detail.parties.map((item) => ({ item, snapshot: partySnapshot(item) })).map(({ item, snapshot }) => (
                <div className="viewer-invoice-editor__line" key={item.id}>
                  <span><strong>{ROLE_LABELS[item.partyRole] ?? item.partyRole}</strong><small>{item.representativeName ? `Representante: ${item.representativeName}` : ""}</small></span>
                  <span>{snapshot.name ?? "—"}<small>{[snapshot.taxId, snapshot.city, snapshot.state].filter(Boolean).join(" · ")}</small></span>
                  <span>{editable && item.partyRole !== "ISSUER" ? <Button variant="ghost" onClick={() => void run(async () => { await call(`/parties/${item.id}`, "DELETE"); })}>Remover</Button> : null}</span>
                </div>
              ))}
              {editable ? (
                <div className="viewer-confirmation-add">
                  <select className="ui-select" value={party.role} onChange={(event) => setParty({ ...party, role: event.target.value })}>
                    {["BUYER", "SELLER", "BROKER", "DELIVERY_RECIPIENT", "OTHER"].map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                  </select>
                  <select className="ui-select" value={party.source} onChange={(event) => setParty({ ...party, source: event.target.value, ref: "" })}>
                    <option value="company">Empresa (CNPJ)</option><option value="partner">Cliente / fornecedor</option><option value="manual">Nome manual</option>
                  </select>
                  {party.source === "company" ? (
                    <select className="ui-select" value={party.ref} onChange={(event) => setParty({ ...party, ref: event.target.value })}>
                      <option value="">Selecione</option>{options?.companies.map((company) => <option key={company.id} value={company.id}>{company.legalName}{company.cnpj ? ` · ${company.cnpj}` : ""}</option>)}
                    </select>
                  ) : party.source === "partner" ? (
                    <select className="ui-select" value={party.ref} onChange={(event) => setParty({ ...party, ref: event.target.value })}>
                      <option value="">Selecione</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name}</option>)}
                    </select>
                  ) : <input className="ui-input" placeholder="Nome" value={party.manualName} onChange={(event) => setParty({ ...party, manualName: event.target.value })} />}
                  <input className="ui-input" placeholder="Representante (opcional)" value={party.representative} onChange={(event) => setParty({ ...party, representative: event.target.value })} />
                  <Button disabled={party.source === "manual" ? !party.manualName.trim() : !party.ref} loading={busy} onClick={() => void run(async () => {
                    const company = options?.companies.find((item) => item.id === party.ref);
                    await call("/parties", "POST", {
                      partyRole: party.role, sortOrder: detail.parties.length, representativeName: nullable(party.representative),
                      businessPartnerId: party.source === "partner" ? party.ref : party.source === "company" ? company?.businessPartnerId ?? null : null,
                      partnerLegalEntityId: party.source === "company" ? party.ref : null, manualName: party.source === "manual" ? party.manualName.trim() : null
                    });
                    setParty({ ...party, ref: "", manualName: "", representative: "" });
                  })}>Incluir parte</Button>
                </div>
              ) : null}
            </div>

            <div className="viewer-invoice-editor__section">
              <strong>Itens</strong>
              {detail.items.map((item) => itemEdit?.id === item.id ? null : (
                <div className="viewer-invoice-editor__line" key={item.id}>
                  <span><strong>{item.productNameSnapshot}</strong><small>{item.totalWasManuallyOverridden ? `Total manual: ${item.totalOverrideReason ?? ""}` : item.notes ?? ""}</small></span>
                  <span>{decimalLabel(item.quantitySacksDecimal)} sc × {formatCurrencyBr(Math.round(Number(item.unitPriceDecimal) * 100))}<small>saca de {decimalLabel(item.sackWeightKgDecimal)} kg</small></span>
                  <span>{formatCurrencyBr(item.totalAmountCents)}
                    {editable ? <><Button variant="ghost" onClick={() => setItemEdit({ id: item.id, name: item.productNameSnapshot, quantity: item.quantitySacksDecimal.replace(".", ","), weight: item.sackWeightKgDecimal.replace(".", ","), price: item.unitPriceDecimal.replace(".", ","), total: item.totalWasManuallyOverridden ? (item.totalAmountCents / 100).toFixed(2).replace(".", ",") : "", reason: item.totalOverrideReason ?? "" })}>Editar</Button>
                      <Button variant="ghost" onClick={() => void run(async () => { await call(`/items/${item.id}`, "DELETE"); })}>Remover</Button></> : null}
                  </span>
                </div>
              ))}
              {editable && !itemEdit ? <Button variant="ghost" onClick={() => setItemEdit({ id: null, name: "", quantity: "", weight: "60", price: "", total: "", reason: "" })}>Adicionar item</Button> : null}
              {itemEdit ? (
                <div className="viewer-invoice-editor__grid">
                  <label className="viewer-invoice-editor__wide">Produto / descrição<input className="ui-input" value={itemEdit.name} onChange={(event) => setItemEdit({ ...itemEdit, name: event.target.value })} /></label>
                  <label>Sacas<input className="ui-input" inputMode="decimal" value={itemEdit.quantity} onChange={(event) => setItemEdit({ ...itemEdit, quantity: event.target.value })} /></label>
                  <label>Peso da saca (kg)<input className="ui-input" inputMode="decimal" value={itemEdit.weight} onChange={(event) => setItemEdit({ ...itemEdit, weight: event.target.value })} /></label>
                  <label>Preço por saca (R$)<input className="ui-input" inputMode="decimal" value={itemEdit.price} onChange={(event) => setItemEdit({ ...itemEdit, price: event.target.value })} /></label>
                  <label>Total manual (R$, opcional)<input className="ui-input" inputMode="decimal" value={itemEdit.total} onChange={(event) => setItemEdit({ ...itemEdit, total: event.target.value })} /></label>
                  {itemEdit.total.trim() ? <label className="viewer-invoice-editor__wide">Justificativa do total manual<input className="ui-input" value={itemEdit.reason} onChange={(event) => setItemEdit({ ...itemEdit, reason: event.target.value })} /></label> : null}
                  <footer className="viewer-invoice-editor__footer viewer-invoice-editor__wide">
                    <Button onClick={() => setItemEdit(null)}>Descartar</Button>
                    <Button variant="primary" loading={busy} disabled={!itemEdit.name.trim() || !(Number(decimalInput(itemEdit.quantity)) > 0) || (Boolean(itemEdit.total.trim()) && !itemEdit.reason.trim())} onClick={() => void run(async () => {
                      const current = detail.items.find((item) => item.id === itemEdit.id);
                      if (itemEdit.id) await call(`/items/${itemEdit.id}`, "PUT", itemBody(itemEdit, current));
                      else await call("/items", "POST", itemBody(itemEdit));
                      setItemEdit(null);
                    })}>Salvar item</Button>
                  </footer>
                </div>
              ) : null}
            </div>

            <div className="viewer-invoice-editor__section">
              <strong>Cláusulas</strong>
              {detail.clauses.map((item, index) => (
                <div className="viewer-invoice-editor__line" key={item.id}>
                  <span><strong>{[item.clauseNumber, item.title].filter(Boolean).join(" · ") || `Cláusula ${index + 1}`}</strong><small>{item.clauseText.slice(0, 160)}{item.clauseText.length > 160 ? "…" : ""}</small></span>
                  <span />
                  <span>{editable ? <>
                    <Button variant="ghost" disabled={index === 0} onClick={() => void run(async () => { const ids = detail.clauses.map((row) => row.id); [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; await call("/clauses-order", "POST", { clauseIds: ids }); })}>Subir</Button>
                    <Button variant="ghost" onClick={() => void run(async () => { await call(`/clauses/${item.id}`, "DELETE"); })}>Remover</Button></> : null}</span>
                </div>
              ))}
              {editable ? (
                <div className="viewer-invoice-editor__grid">
                  <label className="viewer-invoice-editor__wide">Modelo de cláusula
                    <select className="ui-select" value={clause.templateId} onChange={(event) => {
                      const template = options?.clauseTemplates.find((item) => item.id === event.target.value);
                      setClause({ templateId: event.target.value, title: template?.title ?? template?.name ?? "", text: template?.clauseText ?? "" });
                    }}>
                      <option value="">Escrever manualmente</option>{options?.clauseTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="viewer-invoice-editor__wide">Título<input className="ui-input" value={clause.title} onChange={(event) => setClause({ ...clause, title: event.target.value })} /></label>
                  <label className="viewer-invoice-editor__wide">Texto<textarea className="ui-input" rows={3} value={clause.text} onChange={(event) => setClause({ ...clause, text: event.target.value })} /></label>
                  <footer className="viewer-invoice-editor__footer viewer-invoice-editor__wide">
                    <Button disabled={!clause.text.trim()} loading={busy} onClick={() => void run(async () => {
                      await call("/clauses", "POST", { clauseNumber: null, title: nullable(clause.title), clauseText: clause.text.trim(), sortOrder: detail.clauses.length, isVisible: true });
                      setClause({ templateId: "", title: "", text: "" });
                    })}>Incluir cláusula</Button>
                  </footer>
                </div>
              ) : null}
            </div>

            <div className="viewer-invoice-editor__section">
              <strong>Parcelas de pagamento</strong>
              {detail.paymentTerms.map((item) => (
                <div className="viewer-invoice-editor__line" key={item.id}>
                  <span><strong>{item.description}</strong><small>{item.dueDate ? `Vence em ${formatDateBr(item.dueDate)}` : ""}</small></span>
                  <span>{item.percentageBasisPoints !== null ? `${(item.percentageBasisPoints / 100).toLocaleString("pt-BR")}%` : ""}{item.amountCents !== null ? formatCurrencyBr(item.amountCents) : ""}</span>
                  <span>{editable ? <Button variant="ghost" onClick={() => void run(async () => { await call(`/payment-terms/${item.id}`, "DELETE"); })}>Remover</Button> : null}</span>
                </div>
              ))}
              {editable ? (
                <div className="viewer-confirmation-add">
                  <input className="ui-input" placeholder="Descrição (ex.: sinal)" value={term.description} onChange={(event) => setTerm({ ...term, description: event.target.value })} />
                  <input className="ui-input" placeholder="%" inputMode="decimal" value={term.percent} onChange={(event) => setTerm({ ...term, percent: event.target.value })} />
                  <input className="ui-input" placeholder="Valor (R$)" inputMode="decimal" value={term.amount} onChange={(event) => setTerm({ ...term, amount: event.target.value })} />
                  <input className="ui-input" type="date" value={term.dueDate} onChange={(event) => setTerm({ ...term, dueDate: event.target.value })} />
                  <Button disabled={!term.description.trim()} loading={busy} onClick={() => void run(async () => {
                    await call("/payment-terms", "POST", {
                      sortOrder: detail.paymentTerms.length, description: term.description.trim(),
                      percentageBasisPoints: term.percent.trim() ? Math.round(Number(decimalInput(term.percent)) * 100) : null,
                      amountCents: term.amount.trim() ? moneyCents(term.amount) : null, dueDate: term.dueDate || null, daysAfterEvent: null, eventReference: null
                    });
                    setTerm({ description: "", percent: "", amount: "", dueDate: "" });
                  })}>Incluir parcela</Button>
                </div>
              ) : null}
              {editable ? <small>Se usar percentuais, a soma das parcelas precisa dar 100%.</small> : null}
            </div>

            <div className="viewer-invoice-editor__section">
              <strong>Assinaturas</strong>
              {detail.signers.map((item) => (
                <div className="viewer-invoice-editor__line" key={item.id}>
                  <span><strong>{item.name}</strong><small>{ROLE_LABELS[item.partyRole] ?? item.partyRole}{item.email ? ` · ${item.email}` : ""}</small></span>
                  <span>
                    <select className="ui-select" value={item.signatureStatus} disabled={c.status === "CANCELLED" || c.status === "REPLACED"} onChange={(event) => void run(async () => {
                      await call(`/signers/${item.id}`, "PUT", { ...item, signatureStatus: event.target.value, signedAt: event.target.value === "SIGNED_EXTERNALLY" ? new Date().toISOString() : null });
                    })}>
                      {Object.entries(SIGNER_STATUS).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
                    </select>
                  </span>
                  <span>{editable ? <Button variant="ghost" onClick={() => void run(async () => { await call(`/signers/${item.id}`, "DELETE"); })}>Remover</Button> : null}</span>
                </div>
              ))}
              {c.status !== "CANCELLED" && c.status !== "REPLACED" ? (
                <div className="viewer-confirmation-add">
                  <select className="ui-select" value={signer.role} onChange={(event) => setSigner({ ...signer, role: event.target.value })}>
                    {["BUYER", "SELLER", "BROKER", "ISSUER", "WITNESS", "OTHER"].map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                  </select>
                  <input className="ui-input" placeholder="Nome" value={signer.name} onChange={(event) => setSigner({ ...signer, name: event.target.value })} />
                  <input className="ui-input" placeholder="CPF/CNPJ" value={signer.document} onChange={(event) => setSigner({ ...signer, document: event.target.value })} />
                  <input className="ui-input" placeholder="E-mail" value={signer.email} onChange={(event) => setSigner({ ...signer, email: event.target.value })} />
                  <Button disabled={!signer.name.trim()} loading={busy} onClick={() => void run(async () => {
                    await call("/signers", "POST", {
                      partyRole: signer.role, name: signer.name.trim(), documentNumber: nullable(signer.document), positionTitle: null, email: nullable(signer.email), phone: null,
                      signatureOrder: detail.signers.length + 1, signatureStatus: "PENDING", notes: null
                    });
                    setSigner({ ...signer, name: "", document: "", email: "" });
                  })}>Incluir assinante</Button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      <ConfirmationDialog open={dialog?.kind === "issue"} title={`Emitir ${label}?`} confirmLabel="Emitir" onCancel={() => setDialog(null)}
        onConfirm={() => void run(async () => { const result = await call("/issue"); return `Confirmação ${String(result.confirmationNumber)} emitida.`; })}>
        A confirmação recebe o número oficial e deixa de ser editável. Para mudar depois, use Substituir.
        {detail?.pendingIssues.some((issue) => issue.severity === "warning") ? ` Avisos: ${detail.pendingIssues.filter((issue) => issue.severity === "warning").map((issue) => issue.message).join(" ")}` : ""}
      </ConfirmationDialog>
      {(["cancel", "replace"] as const).map((kind) => (
        <ConfirmationDialog key={kind} open={dialog?.kind === kind} title={kind === "cancel" ? `Cancelar ${label}?` : `Substituir ${label}?`}
          confirmLabel={kind === "cancel" ? "Cancelar confirmação" : "Criar substituta"} onCancel={() => { setDialog(null); setReason(""); }}
          onConfirm={() => {
            if (reason.trim().length < 3) { setError("Informe o motivo."); setDialog(null); return; }
            void run(async () => {
              const result = await call(`/${kind}`, "POST", { reason: reason.trim() });
              if (kind === "replace") { onOpen(String(result.newConfirmationId)); return `${label} substituída; edite e emita o novo rascunho.`; }
              return `${label} cancelada. O número continua reservado no histórico.`;
            });
          }}>
          <label className="ui-field">Motivo<textarea className="ui-input" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        </ConfirmationDialog>
      ))}
      <ConfirmationDialog open={dialog?.kind === "delete"} title={`Excluir ${label}?`} confirmLabel="Excluir" onCancel={() => setDialog(null)}
        onConfirm={() => void run(async () => { await apiJson(base(confirmationId), { method: "DELETE" }); onClose(); return `${label} excluída.`; })}>
        O rascunho ainda não tem número e será apagado de todos os computadores.
      </ConfirmationDialog>
    </Drawer>
  );
}
