import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Extrai isCandidateFileName do coletor (main.cjs depende do Electron e nao
// pode ser importado direto nos testes).
function loadIsCandidateFileName(): (name: string) => boolean {
  const source = readFileSync("collector/main.cjs", "utf8");
  const start = source.indexOf("function isCandidateFileName(");
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}" && (depth -= 1) === 0) {
      return new Function(`${source.slice(start, index + 1)}; return isCandidateFileName;`)() as (name: string) => boolean;
    }
  }
  throw new Error("isCandidateFileName nao encontrada no coletor");
}

describe("arquivos lidos pelo coletor", () => {
  const isCandidate = loadIsCandidateFileName();

  it("le a NF-e e o evento pelo minuto (-eve.xml)", () => {
    expect(isCandidate("32261144963370000280550010000009631451011905-nfe.xml")).toBe(true);
    expect(isCandidate("1126261819-eve.xml")).toBe(true);
  });

  // NF 963 Villa ES: cancelada no mesmo minuto que a 964, o -eve.xml dela foi
  // sobrescrito. O procEventoNFe da pasta Evento\...\Cancelamento tem nome unico.
  it("le o cancelamento com nome unico (-procEventoNFe.xml)", () => {
    expect(isCandidate("1101113226114496337000028055001000000963145101190501-procEventoNFe.xml")).toBe(true);
  });

  it("ignora pedido de evento, consulta de situacao e lotes", () => {
    expect(isCandidate("1126261819-ped-eve.xml")).toBe(false);
    expect(isCandidate("32261144963370000280550010000009631451011905-sit.xml")).toBe(false);
    expect(isCandidate("32261144963370000280550010000009631451011905-ped-sit.xml")).toBe(false);
    expect(isCandidate("1876-pro-lot.xml")).toBe(false);
  });
});
