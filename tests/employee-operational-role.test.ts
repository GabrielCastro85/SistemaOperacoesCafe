import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("role de funcionario operacional (sem acesso de administrador)", () => {
  it("tem exatamente os codigos de permissao esperados, sem nada de usuarios/roles/configuracoes/auditoria", () => {
    const userData = mkdtempSync(join(tmpdir(), "operacoes-role-"));
    tempDirs.push(userData);
    const directories = resolveAppDirectories(userData);
    ensureAppDirectories(directories);
    const db = initializeDatabase(directories);

    const role = db.prepare("SELECT * FROM roles WHERE id = 'role-employee-operacional'").get() as { code: string; is_system: number } | undefined;
    expect(role?.code).toBe("EMPLOYEE_OPERACIONAL");
    expect(role?.is_system).toBe(1);

    const codes = (db.prepare(`
      SELECT permissions.code FROM role_permissions
      JOIN permissions ON permissions.id = role_permissions.permission_id
      WHERE role_permissions.role_id = 'role-employee-operacional'
      ORDER BY permissions.code
    `).all() as Array<{ code: string }>).map((row) => row.code);

    expect(codes).toEqual([
      "billing.manage",
      "commercial.manage",
      "commercial.view",
      "confirmations.manage",
      "finance.manage",
      "finance.view",
      "imports.manage",
      "operations.manage",
      "operations.view",
      "system.view"
    ]);

    for (const adminOnlyCode of ["users.view", "users.manage", "roles.view", "roles.manage", "settings.manage", "audit.view", "system.bootstrap"]) {
      expect(codes).not.toContain(adminOnlyCode);
    }

    db.close();
  });
});
