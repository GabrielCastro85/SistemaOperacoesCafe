import type { DealConfirmationDocumentVersion } from "../../../../shared/types/domain";
import { DocumentPreviewCard } from "../../../design-system";

export function ConfirmationDocuments({ documents }: { documents: DealConfirmationDocumentVersion[] }): JSX.Element {
  return <div className="document-grid">{documents.map((item) => <DocumentPreviewCard key={item.id} title={item.originalFileName} type={item.documentType} hash={item.fileHash} isCurrent={item.isCurrent} onOpen={() => void window.operationsCafe.openDealDocument(item.id)} onReveal={() => void window.operationsCafe.revealDealDocumentFolder(item.id)} />)}</div>;
}
