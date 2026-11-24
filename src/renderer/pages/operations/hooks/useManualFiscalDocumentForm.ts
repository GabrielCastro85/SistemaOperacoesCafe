import { useState } from "react";
import { brazilDateValue } from "../operationsFormatters";

// Estado do formulario de lancamento manual de nota. Os valores iniciais e os
// nomes sao os mesmos que estavam em OperationsPage.tsx.
export function useManualFiscalDocumentForm() {
  const [billingObservations, setBillingObservations] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [number, setNumber] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [total, setTotal] = useState("0,00");
  const [issueDate, setIssueDate] = useState(() => brazilDateValue());
  const [operationType, setOperationType] = useState<"PURCHASE" | "SALE">("SALE");
  const [manualIssuerSearchTerm, setManualIssuerSearchTerm] = useState("");
  const [manualIssuerPartnerLegalEntityId, setManualIssuerPartnerLegalEntityId] = useState<string | null>(null);
  const [manualCounterpartyLegalEntityId, setManualCounterpartyLegalEntityId] = useState("");
  const [manualSecondaryPartnerId, setManualSecondaryPartnerId] = useState("");
  return {
    billingObservations, setBillingObservations,
    partnerId, setPartnerId,
    number, setNumber,
    contractNumber, setContractNumber,
    accessKey, setAccessKey,
    total, setTotal,
    issueDate, setIssueDate,
    operationType, setOperationType,
    manualIssuerSearchTerm, setManualIssuerSearchTerm,
    manualIssuerPartnerLegalEntityId, setManualIssuerPartnerLegalEntityId,
    manualCounterpartyLegalEntityId, setManualCounterpartyLegalEntityId,
    manualSecondaryPartnerId, setManualSecondaryPartnerId
  };
}
