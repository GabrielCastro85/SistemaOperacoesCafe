import type { CollectorMonitorStatus } from "../operationsFormatters";
import { collectorCommandLabel, collectorCommandStatusLabel, collectorCompanyLabels, formatCollectorActivity, formatCollectorUptime } from "../operationsFormatters";

// Lista dos cartoes de coletores (monitor do Vulpe). Recebe os dados e a acao
// por propriedades; o estado e o envio de comandos continuam na pagina.
export function CollectorStatusList({ collectors, busyKey, onCommand }: {
  collectors: CollectorMonitorStatus[];
  busyKey: string | null;
  onCommand: (collector: CollectorMonitorStatus, command: "SCAN_NOW" | "UPDATE_NOW" | "RESTART" | "BACKFILL") => void;
}): JSX.Element {
  return (
    <div className="collector-monitor__list">
                    {collectors.map((collector) => {
                      const tone = !collector.online || collector.status === "ERROR" ? "danger" : collector.status === "PENDING_RETRY" ? "warning" : "success";
                      const label = !collector.online ? "Sem sinal" : collector.status === "OK" ? "Funcionando agora" : collector.status === "PENDING_RETRY" ? "Online, com envio pendente" : "Online, com erro";
                      return (
                        <article className={`collector-monitor__item collector-monitor__item--${tone}`} key={`${collector.sourceCode}-${collector.machineId}`}>
                          <div className="collector-monitor__title">
                            <strong>{collector.sourceLabel}</strong>
                            <span className={`collector-monitor__badge collector-monitor__badge--${tone}`}>{label}</span>
                          </div>
                          <small>{collectorCompanyLabels(collector.emitterCnpjs)} · coletor {collector.collectorVersion ?? "sem versao"}</small>
                          <dl>
                            <div><dt>Ultima atividade</dt><dd>{formatCollectorActivity(collector.updatedAt)}</dd></div>
                            <div><dt>Ultima varredura correta</dt><dd>{formatCollectorActivity(collector.lastSuccessAt)}</dd></div>
                            <div><dt>Ultimo XML enviado</dt><dd>{formatCollectorActivity(collector.lastUploadAt ?? collector.lastFileReceivedAt)}</dd></div>
                            <div><dt>Fila no servidor</dt><dd>{collector.pendingFiles} arquivo(s)</dd></div>
                            <div><dt>Iniciado em</dt><dd>{formatCollectorActivity(collector.startedAt)}</dd></div>
                            <div><dt>Tempo ativo</dt><dd>{formatCollectorUptime(collector.uptimeSeconds)}</dd></div>
                            <div><dt>Inicializacao automatica</dt><dd>{collector.startupConfigured ? "Configurada" : "Nao confirmada"}</dd></div>
                            <div><dt>Ultima busca de atualizacao</dt><dd>{formatCollectorActivity(collector.lastUpdateCheckAt)}</dd></div>
                          </dl>
                          {collector.lastCommand ? (
                            <p>Ultimo comando: <strong>{collectorCommandLabel(collector.lastCommand)}</strong> · {collectorCommandStatusLabel(collector.lastCommandStatus)}{collector.lastCommandResult ? ` · ${collector.lastCommandResult}` : ""}</p>
                          ) : null}
                          {collector.lastError ? <p>{collector.lastError}</p> : null}
                          <div className="collector-monitor__actions">
                            {(["SCAN_NOW", "BACKFILL", "UPDATE_NOW", "RESTART"] as const).map((command) => {
                              const key = `${collector.sourceCode}-${collector.machineId}-${command}`;
                              return (
                                <button type="button" key={command} disabled={busyKey !== null} onClick={() => void onCommand(collector, command)}>
                                  {busyKey === key ? "Enviando..." : collectorCommandLabel(command)}
                                </button>
                              );
                            })}
                          </div>
                          <details className="collector-monitor__diagnostics">
                            <summary>Ver diagnostico e registros recentes</summary>
                            <pre>{collector.recentLogs?.trim() || "O coletor ainda nao enviou registros detalhados."}</pre>
                          </details>
                        </article>
                      );
                    })}
    </div>
  );
}
