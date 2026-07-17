# Seguranca Dos Dados

Dados persistentes ficam fora da pasta de instalacao, dentro de `app.getPath("userData")`.

Estrutura prevista: `database/`, `documents/invoices`, `documents/confirmations`, `documents/charges`, `documents/attachments`, `documents/signed`, `backups/`, `logs/` e `settings/`.

Atualizacoes manuais nao devem substituir `userData`. Migrations sao executadas automaticamente e nunca recriam o banco se ele ja existir.

Backups completos ainda nao foram implementados. Risco atual: backups dependem de processo manual ate a etapa dedicada.

Arquivos de branding selecionados pelo usuario sao copiados para `userData/settings/branding/<organization-id>/`. O app nao depende do caminho original escolhido e nao grava imagens em Base64 no banco.

Parceiros, produtos, perfis e regras sao armazenados no mesmo SQLite local e participam das migrations automaticas. Nenhum dado novo depende de internet ou servico externo.

Notas e operacoes manuais tambem sao locais. Confirmacao e cancelamento sao logicos por status; os registros nao sao apagados.

Planilhas importadas sao copiadas para `userData/documents/spreadsheet-imports/<job-id>/`. O sistema salva jobs e linhas no SQLite para auditoria e permite reversao logica; arquivos originais fora do app nao sao usados depois da copia.

XMLs de NF-e importados sao validados no processo principal e copiados para `userData/documents/invoices/xml-imports/<job-id>/`. O nome interno e derivado de chave validada ou hash, evitando path traversal e dependencia do nome original. O hash SHA-256 e salvo para auditoria e duplicidade.

O parser rejeita XML vazio, maior que 10 MB, malformado, com DTD/DOCTYPE, entidades ou referencias externas. A leitura e offline e nao consulta a SEFAZ; o protocolo lido e apenas o que esta contido no arquivo.

Cobrancas geradas ficam em `userData/documents/charges/<charge-id>/`, com PDF, planilha Excel e imagem resumida. A cobranca emitida guarda snapshot JSON dos dados usados na emissao e versiona documentos para preservar historico mesmo quando cadastros mudarem depois.

Cancelamentos e substituicoes sao logicos. Operacoes reservadas por rascunho podem ser liberadas; cobrancas emitidas canceladas mantem trilha em `charge_status_history`, lancamentos de conta-corrente e documentos ja gerados.
