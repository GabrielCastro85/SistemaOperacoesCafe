import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, PageHeader } from "../../design-system";
import type { UpdateStatus } from "../../../shared/types/updater";

export function SystemSettingsPage(): JSX.Element {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle" });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);

  useEffect(() => {
    void window.operationsCafe.getUpdateStatus().then(setUpdateStatus);
    return window.operationsCafe.onUpdateStatusChanged(setUpdateStatus);
  }, []);

  async function checkForUpdatesNow(): Promise<void> {
    setCheckingUpdate(true);
    try {
      const status = await window.operationsCafe.checkForUpdates();
      setUpdateStatus(status);
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function installUpdateNow(): Promise<void> {
    setInstallingUpdate(true);
    await window.operationsCafe.quitAndInstallUpdate();
  }

  return (
    <section className="content-section">
      <PageHeader eyebrow="Sistema" title="Sistema" description="Ajustes administrativos adicionais." />
      <Card title="Atualizacoes do sistema" eyebrow="Versao">
        {updateStatus.state === "idle" || updateStatus.state === "checking" ? (
          <p>
            Status: <Badge tone="neutral">{updateStatus.state === "checking" ? "Verificando..." : "Nenhuma verificacao ainda"}</Badge>
          </p>
        ) : null}
        {updateStatus.state === "not-available" ? (
          <p>
            Status: <Badge tone="success">Voce ja esta na versao mais recente</Badge>
          </p>
        ) : null}
        {updateStatus.state === "downloading" ? (
          <p>
            Status: <Badge tone="info">Baixando atualizacao {updateStatus.version} ({updateStatus.percent}%)</Badge>
          </p>
        ) : null}
        {updateStatus.state === "downloaded" ? (
          <>
            <p>
              Status: <Badge tone="success">Atualizacao {updateStatus.version} pronta para instalar</Badge>
            </p>
            <Alert tone="success">O programa vai fechar e reabrir automaticamente na nova versao.</Alert>
            <div className="actions">
              <Button variant="primary" onClick={() => void installUpdateNow()} loading={installingUpdate}>Reiniciar e atualizar agora</Button>
            </div>
          </>
        ) : null}
        {updateStatus.state === "error" ? <Alert tone="danger">Falha ao verificar atualizacao: {updateStatus.message}</Alert> : null}
        {updateStatus.state !== "downloaded" ? (
          <div className="actions">
            <Button variant="secondary" onClick={() => void checkForUpdatesNow()} loading={checkingUpdate || updateStatus.state === "checking" || updateStatus.state === "downloading"}>
              Verificar atualizacoes agora
            </Button>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
