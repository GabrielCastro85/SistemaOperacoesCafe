# Changelog

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
