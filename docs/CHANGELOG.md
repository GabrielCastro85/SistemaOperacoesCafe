# Changelog

## 1.0.0-rc.1

- Criado release candidate de homologacao da primeira versao.
- Mantida a ultima migration em `013_backups_integrity`.
- Adicionados scripts `homologation:check`, `security:review`, `migrations:check` e `performance:baseline`.
- Criados manual do usuario, guia rapido, checklist diario, teste de aceite, checklist de release, controle de defeitos, revisao de seguranca e relatorio de homologacao.
- Documentado bloqueio de promocao para `1.0.0` ate validacoes manuais de instalacao limpa, atualizacao, operacao multiempresa e aceite.
- Consolidado release oficial em instalador unico com `signed: false` quando nao houver certificado Authenticode.
- Adicionada migration `016_unified_company_context` para app unico multiempresa, escolha de unidade/CNPJ na entrada e acesso operacional total para usuarios logados.
- Adicionada migration `017_real_company_legal_entities` para cadastrar os CNPJs reais de Villa Coffee MG/ES e Grao & Grao MG/SP.
- Adicionada migration `018_legal_entity_confirmation_defaults` para preencher automaticamente banco/PIX nos fechamentos e atualizar inscricoes estaduais conferidas nos PDFs de referencia.

## 0.13.0

- Adicionada fundacao de distribuicao Windows profissional.
- Criadas configuracoes oficiais para Villa Coffee, Grao & Grao e multiempresa.
- Adicionados App IDs, nomes de produto, executaveis, icones `.ico` e isolamento de `userData` por variante.
- Adicionados scripts de empacotamento, instalador NSIS, manifestos de release, notas e checksums SHA-256.
- Adicionada tela Configuracoes > Sobre com metadados de distribuicao e status de assinatura.
- Reforcado hardening do processo principal com janela unica, bloqueio de novas janelas, navegacao restrita e permissao negada por padrao.
- Adicionados guias de instalacao, atualizacao, desinstalacao, release, assinatura e variantes.
- Adicionados testes de variantes, metadados, icones e documentacao de release.

## 0.12.0

- Adicionada migration `013_backups_integrity`.
- Criadas tabelas de backups, arquivos de backup, configuracoes, restauracoes, verificacoes e findings.
- Adicionado pacote `.cafebackup` com magic bytes, manifesto, hashes e payload gzip.
- Adicionado snapshot consistente via `better-sqlite3.backup()` e `PRAGMA quick_check`.
- Adicionada criptografia opcional AES-256-GCM com chave derivada por `scrypt`.
- Adicionados backups manual, automatico pendente, retencao, protecao e verificacao.
- Adicionados fluxos de restauracao com validacao, backup pre-restauracao e expiracao de sessoes.
- Adicionadas verificacoes de integridade de banco, documentos, orfaos e relatorio JSON.
- Adicionados IPCs, preload, permissoes, auditoria e telas administrativas.
- Ampliados testes para 58 casos em 15 arquivos.

## 0.11.0

- Adicionada migration `012_users_permissions_audit`.
- Criadas tabelas de usuarios, credenciais, roles, permissoes, atribuicoes, escopo por CNPJ, sessoes locais e auditoria.
- Adicionado bootstrap do primeiro administrador sem senha padrao.
- Adicionado hash de senha com `crypto.scrypt`, salt aleatorio, formato versionado e comparacao segura.
- Adicionados lock, unlock, logout, troca de usuario e sessao mantida no processo principal.
- Adicionada politica IPC deny-by-default com testes de cobertura para todos os canais.
- Adicionadas telas `LoginPage`, `LockScreen`, Usuarios, Roles, Auditoria e Acesso negado.
- Adicionada auditoria com sanitizacao e hash chain.

## 0.1.0

- Criada fundacao Electron, React, TypeScript e Vite.
- Adicionado SQLite local com migrations e seeds demonstrativos.
- Adicionado perfil de instalacao e variantes de branding.
- Criadas telas de splash, setup, shell, diagnostico e placeholders.
- Criada documentacao inicial do produto, dominio, arquitetura, banco, dados, branding e roadmap.
- Validado `lint`, `typecheck`, `test:run`, `build` e `package` em modo diretorio.

## 0.2.0

- Adicionada migration `003_admin_modules`.
- Criadas telas administrativas para organizacoes, empresas/CNPJs, locais, identidade visual e perfil da instalacao.
- Adicionadas regras de variante no processo principal.
- Adicionada validacao de CNPJ e suporte a rascunho de pessoa juridica.
- Adicionado fluxo seguro de branding com copia para `userData/settings/branding`.
- Ampliados testes de banco, servicos administrativos, restricoes e branding.

## 0.3.0

- Adicionada migration `004_partners_products_billing`.
- Criados cadastros de parceiros comerciais, papeis, estabelecimentos, contatos e produtos.
- Criados perfis de cobranca para clientes.
- Criadas regras de valor por saca com dinheiro em centavos, vigencia, prioridade e escopo interno/externo.
- Criado resolvedor de regra aplicavel para futuras operacoes.
- Adicionadas telas em Clientes e Cobrancas.
- Ampliados testes para parceiros, produtos, cobranca e resolvedor.

## 0.4.0

- Adicionada migration `005_manual_invoices_operations`.
- Criadas tabelas de notas fiscais manuais, itens e operacoes.
- Adicionada estrategia decimal exata para quantidades, sacas e precos comerciais.
- Adicionado cadastro manual de nota com itens e multiplas operacoes.
- Adicionada aplicacao automatica de regra por saca, override manual com motivo e calculo de servico.
- Adicionadas pendencias, confirmacao, cancelamento e alertas de duplicidade.
- Adicionada tela de Notas e operacoes com indicadores basicos.
- Ampliados testes para notas manuais e operacoes.

## 0.5.0

- Adicionada migration `006_spreadsheet_imports`.
- Criadas tabelas de modelos de mapeamento, jobs de importacao, linhas importadas e aliases de parceiros.
- Adicionada importacao local de planilhas `.xlsx` com `exceljs`.
- Adicionados tokens temporarios de arquivo, previa de abas, sugestao de mapeamento e validacao por linha.
- Adicionado processamento parcial com agrupamento de linhas na mesma nota, origem `SPREADSHEET` e copia do arquivo para `userData`.
- Adicionada reversao logica de importacoes e aliases para nomes historicos de clientes.
- Ampliados testes para leitura de Excel, jobs, agrupamento, calculo por saca e reversao.

## 0.6.0

- Adicionada migration `007_xml_imports`.
- Adicionada importacao local/offline de XMLs NF-e com `fast-xml-parser`.
- Criados jobs e arquivos XML com hash SHA-256, fila, status, resolucao e historico.
- Adicionados eventos fiscais para cancelamento, carta de correcao e outros eventos.
- Adicionados aliases de produto, regras de classificacao operacional e historico de mesclagem.
- Adicionados campos XML/protocolo/snapshot em notas e origem `XML` em notas e operacoes.
- Adicionada tela de importacao XML em Notas e operacoes com selecao individual, multipla e pasta.
- Adicionadas validacoes contra DTD, entidades externas, XML malformado, tamanho excessivo e chave invalida.
- Ampliados testes para parser, chave, importacao, eventos, mesclagem e migration.

## 0.7.0

- Adicionada migration `008_client_charges_ledger`.
- Criadas cobrancas por periodo com rascunho, reserva de operacoes, envio para conferencia, emissao, cancelamento e historico de status.
- Criada conta-corrente do cliente com adiantamentos, creditos, aplicacao de creditos, pagamentos e alocacoes parciais.
- Adicionados snapshots de cobranca, numeracao sequencial por CNPJ/ano e versoes de documentos.
- Adicionada geracao local de PDF, Excel e imagem de resumo da cobranca.
- Adicionadas telas de Cobrancas e Conta-corrente, alem de indicadores de cobranca no Dashboard.
- Ampliados testes para periodo, reserva, credito, emissao de documentos, pagamento parcial e liberacao de operacao.

## 0.8.0

- Adicionada migration `009_accounts_payable`.
- Criado modulo Financeiro com visao geral, contas a pagar, cadastros, recorrencias, parcelamentos e pagamentos.
- Criadas categorias de despesa idempotentes, centros de custo e contas financeiras.
- Criadas contas a pagar manuais com competencia, vencimento, valores em centavos, status e historico.
- Adicionados rateios por centro/local, recorrencias mensais e parcelamentos com divisao exata de centavos.
- Adicionados pagamentos de contas com alocacao parcial ou total e recalculo automatico de saldo/status.
- Adicionado dashboard financeiro com totais a pagar, pagos, vencidos, proximos vencimentos e fluxo projetado.
- Adicionada migration `010_financial_attachments_reports`.
- Adicionados anexos de contas, comprovantes de pagamento, copia interna, hash SHA-256 e abertura segura por ID.
- Adicionados relatorios financeiros gerenciais em PDF e Excel, historico de geracao e armazenamento versionado.
- Ampliados testes para financeiro, migration, categorias, centros, contas financeiras, contas a pagar, recorrencias, parcelas e pagamentos.

## 0.9.0

- Adicionada migration `011_deal_confirmations`.
- Criado modulo de Confirmacoes de negocio com criacao manual, por operacoes e por notas fiscais.
- Criadas tabelas de templates, clausulas, confirmacoes, participantes, itens, vinculos, pagamentos, signatarios, versoes de documento e historico de status.
- Adicionados decimais exatos para quantidades e precos comerciais com mais de duas casas.
- Adicionadas previa, emissao numerada, PDF local, hash SHA-256, importacao de PDF assinado externamente, cancelamento e substituicao.
- Adicionadas telas de listagem, detalhes, templates, clausulas, relatorios e indicadores.
- Adicionados IPCs e testes para confirmacoes, documentos, assinaturas, relatorios e isolamento multiempresa.

## 0.10.0

- Iniciada refatoracao profissional do frontend.
- Reduzido `src/renderer/App.tsx` para ponto de montagem React.
- Criadas estruturas `app`, `layouts`, `design-system`, `components`, `hooks`, `services`, `utils`, `types` e `styles`.
- Adicionado `AppLayout` com sidebar recolhivel, grupos de navegacao, topbar contextual, organizacao e CNPJ ativo.
- Adicionados tokens visuais, tema Villa/Grao/multiempresa e funcao de contraste automatico.
- Adicionados componentes `Button`, `Input`, `Select`, `Card`, `Badge`, `StatusBadge`, `Alert`, `EmptyState`, `LoadingState`, `Tabs` e `DataTable`.
- Adicionadas logos Villa Coffee e Grao & Grao em `public/assets/branding`.
- Reorganizado Dashboard com blocos operacional, recebimentos, financeiro e confirmacoes.
- Adicionados testes de design system, tema e navegacao.
- Migradas Notas e operacoes para `src/renderer/pages/operations`.
- Criadas estruturas de importacao de planilhas e XML em `src/renderer/pages/imports`.
- Migradas Confirmacoes de negocio, templates, clausulas e relatorios para `src/renderer/pages/confirmations`.
- Adicionados Stepper, PageHeader, FileDropzone, DocumentPreviewCard, Drawer, ConfirmationDialog, Pagination, FilterBar, ProgressBar e demais componentes de suporte.
- Adicionadas rotas hash identificaveis para operacoes, importacoes e confirmacoes.
- Roteadas diretamente as paginas de operacoes, importacoes e confirmacoes pelo `src/renderer/app/App.tsx`.
- Removido o shell/default legado durante a migracao gradual.
- Removidas chamadas funcionais nativas de prompt, alert e confirm do renderer.
- Adicionado `src/renderer/utils/dialogs.ts` para decisoes e entrada de motivo em acoes legadas/migradas.
- Roteadas diretamente as paginas de Clientes e parceiros, Produtos, Regras por saca, Cobrancas e Conta-corrente.
- Criadas estruturas `components`, `forms` e `hooks` para parceiros, produtos, regras de servico, cobrancas e conta-corrente.
- Substituido o helper de dialog por `DialogProvider` React registrado em `AppProviders`, sem `document.createElement`.
- Migrados Financeiro, Contas a pagar, Recorrencias, Parcelamentos, Pagamentos, Cadastros financeiros, Relatorios e Configuracoes para rotas diretas.
- Criadas estruturas `src/renderer/pages/finance` e `src/renderer/pages/settings` com paginas, componentes, formularios, hooks e dialogs especificos.
- Adicionados componentes genericos `MonthInput`, `PercentageInput`, `TreeView`, `Timeline`, `CalendarGrid`, `DefinitionList`, `CopyButton`, `PageSection` e `SplitButton`.
- Removidos arquivo e pasta do workspace legado.
- Adicionada `NotFoundPage` para rotas desconhecidas.
