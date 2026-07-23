import ExcelJS from "exceljs";
import { existsSync, statSync } from "node:fs";
import { extname, basename } from "node:path";
import type { SheetPreview, WorkbookInspection } from "../../../src/shared/types/domain.js";

const maxSpreadsheetBytes = 25 * 1024 * 1024;

const aliases: Record<string, string[]> = {
  date: ["DATA", "DT", "DATA NF", "EMISSAO", "DATA EMISSAO"],
  issuerName: ["EMPRESA", "EMITENTE", "FORNECEDOR", "VENDEDOR", "RAZAO SOCIAL"],
  sacks: ["SACAS", "QTD SACAS", "QUANTIDADE", "QUANT.", "QTD"],
  destinationName: ["DESTINO", "DESTINATARIO", "COMPRADOR", "LOCAL DE DESCARGA"],
  documentNumber: ["NF", "NOTA", "NOTA FISCAL", "N NF", "NUMERO NF"],
  clientName: ["CLIENTE", "CORRETOR", "RESPONSAVEL"],
  operationScope: ["UF DA VENDA", "INTERNO/EXTERNO", "INTERNA/EXTERNA", "TIPO", "OPERACAO", "CLASSIFICACAO"]
};

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[º°ª]/g, "")
    .replace(/[^\p{Letter}\p{Number}/ ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function suggestColumnMapping(headers: string[]): Record<string, string> {
  const normalized = headers.map((header) => [header, normalizeHeader(header)] as const);
  const mapping: Record<string, string> = {};
  Object.entries(aliases).forEach(([field, options]) => {
    const found = normalized.find(([, header]) => options.includes(header));
    if (found) mapping[field] = found[0];
  });
  return mapping;
}

export function validateSpreadsheetPath(filePath: string): void {
  if (extname(filePath).toLowerCase() !== ".xlsx") throw new Error("Apenas arquivos .xlsx sao suportados nesta etapa.");
  if (!existsSync(filePath)) throw new Error("Arquivo nao encontrado.");
  const stats = statSync(filePath);
  if (!stats.isFile()) throw new Error("Arquivo invalido.");
  if (stats.size > maxSpreadsheetBytes) throw new Error("Planilha maior que 25 MB.");
}

async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  validateSpreadsheetPath(filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  if (workbook.worksheets.length === 0) throw new Error("Planilha sem abas.");
  return workbook;
}

export async function inspectWorkbook(filePath: string, token: string): Promise<WorkbookInspection> {
  const workbook = await loadWorkbook(filePath);
  const stats = statSync(filePath);
  return {
    token,
    fileName: basename(filePath),
    sizeBytes: stats.size,
    sheets: workbook.worksheets.map((sheet) => ({ name: sheet.name, rowCount: sheet.actualRowCount }))
  };
}

export async function previewSheet(filePath: string, sheetName: string, headerRow: number, limit = 10): Promise<SheetPreview> {
  const workbook = await loadWorkbook(filePath);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error("Aba nao encontrada.");
  const header = sheet.getRow(headerRow);
  const headerValues: ExcelJS.CellValue[] = Array.isArray(header.values) ? (header.values as ExcelJS.CellValue[]) : [];
  const headers = headerValues
    .slice(1)
    .map((value) => cellToText(value))
    .filter((value) => value.length > 0);
  if (headers.length === 0) throw new Error("Linha de cabecalho vazia.");
  const rows: Array<Record<string, string>> = [];
  for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount && rows.length < limit; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const data: Record<string, string> = {};
    headers.forEach((name, index) => {
      data[name] = cellToText(row.getCell(index + 1).value);
    });
    if (Object.values(data).some((value) => value.trim() !== "")) rows.push(data);
  }
  return { headers, rows, suggestedMapping: suggestColumnMapping(headers) };
}

export async function readSheetRows(filePath: string, sheetName: string, headerRow: number, maxRows = 5000): Promise<Array<{ rowNumber: number; data: Record<string, string> }>> {
  const workbook = await loadWorkbook(filePath);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error("Aba nao encontrada.");
  if (sheet.actualRowCount > maxRows + headerRow) throw new Error("Planilha excede o limite de linhas desta etapa.");
  const rawHeaderValues = sheet.getRow(headerRow).values;
  const headerValues: ExcelJS.CellValue[] = Array.isArray(rawHeaderValues) ? (rawHeaderValues as ExcelJS.CellValue[]) : [];
  const headers = headerValues.slice(1).map((value) => cellToText(value as ExcelJS.CellValue));
  const rows: Array<{ rowNumber: number; data: Record<string, string> }> = [];
  for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const data: Record<string, string> = {};
    headers.forEach((name, index) => {
      if (name) data[name] = cellToText(row.getCell(index + 1).value);
    });
    const values = Object.values(data).map((value) => value.trim().toUpperCase());
    const isEmpty = values.every((value) => value === "");
    const isTotal = values.some((value) => ["TOTAL", "TOTAL GERAL", "SOMA", "RESUMO"].includes(value));
    if (!isEmpty && !isTotal) rows.push({ rowNumber: rowIndex, data });
  }
  return rows;
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellToText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
  }
  return String(value).trim();
}
