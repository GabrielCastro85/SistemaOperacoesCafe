import { useMemo, useState } from "react";
import { apiJson, queryString } from "./api";
import { PageHeader } from "./renderer/design-system/components/PageHeader";
import { Card } from "./renderer/design-system/components/Card";
import { Button } from "./renderer/design-system/components/Button";
import { Alert } from "./renderer/design-system/components/Alert";

interface AssistantMessage { role: "user" | "assistant"; content: string }
interface AssistantResponse { answer: string; model: string; usage: { inputTokens: number; outputTokens: number; monthInputTokens: number; monthOutputTokens: number } }

function currentPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const local = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { periodStart: local(new Date(now.getFullYear(), now.getMonth(), 1)), periodEnd: local(now) };
}

export function AssistantTab({ organizationId, legalEntityId }: { organizationId: string; legalEntityId?: string }): JSX.Element {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<AssistantResponse["usage"] | null>(null);
  const quickQuestions = useMemo(() => [
    "Quais cobranças estão vencidas e qual é o valor total?",
    "Como estão as vendas e os valores a receber neste mês?",
    "Quais contas a pagar precisam de atenção?"
  ], []);

  async function ask(text = question): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setQuestion("");
    try {
      const period = currentPeriod();
      const scope = queryString({ organizationId, legalEntityId, ...period });
      const [dashboard, openCharges, openPayables, financial] = await Promise.all([
        apiJson(`/v1/viewer/dashboard?${scope}`),
        apiJson(`/v1/viewer/charges?${scope}&status=OPEN`),
        apiJson(`/v1/viewer/payables?${queryString({ organizationId, legalEntityId })}`),
        apiJson(`/v1/viewer/finance?${queryString({ organizationId, legalEntityId })}`)
      ]);
      const response = await apiJson<AssistantResponse>("/v1/assistant/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history: messages.slice(-8), context: { generatedAt: new Date().toISOString(), period, operational: dashboard, billing: dashboard, financial, openCharges, openPayables } })
      });
      setMessages((current) => [...current, { role: "user", content: trimmed }, { role: "assistant", content: response.answer }]);
      setUsage(response.usage);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Não foi possível consultar o Assistente.");
    } finally { setLoading(false); }
  }

  return <>
    <PageHeader eyebrow="Inteligência artificial" title="Assistente GrãoBase" description="Consulte cobranças, notas e financeiro usando os dados atuais do sistema." />
    <Alert tone="info" title="Consulta segura">O Assistente apenas consulta: ele não altera, exclui nem confirma dados.</Alert>
    {error ? <Alert tone="danger" title="Falha ao consultar o Assistente">{error}</Alert> : null}
    <Card eyebrow="Dados do sistema" title="Conversa">
      <div className="viewer-card-grid">{messages.map((message, index) => <Card key={`${message.role}-${index}`} eyebrow={message.role === "user" ? "Você" : "Assistente"}>
        <div className="viewer-assistant-answer">{message.content.split("\n").map((line, lineIndex) => <p key={lineIndex}>{line || "\u00a0"}</p>)}</div>
      </Card>)}</div>
      <label className="viewer-field"><span>Pergunte ao Assistente</span><textarea className="ui-input" rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ex.: quais cobranças estão vencidas e qual é o valor total?" /></label>
      <Button variant="primary" disabled={!question.trim() || loading} onClick={() => void ask()}>{loading ? "Consultando..." : "Enviar pergunta"}</Button>
    </Card>
    <Card title="Perguntas rápidas"><div className="viewer-chip-row">{quickQuestions.map((item) => <Button key={item} variant="secondary" onClick={() => void ask(item)} disabled={loading}>{item}</Button>)}</div></Card>
    {usage ? <Card eyebrow="Controle de custo" title="Uso nesta consulta"><p className="viewer-card-line">{(usage.inputTokens + usage.outputTokens).toLocaleString("pt-BR")} tokens nesta resposta · {(usage.monthInputTokens + usage.monthOutputTokens).toLocaleString("pt-BR")} no mês</p></Card> : null}
  </>;
}
