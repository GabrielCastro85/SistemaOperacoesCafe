import { useState } from "react";
import type { LegalEntity, Organization } from "../../../shared/types/domain";
import { formatCnpj } from "../../../shared/utils/format";
import { resolveOrganizationLogoSrc } from "../../../shared/branding/branding";

const REMEMBER_KEY = "operationsCafe.rememberedOrganizationId";

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
  onSelect
}: {
  organizations: Organization[];
  legalEntities: LegalEntity[];
  defaultOrganizationId: string | null;
  onSelect: (organizationId: string, remember: boolean) => void;
}): JSX.Element {
  const activeOrganizations = organizations.filter((org) => org.isActive);
  const [selectedId, setSelectedId] = useState(defaultOrganizationId ?? activeOrganizations[0]?.id ?? "");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  function primaryCnpjFor(organizationId: string): string | null {
    return legalEntities.find((entity) => entity.organizationId === organizationId && entity.isActive)?.cnpj ?? null;
  }

  function submit(): void {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    onSelect(selectedId, remember);
  }

  return (
    <main className="auth-shell">
      <section className="org-picker-panel">
        <span className="auth-eyebrow">Sistema de Operacoes de Cafe</span>
        <h1>Bem-vindo</h1>
        <p>Selecione a empresa para acessar o sistema.</p>
        <div className="org-picker-grid">
          {activeOrganizations.map((org) => {
            const cnpj = primaryCnpjFor(org.id);
            const logoSrc = resolveOrganizationLogoSrc(org);
            const isSelected = selectedId === org.id;
            return (
              <button
                key={org.id}
                type="button"
                className={`org-picker-card${isSelected ? " active" : ""}`}
                onClick={() => setSelectedId(org.id)}
              >
                {logoSrc ? <img src={logoSrc} alt="" /> : <div className="brand-mark">{org.displayName.slice(0, 2).toUpperCase()}</div>}
                <div className="org-picker-card__body">
                  <strong>{org.displayName}</strong>
                  {cnpj ? <span className="org-picker-card__cnpj">CNPJ: {formatCnpj(cnpj)}</span> : null}
                  {org.description ? <small>{org.description}</small> : null}
                </div>
                <span className="org-picker-card__chevron" aria-hidden="true">
                  &#8250;
                </span>
              </button>
            );
          })}
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Lembrar minha escolha
        </label>
        <button className="primary" type="button" disabled={!selectedId || submitting} onClick={submit}>
          Entrar no sistema
        </button>
      </section>
    </main>
  );
}
