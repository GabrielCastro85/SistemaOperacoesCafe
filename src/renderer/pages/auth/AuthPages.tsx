import { useState } from "react";
import type { KeyboardEvent } from "react";
import type { AuthSession } from "../../../shared/types/domain";

interface AuthPageProps {
  onSession: (session: AuthSession | null) => void;
}

function PasswordField({ label, value, onChange, autoFocus, onKeyDown }: { label: string; value: string; onChange: (value: string) => void; autoFocus?: boolean; onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void }): JSX.Element {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <div className="auth-password-field">
        <input autoFocus={autoFocus} type={visible ? "text" : "password"} autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} />
        <button type="button" className="auth-password-toggle" onClick={() => setVisible((current) => !current)} tabIndex={-1}>
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </label>
  );
}

export function FirstAdminSetupPage({ onSession }: AuthPageProps): JSX.Element {
  const [displayName, setDisplayName] = useState("Administrador");
  const [username, setUsername] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    try {
      setError(null);
      onSession(await window.operationsCafe.authBootstrapAdmin({ displayName, username, email: email || null, password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel criar o administrador.");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand-row">
          <img src="assets/branding/villa/logo.png" alt="" />
          <img src="assets/branding/grao/logo.png" alt="" />
        </div>
        <span className="auth-eyebrow">Primeiro acesso</span>
        <h1>Criar administrador local</h1>
        <p>Defina o usuario inicial desta instalacao. Nenhuma senha padrao sera criada.</p>
        <label>Nome<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <PasswordField label="Senha" value={password} onChange={setPassword} />
        {error ? <div className="auth-error">{error}</div> : null}
        <button className="primary" type="button" onClick={() => void submit()}>Criar administrador</button>
      </section>
    </main>
  );
}

export function LoginPage({ onSession }: AuthPageProps): JSX.Element {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    try {
      setError(null);
      onSession(await window.operationsCafe.authLogin({ username, password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Usuario ou senha invalidos.");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand-row">
          <img src="assets/branding/villa/logo.png" alt="" />
          <img src="assets/branding/grao/logo.png" alt="" />
        </div>
        <span className="auth-eyebrow">Sistema de Operacoes de Cafe</span>
        <h1>Entrar</h1>
        <label>Usuario<input autoFocus value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <PasswordField label="Senha" value={password} onChange={setPassword} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} />
        {error ? <div className="auth-error">{error}</div> : null}
        <button className="primary" type="button" onClick={() => void submit()}>Entrar</button>
      </section>
    </main>
  );
}

export function LockScreen({ session, onSession }: AuthPageProps & { session: AuthSession }): JSX.Element {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function unlock(): Promise<void> {
    try {
      setError(null);
      onSession(await window.operationsCafe.authUnlock(password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Senha invalida.");
    }
  }

  async function logout(): Promise<void> {
    await window.operationsCafe.authLogout();
    onSession(null);
  }

  return (
    <div className="lock-screen">
      <section className="auth-panel">
        <div className="auth-brand-row">
          <img src="assets/branding/villa/logo.png" alt="" />
          <img src="assets/branding/grao/logo.png" alt="" />
        </div>
        <span className="auth-eyebrow">Sessao bloqueada</span>
        <h1>{session.user.displayName}</h1>
        <PasswordField label="Senha" value={password} onChange={setPassword} autoFocus onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }} />
        {error ? <div className="auth-error">{error}</div> : null}
        <div className="auth-actions">
          <button className="primary" type="button" onClick={() => void unlock()}>Desbloquear</button>
          <button type="button" onClick={() => void logout()}>Trocar usuario</button>
        </div>
      </section>
    </div>
  );
}

export function AccessDeniedPage(): JSX.Element {
  return (
    <section className="content-section">
      <div className="empty-state">
        <strong>Acesso negado</strong>
        <p>Seu usuario nao possui permissao para abrir esta area.</p>
      </div>
    </section>
  );
}
