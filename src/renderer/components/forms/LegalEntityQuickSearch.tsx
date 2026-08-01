import React, { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessPartnerLegalEntity } from "../../../shared/types/domain";
import { formatCnpj, onlyDigits } from "../../../shared/utils/format";

function normalizeSearch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function entityLabel(entity: BusinessPartnerLegalEntity | undefined): string {
  if (!entity) return "";
  return entity.legalName || entity.tradeName || "";
}

export function LegalEntityQuickSearch({
  label,
  value,
  onChange,
  legalEntities,
  placeholder = "Digite nome, fantasia ou CNPJ",
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  legalEntities: BusinessPartnerLegalEntity[];
  placeholder?: string;
  disabled?: boolean;
}): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selectedEntity = legalEntities.find((entity) => entity.id === value);
  const [query, setQuery] = useState(entityLabel(selectedEntity));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) setQuery(entityLabel(selectedEntity));
  }, [open, selectedEntity]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent): void {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const results = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const cnpjQuery = onlyDigits(query) ?? "";
    const scored = legalEntities.map((entity) => {
      const text = normalizeSearch(`${entity.legalName} ${entity.tradeName} ${entity.cnpj ?? ""} ${entity.city ?? ""} ${entity.state ?? ""}`);
      const cnpj = onlyDigits(entity.cnpj ?? "") ?? "";
      let score = 0;
      if (!normalizedQuery && !cnpjQuery) score = 1;
      else if (normalizeSearch(entityLabel(entity)).startsWith(normalizedQuery)) score = 100;
      else if (text.includes(normalizedQuery)) score = 60;
      else if (cnpjQuery && cnpj.includes(cnpjQuery)) score = 70;
      return { entity, score };
    }).filter((item) => item.score > 0);

    return scored
      .sort((a, b) => b.score - a.score || entityLabel(a.entity).localeCompare(entityLabel(b.entity)))
      .slice(0, 24);
  }, [legalEntities, query]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  function selectEntity(entity: BusinessPartnerLegalEntity): void {
    onChange(entity.id);
    setQuery(entityLabel(entity));
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
            selectEntity(results[activeIndex].entity);
          }
          if (event.key === "Escape") {
            setOpen(false);
            setQuery(entityLabel(selectedEntity));
          }
        }}
      />
      {open ? (
        <div className="partner-search__panel">
          <div className="partner-search__head"><span>Empresa</span><span>CNPJ</span><span>Cidade/UF</span></div>
          {results.length ? results.map((item, index) => (
            <button
              key={item.entity.id}
              type="button"
              className={index === activeIndex ? "active" : ""}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                selectEntity(item.entity);
              }}
            >
              <span>{entityLabel(item.entity)}</span>
              <span>{item.entity.cnpj ? formatCnpj(item.entity.cnpj) : "-"}</span>
              <span>{[item.entity.city, item.entity.state].filter(Boolean).join("/") || "-"}</span>
            </button>
          )) : (
            <div className="partner-search__empty">Nenhuma empresa encontrada</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
