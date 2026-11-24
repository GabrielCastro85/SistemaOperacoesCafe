import React from "react";
import type { CollectorMonitorStatus, VulpeDevScanResult } from "../operationsFormatters";
import { DateInput } from "../../../design-system";
import { FormGrid } from "../../../components/layout/SectionPrimitives";
import { CollectorStatusList } from "./CollectorStatusList";

type VulpeSource = { source: "VILLA_MG" | "VILLA_ES" | "VILLA_SP" | "GRAO_MG" | "GRAO_SP" | "ALL"; label: string; available: boolean };

// Busca de notas no coletor: monitor do coletor, periodo, fontes e resultado da ultima varredura.
// Estado e acoes continuam na pagina; aqui so se desenha.
export function NotesSearchPanel({ available, pageTab, vulpeDevSources, vulpePeriodStart, vulpePeriodEnd, setVulpePeriodStart, setVulpePeriodEnd, vulpeScan, setVulpeScan, collectorStatuses, setCollectorStatuses, collectorMonitorError, setCollectorMonitorError, collectorCommandBusy, onCollectorCommand, setMessage, onPrepareSource }: {
  available: boolean;
  pageTab: "received" | "issued" | "documents" | "spreadsheets";
  vulpeDevSources: VulpeSource[];
  vulpePeriodStart: string;
  vulpePeriodEnd: string;
  setVulpePeriodStart: React.Dispatch<React.SetStateAction<string>>;
  setVulpePeriodEnd: React.Dispatch<React.SetStateAction<string>>;
  vulpeScan: VulpeDevScanResult | null;
  setVulpeScan: React.Dispatch<React.SetStateAction<VulpeDevScanResult | null>>;
  collectorStatuses: CollectorMonitorStatus[];
  setCollectorStatuses: React.Dispatch<React.SetStateAction<CollectorMonitorStatus[]>>;
  collectorMonitorError: string | null;
  setCollectorMonitorError: React.Dispatch<React.SetStateAction<string | null>>;
  collectorCommandBusy: string | null;
  onCollectorCommand: (collector: CollectorMonitorStatus, command: "SCAN_NOW" | "UPDATE_NOW" | "RESTART" | "BACKFILL") => unknown;
  setMessage: React.Dispatch<React.SetStateAction<string | null>>;
  onPrepareSource: (source: VulpeSource["source"]) => unknown;
}): JSX.Element | null {
  if (!available) return null;
  return (
    <>
          <div className="operation-warning-card operation-warning-card--neutral">
            <strong>{pageTab === "received" ? "Buscar notas recebidas" : "Buscar notas emitidas"}</strong>
            <span>Escolha abaixo qual empresa propria deve ser consultada. O sistema separa as notas pelo sentido correto, remove as chaves ja cadastradas e nao lanca nada antes da sua confirmacao.</span>
            <section className="collector-monitor" aria-label="Monitor do coletor remoto">
              <div className="collector-monitor__heading">
                <div>
                  <strong>Monitor do coletor da Grao &amp; Grao</strong>
                  <small>O estado e atualizado automaticamente a cada 30 segundos.</small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void window.operationsCafe
                      .getVulpeDevStatus()
                      .then((status) => {
                        setCollectorStatuses(status.collectors);
                        setCollectorMonitorError(status.collectorMonitorError);
                      })
                      .catch(() => setMessage("Nao foi possivel atualizar o status do coletor agora."));
                  }}
                >
                  Atualizar status
                </button>
              </div>
              {collectorStatuses.length ? (
                <CollectorStatusList collectors={collectorStatuses} busyKey={collectorCommandBusy} onCommand={onCollectorCommand} />
              ) : (
                <div className="collector-monitor__empty">
                  {collectorMonitorError ?? <>O servidor ainda nao recebeu o sinal de monitoramento. O coletor antigo continua enviando notas, mas precisa ser atualizado uma vez para mostrar o estado remoto.</>}
                </div>
              )}
            </section>
            <FormGrid>
              <DateInput
                label="Data inicial"
                value={vulpePeriodStart}
                onChange={(event) => {
                  setVulpePeriodStart(event.target.value);
                  setVulpeScan(null);
                }}
              />
              <DateInput
                label="Data final"
                value={vulpePeriodEnd}
                onChange={(event) => {
                  setVulpePeriodEnd(event.target.value);
                  setVulpeScan(null);
                }}
              />
            </FormGrid>
            <div className="toolbar vulpe-search-actions">
              {[...vulpeDevSources].sort((left, right) => Number(right.source === "ALL") - Number(left.source === "ALL")).map((source) => (
                <button key={source.source} className={source.source === "ALL" ? "vulpe-search-all" : undefined} type="button" disabled={!source.available} onClick={() => void onPrepareSource(source.source)}>
                  {pageTab === "received" ? "Recebidas por" : "Emitidas por"} {source.label}
                </button>
              ))}
            </div>
            {vulpeScan ? (
              <span>
                {vulpeScan.label}: {vulpeScan.authorized} NF-e autorizada(s), {vulpeScan.alreadyImported} ja cadastrada(s), {vulpeScan.ignoredByUser} marcada(s) para nao cadastrar, {vulpeScan.canceledInvoicesHidden} cancelada(s) ocultada(s) e {vulpeScan.pendingReview} arquivo(s) aguardando revisao. Cancelamentos encontrados: {vulpeScan.cancellationEvents} ({vulpeScan.cancellationsAlreadyApplied} ja aplicado(s)).
              </span>
            ) : null}
          </div>
    </>
  );
}
