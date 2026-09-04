import { useCallback, useEffect, useState } from "react";
import type { BootstrapData, Product, ProductAlias } from "../../../../shared/types/domain";
import { Alert, Button, Card, Input, PageHeader, Select } from "../../../design-system";

const productLabels: Record<Product["category"], string> = {
  COFFEE_ARABICA: "Cafe Arabica",
  COFFEE_CONILON: "Cafe Conilon",
  COFFEE_OTHER: "Outro cafe",
  OTHER: "Outro produto"
};

// Resolve o produto de um item de nota XML por igualdade EXATA de texto
// normalizado (ver resolveProductAlias em appRepository.ts) -- "CAFE EM
// GRAOS CRU CONILON" so' casa com um alias cadastrado com esse texto
// completo, nunca por conter "CONILON". Esta tela existia so' como esqueleto
// (sem nenhuma chamada real de IPC) ate' esta correcao -- o backend sempre
// esteve pronto, so' nunca foi ligado na UI.
export function ProductAliasesPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const [aliases, setAliases] = useState<ProductAlias[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sourceDescription, setSourceDescription] = useState("");
  const [productId, setProductId] = useState("");
  const [sourceProductCode, setSourceProductCode] = useState("");
  const [ncm, setNcm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const [aliasList, productList] = await Promise.all([
      window.operationsCafe.listProductAliases(organizationId),
      window.operationsCafe.listProducts({ organizationId, status: "active" })
    ]);
    setAliases(aliasList);
    setProducts(productList);
    if (!productId && productList[0]) setProductId(productList[0].id);
  }, [organizationId, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAlias(): Promise<void> {
    setError(null);
    setMessage(null);
    if (!sourceDescription.trim()) { setError("Cole o texto exato do produto na nota (campo xProd do XML)."); return; }
    if (!productId) { setError("Selecione o produto do catalogo pra vincular."); return; }
    setSaving(true);
    try {
      await window.operationsCafe.createProductAlias({
        organizationId,
        productId,
        issuerPartnerLegalEntityId: null,
        sourceProductCode: sourceProductCode.trim() || null,
        sourceDescription: sourceDescription.trim(),
        ncm: ncm.trim() || null,
        isActive: true
      });
      setSourceDescription("");
      setSourceProductCode("");
      setNcm("");
      await load();
      setMessage("Alias criado. Notas com esse texto exato ja vao reconhecer o produto automaticamente a partir de agora -- reimporte o XML que ja tinha ficado com pendencia pra aplicar nele tambem.");
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Falha ao criar o alias.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(alias: ProductAlias): Promise<void> {
    setError(null);
    try {
      if (alias.isActive) await window.operationsCafe.deactivateProductAlias(alias.id);
      else await window.operationsCafe.activateProductAlias(alias.id);
      await load();
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Falha ao atualizar o alias.");
    }
  }

  return (
    <section className="content-section">
      <PageHeader
        eyebrow="Importacao de XML"
        title="Aliases de produto"
        description={'Ensina o sistema a reconhecer um texto de produto que vem na nota (campo "xProd" do XML) e nao bate com nenhum produto do catalogo -- o texto precisa ser IDENTICO ao que aparece na nota, letra por letra (o sistema ja ignora acento e maiusculas/minusculas).'}
      />
      {error && <Alert variant="danger">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      <Card title="Novo alias">
        <Input
          label="Texto do produto na nota"
          value={sourceDescription}
          onChange={(event) => setSourceDescription(event.target.value)}
          placeholder="Ex: CAFE EM GRAOS CRU CONILON"
          hint="Copie exatamente como aparece no PDF/XML da nota, incluindo todas as palavras."
        />
        <Select label="Produto do catalogo" value={productId} onChange={(event) => setProductId(event.target.value)}>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({productLabels[product.category]})
            </option>
          ))}
        </Select>
        <Input
          label="Codigo do produto na nota (opcional)"
          value={sourceProductCode}
          onChange={(event) => setSourceProductCode(event.target.value)}
          hint='Campo "cProd" do XML -- deixe em branco pra valer com qualquer codigo.'
        />
        <Input
          label="NCM (opcional)"
          value={ncm}
          onChange={(event) => setNcm(event.target.value)}
          hint="Deixe em branco pra valer com qualquer NCM."
        />
        <Button variant="primary" onClick={() => void createAlias()} loading={saving}>Criar alias</Button>
      </Card>
      <Card title="Aliases cadastrados">
        {aliases.length === 0 ? (
          <p className="muted">Nenhum alias cadastrado ainda.</p>
        ) : (
          <div className="table">
            <div className="table-head document-grid">
              <span>Texto na nota</span>
              <span>Produto</span>
              <span>Codigo/NCM</span>
              <span>Status</span>
              <span>Acoes</span>
            </div>
            {aliases.map((alias) => {
              const product = products.find((item) => item.id === alias.productId);
              return (
                <div key={alias.id} className="table-row document-grid">
                  <span>{alias.sourceDescription}</span>
                  <span>{product?.name ?? "-"}</span>
                  <span>{[alias.sourceProductCode, alias.ncm].filter(Boolean).join(" / ") || "Qualquer"}</span>
                  <span>{alias.isActive ? "Ativo" : "Inativo"}</span>
                  <span><button onClick={() => void toggleActive(alias)}>{alias.isActive ? "Desativar" : "Ativar"}</button></span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
