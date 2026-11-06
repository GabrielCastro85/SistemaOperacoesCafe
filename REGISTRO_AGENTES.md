# Registro compartilhado: Claude e Codex

O Gabriel alterna entre o Claude Code e o Codex neste projeto, geralmente quando os créditos de um acabam. Este arquivo é a ligação entre os dois.

## Regras

1. **Ao começar:** leia "Recados", "Em andamento", "Situação atual" e as últimas entradas do histórico, depois rode `git status` e `git log -5`. O que está no Git e no disco vale mais do que este arquivo; se discordarem, corrija o registro.
2. **Ao terminar uma tarefa, e antes de parar por falta de créditos:** atualize "Situação atual" e acrescente uma entrada no topo do histórico.
3. **Não apague nem refaça o trabalho do outro** sem o Gabriel pedir. Alterações não commitadas de outra origem devem ser mantidas.
4. **Não registre segredos:** senhas, tokens e strings de conexão ficam fora deste arquivo.
5. **Escreva o que o Git não mostra:** o que falta, decisões do Gabriel, testes feitos e não feitos, o que já foi publicado.
6. **Em andamento, desde o primeiro passo:** ao receber um pedido, anote-o em "Em andamento" antes de mexer no código e atualize a cada passo importante (antes de publicar, ao esperar deploy, ao parar no meio). Os créditos podem acabar sem aviso; o outro agente continua a partir daqui. Ao concluir, mova o resumo para o histórico e deixe a seção como "Nada em andamento.".
7. **Recados:** para pedir algo ao outro agente ou avisar de algo que ele precisa saber (um problema achado no trabalho dele, um passo que ficou para ele), escreva em "Recados" com data e autor. Quem ler e resolver apaga o recado e registra no histórico o que fez.
8. **Pedidos e respostas do Gabriel:** anote o pedido com as palavras dele e as decisões que ele tomar, para o outro agente não precisar perguntar de novo.

Modelo de entrada:

```
### AAAA-MM-DD HH:MM - Claude | Codex
- Pedido:
- Feito:
- Testado:
- Publicado:
- Pendente:
```

## Recados

Nenhum recado pendente.

## Em andamento

- **Agente:** Claude, 2026-11-06.
- **Pedidos abertos do Gabriel:**
  1. Importar as vendas da Grão & Grão de jan-jul/2026 no cliente THADEU NOTAS (como foi feito com a Villa). Aguardando o coletor da Grão chegar à 1.1.71 (estava na 1.1.38 às 10:52, com "Atualizar coletor" pendente). Depois: Gabriel clica "Enviar notas do periodo" (01/01 a 31/07/2026), busca Grão MG e SP no período sem importar pela tela, fecha o programa, e o agente roda `tmp/importar-thadeu.mts` adaptado para a pasta `documents/invoices/xml-imports/collector-inbox` (só vendas 5102/6102, sem canceladas nem acréscimo/complemento de valor; testar numa cópia do banco antes e fazer backup).
  2. Migração do aplicativo para o site (Gabriel autorizou em 2026-11-06: "Pode começar a migração das notas no site"). Bloco 1a publicado em 2026-11-06 (`f5faccb`): lançar, editar, confirmar, cancelar e excluir notas e alterar tarifa no site (ver histórico). Próximo: devoluções, DAE de frete, operações de terceiros, XMLs especiais (armazém, cancelamento, triangulação) e importação por planilha.

## Situação atual

- **Atualizado em:** 2026-11-06, pelo Claude.
- **Branch:** `codex/central-server-neon`.
- **Última versão publicada:** 1.1.71, em 2026-11-06.
- **Commits:** o código das versões 1.1.63 e 1.1.64 foi commitado junto com a 1.1.65. Faça commit antes de publicar, para o que está no ar sempre existir no Git.
- **`docs/CHANGELOG.md`:** não tem a versão 1.1.61.
- **Próxima versão:** 1.1.72. **Não publique sem o Gabriel pedir.**
- **Migração web total em andamento:** Gabriel decidiu que `graobase.com.br` substituirá 100% do aplicativo, e não será apenas uma consulta. Já existem escritas web para cadastros comerciais, produtos, regras, ajustes de cafés armazenados, lançamentos extras da conta-corrente, importação de NF-e comercial por XML, emissão de cobranças e recebimentos/estornos, usando o mesmo banco, revisões centrais, permissões e auditoria do desktop. O desktop permanece ativo durante a transição. Ainda faltam confirmações, repasses, contas a pagar, administração web e os casos especiais de XML (armazém, cancelamento e triangulação).

### Publicado na 1.1.71

- Coletor: comando remoto `BACKFILL` com período (migração do servidor `012_collector_backfill.sql`, coluna `payload` em `collector_commands`). O coletor ignora a data do arquivo e filtra pelo mês da chave de acesso; renova o status a cada minuto para a vigilância não reiniciá-lo; comandos esperam a varredura em andamento. Testado com o coletor real contra um servidor falso.
- Fila do coletor (`/v1/collector/inbox`) aceita `periodStart`/`periodEnd` (filtro pelo AAMM da chave) e até 10.000 itens; o programa pede só o período da busca.
- A busca resolve no servidor os XMLs da fila já cadastrados, ignorados ou com cancelamento aplicado.
- Botão "Enviar notas do periodo" no monitor do coletor, usando as datas da busca.
- Servidor: `server/Dockerfile` passou a copiar `electron/main/services/xmlNfeService.ts`. O commit `8858b50` (importar XML pelo site) importa esse arquivo no servidor, e o build Docker falhava; o Railway ficou em `d25cbf6` até esta correção.

### Publicado na 1.1.69 (commits `32191c7` e `6d7c92b`)

- A sincronização central guarda as credenciais somente em memória durante a sessão, renova o token automaticamente quando o servidor devolve 401 e repete a operação interrompida. Sair do programa limpa essas credenciais.
- A busca de empresas/CNPJs aceita o número com ou sem pontuação. Uma tentativa de cadastrar CNPJ já existente localiza o cadastro original para editar ou vincular.
- Release pública `v1.1.69` contém instalador, `latest.yml`, blockmap, coletor portátil e checksum do coletor. O instalador publicado foi baixado novamente e seu SHA-512 confere com o `latest.yml` remoto.

### Publicado na 1.1.70 (commits `efb122f` e `f1cd2c3`)

- A conta-corrente permite cancelar lançamentos extras incorretos pela própria tela, exigindo motivo e preservando o registro para auditoria.
- Pagamentos, cobranças, estornos e créditos já utilizados permanecem protegidos e devem ser corrigidos pelos fluxos de origem.
- Release pública `v1.1.70` contém instalador, `latest.yml`, blockmap, coletor portátil e checksum do coletor. Instalador e coletor foram baixados novamente e seus hashes conferem com os metadados publicados.

### Publicado na 1.1.68 (commit `dd10be0`)

- Remessa de sacaria (big bag vazio): CFOP 5920/6920/5921/6921 ou NCM 6305 entra com 0 sacas e fica pendente até informar o valor por unidade na tela da nota. Regras em `src/shared/utils/packagingBilling.ts`; cálculo em `setPackagingUnitValue` (`appRepository.ts`), que também corrige nota importada antes da regra. Cobrança e PDF mostram unidades em seção "SACARIA (BIG BAG)".
- Conta das cobranças separada da conta das confirmações: colunas `charge_*` em `legal_entities` (migração 061). Cobrança usa `chargeBankDetails` (`src/shared/utils/chargeBankDetails.ts`), que cai na conta da confirmação (`default_*`) quando a de cobrança está vazia. A migração atualiza o baseline da sincronização para as empresas não virarem "alteradas" em todos os PCs. Depois de instalar em todos os computadores, falta acertar a Villa MG (ver histórico).

- Envio imediato da sincronização: `isLikelyDataMutation` (`handlers.ts`) passou a considerar alteração tudo o que não for leitura. Antes, `xmlImports:execute`, `clientCharges:issue`, `dealConfirmations:issue`, `clientPayments:allocate` e outros não disparavam o envio e só subiam na varredura de segurança (até 10 min, desde `bc3af1e`, 28/10). Teste em `tests/ipc.test.ts`.

### Problema conhecido, sem correção

Provável sobrescrita na sincronização: `applyRemoteChanges` em `centralSyncService.ts` preserva linha local alterada e o push seguinte a envia sobre a versão central. Um computador atrasado pode assim reativar a operação de uma nota cancelada em outro. NF 1780 continua com a operação ativa no banco; os totais já a ignoram, mas o dado não foi corrigido.

### Referência de funcionalidades

`docs/FUNCIONALIDADES_OPERACOES_CAFE.md` descreve todos os módulos, regras e serviços, com roteiro para comparar com a Grãonex. Os textos antigos de `docs/` (PRODUCT, ARCHITECTURE, DOMAIN_RULES) estão desatualizados.

### Onde fica o Comparativo de períodos

Menu Visão geral > Comparativo, rota `/comparison`. Lógica em `electron/main/services/periodComparison.ts`, datas em `src/shared/utils/periodComparison.ts`, tela em `src/renderer/pages/comparison/PeriodComparisonPage.tsx`.

## Decisões do Gabriel

- **Duas contas por empresa (2026-11-03):** uma para as confirmações e, se necessário, outra para as cobranças. Editar uma não pode alterar a outra.
- **Big bag vazio (2026-11-03):** remessa de sacaria não soma sacas; o valor a cobrar é informado por unidade no lançamento da nota. A NF 7411 foi excluída por ele e não será cobrada neste mês.
- **Confirmação e cliente são independentes (2026-10-31):** a confirmação é feita com a empresa, não com o cliente. Por isso, a nota pode mudar de cliente mesmo ligada a uma confirmação, e a confirmação não muda.
- **Excluir nota:** continua bloqueado enquanto houver confirmação ativa ligada a ela.
- **Excluir confirmação:** confirmação numerada não é excluída, só cancelada, para preservar o histórico e a numeração.
- **Comparativo (2026-10-31):** os dados são sempre de todas as empresas (Villa e Grão & Grão). A empresa selecionada no topo define só as cores e o logo da imagem.
- **Grãonex:** o site fica em outro repositório e não deve compartilhar código nem infraestrutura com este projeto.

## Como rodar neste computador

- Use o Node 20 em `C:\Users\gabri\nodejs20`. O Node 24 global quebra o `better-sqlite3`.
- Antes dos testes, rode `npm run rebuild:node`. O `npm run dist` deixa o módulo compilado para o Electron.
- `npm run dist` gera **e publica** a versão no GitHub. Só execute quando o Gabriel pedir.

## Histórico (mais recente primeiro)

### 2026-11-06 - Claude
- Pedido: "Pode começar a migração das notas no site".
- Feito: `server/src/invoiceManagement.ts` com GET/PUT/DELETE `/v1/manage/invoices/:id`, POST `/v1/manage/invoices` (lançamento manual), POST `/:id/confirm` e `/:id/cancel`, PUT `/v1/manage/operations/:id/rate`. Mesmas regras de `AppRepository`: papel Cliente/Fornecedor do responsável, chave duplicada, contrato exigido, pendências, troca de responsável recalculando tarifa com `operation_rate_history` (separada da data), financeiro reabre a nota, sem editar nota cobrada/acertada. Diferenças deliberadas em relação ao app: o site não cancela nota cobrada (o app aceita por causa do cancelamento SEFAZ) e a exclusão é bloqueada quando a nota aparece em `client_charge_operations`, `account_payable_operations`, `client_charge_adjustments` ou `transfer_reconciliation_invoices`, para não deixar referência quebrada na sincronização; vínculos de confirmações canceladas, histórico de tarifa, devoluções, eventos e alertas ignorados são apagados junto. Remessa de sacaria continua só no app. `resolveRate` do Codex foi exportado e reaproveitado. Tela: `mobile-viewer/src/InvoiceEditor.tsx` (painel da nota e lançamento manual), linhas da lista clicáveis em `InvoicesTab.tsx`, estilos no fim de `viewer-overrides.css`.
- Testado: `tests/invoice-management-api.test.ts` (10 testes), suíte completa (340), typecheck do app e do servidor, ESLint dos arquivos, build do site. Tela conferida no navegador com o site local apontando para um servidor de teste em memória (`tmp/fake-invoice-api.mts`, configuração `site-dev` em `.claude/launch.json`; criar `mobile-viewer/.env.local` com `VITE_API_URL=http://127.0.0.1:4790` e apagar depois): lançar, abrir, trocar cliente (tarifa 5,00 → 3,00), confirmar, excluir, layout de celular.
- Publicado: commit `f5faccb` na branch e na `master`. Railway em `f5faccb` às 11:36 (`/ready` com banco conectado; rotas novas devolvem 401 sem sessão). GitHub Pages publicou o bundle `index-CEy2P_xp.js` às 11:44, com o lançamento manual e o painel da nota.
- Pendente: devoluções, DAE, terceiros, XMLs especiais e planilha; o Gabriel testar logado em produção com uma nota real.

### 2026-11-06 - Claude
- Pedido: fazer o coletor da Grão & Grão enviar as notas de jan-jul/2026 para cadastrar no THADEU NOTAS.
- Feito: comando remoto `BACKFILL` com período (coletor, servidor e botão "Enviar notas do periodo" no monitor), fila filtrada por período no servidor, busca resolvendo no servidor os XMLs já cadastrados. Correção do `server/Dockerfile` (faltava `xmlNfeService.ts`; o deploy de `8858b50` estava falhando).
- Testado: suíte completa (330), typecheck do app e do servidor, testes novos de fila por período e comando com período; coletor real rodado contra servidor falso (varredura normal só outubro; período jun-jul enviou 215 XMLs só desses meses). Build do servidor simulado com os arquivos que o Dockerfile copia.
- Publicado: release 1.1.71 (instalador, latest.yml, coletor e checksum); `master` e branch em `1180196`; Railway em `1180196`, `/ready` com banco conectado, migração 012 aplicada, manifesto do coletor anuncia 1.1.71.
- Pendente: o Gabriel atualizar o programa, esperar o coletor da Grão chegar à 1.1.71, mandar "Enviar notas do periodo" de 01/01 a 31/07/2026, buscar Grão MG e SP no período e fechar o programa para o Claude importar só as vendas no THADEU NOTAS (script `tmp/importar-thadeu.mts`, adaptar a origem para `documents/invoices/xml-imports/collector-inbox`).

### 2026-11-06 - Claude
- Pedido: cadastrar no cliente THADEU NOTAS todas as notas de julho/2026 para trás.
- Decisões do Gabriel: só vendas (CFOP 5102/6102); fora das cobranças; Villa agora e preparar a Grão & Grão.
- Feito: 1.008 vendas da Villa MG (695) e Villa ES (313), de 15/01 a 31/07/2026, importadas pelo caminho da tela (`AppRepository` + `inspectXmlFile`) com o script `tmp/importar-thadeu.mts` (fora do Git), com o programa fechado. Excluídas: 50 vendas canceladas, 114 não-vendas (armazém, estornos, devoluções, complemento/acréscimo de valor). THADEU NOTAS não tem tarifa, então as operações têm valor de serviço zero e não entram em alertas nem cobranças.
- Testado: execução completa numa cópia do banco antes; no banco real, integridade e chaves estrangeiras ok, contagens conferidas. Backup: `database/operations-before-thadeu-jan-jul-20261106.sqlite`.
- Publicado: nada (dados locais; a sincronização envia ao abrir o programa). Envio aos outros PCs não confirmado.
- Pendente: Grão & Grão jan-jul. XMLs só no PC remoto; precisa `monthsBack: 10` no `coletor-config.json` de lá e filtro por período na inbox do servidor (hoje `/v1/collector/inbox` devolve no máximo 1.000).

### 2026-11-06 09:05 - Codex
- Pedido: informar o que ainda falta para o site ficar 100% equivalente ao aplicativo e iniciar a execução.
- Conferido: documentação funcional completa, navegação e telas atuais do `mobile-viewer`, APIs web de consulta e mutação e histórico das últimas publicações.
- Feito: primeiro bloco da paridade de Notas e operações. O site agora lê e mostra a prévia do XML autorizado antes de gravar, identifica entrada/saída e o CNPJ próprio, localiza a empresa da contraparte por CNPJ, permite escolher responsável, escopo e produto de cada item, resolve tarifa de venda/compra com a mesma precedência do desktop e grava nota, itens e operações na revisão central auditada. Importações incompletas ficam pendentes em vez de contaminar os indicadores. XML duplicado, inválido e CNPJ próprio desconhecido são bloqueados. Notas de armazém ainda são encaminhadas ao desktop para não alterar o estoque incorretamente.
- Testado: builds do servidor e do site, `git diff --check`, teste novo de XML de entrada com regra de compra e suíte completa com 58 arquivos e 328 testes aprovados.
- Publicado: pendente nesta entrada.
- Pendente: confirmações, repasses, contas a pagar, administração e casos especiais de XML (armazém, eventos/cancelamento e triangulação). Coletor, certificados do Windows, backups/restauração locais e atualizador continuarão num agente local.

### 2026-11-06 08:52 - Codex
- Pedido: continuar tudo que fosse necessário para transformar integralmente o aplicativo em site.
- Feito: a tela web de Cobranças passou a selecionar notas/serviços em aberto de um cliente e emitir a cobrança definitiva. A API valida empresa, cliente, escopo, situação das operações, tarifa e contrato obrigatório; grava cobrança, vínculos e retratos das operações, adicionais DAE por nota, lançamento de conta-corrente e histórico na mesma revisão central auditada. As operações ficam faturadas atomicamente, evitando cobrança duplicada. O vencimento e uma observação opcional podem ser informados no navegador.
- Testado: builds do servidor e do site, typecheck, ESLint direcionado, `git diff --check`, testes específicos da API/viewer e suíte completa com 58 arquivos e 327 testes aprovados.
- Publicado: commit `cb865cb` enviado à branch e à `master`. Railway implantou o commit, `/health` e `/ready` estão saudáveis e o banco está conectado. GitHub Pages concluiu com sucesso; `graobase.com.br` serve o bundle com a rota de emissão de cobrança. Uma tentativa sem sessão devolve 401, como esperado. Nenhuma versão do desktop foi gerada e nada da Grãonex foi alterado.
- Pendente: migrar notas/XML, confirmações, repasses, contas a pagar e administração web, além dos ajustes avançados de cobranças, até o site substituir 100% do desktop.

### 2026-11-06 08:35 - Codex
- Pedido: continuar tudo que fosse necessário para transformar integralmente o aplicativo em site.
- Feito: a tela web de Cobranças passou a registrar pagamentos parciais ou integrais, validar o saldo aberto, atualizar a situação da cobrança e lançar o recebimento na conta-corrente na mesma revisão central. Os pagamentos ativos aparecem dentro de cada cobrança e podem ser estornados mediante motivo; o estorno preserva o pagamento e a alocação cancelados, cria o lançamento reverso e reabre o saldo da cobrança. Todos os eventos exigem permissão de cobrança e ficam na auditoria central.
- Testado: builds do servidor e do site, typecheck, ESLint direcionado, `git diff --check`, testes específicos da API/viewer e suíte completa com 58 arquivos e 326 testes aprovados.
- Publicado: commit `52cd95a` enviado à branch e à `master`. Railway implantou o commit, `/health` e `/ready` estão saudáveis e o banco está conectado. GitHub Pages concluiu com sucesso; `graobase.com.br` serve o bundle com registro e estorno de pagamentos. Uma tentativa sem sessão devolve 401, como esperado. Nenhuma versão do desktop foi gerada e nada da Grãonex foi alterado.
- Pendente: migrar criação/emissão/ajustes de cobranças e os demais fluxos operacionais, financeiros e administrativos até o site substituir 100% do desktop.

### 2026-11-05 22:10 - Codex
- Pedido: transformar integralmente o aplicativo em site, em vez de manter `graobase.com.br` somente para consultas.
- Feito: criada a base de mutações web autenticadas e auditadas sobre `central_records`/`central_change_log`, fazendo as alterações entrarem na mesma revisão que sincroniza os computadores. Clientes/fornecedores/empresas, produtos/apelidos e regras de serviço/entrada ganharam inclusão e edição no navegador. As operações validam escopo, CNPJ, dados e permissão de gestão comercial; a interface foi adaptada para desktop e celular.
- Testado: builds do servidor e do site, typecheck, ESLint direcionado, `git diff --check`, testes específicos da API e suíte completa com 57 arquivos e 323 testes aprovados.
- Publicado: commit `f0e677d` enviado à branch e à `master`. Railway implantou esse commit com `/health` e `/ready` saudáveis e banco conectado. GitHub Pages `42141966508` concluiu com sucesso; `graobase.com.br` serve o bundle com as três APIs de escrita. Uma tentativa sem sessão devolve 401, como esperado. Nenhuma versão do desktop foi gerada e nada da Grãonex foi alterado.
- Pendente: migrar os fluxos de notas/XML, cafés armazenados, confirmações, cobranças, conta-corrente, repasses, financeiro e administração para escrita web. Recursos dependentes do Windows (coletor, certificados instalados, backups locais e atualizador) continuam auxiliares locais, mas não impedem o uso principal pelo site.

### 2026-11-05 21:45 - Codex
- Pedido: confirmar se ainda falta algo na conversão gradual do Operações Café para o site.
- Conferido: os módulos operacionais e gerenciais previstos para consulta já estão publicados em `graobase.com.br`; o desktop continua sendo o sistema principal para inclusões, alterações, emissões, baixas e cancelamentos.
- Pendente: implementar operações de escrita no site por endpoints de domínio com validação, permissões e auditoria; depois migrar a administração web (usuários, perfis, permissões, auditoria e configurações). Coletor, certificados do Windows, backups/restauração e atualização do aplicativo devem permanecer locais.
- Publicado: nada; conferência somente leitura.

### 2026-11-05 21:32 - Codex
- Pedido: continuar e fazer o restante da conversão gradual do aplicativo para o site.
- Feito: publicados no site os cadastros comerciais (clientes/fornecedores e CNPJs vinculados), produtos com apelidos de reconhecimento, regras de serviço e de entrada, acertos de entrada, visão financeira, relatórios mensais, Assistente com IA, Conferência de repasses e Comparativo entre dois períodos. Todos os dados passam pela API central autenticada e respeitam a organização/CNPJ permitido ao usuário; foram removidas dessas telas as consultas diretas antigas ao Supabase.
- Testado: builds do servidor e do `mobile-viewer`, typecheck, ESLint dos arquivos alterados, `git diff --check` e `tests/viewer-api.test.ts`. O teste cobre os novos endpoints e o isolamento de escopo. GitHub Pages concluiu com sucesso no commit `d9983a5`; `graobase.com.br` serve o bundle com os novos módulos. Railway também está em `d9983a5`, com `/health` e `/ready` saudáveis e banco conectado.
- Publicado: commits `1732e0e`, `f49b219` e `d9983a5` na branch e na `master`. Nenhuma versão nova do desktop foi gerada e nada da Grãonex foi alterado.
- Pendente: migrar operações de escrita (cadastros, lançamentos, emissões, pagamentos, baixas e cancelamentos) por endpoints de domínio com validação e auditoria; migrar a administração web com controle de permissão. Coletor, certificados do Windows, backups/restauração e atualização do aplicativo permanecem locais por dependerem do computador.

### 2026-11-05 14:56 - Codex
- Pedido: listar o que ainda falta na conversão gradual do aplicativo para o site.
- Feito: comparado o menu completo documentado do desktop com a navegação publicada em `graobase.com.br`. Já estão disponíveis, somente para consulta: Dashboard, Notas e operações, Cafés armazenados, Confirmações, Cobranças e Conta-corrente.
- Diagnóstico: faltam telas de Comparativo, Assistente, cadastros comerciais, produtos, regras, reconhecimento de produtos, repasses, pagamentos de entrada, financeiro e administração. Também falta transformar os seis módulos existentes de somente leitura em fluxos de inclusão/edição/baixa/emissão. Coletor de pastas, certificados do Windows, backups e atualização do desktop continuam sendo recursos locais.
- Publicado: nada; análise somente leitura.
- Pendente: Gabriel escolher o próximo bloco. Recomendação: migrar primeiro Clientes e empresas, Produtos e Regras por saca, pois são a base para as operações de escrita posteriores.

### 2026-11-05 14:51 - Codex
- Pedido: seguir para o próximo passo da conversão gradual do aplicativo para o site.
- Feito: publicada a consulta web de Cafés armazenados. A tela usa a API central autenticada, respeita organização/CNPJ próprio e apresenta saldo por armazém e produto, totais em sacas e kg, armazéns com saldo, movimentos ativos, pendências e histórico de remessas, retornos, baixas simbólicas e ajustes manuais. A consolidação usa o CNPJ do armazém como identidade e preserva a nomenclatura canônica do ajuste manual, igual ao aplicativo.
- Testado: build do servidor, build do `mobile-viewer`, typecheck, ESLint dos arquivos alterados, `git diff --check` e `tests/viewer-api.test.ts` aprovados. O teste cobre ajuste manual, remessa/retorno, saldo líquido, CNPJ, produto e movimento pendente. GitHub Pages `42078155894` concluiu com sucesso; o bundle público contém Cafés armazenados e `/v1/viewer/warehouses`. Railway está no commit `c6550a5`, `/health` e `/ready` saudáveis, banco conectado e a rota sem sessão devolve 401.
- Publicado: commit `c6550a5` na branch e na `master`; módulo disponível em `graobase.com.br`. Nenhuma versão do desktop foi gerada e nada da Grãonex foi alterado.
- Pendente: validar os saldos reais no site e escolher o próximo módulo da migração gradual.

### 2026-11-05 14:25 - Codex
- Pedido: continuar a implementação gradual do site do Operações Café.
- Feito: publicada a consulta web de Notas e operações. A tela usa a API central autenticada, respeita organização/CNPJ e permite filtrar período, entradas/saídas, ativas, pendentes e canceladas, além de busca textual. Exibe empresa própria, contraparte fiscal do XML, responsável comercial, produtos, sacas, valor fiscal, origem e situação. As sacas são somadas pelos itens da NF para não duplicar operações triangulares.
- Testado: build do servidor, build do `mobile-viewer`, typecheck, ESLint dos arquivos alterados, `git diff --check` e `tests/viewer-api.test.ts` aprovados. O teste cobre saída e entrada pendente, contraparte fiscal, itens e filtros. GitHub Pages `42073668265` concluiu com sucesso; o bundle publicado contém Notas e operações e `/v1/viewer/invoices`. Railway está no commit `63a978e`, `/health` e `/ready` saudáveis, banco conectado e a rota sem sessão devolve 401.
- Publicado: commit `63a978e` na branch e na `master`; módulo disponível em `graobase.com.br`. Nenhuma versão do desktop foi gerada e nada da Grãonex foi alterado.
- Pendente: validar os números reais no site com uma empresa e escolher o próximo módulo da migração gradual.

### 2026-11-05 10:18 - Codex
- Pedido: corrigir o erro ao criar fechamento de compra da Villa a partir de uma nota que já tinha empresa identificada.
- Achado: a NF de entrada 49 da Villa ES (500 sacas, R$ 485.000,00) tem no XML a emitente RODRIGUES ARMAZEM E COMERCIO LTDA, CNPJ 68.369.948/0001-52, e essa empresa existe no cadastro; porém `fiscal_documents.partner_legal_entity_id` ficou vazio. A tela considerava somente esse campo e ignorava o CNPJ fiscal do XML.
- Feito: a confirmação agora resolve a empresa contraparte pelo CNPJ do XML quando o vínculo técnico da nota estiver vazio. Em compra usa o emitente/vendedor; em venda usa o destinatário/comprador. O responsável comercial continua independente da empresa fiscal.
- Testado: typecheck, build de produção e 6 testes direcionados aprovados, incluindo compra com a Villa como destinatária e empresa vendedora sem vínculo técnico na nota.
- Publicado: nada. Alteração preparada para a 1.1.71; não publicar sem o Gabriel pedir.
- Pendente: Gabriel pedir a publicação e depois testar o fechamento da NF 49 na versão atualizada.

### 2026-11-05 09:35 - Codex
- Pedido: seguir para a próxima parte da conversão gradual do aplicativo para o site.
- Feito: publicada a consulta web de Conta-corrente em `graobase.com.br`. A tela usa a API central autenticada, respeita organização/CNPJ e oferece cliente, período, busca, filtros por efeito, resumo financeiro e histórico inclusive de lançamentos cancelados. O resumo replica o desktop e inclui notas confirmadas ainda sem cobrança emitida.
- Testado: build do servidor, build do `mobile-viewer`, typecheck, ESLint dos arquivos alterados e `tests/viewer-api.test.ts` aprovados. O teste cobre serviços, acréscimos, adiantamentos, pagamentos, cancelamentos e saldo. GitHub Pages `42028028316` concluiu com sucesso; bundle publicado contém Conta-corrente e `/v1/viewer/ledger`. Railway está no commit `987054d`, `/ready` saudável e banco conectado.
- Publicado: commit `987054d` na branch e na `master`; Conta-corrente disponível no site. Nenhuma versão do desktop foi gerada e nada da Grãonex foi alterado.
- Pendente: validar os valores reais com um cliente no site e escolher o próximo módulo da migração gradual.

### 2026-11-05 09:05 - Codex
- Pedido: retomar a conversão gradual do aplicativo para o site, sem desativar o desktop e sem tocar na Grãonex.
- Achado: a API de cobranças já estava no Railway, mas o GitHub Pages ainda servia a interface anterior. Publicações feitas pela branch compilavam, porém o ambiente Pages recusava o deploy; a `master` é a origem autorizada.
- Feito: a branch atual foi integrada com a `master` sem conflitos e enviada para as duas referências no commit `5a23b2a`. A tela web de Cobranças foi publicada com duas abas: Notas em aberto e Cobranças emitidas. Inclui período, cliente, busca, situação, totais e download do PDF.
- Testado: build de produção do `mobile-viewer`, ESLint dos arquivos da etapa e `tests/viewer-api.test.ts` aprovados. Workflow GitHub Pages `42023979435` concluído com sucesso. `graobase.com.br` serve o bundle novo com Cobranças e Confirmações; Railway está no commit `5a23b2a` e `/ready` confirma banco conectado.
- Publicado: etapa de consultas web de cobranças em `graobase.com.br`. Nenhuma nova versão do desktop foi gerada e nada da Grãonex foi alterado.
- Pendente: escolher e migrar o próximo módulo gradualmente, mantendo o desktop como alternativa.

### 2026-11-05 08:50 - Codex
- Pedido: publicar a atualização pendente com o cancelamento seguro de lançamentos.
- Feito: versão e changelog atualizados para 1.1.70; commits `efb122f` e `f1cd2c3` enviados à branch `codex/central-server-neon`.
- Testado: suíte completa com 55 arquivos e 318 testes aprovados; typecheck aprovado; lint específico da alteração aprovado; smoke test do aplicativo empacotado e verificador de release aprovados. O lint global continua falhando por milhares de ocorrências preexistentes em `.codex-tmp`, artefatos compilados e scripts antigos não relacionados à versão.
- Publicado: release pública `v1.1.70`, fora de rascunho, com instalador Windows, `latest.yml`, blockmap, coletor portátil e SHA-256 do coletor. O primeiro envio do coletor sofreu `ECONNABORTED`; a repetição isolada concluiu normalmente. O instalador remoto foi baixado e seu SHA-512 confere com o `latest.yml`; o coletor remoto foi baixado e seu SHA-256 confere tanto com o arquivo publicado quanto com o binário local.
- Pendente: instalar a 1.1.70 nos computadores. Próxima versão 1.1.71, somente mediante autorização do Gabriel.

### 2026-11-05 08:30 - Codex
- Pedido: cancelar o adiantamento incorreto de R$ 100.000,00 da conta-corrente do Rafael, permitir cancelamentos seguros pela própria tela e corrigir o CNPJ do armazém SABANA para `32.611.305/0001-26`.
- Dados corrigidos: o lançamento `20924b5c-954f-4f35-a10c-0fdb971d2aef` foi marcado como `CANCELLED`, teve o saldo disponível zerado e permaneceu no histórico para auditoria. O ajuste manual de 329 sacas da SABANA foi vinculado ao CNPJ `32611305000126`, sem alterar quantidade, produto ou histórico. Os dois registros permaneceram corretos após a sincronização central avançar para a revisão 2998, sem erro.
- Segurança: backups SQLite criados antes das duas correções em `backups/manual-before-cancel-ledger-2026-11-04-1652.sqlite` e `backups/manual-before-fix-sabana-cnpj-2026-11-05T11-26-13-956Z.sqlite` dentro da pasta de dados do aplicativo.
- Código preparado: a conta-corrente ganhou a ação `Cancelar lançamento`, exigindo motivo, preservando o histórico e bloqueando pagamentos, cobranças, estornos e créditos já utilizados. A ação será incluída na próxima versão 1.1.70.
- Testado: typecheck aprovado; `client-charges-ledger`, paridade dos preloads e IPC somaram 36 testes aprovados. `git diff --check` sem erro.
- Publicado: nada. O cancelamento e a correção da SABANA já estão nos dados sincronizados, mas o novo botão depende de publicação futura.
- Pendente: publicar a 1.1.70 somente quando o Gabriel pedir.

### 2026-11-04 16:42 - Codex
- Pedido: orientar como excluir um adiantamento de R$ 100.000,00 lançado incorretamente em 04/11/2026 na conta-corrente.
- Achado: a tela e a API atuais permitem criar lançamentos, mas não oferecem ação para excluir ou cancelar um lançamento do histórico. O resumo já considera somente registros com status `CONFIRMED`, e a tabela já sabe exibir status `CANCELLED`.
- Orientação: não criar um acréscimo contrário apenas para compensar. A correção adequada é cancelar o lançamento, preservando o registro para auditoria e retirando-o do saldo.
- Feito: diagnóstico somente leitura; nenhum dado nem código alterado.
- Publicado: nada.
- Pendente: mediante confirmação do Gabriel, cancelar diretamente este adiantamento específico e/ou implementar um botão “Cancelar lançamento” com confirmação e bloqueio quando o valor já tiver sido usado em cobrança.

### 2026-11-04 16:18 - Codex
- Pedido: publicar a atualização 1.1.69 que estava pendente.
- Feito: versão e changelog atualizados; renovação automática da sessão central commitada em `6d7c92b`; correção anterior da busca de CNPJ está no commit `32191c7`; branch `codex/central-server-neon` enviada ao GitHub.
- Testado: typecheck, ESLint dos arquivos alterados, smoke test do pacote e verificador de release aprovados. A suíte completa passou 316 de 317 testes; um teste de cobrança excedeu o limite enquanto outras validações rodavam em paralelo e passou isoladamente logo depois (1/1). O novo teste de renovação da sessão passou.
- Publicado: release pública `v1.1.69` no repositório de instaladores, com instalador Windows, `latest.yml`, blockmap, coletor portátil e SHA-256 do coletor. O primeiro envio do coletor sofreu `ECONNABORTED`, foi repetido isoladamente e concluído. A API do GitHub confirmou a release fora de rascunho e todos os cinco arquivos enviados; o instalador remoto foi baixado e conferido contra o SHA-512 do `latest.yml` remoto.
- Orientação de instalação: se o instalador disser que não consegue fechar o Operações Café, fechar o aplicativo (inclusive no Gerenciador de Tarefas, se necessário) e clicar em Repetir. Isso não apaga os dados.
- Pendente: instalar a 1.1.69 nos computadores. No PC 2, entrar novamente uma vez depois da atualização para carregar as credenciais da sessão; a partir daí a renovação é automática.

### 2026-11-04 15:48 - Codex
- Pedido: notas da MUNIZ foram lançadas no PC 2, mas não aparecem neste computador.
- Achado: este computador está recebendo normalmente e avançou até a revisão central 2952, com sucesso às 15:44. Inclusive recebeu notas novas de outras empresas, mas nenhuma nota nova da MUNIZ. Portanto, o PC 2 ainda não enviou essas notas ao servidor central.
- Orientação imediata: no PC 2, sair da conta e entrar novamente para renovar a sessão central; aguardar a sincronização e conferir os números das notas. Fechar e abrir pode não renovar a autenticação.
- Correção permanente: a renovação automática de sessão já está preparada localmente para a 1.1.69, mas ainda não foi publicada.
- Publicado: nada.
- Confirmação posterior: a 1.1.69 ainda não está disponível; `package.json` e a última release publicada permanecem na 1.1.68.
- Pendente: obter os números das notas da MUNIZ e/ou confirmar o envio depois de relogar no PC 2; publicar a 1.1.69 somente quando o Gabriel autorizar.

### 2026-11-04 15:40 - Codex
- Pedido: conferir por que notas emitidas hoje para a empresa MUNIZ não permitem criar fechamento.
- Achado: não existe no banco local nenhuma NF-e de 04/11/2026 ligada ao CNPJ `67.994.763/0001-76`, nem pelo vínculo da empresa nem dentro do snapshot fiscal bruto. A sincronização central já voltou a funcionar e estava atualizada na revisão 2948, com sucesso às 15:38 (horário local), portanto o problema ocorre antes da confirmação: essas notas ainda não entraram neste banco.
- Decisão: não é necessário atualizar o programa para resolver este caso; uma atualização não cria notas que ainda não foram coletadas/importadas. A correção separada da busca por CNPJ formatado continua preparada para a próxima versão.
- Feito: diagnóstico somente leitura; nenhum dado ou código alterado.
- Publicado: nada.
- Pendente: obter os números das notas para verificar se faltou coleta/importação, se foram emitidas por outro CNPJ próprio ou se estão em outro computador sem envio central.

### 2026-11-04 15:25 - Codex
- Pedido: investigar por que não foi possível criar uma confirmação com notas da MUNIZ COMERCIO DE GRAOS LTDA.
- Achado: nenhuma tentativa da MUNIZ chegou a criar rascunho no banco, indicando bloqueio ainda na seleção. Todas as notas confirmadas dessa empresa são de outubro ou anteriores; a tela abre o filtro de notas no mês atual (novembro), por isso elas ficam ocultas até ampliar o período. Para Villa MG, as notas de outubro são 838, 839, 843, 844, 845, 863 e 864.
- Testado: numa cópia isolada do banco real, foi criada com sucesso uma confirmação de compra usando a NF 864 e a empresa MUNIZ sem cliente/corretor vinculado. Nenhum dado real foi alterado.
- Feito: diagnóstico apenas; nenhum código nem dado de produção foi alterado nesta etapa.
- Publicado: nada.
- Pendente: o Gabriel deve selecionar o intervalo de outubro na tela de criação. Se houver outra mensagem depois de selecionar as notas, registrar o texto ou imagem para investigar essa segunda etapa.

### 2026-11-04 15:05 - Codex
- Pedido: continuar a migração web e corrigir um CNPJ que o sistema dizia já estar cadastrado, mas não aparecia na lista de empresas.
- Achado: o CNPJ `67.994.763/0001-76` já existe como MUNIZ COMERCIO DE GRAOS LTDA, está ativo e ainda não está vinculado a cliente/corretor. A busca da tela comparava o CNPJ formatado com os dígitos armazenados e por isso ocultava o registro.
- Feito no desktop: a lista e o seletor de vinculação agora pesquisam CNPJ com ou sem pontuação. Se o usuário tentar cadastrar novamente um CNPJ existente, o formulário fecha e a empresa existente é localizada na lista, com orientação para editar ou vincular.
- Feito no site: preparada a consulta somente leitura de cobranças emitidas dentro da tela Cobranças, mantendo também as notas em aberto. Inclui filtros, totais, vencimento calculado e download do PDF.
- Testado: build do servidor, build do `mobile-viewer`, typecheck, ESLint dos arquivos alterados, testes específicos e suíte completa (55 arquivos, 317 testes); tudo aprovado.
- Publicado: nada nesta etapa. O site em produção continua na etapa das confirmações e o desktop continua na 1.1.68.
- Pendente: publicar a consulta web de cobranças e incluir a correção da busca de empresas na próxima versão do desktop somente quando o Gabriel pedir.

### 2026-11-04 10:55 - Codex
- Pedido: publicar a primeira ampliação da migração web gradual do Operações Café.
- Feito: commit `9d4bfc0` enviado à branch `codex/central-server-neon`; integração sem conflitos com a `master` no commit `68785d6`, preservando as correções exclusivas que já existiam nela.
- Testado: build do servidor, build de produção do `mobile-viewer` e teste da API do viewer na árvore integrada. Após a publicação, `graobase.com.br` passou a servir o novo JavaScript contendo a tela “Confirmações” e o endpoint `/v1/viewer/confirmations`; a rota sem sessão retorna 401, como esperado. `/health` informa o commit `9d4bfc0` e `/ready` está saudável com o banco conectado.
- Publicado: GitHub Pages concluído com sucesso pelo workflow `41841972183`; API Railway publicada e saudável. Nenhuma release nem instalador Windows foi gerado.
- Pendente: validar o login e os dados reais da tela “Confirmações” com um usuário do sistema. Continuar a migração web módulo a módulo, sem desativar o desktop.

### 2026-11-04 10:42 - Codex
- Pedido: iniciar aos poucos a migração do Operações Café para navegador, sem desativar o aplicativo, usando `graobase.com.br` e sem tocar na Grãonex.
- Verificado: `graobase.com.br` já aponta para GitHub Pages e serve o `mobile-viewer`; a API central e o banco estavam saudáveis em `/health` e `/ready`.
- Feito: primeira ampliação segura e somente leitura do site. Adicionado endpoint autenticado `/v1/viewer/confirmations` com controle de acesso por organização/CNPJ, período e status; a resposta traz número, empresa, contraparte, data, sacas, valor e situação. O menu web ganhou a tela “Confirmações”, com filtros e busca. O aplicativo desktop permanece inalterado e ativo.
- Testado: build do servidor, build do `mobile-viewer`, ESLint dos arquivos alterados, testes específicos do viewer e suíte completa (55 arquivos, 317 testes), além do typecheck; tudo aprovado. O build web mantém apenas avisos já existentes sobre resolução de fontes em tempo de build.
- Publicado: nada. A nova tela depende de publicar a API e o GitHub Pages; não publicar junto com outras alterações sem o Gabriel pedir.
- Pendente: publicar esta etapa quando autorizado e então validar login e dados reais em `https://graobase.com.br`. Próximas etapas devem migrar um módulo por vez, mantendo o desktop como alternativa até as gravações web estarem maduras.

### 2026-11-04 10:21 - Codex
- Pedido: avaliar se migrar o Operações Café para o navegador resolveria os problemas de sincronização entre PCs.
- Recomendação: sim, desde que o navegador use diretamente uma API e um único banco central, sem uma cópia SQLite completa por computador. Apenas trocar a interface Electron por uma página web mantendo bancos locais e sincronização não resolve.
- Arquitetura sugerida: sistema principal web/central; coletor e, quando necessário, um auxiliar local para XML, certificado A1 e arquivos do Windows. Migração gradual por módulos, mantendo o desktop durante a transição.
- Feito: análise apenas; nenhum código alterado além deste registro.
- Publicado: nada.
- Pendente: Gabriel decidir se quer iniciar um plano de migração gradual para web.

### 2026-11-04 10:10 - Codex
- Pedido: não exigir sair e entrar sempre que a sessão central expirar.
- Feito: `CentralSyncService` agora guarda em memória a credencial usada no login, detecta 401, renova a sessão central silenciosamente e repete a requisição original. Renovações simultâneas compartilham uma única tentativa; logout durante a renovação não reabre a sessão encerrada.
- Testado: teste novo de expiração/renovação automática, suíte completa (317 testes), typecheck e ESLint dos arquivos alterados; tudo aprovado.
- Publicado: nada. Correção preparada para a versão 1.1.69.
- Pendente: publicar somente quando o Gabriel pedir. Na versão 1.1.68 já instalada, ainda será necessário sair e entrar uma vez para enviar as 25 notas que ficaram locais; depois de instalar a próxima versão, a renovação será automática.

### 2026-11-04 09:56 - Codex
- Pedido: investigar por que a NF 1916 não apareceu no PC 2.
- Achado: a NF 1916 está íntegra neste PC (Villa MG, 04/11/2026, 600 sacas, confirmada), mas não entrou no baseline da sincronização. O servidor central retorna 401/UNAUTHORIZED desde 04/11 às 08:12; a última sincronização bem-sucedida foi 03/11 às 23:20 (revisão 2915).
- Impacto: não é só a NF 1916. Há 25 documentos novos/alterados sem baseline desde a última sincronização, incluindo as NF 1897 a 1916 (com lacunas), Villa ES 843 a 847 e o cancelamento da NF 1905.
- Feito: apenas diagnóstico, sem alterar banco ou código.
- Testado: conferidos `central_sync_state`, `central_sync_baseline`, documentos, itens, operações e `main.log`.
- Publicado: nada.
- Pendente: sair e entrar novamente no PC que lançou as notas para renovar a sessão central; depois conferir o envio e, se necessário, renovar a sessão do PC 2. Avaliar renovação automática do token para evitar recorrência.

### 2026-11-04 09:44 - Codex
- Pedido: atualizar `VENDAS 10-26.xlsx` com todas as notas de venda de outubro.
- Feito: gerada uma cópia em `outputs/2026-11-04-vendas-outubro/VENDAS 10-26 - ATUALIZADA.xlsx`, reconstruindo a aba DADOS com as 930 NF-e de venda confirmadas e não canceladas de 01/10 a 31/10/2026. Operações múltiplas da mesma NF foram consolidadas em uma linha. A aba RESUMO foi recalculada e recebeu seis clientes novos.
- Testado: arquivo exportado e reaberto; 930 linhas, 285.793,155403 sacas, intervalo completo de outubro e nenhuma fórmula com erro. Prévia visual conferida nas duas abas.
- Publicado: nada; o arquivo original da Área de Trabalho foi preservado.
- Pendente: nenhum.

### 2026-11-03 - Claude
- Pedido: NF 1891, 1892 e 1893 (Villa MG, importadas por XML às 15:45) não apareciam no PC 2.
- Causa: o canal `xmlImports:execute` não estava na lista de verbos que disparam a sincronização; as notas ficaram esperando a varredura de segurança de 10 minutos e subiram às 15:55 sem intervenção.
- Feito: lista invertida para "tudo menos leitura" em `isLikelyDataMutation`.
- Testado: `tests/ipc.test.ts` e typecheck do Electron. Confirmado no banco deste PC que as três notas entraram no baseline (enviadas). Não confirmado no PC 2.
- Publicado: versão 1.1.68, em 2026-11-03, junto com sacaria e conta de cobrança.

### 2026-11-03 - Claude
- Pedido: explicação completa do Operações Café para o Claude entender e comparar com a Grãonex.
- Feito: `docs/FUNCIONALIDADES_OPERACOES_CAFE.md`, montado a partir do código, menu, migrações, servidor e changelog. Sem dados de clientes nem contas.
- Publicado: nada. Sem commit.

### 2026-11-03 - Claude
- Pedido: a conta trocada nas cobranças da Villa MG mudou a conta das confirmações; separar as duas.
- Causa: a tela de cobrança gravava nos mesmos campos `default_*` da empresa, que a confirmação usa como padrão.
- Feito: campos `charge_*`, tela de cobrança edita só eles, cadastro da empresa mostra as duas contas, PDF da cobrança usa a conta de cobrança.
- Banco deste PC: Villa MG está com a conta da cobrança (ag. 2479, conta 13000793-9, PIX 44.963.370/0004-42) nos campos de confirmação. As confirmações usavam ag. 2479, conta 130009247, PIX 44.963.370/0005-23. VCMG 0201 e 0203 saíram com a conta errada, mas já estão substituídas; nenhuma ativa ficou errada.
- Testado: suíte completa (314), typecheck, lint; migração rodada numa cópia do banco real sem marcar empresas como alteradas. Telas não abertas no programa.
- Publicado: nada. Sem commit.
- Pendente: depois de atualizar todos os PCs, salvar a conta 13000793-9 na tela de cobrança e devolver a 130009247 ao cadastro da empresa (contas das confirmações).

### 2026-11-03 - Claude
- Pedido: cobrar a remessa de big bag por unidade informada na nota, sem somar sacas.
- Feito: importação, tela da nota, troca de cliente, bloqueio de devolução, cobrança (tela e PDF/imagem) tratam sacaria por unidade.
- Testado: suíte completa (312 testes), typecheck e lint dos arquivos alterados. Tela da nota e cobrança não abertas no programa.
- Publicado: nada. Sem commit.

### 2026-11-03 - Claude
- Pedido: como reconhecer notas de BIG BAG (NF 7414 virou 4.333 sacas).
- Achado: NF 7411 e 7414 (Grão & Grão para CAFEEIRA TERRA BOA) são "REMESSA DE VASILHAME OU SACARIA", CFOP 5920, NCM 6305.32: big bags vazios a R$ 30, peso total de 1 kg por unidade. Não têm café. O sistema converte BIG BAG como 1.000 kg (`isXmlBigBagUnit`/descrição em `appRepository.ts`, perto da linha 5182). A NF 7411 já está no banco como 1.083,33 sacas e R$ 5.416,67 a cobrar do cliente TERRA, ainda não cobrada.
- Nada alterado nesse momento; depois implementado conforme decisão do Gabriel (ver entrada seguinte).

### 2026-11-02 - Claude
- Pedido: aplicar os ajustes recomendados na conferência do comparativo.
- Feito: notas canceladas fora do Comparativo e dos totais do Resumo (`withoutCanceledDocuments` em `appRepository.ts`); "Clientes novos" renomeado. Sem alteração no motor de sincronização nem nos dados.
- Publicado: versão 1.1.67, em 2026-11-02.
- Pendente: o Gabriel decidir sobre a correção da sincronização e o cancelamento da operação da NF 1780 no banco.

### 2026-11-02 - Claude
- Pedido: conferir a imagem do comparativo Agosto x Outubro com o banco.
- Feito: 42 valores conferidos por SQL independente no banco local (revisão central 2832), todos iguais. Nenhum código alterado.
- Achados, sem correção: NF 1780 está cancelada, mas a operação segue CONFIRMED (atualizada depois do cancelamento, causa não investigada) e conta 550 sacas e R$ 2.750 em outubro no Comparativo e no Resumo. "Clientes novos" significa só sem venda no período anterior: KATUAI e RIO PARDO já vendiam em setembro.
- Pendente: o Gabriel decidir se o Comparativo exclui notas canceladas e se renomeia "Clientes novos"; conferir a NF 1780.

### 2026-10-31 - Claude
- Pedido: melhorar o layout do Comparativo, mostrar a imagem sem precisar salvar, usar o tema da empresa e somar sempre todas as empresas.
- Feito: filtros em coluna à esquerda e imagem inteira à direita, botão Ampliar, geração automática ao abrir, ao usar atalhos e ao trocar de empresa. Removido o filtro de empresas. Cores e logo vêm da organização selecionada.
- Testado: suíte completa, typecheck e tela com a barra e o menu reais no navegador interno, com dados de IPC simulados. PNG dos dois temas gerados com dados reais. Salvar e copiar não foram testados no programa instalado nesta rodada.
- Publicado: versão 1.1.66, em 2026-11-02.
- Pendente: o Gabriel testar salvar e copiar a imagem no programa instalado.

### 2026-10-31 - Claude
- Pedido: publicar a atualização.
- Feito: versão 1.1.65 com o Comparativo e a troca de cliente; commit do código pendente das versões 1.1.63 e 1.1.64.
- Pendente: o Gabriel testar salvar e copiar a imagem no programa instalado.

### 2026-10-31 - Claude
- Pedido: comparativo entre períodos que gera imagem, no modelo enviado pelo Gabriel, com liberdade para acrescentar ideias.
- Feito: tela Comparativo, atalhos de período, mesmo intervalo de dias em todos os meses, filtro por grupo ou empresa, salvar e copiar imagem. Acréscimos: média por dia, clientes novos e sem vendas, maiores altas e quedas, observações e pontos de atenção automáticos.
- Decisões técnicas: mesmo recorte do card "Sacas vendidas" do Resumo (vendas não canceladas pela data da operação, inclusive rascunhos, que a imagem avisa). A imagem é desenhada em canvas porque a captura de janela oculta no Windows corta no tamanho da tela. O quadro de divergência DADOS x RESUMO do modelo não entrou, porque é da planilha.
- Testado: suíte completa, typecheck, build e imagens PNG geradas com os dados reais. Não testado na tela do programa instalado (salvar e copiar não foram clicados).
- Publicado: nada. Sem commit.
- Pendente: o Gabriel precisa conferir por que agosto tem 503.725 sacas no sistema e 650.665 na planilha dele; julho não tem vendas lançadas no banco deste computador.

### 2026-10-31 - Claude
- Pedido: permitir trocar o cliente de uma nota já ligada a uma confirmação; criar este registro.
- Feito: a mudança no código já estava no disco, sem commit, alterada às 10:34. O autor não foi confirmado; o Codex estava aberto nesse horário. Ajustei `tests/deal-confirmations.test.ts` e `tests/xml-imports.test.ts` ao novo comportamento e a mensagem em `OperationsPage.tsx`, que ainda pedia para confirmar a nota de novo. Criei este arquivo, `AGENTS.md` e `CLAUDE.md`.
- Testado: suíte completa e typecheck. Não testado na tela do programa.
- Publicado: nada.
- Pendente: commit e versão 1.1.65, junto com as próximas alterações do Gabriel.

### 2026-10-30 - Codex (reconstruído pelo Claude a partir dos arquivos; autoria presumida)
- Feito: CT-e calculado pelas sacas das notas selecionadas e melhorias no PDF de cobrança.
- Publicado: 1.1.63 e 1.1.64, sem commit.

### 2026-10-30 - Claude
- Feito: nota deixou de ficar travada por confirmação cancelada; commits `cab2a7f` e `430104b`.
- Publicado: 1.1.62.
