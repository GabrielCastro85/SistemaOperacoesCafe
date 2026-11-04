# Operações Café: o que o sistema faz

Referência completa das funcionalidades do Operações Café, escrita para outro agente (Claude ou Codex) entender o sistema e compará-lo com a Grãonex. Estado em 2026-11-03, versão 1.1.67 publicada e 1.1.68 em preparação.

> **Separação obrigatória.** A Grãonex é o SaaS pessoal do Gabriel, em outro repositório (`C:\Users\gabri\Projetos\operacoes-cafe-web`). Use este documento só para comparar funcionalidades e regras de negócio. Não copie dados, clientes, CNPJs, contas bancárias, credenciais nem infraestrutura do Operações Café para a Grãonex.

Os documentos antigos em `docs/` (`PRODUCT.md`, `ARCHITECTURE.md`, `DOMAIN_RULES.md`) descrevem as primeiras etapas e estão parcialmente desatualizados. Por exemplo, dizem que o app é 100% local, mas hoje existe sincronização central. Este arquivo vale mais do que eles.

---

## 1. Visão geral

### Para quem é

É um sistema interno de um grupo de corretagem e comércio de café com duas organizações (marcas) e quatro CNPJs próprios: duas unidades de cada marca, em estados diferentes. Cerca de cinco computadores usam o programa ao mesmo tempo.

### O negócio que ele controla

A empresa **intermedeia e opera vendas e compras de café** e ganha um **valor de serviço por saca**. O fluxo principal é:

1. **Nota fiscal:** uma NF-e de venda ou compra entra no sistema, quase sempre por XML.
2. **Operação:** cada nota vira uma ou mais operações, com quantidade em sacas, cliente responsável, se a venda é na mesma UF ou para outra UF, e o valor por saca que vem de uma regra.
3. **Cobrança:** no fim do período (mensal, quinzenal etc.), as operações confirmadas de um cliente são reunidas numa cobrança numerada. A cobrança gera PDF, Excel e imagem.
4. **Recebimento:** os pagamentos são registrados, com baixa parcial ou total, na conta-corrente do cliente.
5. **Confirmação de negócio:** documento comercial em PDF (o "fechamento") que comprova o negócio entre vendedor e comprador. É assinado por fora do sistema e depois anexado.
6. **Pagamentos a fornecedores:** pelas notas de entrada, o sistema calcula quanto a empresa deve pagar por saca ao fornecedor (o "acerto de entrada") e gera a conta a pagar.
7. **Financeiro interno:** contas a pagar, recorrências, parcelas, centros de custo e relatórios.

### Conceitos centrais

| Conceito | Significado |
|---|---|
| **Organização** | A marca ou grupo, com identidade visual própria: logo e cores primária, secundária e de destaque. |
| **CNPJ próprio** (`legal_entities`) | Estabelecimento legal de uma organização. Tem endereço, prefixo de documentos, conta bancária das confirmações, conta bancária das cobranças (a partir da 1.1.68) e textos padrão das confirmações. |
| **Local** | Escritório, armazém, filial ou propriedade, opcionalmente ligado a um CNPJ. |
| **Parceiro** (`business_partners`) | Qualquer contraparte. Pode ter vários papéis: cliente, fornecedor, vendedor, comprador, destino, transportadora, prestador ou outro. |
| **Empresa do parceiro** (`partner_legal_entities`) | Um CNPJ ou filial ligado a um parceiro. Pode existir sem parceiro, criado a partir do XML. |
| **Cliente responsável** | O parceiro que paga o serviço daquela nota. Não é necessariamente o destinatário fiscal. |
| **Saca** | Unidade de cobrança. A conversão de kg ou tonelada usa o peso da saca do produto, em geral 60 kg. Os cálculos usam decimal exato em texto. |
| **Valor por saca** | Tarifa de serviço em centavos, definida por regra. |
| **Mesma UF / outra UF** | Escopo da operação, `INTERNAL` ou `EXTERNAL`, que muda a tarifa. |

### Princípios técnicos que afetam as regras

- **Dinheiro:** sempre em centavos inteiros.
- **Quantidades e preços:** decimal em texto normalizado, com até 6 casas, sem ponto flutuante.
- **Datas:** ISO; a interface exibe no formato brasileiro.
- **Totais:** calculados no processo principal (backend), nunca no React.
- **Documentos emitidos:** guardam um *snapshot* imutável. A cobrança emitida e a confirmação emitida não mudam se o cadastro mudar depois.
- **Histórico:** cancelamento e exclusão são lógicos sempre que há algo a preservar. A numeração é sequencial por organização, CNPJ, ano e tipo de documento.

---

## 2. Arquitetura

| Parte | Tecnologia | Função |
|---|---|---|
| Aplicativo desktop | Electron, React, TypeScript, Vite | Programa principal, instalado em Windows. Um único instalador multiempresa. |
| Banco local | SQLite (`better-sqlite3`) | Cada computador tem o seu banco, em `userData/database/operations.sqlite`. Mais de 60 migrações. |
| Servidor central | Fastify (Node) no Railway e PostgreSQL no Neon | Sincroniza os bancos dos computadores, guarda usuários e sessões, recebe XMLs do coletor, alimenta o site de consulta e o assistente. |
| Coletor | Executável Node/Electron sem janela | Roda no computador onde está o emissor de NF-e (Vulpe) e envia os XMLs novos para o servidor central. |
| Site de consulta | React (`mobile-viewer`), publicado em domínio próprio | Painel web somente leitura com resumo e notas em aberto. |
| Atualização | electron-updater e releases no GitHub | O programa avisa e instala as novas versões. |

### Segurança do aplicativo

- **Isolamento:** o renderer não acessa Node, arquivos nem SQL. Tudo passa por canais IPC tipados e validados com Zod, com a política *deny-by-default*.
- **Senhas:** hash com `scrypt`.
- **Sessão:** com bloqueio e troca de usuário.
- **Auditoria:** com encadeamento por hash.

### Sincronização entre computadores

O arquivo é `electron/main/services/centralSyncService.ts`.

- **Funcionamento:** cada PC envia as linhas alteradas e recebe as mudanças dos outros, linha a linha, pelo `/v1/sync/push` e `/v1/sync/changes`. Para saber o que mudou, compara o hash de cada linha com um *baseline* local.
- **Conflitos:** vale a última gravação de cada linha (*last-writer-wins*).
- **Problema conhecido:** um PC atrasado pode reenviar uma versão antiga de uma linha.
- **Tabelas:** a lista sincronizada fica em `CENTRAL_SYNCED_TABLES`, no app, e `SYNCED_TABLES`, em `server/src/sync.ts`. As duas têm de ser iguais.
- **Arquivos:** PDFs e XMLs ficam no computador que os gerou. Há regeneração ou transferência sob demanda.

---

## 3. Módulos, na ordem do menu

### 3.1 Visão geral

**Resumo (Dashboard)**

Mostra:
- sacas vendidas e número de notas no período, só de vendas e sem notas canceladas;
- total bruto de serviços, somando todas as empresas;
- valores a receber, recebidos e em aberto, separados por notas e por caixa;
- totais mensais por empresa e por cliente.

Alertas:
- notas do período anterior que ficaram sem cobrança, com opção de ignorar (`billing_alert_ignores`);
- contas a pagar vencendo;
- cobranças vencidas;
- confirmações aguardando assinatura há muitos dias;
- clientes perto do limite de crédito;
- empréstimos a cobrar.

O painel também mostra o estado do coletor (online, último XML) e o estado da conexão com o servidor central.

**Comparativo de períodos** (`/comparison`, desde a 1.1.65)
- **Períodos:** compara de 2 a 4 períodos, como meses inteiros ou o mesmo intervalo de dias em cada mês (por exemplo, do dia 1 ao 20).
- **Imagem gerada:** volumes, notas, valores por empresa, principais clientes, clientes que cresceram ou caíram, clientes sem vendas no período anterior, média por dia, observações e pontos de atenção automáticos.
- **Dados:** somam sempre todas as empresas. O grupo selecionado define só as cores e o logo da imagem.
- **Saída:** a imagem é desenhada em canvas, em PNG, e pode ser salva ou copiada.
- **Notas canceladas:** ficam de fora.

**Assistente**
- **O que é:** chat com IA, pela API da OpenAI no servidor central (`/v1/assistant/chat`).
- **O que consulta:** cobranças, notas, financeiro e o estado do coletor, com os dados atuais.
- **Cálculos:** os totais são calculados no servidor, não pela IA.
- **Limites:** registra o uso por usuário e por mês.

### 3.2 Operações

**Notas e operações** (`/operations`): o módulo central.
- **Abas:**
  - notas emitidas (saídas) e notas recebidas (entradas), separadas por empresa própria;
  - lançamento manual;
  - importação de planilhas;
  - operações;
  - pendências;
  - indicadores.
- **Importação de XML de NF-e:**
  - **Origem:** arquivo, vários arquivos, pasta ou a caixa de entrada do coletor.
  - **Fila de revisão:** mostra a razão social e o CNPJ exatos da contraparte e a empresa própria envolvida.
  - **Segurança do arquivo:** valida a chave de acesso (44 dígitos e dígito verificador) e bloqueia DTD e entidades externas.
  - **Sentido da nota:** a empresa própria emitente indica venda (saída) e a destinatária indica compra (entrada).
  - **Eventos:** cancelamento e carta de correção não criam nova nota; entram em `fiscal_document_events`. Uma nota cancelada sai dos totais.
  - **Mesclagem:** a mesma chave não duplica; o XML se junta à nota manual ou de planilha já existente.
  - **Classificação:** produtos são reconhecidos por apelidos (*aliases*), e há regras de classificação automática das operações.
  - **Unidades:** SC, SACA e SACAS valem saca; KG e TON convertem pelo peso da saca; BIG BAG tem tratamento especial.
  - **Notas especiais reconhecidas pelo CFOP:**
    - **Armazém:** remessa e retorno (5905/6905, 5906/6906, 5907/6907, 5934/6934) vão para o controle de cafés armazenados e não viram operação comercial.
    - **Big bag vazio** (remessa de sacaria, CFOP 5920/6920/5921/6921 ou NCM 6305, a partir da 1.1.68): não soma sacas. O valor é informado por unidade na nota e a cobrança mostra "N un × R$/un".
- **Lançamento manual:** nota com vários itens e várias operações. Exige escolher o CNPJ exato da contraparte.
- **Importação de planilha `.xlsx`:**
  - **Mapeamento:** sugere as colunas pelo cabeçalho e permite modelos de mapeamento.
  - **Validação:** linha a linha; uma linha com erro não bloqueia as outras.
  - **Agrupamento:** linhas da mesma nota viram itens dessa nota.
  - **Nomes antigos:** apelidos ligam nomes históricos de clientes ao cadastro atual.
  - **Desfazer:** a importação pode ser revertida logicamente.
- **Operação:**
  - **Dados:** cliente responsável, escopo (mesma UF ou outra UF), sacas, sacas brutas, tarifa aplicada e valor do serviço.
  - **Tarifa:** a regra por saca vigente é aplicada automaticamente. Mudar a tarifa manualmente exige motivo e fica no histórico (`operation_rate_history`).
  - **Status:** rascunho, confirmada ou cancelada. Uma nota com pendências não pode ser confirmada.
  - **Situação de cobrança:** não cobrada, reservada ou cobrada.
- **Campos da nota:**
  - número do contrato;
  - observações para a cobrança;
  - frete por DAE (referência e valor, entra como ajuste na cobrança);
  - indicador de "serviço financeiro", que usa uma tarifa diferenciada da regra.
- **Devoluções:** registro de devolução parcial em sacas ou kg, que abate a quantidade cobrada.
- **Triangulação ou nota emitida por terceiro:** a operação aparece com o emitente real e o cliente cobrado como destino. Há também operações de terceiros sem nota própria (`third_party_operations`), que entram na cobrança.
- **Troca de cliente:**
  - É permitida mesmo com a nota ligada a uma confirmação, porque a confirmação é feita com a empresa e não com o cliente.
  - A tarifa é recalculada e a nota continua confirmada.
- **Exclusão de nota:** fica bloqueada enquanto houver uma confirmação ativa ligada a ela.
- **Paginação e filtros:** por período, empresa, cliente e status. O período padrão é o mês atual até hoje.

**Cafés armazenados** (`/warehouse-stock`)
- **Saldo:** por armazém (vinculado pelo CNPJ do armazém), empresa e produto, em kg e em sacas.
- **Movimentos automáticos:** remessa, retorno físico, remessa simbólica e retorno simbólico, reconhecidos pelos CFOPs. Notas canceladas são estornadas.
- **Conferência manual:** movimentos simbólicos sem referência à remessa original ficam marcados para conferir.
- **Ajuste manual:** definir o saldo ou lançar acréscimo ou retirada, com motivo obrigatório e histórico.
- **Sem cobrança:** esses movimentos não geram cobrança nem operação comercial.

**Reconhecimento de produtos:** apelidos que ligam a descrição do XML ao produto cadastrado.

### 3.3 Comercial

**Clientes e empresas** (`/partners`)
- **Cadastro:** parceiros com vários papéis, empresas ou CNPJs ligados, contatos e apelidos.
- **Busca de CNPJ:** consulta externa para preencher os dados.
- **Duplicados:** relatório de duplicidades e mesclagem de parceiros (`business_partner_merges`).
- **Empresas soltas:** CNPJs vindos do XML sem parceiro podem ser ligados depois.
- **Perfil de cobrança** (só para cliente): periodicidade e dados de cobrança. Há um limite de crédito, usado nos alertas.
- **Exclusão:** desativação lógica ou exclusão definitiva quando não há uso.

**Produtos:** categoria, unidade e peso da saca.

**Regras por saca** (`/billing/rates`): define quanto o cliente paga de serviço por saca.
- **Filtros da regra:** cliente; CNPJ próprio; empresa da contraparte; produto; escopo (mesma UF, outra UF ou geral).
- **Valores e validade:** valor, valor diferenciado para notas com serviço financeiro, vigência (início e fim) e prioridade.
- **Escolha:** vence a regra mais específica. Um empate é apontado como conflito.
- **Recálculo:** ao mudar uma regra, as operações ainda não cobradas são recalculadas.

**Confirmações de negócio** (`/confirmations`): o "fechamento".
- **Origem:** manual, a partir de operações ou a partir de notas fiscais. Também existe confirmação sem NF, quando a nota só sai depois da assinatura, e confirmação de compra.
- **Conteúdo:**
  - partes: vendedor, comprador, recebedor da entrega e corretor;
  - itens com quantidade e preço em decimal exato;
  - cláusulas, vindas de uma biblioteca de modelos;
  - condições de pagamento e de entrega;
  - corretagem em percentual;
  - observações;
  - dados bancários e PIX, vindos por padrão da conta de confirmação do CNPJ próprio;
  - signatários.
- **Fluxo:** rascunho → prévia em PDF → emissão numerada (por exemplo "VCMG 0207"; o PDF é gravado antes de marcar como emitida) → enviada para assinatura → PDF assinado importado, com hash SHA-256.
- **Encerramento:** cancelamento ou substituição. Uma confirmação numerada nunca é excluída, só cancelada.
- **PDF:** uma página A4 com três assinaturas (vendedor, comprador e corretor) e o rodapé "Gerado por Grãonex".
- **Outras telas:** modelos de confirmação, biblioteca de cláusulas, relatórios (PDF e Excel) e controle da sequência de numeração, com piso por CNPJ.
- **Notas fiscais:** a mesma nota pode estar em várias confirmações.

### 3.4 Recebimentos

**Cobranças** (`/charges`)
- **Período:** sugere janelas mensais, quinzenais, semanais ou personalizadas.
- **Seleção:** busca as operações elegíveis do cliente (confirmadas e não cobradas; rascunhos aparecem com aviso), que podem ser marcadas uma a uma. Avisa quando falta regra por saca.
- **Fluxo:**
  1. Criar o rascunho, que reserva as operações.
  2. Aplicar ajustes de acréscimo ou desconto, com motivo.
  3. Opcionalmente, aplicar créditos da conta-corrente.
  4. Enviar para conferência.
  5. Emitir a cobrança numerada, com snapshot.
  6. Gerar PDF, Excel e imagem de resumo.
- **CT-e:** ajuste calculado pela soma das sacas das notas selecionadas, com valor por saca editável e padrão de R$ 1,50.
- **Frete por DAE:** as notas com DAE entram como linhas de ajuste.
- **PDF:**
  - notas agrupadas por empresa, com subtotal;
  - notas pagas no período;
  - quadro de CT-e;
  - páginas numeradas;
  - dados para pagamento;
  - observações da cobrança.
- **Big bag** (1.1.68): seção própria "SACARIA (BIG BAG)".
- **Conta de pagamento** (1.1.68): a cobrança imprime a conta das cobranças do CNPJ. Se ela estiver vazia, usa a conta das confirmações. Editar uma não altera a outra.
- **Baixa:** receber uma NF isolada, pagamento parcial ou total, recibo de pagamento em PDF e estorno de baixa.
- **Status:** rascunho, em conferência, emitida, parcialmente paga, paga, vencida ou cancelada. Cancelar libera as operações reservadas ou estorna a cobrança emitida.
- **Controle de cobranças:** planilha imprimível do controle mensal (`chargeControlWorkbook.ts`).
- **Relatório de período por cliente:** sacas por cliente ou empresa no período (`partnerPeriodReport.ts`).

**Conferência de repasses** (`/transfer-reconciliations`)
- **O que é:** ferramenta de conferência que **não altera** cobranças nem o financeiro.
- **Base:**
  - notas de saída de clientes ou de entrada de fornecedores, das duas marcas juntas, com a origem de cada nota destacada;
  - ou um valor inicial informado sem notas.
- **Pagamentos:** registrados um a um, abatendo o saldo; a tecla Tab cria a próxima linha.
- **Saldo por cliente:** mostra o saldo restante das notas de cada cliente.
- **Ações:** editar, cancelar e excluir.

**Conta-corrente** (`/client-ledger`)
- **Lançamentos por cliente:** cobranças emitidas, pagamentos, adiantamentos, créditos e as aplicações desses créditos.
- **Saldo e alocação:** saldo por cliente; um pagamento pode ser alocado em várias cobranças.

### 3.5 Pagamentos

**Regras de entrada** (`/finance/purchase-rates`): quanto a empresa paga por saca ao fornecedor nas notas de entrada. Os filtros são fornecedor, CNPJ da nota, produto e UF.

**Acertos de entrada** (`/finance/purchase-settlements`)
- **Cálculo:** agrupa as notas de entrada do período por fornecedor, confere sacas e valor por saca, e separa mesma UF de outra UF.
- **Resultado:** gera a conta a pagar.
- **Histórico:** guarda o detalhe nota a nota, como prova em caso de cobrança indevida do fornecedor.

### 3.6 Financeiro

O financeiro é separado das cobranças de clientes, para não contar duas vezes.
- **Contas a pagar:**
  - **Vínculos:** organização, CNPJ próprio, local, centro de custo, categoria e favorecido.
  - **Valores:** competência e vencimento; valor final = original − desconto + juros + multa + outros.
  - **Status:** previsto, aberto, parcialmente pago, pago, vencido, contestado ou cancelado.
  - **Outros:** meio de pagamento previsto (PIX exige a chave), detecção de duplicidade e possibilidade de duplicar uma conta.
- **Formas de lançamento:**
  - **Recorrentes:** geração idempotente por competência.
  - **Parceladas:** a diferença de centavos vai para a última parcela.
  - **Rateio:** entre centros de custo e locais.
- **Pagamentos:** parciais ou totais, alocados a várias contas, com comprovante.
- **Anexos:** com cópia interna e hash. Remover o anexo de uma conta confirmada exige motivo.
- **Cadastros:** categorias (hierárquicas), centros de custo (hierárquicos, sem ciclos) e contas financeiras.
- **Visão financeira:** totais a pagar, pagos e vencidos, próximos vencimentos, calendário e fluxo projetado (recebimentos previstos − pagamentos previstos).
- **Relatórios gerenciais:** em PDF e Excel, com histórico de geração.

### 3.7 Administração

- **Usuários e perfis:**
  - **Perfis:** `SYSTEM_ADMIN`, `OPERATIONS_MANAGER`, `FINANCE_MANAGER`, `OPERATOR` e `VIEWER`, com permissões por módulo e escopo por CNPJ.
  - **Contas compartilhadas:** os usuários valem nos vários computadores, pelo servidor central.
  - **Senha:** troca de senha e recuperação por senha temporária.
- **Auditoria:** registro das ações, com encadeamento por hash.
- **Backups:**
  - **Formato:** pacote `.cafebackup` com manifesto, hashes, gzip e criptografia AES-256-GCM opcional.
  - **Tipos:** manual e automático, com retenção.
  - **Restauração:** feita com validação e com backup prévio.
- **Integridade:** verificação do banco, de documentos e de registros órfãos, com relatório.
- **Configurações:**
  - organizações (logo e cores);
  - CNPJs próprios (endereço, prefixo, as duas contas bancárias e padrões das confirmações);
  - locais;
  - perfil da instalação e empresa padrão;
  - diretórios, diagnóstico e "Sobre".
- **Empresa ativa:** na entrada, o usuário escolhe a empresa e o CNPJ operacional. A troca pela barra superior muda o contexto e o tema.

---

## 4. Serviços fora do aplicativo

### Coletor de XML

- **Onde roda:** num computador de cada marca, onde está a pasta do emissor de NF-e.
- **Instalação:** em `C:\ProgramData\...\Coletor`. Inicia com o Windows, sem janela, e tem vigilância própria que o reabre se parar.
- **Envio:** verifica XMLs novos a cada minuto. Envia ao servidor central as NF-e autorizadas e os cancelamentos dos CNPJs configurados, nos dois sentidos (emitente ou destinatário).
- **Sem lançamento automático:** as notas ficam na caixa de entrada e aguardam classificação no programa.
- **Controle remoto pelo programa principal:** status online, último XML, erros, "buscar agora", atualizar, reiniciar e ver registros.
- **SEFAZ:** a consulta direta foi removida, para não disputar o controle de numeração da consulta (NSU) com o emissor.

### Site de consulta

- **O que é:** painel web somente leitura para consulta pelo celular.
- **Conteúdo:** resumo (a receber, recebido, vencidas) e notas em aberto por cliente, com total.
- **Dados:** lê do servidor central (`/v1/viewer/*`), inclusive o PDF das cobranças.
- **Publicação:** só por push na branch `master`.

### Servidor central

Rotas em `server/src`:
- `auth`: login, sessão, troca de senha e sincronização de usuários.
- `bootstrap`: primeiro administrador e redefinição de senha.
- `sync`: bootstrap, envio e recebimento de mudanças, status e promoção de uma importação do SQLite.
- `sqliteImport`: carga inicial dos bancos.
- `collector`: heartbeat, comandos, arquivos, caixa de entrada e atualização do coletor.
- `viewer`: dados do site de consulta.
- `assistant`: chat com IA.

---

## 5. Documentos gerados

| Documento | Formatos | Observações |
|---|---|---|
| Cobrança | PDF, Excel, PNG | Numerada, com snapshot, notas por empresa, CT-e, DAE, ajustes, notas pagas e dados para pagamento. |
| Recibo de pagamento | PDF | Por pagamento registrado. |
| Confirmação de negócio | PDF | Prévia e definitiva numerada; o PDF assinado é importado com hash. |
| Relatório de confirmações | PDF, Excel | Por período, partes, produto e status. |
| Comparativo de períodos | PNG | Tema do grupo e dados de todas as empresas. |
| Controle de cobranças | Excel imprimível | Controle mensal. |
| Relatórios financeiros | PDF, Excel | Gerenciais, com histórico de geração. |
| Backup | `.cafebackup` | Opcionalmente criptografado. |

Todos levam o logo e as cores da organização do CNPJ emissor e o rodapé discreto "Gerado por Grãonex".

---

## 6. Regras de negócio que mais importam numa comparação

1. **O serviço é cobrado por saca.** Os valores dependem do cliente, do CNPJ próprio, da empresa da contraparte, do produto, da UF (mesma ou outra), da vigência, da prioridade e do indicador de serviço financeiro.
2. **O cliente responsável é separado das partes fiscais.** Quem paga o serviço pode não ser o emitente nem o destinatário. Há triangulação e notas emitidas por terceiros.
3. **A confirmação é com a empresa, não com o cliente.** A nota pode trocar de cliente sem mexer na confirmação.
4. **Só entram na cobrança operações confirmadas e não cobradas.** Criar o rascunho reserva as operações, para que duas cobranças nunca peguem a mesma nota.
5. **Documento emitido é imutável.** Mudanças exigem cancelamento ou substituição, e a numeração nunca é reaproveitada.
6. **Notas canceladas saem de todos os totais,** inclusive quando a operação continua ativa por causa da sincronização.
7. **Notas que não são de café não somam sacas:** armazém (estoque à parte) e big bag (valor por unidade).
8. **Dois lados do dinheiro:**
   - **A receber:** cobranças e conta-corrente.
   - **A pagar a fornecedores:** acertos de entrada a partir das regras de entrada.
   - **Despesas internas:** financeiro.
   
   Os três não se misturam.
9. **Multiempresa real:** duas marcas e quatro CNPJs no mesmo programa. Alguns totais e alertas somam tudo, enquanto documentos e numeração são sempre por CNPJ.
10. **Duas contas bancárias por CNPJ** (1.1.68): uma para as confirmações e outra, opcional, para as cobranças.

---

## 7. Roteiro para comparar com a Grãonex

Para cada linha, marque na Grãonex: **tem igual**, **tem diferente** (explique), **não tem** ou **não se aplica**.

| Área | Funcionalidade do Operações Café |
|---|---|
| Cadastro | Organizações com marca própria; vários CNPJs por organização; locais |
| Cadastro | Parceiros com vários papéis, CNPJs ligados, contatos, apelidos, mesclagem de duplicados e busca de CNPJ |
| Cadastro | Produtos com peso da saca e apelidos de produto para XML |
| Tarifas | Regra por saca com cliente, CNPJ próprio, contraparte, produto, UF, vigência, prioridade e tarifa financeira |
| Tarifas | Regras de entrada (a pagar ao fornecedor) |
| Notas | Importação de XML de NF-e (arquivo, pasta, coletor) com eventos de cancelamento e carta de correção |
| Notas | Lançamento manual e importação de planilha com mapeamento e reversão |
| Notas | Conversão de unidades (saca, kg, tonelada, big bag) em decimal exato |
| Notas | Armazém por CFOP, com saldo por armazém e ajuste manual |
| Notas | Remessa de sacaria (big bag) cobrada por unidade |
| Notas | Triangulação, notas de terceiros, devoluções, contrato, frete por DAE e serviço financeiro |
| Notas | Troca de cliente responsável com recálculo da tarifa |
| Cobrança | Cobrança por período com reserva, ajustes, créditos, conferência, emissão numerada e snapshot |
| Cobrança | PDF, Excel e imagem; CT-e por saca; seção de big bag; conta de cobrança própria |
| Recebimento | Baixa parcial ou total, recibo, estorno, conta-corrente, adiantamentos e créditos |
| Recebimento | Conferência de repasses sem efeito financeiro |
| Comercial | Confirmação de negócio com partes, itens, cláusulas, corretagem, banco e PIX, numeração, prévia, assinatura externa, cancelamento e substituição |
| Pagamentos | Acerto de entrada por fornecedor que gera a conta a pagar |
| Financeiro | Contas a pagar, recorrência, parcelas, rateio, pagamentos, anexos, categorias, centros de custo, calendário, fluxo projetado e relatórios |
| Análise | Resumo com alertas, Comparativo de períodos em imagem e assistente de IA |
| Plataforma | Vários computadores sincronizados, coletor automático de XML e site de consulta pelo celular |
| Plataforma | Usuários, perfis, permissões por CNPJ, auditoria com hash, backup criptografado e verificação de integridade |
| Plataforma | Atualização automática do programa e do coletor |

Pontos a observar na comparação:
- **Arquitetura:** a Grãonex é web e SaaS, enquanto o Operações Café é desktop com sincronização. Funcionalidades como coletor, backup local e sincronização podem não se aplicar ou ter outra forma.
- **Regras específicas do grupo:** algumas regras foram criadas para casos do grupo, por exemplo o padrão de CT-e de R$ 1,50 por saca e clientes pré-selecionados. Na Grãonex devem virar configuração, não regra fixa.
- **Problemas conhecidos que não devem ser copiados:** a sincronização por linha com última gravação vencendo pode reverter dados (ver `REGISTRO_AGENTES.md`). Os documentos ficam só no computador que os gerou.

---

## 8. Onde está cada coisa no código

| Assunto | Arquivo |
|---|---|
| Regras e SQL de quase tudo | `electron/main/services/appRepository.ts` |
| Migrações | `electron/main/database/migrations.ts` |
| Tipos e validação | `src/shared/types/domain.ts`, `src/shared/schemas/domainSchemas.ts` |
| Leitura de XML | `electron/main/services/xmlNfeService.ts` |
| PDF, Excel e imagem da cobrança | `electron/main/services/chargeDocuments.ts` |
| PDF da confirmação | `electron/main/services/dealConfirmationFiles.ts` |
| Comparativo | `electron/main/services/periodComparison.ts`, `src/shared/utils/periodComparison.ts` |
| Big bag | `src/shared/utils/packagingBilling.ts` |
| Conta de cobrança × confirmação | `src/shared/utils/chargeBankDetails.ts` |
| Sincronização | `electron/main/services/centralSyncService.ts`, `server/src/sync.ts` |
| Canais IPC | `src/shared/ipc/channels.ts`, `electron/main/ipc/handlers.ts`, políticas em `electron/main/services/security.ts`, ponte em `electron/preload/index.ts` e `index.cts` (iguais) |
| Telas | `src/renderer/pages/<módulo>/`; menu em `src/renderer/app/navigation.ts` |
| Coletor | `collector/` |
| Site de consulta | `mobile-viewer/` e `server/src/viewer.ts` |
| Histórico de versões | `docs/CHANGELOG.md` |
| Situação atual e decisões do Gabriel | `REGISTRO_AGENTES.md` |
