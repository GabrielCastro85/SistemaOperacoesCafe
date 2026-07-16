# Seguranca Dos Dados

Dados persistentes ficam fora da pasta de instalacao, dentro de `app.getPath("userData")`.

Estrutura prevista: `database/`, `documents/invoices`, `documents/confirmations`, `documents/charges`, `documents/attachments`, `documents/signed`, `backups/`, `logs/` e `settings/`.

Atualizacoes manuais nao devem substituir `userData`. Migrations sao executadas automaticamente e nunca recriam o banco se ele ja existir.

Backups completos ainda nao foram implementados. Risco atual: backups dependem de processo manual ate a etapa dedicada.

Arquivos de branding selecionados pelo usuario sao copiados para `userData/settings/branding/<organization-id>/`. O app nao depende do caminho original escolhido e nao grava imagens em Base64 no banco.

Parceiros, produtos, perfis e regras sao armazenados no mesmo SQLite local e participam das migrations automaticas. Nenhum dado novo depende de internet ou servico externo.
