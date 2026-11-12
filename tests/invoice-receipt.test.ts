import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeDatabase } from "../electron/main/database/database";
import { AppRepository } from "../electron/main/services/appRepository";
import { buildInvoiceReceiptPdf } from "../electron/main/services/invoiceReceipt";
import { ensureAppDirectories, resolveAppDirectories } from "../electron/main/services/paths";
import { receiptCityLine, receiptSegments } from "../src/shared/utils/invoiceReceiptText";

const tempDirs: string[] = [];
afterEach(() => tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const organizationId = "11111111-1111-4111-8111-111111111111";
const ownLegalEntityId = "33333333-3333-4333-8333-333333333331";

async function setup() {
  const userData = mkdtempSync(join(tmpdir(), "operacoes-invoice-receipt-"));
  tempDirs.push(userData);
  const dirs = resolveAppDirectories(userData);
  ensureAppDirectories(dirs);
  const db = initializeDatabase(dirs);
  const repo = new AppRepository(db, dirs);
  repo.saveInstallationProfile({ installationName: "Operacoes", appVariant: "multiempresa", defaultOrganizationId: organizationId, defaultLegalEntityId: ownLegalEntityId, allowOrganizationSwitch: true, allowLegalEntitySwitch: true, completedSetup: true });
  const partner = await repo.createBusinessPartner({ organizationId, displayName: "DLG", notes: null, roles: ["CLIENT"], isActive: true });
  const ownCnpj = (repo.getLegalEntity(ownLegalEntityId).cnpj ?? "").replace(/\D/g, "");
  const createNote = (documentNumber: string, sacks: string, totalCents: number, buyerCnpj = "60551049000164"): string => {
    const product = repo.listProducts({ organizationId })[0];
    const created = repo.createFiscalDocument({ organizationId, ownLegalEntityId, responsiblePartnerId: partner.id, partnerLegalEntityId: null, accessKey: null, documentNumber, series: "1", issueDate: "2026-07-10", totalAmountCents: totalCents, hasPendingIssues: false, pendingNotes: null, notes: null });
    const item = repo.addFiscalDocumentItem({ fiscalDocumentId: created.document.id, productId: product.id, description: "CAFE EM GRAOS CRU ARABICA", quantity: sacks, unit: "SACK", unitPriceDecimal: "1449.00", totalAmountCents: totalCents, sacksQuantity: sacks });
    repo.addOperation({ fiscalDocumentId: created.document.id, fiscalDocumentItemId: item.id, ownLegalEntityId, responsiblePartnerId: partner.id, productId: product.id, operationType: "SALE", operationScope: "EXTERNAL", operationDate: "2026-07-10", quantitySacks: sacks, manualRateValueCents: null, manualOverrideReason: null, notes: null });
    repo.confirmFiscalDocument(created.document.id);
    db.prepare("UPDATE fiscal_documents SET direction = 'OUTBOUND', fiscal_snapshot_json = ? WHERE id = ?").run(JSON.stringify({
      issuer: { legalName: "VILLA COFFEE COMERCIO E EXP. LTDA", cnpjCpf: ownCnpj, stateRegistration: "0053761240090", street: "AVENIDA VITAL PAULINO DA COSTA", number: "466", district: "CETRO", cep: "37968000", city: "MONTE SANTO DE MINAS", state: "MG" },
      recipient: { legalName: buyerCnpj === "60551049000164" ? "DLG COMERCIO DE CAFE LTDA" : "OUTRA EMPRESA LTDA", cnpjCpf: buyerCnpj, stateRegistration: "0051823730060", street: "RODOVIA MG KM 446", number: "SN", district: "MORRO PRETO", cep: "37890000", city: "MUZAMBINHO", state: "MG" }
    }), created.document.id);
    return created.document.id;
  };
  return { repo, db, createNote };
}

describe("recibo de pagamento de notas", () => {
  it("monta o recibo no modelo com os dados das notas e soma notas do mesmo comprador", async () => {
    const { repo, db, createNote } = await setup();
    try {
      const first = createNote("652", "500", 724_500_00);
      const second = createNote("653", "20", 28_980_00);
      const list = repo.listInvoiceReceiptInvoices({ ownLegalEntityId, mode: "SELLER" });
      expect(list.map((item) => item.documentNumber).sort()).toEqual(["652", "653"]);
      expect(repo.listInvoiceReceiptInvoices({ ownLegalEntityId, mode: "BUYER" })).toHaveLength(0);

      const single = repo.getInvoiceReceiptDraft({ ownLegalEntityId, fiscalDocumentIds: [first] });
      expect(single.problems).toEqual([]);
      expect(single.seller.isOwn).toBe(true);
      expect(single.buyer.isOwn).toBe(false);
      const text = receiptSegments({ ...single, date: "2026-07-16" }).map((segment) => segment.text).join("");
      expect(text).toBe("Referente a nota fiscal nº 652, referente a compra de 500 sacas de café em grão cru arábica do vendedor VILLA COFFEE COMERCIO E EXP. LTDA, inscrita sob CNPJ: "
        + `${single.seller.document?.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}, IE: 0053761240090, localizada na AVENIDA VITAL PAULINO DA COSTA, N° 466, CETRO, CEP: 37968-000 – MONTE SANTO DE MINAS – MG, `
        + "declara ter recebido o valor de R$ 724.500,00 (setecentos e vinte e quatro mil e quinhentos reais) da empresa DLG COMERCIO DE CAFE LTDA, inscrita sob CNPJ: 60.551.049/0001-64, IE: 0051823730060, localizada na RODOVIA MG KM 446, SN, MORRO PRETO, CEP: 37890-000 – MUZAMBINHO – MG.");
      expect(receiptCityLine({ ...single, date: "2026-07-16" })).toBe("MONTE SANTO DE MINAS, 16 de julho de 2026.");

      const both = repo.getInvoiceReceiptDraft({ ownLegalEntityId, fiscalDocumentIds: [first, second] });
      expect(both.amountCents).toBe(753_480_00);
      expect(both.sacks).toBe("520");
      expect(receiptSegments({ ...both, date: "2026-07-16" }).slice(0, 4).map((segment) => segment.text).join("")).toBe("Referente às notas fiscais nº 652 e 653");

      const pdf = await buildInvoiceReceiptPdf({ ...single, date: "2026-07-16" }, null);
      expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    } finally { db.close(); }
  });

  it("avisa quando as notas sao de compradores diferentes", async () => {
    const { repo, db, createNote } = await setup();
    try {
      const first = createNote("700", "10", 10_000_00);
      const other = createNote("701", "10", 10_000_00, "11222333000181");
      const draft = repo.getInvoiceReceiptDraft({ ownLegalEntityId, fiscalDocumentIds: [first, other] });
      expect(draft.problems.some((problem) => problem.includes("outro comprador"))).toBe(true);
    } finally { db.close(); }
  });
});
