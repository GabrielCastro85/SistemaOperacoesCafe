import { createContext, useContext } from "react";

// Grupo (organizationId) e Empresa/CNPJ (legalEntityId) selecionados no topo do
// app -- os componentes de cada aba usam isso pra filtrar o que buscam do
// Supabase, em vez de mostrar tudo misturado de Villa e Grao & Grao juntos.
export interface ActiveContextValue {
  organizationId: string;
  legalEntityId: string;
}

export const ActiveContext = createContext<ActiveContextValue>({ organizationId: "", legalEntityId: "" });

export function useActiveContext(): ActiveContextValue {
  return useContext(ActiveContext);
}
