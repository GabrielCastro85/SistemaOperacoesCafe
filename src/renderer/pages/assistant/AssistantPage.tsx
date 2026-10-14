import { useMemo, useState } from "react";
import { Alert, Button, Card, PageHeader, Textarea } from "../../design-system";

type ChatMessage = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Quais clientes ainda têm cobranças em aberto?",
  "Existe alguma cobrança vencida que precisa de atenção?",
  "Como estão as vendas e os valores a receber neste mês?",
  "O coletor está funcionando agora?"
];

export function AssistantPage({ organizationId, ownLegalEntityId }: { organizationId: string; ownLegalEntityId: string | null }): JSX.Element {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ monthInputTokens: number; monthOutputTokens: number; model: string } | null>(null);
  const canSend = Boolean(organizationId && question.trim().length >= 2 && !loading);
  const history = useMemo(() => messages.slice(-8), [messages]);

  async function send(text = question): Promise<void> {
    const clean = text.trim();
    if (!organizationId || clean.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", content: clean }]);
    setQuestion("");
    try {
      const response = await window.operationsCafe.askAssistant({
        question: clean,
        organizationId,
        ownLegalEntityId,
        history
      });
      setMessages((current) => [...current, { role: "assistant", content: response.answer }]);
      setUsage({ monthInputTokens: response.usage.monthInputTokens, monthOutputTokens: response.usage.monthOutputTokens, model: response.model });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel consultar o Assistente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="content-section assistant-page">
      <PageHeader eyebrow="Inteligência artificial" title="Assistente GrãoBase" description="Consulte cobranças, notas, financeiro e o estado do coletor usando os dados atuais do sistema." />
      <Alert tone="info">Primeira versão somente para consultas. O Assistente não altera, exclui ou confirma dados.</Alert>
      <div className="assistant-layout">
        <Card title="Conversa" eyebrow="Dados do sistema">
          <div className="assistant-messages" aria-live="polite">
            {messages.length === 0 ? (
              <div className="assistant-empty">
                <strong>O que você quer verificar?</strong>
                <p>Escolha uma sugestão ou escreva sua pergunta.</p>
              </div>
            ) : messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`assistant-message assistant-message--${message.role}`}>
                <span>{message.role === "user" ? "Você" : "Assistente"}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {loading ? <div className="assistant-thinking"><span className="ui-spinner" /> Consultando os dados atuais...</div> : null}
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="assistant-composer">
            <Textarea
              label="Pergunte ao Assistente"
              value={question}
              rows={3}
              maxLength={2000}
              placeholder="Ex.: quais cobranças estão vencidas e qual é o valor total?"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canSend) void send();
                }
              }}
            />
            <Button variant="primary" onClick={() => void send()} loading={loading} disabled={!canSend}>Enviar pergunta</Button>
          </div>
        </Card>
        <aside className="assistant-sidebar">
          <Card title="Perguntas rápidas">
            <div className="assistant-suggestions">
              {suggestions.map((suggestion) => <Button key={suggestion} onClick={() => void send(suggestion)} disabled={loading}>{suggestion}</Button>)}
            </div>
          </Card>
          <Card title="Uso neste mês" eyebrow="Controle de custo">
            <p>{usage ? `${(usage.monthInputTokens + usage.monthOutputTokens).toLocaleString("pt-BR")} tokens processados` : "Nenhuma consulta nesta sessão."}</p>
            <small>{usage ? `Modelo: ${usage.model}` : "O projeto tem teto mensal de US$ 5 configurado na OpenAI."}</small>
          </Card>
        </aside>
      </div>
    </section>
  );
}
