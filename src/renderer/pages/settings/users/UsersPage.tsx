import { useEffect, useState } from "react";
import type { AppRole, AppUser } from "../../../../shared/types/domain";

export function UsersPage(): JSX.Element {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "", roleId: "role-viewer" });
  const [message, setMessage] = useState<string | null>(null);

  async function load(): Promise<void> {
    const [userRows, roleRows] = await Promise.all([window.operationsCafe.listUsers(), window.operationsCafe.listRoles()]);
    setUsers(userRows);
    setRoles(roleRows);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(): Promise<void> {
    try {
      const user = await window.operationsCafe.createUser({ ...form, email: form.email || null, mustChangePassword: true });
      await window.operationsCafe.assignUserRole({ userId: user.id, roleId: form.roleId });
      setForm({ displayName: "", username: "", email: "", password: "", roleId: "role-viewer" });
      setMessage("Usuario criado.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar usuario.");
    }
  }

  async function setStatus(id: string, status: AppUser["status"]): Promise<void> {
    await window.operationsCafe.updateUser({ id, status });
    await load();
  }

  return (
    <section className="content-section">
      <div className="page-header"><span>Configuracoes</span><h1>Usuarios</h1><p>Cadastro local, bloqueio e atribuicao inicial de roles.</p></div>
      <div className="form-grid">
        <label>Nome<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
        <label>Usuario<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
        <label>Email<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Senha temporaria<input type="password" autoComplete="off" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <label>Role<select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
        <button className="primary" type="button" onClick={() => void create()}>Criar usuario</button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
      <div className="table">
        <div className="table-head users-grid"><span>Nome</span><span>Usuario</span><span>Email</span><span>Status</span><span>Acoes</span></div>
        {users.map((user) => (
          <div key={user.id} className="table-row users-grid">
            <span>{user.displayName}</span>
            <span>{user.username}</span>
            <span>{user.email ?? "-"}</span>
            <span>{user.status}</span>
            <span>
              {user.status === "ACTIVE" ? <button onClick={() => void setStatus(user.id, "LOCKED")}>Bloquear</button> : <button onClick={() => void setStatus(user.id, "ACTIVE")}>Reativar</button>}
              <button onClick={() => void setStatus(user.id, "INACTIVE")}>Inativar</button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
