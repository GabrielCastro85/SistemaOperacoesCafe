// Bateria obrigatoria da numeracao atomica de confirmacoes (ver
// ensureDealConfirmationNumber/reserveDealConfirmationNumberLocally em
// appRepository.ts). Aplicativo single-PC: a numeracao e' sempre local
// (nao ha mais servidor pra reservar/validar). Cobre os cenarios que ainda
// se aplicam: criar rascunho, fechar/reabrir, gerar previa, emitir, cancelar,
// criar o proximo, clique duplo em previa/emissao. Em todo cenario valida:
// mesmo UUID, um unico numero por confirmacao, numero nunca reutilizado,
// nenhuma exclusao/renumeracao silenciosa.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

async function setup() {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-deals-resilience-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
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
    const { repo, db, seller, buyer, product } = await setup();
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

  it("gera previa (reserva numero local), emite (mesmo numero), cancela (numero preservado) e cria o proximo (numero seguinte), sem colisao entre confirmacoes", async () => {
    const { repo, db, seller, buyer, product } = await setup();
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

    // Uma terceira confirmacao segue a sequencia (0003), nao colide com as anteriores.
    const thirdDraft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);
    const thirdIssued = await repo.issueDealConfirmation(thirdDraft.confirmation.id);
    expect(thirdIssued.confirmation.confirmationNumber).toBe("VCMG 0003");

    // Nenhum numero reaparece em duas confirmacoes distintas.
    const numbers = repo.listDealConfirmations({ organizationId: villaId }).map((item) => item.confirmationNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    db.close();
  });

  it("substituida so' pode ser cancelada depois que a substituta for cancelada", async () => {
    const { repo, db, seller, buyer, product } = await setup();
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);
    const issued = await repo.issueDealConfirmation(draft.confirmation.id);
    const replacement = repo.replaceDealConfirmation(issued.confirmation.id, "Erro de digitacao");

    expect(repo.getDealConfirmation(issued.confirmation.id).replacementStatus).toBe("DRAFT");
    expect(() => repo.cancelDealConfirmation(issued.confirmation.id, "Desistencia")).toThrow(/substituta estiver ativa/);

    repo.cancelDealConfirmation(replacement.confirmation.id, "Desistencia");
    const cancelled = repo.cancelDealConfirmation(issued.confirmation.id, "Desistencia");
    expect(cancelled.confirmation.status).toBe("CANCELLED");
    expect(cancelled.confirmation.confirmationNumber).toBe("VCMG 0001");
    db.close();
  });

  it("clique duplo em gerar previa: chamadas sequenciais sao idempotentes (mesmo numero)", async () => {
    const { repo, db, seller, buyer, product } = await setup();
    const draft = buildMinimalDraft(repo, seller.id, buyer.id, product.id);

    const first = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    const second = await repo.generateDealConfirmationPreview(draft.confirmation.id);
    expect(first.confirmation.confirmationNumber).toBe("VCMG 0001");
    expect(second.confirmation.confirmationNumber).toBe("VCMG 0001");
    db.close();
  });

  it("clique duplo em gerar previa (chamadas concorrentes): nunca reserva dois numeros diferentes pra mesma confirmacao", async () => {
    const { repo, db, seller, buyer, product } = await setup();
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
    const { repo, db, seller, buyer, product } = await setup();
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
});
