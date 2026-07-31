import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Input, PageHeader } from "../../design-system";
import type { UpdateStatus } from "../../../shared/types/updater";

export function SystemSettingsPage(): JSX.Element {
  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  async function refreshStatus(): Promise<void> {
    setChecking(true);
    try {
      const status = await window.operationsCafe.sharedAuthStatus();
      setConnected(status.connected);
      setConnectedEmail(status.email);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function connect(): Promise<void> {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const status = await window.operationsCafe.sharedAuthSignIn({ email: email.trim(), password });
      setConnected(status.connected);
      setConnectedEmail(status.email);
      setPassword("");
      const failures = status.referenceDataPushed.filter((item) => item.error);
      if (failures.length > 0) {
        setError(`Conectado, mas alguns cadastros nao foram enviados ainda: ${failures.map((item) => `${item.table} (${item.error})`).join("; ")}. Tente "Sincronizar agora" depois.`);
      } else {
        setMessage("Conectado ao Supabase. A sincronizacao com os outros PCs comeca automaticamente.");
      }
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Falha ao conectar.");
    } finally {
      setLoading(false);
    }
  }

  async function disconnect(): Promise<void> {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await window.operationsCafe.sharedAuthSignOut();
      setConnected(false);
      setConnectedEmail(null);
      setMessage("Desconectado do Supabase. Este PC volta a funcionar so' localmente.");
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Falha ao desconectar.");
    } finally {
      setLoading(false);
    }
  }

  async function syncNow(): Promise<void> {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const { pushed, pulled } = await window.operationsCafe.syncSharedData();
      const pushFailures = pushed.filter((item) => item.error);
      const pushedSomething = pushed.filter((item) => item.pushed > 0);
      const pulledSomething = pulled.filter((item) => item.pulled > 0);
      const parts: string[] = [];
      if (pushedSomething.length > 0) parts.push(`enviado: ${pushedSomething.map((item) => `${item.table} (${item.pushed})`).join(", ")}`);
      if (pulledSomething.length > 0) parts.push(`recebido: ${pulledSomething.map((item) => `${item.table} (${item.pulled})`).join(", ")}`);
      setMessage(parts.length > 0 ? `Sincronizado -- ${parts.join("; ")}.` : "Sincronizado: nenhuma novidade em nenhum sentido.");
      if (pushFailures.length > 0) {
        setError(`Nao foi possivel enviar: ${pushFailures.map((item) => `${item.table} (${item.error})`).join("; ")}. O cadastro continua so' local ate' conseguir sincronizar de novo.`);
      }
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Falha ao sincronizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="content-section">
      <PageHeader eyebrow="Sistema" title="Sistema" description="Ajustes administrativos adicionais." />
      <Card title="Conexao entre PCs (Supabase)" eyebrow="Compartilhamento">
        {checking ? (
          <p>Verificando conexao...</p>
        ) : (
          <>
            <p>
              Status: {connected ? <Badge tone="success">Conectado{connectedEmail ? ` como ${connectedEmail}` : ""}</Badge> : <Badge tone="neutral">Desconectado</Badge>}
            </p>
            <p className="ui-field__hint">
              Conectar uma vez por PC libera o compartilhamento de notas, operacoes, importacoes de XML e cobrancas entre os 4 computadores do escritorio.
              A sessao fica salva neste PC -- nao precisa reconectar a cada abertura do programa.
            </p>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {message ? <Alert tone="success">{message}</Alert> : null}
            {connected ? (
              <div className="actions">
                <Button variant="secondary" onClick={() => void syncNow()} loading={loading}>Sincronizar agora</Button>
                <Button variant="danger" onClick={() => void disconnect()} loading={loading}>Desconectar</Button>
              </div>
            ) : (
              <>
                <Input label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
                <Input label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                <div className="actions">
                  <Button variant="primary" onClick={() => void connect()} loading={loading} disabled={!email.trim() || !password}>Conectar</Button>
                </div>
              </>
            )}
          </>
        )}
      </Card>
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
