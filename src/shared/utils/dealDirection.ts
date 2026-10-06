import type { FiscalDocumentDirection } from "../types/domain.js";

export type ConfirmationDealDirection = "SALE" | "PURCHASE";
export type ConfirmationDealDirectionChoice = "AUTO" | ConfirmationDealDirection;

export function inferConfirmationDealDirection(
  directions: FiscalDocumentDirection[]
): ConfirmationDealDirection | null {
  if (!directions.length || directions.some((direction) => direction === "UNKNOWN")) return null;
  const uniqueDirections = new Set(directions);
  if (uniqueDirections.size !== 1) return null;
  return directions[0] === "INBOUND" ? "PURCHASE" : "SALE";
}
