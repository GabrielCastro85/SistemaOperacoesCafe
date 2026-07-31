import React, { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessPartner, BusinessPartnerLegalEntity } from "../../../shared/types/domain";
import { formatCnpj, onlyDigits } from "../../../shared/utils/format";

function normalizeSearch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function partnerLabel(partner: BusinessPartner | undefined): string {
  return partner?.displayName ?? "";
}

export function PartnerQuickSearch({
  label,
  value,
  onChange,
  partners,
  legalEntities = [],
  placeholder = "Digite nome, CNPJ ou cidade",
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  partners: BusinessPartner[];
  legalEntities?: BusinessPartnerLegalEntity[];
  placeholder?: string;
  disabled?: boolean;
}): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selectedPartner = partners.find((partner) => partner.id === value);
  const [query, setQuery] = useState(partnerLabel(selectedPartner));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) setQuery(partnerLabel(selectedPartner));
  }, [open, selectedPartner]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent): void {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const primaryEntities = useMemo(() => {
    const map = new Map<string, BusinessPartnerLegalEntity>();
    legalEntities.forEach((entity) => {
      if (!entity.businessPartnerId) return;
      const current = map.get(entity.businessPartnerId);
      if (!current || entity.isPrimary) map.set(entity.businessPartnerId, entity);
    });
    return map;
  }, [legalEntities]);

  const results = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const cnpjQuery = onlyDigits(query) ?? "";
    const scored = partners.map((partner) => {
      const entity = primaryEntities.get(partner.id);
      const text = normalizeSearch(`${partner.displayName} ${entity?.legalName ?? ""} ${entity?.tradeName ?? ""} ${entity?.cnpj ?? ""} ${entity?.city ?? ""} ${entity?.state ?? ""}`);
      const cnpj = onlyDigits(entity?.cnpj ?? "") ?? "";
      let score = 0;
      if (!normalizedQuery && !cnpjQuery) score = 1;
      else if (normalizeSearch(partner.displayName).startsWith(normalizedQuery)) score = 100;
      else if (text.includes(normalizedQuery)) score = 60;
      else if (cnpjQuery && cnpj.includes(cnpjQuery)) score = 70;
      return { partner, entity, score };
    }).filter((item) => item.score > 0);

    return scored
      .sort((a, b) => b.score - a.score || a.partner.displayName.localeCompare(b.partner.displayName))
      .slice(0, 24);
  }, [partners, primaryEntities, query]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  function selectPartner(partner: BusinessPartner): void {
    onChange(partner.id);
    setQuery(partner.displayName);
    setOpen(false);
  }

  return (
    <div className="partner-search" ref={wrapperRef}>
      <span className="partner-search__label">{label}</span>
      <input
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!open && ["ArrowDown", "Enter"].includes(event.key)) {
            setOpen(true);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter" && results[activeIndex]) {
            event.preventDefault();
            selectPartner(results[activeIndex].partner);
          }
          if (event.key === "Escape") {
            setOpen(false);
            setQuery(partnerLabel(selectedPartner));
          }
        }}
      />
      {open ? (
        <div className="partner-search__panel">
          <div className="partner-search__head"><span>Cliente</span><span>CNPJ</span><span>Cidade/UF</span></div>
          {results.length ? results.map((item, index) => (
            <button
              key={item.partner.id}
              type="button"
              className={index === activeIndex ? "active" : ""}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                selectPartner(item.partner);
              }}
            >
              <span>{item.partner.displayName}</span>
              <span>{item.entity?.cnpj ? formatCnpj(item.entity.cnpj) : "-"}</span>
              <span>{[item.entity?.city, item.entity?.state].filter(Boolean).join("/") || "-"}</span>
            </button>
          )) : (
            <div className="partner-search__empty">Nenhum cliente encontrado</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
