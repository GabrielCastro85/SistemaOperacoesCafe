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

## Financeiro Gerencial Interno

Contas a pagar foram modeladas separadamente da conta-corrente de clientes. Essa decisao evita misturar contas a receber e despesas internas, mas permite um dashboard projetado que calcula recebimentos previstos menos pagamentos previstos.

## Centro De Custo Separado De Local

`Location` continua representando lugar fisico. `CostCenter` representa atribuicao gerencial do custo, podendo apontar para local e CNPJ proprio, mas tambem existir como Administrativo, Diretoria ou Fiscal.

## Parcelas E Centavos

Parcelamentos dividem o valor total em centavos inteiros. Qualquer diferenca e aplicada de forma deterministica na ultima parcela, garantindo que a soma das parcelas seja exatamente igual ao total informado.

## Anexos Financeiros Por ID

Anexos sao copiados para pasta interna e abertos por ID, nao por caminho enviado pelo renderer. Essa decisao reduz risco de path traversal e mantem o app independente do arquivo original escolhido pelo usuario.

## Relatorios Gerenciais Versionados

Cada PDF ou Excel financeiro gera uma nova entrada em `financial_report_generations`. Relatorios nao sao sobrescritos silenciosamente; filtros e hash ficam registrados para auditoria local.

## Confirmacao Como Documento Operacional

Confirmacao de negocio foi modelada fora de cobrancas e fora de contas a pagar. Ela referencia operacoes e notas quando existirem, mas tambem aceita rascunho manual para negocios que ainda nao nasceram de documento fiscal.

## Snapshots Em Confirmacoes

Participantes e itens salvam snapshots JSON. Essa decisao protege documentos emitidos contra mudancas futuras em parceiros, CNPJs, produtos ou regras comerciais.

## Assinatura Externa Arquivada

PDF assinado externamente e copiado para pasta interna e versionado com hash. A etapa registra o documento e seu status operacional, mas nao tenta validar certificado digital; isso evita uma falsa sensacao de validade juridica enquanto a infraestrutura criptografica completa nao existir.

## Refatoracao Visual Incremental

A etapa 10 separou o boot do renderer, layout, navegacao, tema e componentes sem reescrever regras de negocio. Ao fim da etapa, todos os modulos foram migrados para paginas diretas por dominio e o workspace funcional antigo foi removido.

## Logos No Public Do Vite

As logos padrao foram colocadas em `public/assets/branding` porque arquivos em `public` sao copiados para o build do renderer. A pasta `assets/branding` continua documentada para material-fonte e substituicoes locais.

## Pacote `.cafebackup`

Backups usam formato proprio com magic bytes, manifesto JSON e payload gzip. A escolha evita expor compactador generico ao renderer e permite validar estrutura, hashes e paths antes de qualquer restauracao.

## Snapshot SQLite

O banco nao e copiado diretamente enquanto aberto. O snapshot usa `better-sqlite3.backup()` e depois `PRAGMA quick_check`, hash SHA-256 e manifesto.

## Criptografia De Backup

Quando ativada, a criptografia protege o payload do pacote com AES-256-GCM e chave derivada por `scrypt`. A senha nao e persistida; isso reduz risco local, mas torna impossivel recuperar backup criptografado sem a senha.

## Retencao Conservadora

Retencao automatica atua sobre backups nao protegidos. Documentos oficiais e historicos permanecem com retencao indefinida por padrao porque prazos fiscais e legais devem ser definidos pela empresa e contabilidade.
