import { useEffect, useMemo, useRef, useState } from "react";
import type { LegalEntity, Organization } from "../../shared/types/domain";
import { formatCnpj } from "../../shared/utils/format";
import flagEspiritoSanto from "../assets/flags/bandeira-espirito-santo.svg";
import flagMinasGerais from "../assets/flags/bandeira-minas-gerais.svg";
import flagSaoPaulo from "../assets/flags/bandeira-sao-paulo.svg";

export function stateFlagSrc(state: string | null | undefined): string | null {
  const normalized = (state ?? "").trim().toUpperCase();
  const flags: Record<string, string> = { ES: flagEspiritoSanto, MG: flagMinasGerais, SP: flagSaoPaulo };
  return flags[normalized] ?? null;
}

// Seletor unico de empresa (usado no site): mostra a empresa ativa com a
// bandeira do estado e abre a lista de todas as empresas, agrupadas por grupo.
// Substitui os tres controles do topo (Grupo, Operando em, Empresa/CNPJ).
export function CompanySwitcher({
  organizations,
  entities,
  activeEntity,
  canSwitchOrganization,
  canSwitchLegalEntity,
  onSelect
}: {
  organizations: Organization[];
  entities: LegalEntity[];
  activeEntity: LegalEntity | null;
  canSwitchOrganization: boolean;
  canSwitchLegalEntity: boolean;
  onSelect: (entity: LegalEntity) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeOrganization = organizations.find((item) => item.id === activeEntity?.organizationId) ?? null;
  const groups = useMemo(() => organizations
    .filter((organization) => canSwitchOrganization || organization.id === activeEntity?.organizationId)
    .map((organization) => ({
      organization,
      entities: entities
        .filter((entity) => entity.organizationId === organization.id)
        .sort((left, right) => left.tradeName.localeCompare(right.tradeName, "pt-BR"))
    }))
    .filter((group) => group.entities.length > 0), [organizations, entities, canSwitchOrganization, activeEntity?.organizationId]);
  const canSwitch = canSwitchLegalEntity && groups.reduce((sum, group) => sum + group.entities.length, 0) > 1;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const flag = stateFlagSrc(activeEntity?.state);
  return (
    <div className={`company-switcher ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="company-switcher__current"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={!canSwitch}
        title={canSwitch ? "Trocar de empresa" : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {flag ? <img className="company-switcher__flag" src={flag} alt="" aria-hidden="true" /> : <span className="company-switcher__flag company-switcher__flag--empty" aria-hidden="true" />}
        <span className="company-switcher__text">
          <small>Operando em · {activeOrganization?.displayName ?? "Grupo"}</small>
          <strong>{activeEntity?.tradeName ?? "Escolha a empresa"}</strong>
          <small>{activeEntity ? formatCnpj(activeEntity.cnpj) : "CNPJ pendente"}</small>
        </span>
        {canSwitch ? <span className="company-switcher__chevron" aria-hidden="true">▾</span> : null}
      </button>
      {open ? (
        <div className="company-switcher__menu" role="listbox" aria-label="Empresas">
          {groups.map((group) => (
            <section key={group.organization.id}>
              <span className="company-switcher__group">{group.organization.displayName}</span>
              {group.entities.map((entity) => {
                const entityFlag = stateFlagSrc(entity.state);
                const active = entity.id === activeEntity?.id;
                return (
                  <button
                    key={entity.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`company-switcher__option ${active ? "is-active" : ""}`}
                    onClick={() => { setOpen(false); if (!active) onSelect(entity); }}
                  >
                    {entityFlag ? <img src={entityFlag} alt="" aria-hidden="true" /> : <span className="company-switcher__flag--empty" aria-hidden="true" />}
                    <span>
                      <strong>{entity.tradeName}</strong>
                      <small>{formatCnpj(entity.cnpj)}{entity.state ? ` · ${entity.state}` : ""}</small>
                    </span>
                    {active ? <span className="company-switcher__check" aria-hidden="true">✓</span> : null}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// O site marca <html class="site"> antes de carregar as telas (web/siteFlag.ts).
export function isWebSite(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("site");
}
