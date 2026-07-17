# Seguranca Dos Dados

Dados persistentes ficam fora da pasta de instalacao, dentro de `app.getPath("userData")`.

Estrutura prevista: `database/`, `documents/invoices`, `documents/confirmations`, `documents/charges`, `documents/attachments`, `documents/signed`, `backups/`, `logs/` e `settings/`.

Atualizacoes manuais nao devem substituir `userData`. Migrations sao executadas automaticamente e nunca recriam o banco se ele ja existir.

Backups completos foram implementados na etapa 12. O pacote `.cafebackup` inclui snapshot consistente do banco, documentos copiados para `userData`, branding, manifesto e hashes. Backups comuns sao sensiveis porque contem dados do banco.

Backups criptografados usam AES-256-GCM com chave derivada por `scrypt`. A senha nao e salva; se for esquecida, nao ha recuperacao.

Backup interno nao protege contra perda total do disco. Backups importantes devem ser copiados para outro dispositivo. O app nao envia backups para nuvem nem executa backup quando fechado.

Arquivos de branding selecionados pelo usuario sao copiados para `userData/settings/branding/<organization-id>/`. O app nao depende do caminho original escolhido e nao grava imagens em Base64 no banco.

Parceiros, produtos, perfis e regras sao armazenados no mesmo SQLite local e participam das migrations automaticas. Nenhum dado novo depende de internet ou servico externo.

Notas e operacoes manuais tambem sao locais. Confirmacao e cancelamento sao logicos por status; os registros nao sao apagados.

Planilhas importadas sao copiadas para `userData/documents/spreadsheet-imports/<job-id>/`. O sistema salva jobs e linhas no SQLite para auditoria e permite reversao logica; arquivos originais fora do app nao sao usados depois da copia.

XMLs de NF-e importados sao validados no processo principal e copiados para `userData/documents/invoices/xml-imports/<job-id>/`. O nome interno e derivado de chave validada ou hash, evitando path traversal e dependencia do nome original. O hash SHA-256 e salvo para auditoria e duplicidade.

O parser rejeita XML vazio, maior que 10 MB, malformado, com DTD/DOCTYPE, entidades ou referencias externas. A leitura e offline e nao consulta a SEFAZ; o protocolo lido e apenas o que esta contido no arquivo.

Cobrancas geradas ficam em `userData/documents/charges/<charge-id>/`, com PDF, planilha Excel e imagem resumida. A cobranca emitida guarda snapshot JSON dos dados usados na emissao e versiona documentos para preservar historico mesmo quando cadastros mudarem depois.

Cancelamentos e substituicoes sao logicos. Operacoes reservadas por rascunho podem ser liberadas; cobrancas emitidas canceladas mantem trilha em `charge_status_history`, lancamentos de conta-corrente e documentos ja gerados.

Contas a pagar, pagamentos e rateios sao locais no SQLite. Cancelamento de conta ou pagamento e logico, com motivo e historico em `payable_status_history`. Anexos financeiros possuem tabela propria para caminho interno, hash, tamanho e tipo; a copia segura de arquivos ainda deve evoluir para um fluxo visual completo.

O modulo financeiro nao armazena senha, token bancario, credencial, nem numero completo de conta quando nao necessario. Identificadores de contas financeiras devem ser mascarados ou descritivos.

Anexos financeiros aceitam PDF, PNG, JPG, JPEG e WebP ate 15 MB. O processo principal valida existencia, tamanho e extensao, calcula SHA-256 e copia o arquivo para `userData/documents/accounts-payable/<organization>/<cnpj>/<conta>/...`. A interface abre anexos e relatorios somente por ID interno; caminhos arbitrarios do renderer nao sao aceitos para abertura.

Relatorios financeiros sao gerados localmente em `userData/documents/financial-reports/<organization>/<cnpj-ou-all>/<ano>/<report-id>/`, sem sobrescrever geracoes anteriores.

Confirmacoes de negocio sao armazenadas no SQLite local e seus documentos ficam em `userData/documents/confirmations/<organization>/<cnpj>/<confirmacao>/`. O renderer seleciona PDF assinado por dialog do processo principal e recebe apenas token temporario; a copia, o hash SHA-256 e o registro da versao ocorrem no backend.

PDF assinado externamente e arquivado para auditoria, mas o sistema nao confere certificado, cadeia ICP-Brasil, carimbo do tempo ou validade criptografica da assinatura nesta etapa.

Antes de restaurar, o app valida magic bytes, manifesto, hashes, banco e compatibilidade. A restauracao cria backup pre-restauracao protegido, expira sessoes locais e registra auditoria.
