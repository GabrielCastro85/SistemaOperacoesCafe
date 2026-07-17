import type { BusinessPartner } from "../../../shared/types/domain";

export interface PartnerPageFilters {
  search: string;
  status: "active" | "inactive" | "all";
}

export interface PartnerSummaryCard {
  label: string;
  value: string | number;
}

export type PartnerRow = BusinessPartner;
