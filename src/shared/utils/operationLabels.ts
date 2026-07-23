import type { OperationScope } from "../types/domain.js";

export const OPERATION_SCOPE_LABELS: Record<OperationScope, string> = {
  INTERNAL: "Mesma UF",
  EXTERNAL: "Outra UF",
  ALL: "Todas"
};

export const OPERATION_SCOPE_OPTIONS: Array<[OperationScope, string]> = [
  ["INTERNAL", "Mesma UF"],
  ["EXTERNAL", "Outra UF"]
];

export const SERVICE_RATE_SCOPE_OPTIONS: Array<[OperationScope, string]> = [
  ["INTERNAL", "Mesma UF"],
  ["EXTERNAL", "Outra UF"],
  ["ALL", "Todas"]
];

export function formatOperationScope(scope: OperationScope | null | undefined): string {
  return scope ? OPERATION_SCOPE_LABELS[scope] ?? scope : "-";
}
