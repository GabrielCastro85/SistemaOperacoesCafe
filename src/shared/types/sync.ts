export interface SharedSyncStatus {
  pendingCount: number;
  // Gravacoes locais que ainda nao chegaram nos outros PCs (fila de reenvio
  // pendente). "Sincronizado com os outros PCs" nunca pode aparecer enquanto
  // isso for maior que zero.
  outboxPendingCount: number;
  lastSyncedAt: string | null;
  // Sessao Supabase autenticada no momento do ciclo de sync mais recente --
  // atualizado a cada 20s (ver startSharedDataSync em main/index.ts), pra
  // qualquer tela com o indicador de conexao refletir uma reconexao
  // automatica sem precisar remontar/reabrir o app.
  connected: boolean;
}
