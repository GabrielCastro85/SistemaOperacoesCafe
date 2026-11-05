import { describe, expect, it } from "vitest";
import type { BusinessPartnerLegalEntity, FiscalDocument } from "../src/shared/types/domain";
import {
  fiscalDocumentCounterpartyCnpjFromSnapshot,
  resolveFiscalDocumentCounterpartyLegalEntityId
} from "../src/shared/utils/fiscalDocumentLabels";

const baseDocument: FiscalDocument = {
  id: "document-1",
  organizationId: "organization-1",
  ownLegalEntityId: "own-1",
  responsiblePartnerId: "partner-1",
  partnerLegalEntityId: null,
  secondaryResponsiblePartnerId: null,
  secondaryOperationType: null,
  documentType: "MANUAL_INVOICE",
  accessKey: null,
  documentNumber: "49",
  series: "1",
  issueDate: "2026-11-05",
  totalAmountCents: 48_500_000,
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
  direction: "INBOUND",
  fiscalSnapshotJson: JSON.stringify({
    issuer: { legalName: "RODRIGUES ARMAZEM E COMERCIO LTDA", cnpjCpf: "68.369.948/0001-52" },
    recipient: { legalName: "VILLA COFFEE COMERCIO E EXP. LTDA", cnpjCpf: "44.963.370/0002-80" }
  }),
  createdAt: "2026-11-05T10:00:00.000Z",
  updatedAt: "2026-11-05T10:00:00.000Z"
};

const counterpartyEntity: BusinessPartnerLegalEntity = {
  id: "entity-1",
  organizationId: "organization-1",
  businessPartnerId: null,
  legalName: "RODRIGUES ARMAZEM E COMERCIO LTDA",
  tradeName: "RODRIGUES COFFEE ARMAZENS",
  cnpj: "68369948000152",
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
  isPrimary: false,
  isActive: true,
  isDraft: false,
  createdAt: "2026-11-05T10:00:00.000Z",
  updatedAt: "2026-11-05T10:00:00.000Z"
};

describe("fiscal document counterparty resolution", () => {
  it("uses the issuer CNPJ for a purchase where the own company is the recipient", () => {
    expect(fiscalDocumentCounterpartyCnpjFromSnapshot(baseDocument, "44963370000280"))
      .toBe("68369948000152");
  });

  it("finds the fiscal company by XML CNPJ when the note link is empty", () => {
    expect(resolveFiscalDocumentCounterpartyLegalEntityId(baseDocument, "44963370000280", [counterpartyEntity]))
      .toBe("entity-1");
  });

  it("preserves an explicit company link", () => {
    expect(resolveFiscalDocumentCounterpartyLegalEntityId(
      { ...baseDocument, partnerLegalEntityId: "explicit-entity" },
      "44963370000280",
      []
    )).toBe("explicit-entity");
  });
});
