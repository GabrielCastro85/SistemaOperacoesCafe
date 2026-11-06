import { useEffect, useState } from "react";
import { apiJson, queryString } from "./api";
import { Alert } from "./renderer/design-system/components/Alert";
import { Badge } from "./renderer/design-system/components/Badge";
import { Button } from "./renderer/design-system/components/Button";
import { Card } from "./renderer/design-system/components/Card";

// Importacao de notas por planilha (.xlsx). As regras ficam no servidor
// (server/src/spreadsheetManagement.ts), que repete o importador do aplicativo.

interface Inspection {
  fileName: string; selectedSheetName: string; sheets: Array<{ name: string; rowCount: number }>;
  headers: string[]; totalRows: number; suggestedMapping: Record<string, string>; limits: { maxFileBytes: number; maxRows: number };
}
interface ValidatedRow {
  rowNumber: number; status: "VALID" | "WARNING" | "ERROR" | "DUPLICATE" | "IMPORTED";
  errorMessage: string | null; warningCodes: string[]; data: Record<string, string>; raw: Record<string, string>;
}
interface Validation { totalRows: number; validRows: number; warningRows: number; errorRows: number; duplicateRows: number; rows: ValidatedRow[] }

const FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: "date", label: "Data", required: true }, { key: "documentNumber", label: "Número da NF", required: true },
  { key: "sacks", label: "Sacas", required: true }, { key: "clientName", label: "Cliente (por linha)" },
  { key: "operationScope", label: "Interno x externo" }, { key: "series", label: "Série" },
  { key: "contractNumber", label: "Contrato" }, { key: "totalCommercialAmount", label: "Valor total" },
  { key: "commercialUnitPrice", label: "Valor unitário" }, { key: "notes", label: "Observações" },
  { key: "issuerName", label: "Emitente" }, { key: "destinationName", label: "Destino" }
];
const WARNING_LABELS: Record<string, string> = { CLIENT_FROM_DEFAULT: "cliente padrão", SCOPE_FROM_DEFAULT: "escopo padrão" };
const STATUS: Record<ValidatedRow["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  VALID: { label: "Ok", tone: "success" }, WARNING: { label: "Aviso", tone: "warning" }, ERROR: { label: "Erro", tone: "danger" },
  DUPLICATE: { label: "Já cadastrada", tone: "neutral" }, IMPORTED: { label: "Importada", tone: "success" }
};
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export function SpreadsheetImportCard({ organizationId, legalEntityId, onClose, onImported }: {
  organizationId: string; legalEntityId?: string; onClose: () => void; onImported: (message: string) => void;
}): JSX.Element {
  const [fileName, setFileName] = useState("");
  const [contentBase64, setContentBase64] = useState("");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [entities, setEntities] = useState<Array<{ id: string; organizationId: string; tradeName: string }>>([]);
  const [partners, setPartners] = useState<Array<{ id: string; display_name: string; roles: Array<{ role: string }> }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [ownLegalEntityId, setOwnLegalEntityId] = useState(legalEntityId ?? "");
  const [operationType, setOperationType] = useState<"SALE" | "PURCHASE">("SALE");
  const [responsiblePartnerId, setResponsiblePartnerId] = useState("");
  const [productId, setProductId] = useState("");
  const [operationScope, setOperationScope] = useState<"INTERNAL" | "EXTERNAL">("EXTERNAL");
  const [defaultDate, setDefaultDate] = useState(new Date().toISOString().slice(0, 10));
  const [validation, setValidation] = useState<Validation | null>(null);
  const [importWarnings, setImportWarnings] = useState(false);
  const [busy, setBusy] = useState<"inspect" | "validate" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      apiJson<{ legalEntities: Array<{ id: string; organizationId: string; tradeName: string }> }>("/v1/viewer/context"),
      apiJson<Array<{ id: string; display_name: string; roles: Array<{ role: string }> }>>(`/v1/viewer/partners?${queryString({ organizationId, legalEntityId })}`),
      apiJson<Array<{ id: string; name: string }>>(`/v1/viewer/products?${queryString({ organizationId, legalEntityId })}`)
    ]).then(([context, partnerRows, productRows]) => {
      setEntities(context.legalEntities.filter((entity) => entity.organizationId === organizationId));
      setPartners(partnerRows); setProducts(productRows);
      if (productRows.length === 1) setProductId(productRows[0].id);
    }).catch((value) => setError(value instanceof Error ? value.message : "Falha ao carregar os cadastros."));
  }, [organizationId, legalEntityId]);

  const file = { organizationId, legalEntityId: ownLegalEntityId, fileName, contentBase64, ...(sheetName ? { sheetName } : {}), headerRow };
  const defaults = { responsiblePartnerId, productId, operationType, operationScope, defaultDate };
  const responsibleOptions = partners.filter((partner) => partner.roles.some((role) => role.role === (operationType === "SALE" ? "CLIENT" : "SUPPLIER")));
  const ready = Boolean(inspection && ownLegalEntityId && responsiblePartnerId && productId && defaultDate)
    && FIELDS.filter((field) => field.required).every((field) => mapping[field.key]);

  const inspect = async (content: string, name: string, sheet?: string, header = headerRow): Promise<void> => {
    if (!ownLegalEntityId) { setError("Escolha a empresa própria antes do arquivo."); return; }
    setBusy("inspect"); setError(null); setValidation(null);
    try {
      const result = await apiJson<Inspection>("/v1/manage/invoices/spreadsheet/inspect", json({
        organizationId, legalEntityId: ownLegalEntityId, fileName: name, contentBase64: content, ...(sheet ? { sheetName: sheet } : {}), headerRow: header
      }));
      setInspection(result); setSheetName(result.selectedSheetName); setMapping(result.suggestedMapping);
    } catch (value) {
      setInspection(null); setError(value instanceof Error ? value.message : "Não foi possível ler a planilha.");
    } finally { setBusy(null); }
  };

  const validate = async (): Promise<void> => {
    setBusy("validate"); setError(null);
    try { setValidation(await apiJson<Validation>("/v1/manage/invoices/spreadsheet/validate", json({ ...file, mapping, defaults }))); }
    catch (value) { setError(value instanceof Error ? value.message : "Não foi possível validar a planilha."); }
    finally { setBusy(null); }
  };

  const importRows = async (): Promise<void> => {
    setBusy("import"); setError(null);
    try {
      const result = await apiJson<{ importedRows: number; errorRows: number; duplicateRows: number }>("/v1/manage/invoices/spreadsheet/import", json({ ...file, mapping, defaults, importWarnings }));
      onImported(`${result.importedRows} linha(s) importada(s) de ${fileName}.${result.duplicateRows ? ` ${result.duplicateRows} já estavam cadastradas.` : ""}${result.errorRows ? ` ${result.errorRows} com erro ficaram de fora.` : ""}`);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Não foi possível importar a planilha.");
    } finally { setBusy(null); }
  };

  const importable = validation ? validation.validRows + (importWarnings ? validation.warningRows : 0) : 0;

  return (
    <Card className="viewer-xml-importer" eyebrow="Nova nota" title="Importar notas por planilha" actions={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      {error ? <Alert tone="danger" title="Não foi possível concluir">{error}</Alert> : null}
      <div className="viewer-invoice-editor__grid">
        <label>Empresa própria
          <select className="ui-select" value={ownLegalEntityId} onChange={(event) => { setOwnLegalEntityId(event.target.value); setValidation(null); }}>
            <option value="">Selecione</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.tradeName}</option>)}
          </select>
        </label>
        <label className="viewer-xml-file">
          <strong>{fileName || "Selecione a planilha .xlsx"}</strong>
          <small>Até 1.000 linhas e 15 MB por vez. Planilhas maiores: divida em partes.</small>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => {
            const selected = event.target.files?.[0]; if (!selected) return;
            setFileName(selected.name); setSheetName(""); setHeaderRow(1);
            void fileToBase64(selected).then((content) => { setContentBase64(content); void inspect(content, selected.name); });
          }} />
        </label>
      </div>
      {inspection ? (
        <>
          <div className="viewer-invoice-editor__grid">
            <label>Aba
              <select className="ui-select" value={sheetName} onChange={(event) => { setSheetName(event.target.value); void inspect(contentBase64, fileName, event.target.value); }}>
                {inspection.sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name} · {sheet.rowCount} linhas</option>)}
              </select>
            </label>
            <label>Linha do cabeçalho
              <input className="ui-input" type="number" min={1} max={100} value={headerRow} onChange={(event) => setHeaderRow(Number(event.target.value) || 1)}
                onBlur={() => void inspect(contentBase64, fileName, sheetName, headerRow)} />
            </label>
          </div>
          <div className="viewer-invoice-editor__section">
            <strong>Colunas da planilha · {inspection.totalRows} linha(s) com dados</strong>
            <div className="viewer-invoice-editor__grid">
              {FIELDS.map((field) => (
                <label key={field.key}>{field.label}{field.required ? " *" : ""}
                  <select className="ui-select" value={mapping[field.key] ?? ""} onChange={(event) => { setMapping({ ...mapping, [field.key]: event.target.value }); setValidation(null); }}>
                    <option value="">Não usar</option>{inspection.headers.filter(Boolean).map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <div className="viewer-invoice-editor__section">
            <strong>Valores padrão</strong>
            <div className="viewer-invoice-editor__grid">
              <label>Tipo
                <select className="ui-select" value={operationType} onChange={(event) => { setOperationType(event.target.value as "SALE" | "PURCHASE"); setResponsiblePartnerId(""); setValidation(null); }}>
                  <option value="SALE">Saída / venda</option><option value="PURCHASE">Entrada / compra</option>
                </select>
              </label>
              <label>{operationType === "SALE" ? "Cliente padrão" : "Fornecedor padrão"}
                <select className="ui-select" value={responsiblePartnerId} onChange={(event) => { setResponsiblePartnerId(event.target.value); setValidation(null); }}>
                  <option value="">Selecione</option>{responsibleOptions.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name}</option>)}
                </select>
              </label>
              <label>Produto
                <select className="ui-select" value={productId} onChange={(event) => { setProductId(event.target.value); setValidation(null); }}>
                  <option value="">Selecione</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </label>
              <label>Escopo padrão
                <select className="ui-select" value={operationScope} onChange={(event) => { setOperationScope(event.target.value as "INTERNAL" | "EXTERNAL"); setValidation(null); }}>
                  <option value="INTERNAL">Interno (mesma UF)</option><option value="EXTERNAL">Externo (outra UF)</option>
                </select>
              </label>
              <label>Data padrão<input className="ui-input" type="date" value={defaultDate} onChange={(event) => { setDefaultDate(event.target.value); setValidation(null); }} /></label>
            </div>
            <small>O cliente padrão vale para as linhas sem a coluna Cliente. Quando a coluna existe, o nome precisa ser igual ao do cadastro.</small>
          </div>
          <footer className="viewer-invoice-editor__footer">
            <Button loading={busy === "validate"} disabled={!ready} onClick={() => void validate()}>Validar linhas</Button>
          </footer>
        </>
      ) : null}
      {validation ? (
        <div className="viewer-invoice-editor__section">
          <div className="viewer-xml-preview__summary">
            <span><small>Linhas</small><strong>{validation.totalRows}</strong></span>
            <span><small>Prontas</small><strong>{validation.validRows}</strong></span>
            <span><small>Com aviso</small><strong>{validation.warningRows}</strong></span>
            <span><small>Com erro</small><strong>{validation.errorRows}</strong></span>
          </div>
          <div className="viewer-spreadsheet-rows">
            {validation.rows.map((row) => (
              <div className="viewer-invoice-editor__line" key={row.rowNumber}>
                <span><strong>Linha {row.rowNumber}{row.data.documentNumber ? ` · NF ${row.data.documentNumber}` : ""}</strong>
                  <small>{row.errorMessage ?? (row.warningCodes.length ? `Usou ${row.warningCodes.map((code) => WARNING_LABELS[code] ?? code).join(" e ")}` : Object.values(row.raw).filter(Boolean).slice(0, 4).join(" · "))}</small></span>
                <span>{row.data.sacks ? `${Number(row.data.sacks).toLocaleString("pt-BR")} sacas` : ""}<small>{row.data.date ?? ""}</small></span>
                <span><Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge></span>
              </div>
            ))}
          </div>
          {validation.totalRows > validation.rows.length ? <small>Mostrando as primeiras {validation.rows.length} linhas.</small> : null}
          <div className="viewer-xml-importer__options">
            {validation.warningRows ? <label><input type="checkbox" checked={importWarnings} onChange={(event) => setImportWarnings(event.target.checked)} /> Importar também as {validation.warningRows} linha(s) com aviso (entram como pendentes)</label> : null}
          </div>
          <footer className="viewer-invoice-editor__footer">
            <small>Notas iguais já cadastradas são ignoradas. Linhas com a mesma NF viram uma nota com vários itens.</small>
            <Button variant="primary" loading={busy === "import"} disabled={!importable} onClick={() => void importRows()}>Importar {importable} linha(s)</Button>
          </footer>
        </div>
      ) : null}
    </Card>
  );
}
