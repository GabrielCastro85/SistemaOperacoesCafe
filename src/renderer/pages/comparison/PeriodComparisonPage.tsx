import React, { useMemo, useState } from "react";
import type { BootstrapData } from "../../../shared/types/domain";
import {
  applyDayRangeToPeriods,
  COMPARISON_PRESETS,
  comparisonPresetPeriods,
  type ComparisonPeriodInput,
  type PeriodComparisonInput,
  type PeriodComparisonReport
} from "../../../shared/utils/periodComparison";
import { PageHeader } from "../../design-system";

const MAX_PERIODS = 4;
const MIN_PERIODS = 2;

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}

export function PeriodComparisonPage({ data }: { data: BootstrapData }): JSX.Element {
  const [periods, setPeriods] = useState<ComparisonPeriodInput[]>(() => comparisonPresetPeriods("lastTwoMonths", todayIso()));
  const [scope, setScope] = useState("");
  const [fromDay, setFromDay] = useState("1");
  const [toDay, setToDay] = useState("20");
  const [generated, setGenerated] = useState<{ input: PeriodComparisonInput; report: PeriodComparisonReport; svg: string } | null>(null);
  const [message, setMessage] = useState("");

  const preview = useMemo(() => generated ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generated.svg)}` : null, [generated]);

  function changePeriods(next: ComparisonPeriodInput[]): void {
    setPeriods(next);
    setGenerated(null);
    setMessage("");
  }

  function applyDayRange(): void {
    const from = Number(fromDay);
    const to = Number(toDay);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 31 || from > to) {
      setMessage("Informe um intervalo de dias válido, por exemplo do dia 1 ao dia 20.");
      return;
    }
    changePeriods(applyDayRangeToPeriods(periods, from, to));
  }

  function buildInput(): PeriodComparisonInput {
    const [kind, id] = scope.split(":");
    if (kind === "organization") return { periods, organizationId: id };
    if (kind === "company") {
      const company = data.legalEntities.find((item) => item.id === id);
      return { periods, organizationId: company?.organizationId ?? null, ownLegalEntityId: id };
    }
    return { periods };
  }

  async function generate(): Promise<void> {
    setMessage("");
    try {
      const input = buildInput();
      const result = await window.operationsCafe.getPeriodComparison(input);
      setGenerated({ input, ...result });
    } catch (error) {
      setGenerated(null);
      setMessage(`Erro: ${errorMessage(error, "falha ao gerar o comparativo.")}`);
    }
  }

  async function saveImage(): Promise<void> {
    if (!generated) return;
    try {
      const saved = await window.operationsCafe.exportPeriodComparisonImage(generated.input);
      if (saved) setMessage("Imagem salva.");
    } catch (error) {
      setMessage(`Erro: ${errorMessage(error, "falha ao salvar a imagem.")}`);
    }
  }

  async function copyImage(): Promise<void> {
    if (!generated) return;
    try {
      await window.operationsCafe.copyPeriodComparisonImage(generated.input);
      setMessage("Imagem copiada. Agora é só colar no WhatsApp ou no e-mail.");
    } catch (error) {
      setMessage(`Erro: ${errorMessage(error, "falha ao copiar a imagem.")}`);
    }
  }

  return (
    <div className="period-comparison">
      <PageHeader
        title="Comparativo de períodos"
        description="Compare de 2 a 4 períodos e gere uma imagem com volumes, empresas, clientes e valores."
      />
      <section className="period-comparison__panel">
        <div className="period-comparison__group">
          <span className="period-comparison__label">Atalhos</span>
          <div className="period-comparison__actions">
            {COMPARISON_PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => changePeriods(comparisonPresetPeriods(preset.id, todayIso()))}>{preset.label}</button>
            ))}
          </div>
        </div>

        <div className="period-comparison__group">
          <span className="period-comparison__label">Períodos</span>
          {periods.map((period, index) => (
            <div className="period-comparison__row" key={index}>
              <strong>{index + 1}</strong>
              <label>De<input type="date" value={period.start} onChange={(event) => changePeriods(periods.map((item, position) => position === index ? { ...item, start: event.target.value } : item))} /></label>
              <label>Até<input type="date" value={period.end} onChange={(event) => changePeriods(periods.map((item, position) => position === index ? { ...item, end: event.target.value } : item))} /></label>
              {periods.length > MIN_PERIODS ? <button type="button" onClick={() => changePeriods(periods.filter((_, position) => position !== index))}>Remover</button> : null}
            </div>
          ))}
          {periods.length < MAX_PERIODS ? <div><button type="button" onClick={() => changePeriods([...periods, { ...periods[periods.length - 1] }])}>Adicionar período</button></div> : null}
        </div>

        <div className="period-comparison__group">
          <span className="period-comparison__label">Mesmo intervalo de dias em todos os meses</span>
          <div className="period-comparison__row">
            <label>Do dia<input type="number" min={1} max={31} value={fromDay} onChange={(event) => setFromDay(event.target.value)} /></label>
            <label>Ao dia<input type="number" min={1} max={31} value={toDay} onChange={(event) => setToDay(event.target.value)} /></label>
            <button type="button" onClick={applyDayRange}>Aplicar aos períodos</button>
          </div>
        </div>

        <div className="period-comparison__group">
          <label className="period-comparison__label" htmlFor="period-comparison-scope">Empresas consideradas</label>
          <select id="period-comparison-scope" value={scope} onChange={(event) => { setScope(event.target.value); setGenerated(null); }}>
            <option value="">Todas as empresas</option>
            {data.organizations.map((organization) => (
              <optgroup key={organization.id} label={organization.displayName}>
                <option value={`organization:${organization.id}`}>Todo o grupo {organization.displayName}</option>
                {data.legalEntities.filter((company) => company.organizationId === organization.id).map((company) => (
                  <option key={company.id} value={`company:${company.id}`}>{company.tradeName}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="period-comparison__actions">
          <button type="button" className="btn-primary" onClick={() => void generate()}>Gerar comparativo</button>
          {generated ? <button type="button" onClick={() => void saveImage()}>Salvar imagem</button> : null}
          {generated ? <button type="button" onClick={() => void copyImage()}>Copiar imagem</button> : null}
        </div>
        {message ? <p className="period-comparison__message" role="status">{message}</p> : null}
      </section>

      {preview ? <img className="period-comparison__preview" src={preview} alt="Comparativo de vendas entre os períodos selecionados" /> : null}
    </div>
  );
}
