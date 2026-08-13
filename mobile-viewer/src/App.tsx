import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { ChargesTab } from "./ChargesTab";
import { ConfirmationsTab } from "./ConfirmationsTab";

type Tab = "charges" | "confirmations";

export function App(): JSX.Element {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("charges");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="centered-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Operações Café</h1>
        <button className="link-button" onClick={() => void supabase.auth.signOut()}>
          Sair
        </button>
      </header>
      <nav className="tabs">
        <button className={tab === "charges" ? "tab tab--active" : "tab"} onClick={() => setTab("charges")}>
          Cobranças
        </button>
        <button className={tab === "confirmations" ? "tab tab--active" : "tab"} onClick={() => setTab("confirmations")}>
          Confirmações
        </button>
      </nav>
      <main>{tab === "charges" ? <ChargesTab /> : <ConfirmationsTab />}</main>
    </div>
  );
}

function LoginScreen(): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("E-mail ou senha incorretos.");
    setLoading(false);
  }

  return (
    <div className="centered-screen">
      <div className="login-card">
        <h1>Operações Café</h1>
        <p className="subtitle">Consulta de cobranças e confirmações</p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label>
            E-mail
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
