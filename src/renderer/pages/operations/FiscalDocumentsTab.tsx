import type { FiscalDocument } from "../../../shared/types/domain";
import { FiscalDocumentTable } from "./components/FiscalDocumentTable";

export function FiscalDocumentsTab({ documents, onOpen }: { documents: FiscalDocument[]; onOpen: (id: string) => void }): JSX.Element {
  return <FiscalDocumentTable documents={documents} onOpen={onOpen} />;
}
