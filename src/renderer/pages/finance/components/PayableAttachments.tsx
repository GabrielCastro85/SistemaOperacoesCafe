import type { PayableDocumentAttachment } from "../../../../shared/types/domain";
import { AttachmentList, Button } from "../../../design-system";

export function PayableAttachments({ attachments, onOpen, onRemove }: { attachments: PayableDocumentAttachment[]; onOpen?: (id: string) => void; onRemove?: (id: string) => void }): JSX.Element {
  return (
    <>
      <AttachmentList items={attachments.map((item) => ({ id: item.id, title: item.originalFileName, type: `${item.attachmentType} - ${Math.round(item.fileSize / 1024)} KB`, hash: item.fileHash.slice(0, 12) }))} />
      <div className="actions">{attachments.map((item) => <span key={item.id}><Button onClick={() => onOpen?.(item.id)}>Abrir</Button><Button onClick={() => onRemove?.(item.id)}>Remover</Button></span>)}</div>
    </>
  );
}
