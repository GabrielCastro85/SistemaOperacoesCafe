import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { formatFiscalDocumentReferences } from "../electron/main/services/dealConfirmationFiles";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import type { FiscalDocument } from "../src/shared/types/domain";
import type { SharedRepository } from "../electron/main/services/sharedRepository";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const graoId = "22222222-2222-4222-8222-222222222222";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
const graoLegalEntityId = "44444444-4444-4444-8444-444444444441";

// Simulacao minima do Supabase pra cobrir a numeracao atomica (ver
// ensureDealConfirmationNumberOnServer/reserveDealConfirmationNumberOnServer
// em appRepository.ts): a previa/emissao agora exige conexao remota de
// verdade, entao os testes de confirmacao nao podem mais rodar 100% offline.
// A RPC "ensure_deal_confirmation_number" espelha a logica da migracao
// 0021_confirmation_number_owner_validation.sql -- mesma sequencia por
// (org, empresa, ano, prefixo), mesma limpeza de numero conflitante.
class FakeSharedRepository {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();
  private sequences = new Map<string, number>();
  private reservations = new Map<string, { number: string; sequence: number }>();
  private storage = new Map<string, Buffer>();

  checkConnectivity = async () => ({ online: true, authenticated: true, error: null });
  attemptSessionRecovery = async () => true;
  getSession = async () => ({ user: { email: "teste@operacoescafe.com" } }) as never;

  async uploadFile(bucket: string, path: string, data: Buffer): Promise<void> {
    this.storage.set(`${bucket}/${path}`, data);
  }

  async downloadFile(bucket: string, path: string): Promise<Buffer> {
    const bytes = this.storage.get(`${bucket}/${path}`);
    if (!bytes) throw new Error(`Object not found: ${bucket}/${path}`);
    return bytes;
  }

  async findOne(table: string, match: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const rows = [...(this.tables.get(table)?.values() ?? [])];
    return rows.find((row) => Object.entries(match).every(([key, value]) => String(row[key] ?? "") === String(value ?? ""))) ?? null;
  }

  async listAll(table: string): Promise<Array<Record<string, unknown>>> {
    return [...(this.tables.get(table)?.values() ?? [])];
  }

  async upsertRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
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

  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    if (name !== "ensure_deal_confirmation_number") throw new Error(`RPC nao simulada no teste: ${name}`);
    const confirmationId = String(args.p_confirmation_id);
    const organizationId = String(args.p_organization_id);
    const ownLegalEntityId = String(args.p_own_legal_entity_id);
    const year = Number(args.p_year);
    const prefix = String(args.p_prefix);
    const padding = Number(args.p_padding ?? 4);
    const floor = Number(args.p_floor ?? 0);
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

    const seqKey = `${organizationId}|${ownLegalEntityId}|${year}|${prefix}`;
    const highestFromConfirmations = [...confirmations.values()].reduce((max, row) => {
      const match = typeof row.confirmation_number === "string" ? row.confirmation_number.match(/(\d+)\s*$/) : null;
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    const highestFromReservations = [...this.reservations.values()].reduce((max, entry) => Math.max(max, entry.sequence), 0);
    const next = Math.max(this.sequences.get(seqKey) ?? 0, highestFromConfirmations, highestFromReservations, floor) + 1;
    this.sequences.set(seqKey, next);
    const number = `${prefix}${String(next).padStart(padding, "0")}`;
    this.reservations.set(confirmationId, { number, sequence: next });
    current.confirmation_number = number;
    current.temporary_reference = number;
    return [{ confirmation_number: number, sequence_number: next }] as unknown as T;
  }
}

async function setup() {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-deals-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const cloud = new FakeSharedRepository();
  const repo = new AppRepository(db, dirs, cloud as unknown as SharedRepository);
  repo.saveInstallationProfile({ installationName: "Villa", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const seller = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Villa Coffee Vendedora", notes: null, roles: ["SELLER"], isActive: true });
  const buyer = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Empresa IF Compradora", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
  const graoPartner = await repo.createBusinessPartner({ organizationId: graoId, displayName: "Parceiro Grao", notes: null, roles: ["BUYER"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  return { repo, db, dirs, seller, buyer, graoPartner, product };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("deal confirmations", () => {
  it("creates manual confirmation with exact 685 + 426 sacks and issues immutable PDF", async () => {
    const { repo, db, seller, buyer, product } = await setup();
    const template = repo.createDealConfirmationTemplate(templateInput());
    const draft = repo.createDealConfirmationDraft({
      organizationId: villaId,
      ownLegalEntityId,
      templateId: template.id,
      confirmationDate: "2026-07-17",
      negotiationDate: "2026-07-16",
      deliveryLocationSnapshot: "Armazem Sul",
      deliveryStartDate: "2026-07-20",
      deliveryEndDate: "2026-07-30",
      paymentTermsSnapshot: "Pagamento a vista apos descarga",
      qualityTermsSnapshot: "Bebida dura, tipo 6",
      generalTermsSnapshot: "Termos comerciais revisados pela empresa",
      publicNotes: "Negocio demonstrativo",
      internalNotes: null
    });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: seller.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: "Sr. Vendedor", sortOrder: 1 });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: "Sra. Compradora", sortOrder: 2 });
    repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, "Lote 1", "685", "1000.0000", 0));
    repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, "Lote 2", "426", "1000.0000", 1));
    repo.addDealConfirmationClause({ dealConfirmationId: draft.confirmation.id, clauseNumber: "1", title: "Clausula demonstrativa", clauseText: "Texto demonstrativo; revisar juridicamente antes de uso real.", sortOrder: 0, isVisible: true });
    repo.addDealPaymentTerm({ dealConfirmationId: draft.confirmation.id, sortOrder: 0, description: "100% apos descarga", percentageBasisPoints: 10000, amountCents: 111100000, dueDate: null, daysAfterEvent: 0, eventReference: "DESCARGA" });
    repo.addDealSigner({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", name: "Sr. Vendedor", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 1, signatureStatus: "PENDING", signedAt: null, notes: null });
    repo.addDealSigner({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", name: "Sra. Compradora", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 2, signatureStatus: "PENDING", signedAt: null, notes: null });
    expect(repo.calculateDealTotals(draft.confirmation.id)).toEqual({ totalQuantitySacksDecimal: "1111", totalCommercialAmountCents: 111100000 });
    const preview = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    expect(preview.documents[0].documentType).toBe("GENERATED_DRAFT");
    expect(preview.confirmation.confirmationNumber).toBe("VCMG 0001");
    const issued = await repo.issueDealConfirmation(draft.confirmation.id);
    expect(issued.confirmation.confirmationNumber).toBe("VCMG 0001");
    expect(issued.confirmation.status).toBe("ISSUED");
    const official = issued.documents.find((doc) => doc.documentType === "ISSUED_ORIGINAL");
    expect(official?.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(official?.storedFilePath && existsSync(official.storedFilePath)).toBe(true);
    expect(() => repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, "Bloqueado", "1", "1", 3))).toThrow(/nao pode ser editada/);
    db.close();
  });

  it("imports signed PDF externally, preserves original and does not claim crypto validation", async () => {
    const { repo, db, dirs, seller, buyer, product } = await setup();
    const issued = await issueMinimal(repo, seller.id, buyer.id, product.id);
    repo.markDealConfirmationSentForSignature(issued.confirmation.id);
    const signedPath = join(dirs.userData, "assinado.pdf");
    writeFileSync(signedPath, "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer <<>>\n%%EOF");
    const signed = repo.importSignedDealConfirmationDocument(issued.confirmation.id, { sourcePath: signedPath, notes: "Assinado fora do sistema" });
    expect(signed.confirmation.status).toBe("SIGNED");
    expect(signed.documents.filter((doc) => doc.documentType === "ISSUED_ORIGINAL")).toHaveLength(1);
    const signedVersion = signed.documents.find((doc) => doc.documentType === "SIGNED_EXTERNAL");
    expect(signedVersion?.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repo.validateSignedDealPdf(signedVersion?.id as string)).toMatchObject({ validPdfStored: true, cryptographicSignatureValidated: false });
    expect(() => repo.importSignedDealConfirmationDocument(issued.confirmation.id, { sourcePath: signedPath, notes: null })).toThrow(/ja esta registrado/);
    db.close();
  });

  it("deletes an unnumbered draft with linked data and stored documents", async () => {
    // Um rascunho ainda sem numero (nenhuma previa/emissao gerada) continua
    // podendo ser excluido de verdade -- so' confirmacoes numeradas (ver
    // proximo teste) sao protegidas.
    const { repo, db, seller, buyer, product } = await setup();
    const draft = repo.createDealConfirmationDraft({ organizationId: villaId, ownLegalEntityId, confirmationDate: "2026-07-17", paymentTermsSnapshot: "A vista", deliveryLocationSnapshot: "Armazem", qualityTermsSnapshot: "Padrao", generalTermsSnapshot: "Revisado" });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: seller.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, "Cafe", "1.111", "1000.1234", 0));
    expect(draft.confirmation.confirmationNumber).toBeNull();

    expect(repo.deleteDealConfirmation(draft.confirmation.id)).toBe(true);

    expect(repo.listDealConfirmations({ organizationId: villaId }).some((item) => item.id === draft.confirmation.id)).toBe(false);
    expect(() => repo.getDealConfirmation(draft.confirmation.id)).toThrow(/nao encontrada/);
    db.close();
  });

  it("blocks deletion of a numbered/issued confirmation and never reuses its number", async () => {
    // Req do usuario: "nenhuma confirmacao emitida seja apagada ou renumerada".
    // deleteDealConfirmation agora recusa qualquer confirmacao numerada ou
    // fora de rascunho -- o unico jeito de encerrar e' cancelar (preserva
    // historico e numero).
    const { repo, db, seller, buyer, product } = await setup();
    const first = await issueMinimal(repo, seller.id, buyer.id, product.id);
    const second = await issueMinimal(repo, seller.id, buyer.id, product.id);
    expect(first.confirmation.confirmationNumber).toBe("VCMG 0001");
    expect(second.confirmation.confirmationNumber).toBe("VCMG 0002");

    expect(() => repo.deleteDealConfirmation(second.confirmation.id)).toThrow(/numerada ou fora de rascunho/i);
    // O numero e o registro continuam intactos depois da tentativa bloqueada.
    expect(repo.getDealConfirmation(second.confirmation.id).confirmation.confirmationNumber).toBe("VCMG 0002");

    const third = await issueMinimal(repo, seller.id, buyer.id, product.id);
    expect(third.confirmation.confirmationNumber).toBe("VCMG 0003");
    expect(repo.listDealConfirmations({ organizationId: villaId }).map((item) => item.confirmationNumber).sort()).toEqual(["VCMG 0001", "VCMG 0002", "VCMG 0003"]);
    db.close();
  });

  it("never reuses numbers below a manually set floor, nor an issued number even if deletion is attempted", async () => {
    const { repo, db, seller, buyer, product } = await setup();
    const first = await issueMinimal(repo, seller.id, buyer.id, product.id);
    const prefix = first.confirmation.confirmationNumber?.replace(/\d+$/, "") ?? "";
    expect(first.confirmation.confirmationNumber).toBe(`${prefix}0001`);

    const status = await repo.setDealConfirmationSequenceFloor(ownLegalEntityId, 20);
    expect(status.currentNumber).toBe(20);
    expect(status.nextNumber).toBe(`${prefix}0021`);

    // Setting a lower floor afterwards must be a no-op (never decreases).
    const noop = await repo.setDealConfirmationSequenceFloor(ownLegalEntityId, 5);
    expect(noop.currentNumber).toBe(20);

    const afterFloor = await issueMinimal(repo, seller.id, buyer.id, product.id);
    expect(afterFloor.confirmation.confirmationNumber).toBe(`${prefix}0021`);

    const next = await issueMinimal(repo, seller.id, buyer.id, product.id);
    expect(next.confirmation.confirmationNumber).toBe(`${prefix}0022`);

    // Uma confirmacao emitida nunca pode ser apagada nem tem seu numero
    // reaproveitado -- mesma regra do teste "blocks deletion..." acima,
    // valendo tambem pra numeros acima do piso.
    expect(() => repo.deleteDealConfirmation(next.confirmation.id)).toThrow(/numerada ou fora de rascunho/i);
    const another = await issueMinimal(repo, seller.id, buyer.id, product.id);
    expect(another.confirmation.confirmationNumber).toBe(`${prefix}0023`);

    // The number below the floor stays orphaned forever -- never reused.
    expect(repo.listDealConfirmations({ organizationId: villaId }).map((item) => item.confirmationNumber).sort()).toEqual([`${prefix}0001`, `${prefix}0021`, `${prefix}0022`, `${prefix}0023`]);
    db.close();
  });

  it("applies a floor to every own legal entity at once", async () => {
    const { repo, db } = await setup();
    const before = repo.listDealConfirmationSequenceStatus().find((item) => item.ownLegalEntityId === ownLegalEntityId);
    const results = await repo.setDealConfirmationSequenceFloorForAllEntities(20);
    expect(results.some((item) => item.ownLegalEntityId === ownLegalEntityId && item.nextNumber === `${before?.prefix}0021`)).toBe(true);
    expect(results.some((item) => item.ownLegalEntityId === graoLegalEntityId)).toBe(true);
    const status = repo.listDealConfirmationSequenceStatus();
    expect(status.find((item) => item.ownLegalEntityId === ownLegalEntityId)?.currentNumber).toBe(20);
    db.close();
  });

  it("creates from operation and fiscal document without changing billing status", async () => {
    const { repo, db, product } = await setup();
    const buyer = await repo.createBusinessPartner({ organizationId: villaId, displayName: "DIAMANTE CAFE", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: buyer.id, ownLegalEntityId: null, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: buyer.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "NF-900", series: "1", issueDate: "2026-07-17", totalAmountCents: 500000, hasPendingIssues: false, pendingNotes: null, notes: null });
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "Cafe", quantity: "5", unit: "SACK", unitPriceDecimal: "1000.1234", totalAmountCents: 500062, sacksQuantity: "5" });
    const operation = repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: buyer.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-17", quantitySacks: "5", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.confirmFiscalDocument(doc.document.id);
    const fromOperation = repo.createDealConfirmationFromOperations({ organizationId: villaId, ownLegalEntityId, operationIds: [operation.id], fiscalDocumentIds: [] });
    const fromDocument = repo.createDealConfirmationFromFiscalDocuments({ organizationId: villaId, ownLegalEntityId, operationIds: [], fiscalDocumentIds: [doc.document.id] });
    expect(fromOperation.operations).toHaveLength(1);
    expect(fromDocument.fiscalDocuments).toHaveLength(1);
    expect(repo.getFiscalDocument(doc.document.id).operations[0].billingStatus).toBe("UNBILLED");
    db.close();
  });

  it("reuses the active confirmation already linked to a fiscal document instead of creating a duplicate", async () => {
    const { repo, db, product } = await setup();
    const buyer = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Reaproveitamento Cafe", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
    const doc = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: buyer.id, partnerLegalEntityId: null, accessKey: null, documentNumber: "NF-950", series: "1", issueDate: "2026-07-17", totalAmountCents: 500000, hasPendingIssues: false, pendingNotes: null, notes: null });
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "Cafe", quantity: "5", unit: "SACK", unitPriceDecimal: "1000", totalAmountCents: 500000, sacksQuantity: "5" });
    repo.addOperation({ fiscalDocumentId: doc.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: buyer.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-17", quantitySacks: "5", manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.confirmFiscalDocument(doc.document.id);

    const first = repo.createDealConfirmationFromFiscalDocuments({ organizationId: villaId, ownLegalEntityId, operationIds: [], fiscalDocumentIds: [doc.document.id] });
    expect(first.items).toHaveLength(1);
    // createDealConfirmationDraft ja semeia uma parte ISSUER por padrao -- simula o app completando
    // com a parte/signatario do vendedor uma unica vez, como o formulario faz apos a primeira chamada.
    repo.addDealConfirmationParty({ dealConfirmationId: first.confirmation.id, partyRole: "SELLER", businessPartnerId: null, partnerLegalEntityId: null, ownLegalEntityId, manualName: null, representativeName: null, sortOrder: 1 });
    repo.addDealSigner({ dealConfirmationId: first.confirmation.id, partyRole: "SELLER", name: "Vendedor", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 1, signatureStatus: "PENDING", signedAt: null, notes: null });
    const partiesAfterFirstPopulation = repo.getDealConfirmation(first.confirmation.id).parties.length;
    const signersAfterFirstPopulation = repo.getDealConfirmation(first.confirmation.id).signers.length;

    // O usuario seleciona a mesma nota de novo e manda gerar confirmacao outra vez. Deve reaproveitar
    // a confirmacao existente, sem duplicar itens, partes ou signatarios.
    const second = repo.createDealConfirmationFromFiscalDocuments({ organizationId: villaId, ownLegalEntityId, operationIds: [], fiscalDocumentIds: [doc.document.id] });
    expect(second.confirmation.id).toBe(first.confirmation.id);
    expect(second.items).toHaveLength(1);
    expect(second.parties).toHaveLength(partiesAfterFirstPopulation);
    expect(second.signers).toHaveLength(signersAfterFirstPopulation);
    expect(repo.listDealConfirmations({ organizationId: villaId })).toHaveLength(1);
    db.close();
  });

  it("recomputes the aggregate signature status after a signer is removed", async () => {
    const { repo, db, seller, buyer, product } = await setup();
    const draft = repo.createDealConfirmationDraft({ organizationId: villaId, ownLegalEntityId, confirmationDate: "2026-07-17", paymentTermsSnapshot: "A vista", deliveryLocationSnapshot: "Armazem", qualityTermsSnapshot: "Padrao", generalTermsSnapshot: "Revisado" });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: seller.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, "Cafe", "100", "1000", 0));
    const signedSigner = repo.addDealSigner({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", name: "Vendedor", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 1, signatureStatus: "SIGNED_EXTERNALLY", signedAt: "2026-07-18T00:00:00.000Z", notes: null });
    const pendingSigner = repo.addDealSigner({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", name: "Comprador", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 2, signatureStatus: "PENDING", signedAt: null, notes: null });
    // Um signatario ja assinado + um pendente: o agregado fica PARTIALLY_SIGNED.
    expect(repo.getDealConfirmation(draft.confirmation.id).confirmation.signatureStatus).toBe("PARTIALLY_SIGNED");

    // O signatario pendente era so um representante interino que acabou nao sendo necessario; o
    // vendedor remove esse signatario em vez de esperar ele assinar. Antes da correcao, removeDealSigner
    // nao recalculava o status agregado e a confirmacao ficava presa em PARTIALLY_SIGNED para sempre.
    repo.removeDealSigner(pendingSigner.id);
    expect(repo.getDealConfirmation(draft.confirmation.id).confirmation.signatureStatus).toBe("SIGNED");
    expect(repo.getDealConfirmation(draft.confirmation.id).signers.map((item) => item.id)).toEqual([signedSigner.id]);
    db.close();
  });

  it("creates confirmation using the own legal entity from the selected fiscal document", async () => {
    const { repo, db, buyer, product } = await setup();
    const otherVillaLegalEntity = repo.listLegalEntities({ organizationId: villaId }).find((entity) => entity.id !== ownLegalEntityId);
    expect(otherVillaLegalEntity).toBeDefined();
    const doc = repo.createFiscalDocument({
      organizationId: villaId,
      ownLegalEntityId: otherVillaLegalEntity?.id as string,
      responsiblePartnerId: buyer.id,
      partnerLegalEntityId: null,
      accessKey: null,
      documentNumber: "NF-901",
      series: "1",
      issueDate: "2026-07-17",
      totalAmountCents: 53010000,
      hasPendingIssues: false,
      pendingNotes: null,
      notes: null
    });
    const item = repo.addFiscalDocumentItem({
      fiscalDocumentId: doc.document.id,
      productId: product.id,
      description: "Cafe em graos",
      quantity: "310",
      unit: "SACK",
      unitPriceDecimal: "1710",
      totalAmountCents: 53010000,
      sacksQuantity: "310"
    });
    repo.addOperation({
      fiscalDocumentId: doc.document.id,
      fiscalDocumentItemId: item.id,
      ownLegalEntityId: otherVillaLegalEntity?.id as string,
      responsiblePartnerId: buyer.id,
      productId: product.id,
      operationType: "SALE",
      operationScope: "EXTERNAL",
      operationDate: "2026-07-17",
      quantitySacks: "310",
      manualRateValueCents: null,
      manualOverrideReason: null,
      notes: null
    });
    repo.confirmFiscalDocument(doc.document.id);
    const confirmation = repo.createDealConfirmationFromFiscalDocuments({ organizationId: villaId, ownLegalEntityId, operationIds: [], fiscalDocumentIds: [doc.document.id] });
    expect(confirmation.confirmation.ownLegalEntityId).toBe(otherVillaLegalEntity?.id);
    expect(confirmation.fiscalDocuments[0].id).toBe(doc.document.id);
    db.close();
  });

  it("creates confirmation from a fiscal document linked to a shared client from another organization", async () => {
    const { repo, db, seller, product } = await setup();
    const sharedBuyer = await repo.createBusinessPartner({ organizationId: graoId, displayName: "Cliente Compartilhado Grao", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
    const doc = repo.createFiscalDocument({
      organizationId: villaId,
      ownLegalEntityId,
      responsiblePartnerId: sharedBuyer.id,
      partnerLegalEntityId: null,
      accessKey: null,
      documentNumber: "NF-SHARED-1",
      series: "1",
      issueDate: "2026-07-18",
      totalAmountCents: 100000,
      hasPendingIssues: false,
      pendingNotes: null,
      notes: null
    });
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: doc.document.id, productId: product.id, description: "Cafe", quantity: "10", unit: "SACK", unitPriceDecimal: "1000", totalAmountCents: 100000, sacksQuantity: "10" });
    repo.addOperation({
      fiscalDocumentId: doc.document.id,
      fiscalDocumentItemId: item.id,
      ownLegalEntityId,
      responsiblePartnerId: sharedBuyer.id,
      productId: product.id,
      operationType: "SALE",
      operationScope: "EXTERNAL",
      operationDate: "2026-07-18",
      quantitySacks: "10",
      manualRateValueCents: null,
      manualOverrideReason: null,
      notes: null
    });
    repo.confirmFiscalDocument(doc.document.id);
    const confirmation = repo.createDealConfirmationFromFiscalDocuments({ organizationId: villaId, ownLegalEntityId, operationIds: [], fiscalDocumentIds: [doc.document.id] });
    repo.addDealConfirmationParty({ dealConfirmationId: confirmation.confirmation.id, partyRole: "SELLER", businessPartnerId: seller.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
    const withBuyer = repo.addDealConfirmationParty({ dealConfirmationId: confirmation.confirmation.id, partyRole: "BUYER", businessPartnerId: sharedBuyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    expect(withBuyer.businessPartnerId).toBe(sharedBuyer.id);
    repo.updateDealConfirmationDraft(confirmation.confirmation.id, { deliveryLocationSnapshot: "Armazem", paymentTermsSnapshot: "A vista", generalTermsSnapshot: "Padrao" });
    repo.addDealConfirmationClause({ dealConfirmationId: confirmation.confirmation.id, clauseNumber: "1", title: "Conferencia", clauseText: "Clausula revisada.", sortOrder: 0, isVisible: true });
    const preview = await repo.generateDealConfirmationPreview(confirmation.confirmation.id);
    const reused = repo.createDealConfirmationFromFiscalDocuments({ organizationId: villaId, ownLegalEntityId, operationIds: [], fiscalDocumentIds: [doc.document.id] });
    expect(reused.confirmation.id).toBe(confirmation.confirmation.id);
    expect(reused.confirmation.confirmationNumber).toBe(preview.confirmation.confirmationNumber);
    const issued = await repo.issueDealConfirmation(reused.confirmation.id);
    expect(issued.confirmation.confirmationNumber).toBe(preview.confirmation.confirmationNumber);
    db.close();
  });

  it("blocks another organization, duplicated links and handles cancel/replace/report/dashboard", async () => {
    const { repo, db, seller, buyer, graoPartner, product } = await setup();
    const issued = await issueMinimal(repo, seller.id, buyer.id, product.id);
    expect(() => repo.addDealConfirmationParty({ dealConfirmationId: issued.confirmation.id, partyRole: "OTHER", businessPartnerId: graoPartner.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 5 })).toThrow(/editada|outra organizacao/);
    // Substituicao so' e' permitida a partir de uma confirmacao emitida (ISSUED/
    // SENT_FOR_SIGNATURE/SIGNED) -- preserva o numero original ligado ao
    // historico em vez de criar uma substituicao a partir de algo ja encerrado.
    const replacement = repo.replaceDealConfirmation(issued.confirmation.id, "Nova negociacao");
    expect(replacement.confirmation.status).toBe("DRAFT");
    expect(repo.getDealConfirmation(issued.confirmation.id).confirmation.status).toBe("REPLACED");

    const anotherIssued = await issueMinimal(repo, seller.id, buyer.id, product.id);
    const cancelled = repo.cancelDealConfirmation(anotherIssued.confirmation.id, "Desistencia formal");
    expect(cancelled.confirmation.status).toBe("CANCELLED");
    expect(() => repo.replaceDealConfirmation(cancelled.confirmation.id, "Tentativa invalida")).toThrow(/emitida ou em processo de assinatura/i);
    const summary = repo.getDealConfirmationSummary({ organizationId: villaId, ownLegalEntityId: null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null });
    expect(summary.confirmations).toBeGreaterThanOrEqual(2);
    const report = await repo.generateConfirmationReport({ reportType: "CONFIRMATIONS_PERIOD", format: "EXCEL", filters: { organizationId: villaId, ownLegalEntityId: null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null } });
    expect(existsSync(report.storedFilePath)).toBe(true);
    expect(() => repo.reserveDealConfirmationNumber(graoId, graoLegalEntityId)).not.toThrow();
    db.close();
  });

  it("persists brokerage percentage, bank/PIX data and a delivery-recipient party through create, update and PDF generation", async () => {
    const { repo, db, seller, buyer, product } = await setup();
    const draft = repo.createDealConfirmationDraft({
      organizationId: villaId,
      ownLegalEntityId,
      confirmationDate: "2026-07-17",
      paymentTermsSnapshot: "A prazo",
      brokeragePercentageBasisPoints: 250,
      bankName: "Santander",
      bankCode: "033",
      bankAgency: "3318",
      bankAccount: "13.0021347",
      pixKey: "44.963.370/0005-23"
    });
    expect(draft.confirmation.brokeragePercentageBasisPoints).toBe(250);
    expect(draft.confirmation.bankName).toBe("Santander");
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: seller.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "DELIVERY_RECIPIENT", businessPartnerId: buyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 3 });
    repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, "Lote unico", "350", "1997", 0));

    const updated = repo.updateDealConfirmationDraft(draft.confirmation.id, { bankAgency: "9999", pixKey: "chave-nova@pix.com" });
    expect(updated.confirmation.bankAgency).toBe("9999");
    expect(updated.confirmation.pixKey).toBe("chave-nova@pix.com");
    expect(updated.confirmation.bankName).toBe("Santander");
    expect(updated.parties.filter((party) => party.partyRole === "DELIVERY_RECIPIENT")).toHaveLength(1);

    const preview = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    const version = preview.documents.find((doc) => doc.documentType === "GENERATED_DRAFT");
    expect(version?.storedFilePath && existsSync(version.storedFilePath)).toBe(true);
    expect(version?.storedFilePath ? statSync(version.storedFilePath).size : 0).toBeGreaterThan(500);
    db.close();
  });

  it("keeps the compact confirmation PDF in one A4 page with long names and four items", async () => {
    const { repo, db, product } = await setup();
    const buyer = await repo.createBusinessPartner({
      organizationId: villaId,
      displayName: "COOPERATIVA REGIONAL DOS PRODUTORES EXPORTADORES DE CAFE ESPECIAL DO SUL DE MINAS E MATAS DE MINAS",
      notes: null,
      roles: ["BUYER", "CLIENT"],
      isActive: true
    });
    const draft = repo.createDealConfirmationDraft({
      organizationId: villaId,
      ownLegalEntityId,
      confirmationDate: "2026-07-17",
      negotiationDate: "2026-07-16",
      paymentTermsSnapshot: "Pagamento a prazo na descarga com conferencia fiscal e liberacao financeira apos validacao comercial.",
      deliveryLocationSnapshot: "Local rural com acesso pela Rodovia MG 455, km 40, zona rural, Andradadas - MG",
      generalTermsSnapshot: "Fechamento sujeito a conferencia de qualidade e quantidade no recebimento.",
      bankName: "Santander",
      bankCode: "033",
      bankAgency: "3318",
      bankAccount: "13.0021347-9 / operacao cafe safra 2026",
      pixKey: "chave-pix-comercial-muito-longa-44.963.370/0005-23@sistema-operacoes-cafe.local"
    });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: null, partnerLegalEntityId: null, ownLegalEntityId, manualName: null, representativeName: null, sortOrder: 1 });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "DELIVERY_RECIPIENT", businessPartnerId: null, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: "ARMAZEM RURAL SERRA ALTA - RODOVIA MG 455 KM 40 ZONA RURAL ANDRADAS MINAS GERAIS", representativeName: null, sortOrder: 3 });
    ["Cafe arabica bebida dura tipo 6/7 safra 2026 lote longo A", "Cafe arabica bebida dura tipo 6/7 safra 2026 lote longo B", "Cafe arabica bebida dura tipo 6/7 safra 2026 lote longo C", "Cafe arabica bebida dura tipo 6/7 safra 2026 lote longo D"].forEach((label, index) => {
      repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, label, index === 0 ? "310" : "267", index === 0 ? "1710.00" : "1000.0000", index));
    });
    repo.addDealSigner({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", name: "Villa Coffee Minas Gerais", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 1, signatureStatus: "PENDING", signedAt: null, notes: null });
    repo.addDealSigner({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", name: "Cooperativa Regional dos Produtores Exportadores de Cafe Especial", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 2, signatureStatus: "PENDING", signedAt: null, notes: null });
    const preview = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    const version = preview.documents.find((doc) => doc.documentType === "GENERATED_DRAFT");
    expect(version?.storedFilePath).toBeTruthy();
    const bytes = version?.storedFilePath ? readFileSync(version.storedFilePath) : Buffer.from([]);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
    db.close();
  });

  it("falls back to the paginated PDF layout (instead of rejecting) with more than six items", async () => {
    // O modelo compacto de uma pagina cobre ate 6 itens (ver
    // dealConfirmationFiles.ts); acima disso a geracao nao falha, ela usa o
    // modelo paginado como protecao. Nao ha limite que rejeite a previa.
    const { repo, db, buyer, product } = await setup();
    const draft = repo.createDealConfirmationDraft({ organizationId: villaId, ownLegalEntityId, confirmationDate: "2026-07-17", paymentTermsSnapshot: "A vista" });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: null, partnerLegalEntityId: null, ownLegalEntityId, manualName: null, representativeName: null, sortOrder: 1 });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    for (let index = 0; index < 7; index += 1) {
      repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, `Cafe ${index + 1}`, "10", "1000", index));
    }
    const preview = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    const version = preview.documents.find((doc) => doc.documentType === "GENERATED_DRAFT");
    expect(version?.storedFilePath && existsSync(version.storedFilePath)).toBe(true);
    db.close();
  });

  it("names issued PDF with seller, buyer and confirmation sequence", async () => {
    const { repo, db, product } = await setup();
    const buyer = await repo.createBusinessPartner({ organizationId: villaId, displayName: "DIAMANTE CAFE", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
    const draft = repo.createDealConfirmationDraft({
      organizationId: villaId,
      ownLegalEntityId,
      confirmationDate: "2026-07-17",
      paymentTermsSnapshot: "A vista"
    });
    expect(draft.confirmation.bankName).toBe("Santander");
    expect(draft.confirmation.pixKey).toBe("44.963.370/0005-23");
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: null, partnerLegalEntityId: null, ownLegalEntityId, manualName: null, representativeName: null, sortOrder: 1 });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, "Cafe", "15", "1000", 0));
    const issued = await repo.issueDealConfirmation(draft.confirmation.id);
    const document = issued.documents.find((item) => item.documentType === "ISSUED_ORIGINAL");
    expect(document?.originalFileName).toMatch(/^VILLA MG X DIAMANTE \d+\.pdf$/);
    expect(document?.storedFilePath ? basename(document.storedFilePath) : "").toBe(document?.originalFileName);
    // Versao emitida (nao-draft) sobe pro Supabase Storage -- e' o que
    // permite outro PC abrir este PDF depois (ver ensureDealDocumentLocalPath).
    expect(document?.storageObjectPath).not.toBeNull();
    db.close();
  });

  it("recupera o PDF pelo Supabase Storage quando o arquivo local nao existe neste PC (confirmacao sincronizada de outro PC)", async () => {
    // Reproduz o bug relatado em producao: stored_file_path e' um caminho
    // absoluto do PC que gerou o documento -- so' a LINHA sincroniza pros
    // outros PCs, nunca o arquivo. Ate' esta correcao, abrir/baixar em outro
    // PC mostrava "sem previa gerada" sem nenhuma explicacao.
    const { repo, db, seller, buyer, product } = await setup();
    const issued = await issueMinimal(repo, seller.id, buyer.id, product.id);
    const document = issued.documents.find((item) => item.documentType === "ISSUED_ORIGINAL");
    expect(document?.storedFilePath && existsSync(document.storedFilePath)).toBe(true);
    expect(document?.storageObjectPath).not.toBeNull();

    // Simula "outro PC": o arquivo local nunca existiu aqui.
    rmSync(document!.storedFilePath, { force: true });
    expect(existsSync(document!.storedFilePath)).toBe(false);

    const recoveredPath = await repo.ensureDealDocumentLocalPath(document!.id);
    expect(existsSync(recoveredPath)).toBe(true);
    expect(readFileSync(recoveredPath).length).toBeGreaterThan(0);
    // A confirmacao continua abrindo normalmente depois da recuperacao.
    expect(repo.getDealDocumentPath(document!.id)).toBe(recoveredPath);
    db.close();
  });

  it("mensagem clara (nao mais 'sem previa gerada' silencioso) quando o documento nao existe nem localmente nem na nuvem", async () => {
    const { repo, db, seller, buyer, product } = await setup();
    const issued = await issueMinimal(repo, seller.id, buyer.id, product.id);
    const document = issued.documents.find((item) => item.documentType === "ISSUED_ORIGINAL");
    rmSync(document!.storedFilePath, { force: true });
    // Sem storage_object_path (ex: previa em rascunho, nunca sobe pro Storage) --
    // simula isolando o campo direto no banco pra nao depender de outro fluxo.
    db.prepare("UPDATE deal_confirmation_document_versions SET storage_object_path = NULL WHERE id = ?").run(document!.id);
    await expect(repo.ensureDealDocumentLocalPath(document!.id)).rejects.toThrow(/ainda nao esta disponivel neste computador/);
    db.close();
  });

  it("formats the linked fiscal document numbers so the PDF references which notes are being settled", () => {
    expect(formatFiscalDocumentReferences([])).toBe("Manual");
    expect(formatFiscalDocumentReferences([fiscalDocument({ documentNumber: "375", series: "1" })])).toBe("375/1");
    expect(formatFiscalDocumentReferences([fiscalDocument({ documentNumber: "375", series: "1" }), fiscalDocument({ documentNumber: "402", series: "1" })])).toBe("375/1, 402/1");
    expect(formatFiscalDocumentReferences([fiscalDocument({ documentNumber: "900", series: null })])).toBe("900");
  });

  it("manages templates and clause library with defaults", async () => {
    const { repo, db } = await setup();
    const template = repo.createDealConfirmationTemplate(templateInput());
    const duplicated = repo.duplicateDealConfirmationTemplate(template.id);
    repo.setDefaultDealConfirmationTemplate(duplicated.id);
    expect(repo.listDealConfirmationTemplates({ organizationId: villaId }).filter((item) => item.isDefault)).toHaveLength(1);
    expect(repo.deactivateDealConfirmationTemplate(template.id).isActive).toBe(false);
    const clause = repo.createDealClauseTemplate({ organizationId: villaId, name: "Pagamento padrao", title: "Pagamento", clauseText: "Texto demonstrativo.", category: "PAYMENT", isActive: true });
    expect(repo.duplicateDealClauseTemplate(clause.id).name).toContain("copia");
    expect(repo.deactivateDealClauseTemplate(clause.id).isActive).toBe(false);
    db.close();
  });
});

function templateInput() {
  return {
    organizationId: villaId,
    ownLegalEntityId: null,
    name: "Padrao",
    description: null,
    title: "Confirmacao de Negocio",
    subtitle: "Cafe",
    layoutMode: "STANDARD",
    defaultPaymentTerms: "Conforme combinado entre as partes.",
    defaultDeliveryTerms: "Local a definir.",
    defaultQualityTerms: "Qualidade conforme amostra.",
    defaultGeneralTerms: "Textos devem ser revisados pela empresa.",
    showBroker: true,
    showCommercialValues: true,
    showItemOrigins: true,
    showSignatureBlocks: true,
    signatureBlockCount: 2,
    isDefault: true,
    isActive: true
  };
}

function itemInput(dealConfirmationId: string, productId: string, label: string, quantity: string, price: string, sortOrder: number) {
  return {
    dealConfirmationId,
    sortOrder,
    productId,
    productNameSnapshot: label,
    productDescriptionSnapshot: "Cafe arabica",
    cropSnapshot: "2026",
    qualitySnapshot: "Bebida dura",
    packagingSnapshot: "Sacas de juta",
    originSnapshot: "Sul de Minas",
    destinationSnapshot: "Armazem Sul",
    quantitySacksDecimal: quantity,
    sackWeightKgDecimal: "60",
    unitPriceDecimal: price,
    totalAmountCents: null,
    totalOverrideReason: null,
    deliveryStartDate: "2026-07-20",
    deliveryEndDate: "2026-07-30",
    deliveryLocationSnapshot: "Armazem Sul",
    notes: null
  };
}

function fiscalDocument(overrides: Partial<FiscalDocument>): FiscalDocument {
  return {
    id: "doc",
    organizationId: villaId,
    ownLegalEntityId,
    responsiblePartnerId: "partner",
    partnerLegalEntityId: null,
    secondaryResponsiblePartnerId: null,
    secondaryOperationType: null,
    documentType: "MANUAL_INVOICE",
    accessKey: null,
    documentNumber: "1",
    series: "1",
    issueDate: "2026-07-17",
    totalAmountCents: 0,
    status: "CONFIRMED",
    hasPendingIssues: false,
    pendingNotes: null,
    duplicateWarning: null,
    notes: null,
    confirmedAt: null,
    canceledAt: null,
    cancelReason: null,
    source: "XML",
    importJobId: null,
    importRowId: null,
    xmlFilePath: null,
    xmlFileHash: null,
    protocolNumber: null,
    protocolDate: null,
    authorizationStatusCode: null,
    authorizationStatusMessage: null,
    xmlImportJobId: null,
    mergedFromSource: null,
    mergedAt: null,
    direction: "OUTBOUND",
    fiscalSnapshotJson: null,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
    ...overrides
  };
}

async function issueMinimal(repo: AppRepository, sellerId: string, buyerId: string, productId: string) {
  const draft = repo.createDealConfirmationDraft({ organizationId: villaId, ownLegalEntityId, confirmationDate: "2026-07-17", paymentTermsSnapshot: "A vista", deliveryLocationSnapshot: "Armazem", qualityTermsSnapshot: "Padrao", generalTermsSnapshot: "Revisado" });
  repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: sellerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
  repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
  repo.addDealConfirmationItem(itemInput(draft.confirmation.id, productId, "Cafe", "1.111", "1000.1234", 0));
  repo.addDealConfirmationClause({ dealConfirmationId: draft.confirmation.id, clauseNumber: "1", title: "Demo", clauseText: "<script>alert(1)</script> deve sair como texto escapado.", sortOrder: 0, isVisible: true });
  return repo.issueDealConfirmation(draft.confirmation.id);
}
