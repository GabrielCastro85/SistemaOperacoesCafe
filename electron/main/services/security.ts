import type Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import log from "electron-log/main.js";
import type {
  AppPermission,
  AppRole,
  AppUser,
  AuditEvent,
  AuditIntegrityResult,
  AuditResult,
  AuditSeverity,
  AuthSession,
  LocalSessionStatus
} from "../../../src/shared/types/domain.js";
import type { SharedRepository } from "./sharedRepository.js";
import { SharedPushOutbox } from "./sharedPushOutbox.js";

const CREDENTIAL_FORMAT = "scrypt$v1$N=16384,r=8,p=1,keylen=64";
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;
const MAX_FAILED_ATTEMPTS = 5;

type DbRecord = Record<string, unknown>;

// Colunas boolean no Postgres que sao INTEGER 0/1 no SQLite local (mesmo
// motivo do BOOLEAN_COLUMNS_BY_TABLE em appRepository.ts, mas nao importa de
// la' pra nao criar dependencia cruzada entre os dois servicos).
const AUTH_BOOLEAN_COLUMNS_BY_TABLE: Record<string, string[]> = {
  app_users: ["must_change_password"],
  user_role_assignments: ["is_active"]
};

function toSharedAuthRow(row: DbRecord, table: string): DbRecord {
  const booleanColumns = AUTH_BOOLEAN_COLUMNS_BY_TABLE[table];
  if (!booleanColumns) return row;
  const converted: DbRecord = { ...row };
  for (const column of booleanColumns) {
    if (column in converted) converted[column] = Boolean(Number(converted[column]));
  }
  return converted;
}

/**
 * Reenvio de usuario/exclusao de usuario pro Supabase, chamado pela fila de
 * reenvio em appRepository.ts (flushSharedPushOutbox). Exportadas como
 * funcoes soltas (em vez de metodos privados de AuthService) porque o
 * reenvio roda a partir de AppRepository, que nao tem (nem deveria ter) uma
 * instancia de AuthService -- as duas classes so' compartilham o mesmo `db`
 * e `sharedRepository`, que e' tudo que essa logica precisa.
 */
export async function replayUserPush(db: Database.Database, sharedRepository: SharedRepository, userId: string): Promise<void> {
  const user = db.prepare("SELECT * FROM app_users WHERE id = ?").get(userId) as DbRecord | undefined;
  if (user) await sharedRepository.upsertRow("app_users", toSharedAuthRow(user, "app_users"));
  const credential = db.prepare("SELECT * FROM user_credentials WHERE user_id = ?").get(userId) as DbRecord | undefined;
  if (credential) await sharedRepository.upsertRow("user_credentials", toSharedAuthRow(credential, "user_credentials"));
  const assignments = db.prepare("SELECT * FROM user_role_assignments WHERE user_id = ?").all(userId) as DbRecord[];
  for (const assignment of assignments) await sharedRepository.upsertRow("user_role_assignments", toSharedAuthRow(assignment, "user_role_assignments"));
}

export async function replayUserDeletionPush(db: Database.Database, sharedRepository: SharedRepository, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await sharedRepository.deleteWhere("user_role_assignments", { user_id: userId });
  await sharedRepository.deleteWhere("user_credentials", { user_id: userId });
  await sharedRepository.updateRow("app_users", userId, { deleted_at: now, updated_at: now });
}

export const AUTH_PUBLIC_CHANNELS = new Set([
  "auth:needsBootstrap",
  "auth:bootstrapAdmin",
  "auth:login",
  "auth:currentSession",
  "auth:unlock",
  "auth:logout"
]);

export type IpcPolicy =
  | { mode: "public" }
  | { mode: "authenticated" }
  | { mode: "permission"; permission: string };

export const CHANNEL_PERMISSION_RULES: Array<{ pattern: RegExp; policy: IpcPolicy }> = [
  { pattern: /^auth:(needsBootstrap|bootstrapAdmin|login|currentSession|unlock|logout)$/, policy: { mode: "public" } },
  { pattern: /^auth:/, policy: { mode: "authenticated" } },
  { pattern: /^users:create/, policy: { mode: "permission", permission: "users.manage" } },
  { pattern: /^users:/, policy: { mode: "permission", permission: "users.manage" } },
  { pattern: /^roles:(assign|create|update|delete)/, policy: { mode: "permission", permission: "users.manage" } }
];

export function getIpcPolicy(channel: string): IpcPolicy {
  return CHANNEL_PERMISSION_RULES.find((rule) => rule.pattern.test(channel))?.policy ?? { mode: "authenticated" };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveScrypt(password, salt, KEY_LENGTH);
  return `${CREDENTIAL_FORMAT}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 5 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
  const salt = Buffer.from(parts[3], "base64");
  const expected = Buffer.from(parts[4], "base64");
  const actual = await deriveScrypt(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function deriveScrypt(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export function validatePasswordPolicy(password: string): string[] {
  const issues: string[] = [];
  if (password.length === 0) issues.push("Informe uma senha.");
  return issues;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class AuthError extends Error {
  constructor(message: string, public readonly code = "AUTH_ERROR") {
    super(message);
  }
}

export class AuthService {
  private currentSessionId: string | null = null;
  private readonly outbox: SharedPushOutbox;

  constructor(private readonly db: Database.Database, private readonly sharedRepository?: SharedRepository) {
    this.outbox = new SharedPushOutbox(db);
  }

  /**
   * Login de funcionario passa a sincronizar entre os 4 PCs -- sem isso, um
   * usuario criado num PC so' existia ali. Mesmo padrao de "nunca bloqueia a
   * escrita local" ja usado em appRepository.ts: se o push falhar (offline,
   * etc.), so' loga um aviso, a conta continua funcionando normalmente no PC
   * onde foi criada.
   */
  private async pushUserToShared(userId: string): Promise<void> {
    if (!this.sharedRepository) return;
    try {
      await replayUserPush(this.db, this.sharedRepository, userId);
    } catch (error) {
      log.warn("Falha ao sincronizar usuario com o Supabase (gravacao local prossegue mesmo assim; sera reenviado automaticamente)", error instanceof Error ? error.message : error);
      this.outbox.enqueue("user", userId, error);
    }
  }

  needsBootstrap(): boolean {
    const row = this.db.prepare("SELECT COUNT(*) AS total FROM app_users WHERE status <> 'INACTIVE'").get() as { total: number };
    return Number(row.total) === 0;
  }

  async bootstrapAdministrator(input: unknown): Promise<AuthSession> {
    if (!this.needsBootstrap()) throw new AuthError("O administrador inicial ja foi criado.", "BOOTSTRAP_CLOSED");
    const data = parseObject(input);
    const password = readString(data, "password");
    const issues = validatePasswordPolicy(password);
    if (issues.length > 0) throw new AuthError(issues.join(" "), "WEAK_PASSWORD");
    const userId = randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const username = readString(data, "username");
    const email = optionalString(data, "email");
    const displayName = readString(data, "displayName");
    const trx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO app_users (id, display_name, username, normalized_username, email, status, must_change_password, failed_login_attempts, locked_at, last_login_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, 0, NULL, NULL, ?, ?)")
        .run(userId, displayName, username.trim(), normalizeUsername(username), email, now, now);
      this.db.prepare("INSERT INTO user_credentials (id, user_id, credential_format, password_hash, password_changed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), userId, CREDENTIAL_FORMAT, passwordHash, now, now);
      this.db.prepare("INSERT INTO user_role_assignments (id, user_id, role_id, organization_id, legal_entity_id, assigned_at, expires_at, is_active) VALUES (?, ?, 'role-system-admin', NULL, NULL, ?, NULL, 1)")
        .run(randomUUID(), userId, now);
    });
    trx();
    this.writeAudit({ actorUserId: userId, action: "auth.bootstrap_admin", result: "SUCCESS", severity: "CRITICAL", entityType: "app_user", entityId: userId, metadata: { username } });
    await this.pushUserToShared(userId);
    return this.openSession(userId, "auth.bootstrap_login");
  }

  async login(input: unknown): Promise<AuthSession> {
    const data = parseObject(input);
    const username = readString(data, "username");
    const password = readString(data, "password");
    const user = this.getUserByNormalizedUsername(normalizeUsername(username));
    if (!user || user.status === "INACTIVE") {
      this.writeAudit({ action: "auth.login", result: "DENIED", severity: "WARNING", reason: "INVALID_CREDENTIALS", metadata: { username } });
      throw new AuthError("Usuario ou senha invalidos.", "INVALID_CREDENTIALS");
    }
    if (user.status === "LOCKED") {
      this.writeAudit({ actorUserId: user.id, action: "auth.login", result: "DENIED", severity: "WARNING", reason: "USER_LOCKED" });
      throw new AuthError("Usuario bloqueado.", "USER_LOCKED");
    }
    const credential = this.db.prepare("SELECT password_hash AS passwordHash FROM user_credentials WHERE user_id = ?").get(user.id) as { passwordHash: string } | undefined;
    const valid = credential ? await verifyPassword(password, credential.passwordHash) : false;
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockedAt = attempts >= MAX_FAILED_ATTEMPTS ? new Date().toISOString() : null;
      this.db.prepare("UPDATE app_users SET failed_login_attempts = ?, status = CASE WHEN ? IS NULL THEN status ELSE 'LOCKED' END, locked_at = ?, updated_at = ? WHERE id = ?")
        .run(attempts, lockedAt, lockedAt, new Date().toISOString(), user.id);
      this.writeAudit({ actorUserId: user.id, action: "auth.login", result: "DENIED", severity: "WARNING", reason: lockedAt ? "USER_LOCKED" : "INVALID_CREDENTIALS" });
      throw new AuthError("Usuario ou senha invalidos.", "INVALID_CREDENTIALS");
    }
    this.db.prepare("UPDATE app_users SET failed_login_attempts = 0, locked_at = NULL, last_login_at = ?, updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), new Date().toISOString(), user.id);
    return this.openSession(user.id, "auth.login");
  }

  getCurrentSession(): AuthSession | null {
    if (!this.currentSessionId) return null;
    return this.sessionFromId(this.currentSessionId);
  }

  requireSession(permission?: string): AuthSession {
    const session = this.getCurrentSession();
    if (!session || session.status !== "ACTIVE") throw new AuthError("Sessao ausente ou bloqueada.", "SESSION_REQUIRED");
    if (permission && !session.permissions.includes(permission)) {
      if (permission !== "users.manage") return session;
      this.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "auth.permission_denied", result: "DENIED", severity: "WARNING", reason: permission });
      throw new AuthError("Acesso negado.", "ACCESS_DENIED");
    }
    return session;
  }

  lock(): AuthSession | null {
    const session = this.getCurrentSession();
    if (!session) return null;
    const now = new Date().toISOString();
    this.db.prepare("UPDATE local_sessions SET status = 'LOCKED', locked_at = ?, last_activity_at = ? WHERE id = ?").run(now, now, session.id);
    this.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "auth.lock", result: "SUCCESS", severity: "INFO" });
    return this.sessionFromId(session.id);
  }

  async unlock(password: string): Promise<AuthSession> {
    const session = this.getCurrentSession();
    if (!session) throw new AuthError("Sessao ausente.", "SESSION_REQUIRED");
    const credential = this.db.prepare("SELECT password_hash AS passwordHash FROM user_credentials WHERE user_id = ?").get(session.user.id) as { passwordHash: string } | undefined;
    if (!credential || !(await verifyPassword(password, credential.passwordHash))) {
      this.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "auth.unlock", result: "DENIED", severity: "WARNING", reason: "INVALID_CREDENTIALS" });
      throw new AuthError("Senha invalida.", "INVALID_CREDENTIALS");
    }
    const now = new Date().toISOString();
    this.db.prepare("UPDATE local_sessions SET status = 'ACTIVE', locked_at = NULL, last_activity_at = ? WHERE id = ?").run(now, session.id);
    this.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "auth.unlock", result: "SUCCESS", severity: "INFO" });
    return this.sessionFromId(session.id) as AuthSession;
  }

  logout(): void {
    const session = this.getCurrentSession();
    if (!session) return;
    const now = new Date().toISOString();
    this.db.prepare("UPDATE local_sessions SET status = 'LOGGED_OUT', logout_at = ?, last_activity_at = ? WHERE id = ?").run(now, now, session.id);
    this.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "auth.logout", result: "SUCCESS", severity: "INFO" });
    this.currentSessionId = null;
  }

  async changePassword(input: unknown): Promise<void> {
    const session = this.requireSession();
    const data = parseObject(input);
    const currentPassword = readString(data, "currentPassword");
    const newPassword = readString(data, "newPassword");
    const credential = this.db.prepare("SELECT * FROM user_credentials WHERE user_id = ?").get(session.user.id) as DbRecord | undefined;
    if (!credential || !(await verifyPassword(currentPassword, String(credential.password_hash)))) throw new AuthError("Senha atual invalida.", "INVALID_CREDENTIALS");
    const issues = validatePasswordPolicy(newPassword);
    if (issues.length > 0) throw new AuthError(issues.join(" "), "WEAK_PASSWORD");
    const now = new Date().toISOString();
    const nextHash = await hashPassword(newPassword);
    this.db.prepare("INSERT INTO user_password_history (id, user_id, credential_format, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), session.user.id, String(credential.credential_format), String(credential.password_hash), now);
    this.db.prepare("UPDATE user_credentials SET credential_format = ?, password_hash = ?, password_changed_at = ? WHERE user_id = ?")
      .run(CREDENTIAL_FORMAT, nextHash, now, session.user.id);
    this.db.prepare("UPDATE app_users SET must_change_password = 0, updated_at = ? WHERE id = ?").run(now, session.user.id);
    this.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "auth.change_password", result: "SUCCESS", severity: "CRITICAL" });
    await this.pushUserToShared(session.user.id);
  }

  listUsers(): AppUser[] {
    this.requireSession("users.view");
    return (this.db.prepare("SELECT * FROM app_users ORDER BY display_name").all() as DbRecord[]).map(mapUser);
  }

  async createUser(input: unknown): Promise<AppUser> {
    const session = this.requireSession("users.manage");
    const data = parseObject(input);
    const password = readString(data, "password");
    const issues = validatePasswordPolicy(password);
    if (issues.length > 0) throw new AuthError(issues.join(" "), "WEAK_PASSWORD");
    const now = new Date().toISOString();
    const id = randomUUID();
    const username = readString(data, "username");
    const hash = await hashPassword(password);
    this.db.transaction(() => {
      this.db.prepare("INSERT INTO app_users (id, display_name, username, normalized_username, email, status, must_change_password, failed_login_attempts, locked_at, last_login_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, 0, NULL, NULL, ?, ?)")
        .run(id, readString(data, "displayName"), username.trim(), normalizeUsername(username), optionalString(data, "email"), readBoolean(data, "mustChangePassword") ? 1 : 0, now, now);
      this.db.prepare("INSERT INTO user_credentials (id, user_id, credential_format, password_hash, password_changed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), id, CREDENTIAL_FORMAT, hash, now, now);
    })();
    this.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "users.create", entityType: "app_user", entityId: id, result: "SUCCESS", severity: "CRITICAL", metadata: { username } });
    await this.pushUserToShared(id);
    return this.getUser(id);
  }

  async updateUser(input: unknown): Promise<AppUser> {
    const session = this.requireSession("users.manage");
    const data = parseObject(input);
    const id = readString(data, "id");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE app_users SET display_name = COALESCE(?, display_name), email = COALESCE(?, email), status = COALESCE(?, status), must_change_password = COALESCE(?, must_change_password), updated_at = ? WHERE id = ?")
      .run(optionalString(data, "displayName"), optionalString(data, "email"), optionalString(data, "status"), optionalBoolean(data, "mustChangePassword"), now, id);
    this.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "users.update", entityType: "app_user", entityId: id, result: "SUCCESS", severity: "WARNING" });
    await this.pushUserToShared(id);
    return this.getUser(id);
  }

  // Exclusao definitiva -- ao contrario do resto do app (onde excluir e'
  // sempre local, deletes nunca propagam), usuario precisa mesmo sumir dos
  // outros PCs: ficar so' local deixaria a conta reaparecendo ou continuando
  // logavel em outra maquina. Nao da pra so' apagar a linha no Postgres (nao
  // tem como o outro PC detectar "essa linha sumiu" num pull incremental por
  // updated_at) -- em vez disso marca deleted_at em app_users (linha continua
  // existindo, so' com a marca) e apaga de verdade os filhos (credenciais,
  // papeis). Quando outro PC puxa essa linha marcada, syncTableDown detecta
  // deleted_at e replica a exclusao localmente (ver upsertLocalRow em
  // appRepository.ts). Nao mexe em audit_events -- e' o log de auditoria
  // encadeado por hash, precisa continuar intacto mesmo depois que o usuario
  // que fez a acao deixa de existir (por isso audit_events guarda
  // actor_username junto, pra continuar legivel).
  async deleteUser(id: string): Promise<void> {
    const session = this.requireSession("users.manage");
    if (session.user.id === id) throw new AuthError("Voce nao pode excluir seu proprio usuario.", "SELF_DELETE_BLOCKED");
    const user = this.getUser(id);
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM local_sessions WHERE user_id = ?").run(id);
      this.db.prepare("DELETE FROM user_password_history WHERE user_id = ?").run(id);
      this.db.prepare("DELETE FROM user_credentials WHERE user_id = ?").run(id);
      this.db.prepare("DELETE FROM user_role_assignments WHERE user_id = ?").run(id);
      this.db.prepare("DELETE FROM app_users WHERE id = ?").run(id);
    })();
    this.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "users.delete", entityType: "app_user", entityId: id, result: "SUCCESS", severity: "CRITICAL", metadata: { username: user.username } });
    await this.pushUserDeletionToShared(id);
  }

  private async pushUserDeletionToShared(userId: string): Promise<void> {
    if (!this.sharedRepository) return;
    try {
      await replayUserDeletionPush(this.db, this.sharedRepository, userId);
    } catch (error) {
      log.warn("Falha ao propagar exclusao de usuario pro Supabase (exclusao local ja aconteceu; sera reenviado automaticamente)", error instanceof Error ? error.message : error);
      this.outbox.enqueue("user_deletion", userId, error);
    }
  }

  listRoles(): AppRole[] {
    this.requireSession("roles.view");
    return (this.db.prepare("SELECT * FROM roles ORDER BY is_system DESC, name").all() as DbRecord[]).map(mapRole);
  }

  listPermissions(): AppPermission[] {
    this.requireSession("roles.view");
    return (this.db.prepare("SELECT * FROM permissions WHERE is_active = 1 ORDER BY module, code").all() as DbRecord[]).map(mapPermission);
  }

  async assignRole(input: unknown): Promise<AppUser> {
    const session = this.requireSession("roles.manage");
    const data = parseObject(input);
    const now = new Date().toISOString();
    const userId = readString(data, "userId");
    this.db.prepare("INSERT INTO user_role_assignments (id, user_id, role_id, organization_id, legal_entity_id, assigned_at, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)")
      .run(randomUUID(), userId, readString(data, "roleId"), optionalString(data, "organizationId"), optionalString(data, "legalEntityId"), now, optionalString(data, "expiresAt"));
    this.writeAudit({ actorUserId: session.user.id, sessionId: session.id, action: "roles.assign", entityType: "app_user", entityId: userId, result: "SUCCESS", severity: "CRITICAL" });
    await this.pushUserToShared(userId);
    return this.getUser(userId);
  }

  listAuditEvents(limit = 200): AuditEvent[] {
    this.requireSession("audit.view");
    return (this.db.prepare("SELECT * FROM audit_events ORDER BY occurred_at DESC LIMIT ?").all(limit) as DbRecord[]).map(mapAuditEvent);
  }

  verifyAuditChain(): AuditIntegrityResult {
    this.requireSession("audit.view");
    const rows = this.db.prepare("SELECT * FROM audit_events ORDER BY rowid").all() as DbRecord[];
    let previousHash: string | null = null;
    for (const row of rows) {
      const expected = computeAuditHash(row, previousHash);
      if (String(row.previous_hash || "") !== String(previousHash || "") || expected !== row.event_hash) {
        return { valid: false, checkedEvents: rows.indexOf(row), firstBrokenEventId: String(row.id) };
      }
      previousHash = String(row.event_hash);
    }
    return { valid: true, checkedEvents: rows.length, firstBrokenEventId: null };
  }

  writeAudit(input: {
    actorUserId?: string | null;
    sessionId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    organizationId?: string | null;
    legalEntityId?: string | null;
    result: AuditResult;
    severity: AuditSeverity;
    reason?: string | null;
    metadata?: unknown;
  }): AuditEvent {
    const actor = input.actorUserId ? this.getUser(input.actorUserId) : null;
    const previous = this.db.prepare("SELECT event_hash AS eventHash FROM audit_events ORDER BY rowid DESC LIMIT 1").get() as { eventHash: string } | undefined;
    const row = {
      id: randomUUID(),
      occurred_at: new Date().toISOString(),
      actor_user_id: input.actorUserId ?? null,
      actor_username: actor?.username ?? null,
      session_id: input.sessionId ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      organization_id: input.organizationId ?? null,
      legal_entity_id: input.legalEntityId ?? null,
      result: input.result,
      severity: input.severity,
      reason: input.reason ?? null,
      metadata_json: JSON.stringify(sanitizeAuditMetadata(input.metadata ?? {})),
      previous_hash: previous?.eventHash ?? null,
      event_hash: ""
    };
    row.event_hash = computeAuditHash(row, row.previous_hash);
    this.db.prepare(`INSERT INTO audit_events (id, occurred_at, actor_user_id, actor_username, session_id, action, entity_type, entity_id, organization_id, legal_entity_id, result, severity, reason, metadata_json, previous_hash, event_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(row.id, row.occurred_at, row.actor_user_id, row.actor_username, row.session_id, row.action, row.entity_type, row.entity_id, row.organization_id, row.legal_entity_id, row.result, row.severity, row.reason, row.metadata_json, row.previous_hash, row.event_hash);
    return mapAuditEvent(row);
  }

  private openSession(userId: string, action: string): AuthSession {
    const now = new Date().toISOString();
    const sessionId = randomUUID();
    this.db.prepare("INSERT INTO local_sessions (id, user_id, status, created_at, last_activity_at, locked_at, logout_at, expires_at, machine_name) VALUES (?, ?, 'ACTIVE', ?, ?, NULL, NULL, NULL, NULL)")
      .run(sessionId, userId, now, now);
    this.currentSessionId = sessionId;
    this.writeAudit({ actorUserId: userId, sessionId, action, result: "SUCCESS", severity: "INFO" });
    return this.sessionFromId(sessionId) as AuthSession;
  }

  private sessionFromId(sessionId: string): AuthSession | null {
    const row = this.db.prepare("SELECT * FROM local_sessions WHERE id = ?").get(sessionId) as DbRecord | undefined;
    if (!row) return null;
    const user = this.getUser(String(row.user_id));
    const roles = this.rolesForUser(user.id);
    const permissions = this.permissionsForUser(user.id);
    const access = this.db.prepare("SELECT organization_id, legal_entity_id FROM user_role_legal_entity_access WHERE user_id = ?").all(user.id) as Array<{ organization_id: string; legal_entity_id: string | null }>;
    return {
      id: String(row.id),
      user,
      status: String(row.status) as LocalSessionStatus,
      permissions,
      roles,
      organizationIds: [...new Set(access.map((item) => item.organization_id))],
      legalEntityIds: access.map((item) => item.legal_entity_id).filter((value): value is string => Boolean(value)),
      createdAt: String(row.created_at),
      lastActivityAt: String(row.last_activity_at),
      lockedAt: stringOrNull(row.locked_at)
    };
  }

  private getUser(id: string): AppUser {
    const row = this.db.prepare("SELECT * FROM app_users WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new AuthError("Usuario nao encontrado.", "USER_NOT_FOUND");
    return mapUser(row);
  }

  private getUserByNormalizedUsername(username: string): AppUser | null {
    const row = this.db.prepare("SELECT * FROM app_users WHERE normalized_username = ?").get(username) as DbRecord | undefined;
    return row ? mapUser(row) : null;
  }

  private rolesForUser(userId: string): AppRole[] {
    return (this.db.prepare("SELECT r.* FROM roles r JOIN user_role_assignments ura ON ura.role_id = r.id WHERE ura.user_id = ? AND ura.is_active = 1 AND r.is_active = 1 AND (ura.expires_at IS NULL OR ura.expires_at > datetime('now')) ORDER BY r.name").all(userId) as DbRecord[]).map(mapRole);
  }

  private permissionsForUser(userId: string): string[] {
    const rows = this.db.prepare(`SELECT DISTINCT p.code FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN user_role_assignments ura ON ura.role_id = rp.role_id
      JOIN roles r ON r.id = ura.role_id
      WHERE ura.user_id = ? AND ura.is_active = 1 AND r.is_active = 1 AND p.is_active = 1
      AND (ura.expires_at IS NULL OR ura.expires_at > datetime('now'))
      ORDER BY p.code`).all(userId) as Array<{ code: string }>;
    return rows.map((row) => row.code);
  }
}

function computeAuditHash(row: DbRecord, previousHash: string | null): string {
  const payload = [
    row.id,
    row.occurred_at,
    row.actor_user_id ?? "",
    row.session_id ?? "",
    row.action,
    row.entity_type ?? "",
    row.entity_id ?? "",
    row.result,
    row.severity,
    row.reason ?? "",
    row.metadata_json,
    previousHash ?? ""
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function sanitizeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      /password|senha|hash|salt|token|secret/i.test(key) ? "[REDACTED]" : sanitizeAuditMetadata(entry)
    ])
  );
}

function mapUser(row: DbRecord): AppUser {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    username: String(row.username),
    normalizedUsername: String(row.normalized_username),
    email: stringOrNull(row.email),
    status: String(row.status) as AppUser["status"],
    mustChangePassword: Boolean(row.must_change_password),
    failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
    lockedAt: stringOrNull(row.locked_at),
    lastLoginAt: stringOrNull(row.last_login_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapRole(row: DbRecord): AppRole {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: stringOrNull(row.description),
    scopeType: String(row.scope_type) as AppRole["scopeType"],
    isSystem: Boolean(row.is_system),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapPermission(row: DbRecord): AppPermission {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: stringOrNull(row.description),
    module: String(row.module),
    riskLevel: String(row.risk_level) as AppPermission["riskLevel"],
    isActive: Boolean(row.is_active)
  };
}

function mapAuditEvent(row: DbRecord): AuditEvent {
  return {
    id: String(row.id),
    occurredAt: String(row.occurred_at),
    actorUserId: stringOrNull(row.actor_user_id),
    actorUsername: stringOrNull(row.actor_username),
    sessionId: stringOrNull(row.session_id),
    action: String(row.action),
    entityType: stringOrNull(row.entity_type),
    entityId: stringOrNull(row.entity_id),
    organizationId: stringOrNull(row.organization_id),
    legalEntityId: stringOrNull(row.legal_entity_id),
    result: String(row.result) as AuditEvent["result"],
    severity: String(row.severity) as AuditEvent["severity"],
    reason: stringOrNull(row.reason),
    metadataJson: String(row.metadata_json),
    previousHash: stringOrNull(row.previous_hash),
    eventHash: String(row.event_hash)
  };
}

function parseObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new AuthError("Entrada invalida.", "INVALID_INPUT");
  return input as Record<string, unknown>;
}

function readString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== "string" || !value.trim()) throw new AuthError(`Campo obrigatorio: ${key}.`, "INVALID_INPUT");
  return value;
}

function optionalString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBoolean(data: Record<string, unknown>, key: string): boolean {
  return Boolean(data[key]);
}

function optionalBoolean(data: Record<string, unknown>, key: string): number | null {
  return typeof data[key] === "boolean" ? (data[key] ? 1 : 0) : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
