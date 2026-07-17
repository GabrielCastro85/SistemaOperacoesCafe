# Atualizacao

1. Abra o aplicativo atual.
2. Gere um backup completo em Configuracoes > Backups.
3. Feche o aplicativo.
4. Instale a nova versao da mesma variante.
5. Abra o aplicativo e verifique Configuracoes > Sobre.
6. Execute Configuracoes > Integridade.

Nao misture instaladores de variantes diferentes para atualizar a mesma base. Villa Coffee, Grao & Grao e multiempresa usam `userData` separados.

Se uma atualizacao falhar, restaure o backup `.cafebackup` pela tela Configuracoes > Restaurar.

Para promover `1.0.0-rc.1` a stable, valide a atualizacao 0.13.0 -> 1.0.0 em ambiente isolado com dados de teste representativos.
