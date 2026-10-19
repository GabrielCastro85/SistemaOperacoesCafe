import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Card, PageHeader, Textarea } from "../../design-system";

type ChatMessage = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Quais clientes ainda têm cobranças em aberto?",
  "Existe alguma cobrança vencida que precisa de atenção?",
  "Como estão as vendas e os valores a receber neste mês?",
  "O coletor está funcionando agora?"
];

function renderInlineMarkdown(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function AssistantMessageContent({ content }: { content: string }): JSX.Element {
  const normalized = content
    .replace(/\s+-\s+(?=\*\*)/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const blocks = normalized.split(/\n\s*\n/);

  return (
    <div className="assistant-message__content">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const isList = lines.length > 0 && lines.every((line) => /^[-•]\s+/.test(line));
        if (isList) {
          return (
            <ul key={`list-${blockIndex}`}>
              {lines.map((line, lineIndex) => <li key={`${line}-${lineIndex}`}>{renderInlineMarkdown(line.replace(/^[-•]\s+/, ""))}</li>)}
            </ul>
          );
        }
        return <p key={`paragraph-${blockIndex}`}>{lines.map((line, lineIndex) => <Fragment key={`${line}-${lineIndex}`}>{lineIndex ? <br /> : null}{renderInlineMarkdown(line)}</Fragment>)}</p>;
      })}
    </div>
  );
}

export function AssistantPage({ organizationId, ownLegalEntityId }: { organizationId: string; ownLegalEntityId: string | null }): JSX.Element {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ monthInputTokens: number; monthOutputTokens: number; model: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const canSend = Boolean(organizationId && question.trim().length >= 2 && !loading);
  const history = useMemo(() => messages.slice(-8), [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  async function send(text = question, options?: { retry?: boolean }): Promise<void> {
    const clean = text.trim();
    if (!organizationId || clean.length < 2 || loading) return;
    const requestHistory = options?.retry ? messages.slice(0, -1).slice(-8) : history;
    setLoading(true);
    setError(null);
    setLastFailedQuestion(null);
    if (!options?.retry) setMessages((current) => [...current, { role: "user", content: clean }]);
    setQuestion("");
    try {
      const response = await window.operationsCafe.askAssistant({
        question: clean,
        organizationId,
        ownLegalEntityId,
        history: requestHistory
      });
      setMessages((current) => [...current, { role: "assistant", content: response.answer }]);
      setUsage({ monthInputTokens: response.usage.monthInputTokens, monthOutputTokens: response.usage.monthOutputTokens, model: response.model });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel consultar o Assistente.");
      setLastFailedQuestion(clean);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="content-section assistant-page">
      <PageHeader eyebrow="Inteligência artificial" title="Assistente GrãoBase" description="Consulte cobranças, notas, financeiro e o estado do coletor usando os dados atuais do sistema." />
      <Alert tone="info">Modo de consulta: o Assistente usa os dados atuais do sistema e não altera, exclui ou confirma registros.</Alert>
      <div className="assistant-layout">
        <div className="assistant-conversation-card">
          <Card
            title="Conversa"
            eyebrow="Dados do sistema"
            actions={messages.length ? <Button variant="ghost" onClick={() => { setMessages([]); setError(null); setLastFailedQuestion(null); }}>Limpar conversa</Button> : null}
          >
            <div className="assistant-messages" aria-live="polite">
              {messages.length === 0 ? (
                <div className="assistant-empty">
                  <span className="assistant-empty__mark" aria-hidden="true">✦</span>
                  <strong>O que você quer verificar?</strong>
                  <p>Escolha uma pergunta rápida ou escreva com suas palavras.</p>
                </div>
              ) : messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={`assistant-message assistant-message--${message.role}`}>
                  <div className="assistant-message__author">
                    <span className="assistant-message__avatar" aria-hidden="true">{message.role === "user" ? "V" : "G"}</span>
                    <span>{message.role === "user" ? "Você" : "Assistente GrãoBase"}</span>
                  </div>
                  <AssistantMessageContent content={message.content} />
                </article>
              ))}
              {loading ? <div className="assistant-thinking"><span className="ui-spinner" /> Consultando os dados atuais...</div> : null}
              <div ref={messagesEndRef} />
            </div>
            {error ? (
              <div className="assistant-error">
                <Alert tone="danger">{error}</Alert>
                {lastFailedQuestion ? <Button onClick={() => void send(lastFailedQuestion, { retry: true })} disabled={loading}>Tentar novamente</Button> : null}
              </div>
            ) : null}
            <div className="assistant-composer">
              <Textarea
                label="Pergunte ao Assistente"
                hint="Enter envia · Shift + Enter cria uma nova linha"
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
        </div>
        <aside className="assistant-sidebar">
          <Card title="Perguntas rápidas" eyebrow="Atalhos">
            <div className="assistant-suggestions">
              {suggestions.map((suggestion, index) => <Button key={suggestion} onClick={() => void send(suggestion)} disabled={loading}><span className="assistant-suggestion__number">{index + 1}</span>{suggestion}</Button>)}
            </div>
          </Card>
          <Card title="Uso neste mês" eyebrow="Controle de custo">
            <div className="assistant-usage">
              <strong>{usage ? (usage.monthInputTokens + usage.monthOutputTokens).toLocaleString("pt-BR") : "0"}</strong>
              <span>tokens processados no mês</span>
              <small>{usage ? `Modelo: ${usage.model}` : "O uso aparecerá após a primeira consulta desta sessão."}</small>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}
