import type { ProductUnit } from "../types/domain.js";

const unitLabels: Record<ProductUnit, string> = {
  SACK: "Saca",
  KG: "Kg",
  TON: "Tonelada",
  UNIT: "Unidade"
};

export function formatProductUnit(unit: ProductUnit): string {
  return unitLabels[unit] ?? unit;
}
