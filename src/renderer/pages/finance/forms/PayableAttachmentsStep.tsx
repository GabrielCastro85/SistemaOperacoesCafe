import { Alert, AttachmentList, FileDropzone } from "../../../design-system";

export function PayableAttachmentsStep(): JSX.Element {
  return <><FileDropzone title="Anexos da conta" description="Use a tela de detalhe para copiar arquivos pelo IPC seguro e vincular ao lancamento." /><AttachmentList items={[]} /><Alert variant="info" title="Anexos seguros">O renderer nao recebe caminho absoluto; os arquivos sao selecionados e copiados pelo processo principal.</Alert></>;
}
