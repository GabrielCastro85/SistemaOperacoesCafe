import { useState } from "react";
import type { LegalEntity, Organization } from "../../../shared/types/domain";
import { formatCnpj } from "../../../shared/utils/format";
import { resolveOrganizationLogoSrc } from "../../../shared/branding/branding";

const REMEMBER_KEY = "operationsCafe.rememberedOrganizationId";

function isOperationalLegalEntity(entity: LegalEntity): boolean {
  return entity.documentPrefix !== "TERC-XML";
}

export function rememberedOrganizationId(): string | null {
  try {
    return window.localStorage.getItem(REMEMBER_KEY);
  } catch {
    return null;
  }
}

export function setRememberedOrganizationId(organizationId: string | null): void {
  try {
    if (organizationId) window.localStorage.setItem(REMEMBER_KEY, organizationId);
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // localStorage indisponivel (ex: modo privado); nao bloqueia o fluxo.
  }
}

export function OrganizationPickerPage({
  organizations,
  legalEntities,
  defaultOrganizationId,
  defaultLegalEntityId,
  onSelect
}: {
  organizations: Organization[];
  legalEntities: LegalEntity[];
  defaultOrganizationId: string | null;
  defaultLegalEntityId: string | null;
  onSelect: (organizationId: string, legalEntityId: string) => void;
}): JSX.Element {
  const activeLegalEntities = legalEntities.filter((entity) => entity.isActive && isOperationalLegalEntity(entity));
  const firstEntity = activeLegalEntities.find((entity) => entity.id === defaultLegalEntityId) ?? activeLegalEntities.find((entity) => entity.organizationId === defaultOrganizationId) ?? activeLegalEntities[0] ?? null;
  const [selectedId, setSelectedId] = useState(firstEntity?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  function submit(): void {
    if (!selectedId || submitting) return;
    const entity = activeLegalEntities.find((item) => item.id === selectedId);
    if (!entity) return;
    setSubmitting(true);
    onSelect(entity.organizationId, entity.id);
  }

  return (
    <main className="auth-shell">
      <section className="org-picker-panel">
        <span className="auth-eyebrow">Sistema de Operacoes de Cafe</span>
        <h1>Bem-vindo</h1>
        <p>Selecione a empresa/CNPJ para acessar o sistema.</p>
        <div className="org-picker-grid">
          {activeLegalEntities.map((entity) => {
            const org = organizations.find((item) => item.id === entity.organizationId) ?? null;
            const logoSrc = resolveOrganizationLogoSrc(org);
            const isSelected = selectedId === entity.id;
            return (
              <button
                key={entity.id}
                type="button"
                className={`org-picker-card${isSelected ? " active" : ""}`}
                onClick={() => setSelectedId(entity.id)}
              >
                {logoSrc ? <img src={logoSrc} alt="" /> : <div className="brand-mark">{entity.tradeName.slice(0, 2).toUpperCase()}</div>}
                <div className="org-picker-card__body">
                  <strong>{entity.tradeName}</strong>
                  <span className="org-picker-card__cnpj">CNPJ: {formatCnpj(entity.cnpj)}</span>
                  <small>{org?.displayName ?? "Empresa"} - {entity.city}/{entity.state}</small>
                </div>
                <span className="org-picker-card__chevron" aria-hidden="true">
                  &#8250;
                </span>
              </button>
            );
          })}
        </div>
        <button className="primary" type="button" disabled={!selectedId || submitting} onClick={submit}>
          Entrar no sistema
        </button>
      </section>
    </main>
  );
}
