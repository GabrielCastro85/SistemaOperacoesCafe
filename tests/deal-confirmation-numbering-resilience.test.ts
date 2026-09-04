// Bateria obrigatoria da correcao de numeracao atomica de confirmacoes (ver
// ensureDealConfirmationNumberOnServer/reserveDealConfirmationNumberOnServer
// em appRepository.ts, espelhando supabase/migrations/0019-0021). Cobre os
// cenarios exigidos: criar rascunho, fechar/reabrir, gerar previa, emitir,
// cancelar, criar o proximo, queda de rede em cada ponto do fluxo (antes do
// push, depois do push, depois da reserva), clique duplo em previa/emissao,
// numero ja pertencente a outro UUID, sharedRepository ausente e Supabase
// indisponivel. Em todo cenario valida: mesmo UUID, um unico numero por
// confirmacao, numero nunca reutilizado, nenhuma exclusao/renumeracao
// silenciosa.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import type { SharedRepository } from "../electron/main/services/sharedRepository";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

// Mesma simulacao de supabase de tests/deal-confirmations.test.ts, com pontos
// de falha controlaveis pra reproduzir queda de rede em cada etapa do fluxo
// (push do cabecalho, RPC de reserva, releitura de verificacao).
class ControllableFakeSharedRepository {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();
  private sequences = new Map<string, number>();
  private reservations = new Map<string, { number: string; sequence: number }>();
  private failNextUpsertCount = 0;
  private failNextRpcCount = 0;
  private failNextFindOneCount = 0;

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });
  getSession = async () => ({ user: { email: "teste@operacoescafe.com" } }) as never;

  failNextUpsert(count: number): void {
    this.failNextUpsertCount = count;
  }

  failNextRpc(count: number): void {
    this.failNextRpcCount = count;
  }

  failNextFindOne(count: number): void {
    this.failNextFindOneCount = count;
  }

  async findOne(table: string, match: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (this.failNextFindOneCount > 0) {
      this.failNextFindOneCount -= 1;
      throw new Error("Falha simulada de rede ao consultar o Supabase");
    }
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows.find((row) => Object.entries(match).every(([key, value]) => String(row[key] ?? "") === String(value ?? ""))) ?? null;
  }

  async listAll(table: string): Promise<Array<Record<string, unknown>>> {
    return [...(this.tables.get(table)?.values() ?? [])];
  }

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (table === "deal_confirmations" && this.failNextUpsertCount > 0) {
      this.failNextUpsertCount -= 1;
      throw new Error("Falha simulada de rede ao enviar a confirmacao");
    }
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    const stored = { ...row };
    this.tables.get(table)!.set(String(row.id), stored);
    return stored;
  }

  async upsertRows(table: string, rows: Array<Record<string, unknown>>): Promise<void> {
    for (const row of rows) await this.upsertRow(table, row);
  }

  async updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = this.tables.get(table)?.get(id) ?? { id };
    const updated = { ...existing, ...patch, id };
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    this.tables.get(table)!.set(id, updated);
    return updated;
  }

  async deleteWhere(table: string, match: Record<string, unknown>): Promise<void> {
    const rows = this.tables.get(table);
    if (!rows) return;
    const [key, value] = Object.entries(match)[0];
    for (const [id, row] of [...rows.entries()]) if (row[key] === value) rows.delete(id);
  }

  async pullChangesSince(table: string, timestampColumn: string, since: string): Promise<Array<Record<string, unknown>>> {
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows.filter((row) => String(row[timestampColumn]) > since);
  }

  // Permite simular um numero ja "pertencente" a outro UUID, como se um
  // outro PC tivesse reservado antes deste teste rodar.
  seedConfirmationNumber(confirmationId: string, organizationId: string, ownLegalEntityId: string, number: string): void {
    if (!this.tables.has("deal_confirmations")) this.tables.set("deal_confirmations", new Map());
    this.tables.get("deal_confirmations")!.set(confirmationId, {
      id: confirmationId,
      organization_id: organizationId,
      own_legal_entity_id: ownLegalEntityId,
      confirmation_number: number
    });
    const match = number.match(/(\d+)\s*$/);
    if (match) this.reservations.set(confirmationId, { number, sequence: Number(match[1]) });
  }

  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    if (this.failNextRpcCount > 0) {
      this.failNextRpcCount -= 1;
      throw new Error("Falha simulada de rede ao chamar a RPC de reserva");
    }
    if (name !== "ensure_deal_confirmation_number") throw new Error(`RPC nao simulada no teste: ${name}`);
    const confirmationId = String(args.p_confirmation_id);
    const organizationId = String(args.p_organization_id);
    const entityId = String(args.p_own_legal_entity_id);
    const year = Number(args.p_year);
    const prefix = String(args.p_prefix);
    const padding = Number(args.p_padding ?? 4);
    const confirmations = this.tables.get("deal_confirmations") ?? new Map();
    const current = confirmations.get(confirmationId);
    if (!current) throw new Error(`Confirmation ${confirmationId} is missing, belongs to another company, or is no longer editable`);

    const conflictsWith = (number: string): boolean =>
      [...confirmations.values()].some((row) => String(row.id) !== confirmationId && String(row.confirmation_number ?? "") === number);

    if (typeof current.confirmation_number === "string" && current.confirmation_number && conflictsWith(current.confirmation_number)) {
      current.confirmation_number = null;
    }

    const existingReservation = this.reservations.get(confirmationId);
    if (existingReservation && !conflictsWith(existingReservation.number)) {
      current.confirmation_number = existingReservation.number;
      current.temporary_reference = existingReservation.number;
      return [{ confirmation_number: existingReservation.number, sequence_number: existingReservation.sequence }] as unknown as T;
    }
    if (existingReservation) this.reservations.delete(confirmationId);

    const seqKey = `${organizationId}|${entityId}|${year}|${prefix}`;
    const highestFromConfirmations = [...confirmations.values()].reduce((max, row) => {
      const match = typeof row.confirmation_number === "string" ? row.confirmation_number.match(/(\d+)\s*$/) : null;
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    const highestFromReservations = [...this.reservations.values()].reduce((max, entry) => Math.max(max, entry.sequence), 0);
    const next = Math.max(this.sequences.get(seqKey) ?? 0, highestFromConfirmations, highestFromReservations) + 1;
    this.sequences.set(seqKey, next);
    const number = `${prefix}${String(next).padStart(padding, "0")}`;
    this.reservations.set(confirmationId, { number, sequence: next });
    current.confirmation_number = number;
    current.temporary_reference = number;
    return [{ confirmation_number: number, sequence_number: next }] as unknown as T;
  }
}

async function setup(cloud: ControllableFakeSharedRepository | undefined) {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-deals-resilience-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs, cloud as unknown as SharedRepository | undefined);
  repo.saveInstallationProfile({ installationName: "Villa", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const seller = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Villa Coffee Vendedora", notes: null, roles: ["SELLER"], isActive: true });
  const buyer = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Empresa IF Compradora", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  return { repo, db, seller, buyer, product };
}

function itemInput(dealConfirmationId: string, productId: string) {
  return {
    dealConfirmationId,
    sortOrder: 0,
    productId,
    productNameSnapshot: "Cafe",
    productDescriptionSnapshot: "Cafe arabica",
    cropSnapshot: "2026",
    qualitySnapshot: "Bebida dura",
    packagingSnapshot: "Sacas de juta",
    originSnapshot: "Sul de Minas",
    destinationSnapshot: "Armazem Sul",
    quantitySacksDecimal: "10",
    sackWeightKgDecimal: "60",
    unitPriceDecimal: "1000",
    totalAmountCents: null,
    totalOverrideReason: null,
    deliveryStartDate: "2026-07-20",
    deliveryEndDate: "2026-07-30",
    deliveryLocationSnapshot: "Armazem Sul",
    notes: null
  };
}

function buildMinimalDraft(repo: AppRepository, sellerId: string, buyerId: string, productId: string) {
  const draft = repo.createDealConfirmationDraft({ organizationId: villaId, ownLegalEntityId, confirmationDate: "2026-07-17", paymentTermsSnapshot: "A vista", deliveryLocationSnapshot: "Armazem", qualityTermsSnapshot: "Padrao", generalTermsSnapshot: "Revisado" });
  repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: sellerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
  repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
  repo.addDealConfirmationItem(itemInput(draft.confirmation.id, productId));
  repo.addDealConfirmationClause({ dealConfirmationId: draft.confirmation.id, clauseNumber: "1", title: "Demo", clauseText: "Texto demonstrativo.", sortOrder: 0, isVisible: true });
  return draft;
}

describe("bateria obrigatoria: numeracao atomica de confirmacoes", () => {
  it("cria rascunho sem numero (RASCUNHO-xxxxxxxx), fecha/reabre e mantem o mesmo estado", async () => {
    const cloud = new ControllableFakeSharedRepository();
    const { repo, db, seller, buyer, product } = await setup(cloud);
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);
    expect(draft.confirmation.confirmationNumber).toBeNull();
    expect(draft.confirmation.temporaryReference).toMatch(/^RASCUNHO-[0-9A-F]{8}$/);

    // "Fechar e abrir" = reler do zero via getDealConfirmation, como a UI faz
    // ao trocar de tela e voltar.
    const reopened = repo.getDealConfirmation(draft.confirmation.id);
    expect(reopened.confirmation.id).toBe(draft.confirmation.id);
    expect(reopened.confirmation.confirmationNumber).toBeNull();
    expect(reopened.confirmation.temporaryReference).toBe(draft.confirmation.temporaryReference);
    db.close();
  });

  it("gera previa (reserva numero), emite (mesmo numero), cancela (numero preservado) e cria o proximo (numero seguinte)", async () => {
    const cloud = new ControllableFakeSharedRepository();
    const { repo, db, seller, buyer, product } = await setup(cloud);
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);

    const preview = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    expect(preview.confirmation.confirmationNumber).toBe("VCMG 0001");
    expect(preview.confirmation.temporaryReference).toBe("VCMG 0001");

    const issued = await repo.issueDealConfirmation(draft.confirmation.id);
    expect(issued.confirmation.confirmationNumber).toBe("VCMG 0001");
    expect(issued.confirmation.status).toBe("ISSUED");

    const cancelled = repo.cancelDealConfirmation(issued.confirmation.id, "Desistencia formal");
    expect(cancelled.confirmation.status).toBe("CANCELLED");
    expect(cancelled.confirmation.confirmationNumber).toBe("VCMG 0001");

    const nextDraft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);
    const nextIssued = await repo.issueDealConfirmation(nextDraft.confirmation.id);
    expect(nextIssued.confirmation.confirmationNumber).toBe("VCMG 0002");

    // Nenhum numero reaparece em duas confirmacoes distintas.
    const numbers = repo.listDealConfirmations({ organizationId: villaId }).map((item) => item.confirmationNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    db.close();
  });

  it("sharedRepository ausente: previa usa numero provisorio local (RASCUNHO-...), emissao continua exigindo o servidor", async () => {
    const { repo, db, seller, buyer, product } = await setup(undefined);
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);
    const temporaryReference = draft.confirmation.temporaryReference;

    // Sem servidor, a previa (nunca a emissao final) usa a referencia
    // provisoria ja criada com o rascunho -- nao trava o modo somente local,
    // mas tambem nunca inventa um numero "oficial" pra um documento juridico.
    const preview = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    expect(preview.confirmation.confirmationNumber).toBe(temporaryReference);
    expect(preview.confirmation.status).toBe("DRAFT");

    await expect(repo.issueDealConfirmation(draft.confirmation.id)).rejects.toThrow(/sem conexao/i);

    // A emissao real (que exige o servidor) nao promoveu o numero provisorio a oficial.
    const reloaded = repo.getDealConfirmation(draft.confirmation.id);
    expect(reloaded.confirmation.confirmationNumber).toBe(temporaryReference);
    expect(reloaded.confirmation.status).toBe("DRAFT");
    db.close();
  });

  it("modo somente local: previa e emissao final usam numeracao local definitiva, sequencial e sem colisao entre confirmacoes", async () => {
    const { repo, db, seller, buyer, product } = await setup(undefined);
    await repo.setLocalOnlyMode(true);

    const draftA = buildMinimalDraft(repo, seller.id, buyer.id, product.id);
    const issuedA = await repo.issueDealConfirmation(draftA.confirmation.id);
    expect(issuedA.confirmation.confirmationNumber).toBe("VCMG 0001");
    expect(issuedA.confirmation.status).toBe("ISSUED");

    // Sem servidor, sem sessao -- mas o modo somente local e' uma escolha
    // deliberada do operador de que este PC opera sozinho, entao numerar
    // localmente aqui e' seguro (nao ha outro PC disputando a sequencia).
    const draftB = buildMinimalDraft(repo, seller.id, buyer.id, product.id);
    const previewB = await repo.generateDealConfirmationPreview(draftB.confirmation.id);
    expect(previewB.confirmation.confirmationNumber).toBe("VCMG 0002");
    const issuedB = await repo.issueDealConfirmation(draftB.confirmation.id);
    expect(issuedB.confirmation.confirmationNumber).toBe("VCMG 0002");

    // Terceira confirmacao segue a sequencia (0003), nao colide com A nem B.
    const draftC = buildMinimalDraft(repo, seller.id, buyer.id, product.id);
    const issuedC = await repo.issueDealConfirmation(draftC.confirmation.id);
    expect(issuedC.confirmation.confirmationNumber).toBe("VCMG 0003");

    const numbers = repo.listDealConfirmations({ organizationId: villaId }).map((item) => item.confirmationNumber);
    expect(new Set(numbers).size).toBe(numbers.length);

    db.close();
  });

  it("queda de rede ANTES do push (upsertRow da confirmacao falha): bloqueia a previa, numero continua null", async () => {
    const cloud = new ControllableFakeSharedRepository();
    const { repo, db, seller, buyer, product } = await setup(cloud);
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);

    cloud.failNextUpsert(1);
    await expect(repo.generateDealConfirmationPreview(draft.confirmation.id)).rejects.toThrow();

    const reloaded = repo.getDealConfirmation(draft.confirmation.id);
    expect(reloaded.confirmation.confirmationNumber).toBeNull();
    expect(reloaded.confirmation.status).toBe("DRAFT");

    // Depois que a rede volta, o mesmo rascunho consegue prosseguir normalmente.
    const preview = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    expect(preview.confirmation.confirmationNumber).toBe("VCMG 0001");
    db.close();
  });

  it("queda de rede DEPOIS do push mas ANTES da reserva (RPC falha): nao gera numero nem PDF", async () => {
    const cloud = new ControllableFakeSharedRepository();
    const { repo, db, seller, buyer, product } = await setup(cloud);
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);

    cloud.failNextRpc(1);
    await expect(repo.generateDealConfirmationPreview(draft.confirmation.id)).rejects.toThrow();

    const reloaded = repo.getDealConfirmation(draft.confirmation.id);
    expect(reloaded.confirmation.confirmationNumber).toBeNull();
    expect(reloaded.documents.some((doc) => doc.documentType === "GENERATED_DRAFT")).toBe(false);

    const preview = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    expect(preview.confirmation.confirmationNumber).toBe("VCMG 0001");
    db.close();
  });

  it("queda de rede DEPOIS da reserva (releitura de verificacao falha): bloqueia a previa e recupera de forma idempotente na proxima tentativa", async () => {
    const cloud = new ControllableFakeSharedRepository();
    const { repo, db, seller, buyer, product } = await setup(cloud);
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);

    // A RPC roda normalmente (reserva de verdade), mas a releitura de
    // confirmacao que valida numero+UUID falha logo em seguida -- o erro nao
    // precisa ter um texto especifico, o que importa e' que ele existe (nunca
    // silencioso) e que o numero nao fica preso localmente sem confirmacao.
    cloud.failNextFindOne(1);
    await expect(repo.generateDealConfirmationPreview(draft.confirmation.id)).rejects.toThrow();

    const reloaded = repo.getDealConfirmation(draft.confirmation.id);
    expect(reloaded.confirmation.confirmationNumber).toBeNull();

    // A reserva em si (RPC) tinha funcionado antes da releitura falhar --
    // tentando de novo com a rede estavel, o servidor devolve a MESMA reserva
    // idempotente (mesmo confirmation_id), em vez de desperdicar um numero
    // novo. Nenhum outro rascunho pode ter recebido esse numero nesse meio
    // tempo (a reserva ficou presa a este UUID o tempo todo).
    const preview = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    expect(preview.confirmation.confirmationNumber).toBe("VCMG 0001");
    db.close();
  });

  it("clique duplo em gerar previa: chamadas sequenciais sao idempotentes (mesmo numero)", async () => {
    const cloud = new ControllableFakeSharedRepository();
    const { repo, db, seller, buyer, product } = await setup(cloud);
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);

    const first = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    const second = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    expect(first.confirmation.confirmationNumber).toBe("VCMG 0001");
    expect(second.confirmation.confirmationNumber).toBe("VCMG 0001");
    db.close();
  });

  it("clique duplo em gerar previa (chamadas concorrentes): nunca reserva dois numeros diferentes pra mesma confirmacao", async () => {
    const cloud = new ControllableFakeSharedRepository();
    const { repo, db, seller, buyer, product } = await setup(cloud);
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);

    const [a, b] = await Promise.all([
      repo.generateDealConfirmationPreview(draft.confirmation.id),
      repo.generateDealConfirmationPreview(draft.confirmation.id)
    ]);
    expect(a.confirmation.confirmationNumber).toBe(b.confirmation.confirmationNumber);
    const final = repo.getDealConfirmation(draft.confirmation.id);
    expect(final.confirmation.confirmationNumber).toBe(a.confirmation.confirmationNumber);
    db.close();
  });

  it("clique duplo em emitir: a segunda chamada nao gera um segundo numero nem reemite", async () => {
    const cloud = new ControllableFakeSharedRepository();
    const { repo, db, seller, buyer, product } = await setup(cloud);
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);

    const first = await repo.issueDealConfirmation(draft.confirmation.id);
    expect(first.confirmation.confirmationNumber).toBe("VCMG 0001");
    // A confirmacao ja esta ISSUED -- uma segunda tentativa de emitir precisa
    // recusar em vez de emitir de novo ou trocar o numero.
    await expect(repo.issueDealConfirmation(draft.confirmation.id)).rejects.toThrow(/ja emitida|encerrada/i);
    const reloaded = repo.getDealConfirmation(draft.confirmation.id);
    expect(reloaded.confirmation.confirmationNumber).toBe("VCMG 0001");
    expect(reloaded.documents.filter((doc) => doc.documentType === "ISSUED_ORIGINAL")).toHaveLength(1);
    db.close();
  });

  it("numero ja pertencente a outro UUID (dois PCs contra o mesmo Supabase): limpa o numero local e reserva um novo, sem colidir com o dono legitimo", async () => {
    // Dois PCs distintos (dois SQLite locais separados) contra o MESMO
    // Supabase simulado -- e' o cenario real do Req 6: um rascunho antigo que
    // ficou com um numero que ja pertence a outra confirmacao no servidor
    // (nunca colide no SQLite de um so PC, ja que o UNIQUE local ja
    // impediria isso; o conflito so existe entre PCs diferentes).
    const cloud = new ControllableFakeSharedRepository();
    const pcA = await setup(cloud);
    const pcB = await setup(cloud);

    const owner = buildMinimalDraft(pcA.repo, pcA.seller.id, pcA.buyer.id, pcA.product.id);
    const ownerIssued = await pcA.repo.issueDealConfirmation(owner.confirmation.id);
    expect(ownerIssued.confirmation.confirmationNumber).toBe("VCMG 0001");

    // Rascunho local do PC B, com o mesmo numero do PC A gravado localmente
    // por engano (ex: reconciliacao antiga, importacao manual).
    const conflicting = buildMinimalDraft(pcB.repo, pcB.seller.id, pcB.buyer.id, pcB.product.id);
    pcB.db.prepare("UPDATE deal_confirmations SET confirmation_number = ?, temporary_reference = ? WHERE id = ?")
      .run("VCMG 0001", "VCMG 0001", conflicting.confirmation.id);

    const preview = await pcB.repo.generateDealConfirmationPreview(conflicting.confirmation.id);
    expect(preview.confirmation.confirmationNumber).not.toBe("VCMG 0001");
    expect(preview.confirmation.confirmationNumber).toBe("VCMG 0002");

    // O dono legitimo (PC A) continua intocado.
    const ownerReloaded = pcA.repo.getDealConfirmation(owner.confirmation.id);
    expect(ownerReloaded.confirmation.confirmationNumber).toBe("VCMG 0001");
    pcA.db.close();
    pcB.db.close();
  });

  it("Supabase indisponivel (checkConnectivity nao importa, rpc sempre falha): bloqueia repetidamente sem corromper o rascunho", async () => {
    const cloud = new ControllableFakeSharedRepository();
    cloud.failNextRpc(999);
    const { repo, db, seller, buyer, product } = await setup(cloud);
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(repo.generateDealConfirmationPreview(draft.confirmation.id)).rejects.toThrow();
    }
    const reloaded = repo.getDealConfirmation(draft.confirmation.id);
    expect(reloaded.confirmation.confirmationNumber).toBeNull();
    expect(reloaded.confirmation.status).toBe("DRAFT");
    expect(reloaded.documents).toHaveLength(0);
    db.close();
  });
});
