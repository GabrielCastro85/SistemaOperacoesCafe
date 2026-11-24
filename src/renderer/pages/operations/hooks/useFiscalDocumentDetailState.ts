import { useState } from "react";
import type { OperationScope } from "../../../../shared/types/domain";
import { brazilDateValue } from "../operationsFormatters";

// Estado do painel de detalhe de nota. Os valores iniciais sao os mesmos que estavam em OperationsPage.tsx.
export function useFiscalDocumentDetailState() {
  const [detailCompanySearchTerm, setDetailCompanySearchTerm] = useState("");
  const [detailSecondaryPartnerId, setDetailSecondaryPartnerId] = useState("");
  const [financialServiceEnabled, setFinancialServiceEnabled] = useState(false);
  const [freightDaeAmount, setFreightDaeAmount] = useState("");
  const [freightDaeEnabled, setFreightDaeEnabled] = useState(false);
  const [freightDaeReference, setFreightDaeReference] = useState("");
  const [invoiceDaeAmount, setInvoiceDaeAmount] = useState("");
  const [invoiceDaeEnabled, setInvoiceDaeEnabled] = useState(false);
  const [invoiceDaeReference, setInvoiceDaeReference] = useState("");
  const [packagingUnitValue, setPackagingUnitValue] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [replacementPartnerId, setReplacementPartnerId] = useState("");
  const [returnDate, setReturnDate] = useState(() => brazilDateValue());
  const [returnQuantity, setReturnQuantity] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnUnit, setReturnUnit] = useState<"SACKS" | "KG">("SACKS");
  const [sacks, setSacks] = useState("1");
  const [scope, setScope] = useState<OperationScope>("EXTERNAL");
  const [unitPrice, setUnitPrice] = useState("0.0000");
  return {
    detailCompanySearchTerm, setDetailCompanySearchTerm,
    detailSecondaryPartnerId, setDetailSecondaryPartnerId,
    financialServiceEnabled, setFinancialServiceEnabled,
    freightDaeAmount, setFreightDaeAmount,
    freightDaeEnabled, setFreightDaeEnabled,
    freightDaeReference, setFreightDaeReference,
    invoiceDaeAmount, setInvoiceDaeAmount,
    invoiceDaeEnabled, setInvoiceDaeEnabled,
    invoiceDaeReference, setInvoiceDaeReference,
    packagingUnitValue, setPackagingUnitValue,
    productId, setProductId,
    quantity, setQuantity,
    replacementPartnerId, setReplacementPartnerId,
    returnDate, setReturnDate,
    returnQuantity, setReturnQuantity,
    returnReason, setReturnReason,
    returnUnit, setReturnUnit,
    sacks, setSacks,
    scope, setScope,
    unitPrice, setUnitPrice
  };
}
