import type { CnpjLookupResult } from "../../../src/shared/types/domain.js";
import { onlyDigits } from "../../../src/shared/utils/format.js";

interface BrasilApiCnpjResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  email?: string | null;
  ddd_telefone_1?: string | null;
  ddd_telefone_2?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  message?: string;
}

interface ReceitaWsCnpjResponse {
  status?: string;
  message?: string;
  cnpj?: string;
  nome?: string;
  fantasia?: string;
  situacao?: string;
  email?: string | null;
  telefone?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export async function lookupCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const digits = onlyDigits(cnpj) ?? "";
  if (digits.length !== 14) {
    throw new Error("Informe um CNPJ com 14 digitos para buscar.");
  }

  const errors: string[] = [];
  for (const provider of [lookupBrasilApi, lookupReceitaWs]) {
    try {
      return await provider(digits);
    } catch (error) {
      errors.push(errorMessage(error));
    }
  }

  throw new Error(`CNPJ nao encontrado nas consultas publicas gratuitas. Confira o numero ou preencha manualmente. Detalhes: ${errors.join(" | ")}`);
}

async function lookupBrasilApi(digits: string): Promise<CnpjLookupResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({})) as BrasilApiCnpjResponse;
    if (!response.ok) {
      throw new Error(`BrasilAPI: ${data.message || "CNPJ nao encontrado."}`);
    }
    if (!data.razao_social) {
      throw new Error("BrasilAPI: consulta retornou sem razao social.");
    }

    return {
      cnpj: onlyDigits(data.cnpj ?? digits) ?? digits,
      legalName: data.razao_social.trim(),
      tradeName: cleanText(data.nome_fantasia),
      registrationStatus: cleanText(data.descricao_situacao_cadastral),
      email: cleanText(data.email),
      phone: cleanText(data.ddd_telefone_1) ?? cleanText(data.ddd_telefone_2),
      addressLine: cleanText(data.logradouro),
      addressNumber: cleanText(data.numero),
      addressComplement: cleanText(data.complemento),
      district: cleanText(data.bairro),
      city: cleanText(data.municipio),
      state: cleanText(data.uf),
      postalCode: onlyDigits(data.cep ?? "") || null,
      source: "BRASIL_API"
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("BrasilAPI: tempo esgotado.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupReceitaWs(digits: string): Promise<CnpjLookupResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${digits}`, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({})) as ReceitaWsCnpjResponse;
    if (!response.ok || data.status === "ERROR") {
      throw new Error(`ReceitaWS: ${data.message || "CNPJ nao encontrado."}`);
    }
    if (!data.nome) {
      throw new Error("ReceitaWS: consulta retornou sem razao social.");
    }

    return {
      cnpj: onlyDigits(data.cnpj ?? digits) ?? digits,
      legalName: data.nome.trim(),
      tradeName: cleanText(data.fantasia),
      registrationStatus: cleanText(data.situacao),
      email: cleanText(data.email),
      phone: normalizePhone(data.telefone),
      addressLine: cleanText(data.logradouro),
      addressNumber: cleanText(data.numero),
      addressComplement: cleanText(data.complemento),
      district: cleanText(data.bairro),
      city: cleanText(data.municipio),
      state: cleanText(data.uf),
      postalCode: onlyDigits(data.cep ?? "") || null,
      source: "RECEITA_WS"
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("ReceitaWS: tempo esgotado.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function normalizePhone(value: string | null | undefined): string | null {
  const text = cleanText(value);
  if (!text) return null;

  const candidates = text.split(/[;/|,]/).map((candidate) => onlyDigits(candidate)).filter(Boolean) as string[];
  const firstValid = candidates.find((candidate) => candidate.length >= 8 && candidate.length <= 13);
  if (firstValid) return firstValid;

  const digits = onlyDigits(text);
  return digits && digits.length >= 8 ? digits.slice(0, 13) : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "falha desconhecida";
}
