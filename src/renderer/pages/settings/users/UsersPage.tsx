import { useEffect, useState } from "react";
import type { AppRole, AppUser, AuthSession } from "../../../../shared/types/domain";
import { PageHeader } from "../../../design-system";
import { requestDecision } from "../../../utils/dialogs";

export function UsersPage(): JSX.Element {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "", roleId: "role-viewer" });
  const [message, setMessage] = useState<string | null>(null);
  const isAdmin = Boolean(session?.permissions.includes("users.manage"));

  async function load(): Promise<void> {
    const [currentSession, userRows, roleRows] = await Promise.all([window.operationsCafe.authCurrentSession(), window.operationsCafe.listUsers(), window.operationsCafe.listRoles()]);
    setSession(currentSession);
    setUsers(userRows);
    setRoles(roleRows);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(): Promise<void> {
    if (!isAdmin) {
      setMessage("Somente o administrador pode criar usuarios.");
      return;
    }
    try {
      const email = form.email.trim() ? form.email.trim() : null;
      const user = await window.operationsCafe.createUser({ ...form, email, mustChangePassword: true });
      await window.operationsCafe.assignUserRole({ userId: user.id, roleId: form.roleId });
      setForm({ displayName: "", username: "", email: "", password: "", roleId: "role-viewer" });
      setMessage("Usuario criado.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar usuario.");
    }
  }

  async function setStatus(id: string, status: AppUser["status"]): Promise<void> {
    if (!isAdmin) {
      setMessage("Somente o administrador pode alterar usuarios.");
      return;
    }
    await window.operationsCafe.updateUser({ id, status });
    await load();
  }

  async function deleteUser(user: AppUser): Promise<void> {
    if (!isAdmin) {
      setMessage("Somente o administrador pode excluir usuarios.");
      return;
    }
    const confirmed = await requestDecision({
      title: "Excluir usuario definitivamente",
      message: `Excluir ${user.displayName} (${user.username}) para sempre? Ele perde o acesso e o cadastro some deste PC e, assim que os outros sincronizarem, some deles tambem -- nao pode ser desfeito.`
    });
    if (!confirmed) return;
    try {
      await window.operationsCafe.deleteUser(user.id);
      setMessage("Usuario excluido.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao excluir usuario.");
    }
  }

  return (
    <section className="content-section settings">
      <PageHeader eyebrow="Configuracoes" title="Usuarios" description="Cadastro local, bloqueio e atribuicao inicial de roles." />
      {isAdmin ? <div className="form-grid">
        <label>Nome<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
        <label>Usuario<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
        <label>Email (opcional)<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Senha temporaria<input type="password" autoComplete="off" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <label>Role<select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
        <button className="primary" type="button" onClick={() => void create()}>Criar usuario</button>
      </div> : <p className="muted">Todos os usuarios logados acessam o sistema completo. Somente o administrador cria ou altera usuarios.</p>}
      {message ? <p className="muted">{message}</p> : null}
      <div className="table">
        <div className="table-head users-grid"><span>Nome</span><span>Usuario</span><span>Email</span><span>Status</span><span>Acoes</span></div>
        {users.map((user) => (
          <div key={user.id} className="table-row users-grid">
            <span>{user.displayName}</span>
            <span>{user.username}</span>
            <span>{user.email ?? "-"}</span>
            <span>{user.status}</span>
            <span className="row-actions">
              {isAdmin ? user.status === "ACTIVE" ? <button onClick={() => void setStatus(user.id, "LOCKED")}>Bloquear</button> : <button onClick={() => void setStatus(user.id, "ACTIVE")}>Reativar</button> : null}
              {isAdmin ? <button className="danger-action" onClick={() => void setStatus(user.id, "INACTIVE")}>Inativar</button> : <span>-</span>}
              {isAdmin && user.id !== session?.user.id ? <button className="danger-action" onClick={() => void deleteUser(user)}>Excluir</button> : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
