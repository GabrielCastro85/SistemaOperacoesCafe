import { useEffect, useState } from "react";
import { apiJson, queryString } from "./api";
import { formatDateBr } from "./viewerFormat";
import { Alert } from "./renderer/design-system/components/Alert";
import { Badge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";

// XMLs que nao viram nota comum: evento fiscal, armazem e nota triangulada.
// O servidor identifica o tipo em /xml/inspect (server/src/specialXml.ts).

interface XmlItem { itemNumber: string; productCode?: string; description?: string; cfop?: string; commercialUnit?: string; commercialQuantity?: number }

export type XmlInspection =
  | { kind: "INVOICE" }
  | {
    kind: "EVENT"; accessKey: string; eventType: string; sequenceNumber: string; eventDate: string | null; protocolNumber: string | null;
    statusCode: string | null; statusMessage: string | null; correctionText: string | null; acceptedCancellation: boolean;
    duplicate: boolean; warehouseMovements: number; billed: boolean; document: { id: string; number: string; status: string } | null;
  }
  | {
    kind: "WAREHOUSE"; accessKey: string; number: string; issueDate: string; ownLegalEntityName: string; movementType: "DEPOSIT" | "RETURN";
    warehouseName: string; warehouseCnpj: string | null; referencedDocumentNumber: string | null; canceled: boolean; duplicate: boolean;
    items: Array<{ itemNumber: string; description: string; cfop: string; kind: "PHYSICAL" | "SYMBOLIC"; quantityKg: string; status: string }>;
  }
  | {
    kind: "TRIANGULATED"; accessKey: string; number: string; series: string; issueDate: string; nature: string;
    issuer: { legalName?: string; cnpjCpf?: string; state?: string }; recipient: { legalName?: string; cnpjCpf?: string; state?: string };
    items: XmlItem[]; supplier: { id: string; name: string }; clients: Array<{ id: string; name: string }>;
  };

const EVENT_LABELS: Record<string, string> = { CANCELLATION: "Cancelamento", CORRECTION_LETTER: "Carta de correção", OTHER: "Outro evento" };
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function SpecialXmlPanel({ inspection, xml, organizationId, legalEntityId, onDone }: {
  inspection: Exclude<XmlInspection, { kind: "INVOICE" }>; xml: string; organizationId: string; legalEntityId?: string;
  onDone: (message: string) => void;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<string>): Promise<void> => {
    setBusy(true); setError(null);
    try { onDone(await action()); }
    catch (value) { setError(value instanceof Error ? value.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  };

  if (inspection.kind === "EVENT") {
    return (
      <div className="viewer-xml-preview">
        {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
        <div className="viewer-xml-preview__summary">
          <span><small>Evento</small><strong>{EVENT_LABELS[inspection.eventType] ?? inspection.eventType}</strong></span>
          <span><small>Data</small><strong>{inspection.eventDate ? formatDateBr(inspection.eventDate) : "—"}</strong></span>
          <span><small>SEFAZ</small><strong>{inspection.statusCode ?? "—"}</strong><small>{inspection.statusMessage ?? ""}</small></span>
          <span><small>Nota</small><strong>{inspection.document ? `NF ${inspection.document.number}` : "Ainda não cadastrada"}</strong></span>
        </div>
        {inspection.correctionText ? <Alert tone="neutral" title="Texto do evento">{inspection.correctionText}</Alert> : null}
        {inspection.duplicate ? <Alert tone="info" title="Evento já registrado">Este evento já está no sistema.</Alert> : null}
        {inspection.acceptedCancellation && !inspection.duplicate ? (
          <Alert tone="warning" title="Cancelamento aceito pela SEFAZ">
            {inspection.document
              ? `A NF ${inspection.document.number} e suas operações serão canceladas.`
              : "A nota ainda não está no sistema. O cancelamento fica guardado e ela já entrará cancelada quando for importada."}
            {inspection.warehouseMovements ? ` ${inspection.warehouseMovements} movimento(s) de armazém desta chave também serão cancelados.` : ""}
            {inspection.billed ? " Atenção: a nota já está numa cobrança; revise a cobrança depois." : ""}
          </Alert>
        ) : null}
        <div className="viewer-xml-importer__footer">
          <small>Chave {inspection.accessKey}</small>
          <Button variant="primary" loading={busy} disabled={inspection.duplicate} onClick={() => void run(async () => {
            const result = await apiJson<{ canceledDocument: boolean; canceledMovements: number }>("/v1/manage/invoices/xml/event", json({ organizationId, xml }));
            return result.canceledDocument ? `Cancelamento registrado; NF ${inspection.document?.number ?? ""} cancelada.` : "Evento fiscal registrado.";
          })}>Registrar evento</Button>
        </div>
      </div>
    );
  }

  if (inspection.kind === "WAREHOUSE") {
    const pending = inspection.items.filter((item) => item.status === "PENDING_REVIEW").length;
    return (
      <div className="viewer-xml-preview">
        {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
        <div className="viewer-xml-preview__summary">
          <span><small>Nota</small><strong>NF {inspection.number}</strong><small>{formatDateBr(inspection.issueDate)}</small></span>
          <span><small>Movimento</small><strong>{inspection.movementType === "DEPOSIT" ? "Remessa para armazém" : "Retorno de armazém"}</strong></span>
          <span><small>Empresa própria</small><strong>{inspection.ownLegalEntityName}</strong></span>
          <span><small>Armazém</small><strong>{inspection.warehouseName}</strong><small>{inspection.warehouseCnpj ?? ""}</small></span>
        </div>
        <Alert tone="info" title="Nota de armazém">Entra em Cafés armazenados como movimento de estoque, sem gerar venda nem cobrança.</Alert>
        {inspection.duplicate ? <Alert tone="info" title="Já importada">Esta nota de armazém já está no sistema.</Alert> : null}
        {inspection.canceled ? <Alert tone="warning" title="Nota cancelada">Há cancelamento aceito para esta chave; os movimentos entram cancelados.</Alert> : null}
        {pending ? <Alert tone="warning" title="Conferir referência">A nota de origem da remessa simbólica não foi identificada. O movimento fica pendente de revisão em Cafés armazenados.</Alert> : null}
        <div className="viewer-xml-items">
          {inspection.items.map((item) => (
            <div className="viewer-xml-item" key={item.itemNumber}>
              <span><strong>{item.description}</strong><small>CFOP {item.cfop} · {item.kind === "SYMBOLIC" ? "simbólica" : "física"}</small></span>
              <span><strong>{Number(item.quantityKg).toLocaleString("pt-BR")} kg</strong><small>{(Number(item.quantityKg) / 60).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} sacas</small></span>
              <span>{inspection.referencedDocumentNumber ? <Badge tone="neutral">Ref. NF {inspection.referencedDocumentNumber}</Badge> : null}</span>
            </div>
          ))}
        </div>
        <div className="viewer-xml-importer__footer">
          <small>Chave {inspection.accessKey}</small>
          <Button variant="primary" loading={busy} disabled={inspection.duplicate} onClick={() => void run(async () => {
            const result = await apiJson<{ movements: number; pendingReview: number }>("/v1/manage/invoices/xml/warehouse", json({ organizationId, xml }));
            return `NF ${inspection.number} importada em Cafés armazenados (${result.movements} movimento(s)${result.pendingReview ? `, ${result.pendingReview} para revisar` : ""}).`;
          })}>Importar no armazém</Button>
        </div>
      </div>
    );
  }

  return <TriangulatedForm inspection={inspection} xml={xml} organizationId={organizationId} legalEntityId={legalEntityId} busy={busy} error={error} run={run} />;
}

function TriangulatedForm({ inspection, xml, organizationId, legalEntityId, busy, error, run }: {
  inspection: Extract<XmlInspection, { kind: "TRIANGULATED" }>; xml: string; organizationId: string; legalEntityId?: string;
  busy: boolean; error: string | null; run: (action: () => Promise<string>) => Promise<void>;
}): JSX.Element {
  const [entities, setEntities] = useState<Array<{ id: string; organizationId: string; tradeName: string }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>(inspection.clients);
  const [products, setProducts] = useState<Array<{ id: string; name: string; code: string | null }>>([]);
  const [ownLegalEntityId, setOwnLegalEntityId] = useState(legalEntityId ?? "");
  const [clientPartnerId, setClientPartnerId] = useState(inspection.clients.length === 1 ? inspection.clients[0].id : "");
  const [operationScope, setOperationScope] = useState<"INTERNAL" | "EXTERNAL">(inspection.issuer.state && inspection.recipient.state && inspection.issuer.state !== inspection.recipient.state ? "EXTERNAL" : "INTERNAL");
  const [hasFinancialService, setHasFinancialService] = useState(false);
  const [confirmOperations, setConfirmOperations] = useState(true);
  const [itemProducts, setItemProducts] = useState<Record<string, string>>({});
  useEffect(() => {
    void Promise.all([
      apiJson<{ legalEntities: Array<{ id: string; organizationId: string; tradeName: string }> }>("/v1/viewer/context"),
      apiJson<Array<{ id: string; display_name: string; roles: Array<{ role: string }> }>>(`/v1/viewer/partners?${queryString({ organizationId, legalEntityId })}`),
      apiJson<Array<{ id: string; name: string; code: string | null }>>(`/v1/viewer/products?${queryString({ organizationId, legalEntityId })}`)
    ]).then(([context, partners, productRows]) => {
      setEntities(context.legalEntities.filter((entity) => entity.organizationId === organizationId));
      const suggested = new Set(inspection.clients.map((client) => client.id));
      setClients([...inspection.clients, ...partners.filter((partner) => partner.roles.some((role) => role.role === "CLIENT") && !suggested.has(partner.id))
        .map((partner) => ({ id: partner.id, name: partner.display_name }))]);
      setProducts(productRows);
      setItemProducts(Object.fromEntries(inspection.items.map((item) => {
        const description = (item.description ?? "").toLocaleLowerCase("pt-BR");
        const match = productRows.find((product) => description.includes(product.name.toLocaleLowerCase("pt-BR")) || product.name.toLocaleLowerCase("pt-BR").includes(description));
        return [item.itemNumber, match?.id ?? ""];
      })));
    }).catch(() => undefined);
  }, [organizationId, legalEntityId, inspection]);
  const mapped = inspection.items.every((item) => itemProducts[item.itemNumber]);
  return (
    <div className="viewer-xml-preview">
      {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
      <div className="viewer-xml-preview__summary">
        <span><small>Nota</small><strong>NF {inspection.number}{inspection.series ? `/${inspection.series}` : ""}</strong><small>{formatDateBr(inspection.issueDate)}</small></span>
        <span><small>Emitente (fornecedor)</small><strong>{inspection.issuer.legalName}</strong><small>{inspection.supplier.name}</small></span>
        <span><small>Destinatário</small><strong>{inspection.recipient.legalName}</strong><small>{inspection.recipient.cnpjCpf}</small></span>
      </div>
      <Alert tone="info" title="Nota triangulada">A nota vai do fornecedor direto ao comprador, sem passar pelas nossas empresas. Cada item gera uma compra do fornecedor e, se informado, uma venda ao cliente/corretor.</Alert>
      <div className="viewer-xml-importer__fields">
        <label>Empresa própria que registra a operação
          <select className="ui-select" value={ownLegalEntityId} onChange={(event) => setOwnLegalEntityId(event.target.value)}>
            <option value="">Selecione</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.tradeName}</option>)}
          </select>
        </label>
        <label>Cliente / corretor da revenda
          <select className="ui-select" value={clientPartnerId} onChange={(event) => setClientPartnerId(event.target.value)}>
            <option value="">Sem venda (só a compra)</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}{inspection.clients.some((item) => item.id === client.id) ? " · vinculado ao destinatário" : ""}</option>)}
          </select>
        </label>
        <label>Escopo
          <select className="ui-select" value={operationScope} onChange={(event) => setOperationScope(event.target.value as "INTERNAL" | "EXTERNAL")}>
            <option value="INTERNAL">Mesma UF</option><option value="EXTERNAL">Outra UF</option>
          </select>
        </label>
      </div>
      <div className="viewer-xml-items">
        {inspection.items.map((item) => (
          <div className="viewer-xml-item" key={item.itemNumber}>
            <span><strong>{item.description || `Item ${item.itemNumber}`}</strong><small>CFOP {item.cfop || "—"}</small></span>
            <span><strong>{Number(item.commercialQuantity ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {item.commercialUnit}</strong></span>
            <select className="ui-select" value={itemProducts[item.itemNumber] ?? ""} onChange={(event) => setItemProducts((current) => ({ ...current, [item.itemNumber]: event.target.value }))}>
              <option value="">Selecione o produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="viewer-xml-importer__options">
        {clientPartnerId ? <label><input type="checkbox" checked={hasFinancialService} onChange={(event) => setHasFinancialService(event.target.checked)} /> A venda possui financeiro</label> : null}
        <label><input type="checkbox" checked={confirmOperations} onChange={(event) => setConfirmOperations(event.target.checked)} /> Aplicar tarifas e confirmar as operações agora</label>
      </div>
      <div className="viewer-xml-importer__footer">
        <small>{inspection.nature}</small>
        <Button variant="primary" loading={busy} disabled={!ownLegalEntityId || !mapped} onClick={() => void run(async () => {
          const result = await apiJson<{ status: string; pendingNotes: string | null }>("/v1/manage/invoices/xml/triangulated", json({
            organizationId, xml, ownLegalEntityId, supplierPartnerId: inspection.supplier.id, clientPartnerId: clientPartnerId || null,
            operationScope, hasFinancialService, confirmOperations,
            itemProducts: inspection.items.map((item) => ({ itemNumber: item.itemNumber, productId: itemProducts[item.itemNumber] }))
          }));
          return result.status === "CONFIRMED" ? `NF ${inspection.number} triangulada importada e confirmada.` : `NF ${inspection.number} triangulada importada com pendência: ${result.pendingNotes ?? "revise a nota"}.`;
        })}>Importar nota triangulada</Button>
      </div>
    </div>
  );
}
