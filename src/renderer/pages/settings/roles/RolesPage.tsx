import { useEffect, useState } from "react";
import type { AppPermission, AppRole } from "../../../../shared/types/domain";

export function RolesPage(): JSX.Element {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<AppPermission[]>([]);

  useEffect(() => {
    void Promise.all([window.operationsCafe.listRoles(), window.operationsCafe.listPermissions()]).then(([roleRows, permissionRows]) => {
      setRoles(roleRows);
      setPermissions(permissionRows);
    });
  }, []);

  return (
    <section className="content-section">
      <div className="page-header"><span>Configuracoes</span><h1>Roles e permissoes</h1><p>Matriz local deny-by-default aplicada aos IPCs do main process.</p></div>
      <div className="cards">
        {roles.map((role) => (
          <article className="card" key={role.id}>
            <span>{role.code}</span>
            <h3>{role.name}</h3>
            <p>{role.description}</p>
            <small>{role.scopeType} · {role.isSystem ? "Sistema" : "Customizada"}</small>
          </article>
        ))}
      </div>
      <div className="table">
        <div className="table-head permissions-grid"><span>Modulo</span><span>Permissao</span><span>Risco</span><span>Descricao</span></div>
        {permissions.map((permission) => (
          <div key={permission.id} className="table-row permissions-grid">
            <span>{permission.module}</span>
            <span>{permission.code}</span>
            <span>{permission.riskLevel}</span>
            <span>{permission.description ?? permission.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
