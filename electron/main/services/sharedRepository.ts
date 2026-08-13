import { createClient, type Session, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";
import type { AppDirectories } from "../../../src/shared/types/domain.js";

// Projeto unico ("Operacoes Cafe") compartilhado por todas as variantes do
// app (villa/grao/multiempresa) -- mesmo racional de buildVariants.ts para
// valores fixos por instalacao, sem necessidade de configuracao em runtime.
// A publishable key e' segura para embutir no app empacotado (e' o par
// publico da chave, protegido inteiramente por RLS -- ver migration 0004);
// a secret key NUNCA deve aparecer aqui, so' e' usada manualmente nos scripts
// de migracao em scripts/supabase/.
const SUPABASE_URL = "https://nughallusfqshtnrerha.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_oougmIpGXTX5Ws5EiFKiJg_LC0KqTn7";

/**
 * Adaptador de storage para a sessao do Supabase Auth rodando no processo
 * main do Electron -- supabase-js por padrao espera `window.localStorage`
 * (API de navegador), que nao existe em Node.js. Persiste em um arquivo
 * dentro de settingsDir (mesmo diretorio ja usado para outras preferencias
 * locais por instalacao, ver backupService.ts/brandingAssets.ts), pra manter
 * o usuario logado entre reinicios do app.
 */
class FileSessionStorage implements SupportedStorage {
  private readonly filePath: string;
  private cache: Record<string, string> | null = null;

  constructor(directories: AppDirectories) {
    this.filePath = join(directories.settingsDir, "supabase-session.json");
  }

  private load(): Record<string, string> {
    if (this.cache) return this.cache;
    if (!existsSync(this.filePath)) {
      this.cache = {};
      return this.cache;
    }
    try {
      this.cache = JSON.parse(readFileSync(this.filePath, "utf8")) as Record<string, string>;
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private persist(): void {
    if (!this.cache) return;
    mkdirSync(join(this.filePath, ".."), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.cache), "utf8");
  }

  getItem(key: string): string | null {
    return this.load()[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.load()[key] = value;
    this.persist();
  }

  removeItem(key: string): void {
    delete this.load()[key];
    this.persist();
  }
}

export interface SharedConnectivityStatus {
  online: boolean;
  authenticated: boolean;
  error: string | null;
}

type SharedRow = Record<string, unknown>;

function translateDbError(message: string): string {
  if (/JWT|not authenticated|auth session missing/i.test(message)) return "Sessao expirada. Faca login novamente.";
  if (/fetch failed|network|ENOTFOUND|ETIMEDOUT/i.test(message)) return "Sem conexao com o servidor. Tente novamente.";
  if (/new row violates row-level security policy/i.test(message)) return "Sem permissao para esta operacao.";
  if (/duplicate key value violates unique constraint/i.test(message)) return "Ja existe um registro com esses dados.";
  return message;
}

/**
 * Cliente Supabase para as tabelas compartilhadas entre os 4 PCs do
 * escritorio (ver plano de migracao). So' roda no processo main, nunca no
 * renderer -- mesmo padrao ja usado para a unica outra chamada de rede do
 * app (cnpjLookupService.ts). RLS (migration 0004) e' a autoridade real de
 * acesso: sem sessao autenticada (auth.uid() nulo), praticamente nenhuma
 * policy libera nada, entao metodos aqui so' funcionam de verdade apos
 * signInWithPassword.
 */
export class SharedRepository {
  readonly client: SupabaseClient;

  constructor(directories: AppDirectories) {
    this.client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: new FileSessionStorage(directories),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      // processo main roda em Node.js (via Electron), sem WebSocket nativo
      // nas versoes de Node < 22 que o Electron 33 empacota -- sem isso o
      // client inteiro falha ao construir (nem chega a ser usado nada de
      // realtime de fato, mas o SDK inicializa o RealtimeClient de qualquer
      // forma no construtor).
      realtime: {
        // "ws" e o WebSocket global do navegador tem assinaturas de
        // construtor incompativeis aos olhos do TS (o overload de endereco
        // "null" do tipo esperado pela lib e' so' um artefato do d.ts deles);
        // em runtime sao intercambiaveis para o que o RealtimeClient usa.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transport: WebSocket as any
      }
    });
  }

  async signInWithPassword(email: string, password: string): Promise<Session> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
    if (!data.session) throw new Error("Falha ao autenticar.");
    return data.session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw new Error(error.message);
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw new Error(error.message);
    return data.session;
  }

  /**
   * Checagem simples de conectividade + sessao, usada pela UI pra decidir
   * entre "sem conexao, tente novamente" e "faca login novamente" (decisao
   * do plano: sem fila offline nesta fase, so' aviso e retry manual).
   */
  async checkConnectivity(): Promise<SharedConnectivityStatus> {
    const session = await this.getSession().catch(() => null);
    if (!session) {
      return { online: true, authenticated: false, error: null };
    }
    const { error } = await this.client.from("organizations").select("id", { head: true, count: "exact" }).limit(1);
    if (error) {
      const offline = /fetch|network|timeout/i.test(error.message);
      return { online: !offline, authenticated: true, error: error.message };
    }
    return { online: true, authenticated: true, error: null };
  }

  /**
   * Helpers genericos de CRUD pra tabelas "de referencia" (organizations,
   * legal_entities, locations, products, service_rate_rules,
   * client_billing_profiles, ...) -- 1 tabela, sem sub-colecoes, sem RPC
   * necessaria. Tabelas com sub-colecoes atomicas (business_partners+roles)
   * ou write-heavy concorrente (fiscal_documents, client_charges, ...) usam
   * RPC dedicada (ver migration 0006) em vez destes helpers.
   */
  async listAll(table: string, orderBy: string): Promise<SharedRow[]> {
    const { data, error } = await this.client.from(table).select("*").order(orderBy);
    if (error) throw new Error(translateDbError(error.message));
    return data ?? [];
  }

  async getById(table: string, id: string): Promise<SharedRow | null> {
    const { data, error } = await this.client.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(translateDbError(error.message));
    return data;
  }

  async findOne(table: string, match: SharedRow): Promise<SharedRow | null> {
    const { data, error } = await this.client.from(table).select("*").match(match).maybeSingle();
    if (error) throw new Error(translateDbError(error.message));
    return data;
  }

  async insertRow(table: string, row: SharedRow): Promise<SharedRow> {
    const { data, error } = await this.client.from(table).insert(row).select().single();
    if (error) throw new Error(translateDbError(error.message));
    return data;
  }

  async updateRow(table: string, id: string, patch: SharedRow): Promise<SharedRow> {
    const { data, error } = await this.client.from(table).update(patch).eq("id", id).select().single();
    if (error) throw new Error(translateDbError(error.message));
    return data;
  }

  /**
   * Grava o estado atual de uma linha, exista ou nao no Supabase ainda --
   * usado pelo padrao "escreve local primeiro (sincrono, sem mudar logica de
   * negocio), depois empurra o resultado inteiro" (ex: importacao de XML,
   * cujo fluxo local roda dentro de uma transacao SQLite sincrona demais pra
   * intercalar chamadas de rede).
   */
  async upsertRow(table: string, row: SharedRow): Promise<SharedRow> {
    const { data, error } = await this.client.from(table).upsert(row).select().single();
    if (error) throw new Error(translateDbError(error.message));
    return data;
  }

  /**
   * Igual upsertRow, mas em lote -- usado pra empurrar cadastros locais ja
   * existentes de uma vez (ver pushAllLocalReferenceDataToShared). `onConflict`
   * so' e' necessario pra tabelas onde o Postgres gera seu proprio id (ex:
   * business_partner_roles) -- nelas o upsert precisa mirar a chave natural
   * (coluna(s) unicas de verdade), senao vira sempre um INSERT novo.
   */
  async upsertRows(table: string, rows: SharedRow[], onConflict?: string): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.client.from(table).upsert(rows, onConflict ? { onConflict } : undefined);
    if (error) throw new Error(translateDbError(error.message));
  }

  async deleteWhere(table: string, match: SharedRow): Promise<void> {
    const { error } = await this.client.from(table).delete().match(match);
    if (error) throw new Error(translateDbError(error.message));
  }

  /**
   * Sobe uma copia de um arquivo ja gerado localmente (PDF/planilha de
   * confirmacao ou cobranca) pro Supabase Storage -- usado pelo app de
   * visualizacao (celular), que nunca enxerga o HD do PC. `upsert: true`
   * porque o mesmo caminho pode ser gerado de novo (ex: regenerateChargeDocuments
   * chamado varias vezes pra mesma versao).
   */
  async uploadFile(bucket: string, path: string, data: Buffer, contentType: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).upload(path, data, { contentType, upsert: true });
    if (error) throw new Error(translateDbError(error.message));
  }

  /**
   * Puxa linhas alteradas desde `sinceIso` (por `timestampColumn`, tipicamente
   * updated_at ou created_at) -- base do sync poll-based que mantem o cache
   * local das tabelas "quentes" (fiscal_documents, operations, xml_import_*,
   * client_charges, ...) ao corrente do que outros PCs lancaram, sem exigir
   * que toda leitura vire uma chamada de rede. Paginado (1000 por vez) pra
   * nao estourar payload numa primeira sincronizacao com historico grande.
   */
  async pullChangesSince(table: string, timestampColumn: string, sinceIso: string): Promise<SharedRow[]> {
    const pageSize = 1000;
    const rows: SharedRow[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await this.client
        .from(table)
        .select("*")
        .gt(timestampColumn, sinceIso)
        .order(timestampColumn, { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(translateDbError(error.message));
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return rows;
  }

  async rpc<T = unknown>(fn: string, args: SharedRow): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new Error(translateDbError(error.message));
    return data as T;
  }
}

function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha invalidos.";
  if (/email not confirmed/i.test(message)) return "E-mail ainda nao confirmado.";
  return message;
}
