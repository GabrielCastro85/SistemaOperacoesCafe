import { useEffect, useState } from "react";
import type { AuditEvent, AuditIntegrityResult } from "../../../shared/types/domain";

export function AuditPage(): JSX.Element {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [integrity, setIntegrity] = useState<AuditIntegrityResult | null>(null);

  async function load(): Promise<void> {
    const [eventRows, chain] = await Promise.all([window.operationsCafe.listAuditEvents({ limit: 300 }), window.operationsCafe.verifyAuditChain()]);
    setEvents(eventRows);
    setIntegrity(chain);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="content-section">
      <div className="page-header"><span>Auditoria</span><h1>Eventos do sistema</h1><p>Registro imutavel com sanitizacao e encadeamento SHA-256.</p></div>
      <div className="cards">
        <article className="card"><span>Integridade</span><h3>{integrity?.valid ? "Valida" : "Pendente"}</h3><p>{integrity?.checkedEvents ?? 0} eventos verificados</p></article>
        <article className="card"><span>Eventos</span><h3>{events.length}</h3><p>Ultimos registros locais</p></article>
      </div>
      <div className="table">
        <div className="table-head audit-grid"><span>Data</span><span>Usuario</span><span>Acao</span><span>Resultado</span><span>Hash</span></div>
        {events.map((event) => (
          <div key={event.id} className="table-row audit-grid">
            <span>{new Date(event.occurredAt).toLocaleString("pt-BR")}</span>
            <span>{event.actorUsername ?? "-"}</span>
            <span>{event.action}</span>
            <span>{event.result}</span>
            <span>{event.eventHash.slice(0, 12)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
