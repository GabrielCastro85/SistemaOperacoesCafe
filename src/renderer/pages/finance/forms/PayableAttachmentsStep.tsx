import { useState } from "react";
import { Alert, Button } from "../../../design-system";
import type { PayableDraftFormState } from "../hooks/usePayableDraftForm";

export function PayableAttachmentsStep({ form, onChange }: { form: PayableDraftFormState; onChange: (form: PayableDraftFormState) => void }): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  async function selectFile(): Promise<void> {
    try {
      setError(null);
      const selected = await window.operationsCafe.selectPayableAttachment();
      if (selected) onChange({ ...form, attachments: [...form.attachments, selected] });
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "Nao foi possivel selecionar o arquivo.");
    }
  }
  return <section className="payable-attachment-picker">
    <div>
      <h3>Anexos da conta</h3>
      <p>Selecione boletos, notas, contratos ou outros comprovantes em PDF ou imagem.</p>
      <Button variant="primary" onClick={() => void selectFile()}>Selecionar arquivo</Button>
    </div>
    {form.attachments.length ? <ul className="payable-pending-files">{form.attachments.map((item) => <li key={item.token}><span><strong>{item.fileName}</strong><small>{Math.max(1, Math.round(item.sizeBytes / 1024))} KB</small></span><Button variant="ghost" onClick={() => onChange({ ...form, attachments: form.attachments.filter((attachment) => attachment.token !== item.token) })}>Remover</Button></li>)}</ul> : <p className="payable-empty-files">Nenhum arquivo selecionado.</p>}
    {error ? <Alert variant="danger" title="Falha ao selecionar arquivo">{error}</Alert> : null}
  </section>;
}
