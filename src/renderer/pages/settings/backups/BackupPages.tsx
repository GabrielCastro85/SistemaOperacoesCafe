import { useEffect, useState } from "react";
import type { BackupInspection, BackupJob, BackupSettings, BackupType } from "../../../../shared/types/domain";

export function BackupsPage(): JSX.Element {
  const [backups, setBackups] = useState<BackupJob[]>([]);
  const [settings, setSettings] = useState<BackupSettings | null>(null);

  async function load(): Promise<void> {
    const [jobs, cfg] = await Promise.all([window.operationsCafe.listBackups(), window.operationsCafe.getBackupSettings()]);
    setBackups(jobs);
    setSettings(cfg);
  }

  useEffect(() => { void load(); }, []);

  return (
    <section className="content-section">
      <div className="page-header"><span>Seguranca local</span><h1>Backups</h1><p>Pacotes .cafebackup com banco, documentos, manifesto e hashes.</p></div>
      <div className="actions"><button className="primary" onClick={() => { window.location.hash = "#/settings/backups/new"; }}>Novo backup</button><button onClick={() => { window.location.hash = "#/settings/restore"; }}>Restaurar</button><button onClick={() => { window.location.hash = "#/settings/backups/settings"; }}>Configurar automatico</button></div>
      <div className="cards">
        <article className="card"><span>Automatico</span><h3>{settings?.frequency ?? "..."}</h3><p>{settings?.automaticBackupEnabled ? "Ativo" : "Desativado"}</p></article>
        <article className="card"><span>Ultimo backup</span><h3>{backups[0]?.status ?? "Nenhum"}</h3><p>{backups[0]?.fileName ?? "Sem historico"}</p></article>
      </div>
      <div className="table">
        <div className="table-head backup-grid"><span>Arquivo</span><span>Tipo</span><span>Status</span><span>Tamanho</span><span>Verificacao</span><span>Acoes</span></div>
        {backups.map((backup) => (
          <div key={backup.id} className="table-row backup-grid">
            <span>{backup.fileName}</span><span>{backup.backupType}</span><span>{backup.status}</span><span>{backup.fileSize ? formatBytes(backup.fileSize) : "-"}</span><span>{backup.verificationStatus ?? "-"}</span>
            <span><button onClick={() => { window.location.hash = `#/settings/backups/${backup.id}`; }}>Detalhes</button><button onClick={() => void window.operationsCafe.openBackupLocation(backup.id)}>Pasta</button></span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BackupCreatePage(): JSX.Element {
  const [backupType, setBackupType] = useState<BackupType>("FULL");
  const [destinationType, setDestinationType] = useState<"INTERNAL" | "EXTERNAL">("INTERNAL");
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const [encrypted, setEncrypted] = useState(false);
  const [password, setPassword] = useState("");
  const [estimate, setEstimate] = useState<{ estimatedFiles: number; estimatedBytes: number; documentCount: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void window.operationsCafe.estimateBackup(backupType).then(setEstimate); }, [backupType]);

  async function selectDestination(): Promise<void> {
    const selected = await window.operationsCafe.selectBackupDestination();
    if (selected) setDestinationPath(selected);
  }

  async function create(): Promise<void> {
    try {
      setMessage("preparando");
      const job = await window.operationsCafe.createBackup({ backupType, destinationType, destinationPath, encrypted, password: encrypted ? password : null });
      setMessage(`concluido: ${job.fileName}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar backup.");
    }
  }

  return (
    <section className="content-section">
      <div className="page-header"><span>Novo backup</span><h1>Criar backup</h1><p>O backup completo e recomendado para recuperacao de desastre.</p></div>
      <div className="form-grid">
        <label>Tipo<select value={backupType} onChange={(event) => setBackupType(event.target.value as BackupType)}><option value="FULL">Completo</option><option value="DATABASE_ONLY">Somente banco</option></select></label>
        <label>Destino<select value={destinationType} onChange={(event) => setDestinationType(event.target.value as "INTERNAL" | "EXTERNAL")}><option value="INTERNAL">Interno</option><option value="EXTERNAL">Externo</option></select></label>
        <label>Criptografado<select value={encrypted ? "yes" : "no"} onChange={(event) => setEncrypted(event.target.value === "yes")}><option value="no">Nao</option><option value="yes">Sim</option></select></label>
        {destinationType === "EXTERNAL" ? <button type="button" onClick={() => void selectDestination()}>Escolher pasta</button> : null}
        {encrypted ? <label>Senha do backup<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label> : null}
        <button className="primary" type="button" onClick={() => void create()}>Criar backup</button>
      </div>
      <div className="cards"><article className="card"><span>Estimativa</span><h3>{estimate ? formatBytes(estimate.estimatedBytes) : "..."}</h3><p>{estimate?.estimatedFiles ?? 0} arquivos, {estimate?.documentCount ?? 0} documentos</p></article><article className="card"><span>Destino</span><h3>{destinationType}</h3><p>{destinationPath ?? "Diretorio interno userData/backups"}</p></article></div>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}

export function BackupDetailsPage({ id }: { id: string | null }): JSX.Element {
  const [backup, setBackup] = useState<BackupJob | null>(null);
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  useEffect(() => { if (id) void window.operationsCafe.getBackup(id).then(setBackup); }, [id]);
  async function verify(): Promise<void> {
    if (!backup?.storedFilePath) return;
    setInspection(await window.operationsCafe.verifyBackup({ path: backup.storedFilePath }));
  }
  if (!backup) return <section className="content-section"><p>Carregando backup.</p></section>;
  return (
    <section className="content-section">
      <div className="page-header"><span>Backup</span><h1>{backup.fileName}</h1><p>{backup.status} · {backup.backupType} · {backup.encrypted ? "Criptografado" : "Sem criptografia"}</p></div>
      <div className="actions"><button onClick={() => void verify()}>Verificar pacote</button><button onClick={() => void window.operationsCafe.protectBackup(backup.id, "Protegido manualmente").then(setBackup)}>Proteger</button><button onClick={() => void window.operationsCafe.unprotectBackup(backup.id).then(setBackup)}>Desproteger</button></div>
      <dl className="ui-definition-list"><div><dt>Hash</dt><dd>{backup.fileHash ?? "-"}</dd></div><div><dt>Banco</dt><dd>{backup.databaseHash ?? "-"}</dd></div><div><dt>Migration</dt><dd>{backup.migrationVersion ?? "-"}</dd></div></dl>
      {inspection ? <pre className="json-preview">{JSON.stringify(inspection.manifest ?? inspection.errors, null, 2)}</pre> : null}
    </section>
  );
}

export function BackupSettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  useEffect(() => { void window.operationsCafe.getBackupSettings().then(setSettings); }, []);
  if (!settings) return <section className="content-section"><p>Carregando configuracao.</p></section>;
  async function save(next: Partial<BackupSettings>): Promise<void> {
    setSettings(await window.operationsCafe.updateBackupSettings({ ...settings, ...next }));
  }
  return (
    <section className="content-section">
      <div className="page-header"><span>Backups automaticos</span><h1>Configuracao</h1><p>Executa somente quando o aplicativo estiver aberto.</p></div>
      <div className="form-grid">
        <label>Frequencia<select value={settings.frequency} onChange={(event) => void save({ frequency: event.target.value as BackupSettings["frequency"], automaticBackupEnabled: event.target.value !== "DISABLED" })}><option value="DISABLED">Desativado</option><option value="DAILY">Diario</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensal</option></select></label>
        <label>Retencao maxima<input type="number" value={settings.retentionMaxCount} onChange={(event) => void save({ retentionMaxCount: Number(event.target.value) })} /></label>
        <button onClick={() => void window.operationsCafe.runPendingBackup()}>Executar pendente</button>
      </div>
      <p className="muted">Proximo backup: {settings.nextBackupAt ?? "-"}</p>
    </section>
  );
}

export function RestorePage(): JSX.Element {
  const [path, setPath] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [currentUserPassword, setCurrentUserPassword] = useState("");
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function select(): Promise<void> {
    const selected = await window.operationsCafe.selectRestoreFile();
    if (selected) setPath(selected);
  }
  async function inspect(): Promise<void> {
    if (path) setInspection(await window.operationsCafe.inspectRestoreBackup(path, password || null));
  }
  async function restore(): Promise<void> {
    if (!path) return;
    try {
      await window.operationsCafe.executeRestore({ path, password: password || null, currentUserPassword, confirmation: "RESTAURAR" });
      setMessage("Restauracao concluida. Reinicie o aplicativo e faca login novamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao restaurar.");
    }
  }
  return (
    <section className="content-section">
      <div className="page-header"><span>Restauracao</span><h1>Restaurar instalacao</h1><p>Dados atuais serao substituidos apos backup pre-restauracao.</p></div>
      <div className="form-grid"><button onClick={() => void select()}>Selecionar backup</button><label>Senha do backup<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button onClick={() => void inspect()}>Validar</button><label>Senha atual do usuario<input type="password" autoComplete="off" value={currentUserPassword} onChange={(event) => setCurrentUserPassword(event.target.value)} /></label><button className="primary" onClick={() => void restore()}>Confirmar restauracao</button></div>
      <p className="muted">{path ?? "Nenhum arquivo selecionado."}</p>
      {inspection ? <pre className="json-preview">{JSON.stringify(inspection, null, 2)}</pre> : null}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

export function IntegrityPage(): JSX.Element {
  const [result, setResult] = useState<unknown>(null);
  return (
    <section className="content-section">
      <div className="page-header"><span>Integridade</span><h1>Banco, documentos e backups</h1><p>Verificacoes locais com quick_check, documentos ausentes e orfaos.</p></div>
      <div className="actions"><button onClick={() => void window.operationsCafe.runQuickIntegrityCheck().then(setResult)}>Banco rapido</button><button onClick={() => void window.operationsCafe.checkDocumentIntegrity().then(setResult)}>Documentos</button><button onClick={() => void window.operationsCafe.findOrphanFiles().then(setResult)}>Orfaos</button><button onClick={() => void window.operationsCafe.generateIntegrityReport().then(setResult)}>Gerar relatorio</button></div>
      {result ? <pre className="json-preview">{JSON.stringify(result, null, 2)}</pre> : null}
    </section>
  );
}

export function RetentionPage(): JSX.Element {
  return (
    <section className="content-section">
      <div className="page-header"><span>Retencao</span><h1>Politica conservadora</h1><p>Backups protegidos e documentos oficiais nao sao removidos automaticamente.</p></div>
      <div className="empty-state"><strong>Retencao ativa para backups</strong><p>Ajuste a quantidade maxima em Configuracao de backups. Limpeza automatica apaga apenas backups nao protegidos.</p></div>
    </section>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
