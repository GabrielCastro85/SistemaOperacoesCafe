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
const ownCnpj = "11222333000181";
const partnerCnpj = "22333444000110";

function setup(): { repo: AppRepository; db: ReturnType<typeof initializeDatabase>; partnerId: string; productId: string; dir: string } {
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
  repo.updateLegalEntity(ownLegalEntityId, {
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
  const partner = repo.createBusinessPartner({ organizationId: villaId, displayName: "Cliente XML", notes: null, roles: ["CLIENT"], isActive: true });
  const product = repo.listProducts({ organizationId: villaId })[0];
  repo.createServiceRateRule({
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

  it("imports a valid XML into fiscal documents, items and operations", () => {
    const { repo, db, partnerId, productId, dir } = setup();
    const key = makeAccessKey();
    const filePath = join(dir, "nfe.xml");
    writeFileSync(filePath, nfeXml(key), "utf8");
    const inspection = inspectXmlFile(filePath, "11111111-1111-4111-8111-111111111111");
    const job = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: { clientPartnerId: partnerId, operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true } });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, filePath);
    const result = repo.executeXmlImportJob(job.id);
    expect(result.files[0].errorMessage).toBeNull();
    expect(result.job.importedNotes).toBe(1);
    expect(result.job.createdOperations).toBe(1);
    const imported = result.files[0];
    const detail = repo.getFiscalDocument(imported.fiscalDocumentId as string);
    expect(detail.document.source).toBe("XML");
    expect(detail.document.direction).toBe("OUTBOUND");
    expect(detail.items).toHaveLength(1);
    expect(detail.operations[0].serviceAmountCents).toBe(5250);
    db.close();
  });

  it("merges XML into an existing manual document and imports cancellation event", () => {
    const { repo, db, partnerId, productId, dir } = setup();
    const key = makeAccessKey();
    const existing = repo.createFiscalDocument({ organizationId: villaId, ownLegalEntityId, responsiblePartnerId: partnerId, partnerLegalEntityId: null, accessKey: key, documentNumber: "9001", series: "1", issueDate: "2026-07-16", totalAmountCents: 100000, hasPendingIssues: false, pendingNotes: null, notes: null });
    const xmlPath = join(dir, "merge.xml");
    writeFileSync(xmlPath, nfeXml(key), "utf8");
    const inspection = inspectXmlFile(xmlPath, "11111111-1111-4111-8111-111111111112");
    const job = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: { clientPartnerId: partnerId, operationScope: "EXTERNAL", operationType: "SALE", productId, createOperations: true } });
    const file = repo.addXmlImportFile({ importJobId: job.id, originalFileName: inspection.originalFileName, fileHash: inspection.fileHash, fileSize: inspection.fileSize, xmlType: inspection.xmlType, accessKey: inspection.accessKey, status: inspection.status, errorCode: null, errorMessage: null, warningCodes: inspection.warnings, extractedData: inspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(file.id, xmlPath);
    repo.executeXmlImportJob(job.id);
    expect(repo.getFiscalDocument(existing.document.id).document.mergedFromSource).toBe("MANUAL");
    expect(repo.getFiscalDocumentMergeHistory(existing.document.id)).toHaveLength(1);

    const eventPath = join(dir, "cancel.xml");
    writeFileSync(eventPath, cancelXml(key), "utf8");
    const eventInspection = inspectXmlFile(eventPath, "11111111-1111-4111-8111-111111111113");
    const eventJob = repo.createXmlImportDraft({ organizationId: villaId, sourceType: "FILE", selectedFolder: null, includeSubfolders: false, settings: {} });
    const eventFile = repo.addXmlImportFile({ importJobId: eventJob.id, originalFileName: eventInspection.originalFileName, fileHash: eventInspection.fileHash, fileSize: eventInspection.fileSize, xmlType: eventInspection.xmlType, accessKey: eventInspection.accessKey, status: eventInspection.status, errorCode: null, errorMessage: null, warningCodes: eventInspection.warnings, extractedData: eventInspection.extractedData, resolutionData: null });
    repo.setXmlImportFileStoredPath(eventFile.id, eventPath);
    repo.executeXmlImportJob(eventJob.id);
    expect(repo.getFiscalDocument(existing.document.id).document.status).toBe("CANCELED");
    expect(repo.listFiscalDocumentEvents(villaId)[0].eventType).toBe("CANCELLATION");
    db.close();
  });
});

function makeAccessKey(): string {
  const body = "3126071122233300018155001000009001100009001";
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
