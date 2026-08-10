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
  const [resyncing, setResyncing] = useState(false);
  const [localOnlyMode, setLocalOnlyModeState] = useState(false);
  const [localOnlyLoading, setLocalOnlyLoading] = useState(false);

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
    void window.operationsCafe.getLocalOnlyMode().then(setLocalOnlyModeState);
  }, []);

  async function toggleLocalOnlyMode(enabled: boolean): Promise<void> {
    setError(null);
    setMessage(null);
    setLocalOnlyLoading(true);
    try {
      const result = await window.operationsCafe.setLocalOnlyMode(enabled);
      setLocalOnlyModeState(result);
      if (result) {
        setConnected(false);
        setConnectedEmail(null);
        setMessage("Modo somente local ativado. Este PC nao vai mais sincronizar com o Supabase nem com os outros computadores -- as atualizacoes do programa continuam funcionando normalmente.");
      } else {
        setMessage("Modo somente local desativado. Voce pode conectar este PC ao Supabase novamente quando quiser.");
      }
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Falha ao alterar o modo somente local.");
    } finally {
      setLocalOnlyLoading(false);
    }
  }

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

  // "Sincronizar agora" so' busca o que mudou depois do ultimo cursor salvo
  // -- se este PC nunca chegou a baixar algo antigo (ex: comecou a
  // sincronizar uma tabela depois dela ja ter historico no Supabase), aquele
  // dado antigo fica pra sempre invisivel aqui, mesmo sincronizando toda
  // hora. Isso esquece o cursor de cada tabela e baixa tudo de novo do zero.
  async function fullResync(): Promise<void> {
    setError(null);
    setMessage(null);
    setResyncing(true);
    try {
      const pulled = await window.operationsCafe.resetSyncCursorsAndResync();
      const pulledSomething = pulled.filter((item) => item.pulled > 0);
      setMessage(pulledSomething.length > 0
        ? `Sincronizacao completa -- recebido: ${pulledSomething.map((item) => `${item.table} (${item.pulled})`).join(", ")}.`
        : "Sincronizacao completa: nada para baixar (este PC ja estava com tudo).");
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Falha na sincronizacao completa.");
    } finally {
      setResyncing(false);
    }
  }

  return (
    <section className="content-section">
      <PageHeader eyebrow="Sistema" title="Sistema" description="Ajustes administrativos adicionais." />
      <Card title="Conexao entre PCs (Supabase)" eyebrow="Compartilhamento">
        {checking ? (
          <p>Verificando conexao...</p>
        ) : localOnlyMode ? (
          <>
            <p>
              Status: <Badge tone="neutral">Modo somente local</Badge>
            </p>
            <p className="ui-field__hint">
              Este PC esta configurado pra nunca sincronizar com o Supabase nem com os outros computadores do escritorio -- tudo o que voce lancar fica so' aqui.
              As atualizacoes automaticas do programa continuam funcionando normalmente, independente disso.
            </p>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {message ? <Alert tone="success">{message}</Alert> : null}
            <div className="actions">
              <Button variant="secondary" onClick={() => void toggleLocalOnlyMode(false)} loading={localOnlyLoading}>Desativar modo somente local</Button>
            </div>
          </>
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
              <>
                <div className="actions">
                  <Button variant="secondary" onClick={() => void syncNow()} loading={loading}>Sincronizar agora</Button>
                  <Button variant="danger" onClick={() => void disconnect()} loading={loading}>Desconectar</Button>
                </div>
                <p className="ui-field__hint">
                  Se algum lançamento de outro PC nunca aparece aqui mesmo depois de "Sincronizar agora" (ex: histórico de importação de XML vazio quando deveria ter notas), use a sincronização completa abaixo -- ela é mais lenta, mas rebaixa tudo do zero.
                </p>
                <div className="actions">
                  <Button variant="secondary" onClick={() => void fullResync()} loading={resyncing}>Sincronização completa (rebaixar tudo de novo)</Button>
                </div>
              </>
            ) : (
              <>
                <Input label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
                <Input label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                <div className="actions">
                  <Button variant="primary" onClick={() => void connect()} loading={loading} disabled={!email.trim() || !password}>Conectar</Button>
                </div>
                <p className="ui-field__hint">
                  Prefere que este PC funcione sempre sozinho, sem tentar sincronizar com os outros? Ative o modo somente local abaixo -- as atualizacoes do programa continuam chegando normalmente.
                </p>
                <div className="actions">
                  <Button variant="secondary" onClick={() => void toggleLocalOnlyMode(true)} loading={localOnlyLoading}>Ativar modo somente local</Button>
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
