import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseSefazDistributionSoap } from "../electron/main/services/sefazNfeService";

function soapWithDocuments(documents: Array<{ nsu: string; schema: string; xml: string }>): string {
  const docs = documents.map((document) => `<docZip NSU="${document.nsu}" schema="${document.schema}">${gzipSync(Buffer.from(document.xml, "utf8")).toString("base64")}</docZip>`).join("");
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDistDFeInteresseResponse><nfeDistDFeInteresseResult><retDistDFeInt versao="1.01"><tpAmb>1</tpAmb><cStat>138</cStat><xMotivo>Documento(s) localizado(s)</xMotivo><dhResp>2026-10-29T16:00:00-03:00</dhResp><ultNSU>6810</ultNSU><maxNSU>6810</maxNSU><loteDistDFeInt>${docs}</loteDistDFeInt></retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></soap:Body></soap:Envelope>`;
}

describe("SEFAZ NF-e distribution parser", () => {
  it("reads a received NF-e summary without treating it as a full XML", () => {
    const accessKey = "31261004164419000130550010000021641532100313";
    const summary = `<resNFe versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><chNFe>${accessKey}</chNFe><CNPJ>04164419000130</CNPJ><xNome>SANTA FE ARMAZENS GERAIS EIRELI</xNome><IE>123</IE><dhEmi>2026-10-29T08:00:00-03:00</dhEmi><tpNF>1</tpNF><vNF>625000.00</vNF><digVal>abc</digVal><dhRecbto>2026-10-29T08:01:00-03:00</dhRecbto><nProt>1</nProt><cSitNFe>1</cSitNFe></resNFe>`;
    const result = parseSefazDistributionSoap(soapWithDocuments([{ nsu: "6810", schema: "resNFe_v1.01.xsd", xml: summary }]), {
      fallbackLastNsu: "0",
      certificateSubject: "CN=VILLA:44963370000523",
      certificateNotAfter: "2026-12-30T14:48:25.000Z"
    });
    expect(result.statusCode).toBe("138");
    expect(result.lastNsu).toBe("000000000006810");
    expect(result.documents[0]?.summary).toMatchObject({ accessKey, issuerCnpj: "04164419000130", issuerName: "SANTA FE ARMAZENS GERAIS EIRELI", totalAmount: "625000.00", hasFullXml: false });
    expect(result.documents[0]?.isNfeXml).toBe(false);
  });

  it("recognizes a complete nfeProc returned after acknowledgement", () => {
    const accessKey = "31261004164419000130550010000021641532100313";
    const nfe = `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${accessKey}"><ide><dhEmi>2026-10-29T08:00:00-03:00</dhEmi></ide><emit><CNPJ>04164419000130</CNPJ><xNome>SANTA FE ARMAZENS GERAIS EIRELI</xNome></emit><dest><CNPJ>44963370000523</CNPJ></dest><total><ICMSTot><vNF>625000.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;
    const result = parseSefazDistributionSoap(soapWithDocuments([{ nsu: "6810", schema: "procNFe_v4.00.xsd", xml: nfe }]), {
      fallbackLastNsu: "0",
      certificateSubject: "CN=VILLA:44963370000523",
      certificateNotAfter: "2026-12-30T14:48:25.000Z"
    });
    expect(result.documents[0]?.isNfeXml).toBe(true);
    expect(result.documents[0]?.summary).toMatchObject({ accessKey, issuerName: "SANTA FE ARMAZENS GERAIS EIRELI", hasFullXml: true });
  });
});
