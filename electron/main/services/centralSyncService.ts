import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import log from "electron-log/main.js";

const API_URL = "https://mindful-peace-production.up.railway.app";
const SYNC_INTERVAL_MS = 8_000;
const MUTATION_SYNC_DELAY_MS = 750;
export const CENTRAL_SYNCED_TABLES = [
  "organizations", "legal_entities", "locations", "document_sequences",
  "business_partners", "business_partner_roles", "business_partner_merges", "partner_legal_entities",
  "partner_company_links", "partner_contacts", "partner_aliases", "client_billing_profiles",
  "products", "product_aliases", "service_rate_rules", "purchase_rate_rules", "operation_rate_history",
  "operation_classification_rules", "fiscal_documents", "fiscal_document_items", "fiscal_document_events",
  "fiscal_document_returns", "fiscal_document_merge_history", "operations", "third_party_operations",
  "client_charges", "client_charge_operations", "client_charge_adjustments", "charge_status_history",
  "client_ledger_entries", "client_credit_allocations", "client_payments", "client_payment_allocations",
  "expense_categories", "cost_centers", "financial_accounts", "accounts_payable", "account_payable_operations",
  "account_payable_allocations", "payable_recurring_templates", "payable_installment_groups", "payable_payments",
  "payable_payment_allocations", "payable_status_history", "deal_clause_templates", "deal_confirmation_templates",
  "deal_confirmations", "deal_confirmation_parties", "deal_confirmation_signers", "deal_confirmation_items",
  "deal_confirmation_clauses", "deal_confirmation_operations", "deal_confirmation_fiscal_documents",
  "deal_confirmation_status_history", "deal_payment_terms", "spreadsheet_mapping_templates", "xml_import_jobs",
  "xml_import_files"
] as const;

type JsonRecord = Record<string, unknown>;
type CentralRecord = { table: string; key: string; data: JsonRecord; sha256: string; revision: number };
type CentralChange = { revision: number; sequence: number; table: string; key: string; operation: "UPSERT" | "DELETE"; data: JsonRecord | null; sha256: string | null };
type LocalRow = { table: string; key: string; data: JsonRecord; sha256: string };
export interface CentralDesktopProfile {
  localUserId: string;
  displayName: string;
  username: string;
  email: string | null;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  mustChangePassword: boolean;
  roleAssignments: Array<{ roleId: string; organizationId: string | null; legalEntityId: string | null; assignedAt: string; expiresAt: string | null; isActive: boolean }>;
  legalEntityAccess: Array<{ organizationId: string; legalEntityId: string | null; accessMode: "ALL" | "SPECIFIC" }>;
}

function jsonValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return { $binaryBase64: value.toString("base64") };
  if (typeof value === "bigint") return value.toString();
  return value;
}

function sqliteValue(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value) && "$binaryBase64" in value) {
    return Buffer.from(String((value as { $binaryBase64: unknown }).$binaryBase64), "base64");
  }
  return value;
}

function normalizedRow(row: JsonRecord): JsonRecord {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, jsonValue(value)]));
}

function stableJson(value: JsonRecord): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

function hashRow(value: JsonRecord): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function rowKey(value: JsonRecord): string {
  if (typeof value.id === "string" && value.id) return value.id;
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function quoteIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) throw new Error(`Identificador SQLite invalido: ${value}`);
  return `"${value}"`;
}

export class CentralSyncService {
  private token: string | null = null;
  private timer: NodeJS.Timeout | null = null;
  private mutationTimer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private rerunRequested = false;
  private initialized = false;
  private readonly tableColumns = new Map<string, Set<string>>();
  private readonly primaryKeys = new Map<string, string[]>();

  constructor(private readonly db: Database.Database, private readonly appVersion: string) {}

  getStatus(): { status: "ONLINE" | "OFFLINE" | "ERROR"; revision: number; lastSuccessAt: string | null; error: string | null } {
    const row = this.db.prepare(`
      SELECT server_revision AS revision, last_success_at AS lastSuccessAt, last_error AS error
      FROM central_sync_state WHERE singleton = 1
    `).get() as { revision: number; lastSuccessAt: string | null; error: string | null };
    return {
      status: row.error ? "ERROR" : this.token ? "ONLINE" : "OFFLINE",
      revision: Number(row.revision),
      lastSuccessAt: row.lastSuccessAt,
      error: row.error
    };
  }

  async login(username: string, password: string): Promise<CentralDesktopProfile | null> {
    const installationId = this.getInstallationId() ?? `unconfigured-${randomUUID()}`;
    const response = await this.request<{ token: string; user: { desktopProfile?: CentralDesktopProfile | null } }>("/v1/session/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        device: { installationId, displayName: "Operacoes Cafe Desktop", platform: process.platform, appVersion: this.appVersion }
      })
    }, false);
    this.token = response.token;
    this.start();
    try {
      await this.synchronize();
    } catch (error) {
      log.warn("Central sync during login failed", error instanceof Error ? error.message : String(error));
    }
    return response.user?.desktopProfile ?? null;
  }

  async publishLocalUsers(): Promise<void> {
    if (!this.token || !this.tableExists("app_users")) return;
    const users = this.db.prepare("SELECT * FROM app_users ORDER BY created_at").all() as JsonRecord[];
    const payload = users.flatMap((user) => {
      const credential = this.db.prepare("SELECT * FROM user_credentials WHERE user_id = ?").get(user.id) as JsonRecord | undefined;
      if (!credential) return [];
      const roles = this.db.prepare("SELECT * FROM user_role_assignments WHERE user_id = ?").all(user.id) as JsonRecord[];
      const access = this.db.prepare("SELECT * FROM user_role_legal_entity_access WHERE user_id = ?").all(user.id) as JsonRecord[];
      return [{
        localUserId: String(user.id), displayName: String(user.display_name), username: String(user.username),
        email: user.email ? String(user.email) : null, status: String(user.status), mustChangePassword: Boolean(user.must_change_password),
        roleAssignments: roles.map((role) => ({ roleId: String(role.role_id), organizationId: role.organization_id ? String(role.organization_id) : null, legalEntityId: role.legal_entity_id ? String(role.legal_entity_id) : null, assignedAt: String(role.assigned_at), expiresAt: role.expires_at ? String(role.expires_at) : null, isActive: Boolean(role.is_active) })),
        legalEntityAccess: access.map((item) => ({ organizationId: String(item.organization_id), legalEntityId: item.legal_entity_id ? String(item.legal_entity_id) : null, accessMode: String(item.access_mode) })),
        credential: { format: String(credential.credential_format), passwordHash: String(credential.password_hash), passwordChangedAt: String(credential.password_changed_at) }
      }];
    });
    await this.request("/v1/users/synchronize", { method: "POST", body: JSON.stringify({ users: payload }) });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request("/v1/session/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.mutationTimer) clearTimeout(this.mutationTimer);
    this.timer = null;
    this.mutationTimer = null;
    this.token = null;
    this.initialized = false;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.synchronize().catch((error) => {
      log.warn("Central sync interval failed", error instanceof Error ? error.message : String(error));
    }), SYNC_INTERVAL_MS);
    this.timer.unref();
  }

  scheduleSynchronization(): void {
    if (!this.token) return;
    if (this.mutationTimer) clearTimeout(this.mutationTimer);
    this.mutationTimer = setTimeout(() => {
      this.mutationTimer = null;
      void this.synchronize().catch((error) => {
        log.warn("Central sync after mutation failed", error instanceof Error ? error.message : String(error));
      });
    }, MUTATION_SYNC_DELAY_MS);
    this.mutationTimer.unref();
  }

  async synchronize(): Promise<void> {
    if (!this.token) return;
    if (this.running) {
      this.rerunRequested = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.rerunRequested = false;
        await this.runSynchronization();
      } while (this.rerunRequested);
    })().finally(() => { this.running = null; });
    return this.running;
  }

  private async runSynchronization(): Promise<void> {
    try {
      if (!this.initialized) await this.initializeFromServer();
      await this.pullRemoteChanges();
      await this.pushLocalChanges();
      await this.pullRemoteChanges();
      this.db.prepare("UPDATE central_sync_state SET last_success_at = ?, last_error = NULL WHERE singleton = 1").run(new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.db.prepare("UPDATE central_sync_state SET last_error = ? WHERE singleton = 1").run(message.slice(0, 2000));
      throw error;
    }
  }

  private async initializeFromServer(): Promise<void> {
    const status = await this.request<{ revision: number; sourceInstallationId: string | null; recordCount: number }>("/v1/sync/status");
    if (!status.recordCount) throw new Error("A base central ainda nao foi inicializada.");
    const localState = this.db.prepare("SELECT server_revision AS serverRevision, source_installation_id AS sourceInstallationId FROM central_sync_state WHERE singleton = 1").get() as { serverRevision: number; sourceInstallationId: string | null };
    if (localState.sourceInstallationId && localState.serverRevision > 0) {
      this.initialized = true;
      return;
    }

    const records: CentralRecord[] = [];
    let cursor: number | null = 0;
    let snapshotRevision = status.revision;
    while (cursor !== null) {
      const page: { revision: number; records: CentralRecord[]; nextCursor: number | null } = await this.request(`/v1/sync/bootstrap?cursor=${cursor}&limit=1000`);
      snapshotRevision = page.revision;
      records.push(...page.records);
      cursor = page.nextCursor;
    }

    const installationId = this.getInstallationId();
    const isSourceInstallation = Boolean(installationId && installationId === status.sourceInstallationId);
    if (!isSourceInstallation) this.replaceLocalBusinessData(records);
    this.replaceBaseline(records);
    this.db.prepare(`
      UPDATE central_sync_state SET server_revision = ?, source_installation_id = ?, last_success_at = ?, last_error = NULL WHERE singleton = 1
    `).run(snapshotRevision, status.sourceInstallationId, new Date().toISOString());
    this.initialized = true;
  }

  private async pullRemoteChanges(): Promise<void> {
    let revision = this.getServerRevision();
    let sequence = 0;
    while (true) {
      const page: { currentRevision: number; changes: CentralChange[]; next: { revision: number; sequence: number } | null } =
        await this.request(`/v1/sync/changes?after=${revision}&sequence=${sequence}&limit=1000`);
      if (page.changes.length) this.applyRemoteChanges(page.changes);
      if (!page.next) {
        this.setServerRevision(page.currentRevision);
        return;
      }
      revision = page.next.revision;
      sequence = page.next.sequence;
    }
  }

  private async pushLocalChanges(): Promise<void> {
    const local = this.scanLocalRows();
    const baselineRows = this.db.prepare("SELECT table_name AS tableName, row_key AS rowKey, row_sha256 AS sha256 FROM central_sync_baseline").all() as Array<{ tableName: string; rowKey: string; sha256: string }>;
    const baseline = new Map(baselineRows.map((row) => [`${row.tableName}\u0000${row.rowKey}`, row.sha256]));
    const changes: Array<{ table: string; key: string; operation: "UPSERT" | "DELETE"; data?: JsonRecord }> = [];
    for (const row of local.values()) {
      const identity = `${row.table}\u0000${row.key}`;
      if (baseline.get(identity) !== row.sha256) changes.push({ table: row.table, key: row.key, operation: "UPSERT", data: row.data });
      baseline.delete(identity);
    }
    for (const identity of baseline.keys()) {
      const separator = identity.indexOf("\u0000");
      changes.push({ table: identity.slice(0, separator), key: identity.slice(separator + 1), operation: "DELETE" });
    }

    for (let index = 0; index < changes.length; index += 1000) {
      const batch = changes.slice(index, index + 1000);
      await this.request<{ revision: number }>("/v1/sync/push", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: randomUUID(), baseRevision: this.getServerRevision(), changes: batch })
      });
      this.updateBaselineForLocalBatch(batch);
    }
  }

  private replaceLocalBusinessData(records: CentralRecord[]): void {
    this.withForeignKeysSuspended(() => {
      for (const table of [...CENTRAL_SYNCED_TABLES].reverse()) {
        if (this.tableExists(table)) this.db.prepare(`DELETE FROM ${quoteIdentifier(table)}`).run();
      }
      for (const record of records) this.upsertRow(record.table, record.data);
    });
  }

  private applyRemoteChanges(changes: CentralChange[]): void {
    this.withForeignKeysSuspended(() => {
      for (const change of changes) {
        if (change.operation === "UPSERT" && change.data) this.upsertRow(change.table, change.data);
        else this.deleteRow(change.table, change.key);
      }
    });
    const statement = this.db.prepare(`
      INSERT INTO central_sync_baseline(table_name, row_key, row_sha256) VALUES (?, ?, ?)
      ON CONFLICT(table_name, row_key) DO UPDATE SET row_sha256 = excluded.row_sha256
    `);
    const remove = this.db.prepare("DELETE FROM central_sync_baseline WHERE table_name = ? AND row_key = ?");
    const update = this.db.transaction(() => {
      for (const change of changes) {
        if (change.operation === "DELETE") remove.run(change.table, change.key);
        else statement.run(change.table, change.key, change.sha256 ?? hashRow(change.data ?? {}));
      }
    });
    update();
  }

  private withForeignKeysSuspended(callback: () => void): void {
    this.db.pragma("foreign_keys = OFF");
    try {
      const transaction = this.db.transaction(() => {
        callback();
        const violations = this.db.pragma("foreign_key_check") as unknown[];
        if (violations.length) throw new Error(`A sincronizacao produziria ${violations.length} violacao(oes) de relacionamento.`);
      });
      transaction();
    } finally {
      this.db.pragma("foreign_keys = ON");
    }
  }

  private upsertRow(table: string, data: JsonRecord): void {
    if (!this.tableExists(table)) return;
    const allowed = this.columnsFor(table);
    const entries = Object.entries(data).filter(([column]) => allowed.has(column));
    if (!entries.length) return;
    const columns = entries.map(([column]) => quoteIdentifier(column));
    const placeholders = entries.map(() => "?");
    this.db.prepare(`INSERT OR REPLACE INTO ${quoteIdentifier(table)} (${columns.join(",")}) VALUES (${placeholders.join(",")})`)
      .run(...entries.map(([, value]) => sqliteValue(value)));
  }

  private deleteRow(table: string, key: string): void {
    if (!this.tableExists(table)) return;
    const columns = this.columnsFor(table);
    if (columns.has("id")) {
      this.db.prepare(`DELETE FROM ${quoteIdentifier(table)} WHERE id = ?`).run(key);
      return;
    }
    const match = (this.db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all() as JsonRecord[])
      .find((row) => rowKey(normalizedRow(row)) === key);
    if (!match) return;
    const primaryKeys = this.primaryKeysFor(table);
    if (!primaryKeys.length) throw new Error(`Tabela ${table} sem chave primaria sincronizavel.`);
    this.db.prepare(`DELETE FROM ${quoteIdentifier(table)} WHERE ${primaryKeys.map((column) => `${quoteIdentifier(column)} = ?`).join(" AND ")}`)
      .run(...primaryKeys.map((column) => match[column]));
  }

  private scanLocalRows(): Map<string, LocalRow> {
    const result = new Map<string, LocalRow>();
    for (const table of CENTRAL_SYNCED_TABLES) {
      if (!this.tableExists(table)) continue;
      for (const raw of this.db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all() as JsonRecord[]) {
        const data = normalizedRow(raw);
        const key = rowKey(data);
        result.set(`${table}\u0000${key}`, { table, key, data, sha256: hashRow(data) });
      }
    }
    return result;
  }

  private replaceBaseline(records: CentralRecord[]): void {
    const insert = this.db.prepare("INSERT INTO central_sync_baseline(table_name, row_key, row_sha256) VALUES (?, ?, ?)");
    const transaction = this.db.transaction(() => {
      this.db.prepare("DELETE FROM central_sync_baseline").run();
      for (const record of records) insert.run(record.table, record.key, record.sha256);
    });
    transaction();
  }

  private updateBaselineForLocalBatch(changes: Array<{ table: string; key: string; operation: "UPSERT" | "DELETE"; data?: JsonRecord }>): void {
    const upsert = this.db.prepare(`INSERT INTO central_sync_baseline(table_name, row_key, row_sha256) VALUES (?, ?, ?)
      ON CONFLICT(table_name, row_key) DO UPDATE SET row_sha256 = excluded.row_sha256`);
    const remove = this.db.prepare("DELETE FROM central_sync_baseline WHERE table_name = ? AND row_key = ?");
    const transaction = this.db.transaction(() => {
      for (const change of changes) {
        if (change.operation === "DELETE") remove.run(change.table, change.key);
        else upsert.run(change.table, change.key, hashRow(change.data ?? {}));
      }
    });
    transaction();
  }

  private columnsFor(table: string): Set<string> {
    const cached = this.tableColumns.get(table);
    if (cached) return cached;
    const columns = new Set((this.db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>).map((column) => column.name));
    this.tableColumns.set(table, columns);
    return columns;
  }

  private primaryKeysFor(table: string): string[] {
    const cached = this.primaryKeys.get(table);
    if (cached) return cached;
    const keys = (this.db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string; pk: number }>)
      .filter((column) => column.pk > 0).sort((left, right) => left.pk - right.pk).map((column) => column.name);
    this.primaryKeys.set(table, keys);
    return keys;
  }

  private tableExists(table: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
  }

  private getInstallationId(): string | null {
    if (!this.tableExists("installation_profiles")) return null;
    const row = this.db.prepare("SELECT id FROM installation_profiles ORDER BY created_at LIMIT 1").get() as { id: string } | undefined;
    return row?.id ?? null;
  }

  private getServerRevision(): number {
    const row = this.db.prepare("SELECT server_revision AS revision FROM central_sync_state WHERE singleton = 1").get() as { revision: number };
    return Number(row.revision);
  }

  private setServerRevision(revision: number): void {
    this.db.prepare("UPDATE central_sync_state SET server_revision = ? WHERE singleton = 1").run(revision);
  }

  private async request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    if (authenticated) {
      if (!this.token) throw new Error("Sessao central ausente.");
      headers.set("authorization", `Bearer ${this.token}`);
    }
    const requestInit = { ...init, headers };
    if (requestInit.method && requestInit.method !== "GET" && requestInit.body === undefined) requestInit.body = "{}";
    const response = await fetch(`${API_URL}${path}`, requestInit);
    const text = await response.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; }
    catch { body = { message: text }; }
    if (!response.ok) {
      const detail = body && typeof body === "object" && "message" in body ? String((body as { message: unknown }).message) : text;
      throw new Error(`Servidor central (${response.status}): ${detail || "falha na requisicao"}`);
    }
    return body as T;
  }
}
