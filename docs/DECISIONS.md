# Decisoes Tecnicas

## SQLite

Escolha: `better-sqlite3`.

Justificativa: biblioteca madura, local, transacional, sincronizada, sem servidor, compativel com Electron mediante empacotamento de modulo nativo e sem dependencia de servicos pagos.

Alternativas consideradas: `sqlite3`, que usa API callback/async mais verbosa; ORMs completos, que aumentariam complexidade antes das regras de negocio.

## IDs

Escolha: UUID v4 com `crypto.randomUUID()`. Funciona offline, dispensa servidor central e e suficiente para dados locais com futuras exportacoes.

## Migrations

Escolha: mecanismo proprio simples com `migration_history`. A etapa inicial precisa de controle previsivel e audivel sem introduzir framework extra.

## CNPJ E Rascunho

Foi adicionado `legal_entities.is_draft` para permitir preservar dados demonstrativos sem CNPJ real. Novos cadastros ativos exigem CNPJ valido, normalizado somente com numeros.

## Branding Local

Logos sao copiadas para `userData/settings/branding/<organization-id>/`. Essa decisao evita dependencia do caminho original e mantem atualizacoes do aplicativo independentes dos dados locais.

## Parceiro Comercial Unico

Foi criada a entidade `BusinessPartner` com papeis multiplos para evitar duplicacao entre cliente, comprador, vendedor, fornecedor e destino.

## Dinheiro Em Centavos

Regras por saca armazenam valores em centavos inteiros. Isso evita erro de ponto flutuante e prepara calculos futuros.

## Resolucao De Regra

O resolvedor ordena por especificidade: CNPJ proprio, produto, tipo de operacao e prioridade. Empates igualmente especificos retornam conflito.

## Decimais Operacionais

Quantidades e precos comerciais usam texto decimal normalizado com escala maxima de 6 casas. Isso evita `REAL`/ponto flutuante em dados operacionais. Valores financeiros calculados continuam em centavos inteiros.

## Notas Manuais Antes Do XML

Notas manuais foram criadas antes da importacao XML para validar o dominio de operacoes, itens, cliente responsavel, duplicidade e regras por saca sem depender de arquivos externos.

## Importacao Excel Local

Escolha: `exceljs` para `.xlsx`.

Justificativa: biblioteca local, sem servico externo, capaz de ler abas, cabecalhos, celulas formatadas e datas dentro do processo principal do Electron. Nesta etapa foram excluidos XML, PDF e cobrancas para manter o escopo focado em historico tabular.

## Jobs De Importacao

Cada carga cria um job e linhas de importacao. Essa decisao permite processamento parcial, diagnostico por linha, auditoria do arquivo usado e reversao logica sem apagar registros do banco.

## Parser XML

Escolha: `fast-xml-parser`.

Justificativa: biblioteca local, gratuita, sem execucao de codigo, compativel com Electron/Windows e suficiente para NF-e com namespaces. O app ainda aplica uma camada propria de seguranca antes do parse: limite de 10 MB por XML, bloqueio de DTD/DOCTYPE, bloqueio de entidades, rejeicao de XML malformado e limite de profundidade.

Alternativas consideradas: parsers DOM completos trariam mais superficie e dependencia; validacao XSD completa fica para etapa futura porque exigiria gestao ampla de schemas e nao substitui a validacao de negocio.

## XML Como Complemento Fiscal

XML nao cria um segundo modelo de nota. Ele preenche ou mescla dados em `fiscal_documents`, cria `fiscal_document_items`, usa `operations` quando ha resolucao suficiente e registra eventos em `fiscal_document_events`. Cliente interno, classificacao e valor de servico continuam sendo dados operacionais do sistema, nao campos sobrescritos automaticamente pelo XML.

## Reserva De Operacoes Para Cobranca

Operacoes confirmadas entram em uma cobranca primeiro como reserva. Essa decisao evita cobrar a mesma operacao em dois rascunhos simultaneos e ainda permite cancelar o rascunho sem apagar historico.

## Conta-corrente Do Cliente

Adiantamentos, creditos, cobrancas e pagamentos usam um livro auxiliar em `client_ledger_entries`, com efeito separado do tipo de lancamento. Isso permite mostrar saldo disponivel, alocar creditos e reconciliar pagamentos sem recalcular historico a partir de textos livres.

## Documentos De Cobranca Locais

PDF, Excel e imagem sao gerados localmente e versionados. O banco salva caminhos e hash do PDF, enquanto a cobranca emitida salva snapshot JSON para que documentos futuros possam ser reemitidos com os mesmos dados operacionais.
