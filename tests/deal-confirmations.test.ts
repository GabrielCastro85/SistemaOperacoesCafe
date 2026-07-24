import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const graoId = "22222222-2222-4222-8222-222222222222";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
const graoLegalEntityId = "44444444-4444-4444-8444-444444444441";

function setup() {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-deals-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Villa", appVariant: "multiempresa", defaultOrganizationId: villaId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const seller = repo.createBusinessPartner({ organizationId: villaId, displayName: "Villa Coffee Vendedora", notes: null, roles: ["SELLER"], isActive: true });
  const buyer = repo.createBusinessPartner({ organizationId: villaId, displayName: "Empresa IF Compradora", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
  const graoPartner = repo.createBusinessPartner({ organizationId: graoId, displayName: "Parceiro Grao", notes: null, roles: ["BUYER"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  return { repo, db, dirs, seller, buyer, graoPartner, product };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("deal confirmations", () => {
  it("creates manual confirmation with exact 685 + 426 sacks and issues immutable PDF", async () => {
    const { repo, db, seller, buyer, product } = setup();
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
    expect(preview.confirmation.confirmationNumber).toBe("VC 0001");
    const issued = await repo.issueDealConfirmation(draft.confirmation.id);
    expect(issued.confirmation.confirmationNumber).toBe("VC 0001");
    expect(issued.confirmation.status).toBe("ISSUED");
    const official = issued.documents.find((doc) => doc.documentType === "ISSUED_ORIGINAL");
    expect(official?.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(official?.storedFilePath && existsSync(official.storedFilePath)).toBe(true);
    expect(() => repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, "Bloqueado", "1", "1", 3))).toThrow(/nao pode ser editada/);
    db.close();
  });

  it("imports signed PDF externally, preserves original and does not claim crypto validation", async () => {
    const { repo, db, dirs, seller, buyer, product } = setup();
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

  it("deletes a confirmation with linked data and stored documents", async () => {
    const { repo, db, seller, buyer, product } = setup();
    const issued = await issueMinimal(repo, seller.id, buyer.id, product.id);
    const storedPath = issued.documents.find((doc) => doc.documentType === "ISSUED_ORIGINAL")?.storedFilePath;
    expect(storedPath && existsSync(storedPath)).toBe(true);

    expect(repo.deleteDealConfirmation(issued.confirmation.id)).toBe(true);

    expect(repo.listDealConfirmations({ organizationId: villaId }).some((item) => item.id === issued.confirmation.id)).toBe(false);
    expect(() => repo.getDealConfirmation(issued.confirmation.id)).toThrow(/nao encontrada/);
    expect(storedPath ? existsSync(storedPath) : true).toBe(false);
    db.close();
  });

  it("creates from operation and fiscal document without changing billing status", async () => {
    const { repo, db, product } = setup();
    const buyer = repo.createBusinessPartner({ organizationId: villaId, displayName: "DIAMANTE CAFE", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
    repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: buyer.id, ownLegalEntityId: null, productId: product.id, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
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

  it("creates confirmation using the own legal entity from the selected fiscal document", () => {
    const { repo, db, buyer, product } = setup();
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
    const { repo, db, seller, product } = setup();
    const sharedBuyer = repo.createBusinessPartner({ organizationId: graoId, displayName: "Cliente Compartilhado Grao", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
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
    const { repo, db, seller, buyer, graoPartner, product } = setup();
    const issued = await issueMinimal(repo, seller.id, buyer.id, product.id);
    expect(() => repo.addDealConfirmationParty({ dealConfirmationId: issued.confirmation.id, partyRole: "OTHER", businessPartnerId: graoPartner.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 5 })).toThrow(/editada|outra organizacao/);
    const cancelled = repo.cancelDealConfirmation(issued.confirmation.id, "Desistencia formal");
    expect(cancelled.confirmation.status).toBe("CANCELLED");
    const replacement = repo.replaceDealConfirmation(cancelled.confirmation.id, "Nova negociacao");
    expect(replacement.confirmation.status).toBe("DRAFT");
    const summary = repo.getDealConfirmationSummary({ organizationId: villaId, ownLegalEntityId: null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null });
    expect(summary.confirmations).toBeGreaterThanOrEqual(2);
    const report = await repo.generateConfirmationReport({ reportType: "CONFIRMATIONS_PERIOD", format: "EXCEL", filters: { organizationId: villaId, ownLegalEntityId: null, dateStart: null, dateEnd: null, sellerPartnerId: null, buyerPartnerId: null, productId: null, status: null, signatureStatus: null } });
    expect(existsSync(report.storedFilePath)).toBe(true);
    expect(() => repo.reserveDealConfirmationNumber(graoId, graoLegalEntityId)).not.toThrow();
    db.close();
  });

  it("persists brokerage percentage, bank/PIX data and a delivery-recipient party through create, update and PDF generation", async () => {
    const { repo, db, seller, buyer, product } = setup();
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
    const { repo, db, product } = setup();
    const buyer = repo.createBusinessPartner({
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

  it("rejects compact confirmation PDF with more than four items", async () => {
    const { repo, db, buyer, product } = setup();
    const draft = repo.createDealConfirmationDraft({ organizationId: villaId, ownLegalEntityId, confirmationDate: "2026-07-17", paymentTermsSnapshot: "A vista" });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: null, partnerLegalEntityId: null, ownLegalEntityId, manualName: null, representativeName: null, sortOrder: 1 });
    repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyer.id, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
    for (let index = 0; index < 5; index += 1) {
      repo.addDealConfirmationItem(itemInput(draft.confirmation.id, product.id, `Cafe ${index + 1}`, "10", "1000", index));
    }
    await expect(repo.generateDealConfirmationPreview(draft.confirmation.id)).rejects.toThrow(/ate 4 itens/);
    db.close();
  });

  it("names issued PDF with seller, buyer and confirmation sequence", async () => {
    const { repo, db, product } = setup();
    const buyer = repo.createBusinessPartner({ organizationId: villaId, displayName: "DIAMANTE CAFE", notes: null, roles: ["BUYER", "CLIENT"], isActive: true });
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
    db.close();
  });

  it("manages templates and clause library with defaults", () => {
    const { repo, db } = setup();
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

async function issueMinimal(repo: AppRepository, sellerId: string, buyerId: string, productId: string) {
  const draft = repo.createDealConfirmationDraft({ organizationId: villaId, ownLegalEntityId, confirmationDate: "2026-07-17", paymentTermsSnapshot: "A vista", deliveryLocationSnapshot: "Armazem", qualityTermsSnapshot: "Padrao", generalTermsSnapshot: "Revisado" });
  repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "SELLER", businessPartnerId: sellerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 1 });
  repo.addDealConfirmationParty({ dealConfirmationId: draft.confirmation.id, partyRole: "BUYER", businessPartnerId: buyerId, partnerLegalEntityId: null, ownLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 2 });
  repo.addDealConfirmationItem(itemInput(draft.confirmation.id, productId, "Cafe", "1.111", "1000.1234", 0));
  repo.addDealConfirmationClause({ dealConfirmationId: draft.confirmation.id, clauseNumber: "1", title: "Demo", clauseText: "<script>alert(1)</script> deve sair como texto escapado.", sortOrder: 0, isVisible: true });
  return repo.issueDealConfirmation(draft.confirmation.id);
}
