import type { XmlImportJob } from "../../../../shared/types/domain";
import { formatDateBr } from "../../../../shared/utils/format";
import { StatusBadge } from "../../../design-system";
import { AdminBlock } from "../../../components/layout/SectionPrimitives";

// Historico de importacoes de XML. Os dados e as acoes vem da pagina; aqui so
// se desenha a tabela e o botao "Mostrar mais".
export function XmlImportHistory({ jobs, limit, canRevert, onShowMore, onDetail, onRevert }: {
  jobs: XmlImportJob[];
  limit: number;
  canRevert: (job: XmlImportJob) => boolean;
  onShowMore: () => void;
  onDetail: (jobId: string) => void;
  onRevert: (jobId: string) => void;
}): JSX.Element {
  return (
    <AdminBlock title="Historico de XML">
      <div className="table"><div className="table-head xml-history-grid"><span>Data</span><span>Status</span><span>Arquivos</span><span>Notas</span><span>Operacoes</span><span>Sem operacao</span><span>Eventos</span><span>Erros</span><span>Acoes</span></div>{jobs.slice(0, limit).map((job) => <div key={job.id} className="table-row xml-history-grid"><span>{formatDateBr(job.createdAt)}</span><span><StatusBadge status={job.status} /></span><span>{job.totalFiles}</span><span>{job.importedNotes}</span><span>{job.createdOperations}</span><span>{job.itemsWithoutOperation}</span><span>{job.importedEvents}</span><span>{job.errorFiles}</span><span className="row-actions"><button onClick={() => onDetail(job.id)}>Detalhar</button><button className="danger" disabled={!canRevert(job)} onClick={() => onRevert(job.id)}>Excluir/Reverter</button></span></div>)}</div>
      {jobs.length > limit ? <div className="toolbar"><button onClick={() => onShowMore()}>Mostrar mais ({jobs.length - limit} restantes)</button></div> : null}
    </AdminBlock>
  );
}
