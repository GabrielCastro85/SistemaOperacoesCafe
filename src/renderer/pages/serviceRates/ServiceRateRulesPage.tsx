import React, { useCallback, useEffect, useState } from "react";
import type { BootstrapData, BusinessPartner, Product, ServiceRateRule, OperationScope } from "../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../shared/utils/format";
import { PageHeader } from "../../design-system";
import { Feedback } from "../../components/feedback/Feedback";
import { SelectField, TextField } from "../../components/forms/LegacyFields";
import { AdminBlock, FormGrid } from "../../components/layout/SectionPrimitives";
const scopeLabels: Record<OperationScope, string> = { INTERNAL: "Interna", EXTERNAL: "Externa", ALL: "Todas" };
export function ServiceRateRulesPage({ data }: { data: BootstrapData }): JSX.Element {
  const organizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? "";
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<ServiceRateRule[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [productId, setProductId] = useState("");
  const [scope, setScope] = useState<OperationScope>("EXTERNAL");
  const [value, setValue] = useState("5,00");
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    const clientPartners = await window.operationsCafe.listBusinessPartners({ organizationId, role: "CLIENT", status: "active" });
    setPartners(clientPartners);
    setPartnerId((current) => current || clientPartners[0]?.id || "");
    setProducts(await window.operationsCafe.listProducts({ organizationId, status: "active" }));
    setRules(await window.operationsCafe.listServiceRateRules({ organizationId, status: "all" }));
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);
  async function saveRule(): Promise<void> {
    try {
      await window.operationsCafe.createServiceRateRule({
        organizationId,
        businessPartnerId: partnerId,
        ownLegalEntityId: null,
        productId: productId || null,
        operationScope: scope,
        rateType: "PER_SACK",
        rateValueCents: Math.round(Number(value.replace(".", "").replace(",", ".")) * 100),
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: null,
        priority: productId ? 10 : 1,
        notes: null,
        isActive: true
      });
      setMessage("Regra por saca salva.");
      await load();
    } catch (errorValue) {
      setMessage(`Erro: ${errorValue instanceof Error ? errorValue.message : "falha ao salvar regra."}`);
    }
  }
  return (
    <section className="content-section settings">
      <PageHeader eyebrow="Regras por saca" title="Valores comerciais por cliente" description="Cadastre vigencias, escopos e produtos para aplicar automaticamente o valor de servico por saca." />
      <AdminBlock title="Cobrancas - Regras por cliente">
        <FormGrid>
          <SelectField label="Cliente" value={partnerId} onChange={setPartnerId} options={partners.map((item) => [item.id, item.displayName])} />
          <SelectField label="Tipo" value={scope} onChange={(next) => setScope(next as OperationScope)} options={[["INTERNAL", "Interna"], ["EXTERNAL", "Externa"], ["ALL", "Todas"]]} />
          <SelectField label="Produto" value={productId} onChange={setProductId} options={[["", "Todos"], ...products.map((item) => [item.id, item.name] as [string, string])]} />
          <TextField label="Valor por saca" value={value} onChange={setValue} />
          <button className="primary" onClick={() => void saveRule()}>Cadastrar regra</button>
        </FormGrid>
        <div className="table"><div className="table-head rate-grid"><span>Cliente</span><span>Tipo</span><span>Produto</span><span>Valor</span><span>Vigencia</span><span>Status</span></div>{rules.map((item) => <div key={item.id} className="table-row rate-grid"><span>{partners.find((partner) => partner.id === item.businessPartnerId)?.displayName ?? item.businessPartnerId}</span><span>{scopeLabels[item.operationScope]}</span><span>{products.find((product) => product.id === item.productId)?.name ?? "Todos"}</span><span>{formatCurrencyFromCents(item.rateValueCents)} por saca</span><span>{item.effectiveFrom} ate {item.effectiveTo ?? "sem data final"}</span><span>{item.isActive ? "Vigente" : "Inativa"}</span></div>)}</div>
      </AdminBlock>
      <Feedback message={message} />
    </section>
  );
}


