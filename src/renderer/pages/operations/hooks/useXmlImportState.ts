import { useState } from "react";
import type { OperationScope, XmlFileInspection, XmlImportFile, XmlImportJob } from "../../../../shared/types/domain";

// Estado da importacao de XML (fila, lote, resolucoes, DAEs e contratos por arquivo).
// Os valores iniciais e os nomes sao os mesmos que estavam em OperationsPage.tsx.
export function useXmlImportState() {
  const [xmlSelections, setXmlSelections] = useState<Array<{ token: string; fileName: string; sizeBytes: number }>>([]);
  const [xmlQueue, setXmlQueue] = useState<XmlFileInspection[]>([]);
  const [xmlJob, setXmlJob] = useState<{ job: XmlImportJob; files: XmlImportFile[] } | null>(null);
  const [xmlHistory, setXmlHistory] = useState<XmlImportJob[]>([]);
  const [xmlHistoryLimit, setXmlHistoryLimit] = useState(15);
  const [includeXmlSubfolders, setIncludeXmlSubfolders] = useState(false);
  const [xmlSelectionSource, setXmlSelectionSource] = useState<"FILE" | "MULTIPLE_FILES" | "FOLDER" | "DRAG_DROP">("FILE");
  const [xmlResolutionSelections, setXmlResolutionSelections] = useState<Record<string, string>>({});
  const [xmlSecondaryResolutionSelections, setXmlSecondaryResolutionSelections] = useState<Record<string, string>>({});
  const [xmlScopeOverrides, setXmlScopeOverrides] = useState<Record<string, OperationScope>>({});
  const [xmlOperationTypeOverrides, setXmlOperationTypeOverrides] = useState<Record<string, "PURCHASE" | "SALE">>({});
  const [xmlManualRates, setXmlManualRates] = useState<Record<string, string>>({});
  const [xmlManualReasons, setXmlManualReasons] = useState<Record<string, string>>({});
  const [xmlPartnerOverrides, setXmlPartnerOverrides] = useState<Record<string, string>>({});
  const [xmlIgnoredSelections, setXmlIgnoredSelections] = useState<Record<string, boolean>>({});
  const [xmlDeferredSelections, setXmlDeferredSelections] = useState<Record<string, boolean>>({});
  const [xmlContractNumbers, setXmlContractNumbers] = useState<Record<string, string>>({});
  const [xmlBillingObservations, setXmlBillingObservations] = useState<Record<string, string>>({});
  const [xmlFreightDaeEnabled, setXmlFreightDaeEnabled] = useState<Record<string, boolean>>({});
  const [xmlFreightDaeReferences, setXmlFreightDaeReferences] = useState<Record<string, string>>({});
  const [xmlFreightDaeAmounts, setXmlFreightDaeAmounts] = useState<Record<string, string>>({});
  const [xmlFinancialServiceEnabled, setXmlFinancialServiceEnabled] = useState<Record<string, boolean>>({});
  const [xmlInvoiceDaeEnabled, setXmlInvoiceDaeEnabled] = useState<Record<string, boolean>>({});
  const [xmlInvoiceDaeReferences, setXmlInvoiceDaeReferences] = useState<Record<string, string>>({});
  const [xmlInvoiceDaeAmounts, setXmlInvoiceDaeAmounts] = useState<Record<string, string>>({});
  const [selectedXmlToken, setSelectedXmlToken] = useState<string | null>(null);
  const [xmlDetailTab, setXmlDetailTab] = useState<"nota" | "cliente">("nota");
  return {
    xmlSelections, setXmlSelections,
    xmlQueue, setXmlQueue,
    xmlJob, setXmlJob,
    xmlHistory, setXmlHistory,
    xmlHistoryLimit, setXmlHistoryLimit,
    includeXmlSubfolders, setIncludeXmlSubfolders,
    xmlSelectionSource, setXmlSelectionSource,
    xmlResolutionSelections, setXmlResolutionSelections,
    xmlSecondaryResolutionSelections, setXmlSecondaryResolutionSelections,
    xmlScopeOverrides, setXmlScopeOverrides,
    xmlOperationTypeOverrides, setXmlOperationTypeOverrides,
    xmlManualRates, setXmlManualRates,
    xmlManualReasons, setXmlManualReasons,
    xmlPartnerOverrides, setXmlPartnerOverrides,
    xmlIgnoredSelections, setXmlIgnoredSelections,
    xmlDeferredSelections, setXmlDeferredSelections,
    xmlContractNumbers, setXmlContractNumbers,
    xmlBillingObservations, setXmlBillingObservations,
    xmlFreightDaeEnabled, setXmlFreightDaeEnabled,
    xmlFreightDaeReferences, setXmlFreightDaeReferences,
    xmlFreightDaeAmounts, setXmlFreightDaeAmounts,
    xmlFinancialServiceEnabled, setXmlFinancialServiceEnabled,
    xmlInvoiceDaeEnabled, setXmlInvoiceDaeEnabled,
    xmlInvoiceDaeReferences, setXmlInvoiceDaeReferences,
    xmlInvoiceDaeAmounts, setXmlInvoiceDaeAmounts,
    selectedXmlToken, setSelectedXmlToken,
    xmlDetailTab, setXmlDetailTab
  };
}
