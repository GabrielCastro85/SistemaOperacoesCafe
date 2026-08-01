import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import { inspectXmlFile } from "../electron/main/services/xmlNfeService";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
const ownCnpj = "11222333000181";
const partnerCnpj = "22333444000181";

async function setup(): Promise<{ repo: AppRepository; db: ReturnType<typeof initializeDatabase>; productId: string; dir: string }> {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-triangulada-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db);
  repo.saveInstallationProfile({
    installationName: "Villa",
    appVariant: "villa",
    defaultOrganizationId: villaId,
    defaultLegalEntityId: ownLegalEntityId,
    allowOrganizationSwitch: false,
    allowLegalEntitySwitch: true,
    completedSetup: true
  });
  await repo.updateLegalEntity(ownLegalEntityId, {
    organizationId: villaId,
    legalName: "Villa Coffee MG",
    tradeName: "Villa MG",
    cnpj: ownCnpj,
    stateRegistration: null,
    municipalRegistration: null,
    email: null,
    phone: null,
    addressLine: "Rua A",
    addressNumber: "1",
    addressComplement: null,
    district: "Centro",
    state: "MG",
    city: "Varginha",
    postalCode: "37000000",
    documentPrefix: null,
    isActive: true,
    isDraft: false
  });
  const product = repo.listProducts({ organizationId: villaId })[0];
  return { repo, db, productId: product.id, dir: userData };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("nota triangulada (compra de um fornecedor + venda pra outro corretor na mesma remessa)", () => {
  it("reconhece automaticamente os dois lados por CNPJ+papel e gera duas operacoes (compra + venda) a partir da mesma nota", async () => {
    const { repo, db, productId, dir } = await setup();

    const leo = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    const leoCnpj = "33947549000228";
    await repo.createPartnerLegalEntity({
      organizationId: villaId, businessPartnerId: leo.id, legalName: "Leo ES Comercio Ltda", tradeName: "Leo ES Comercio Ltda", cnpj: leoCnpj,
      stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null,
      district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false
    });
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: leo.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 150, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    const valani = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Valani", notes: null, roles: ["CLIENT"], isActive: true });
    const primaveraCnpj = "12826691000247";
    await repo.createPartnerLegalEntity({
      organizationId: villaId, businessPartnerId: valani.id, legalName: "Primavera Cafe Ltda", tradeName: "Primavera Cafe Ltda", cnpj: primaveraCnpj,
      stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null,
      district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false
    });
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: valani.id, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 400, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    // Leo ES emite direto pro CNPJ da Primavera -- nem Villa nem Grao aparecem no XML.
    const key = makeAccessKey();
    const xml = nfeXml(key)
      .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>${leoCnpj}</CNPJ>`)
      .replace(`<CNPJ>${partnerCnpj}</CNPJ>`, `<CNPJ>${primaveraCnpj}</CNPJ>`);
    const filePath = join(dir, "nfe-triangulada-auto.xml");
    writeFileSync(filePath, xml, "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111130");
    const job = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId, operationScope: "EXTERNAL", operationType: "PURCHASE", productId, createOperations: true }
    });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);

    expect(result.files[0].errorMessage).toBeNull();
    expect(result.job.importedNotes).toBe(1);
    expect(result.job.createdOperations).toBe(2);
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    expect(detail.document.responsiblePartnerId).toBe(leo.id);
    expect(detail.document.secondaryResponsiblePartnerId).toBe(valani.id);
    expect(detail.document.secondaryOperationType).toBe("SALE");
    expect(detail.operations).toHaveLength(2);

    const purchaseLeg = detail.operations.find((op) => op.operationType === "PURCHASE");
    const saleLeg = detail.operations.find((op) => op.operationType === "SALE");
    expect(purchaseLeg?.responsiblePartnerId).toBe(leo.id);
    expect(purchaseLeg?.appliedRateValueCents).toBe(150);
    expect(saleLeg?.responsiblePartnerId).toBe(valani.id);
    expect(saleLeg?.appliedRateValueCents).toBe(400);
    expect(purchaseLeg?.quantitySacks).toBe(saleLeg?.quantitySacks);

    // As duas pernas ficam isoladas nos fluxos de acerto/cobranca de cada lado.
    const purchaseEligible = repo.findEligiblePurchaseOperations({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: leo.id, periodStart: "2026-01-01", periodEnd: "2026-12-31" });
    expect(purchaseEligible).toHaveLength(1);
    expect(purchaseEligible[0].id).toBe(purchaseLeg?.id);
    const chargeEligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: valani.id, periodStart: "2026-01-01", periodEnd: "2026-12-31" });
    expect(chargeEligible).toHaveLength(1);
    expect(chargeEligible[0].id).toBe(saleLeg?.id);
    // O lado de compra nunca aparece elegivel pra cobranca do Valani, nem o de venda pro acerto do Leo.
    expect(repo.findEligiblePurchaseOperations({ organizationId: villaId, ownLegalEntityId, supplierPartnerId: valani.id, periodStart: "2026-01-01", periodEnd: "2026-12-31" })).toHaveLength(0);
    expect(repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: leo.id, periodStart: "2026-01-01", periodEnd: "2026-12-31" })).toHaveLength(0);

    db.close();
  });

  it("resolve a regra de preco da segunda perna contra a empresa do parceiro SECUNDARIO, nao contra a contraparte original da nota", async () => {
    // Bug real reportado: com uma regra generica "mesma UF" (R$5/saca) e uma
    // regra especifica pra empresa da Primavera (R$4/saca), a segunda perna
    // (venda pro Valani) estava sempre caindo na regra generica -- porque a
    // resolucao usava a contraparte da nota original (a empresa do Leo ES),
    // nao a empresa do Valani (Primavera), entao a regra especifica nunca
    // batia.
    const { repo, db, productId, dir } = await setup();
    const leo = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    const leoCnpj = "33947549000228";
    await repo.createPartnerLegalEntity({
      organizationId: villaId, businessPartnerId: leo.id, legalName: "Leo ES Comercio Ltda", tradeName: "Leo ES Comercio Ltda", cnpj: leoCnpj,
      stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null,
      district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false
    });
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: leo.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 150, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    const valani = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Valani", notes: null, roles: ["CLIENT"], isActive: true });
    const primaveraCnpj = "12826691000247";
    const primavera = await repo.createPartnerLegalEntity({
      organizationId: villaId, businessPartnerId: valani.id, legalName: "Primavera Cafe Ltda", tradeName: "Primavera Cafe Ltda", cnpj: primaveraCnpj,
      stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null,
      district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false
    });
    // Regra generica (mesma UF, sem empresa especifica) -- prioridade baixa.
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: valani.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 5, notes: null, isActive: true });
    // Regra especifica pra empresa da Primavera -- mais especifica, deve vencer.
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: valani.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: primavera.id, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 400, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    const key = makeAccessKey(9020);
    const xml = nfeXml(key)
      .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>${leoCnpj}</CNPJ>`)
      .replace(`<CNPJ>${partnerCnpj}</CNPJ>`, `<CNPJ>${primaveraCnpj}</CNPJ>`);
    const filePath = join(dir, "nfe-triangulada-regra-especifica.xml");
    writeFileSync(filePath, xml, "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111140");
    const job = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId, operationScope: "EXTERNAL", operationType: "PURCHASE", productId, createOperations: true }
    });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);

    expect(result.files[0].errorMessage).toBeNull();
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    const saleLeg = detail.operations.find((op) => op.operationType === "SALE");
    expect(saleLeg?.appliedRateValueCents).toBe(400);
    db.close();
  });

  it("completar nota triangulada retroativamente tambem resolve a regra especifica da empresa do parceiro secundario", async () => {
    const { repo, db, productId, dir } = await setup();
    const leo = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    const leoCnpj = "33947549000228";
    await repo.createPartnerLegalEntity({
      organizationId: villaId, businessPartnerId: leo.id, legalName: "Leo ES Comercio Ltda", tradeName: "Leo ES Comercio Ltda", cnpj: leoCnpj,
      stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null,
      district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false
    });
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: leo.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 150, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    const primaveraCnpj = "12826691000247";
    const key = makeAccessKey(9021);
    const xml = nfeXml(key)
      .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>${leoCnpj}</CNPJ>`)
      .replace(`<CNPJ>${partnerCnpj}</CNPJ>`, `<CNPJ>${primaveraCnpj}</CNPJ>`);
    const filePath = join(dir, "nfe-leo-antes-valani-regra.xml");
    writeFileSync(filePath, xml, "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111141");
    const job = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId, operationScope: "EXTERNAL", operationType: "PURCHASE", productId, createOperations: true }
    });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const importResult = await repo.executeXmlImportJob(job.id);
    const existingDocumentId = importResult.files[0].fiscalDocumentId as string;

    const valani = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Valani", notes: null, roles: ["CLIENT"], isActive: true });
    const primavera = await repo.createPartnerLegalEntity({
      organizationId: villaId, businessPartnerId: valani.id, legalName: "Primavera Cafe Ltda", tradeName: "Primavera Cafe Ltda", cnpj: primaveraCnpj,
      stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null,
      district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false
    });
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: valani.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 5, notes: null, isActive: true });
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: valani.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: primavera.id, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 400, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    const detail = repo.completeFiscalDocumentTriangulation(existingDocumentId, { secondaryResponsiblePartnerId: valani.id });
    const saleLeg = detail.operations.find((op) => op.operationType === "SALE");
    expect(saleLeg?.appliedRateValueCents).toBe(400);
    db.close();
  });

  it("nao gera segunda perna quando so' um lado resolve (comportamento de hoje continua igual)", async () => {
    const { repo, db, productId, dir } = await setup();
    const leo = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    const leoCnpj = "33947549000228";
    await repo.createPartnerLegalEntity({
      organizationId: villaId, businessPartnerId: leo.id, legalName: "Leo ES Comercio Ltda", tradeName: "Leo ES Comercio Ltda", cnpj: leoCnpj,
      stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null,
      district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false
    });
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: leo.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 150, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    // Destinatario e' um CNPJ que ninguem cadastrou -- so' o lado do Leo resolve.
    const unregisteredRecipientCnpj = "12826691000247";
    const key = makeAccessKey();
    const xml = nfeXml(key)
      .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>${leoCnpj}</CNPJ>`)
      .replace(`<CNPJ>${partnerCnpj}</CNPJ>`, `<CNPJ>${unregisteredRecipientCnpj}</CNPJ>`);
    const filePath = join(dir, "nfe-triangulada-fallback.xml");
    writeFileSync(filePath, xml, "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111131");
    const job = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId, operationScope: "EXTERNAL", operationType: "PURCHASE", productId, createOperations: true }
    });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);

    expect(result.job.importedNotes).toBe(1);
    expect(result.job.createdOperations).toBe(1);
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    expect(detail.document.secondaryResponsiblePartnerId).toBeNull();
    expect(detail.operations).toHaveLength(1);
    expect(detail.operations[0].operationType).toBe("PURCHASE");
    db.close();
  });

  it("completa a segunda perna ao reimportar XML duplicado depois que o corretor foi cadastrado", async () => {
    const { repo, db, productId, dir } = await setup();
    const leo = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    const leoCnpj = "33947549000228";
    await repo.createPartnerLegalEntity({
      organizationId: villaId, businessPartnerId: leo.id, legalName: "Leo ES Comercio Ltda", tradeName: "Leo ES Comercio Ltda", cnpj: leoCnpj,
      stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null,
      district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false
    });
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: leo.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 150, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    const primaveraCnpj = "12826691000247";
    const key = makeAccessKey(9010);
    const xml = nfeXml(key)
      .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>${leoCnpj}</CNPJ>`)
      .replace(`<CNPJ>${partnerCnpj}</CNPJ>`, `<CNPJ>${primaveraCnpj}</CNPJ>`);
    const firstPath = join(dir, "nfe-leo-antes-valani.xml");
    writeFileSync(firstPath, xml, "utf8");
    const firstInspection = inspectXmlFile(firstPath, "11111111-1111-4111-8111-111111111133");
    const firstJob = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId, operationScope: "EXTERNAL", operationType: "PURCHASE", productId, createOperations: true }
    });
    const firstFile = repo.addXmlImportFile({ importJobId: firstJob.id, originalFileName: firstInspection.originalFileName, fileHash: firstInspection.fileHash, fileSize: firstInspection.fileSize, xmlType: firstInspection.xmlType, accessKey: firstInspection.accessKey, status: firstInspection.status, errorCode: null, errorMessage: null, warningCodes: firstInspection.warnings, extractedData: firstInspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(firstFile.id, firstPath);
    const firstResult = await repo.executeXmlImportJob(firstJob.id);
    const existingDocumentId = firstResult.files[0].fiscalDocumentId as string;
    const before = repo.getFiscalDocument(existingDocumentId);
    expect(before.document.secondaryResponsiblePartnerId).toBeNull();
    expect(before.operations).toHaveLength(1);
    expect(before.operations[0].operationType).toBe("PURCHASE");

    const valani = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Valani", notes: null, roles: ["CLIENT"], isActive: true });
    await repo.createPartnerLegalEntity({
      organizationId: villaId, businessPartnerId: valani.id, legalName: "Primavera Cafe Ltda", tradeName: "Primavera Cafe Ltda", cnpj: primaveraCnpj,
      stateRegistration: null, municipalRegistration: null, email: null, phone: null, addressLine: null, addressNumber: null, addressComplement: null,
      district: null, city: null, state: null, postalCode: null, isPrimary: true, isActive: true, isDraft: false
    });
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: valani.id, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 400, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    const secondPath = join(dir, "nfe-leo-depois-valani.xml");
    writeFileSync(secondPath, xml, "utf8");
    const secondInspection = inspectXmlFile(secondPath, "11111111-1111-4111-8111-111111111134");
    const secondJob = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId, operationScope: "EXTERNAL", operationType: "PURCHASE", productId, createOperations: true }
    });
    const secondFile = repo.addXmlImportFile({ importJobId: secondJob.id, originalFileName: secondInspection.originalFileName, fileHash: secondInspection.fileHash, fileSize: secondInspection.fileSize, xmlType: secondInspection.xmlType, accessKey: secondInspection.accessKey, status: secondInspection.status, errorCode: null, errorMessage: null, warningCodes: secondInspection.warnings, extractedData: secondInspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(secondFile.id, secondPath);
    const secondResult = await repo.executeXmlImportJob(secondJob.id);

    expect(secondResult.files[0].errorMessage).toBeNull();
    const after = repo.getFiscalDocument(existingDocumentId);
    expect(after.document.secondaryResponsiblePartnerId).toBe(valani.id);
    expect(after.document.secondaryOperationType).toBe("SALE");
    expect(after.operations).toHaveLength(2);
    const saleLeg = after.operations.find((op) => op.operationType === "SALE");
    expect(saleLeg?.responsiblePartnerId).toBe(valani.id);
    expect(saleLeg?.appliedRateValueCents).toBe(400);
    expect(repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: valani.id, periodStart: "2026-01-01", periodEnd: "2026-12-31" })).toHaveLength(1);
    db.close();
  });

  it("resolucao manual: revisor indica o segundo parceiro (secondaryPartnerId) mesmo sem deteccao automatica", async () => {
    const { repo, db, productId, dir } = await setup();
    const leo = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: leo.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 150, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    const valani = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Valani", notes: null, roles: ["CLIENT"], isActive: true });
    await repo.createServiceRateRule({ organizationId: villaId, businessPartnerId: valani.id, ownLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 400, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    // Nem emitente nem destinatario batem com nada cadastrado -- so' vira
    // triangulada porque o revisor manual indicou o clientPartnerId (Leo) e o
    // secondaryPartnerId (Valani) explicitamente.
    const key = makeAccessKey();
    const thirdPartyIssuerCnpj = "99888777000166";
    const thirdPartyRecipientCnpj = "12826691000247";
    const xml = nfeXml(key)
      .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>${thirdPartyIssuerCnpj}</CNPJ>`)
      .replace(`<CNPJ>${partnerCnpj}</CNPJ>`, `<CNPJ>${thirdPartyRecipientCnpj}</CNPJ>`);
    const filePath = join(dir, "nfe-triangulada-manual.xml");
    writeFileSync(filePath, xml, "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111132");
    const job = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId, clientPartnerId: leo.id, secondaryPartnerId: valani.id, operationScope: "EXTERNAL", operationType: "PURCHASE", productId, createOperations: true }
    });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);

    expect(result.files[0].errorMessage).toBeNull();
    expect(result.job.importedNotes).toBe(1);
    expect(result.job.createdOperations).toBe(2);
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    expect(detail.document.responsiblePartnerId).toBe(leo.id);
    expect(detail.document.secondaryResponsiblePartnerId).toBe(valani.id);
    expect(detail.operations.find((op) => op.operationType === "SALE")?.responsiblePartnerId).toBe(valani.id);
    db.close();
  });
});

function makeAccessKey(sequence = 9001): string {
  const number = String(sequence).padStart(9, "0");
  const control = String(sequence).padStart(8, "0");
  const body = `3126071122233300018155001${number}1${control}`;
  let weight = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  const digit = mod === 0 || mod === 1 ? 0 : 11 - mod;
  return `${body}${digit}`;
}

function nfeXml(key: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe${key}" versao="4.00">
      <ide><cUF>31</cUF><natOp>Venda de cafe</natOp><mod>55</mod><serie>1</serie><nNF>9001</nNF><dhEmi>2026-07-16T10:00:00-03:00</dhEmi><tpNF>1</tpNF><cMunFG>3170701</cMunFG><tpEmis>1</tpEmis><tpAmb>1</tpAmb><finNFe>1</finNFe></ide>
      <emit><CNPJ>${ownCnpj}</CNPJ><xNome>Villa Coffee MG</xNome><IE>123</IE><enderEmit><xLgr>Rua A</xLgr><nro>1</nro><xBairro>Centro</xBairro><cMun>3170701</cMun><xMun>Varginha</xMun><UF>MG</UF><CEP>37000000</CEP><fone>3533333333</fone></enderEmit></emit>
      <dest><CNPJ>${partnerCnpj}</CNPJ><xNome>Cliente XML Ltda</xNome><IE>456</IE><email>cliente@example.com</email><enderDest><xLgr>Rua B</xLgr><nro>2</nro><xBairro>Centro</xBairro><cMun>3550308</cMun><xMun>Sao Paulo</xMun><UF>SP</UF><CEP>01000000</CEP><fone>1133333333</fone></enderDest></dest>
      <det nItem="1"><prod><cProd>CAF-001</cProd><cEAN>SEM GTIN</cEAN><xProd>CAFE ARABICA</xProd><NCM>09011110</NCM><CFOP>5102</CFOP><uCom>SC</uCom><qCom>10.5</qCom><vUnCom>1234.567</vUnCom><vProd>12962.95</vProd><uTrib>SC</uTrib><qTrib>10.5</qTrib><vUnTrib>1234.567</vUnTrib></prod><infAdProd>Lote teste</infAdProd></det>
      <total><ICMSTot><vProd>12962.95</vProd><vNF>12962.95</vNF><vDesc>0.00</vDesc><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vOutro>0.00</vOutro><vTotTrib>0.00</vTotTrib></ICMSTot></total>
      <transp><transporta><CNPJ>12345678000195</CNPJ><xNome>Transportadora</xNome></transporta><veicTransp><placa>ABC1234</placa><UF>MG</UF></veicTransp><vol><qVol>10</qVol><esp>Sacas</esp><pesoB>630.000</pesoB><pesoL>600.000</pesoL></vol></transp>
      <infAdic><infCpl>Informacao complementar</infCpl><infAdFisco>Info fisco</infAdFisco></infAdic>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>${key}</chNFe><dhRecbto>2026-07-16T10:05:00-03:00</dhRecbto><nProt>131260000000001</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe>
</nfeProc>`;
}
