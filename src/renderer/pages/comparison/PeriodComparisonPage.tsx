import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BootstrapData } from "../../../shared/types/domain";
import {
  applyDayRangeToPeriods,
  COMPARISON_PRESETS,
  comparisonPresetPeriods,
  nextComparisonPeriod,
  type ComparisonPeriodInput,
  type PeriodComparisonInput
} from "../../../shared/utils/periodComparison";
import { Button } from "../../design-system";

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

function ComparisonViewer({ src, onClose }: { src: string; onClose: () => void }): JSX.Element {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="period-comparison__viewer" role="dialog" aria-modal="true" aria-label="Comparativo ampliado">
      <div className="period-comparison__viewer-bar">
        <Button onClick={() => setZoomed((current) => !current)}>{zoomed ? "Ajustar à tela" : "Ver com mais zoom"}</Button>
        <Button onClick={onClose}>Fechar</Button>
      </div>
      <div className={`period-comparison__viewer-body${zoomed ? " period-comparison__viewer-body--zoom" : ""}`}>
        <img src={src} alt="Comparativo de vendas ampliado" onClick={() => setZoomed((current) => !current)} />
      </div>
    </div>,
    document.body
  );
}

export function PeriodComparisonPage({ data }: { data: BootstrapData }): JSX.Element {
  const themeOrganizationId = data.profile?.defaultOrganizationId ?? data.organizations[0]?.id ?? null;
  const themeOrganization = data.organizations.find((organization) => organization.id === themeOrganizationId);
  const companyNames = data.organizations.map((organization) => organization.displayName).join(" e ");
  const [periods, setPeriods] = useState<ComparisonPeriodInput[]>(() => comparisonPresetPeriods("lastTwoMonths", todayIso()));
  const [fromDay, setFromDay] = useState("1");
  const [toDay, setToDay] = useState("20");
  const [generated, setGenerated] = useState<{ input: PeriodComparisonInput; svg: string } | null>(null);
  const [stale, setStale] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const periodsRef = useRef(periods);
  periodsRef.current = periods;

  const preview = useMemo(() => generated ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generated.svg)}` : null, [generated]);

  async function generate(nextPeriods: ComparisonPeriodInput[]): Promise<void> {
    setMessage("");
    if (nextPeriods.some((period) => !period.start || !period.end || period.start > period.end)) {
      setMessage("Confira as datas: cada período precisa de início e fim, com o início antes do fim.");
      return;
    }
    try {
      const input: PeriodComparisonInput = { periods: nextPeriods, themeOrganizationId };
      const result = await window.operationsCafe.getPeriodComparison(input);
      setGenerated({ input, svg: result.svg });
      setStale(false);
    } catch (error) {
      setMessage(`Erro: ${errorMessage(error, "falha ao gerar o comparativo.")}`);
    }
  }

  // Gera ao abrir a tela e refaz quando o usuario troca de empresa, para o tema acompanhar.
  useEffect(() => {
    void generate(periodsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeOrganizationId]);

  function editPeriods(next: ComparisonPeriodInput[]): void {
    setPeriods(next);
    setStale(true);
    setMessage("");
  }

  function applyPeriods(next: ComparisonPeriodInput[]): void {
    setPeriods(next);
    void generate(next);
  }

  function applyDayRange(): void {
    const from = Number(fromDay);
    const to = Number(toDay);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 31 || from > to) {
      setMessage("Informe um intervalo de dias válido, por exemplo do dia 1 ao dia 20.");
      return;
    }
    applyPeriods(applyDayRangeToPeriods(periods, from, to));
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
    <section className="content-section period-comparison">
      <div className="period-comparison__layout">
        <aside className="period-comparison__side">
          <div className="period-comparison__section">
            <span className="period-comparison__label">Atalhos</span>
            <div className="period-comparison__presets">
              {COMPARISON_PRESETS.map((preset) => (
                <Button key={preset.id} onClick={() => applyPeriods(comparisonPresetPeriods(preset.id, todayIso()))}>{preset.label}</Button>
              ))}
            </div>
          </div>

          <div className="period-comparison__section">
            <span className="period-comparison__label">Períodos</span>
            {periods.map((period, index) => (
              <div className="period-comparison__period" key={index}>
                <label className="period-comparison__field">Período {index + 1}: de
                  <input className="ui-input" type="date" value={period.start} onChange={(event) => editPeriods(periods.map((item, position) => position === index ? { ...item, start: event.target.value } : item))} />
                </label>
                <label className="period-comparison__field">até
                  <input className="ui-input" type="date" value={period.end} onChange={(event) => editPeriods(periods.map((item, position) => position === index ? { ...item, end: event.target.value } : item))} />
                </label>
                {periods.length > MIN_PERIODS
                  ? <Button className="period-comparison__remove" aria-label={`Remover período ${index + 1}`} title="Remover período" onClick={() => editPeriods(periods.filter((_, position) => position !== index))}>×</Button>
                  : null}
              </div>
            ))}
            {periods.length < MAX_PERIODS
              ? <Button onClick={() => editPeriods([...periods, nextComparisonPeriod(periods[periods.length - 1])])}>Adicionar período</Button>
              : null}
          </div>

          <div className="period-comparison__section">
            <span className="period-comparison__label">Mesmos dias em cada mês</span>
            <div className="period-comparison__days">
              <label className="period-comparison__field">Do dia
                <input className="ui-input" type="number" min={1} max={31} value={fromDay} onChange={(event) => setFromDay(event.target.value)} />
              </label>
              <label className="period-comparison__field">Ao dia
                <input className="ui-input" type="number" min={1} max={31} value={toDay} onChange={(event) => setToDay(event.target.value)} />
              </label>
            </div>
            <Button onClick={applyDayRange}>Aplicar aos períodos</Button>
          </div>

          <div className="period-comparison__section">
            <p className="period-comparison__info">
              <strong>Todas as empresas:</strong> os dados somam {companyNames}.
              {themeOrganization ? ` As cores e o logo seguem ${themeOrganization.displayName}, a empresa selecionada no topo.` : ""}
            </p>
            <Button variant="primary" className="period-comparison__generate" onClick={() => void generate(periods)}>Gerar comparativo</Button>
            {message ? <p className="period-comparison__message" role="status">{message}</p> : null}
          </div>
        </aside>

        <div className="period-comparison__stage">
          {preview ? (
            <>
              <div className="period-comparison__toolbar">
                {stale ? <span className="period-comparison__stale">Os períodos mudaram. Clique em Gerar comparativo para atualizar.</span> : null}
                <Button onClick={() => setViewerOpen(true)}>Ampliar</Button>
                <Button disabled={stale} onClick={() => void saveImage()}>Salvar imagem</Button>
                <Button disabled={stale} onClick={() => void copyImage()}>Copiar imagem</Button>
              </div>
              <button type="button" className={`period-comparison__image-button${stale ? " period-comparison__image-button--stale" : ""}`} title="Clique para ampliar" onClick={() => setViewerOpen(true)}>
                <img src={preview} alt="Comparativo de vendas entre os períodos selecionados" />
              </button>
            </>
          ) : (
            <div className="period-comparison__empty">Escolha os períodos e clique em Gerar comparativo para ver a imagem aqui.</div>
          )}
        </div>
      </div>
      {viewerOpen && preview ? <ComparisonViewer src={preview} onClose={() => setViewerOpen(false)} /> : null}
    </section>
  );
}
