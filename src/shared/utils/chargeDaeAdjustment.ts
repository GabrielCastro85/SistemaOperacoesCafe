// Le os ajustes de DAE gravados na cobranca (um por nota) e devolve os dados
// organizados, para o PDF e a planilha nao repetirem a mesma frase em cada linha.
//
// Formatos gravados:
//  - "DAE de frete referente a NF 1496 - DAE DAE FRETE 1496"
//    motivo "Valor de DAE de frete registrado na nota fiscal 1496."
//  - "DAE referente a NF 1496 - DAE 123" (DAE da nota)
//  - "DAE de frete e DAE da nota referentes a NF 1496"
//    motivo "DAE registrado na nota fiscal 1496: frete (DAE 1) R$ 160,00 + nota fiscal (DAE 2) R$ 50,00."

export interface ChargeDaeAdjustmentInfo {
  documentNumber: string;
  kind: "FREIGHT" | "INVOICE" | "BOTH";
  label: string; // "DAE de frete", "DAE da nota", "DAE de frete + nota"
  references: string[]; // referencias informadas na nota, sem o "DAE " repetido
}

const cleanReference = (value: string) => value.trim().replace(/^(?:DAE\s+)+/i, "").trim();

export function parseChargeDaeAdjustment(adjustment: { description: string; reason?: string | null; adjustmentType?: string; effect?: string }): ChargeDaeAdjustmentInfo | null {
  if (adjustment.adjustmentType && adjustment.adjustmentType !== "SURCHARGE") return null;
  if (adjustment.effect && adjustment.effect !== "INCREASE_RECEIVABLE") return null;
  const description = adjustment.description.trim();
  const both = /^DAE de frete e DAE da nota referentes a NF\s+(\S+)/i.exec(description);
  const freight = /^DAE de frete referente a NF\s+(\S+?)(?:\s+-\s+DAE\s+(.+))?$/i.exec(description);
  const invoice = /^DAE referente a NF\s+(\S+?)(?:\s+-\s+DAE\s+(.+))?$/i.exec(description);
  if (both) {
    const references = [...(adjustment.reason ?? "").matchAll(/\(DAE\s+([^)]+)\)/gi)].map((match) => cleanReference(match[1])).filter(Boolean);
    return { documentNumber: both[1], kind: "BOTH", label: "DAE de frete + nota", references };
  }
  if (freight) return { documentNumber: freight[1], kind: "FREIGHT", label: "DAE de frete", references: freight[2] ? [cleanReference(freight[2])].filter(Boolean) : [] };
  if (invoice) return { documentNumber: invoice[1], kind: "INVOICE", label: "DAE da nota", references: invoice[2] ? [cleanReference(invoice[2])].filter(Boolean) : [] };
  return null;
}

// O motivo gravado so' repete a descricao; observacao de verdade e' o que o
// usuario escreveu diferente disso.
export function isGeneratedDaeReason(reason: string | null | undefined): boolean {
  const text = (reason ?? "").trim();
  return !text || /^Valor de DAE de frete registrado na nota fiscal\s+\S+\.?$/i.test(text) || /^DAE registrado na nota fiscal\s+\S+:/i.test(text);
}

const TYPE_LABELS: Record<string, string> = {
  ADVANCE: "Adiantamento", CREDIT: "Crédito", DISCOUNT: "Desconto", SURCHARGE: "Acréscimo", REIMBURSEMENT: "Reembolso",
  PREVIOUS_BALANCE: "Saldo anterior", MANUAL_ADJUSTMENT: "Ajuste manual", OTHER: "Outro"
};

export function chargeAdjustmentTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function chargeAdjustmentEffectLabel(effect: string): string {
  return effect === "INCREASE_RECEIVABLE" ? "Soma" : effect === "REDUCE_RECEIVABLE" ? "Desconta" : effect;
}
