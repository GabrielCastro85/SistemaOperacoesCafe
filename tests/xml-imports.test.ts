import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import { inspectXmlFile, isValidAccessKey, parseXmlContent } from "../electron/main/services/xmlNfeService";

const tempDirs: string[] = [];
const villaId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";
const villaEsLegalEntityId = "33333333-3333-4333-8333-333333333332";
const ownCnpj = "11222333000181";
const partnerCnpj = "22333444000181";

async function setup(): Promise<{ repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string; dir: string }> {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-xml-"));
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
  const partner = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente XML", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  await repo.createServiceRateRule({
    organizationId: villaId,
    businessPartnerId: partner.id,
    ownLegalEntityId: null,
    productId: product.id,
    operationScope: "EXTERNAL",
    rateType: "PER_SACK",
    rateValueCents: 500,
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    priority: 10,
    notes: null,
    isActive: true
  });
  return { repo, db, partnerId: partner.id, productId: product.id, dir: userData };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("xml imports", () => {
  it("parses NF-e XML securely and validates access keys", () => {
    const key = makeAccessKey();
    const parsed = parseXmlContent(nfeXml(key));
    expect(parsed.xmlType).toBe("NFE_PROC");
    expect(parsed.accessKey).toBe(key);
    expect(isValidAccessKey(key)).toBe(true);
    expect(() => parseXmlContent(`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`)).toThrow(/DTD|Entidades/);
    expect(() => parseXmlContent("<nfeProc><NFe>")).toThrow(/malformado/);
  });

  it("rounds vUnCom/vUnTrib with SEFAZ-max precision (10 decimals) instead of rejecting the note", () => {
    // Real-world authorized NF-e: vUnCom/vUnTrib padded to 10 decimal places ("1997.0000000000"),
    // which previously threw "Decimal invalido." because normalizeDecimalText caps at 6 decimals.
    const parsed = parseXmlContent(realWorldHighPrecisionNfeXml());
    expect(parsed.xmlType).toBe("NFE_PROC");
    const items = (parsed.extractedData as { items: Array<{ commercialUnitValue: string; taxableUnitValue: string; commercialQuantity: string }> }).items;
    expect(items[0].commercialUnitValue).toBe("1997");
    expect(items[0].taxableUnitValue).toBe("1997");
    expect(items[0].commercialQuantity).toBe("350");
  });

  it("imports a valid XML into fiscal documents, items and operations", async () => {
    const { repo, db, partnerId, productId, dir } = await setup();
    const key = makeAccessKey();
    const filePath = join(dir, "nfe.xml");
    writeFileSync(filePath, nfeXml(key), "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111111");
    const job = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: { clientPartnerId: partnerId, operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true } });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);
    expect(result.files[0].errorMessage).toBeNull();
    expect(result.job.importedNotes).toBe(1);
    expect(result.job.createdOperations).toBe(1);
    const imported = result.files[0];
    const detail = repo.getFiscalDocument(imported.fiscalDocumentId as string);
    expect(detail.document.source).toBe("XML");
    expect(detail.document.direction).toBe("OUTBOUND");
    expect(detail.items).toHaveLength(1);
    expect(detail.operations[0].serviceAmountCents).toBe(5250);
    // A clean XML import (no pending issues) auto-confirms the note and its operation,
    // so it shows up ready-to-bill without a separate manual "Confirmar" step.
    expect(detail.document.status).toBe("CONFIRMED");
    expect(detail.operations[0].status).toBe("CONFIRMED");
    expect(detail.operations[0].billingStatus).toBe("UNBILLED");
    const eligible = repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: partnerId, periodStart: "2026-01-01", periodEnd: "2026-12-31" });
    expect(eligible).toHaveLength(1);
    db.close();
  });

  it("imports an incoming (purchase) XML for a supplier-only partner without requiring the CLIENT role", async () => {
    const { repo, db, productId, dir } = await setup();
    const supplier = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Fornecedor XML", notes: null, roles: ["SUPPLIER"], isActive: true });
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: supplier.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    const key = makeAccessKey();
    // Inverte emit/dest do XML de venda padrao: CNPJ proprio vira destinatario
    // (recebe a mercadoria), CNPJ do parceiro vira emitente (fornecedor) --
    // e' exatamente isso que faz resolveOwnLegalEntityForXml reconhecer a nota
    // como INBOUND/PURCHASE.
    const purchaseXml = nfeXml(key)
      .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>__PARTNER_CNPJ__</CNPJ>`)
      .replace(`<CNPJ>${partnerCnpj}</CNPJ>`, `<CNPJ>${ownCnpj}</CNPJ>`)
      .replace(`<CNPJ>__PARTNER_CNPJ__</CNPJ>`, `<CNPJ>${partnerCnpj}</CNPJ>`);
    const filePath = join(dir, "nfe-compra.xml");
    writeFileSync(filePath, purchaseXml, "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111111");
    const job = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: { clientPartnerId: supplier.id, operationScope: "EXTERNAL", operationType: "PURCHASE", productId, createOperations: true } });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);
    expect(result.files[0].errorMessage).toBeNull();
    expect(result.job.importedNotes).toBe(1);
    expect(result.job.createdOperations).toBe(1);
    const imported = result.files[0];
    const detail = repo.getFiscalDocument(imported.fiscalDocumentId as string);
    expect(detail.document.direction).toBe("INBOUND");
    expect(detail.document.responsiblePartnerId).toBe(supplier.id);
    expect(detail.operations[0].operationType).toBe("PURCHASE");
    expect(detail.operations[0].serviceAmountCents).toBe(5250);
    expect(detail.document.status).toBe("CONFIRMED");
    db.close();
  });

  it("recognizes a real own recipient CNPJ as INBOUND even when a different own CNPJ was manually selected, instead of treating the third-party issuer as own", async () => {
    // Reproduz o bug do card "Operando em" mostrando o nome do emitente terceirizado:
    // o operador seleciona manualmente um CNPJ proprio (Villa MG) que nao bate com
    // nenhum dos dois lados do XML, mas o DESTINATARIO real e' outro CNPJ proprio ja
    // cadastrado (Villa ES) e o EMITENTE e' um terceiro genuino (nao vazio). Antes da
    // correcao, isso criava uma legal_entity "TERC-XML" pro terceiro e a usava como se
    // fosse a empresa propria da nota -- em vez de reconhecer a Villa ES como
    // destinataria real (INBOUND/PURCHASE).
    const { repo, db, productId, dir } = await setup();
    const supplier = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Fornecedor Terceirizado", notes: null, roles: ["SUPPLIER"], isActive: true });
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: supplier.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });
    const thirdPartyCnpj = "99888777000166";
    const villaEsCnpj = "44963370000280";
    const key = makeAccessKey();
    const xml = nfeXml(key)
      .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>${thirdPartyCnpj}</CNPJ>`)
      .replace(`<CNPJ>${partnerCnpj}</CNPJ>`, `<CNPJ>${villaEsCnpj}</CNPJ>`);
    const filePath = join(dir, "nfe-mismatched-own-selection.xml");
    writeFileSync(filePath, xml, "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111120");
    const job = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId, clientPartnerId: supplier.id, operationScope: "EXTERNAL", operationType: "PURCHASE", productId, createOperations: true }
    });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);
    expect(result.files[0].errorMessage).toBeNull();
    expect(result.job.importedNotes).toBe(1);
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    expect(detail.document.ownLegalEntityId).toBe(villaEsLegalEntityId);
    expect(repo.getLegalEntity(detail.document.ownLegalEntityId).documentPrefix).not.toBe("TERC-XML");
    expect(detail.document.direction).toBe("INBOUND");
    db.close();
  });

  it("recognizes a triangulated purchase (supplier's note issued to a third company, neither side is our own CNPJ) as a PURCHASE from that supplier instead of a third-party sale", async () => {
    // Cenario real: o Leo ES entrega direto pro comprador final, entao a nota
    // dele sai da EMPRESA DELE pra' uma OUTRA empresa (nem Villa nem Grao &
    // Grao aparecem no XML). Sem reconhecer isso, cairia no fallback
    // generico de "nota terceirizada" (empresa-placeholder + venda) em vez de
    // virar uma compra nossa do Leo, elegivel pra "Acertos de entrada".
    const { repo, db, productId, dir } = await setup();
    const leo = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Leo ES", notes: null, roles: ["SUPPLIER"], isActive: true });
    const leoCnpj = "33947549000228";
    await repo.createPartnerLegalEntity({
      organizationId: villaId,
      businessPartnerId: leo.id,
      legalName: "Futura Comercio Atacadista Ltda",
      tradeName: "Futura Comercio Atacadista Ltda",
      cnpj: leoCnpj,
      stateRegistration: null,
      municipalRegistration: null,
      email: null,
      phone: null,
      addressLine: null,
      addressNumber: null,
      addressComplement: null,
      district: null,
      city: null,
      state: null,
      postalCode: null,
      isPrimary: true,
      isActive: true,
      isDraft: false
    });
    await repo.createPurchaseRateRule({ organizationId: villaId, businessPartnerId: leo.id, ownLegalEntityId: null, counterpartyPartnerLegalEntityId: null, productId, operationScope: "EXTERNAL", rateType: "PER_SACK", rateValueCents: 500, effectiveFrom: "2026-01-01", effectiveTo: null, priority: 10, notes: null, isActive: true });

    const thirdPartyRecipientCnpj = "12826691000247";
    const key = makeAccessKey();
    const xml = nfeXml(key)
      .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>${leoCnpj}</CNPJ>`)
      .replace(`<CNPJ>${partnerCnpj}</CNPJ>`, `<CNPJ>${thirdPartyRecipientCnpj}</CNPJ>`);
    const filePath = join(dir, "nfe-triangulada.xml");
    writeFileSync(filePath, xml, "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111119");
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
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    expect(detail.document.ownLegalEntityId).toBe(ownLegalEntityId);
    expect(repo.getLegalEntity(detail.document.ownLegalEntityId).documentPrefix).not.toBe("TERC-XML");
    expect(detail.document.direction).toBe("INBOUND");
    expect(detail.document.responsiblePartnerId).toBe(leo.id);
    expect(detail.operations[0].operationType).toBe("PURCHASE");
    expect(detail.operations[0].serviceAmountCents).toBeGreaterThan(0);
    db.close();
  });

  it("converts XML quantities in kg, tons and big bags to equivalent sacks for billing", async () => {
    const cases = [
      {
        fileName: "nfe-kg.xml",
        xml: nfeXml(makeAccessKey()).replace(/<uCom>SC<\/uCom><qCom>10\.5<\/qCom>/, "<uCom>KG</uCom><qCom>630</qCom>"),
        unit: "KG",
        sacks: "10.5"
      },
      {
        fileName: "nfe-ton.xml",
        xml: nfeXml(makeAccessKey()).replace(/<uCom>SC<\/uCom><qCom>10\.5<\/qCom>/, "<uCom>T</uCom><qCom>0.63</qCom>"),
        unit: "TON",
        sacks: "10.5"
      },
      {
        fileName: "nfe-big-bag.xml",
        xml: nfeXml(makeAccessKey()).replace("CAFE ARABICA", "CAFE ARABICA BIG BAG").replace(/<uCom>SC<\/uCom><qCom>10\.5<\/qCom>/, "<uCom>BAG</uCom><qCom>1.5</qCom>"),
        unit: "UNIT",
        sacks: "25"
      }
    ] as const;

    for (const itemCase of cases) {
      const { repo, db, partnerId, productId, dir } = await setup();
      const filePath = join(dir, itemCase.fileName);
      writeFileSync(filePath, itemCase.xml, "utf8");
      const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111119");
      const job = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: { clientPartnerId: partnerId, operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true } });
      const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
      repo.setXmlImportFileStoredPath(file.id, filePath);
      const result = await repo.executeXmlImportJob(job.id);
      const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);

      expect(detail.items[0].unit).toBe(itemCase.unit);
      expect(detail.items[0].sacksQuantity).toBe(itemCase.sacks);
      expect(detail.operations[0].quantitySacks).toBe(itemCase.sacks);
      db.close();
    }
  });

  it("classifies mixed XML batches by each counterparty state automatically", async () => {
    const { repo, db, partnerId, productId, dir } = await setup();
    await repo.createServiceRateRule({
      organizationId: villaId,
      businessPartnerId: partnerId,
      ownLegalEntityId: null,
      productId,
      operationScope: "INTERNAL",
      rateType: "PER_SACK",
      rateValueCents: 500,
      effectiveFrom: "2026-07-01",
      effectiveTo: null,
      priority: 10,
      notes: null,
      isActive: true
    });
    const internalPath = join(dir, "nfe-mg.xml");
    const externalPath = join(dir, "nfe-sp.xml");
    writeFileSync(internalPath, nfeXml(makeAccessKey(9101)).replace("<cMun>3550308</cMun><xMun>Sao Paulo</xMun><UF>SP</UF>", "<cMun>3139409</cMun><xMun>Manhuacu</xMun><UF>MG</UF>"), "utf8");
    writeFileSync(externalPath, nfeXml(makeAccessKey(9102)), "utf8");
    const internalInspection = inspectXmlFile(internalPath, "11111111-1111-4111-8111-111111111121");
    const externalInspection = inspectXmlFile(externalPath, "11111111-1111-4111-8111-111111111122");
    const job = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "MULTIPLE_FILES",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId, clientPartnerId: partnerId, operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true }
    });
    const internalFile = repo.addXmlImportFile({ importJobId: job.id, originalFileName: internalInspection.originalFileName, fileHash: internalInspection.fileHash, fileSize: internalInspection.fileSize, xmlType: internalInspection.xmlType, accessKey: internalInspection.accessKey, status: internalInspection.status, errorCode: null, errorMessage: null, warningCodes: internalInspection.warnings, extractedData: internalInspection.extractedData, resolutionData: null });
    const externalFile = repo.addXmlImportFile({ importJobId: job.id, originalFileName: externalInspection.originalFileName, fileHash: externalInspection.fileHash, fileSize: externalInspection.fileSize, xmlType: externalInspection.xmlType, accessKey: externalInspection.accessKey, status: externalInspection.status, errorCode: null, errorMessage: null, warningCodes: externalInspection.warnings, extractedData: externalInspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(internalFile.id, internalPath);
    repo.setXmlImportFileStoredPath(externalFile.id, externalPath);

    const result = await repo.executeXmlImportJob(job.id);

    expect(result.job.importedNotes).toBe(2);
    const operationScopes = result.files.map((file) => repo.getFiscalDocument(file.fiscalDocumentId as string).operations[0].operationScope).sort();
    expect(operationScopes).toEqual(["EXTERNAL", "INTERNAL"]);
    db.close();
  });

  it("imports XML under the invoice own CNPJ when the selected CNPJ is different", async () => {
    const { repo, db, partnerId, productId, dir } = await setup();
    const key = makeAccessKey();
    const filePath = join(dir, "nfe-wrong-own-cnpj.xml");
    writeFileSync(filePath, nfeXml(key), "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111118");
    const job = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId: villaEsLegalEntityId, clientPartnerId: partnerId, operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true }
    });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);
    expect(result.job.importedNotes).toBe(1);
    expect(result.files[0].status).toBe("IMPORTED");
    expect(result.files[0].errorMessage).toBeNull();
    expect(repo.listFiscalDocuments({ organizationId: villaId, ownLegalEntityId: villaEsLegalEntityId })).toHaveLength(0);
    expect(repo.listFiscalDocuments({ organizationId: villaId, ownLegalEntityId })).toHaveLength(1);
    db.close();
  });

  it("accepts XML from a third-party issuer as a billing-only operation", async () => {
    const { repo, db, partnerId, productId, dir } = await setup();
    const key = makeAccessKey();
    const thirdPartyCnpj = "99888777000166";
    const filePath = join(dir, "nfe-third-party.xml");
    const xml = nfeXml(key)
      .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>${thirdPartyCnpj}</CNPJ>`)
      .replace("<xNome>Emitente Cafe Ltda</xNome>", "<xNome>Terceirizada Cafe Ltda</xNome>");
    writeFileSync(filePath, xml, "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111119");
    const job = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { ownLegalEntityId, clientPartnerId: partnerId, operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true }
    });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);
    expect(result.job.importedNotes).toBe(1);
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    const thirdParty = repo.getLegalEntity(detail.document.ownLegalEntityId);
    expect(thirdParty.cnpj).toBe(thirdPartyCnpj);
    expect(thirdParty.documentPrefix).toBe("TERC-XML");
    expect(detail.document.notes).toContain("Nota terceirizada");
    expect(detail.operations[0].serviceAmountCents).toBeGreaterThan(0);
    db.close();
  });

  it("generates the same third-party placeholder legal entity id on two independent PCs, so they don't collide when both sync to Supabase", async () => {
    // Reproduz o bug real: dois PCs importam, cada um por conta propria (antes
    // de sincronizar entre si), uma nota do MESMO terceiro (mesmo CNPJ
    // emitente). Se o id fosse aleatorio, os dois pushes pro Supabase
    // colidiriam no indice unico de CNPJ (idx_legal_entities_cnpj_unique),
    // ambos com "Ja existe um registro com esses dados" -- exatamente o erro
    // visto em producao.
    const thirdPartyCnpj = "99888777000166";
    const first = await setup();
    const second = await setup();
    for (const { repo, partnerId, productId, dir } of [first, second]) {
      const key = makeAccessKey();
      const filePath = join(dir, "nfe-third-party.xml");
      const xml = nfeXml(key)
        .replace(`<CNPJ>${ownCnpj}</CNPJ>`, `<CNPJ>${thirdPartyCnpj}</CNPJ>`)
        .replace("<xNome>Emitente Cafe Ltda</xNome>", "<xNome>Terceirizada Cafe Ltda</xNome>");
      writeFileSync(filePath, xml, "utf8");
      const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111119");
      const job = repo.createXmlImportDraft({
        organizationId: villaId,
        sourceType: "FILE",
        selectedFolder: null,
        includeSubfolders: false,
        settings: { ownLegalEntityId, clientPartnerId: partnerId, operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true }
      });
      const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
      repo.setXmlImportFileStoredPath(file.id, filePath);
      await repo.executeXmlImportJob(job.id);
    }
    const firstEntity = first.repo.listLegalEntities({ organizationId: villaId, status: "all" }).find((e) => e.cnpj === thirdPartyCnpj);
    const secondEntity = second.repo.listLegalEntities({ organizationId: villaId, status: "all" }).find((e) => e.cnpj === thirdPartyCnpj);
    expect(firstEntity?.id).toBeTruthy();
    expect(firstEntity?.id).toBe(secondEntity?.id);
    first.db.close();
    second.db.close();
  });

  it("auto-matches the counterparty by CNPJ without an explicit clientPartnerId", async () => {
    const { repo, db, partnerId, productId, dir } = await setup();
    await repo.createPartnerLegalEntity({
      organizationId: villaId,
      businessPartnerId: partnerId,
      legalName: "Cliente XML Ltda",
      tradeName: "Cliente XML Ltda",
      cnpj: partnerCnpj,
      stateRegistration: null,
      municipalRegistration: null,
      email: null,
      phone: null,
      addressLine: null,
      addressNumber: null,
      addressComplement: null,
      district: null,
      city: null,
      state: null,
      postalCode: null,
      isPrimary: true,
      isActive: true,
      isDraft: false
    });
    const key = makeAccessKey();
    const filePath = join(dir, "nfe-cnpj-match.xml");
    writeFileSync(filePath, nfeXml(key), "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111114");
    const job = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: { operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true } });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);
    expect(result.job.importedNotes).toBe(1);
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    expect(detail.document.responsiblePartnerId).toBe(partnerId);
    db.close();
  });

  it("keeps the selected broker as billing client even when the XML company is registered", async () => {
    const { repo, db, partnerId: brokerId, productId, dir } = await setup();
    const company = await repo.createBusinessPartner({ organizationId: villaId, displayName: "Empresa da nota", notes: null, roles: ["CLIENT", "BUYER"], isActive: true });
    await repo.createPartnerLegalEntity({
      organizationId: villaId,
      businessPartnerId: company.id,
      legalName: "Cliente XML Ltda",
      tradeName: "Cliente XML Ltda",
      cnpj: partnerCnpj,
      stateRegistration: null,
      municipalRegistration: null,
      email: null,
      phone: null,
      addressLine: null,
      addressNumber: null,
      addressComplement: null,
      district: null,
      city: null,
      state: null,
      postalCode: null,
      isPrimary: true,
      isActive: true,
      isDraft: false
    });
    const key = makeAccessKey();
    const filePath = join(dir, "nfe-broker-overrides-company.xml");
    writeFileSync(filePath, nfeXml(key), "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111110");
    const job = repo.createXmlImportDraft({
      organizationId: villaId,
      sourceType: "FILE",
      selectedFolder: null,
      includeSubfolders: false,
      settings: { clientPartnerId: brokerId, operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true }
    });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);
    expect(result.job.importedNotes).toBe(1);
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    expect(detail.document.responsiblePartnerId).toBe(brokerId);
    expect(detail.operations[0].responsiblePartnerId).toBe(brokerId);
    expect(detail.document.responsiblePartnerId).not.toBe(company.id);
    expect(repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: brokerId, periodStart: "2026-01-01", periodEnd: "2026-12-31" })).toHaveLength(1);
    expect(repo.findEligibleOperations({ organizationId: villaId, ownLegalEntityId, clientPartnerId: company.id, periodStart: "2026-01-01", periodEnd: "2026-12-31" })).toHaveLength(0);
    db.close();
  });

  it("does not identify an own legal entity by state/name when the CNPJ does not match", async () => {
    const { repo, db, partnerId, productId, dir } = await setup();
    await repo.updateLegalEntity(ownLegalEntityId, {
      organizationId: villaId,
      legalName: "Villa Coffee Comercio Exp. Ltda - Minas Gerais",
      tradeName: "Villa Coffee Minas Gerais",
      cnpj: null,
      stateRegistration: null,
      municipalRegistration: null,
      email: null,
      phone: null,
      addressLine: "Rua A",
      addressNumber: "1",
      addressComplement: null,
      district: "Centro",
      state: "MG",
      city: "Monte Santo de Minas",
      postalCode: "37000000",
      documentPrefix: null,
      isActive: true,
      isDraft: true
    });
    await repo.createPartnerLegalEntity({
      organizationId: villaId,
      businessPartnerId: partnerId,
      legalName: "Cliente XML Ltda",
      tradeName: "Cliente XML Ltda",
      cnpj: partnerCnpj,
      stateRegistration: null,
      municipalRegistration: null,
      email: null,
      phone: null,
      addressLine: null,
      addressNumber: null,
      addressComplement: null,
      district: null,
      city: null,
      state: null,
      postalCode: null,
      isPrimary: true,
      isActive: true,
      isDraft: false
    });
    const key = makeAccessKey();
    const filePath = join(dir, "nfe-own-pending-cnpj.xml");
    writeFileSync(filePath, nfeXml(key), "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111117");
    const job = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: { operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true } });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);
    expect(result.files[0].errorMessage).toBeNull();
    expect(result.job.importedNotes).toBe(1);
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    expect(detail.document.ownLegalEntityId).not.toBe(ownLegalEntityId);
    expect(repo.getLegalEntity(detail.document.ownLegalEntityId).documentPrefix).toBe("TERC-XML");
    expect(detail.document.responsiblePartnerId).toBe(partnerId);
    expect(detail.document.direction).toBe("OUTBOUND");
    db.close();
  });

  it("auto-matches the counterparty by alias when no CNPJ is registered", async () => {
    const { repo, db, partnerId, productId, dir } = await setup();
    repo.createPartnerAlias({ organizationId: villaId, businessPartnerId: partnerId, partnerLegalEntityId: null, alias: "Cliente XML Ltda", source: "TEST", isActive: true });
    const key = makeAccessKey();
    const filePath = join(dir, "nfe-alias-match.xml");
    writeFileSync(filePath, nfeXml(key), "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111115");
    const job = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: { operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true } });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);
    expect(result.job.importedNotes).toBe(1);
    const detail = repo.getFiscalDocument(result.files[0].fiscalDocumentId as string);
    expect(detail.document.responsiblePartnerId).toBe(partnerId);
    db.close();
  });

  it("leaves the file pending for manual review instead of guessing a client when nothing matches", async () => {
    const { repo, db, productId, dir } = await setup();
    const key = makeAccessKey();
    const filePath = join(dir, "nfe-no-match.xml");
    writeFileSync(filePath, nfeXml(key), "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111116");
    const job = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: { operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true } });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = await repo.executeXmlImportJob(job.id);
    expect(result.job.importedNotes).toBe(0);
    expect(result.files[0].status).toBe("PENDING_REVIEW");
    expect(result.files[0].fiscalDocumentId).toBeNull();
    db.close();
  });

  it("merges XML into an existing manual document and imports cancellation event", async () => {
    const { repo, db, partnerId, productId, dir } = await setup();
    const key = makeAccessKey();
    const existing = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partnerId, partnerLegalEntityId: null, accessKey: key, documentNumber: "9001", series: "1", issueDate: "2026-07-16", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
    const xmlPath = join(dir, "merge.xml");
    writeFileSync(xmlPath, nfeXml(key), "utf8");
    const inspection = inspectXmlFile(xmlPath, "11111111-1111-4111-8111-111111111112");
    const job = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: { clientPartnerId: partnerId, operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true } });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, xmlPath);
    await repo.executeXmlImportJob(job.id);
    expect(repo.getFiscalDocument(existing.document.id).document.mergedFromSource).toBe("MANUAL");
    expect(repo.getFiscalDocumentMergeHistory(existing.document.id)).toHaveLength(1);

    const eventPath = join(dir, "cancel.xml");
    writeFileSync(eventPath, cancelXml(key), "utf8");
    const eventInspection = inspectXmlFile(eventPath, "11111111-1111-4111-8111-111111111113");
    const eventJob = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: {} });
    const eventFile = repo.addXmlImportFile({ importJobId: eventJob.id, originalFileName: eventInspection.originalFileName, fileHash: eventInspection.fileHash, fileSize: eventInspection.fileSize, xmlType: eventInspection.xmlType, accessKey: eventInspection.accessKey, status: eventInspection.status, errorCode: null, errorMessage: null, warningCodes: eventInspection.warnings, extractedData: eventInspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(eventFile.id, eventPath);
    await repo.executeXmlImportJob(eventJob.id);
    expect(repo.getFiscalDocument(existing.document.id).document.status).toBe("CANCELED");
    expect(repo.listFiscalDocumentEvents(villaId)[0].eventType).toBe("CANCELLATION");
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

function cancelXml(key: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<procEventoNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <evento><infEvento Id="ID110111${key}01"><tpEvento>110111</tpEvento><chNFe>${key}</chNFe><nSeqEvento>1</nSeqEvento><dhEvento>2026-07-17T08:00:00-03:00</dhEvento><detEvento><xJust>Erro de emissao</xJust></detEvento></infEvento></evento>
  <retEvento><infEvento><chNFe>${key}</chNFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><cStat>135</cStat><xMotivo>Evento registrado</xMotivo><nProt>131260000000002</nProt></infEvento></retEvento>
</procEventoNFe>`;
}

function realWorldHighPrecisionNfeXml(): string {
  // Trimmed real, SEFAZ-authorized NF-e (signature/certificate block removed, not needed by the parser).
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe31260744963370000523550010000006621163793580" versao="4.00"><ide><cUF>31</cUF><cNF>16379358</cNF><natOp>VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCE</natOp><mod>55</mod><serie>1</serie><nNF>662</nNF><dhEmi>2026-07-17T18:14:05-03:00</dhEmi><dhSaiEnt>2026-07-17T18:24:05-03:00</dhSaiEnt><tpNF>1</tpNF><idDest>1</idDest><cMunFG>3143203</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>0</cDV><tpAmb>1</tpAmb><finNFe>1</finNFe><indFinal>0</indFinal><indPres>0</indPres><procEmi>0</procEmi><verProc>4.00</verProc></ide><emit><CNPJ>44963370000523</CNPJ><xNome>VILLA COFFEE COMERCIO E EXP. LTDA</xNome><enderEmit><xLgr>AVENIDA VITAL PAULINO DA COSTA</xLgr><nro>466</nro><xBairro>CENTRO</xBairro><cMun>3143203</cMun><xMun>MONTE SANTO DE MINAS</xMun><UF>MG</UF><CEP>37968000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit><IE>0053761240090</IE><CRT>3</CRT></emit><dest><CNPJ>12454636000192</CNPJ><xNome>S B DE OLIVEIRA COMERCIO DE CAFE LTDA</xNome><enderDest><xLgr>AVENIDA AILTON ALVES DOS SANTOS</xLgr><nro>601</nro><xBairro>POUSO ALEGRE</xBairro><cMun>3139409</cMun><xMun>MANHUACU</xMun><UF>MG</UF><CEP>36904082</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderDest><indIEDest>1</indIEDest><IE>0024322560040</IE></dest><det nItem="1"><prod><cProd>1</cProd><cEAN>1000000000016</cEAN><xProd>CAFE EM GRAOS CRU ARABICA</xProd><NCM>09011110</NCM><CEST>1709601</CEST><CFOP>5102</CFOP><uCom>SC</uCom><qCom>350.0000</qCom><vUnCom>1997.0000000000</vUnCom><vProd>698950.00</vProd><cEANTrib>1000000000016</cEANTrib><uTrib>SC</uTrib><qTrib>350.0000</qTrib><vUnTrib>1997.0000000000</vUnTrib><indTot>1</indTot></prod><imposto><ICMS><ICMS51><orig>0</orig><CST>51</CST><modBC>3</modBC></ICMS51></ICMS></imposto><vItem>698950.00</vItem></det><total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>698950.00</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>698950.00</vNF></ICMSTot></total><transp><modFrete>0</modFrete><transporta><CPF>08578492714</CPF><xNome>AGNALDO SANTOS DA SILVA</xNome><xMun>IBATIBA</xMun><UF>ES</UF></transporta><vol><qVol>350</qVol><esp>GRANEL</esp><marca>CAFE</marca><pesoL>21000.000</pesoL><pesoB>21000.000</pesoB></vol></transp><pag><detPag><tPag>01</tPag><vPag>698950.00</vPag></detPag></pag><infAdic><infCpl>ICMS DIFERIDO</infCpl></infAdic></infNFe></NFe><protNFe versao="4.00"><infProt><tpAmb>1</tpAmb><verAplic>W-3.4.14</verAplic><chNFe>31260744963370000523550010000006621163793580</chNFe><dhRecbto>2026-07-17T18:15:36-03:00</dhRecbto><nProt>131267734373529</nProt><digVal>Aiv0HwQX7JFDXuMxcZtf6M4DoRk=</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;
}
