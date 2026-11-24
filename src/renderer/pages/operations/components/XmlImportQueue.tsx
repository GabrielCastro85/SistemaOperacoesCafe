import React from "react";
import type { XmlFileInspection } from "../../../../shared/types/domain";
import { EmptyState, FileDropzone, StatusBadge } from "../../../design-system";
import { xmlPartySummary, xmlQueueSummaryLine, type VulpeDevScanResult } from "../operationsFormatters";

// Coluna da fila de importacao de XML: arrastar/selecionar arquivos, a fila e o botao de validar.
// Estado e acoes continuam na pagina (ou no hook de XML); aqui so se desenha.
export function XmlImportQueue({ pageTab, includeXmlSubfolders, setIncludeXmlSubfolders, xmlQueue, xmlDeferredSelections, setXmlDeferredSelections, selectedXmlFile, setSelectedXmlToken, xmlQueueHasWarehouseMovement, xmlQueueRequiresCommercialPartner, xmlQueueMissingPartner, hasValidXmlSelection, vulpeScan, onPrepareDropped, onPrepare, onValidate }: {
  pageTab: "received" | "issued" | "documents" | "spreadsheets";
  partnerId: string;
  includeXmlSubfolders: boolean;
  setIncludeXmlSubfolders: React.Dispatch<React.SetStateAction<boolean>>;
  xmlQueue: XmlFileInspection[];
  xmlDeferredSelections: Record<string, boolean>;
  setXmlDeferredSelections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedXmlFile: XmlFileInspection | null;
  setSelectedXmlToken: React.Dispatch<React.SetStateAction<string | null>>;
  xmlQueueHasWarehouseMovement: boolean;
  xmlQueueRequiresCommercialPartner: boolean;
  xmlQueueMissingPartner: boolean;
  hasValidXmlSelection: boolean;
  vulpeScan: VulpeDevScanResult | null;
  onPrepareDropped: (files: File[]) => unknown;
  onPrepare: (mode: "single" | "multiple" | "folder") => unknown;
  onValidate: () => unknown;
}): JSX.Element {
  return (
    <>
            <h3>{pageTab === "received" ? "Importar XMLs recebidos" : "Importar XMLs"}</h3>
            <div className={`xml-dropzone-wrap${xmlQueue.length ? " is-compact" : ""}`}>
            <FileDropzone
              title="Arraste XMLs aqui ou selecione os arquivos"
              description="Solte um ou mais XMLs da NF-e nesta área para inspecionar automaticamente."
              dropHint="Também é possível usar os botões abaixo para escolher arquivo, vários XMLs ou uma pasta inteira."
              onDropFiles={(files) => void onPrepareDropped(files)}
              actions={
                <>
                  <button onClick={() => void onPrepare("single")}>Selecionar XML</button>
                  <button onClick={() => void onPrepare("multiple")}>Selecionar varios XMLs</button>
                  <button onClick={() => void onPrepare("folder")}>Selecionar pasta</button>
                </>
              }
            />
            </div>
            <label className="inline-check"><input type="checkbox" checked={includeXmlSubfolders} onChange={(event) => setIncludeXmlSubfolders(event.target.checked)} /> Incluir subpastas</label>
            {xmlQueue.length ? (
              <ul className="xml-queue-list">
                  {xmlQueue.map((file) => {
                    const party = xmlPartySummary(file, pageTab === "received" ? "INBOUND" : "OUTBOUND");
                    return (
                  <li key={file.token} className={xmlDeferredSelections[file.token] ? "xml-queue-item--deferred" : undefined}>
                    <button type="button" className={file.token === selectedXmlFile?.token ? "active" : ""} onClick={() => setSelectedXmlToken(file.token)}>
                      <span className="xml-queue-party"><strong>{party.title}</strong><small>{xmlQueueSummaryLine(file)}</small></span>
                      <StatusBadge status={file.status} />
                      {file.errorMessage ? <small className="xml-queue-file" title={file.errorMessage}>{file.errorMessage}</small> : null}
                    </button>
                    <button type="button" className="xml-defer-toggle" onClick={() => setXmlDeferredSelections((current) => ({ ...current, [file.token]: !current[file.token] }))}>{xmlDeferredSelections[file.token] ? "Voltar à fila" : "Ignorar por enquanto"}</button>
                  </li>
                    );
                  })}
              </ul>
            ) : (
              <EmptyState title="Nenhum arquivo selecionado" description="Selecione um ou mais XMLs de NF-e para começar." />
            )}
            {xmlQueue.length && xmlQueueMissingPartner ? (
              <p className="xml-validate-hint">Falta escolher o cliente/corretor de uma ou mais notas na aba "Cliente e operação", ou marcar "Ignorar por enquanto" nas notas que não entram.</p>
            ) : null}
            <div className="toolbar">
              <button onClick={() => void onValidate()} disabled={xmlQueue.length === 0 || !hasValidXmlSelection || xmlQueueMissingPartner}>
                {xmlQueueHasWarehouseMovement && !xmlQueueRequiresCommercialPartner ? "Validar movimentação" : "Validar fila"}
              </button>
            </div>
    </>
  );
}
