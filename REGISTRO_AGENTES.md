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

- **2026-11-06, Claude → quem mexer no app:** `getOrCreateThirdPartyLegalEntityFromXml` (`appRepository.ts`) lê `party.addressLine`, `addressNumber` e `postalCode`, mas `partySnapshot` (`xmlNfeService.ts`) entrega `street`, `number`, `complement` e `cep`. Por isso as empresas terceirizadas criadas pelo app ficam com "Endereco nao informado" e o CEP da empresa própria. O site já usa os nomes certos. Corrigir no app numa próxima versão (não muda ids nem notas).

- **2026-11-06, Claude → quem mexer no app:** `removeChargeAdjustment` apaga o ajuste criado por `applyCredit`, mas não cancela a linha de `client_credit_allocations` nem devolve `available_amount_cents` ao lançamento. O crédito fica preso. O site já devolve. Corrigir no app numa próxima versão.

## Em andamento

- **Agentes:** Claude e Codex trabalhando ao mesmo tempo, 2026-11-06 à tarde.
- **Pedidos abertos do Gabriel:**
  1. **Retomado em 2026-11-09: out/2024 a jun/2026 lançados (4.772 notas, ver histórico); falta jul/2026.** Vendas da Grão & Grão de 01/01/2024 a 31/07/2026 no THADEU NOTAS (mesmas regras da Villa, sem transferências entre empresas próprias). Script pronto e testado numa cópia: `tmp/importar-thadeu-grao.mts` (lê `documents/invoices/xml-imports/collector-inbox`). Os `.rar` de Downloads só têm notas recebidas (subpasta `Down`). A busca do Gabriel às 14:20 só trouxe chaves de jul/2026 em diante: o coletor da Grão ainda não enviou o período antigo (monitor mostra versão antiga; se for 1.1.38, o comando "Enviar notas do período" falha). Já disponíveis: 5 vendas de jul/2026 da Grão SP. Gravação exige o programa fechado.
  2. **Claude (assumiu do Codex em 2026-11-06, créditos do Codex acabaram):** migração do aplicativo para o site. Blocos de notas publicados: 1a (`f5faccb`, lançar/editar/confirmar/cancelar/excluir e tarifa), 1b (devoluções e DAE), 1c (terceiros) e 1d (`e70ec03`, XMLs especiais de armazém, cancelamento e triangulação; produção conferida pelo Codex). Bloco 1e (importação por planilha) publicado em 2026-11-06, encerrando o bloco de notas. Gabriel pediu em 2026-11-06: "Pode começar as confirmações". Bloco 2a (confirmações: criar, editar, emitir, PDF, assinatura, cancelar, substituir, duplicar, excluir) publicado em 2026-11-06. Gabriel pediu em 2026-11-06: "Pode continuar com cobranças e conta-corrente". Bloco 3 (cobranças completas e conta-corrente avançada) publicado em 2026-11-06 (`7e53877`). Falta do bloco 2: importar PDF assinado (precisa guardar arquivo no servidor), cadastro de modelos de confirmação e de cláusulas, numeração (piso manual) e relatórios de confirmações. Falta do bloco 3: recibo de pagamento em PDF/imagem, relatório PDF de notas do período por cliente, prévia interna sem rascunho, cobrança com operações de terceiros (`third_party_operations`), alertas de período anterior sem cobrança e numeração de cobrança. Gabriel pediu em 2026-11-06: "Pode continuar com repasses e acertos de entrada". Bloco 4 (repasses e acertos de entrada) publicado em 2026-11-06 (`f310587`). Falta do bloco 4: completar triangulações de fornecedor antes de listar compras (`completeKnownSupplierTriangulations` do app) e o resumo de compras por fornecedor com "já acertadas". Gabriel pediu em 2026-11-06 que o site fique 100% igual ao app (mesmo visual e funções) para parar de usar o app, e aprovou o caminho "motor do programa": o servidor roda o próprio AppRepository/handlers do app (SQLite local sincronizado com o central como mais um PC) e o site usa as mesmas telas de src/renderer, com um window.operationsCafe que chama POST /v1/app/rpc. Diálogos do Windows viram upload/download no navegador. O site atual (mobile-viewer) continua no ar até a versão nova estar completa; a nova fica em graobase.com.br/app/. Primeira versão publicada em 2026-11-06 (`a4ff0db` e `e8edf0b`): graobase.com.br/app/ abre a tela de login do app e o motor responde no Railway. Falta Gabriel entrar com o próprio usuário (o primeiro login no servidor puxa a base inteira do central, pode demorar) e conferir as telas. Pendências: volume persistente no Railway (hoje os dados do motor ficam em /tmp e o motor refaz a cópia do central a cada publicação), imagem do comparativo de períodos (usa janela do Electron), monitorar memória do Railway (o motor roda no mesmo processo da API central), raiz do site trocada para a versão nova em 2026-11-06 (`20c71a2`); o site de consulta ficou em /consulta/. Gabriel pediu em 2026-11-09 melhoria visual do site (separar melhor botões, seções e funções; pode ser rebranding agressivo; mais intuitivo e bonito). Primeira versão publicada em 2026-11-09 (`a9676fa`). Gabriel pediu em 2026-11-09 os itens 1, 2 e 3 da lista de melhorias: seletor único de empresa no topo, acentos nos textos das telas e números formatados nos resumos; publicados em 2026-11-09 (`2c9f3fc`). Gabriel pediu em seguida avisos flutuantes e telas longas mais navegáveis; publicados em 2026-11-09 (`a616952`). Gabriel pediu em seguida tabelas (cabeçalho fixo, totais, ações da linha) e menu lateral (administração no fim, busca de telas); publicados em 2026-11-09 (`f3d0464`). Gabriel pediu em seguida a tela de entrada com a marca e o uso no celular/tablet; publicados em 2026-11-09 (`4f7e58a`). Itens da lista de melhorias visuais concluídos.
  3. **Taxa por UF de destino (Artur: ES R$ 7,00 / MG R$ 5,00), 2026-11-13:** implementada e testada, sem commit nem publicação. Falta cadastrar as regras do Artur na tela de regras (campo "Estado do destinatario (UF)") e publicar, se o Gabriel pedir. Detalhes no histórico.

## Situação atual

- **Atualizado em:** 2026-11-11, pelo Codex (planilha de vendas de novembro atualizada e validada; sem alteração de código do sistema).
- **Branch:** `codex/central-server-neon`.
- **Última versão publicada:** 1.1.71, em 2026-11-06.
- **Commits:** o código das versões 1.1.63 e 1.1.64 foi commitado junto com a 1.1.65. Faça commit antes de publicar, para o que está no ar sempre existir no Git.
- **`docs/CHANGELOG.md`:** não tem a versão 1.1.61.
- **Próxima versão:** 1.1.72. **Não publique sem o Gabriel pedir.**
- **Migração web total em andamento:** Gabriel decidiu que `graobase.com.br` substituirá 100% do aplicativo. A importação por planilha, confirmações, cobranças/conta-corrente, repasses e acertos foram publicadas em rotas web próprias em 06/11; no mesmo dia entrou o motor do próprio aplicativo no servidor, permitindo ao site usar as telas e regras completas do desktop. `graobase.com.br` serve a versão completa e `/consulta/` preserva o viewer anterior. Entre 09 e 11/11 foram publicados novo visual, responsividade, otimizações de desempenho, importação de pasta XML e geração PNG. O desktop permanece ativo durante a transição. Pendências principais: volume persistente no Railway, sessão/credencial de serviço do motor após reinício e validação contínua das funções que dependiam de diálogos/arquivos do Windows.

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

### 2026-11-13 - Claude (taxa por UF de destino)
- Pedido: cobrar do cliente Artur R$ 7,00/saca em vendas com destino no ES e R$ 5,00 em vendas com destino em MG. Gabriel respondeu "sim, pode implementar". Premissas assumidas: UF do destinatário da nota; vale para cobranças abertas (recalculadas ao salvar a regra), não para cobranças pagas/canceladas.
- Feito: regra de serviço ganhou `destinationStateUf` (migração 063, coluna nula em `service_rate_rules`). Regra com UF pontua 16 e vence a regra geral e a regra por empresa específica (8). UF vem do snapshot fiscal: destinatário, ou emitente quando o destinatário é a própria empresa. Notas sem UF no snapshot caem na regra geral. Regras da mesma UF no mesmo período são bloqueadas; UF diferente ou regra geral não conflitam. Tela de regras: campo "Estado do destinatario (UF)" e "Destino: XX" na lista.
- Testado: `tests/service-rate-destination-uf.test.ts` (2 testes; a taxa chega ao snapshot da cobrança). Suíte completa 387/387. Typecheck do app e do servidor sem erros. Testes de banco e backup passaram a esperar a migração 063.
- Publicado: não. Código não commitado. Regras do Artur ainda não cadastradas (dados ficam com o Gabriel, pela tela).
### 2026-11-12 - Claude (PDF de cobrança com emitente)
- Pedido: no PDF de cobrança, mostrar qual empresa emitiu cada nota (VILLA MG, VILLA ES, GRÃO MG, GRÃO SP, PRIME COFFEE); tirar "Dados podem ser ajustados no cadastro da empresa antes da emissão."; sugerir melhorias.
- Feito: coluna EMITENTE no PDF, na imagem de resumo e na planilha (primeira coluna da aba Operações). O nome curto é calculado ao ler a cobrança (`issuerShortLabel`, não gravado): emitente com CNPJ de empresa própria vira marca + UF; terceiro vira o começo do nome sem COMERCIO/LTDA etc. (`src/shared/utils/chargeIssuerLabel.ts`). Rotas antigas sem o campo usam o nome gravado. Frase do cadastro removida. TIPO mais estreito para o nome da empresa caber.
- Testado: suíte completa, typecheck e PDF de amostra renderizado (`outputs/amostra-cobranca-emitente.pdf`).
- Publicado: `820961b` e `d6fb831` (nome curto mantém DO/DE: "BOM DO GRAOS").
- Pedido seguinte: planilha (e PDF) com DAE muito repetitivos. Feito: `src/shared/utils/chargeDaeAdjustment.ts` lê os ajustes de DAE gravados (frete, nota, frete + nota). No PDF, os DAE saem num bloco "DAE - N NOTAS", uma linha por nota (data, NF, emitente, tipo e referência), sem a frase "registrado na nota fiscal" e com TOTAL DAE; observação só aparece se alguém escreveu outra coisa. Na planilha, a aba Ajustes virou Data | NF | Emitente | Empresa | Ajuste | Referência DAE | Efeito | Valor | Observações, com tipo/efeito em português, valor com sinal e linha Total. Amostras em `outputs/amostra-cobranca-dae.pdf` e `.xlsx`.

### 2026-11-13 - Claude (cópia dos dados do app desktop antes de desinstalar)
- Pedido: o Gabriel quer desinstalar o app desktop deste PC.
- Avisado: arquivos (confirmações assinadas, anexos, XMLs, PDFs) só existem na pasta local; o sistema não envia arquivos ao central. O desinstalador não apaga a pasta (`deleteAppDataOnUninstall: false`).
- Feito: o Gabriel abriu o app (rodapé "Servidor central sincronizado · revisão 3595") e fechou. Copiado `%APPDATA%\Sistema de Operacoes de Cafe Multiempresa` (database, documents, backups, settings, logs; sem caches) para `C:\Users\gabri\OneDrive\Backup Operacoes Cafe\App desktop 2026-11-13`. Conferido: database 48 arq/1.239 MB, documents 24.657/491 MB, backups 4.303/678 MB, settings 2, logs 2 — iguais à origem.
- Não desinstalar o Coletor GraoBase.

### 2026-11-13 - Claude (versão do parceiro: janela por cima e preço por empresa)
- Pedido: a janela "Versão para o parceiro" ficava cortada pelo topo/cotações/"Nesta página"; e poder cobrar um valor específico para uma empresa.
- Feito: a janela agora é desenhada no `<body>` (createPortal) com z-index 95, acima do topo e do "Nesta página". Nova seção "Preço por empresa (opcional)": escolhe a empresa de destino das notas da cobrança e informa R$/saca; vale no lugar do interno/externo para as notas daquela empresa (comparação sem maiúscula/acento). Backend aceita `companyRates` em `buildChargePartnerVersion`/`clientCharges:exportPartnerVersion`. Teste estendido.

### 2026-11-13 - Claude (notas com itens duplicados corrigidas)
- Pedido: "pode corrigir as notas duplicadas".
- Causa encontrada: em agosto/2026 (03–18/08), trocar o cliente de uma nota (ou regravá-la) criava um item novo idêntico com nova operação, em vez de substituir. Ex.: NF 5714 tinha vendas para MATHEUS, TERRA e 3× RAFAEL (cliente atual RAFAEL). Nada parecido depois de 18/08.
- Feito: `AppRepository.removeDuplicateFiscalDocumentItems(id, dryRun)` + IPC `fiscalDocuments:removeDuplicateItems`. Só age quando a soma dos itens passa do valor da nota; junta itens idênticos e mantém UMA operação por tipo (uma venda; na triangulada também uma compra), preferindo a já usada, depois a do cliente atual da nota (responsible/secondary), depois a mais recente; move a que fica para o item que fica; apaga as cópias (todas UNBILLED, sem cobrança/confirmação/conta a pagar), limpando operation_rate_history/billing_alert_ignores e repontando spreadsheet_import_rows. Bloqueia se alguma cópia estiver em uso. Testes em `tests/duplicate-fiscal-items.test.ts`.
- Aplicado em produção pelo site: 28 notas corrigidas (47 itens e 48 operações removidos): 236, 237, 238, 239, 392, 469, 5682, 5711, 5712, 5713, 5714, 5715, 5722, 5732, 5751, 5752, 5756, 5760, 5761, 5762, 5769, 5773, 5786, 6118, 6145, 6146, 6147, 81. Conferido depois: itens somam o valor da nota, uma operação por tipo, nenhuma órfã; sincronizado (revisão 3578).
- Bloqueada (não mexida): NF 391 (Villa ES, 05/08, 600 sc, cliente atual VALANI): 4 itens; 3 vendas VALANI cobradas em COB-2026-0001, 0002 e 0008 (R$ 2.400 cada, todas pagas em 28/08, sem PDF) + 1 venda YURI não cobrada. Aguardando o Gabriel dizer se as 3 cobranças pagas são reais.

### 2026-11-13 - Claude (versão da cobrança para o parceiro)
- Pedido: parceiro (ex.: Neto) recebe a cobrança com o nosso preço e manda uma relação para cobrar os clientes dele: tirar certas notas e usar o preço dele (ex.: R$ 4 interno, R$ 12 externo). Gerar isso no site sem alterar a cobrança original. Correios: o Gabriel disse que os preços estão certos e ajusta à mão se precisar.
- Decisões do Gabriel: cabeçalho igual ao nosso (empresa, logo, conta); não guardar (só gerar o arquivo); DAE/CT-e vêm marcados e ele desmarca o que não vai.
- Feito: `AppRepository.buildChargePartnerVersion` (tira operações/ajustes, aplica preço interno/externo nas notas que não são sacaria, recalcula subtotal/acréscimos/deduções/total, sem pagamentos nem notas já pagas; nada é gravado) + IPC `clientCharges:exportPartnerVersion` (PDF ou planilha, "... - versao parceiro.pdf/xlsx"). Tela: botão "Versão para o parceiro" na cobrança aberta (Cobranças), janela `ChargePartnerVersionModal.tsx` com preço interno/externo, lista de notas com marcar/desmarcar e valor novo x antigo, lista de DAE/CT-e/ajustes e total ao vivo. Teste em `tests/client-charges-ledger.test.ts`.

### 2026-11-13 - Claude (caso Correios e notas com itens duplicados)
- Lembrete `lembrete-planilha-correios` cancelado a pedido.
- Correios agosto: o PDF enviado ao cliente ("Correios 08-26.pdf") cobra 8.018 sc a R$ 13 (R$ 104.234) + NF 2446 de novo, 250 sc a R$ 7 (R$ 1.750), total R$ 105.984. Só agosto tem esse bloco. A NF 2446 no sistema não tem Financeiro, DAE nem observação que explique. As 24 operações de agosto da Correios estão UNBILLED (agosto foi cobrado pela planilha); setembro e outubro BILLED. As NFs 6463, 6564, 6565 e 6566 (26–28/08, Grão MG) estão lançadas no THADEU NOTAS, não na Correios.
- Achado: 23 notas de 03 a 18/08/2026 com o MESMO item repetido 2 a 5 vezes (soma dos itens = N × valor da nota; cada item com operação de sacas cheias). Ex.: NF 5712 Correios, R$ 702.000, 4 itens de 650 sc criados em 04/08 e 06/08 → serviço R$ 33.800 em vez de R$ 8.450. Notas: 5682, 6118, 6145, 6146, 6147 (NETO); 5712, 5713, 5722 (CORREIOS); 5714, 5715 (MATHEUS); 5711 (MARCELO); 5732, 5773, 5756, 5786 (WMP); 5751, 5752, 5761, 5762, 5760, 5769 (NOSSAS VENDAS); 391, 392 (YURI, Villa ES). Nenhuma depois de 18/08. 10 outras notas com 2 itens iguais somam certo (legítimas).
- NF 391 (YURI, Villa ES, 600 sc): 4 itens iguais; 3 operações cobradas em COB-2026-0001, 0002 e 0008 (criadas em 28/08 17:18–17:20, R$ 2.400 cada, cada uma com pagamento de R$ 2.400 em 28/08, sem PDF) — parece teste dos primeiros dias; a 4ª operação está UNBILLED a R$ 5.
- Nada alterado. Aguardando o Gabriel: (1) autorizar remover os itens/operações repetidos das notas não cobradas; (2) dizer se as 3 cobranças da NF 391 foram reais; (3) descobrir o R$ 7 da NF 2446; (4) se as 4 notas do THADEU NOTAS devem ir para a Correios.

### 2026-11-13 - Claude (melhorias: contas repetidas, velocidade e /consulta/)
- Pedido: "Pode fazer essas melhorias" (contas mensais/parceladas, velocidade, desligar /consulta/).
- Contas a pagar: parcelado aceita "Começa na parcela" (`firstInstallmentNumber`), valor de cada parcela (`installmentAmountCents`, alternativa ao total) e forma de pagamento/PIX; lança da parcela inicial até a última com o número certo (ex.: 18/22 a 22/22). Mensal: `generatePayableRecurringPeriod(id, n, payment?)` grava forma de pagamento/PIX; sem `payment`, copia do mês mais recente da mesma conta mensal (a tabela do modelo não tem coluna de PIX, nada de migração). Tela "Nova conta": campos "Total de parcelas", "Começa na parcela", opção "o valor é o total"; PIX obrigatório quando a forma é PIX. Teste novo em `tests/accounts-payable.test.ts`.
- Velocidade: medido `/health` ~0,19 s e `/ready` (com SELECT 1 no Neon) ~0,32 s, com picos de 1,4–1,8 s → ~0,13 s por consulta pela distância (Railway us-east4 x Neon São Paulo). O Railway não tem região na América do Sul; juntar exigiria migrar o Neon para os EUA (novo projeto, dump/restore, troca de DATABASE_URL, minutos fora do ar). Como o site usa SQLite local e sincroniza a cada 30 s, recomendado não migrar agora.
- /consulta/: o workflow do Pages não compila mais o mobile-viewer; /consulta/ vira redirecionamento para a raiz (igual /app/). Rotas do servidor do viewer continuam no ar.

### 2026-11-12 - Claude (DAE separados, conta da Grão SP e backup do Neon)
- DAE na cobrança (`9f76b59`): cada guia numa linha com o próprio valor, "DAE 2059" (da nota) e "DAE FRETE 2059", sem referência repetida. Ajuste que junta as duas guias é separado pelos valores do motivo gravado ("frete (...) R$ a + nota fiscal (...) R$ b"); se a soma não bater com o total, fica uma linha "DAE + DAE FRETE nnnn". Planilha: uma linha por guia; saiu a coluna "Referencia DAE".
- Contas a pagar de dezembro em diante: o Gabriel disse que o financeiro lança. Proposta descartada, nada gravado.
- Conta da Grão & Grão São Paulo (lida da NF 3305, dados adicionais): Santander 033, agência 3369, conta corrente 130040685, PIX CNPJ 16.594.876/0004-96. A gravação no cadastro (campos default*) foi bloqueada pela proteção de permissões; aguardando o Gabriel autorizar ou fazer pelo site.
- Correios NF 2446: expliquei o que a planilha mostra (cobrada a R$ 13 e de novo a R$ 7); motivo desconhecido.
- Depois, com autorização ("pode gravar"): conta da Grão & Grão São Paulo gravada nos campos default* (Santander 033, ag. 3369, cc 130040685, CONTA CORRENTE, titular GRAO & GRAO COMERCIO EXP LTDA, PIX CNPJ 16.594.876/0004-96); o resto do cadastro ficou igual.
- Backup do Neon configurado (autorizado "pode configurar"): History window de 6 h para 7 dias (Settings → Postgres) e snapshot diário às 00:00 UTC (21h de Brasília), guardado por 14 dias (Backup & Restore). Primeiro snapshot sai na próxima meia-noite UTC.
- Lembrete agendado (tarefa `lembrete-planilha-correios`, 13/11/2026 09:00) para rever com o Gabriel a NF 2446 da Correios.
- Neon (console logado pelo Gabriel): plano Launch; projeto operacoes-cafe-producao em AWS São Paulo, 1,16 GB. Restauração por histórico só das últimas 6 horas e nenhum snapshot/agenda. Nada alterado; recomendado aumentar a janela e agendar snapshot diário (custo pequeno), aguardando aprovação.

### 2026-11-12 - Claude (partes restantes: PDF de cobrança, repasses e proposta de dezembro)
- Pedido: "Pode fazer as partes restantes e me responda sempre em portugues".
- Feito (`4203185`): PDF de cobrança mostra, abaixo das notas já pagas, cada cobrança paga com valor e "pago em dd/mm/aaaa" e o TOTAL JÁ PAGO NO PERÍODO (data vem de `client_payments.payment_date`, agora em `ClientPaymentAllocation.paymentDate`); "RESUMO DA COBRANÇA" mostra "N notas · X sacas"; coluna TIPO some quando todas as notas (abertas e pagas) têm o mesmo tipo, e a EMPRESA ganha o espaço. Conferência de repasses: mostra "Carregando conferências…" até a lista chegar e busca clientes, conferências e saldos ao mesmo tempo.
- Proposta de dezembro em diante (`outputs/contas-dezembro-em-diante-para-conferir.xlsx`), nada gravado: 19 parceladas (361 parcelas futuras), 64 mensais (27 com valor que muda), 5 só de novembro. Limitações achadas: modelo mensal e grupo parcelado não guardam chave PIX, e o grupo parcelado sempre começa na parcela 1 ("17/22" viraria "1/5").
- Dúvidas para o Gabriel: MUSTANG 1/48 a R$ 48.000,00 por parcela (seria o total?); duas sequências DUETTO (1402 ED DUETTO 3/52 R$ 8.477 dia 15 e APARTAMENTO DUETTO 4/52 R$ 15.000 dia 25; em outubro havia 2/52 e 3/52 a R$ 13.000).
- Pendente: cópias de segurança do Neon (precisa do Gabriel logado no console do Neon).

### 2026-11-12 - Claude (contas de novembro importadas)
- Pedido: lançar no Contas a pagar as contas de novembro das planilhas NOV.pdf e NOV 2.pdf (Downloads).
- Decisões do Gabriel: todas em aberto (a coluna STATUS da planilha estava vazia; marcam pagas na tela); criar 7 categorias novas; tudo em Grão & Grão Minas Gerais (mesmo lugar das contas de outubro).
- Feito (produção, pelo site): categorias Imóveis, Veículos, Cartão de crédito, Salários e encargos, Condomínio, Consórcios e Seguros. 88 contas avulsas de novembro, total R$ 608.013,63 (igual ao TOTAL da planilha). Cada uma tem `internal_notes` "IMPORT-NOV-2026 #n (planilhas NOV e NOV 2)" (n = 1..88), o que permite conferir ou desfazer. Parcela fica no nome ("17/22"); chave PIX quando a coluna era chave; nome depois da chave vira favorecido (ISVAIR, ACÁCIO, ANDERSON, MAGDA, SINA); agência/conta do Bradesco em Observações. ENERGIA VILLA, CARTÃO PESSOA FÍSICA ROGERIO e COPASA VILLA vieram sem valor: ficaram em rascunho (amountStatus PENDING). Lista conferida em `outputs/contas-novembro-para-conferir.xlsx`.
- Código: aviso de rascunhos agora diz "Informar valor de ..." para conta sem valor (pede o valor, grava e abre a conta) e o texto "jeito antigo" saiu; a folha de controle pega a parcela do nome quando a conta não é de grupo parcelado (`114b8a7`).
- Não feito: contas mensais/parceladas para os próximos meses (só novembro foi lançado).

### 2026-11-12 - Claude (preços especiais por empresa de destino)
- Pedido: cadastrar os preços especiais achados nas planilhas antigas.
- Conferido no site: VALANI (Grão) já tinha regra INTERNA R$ 4 para PRIMAVERA COFFEE ROBUSTA (CNPJ 12.826.691/0002-47); as 80 notas da Villa ES para a Primavera já estão a R$ 4. Nas planilhas, a Primavera só aparece no bloco "VENDAS PRIMAVERA" a R$ 4 (nunca nos blocos de R$ 13/R$ 5), inclusive notas de WR Comércio e Futura (jul/2026).
- Feito (dado de produção, pelo site): regra `20ae44fb` VALANI + PRIMAVERA, EXTERNA, R$ 4,00, desde 1900-01-01, para a Primavera não cair nos R$ 13 quando a nota sair de outro estado. Nenhuma nota mudou de preço.
- Desfeito: criei e apaguei em seguida a regra CORREIOS + CAFE ROCINHA a R$ 7. A planilha "Correios 08-26" cobra a NF 2446 (250 sc) duas vezes: no bloco de R$ 13 e de novo num bloco à parte de R$ 7 (adicional, total R$ 20/saca); a NF 2666 fica só a R$ 13. Não é preço menor. As duas notas continuam a R$ 13 (regra `c564668c`), sem alteração.
- Sem regra nova: BRUNO + PORTO VERDE (R$ 7 = interno normal), NETO + RANCHEIRO (sem diferença nas planilhas), ABC + VASSULER (R$ 6 já cadastrado; o R$ 1,50 é CT-e).
- Pendente: o Gabriel dizer o que é o adicional de R$ 7 da NF 2446 da Correios; se for para cobrar, entra como acréscimo na cobrança de agosto (R$ 1.750,00), não como regra.

### 2026-11-12 - Claude (PDF de cobrança: acentos, favorecido e resumo por emitente)
- Pedido: itens 1, 2 e 3 das sugestões (acentos no PDF, favorecido nos dados de pagamento, resumo por emitente).
- Feito em `electron/main/services/chargeDocuments.ts`: textos fixos do PDF com acento (Prévia, Serviços, Não emitida, Emissão, Período, cobrança, já, Acréscimos, Deduções, Agência, não informada...). O texto de comparação `charge.notes === "PREVIA INTERNA"` não mudou. Dados para pagamento: "Favorecido" (titular da conta da cobrança, ou a razão social) e "CNPJ/CPF" (do titular; sem ele, a chave PIX se for CNPJ; senão o da empresa), agência e conta na mesma linha. Novo quadro "RESUMO POR EMITENTE" (notas, sacas/unidades e valor por emitente) antes dos dados de pagamento, só das notas desta cobrança.
- Testado: suíte completa (377), typecheck, build do servidor e PDF de amostra renderizado.
- Publicado: commit seguinte, nas duas branches.

### 2026-11-12 - Claude (aviso de saldo no repasse do LUCAS)
- Pedido: por que o repasse do LUCAS (09/11, 119 notas) dá "O valor informado supera o saldo disponível da nota." ao lançar mais R$ 1.000.000.
- Feito: só diagnóstico. O repasse 372ab69a, criado em 12/11 às 16:50 (concluído, 13 notas), repete 12 notas do 5b01894f (09/11): NFs 49, 50, 51, 52, 53, 54, 56, 57, 280, 281, 282 e 283. Ao ser concluído, ele consumiu parte do saldo dessas notas, e o repasse de 09/11 não salva mais com o valor cheio delas, seja qual for o pagamento. Nenhum dado alterado.
- Depois: o funcionário já ajustou o repasse de 09/11 (notas caíram para R$ 66.263.663,68 e os pagamentos foram para R$ 6.977.000).
- Feito em seguida, a pedido: cada nota da conferência traz `usedIn` (outros repasses não cancelados que a usam: nome, dia de criação em Brasília, situação e valor das notas do repasse). A tela mostra a etiqueta amarela "Nota já está no repasse LUCAS do dia 12/11/2026 (concluído, notas R$ …)" e conta, nas selecionadas, quantas já estão em outro repasse; não bloqueia. Ao passar do saldo, a mensagem (tela e servidor) lista as notas, o valor informado, o saldo e o outro repasse. Textos em `src/shared/utils/transferReconciliationUsage.ts`.
- Testado: suíte completa (372), typecheck, build do site e conferido no site real (Villa ES, repasse LUCAS de 09/11, sem salvar nada).
- Publicado: commits `f39a3b5`, `617a87e` e o seguinte, nas branches `codex/central-server-neon` e `master`.
- Observado: a lista de conferências mostra "Nenhuma conferência registrada" por alguns segundos enquanto carrega.

### 2026-11-12 - Claude (contas a pagar refeitas e folha de controle)
- Pedido: a operação de contas a pagar estava confusa. O Gabriel quer controlar **despesas gerais** (aluguel, energia, salários, impostos). No acerto de entrada, "nós pagamos" ao fornecedor, mas esse fluxo não é o foco agora.
- Diagnóstico: nenhuma conta tinha sido lançada.
  - **Defeito:** `PayablePaymentsPage` pagava sempre a **primeira conta em aberto**.
  - O assistente de 5 etapas vinha com valores fictícios ("Fornecedor avulso", R$ 1.000).
  - A conta nascia como rascunho.
  - A lista nem estava no menu.
- Feito:
  - `AccountsPayablePage.tsx` em `/finance/payables`, com o item "Contas a pagar" no menu Financeiro:
    - resumos clicáveis: Vencidas, Vencem hoje, Próximos 7 dias e Pago no mês;
    - abas A pagar, Vencidas, Pagas e Todas, mais busca e filtro de mês;
    - janela "Nova conta": só esta vez (draft + confirm), todo mês (template recorrente com `autoGenerateOnOpen` + generate) ou parcelado (`createPayableInstallmentGroup`);
    - categoria obrigatória, com "+ Nova categoria" (`createExpenseCategory`);
    - botão "Pagar" na linha: `createPayablePayment` + `allocatePayablePayment`, aceita pagamento parcial.
  - **Mensais:** o servidor gera N meses *depois do último gerado*. A tela pede só o que falta para chegar a 2 meses à frente do mês atual, porque antes cada abertura somava 3 meses.
  - `PayablePaymentsPage` virou só o histórico. "Visão financeira" aponta para Contas a pagar.
  - **Folha "Controle de despesas"** (`expenseControlPrint.ts`), no modelo das planilhas NOV/NOV 2 do Gabriel:
    - faixa verde, colunas DATA | FAVORECIDO | VALOR | STATUS | CHAVE PIX;
    - parcela em roxo, contas pagas com "PAGO" e parciais com "PAGO x";
    - TOTAL em amarelo, mais "Já pago" e "Falta pagar";
    - botão "Imprimir controle" do mês filtrado ou do mês atual; abre uma janela e chama a impressão.
- Testado no site local: conta avulsa, mensal e parcelada; pagamento parcial e total; categoria nova; abrir 3 vezes não duplica as mensais; prévia da folha. No site real, a página abre (sem lançar nada).
- Pendente:
  - os anexos de boleto e comprovante ficam só nos detalhes da conta (tela antiga);
  - acertos de entrada por saca (Lucas, Leo ES…) seguem no fluxo antigo.

### 2026-11-12 - Claude (velocidade e polimento, etapa 2)
- **Velocidade** (`aaefe0d`):
  - 8 telas trocaram "uma consulta por cliente" (`listPartnerLegalEntities` em loop) por `listPartnerLegalEntitiesForPartners`: Cobranças, Conta-corrente, Regras por saca, Regras de entrada, Resumo/AppStates, Acertos de entrada, Confirmações e Notas.
  - Cobranças: o load roda em paralelo.
  - Notas: duas rodadas paralelas no lugar de uma fila de 8; o status do coletor espera 1,5 s.
  - Medido no site real: Cobranças de 2,4–2,9 s para 0,9 s; Notas de 2,4–2,8 para 1,2–1,6 s; Confirmações de 0,8 para 0,4 s.
- **Polimento (CSS e JS só do site):**
  - Telas vazias: `ensureEmptyStates` (siteLayout.ts) marca mensagens "Nenhum/Nenhuma" sozinhas com `.site-empty` (caixa tracejada e ícone, como a `.ui-empty` do Resumo). Dentro de `td`, alinha à esquerda.
  - A barra de botões principais no fim da seção **não fica mais presa** (cobria linhas de tabela).
  - Botão desativado: cinza claro legível, no lugar do verde com 50% de opacidade.
  - Tabelas: removido o `min-width: 920px` de `.table-row/.table-head` (regra do app para telas ≤1366 px). Detalhe da cobrança com colunas flexíveis.
  - Auditoria no site real, em 19 telas, sem estouro e sem colunas espremidas: 375, 1024 e 1366 px.
- Visto às 12:29: o **coletor da Grão** estava sem varredura desde 11:05 (PC da Grão). Provável mesma causa do da Villa: os atalhos HKCU Run e Inicializar abrem o coletor com o usuário e ele trava. Avisei o Gabriel.

### 2026-11-12 - Claude (desktop aposentado; coletor Villa com entradas)
- Conferido, antes de aposentar o programa: o SQLite local e o site batem.
  - ENTRADAS NOTAS Grão: 259 notas e 263 operações. ENTRADAS NOTAS Villa: 1.526 notas e 1.528 operações.
  - Revisão 3476 dos dois lados. Nada ficou preso no PC.
- Coletor Villa (`C:\ProgramData\GraoBase\Coletor`):
  - `xmlRoot` foi de `C:\Vulpe\NFe` para **`C:\Vulpe`**, para incluir `C:\Vulpe\XML Terceiros\<empresa>\<AAAAMM>\Down`, onde ficam as notas de entrada. O filtro do coletor aceita a nota se o emitente **ou o destinatário** está em `emitterCnpjs`.
  - O Gabriel rodou como administrador `outputs/COLETOR-VILLA-INCLUIR-ENTRADAS.cmd`, que chama `outputs/coletor-villa-incluir-entradas.ps1`. Backup gravado: `coletor-config.json.antes-entradas-20261112-103718.bak`.
  - Primeira varredura: 8.273 arquivos inspecionados e 764 enviados, em cerca de 18 min. O monitor fica em "Sem sinal" durante esse tempo, porque o heartbeat só sai no fim da varredura, e a vigilância chegou a reiniciar o coletor uma vez.
  - As varreduras seguintes levam ~1 min. A fila do servidor da Villa passou de 667 para 2.447 arquivos.

### 2026-11-12 - Claude (central religa sozinho, coletor Villa e carrossel)
- **Sincronização do site OFFLINE após atualizações** (`7788f6e`):
  - O token do central fica só na memória do motor. Com o login persistente, ninguém digitava a senha após o deploy e o motor ficava sem sincronizar; o monitor do coletor mostrava "Entre no servidor central".
  - Agora `ensureCentralSession` (host.ts) religa com a senha guardada (`CentralCredentialStore.usernames()` + load) ao subir e a cada chamada; em falha, tenta de novo após 1 min.
  - Conferido em produção: ONLINE após reiniciar.
- **Coletor Villa (este PC, VILLACOFFEE)** travado desde 11/11 18:22:
  - Às 08:56 a entrada Run do HKCU e o atalho da pasta Inicializar abriram o coletor como `gabri`. Os arquivos em `C:\ProgramData\GraoBase\Coletor` só aceitam gravação de SISTEMA/Administradores, então ele não gravava nem varria, e a vigilância (SYSTEM) achava que estava rodando.
  - Encerrei os processos do usuário e a vigilância reabriu como SYSTEM às 09:12. Os dois coletores ficaram OK.
  - **Feito, com autorização do Gabriel:** removidas a entrada Run "ColetorGraoBase" do HKCU e o atalho "Coletor GraoBase.lnk" da pasta Inicializar. O coletor agora inicia só pelas tarefas do SYSTEM (Inicialização e Vigilância).
- **Carrossel de cotações em reais** (`e7b5be7`, `3f45e2d`, layout em seguida):
  - O Gabriel pediu igual ao do projeto pessoal dele; foi feito do zero, sem olhar o código de `operacoes-cafe-web` (regra de não compartilhar código).
  - `server/src/market.ts`: `GET /v1/market/quotes`, público, cache de 10 min. Fontes:
    - café arábica e conilon: CEPEA/Esalq (`cepea.org.br/br/indicador/cafe.aspx`, tabelas `imagenet-indicador1/2`), R$/saca;
    - dólar, euro e ouro: AwesomeAPI, que recusa a Railway; reserva no Yahoo (`BRL=X`, `EURBRL=X`, `GC=F`); ouro em R$/g;
    - Ibovespa: Yahoo `^BVSP`.
  - `web/siteTicker.ts`: faixa abaixo do topo, para no hover, respeita reduced-motion e se atualiza a cada 10 min.
  - Layout: `.app-main:has(> .site-ticker)` ganha uma linha própria na grade.
  - Teste: `market-quotes.test.ts`.
- Observação: logo após um deploy, o Resumo pode mostrar zeros por alguns segundos, até o motor religar e sincronizar. Recarregar resolve.

### 2026-11-12 - Claude (recibos de pagamento de notas)
- Pedido: gerar recibo **exatamente** no modelo `Recibo de Pagamento DLG 652.pdf` (Área de Trabalho\Recibos), com os dados das notas selecionadas e da empresa em operação, nas duas direções. O logo da empresa em operação vai abaixo do nome quando ela assina; quando assina a outra empresa, sai sem logo.
- Feito (`8863536`):
  - **Tela:** Recebimentos > **Recibos de pagamento** (`/invoice-receipts`, `InvoiceReceiptsPage.tsx`).
    - Modo "Nós recebemos": notas OUTBOUND da empresa em operação; ela assina, com o logo.
    - Modo "Nós pagamos": notas INBOUND; o vendedor assina, sem logo.
    - Busca e período; 100 notas por vez com "Mostrar mais"; marcar várias.
    - Campos editáveis: valor, data, sacas e mercadoria. Prévia igual ao PDF.
  - **Regras dos dados** (`listInvoiceReceiptInvoices` / `getInvoiceReceiptDraft`):
    - Vendedor = emitente da nota; comprador = destinatário. Os dados vêm do `fiscal_snapshot_json` (XML). Sem XML, vêm da empresa própria e do `partner_legal_entities`; o que falta da empresa própria é completado pelo cadastro.
    - Notas de outro vendedor ou comprador geram aviso e bloqueiam a geração.
    - Valor = soma das notas; sacas = soma dos itens; mercadoria "café em grão cru arábica/conilon".
  - **Texto e PDF:**
    - `src/shared/utils/invoiceReceiptText.ts`: texto, endereço e cidade/data; "– cidade" preso por espaço não separável.
    - `src/shared/utils/currencyInWords.ts`: valor por extenso.
    - `electron/main/services/invoiceReceipt.ts`: PDF pdf-lib Helvetica 12, parágrafo justificado com negritos, título sublinhado, linha e nome centralizado, logo via `resolveBrandingLogoBytes`.
  - Calibrado pelo modelo: as 7 primeiras linhas quebram nas mesmas palavras do original.
  - **Canais:** `invoiceReceipts:listInvoices`, `invoiceReceipts:getDraft`, `invoiceReceipts:exportPdf`. O arquivo se chama "Recibo de Pagamento <outra empresa> <notas>.pdf".
- Testes novos: `invoice-receipt.test.ts` (texto idêntico ao modelo, soma de duas notas, aviso de comprador diferente, PDF válido) e `currency-in-words.test.ts`. 371 testes passam.
- Testado no site local com notas reais da Villa MG nos dois modos, no computador e no celular.

### 2026-11-12 - Claude (região da Railway e Clientes mais rápido)
- **Decisão do Gabriel:** o programa desktop não será mais usado, só o site. Não há mais versão do desktop a publicar.
- **Railway:** o serviço `mindful-peace` passou de US West (sfo) para **US East (Virgínia, us-east4)**. O volume foi migrado junto, com alguns minutos fora do ar. Feito com o Gabriel logado.
  - Medido de cá: `/health` foi de ~0,28 para ~0,20 s e `/ready` (com banco) de ~0,47 para ~0,31 s. O Neon fica na costa leste.
  - O login sobreviveu à troca de região e ao deploy seguinte (volume + `940284a`).
- **Clientes e empresas** (`9728628`):
  - Novo canal `partnerLegalEntities:listForPartners` (repository `listPartnerLegalEntitiesForPartners`, uma consulta UNION para todos os clientes), que substitui ~150 chamadas `partnerLegalEntities:list`.
  - A busca recarrega só a lista de clientes, não mais todas as empresas.
  - Teste novo confere que o resultado é igual ao das consultas uma a uma; 368 testes passam.
- **Medição no site real**, depois de tudo, em segundos até a tela ficar completa. Nenhuma tela bloqueia com a tela de carregamento.

  | Tela | Tempo |
  |---|---|
  | Entrar | 3,4 (era ~5) |
  | Clientes | 0,3 (era 2,4) |
  | Notas | 2,4 a 2,8 (era 3,2) |
  | Resumo | 1,6 (era 1,9) |
  | Cobranças | 2,1 |
  | Conta-corrente | 0,3 |
  | Confirmações | 0,8 |
  | Repasses | 0,6 |

- Ainda dá para melhorar:
  - Notas: `xmlFiles:vulpeDevStatus` (~0,7 s) roda antes da lista.
  - Cobranças: `legalEntities:list` levou 1,1 s nesta medição.

### 2026-11-11 - Claude (volume Railway e login persistente)
- Pedido: criar o volume da Railway junto com o Gabriel (logado no navegador do app).
- **Railway:** no projeto `proud-delight`, serviço `mindful-peace`, foi criado o volume `mindful-peace-volume`, montado em `/data`, região sfo. Mudanças aplicadas com "Deploy Changes". O `server/src/index.ts` já usava `/data/engine` quando `/data` existe.
- **Só o volume não bastava** (`940284a`):
  - O mapa navegador→sessão (`sessions`/`activeScopes` em host.ts) ficava só na memória. Agora é gravado em `<dataDir>/web-sessions.json` (0600), e as sessões continuam no banco do motor.
  - A chave do `safeStorage` do electronShim era sorteada a cada processo, e as senhas do central em `central-credentials.json` deixavam de abrir após reiniciar. Agora fica em `<dataDir>/.storage-key` (0600). A variável `ENGINE_STORAGE_KEY` (base64, 32 bytes), se definida, tem prioridade.
  - O index.ts passa `ENGINE_DATA_DIR` ao shim.
- Testado localmente: login, motor reiniciado, página recarregada continua logada (pede só a empresa, como sempre). 367 testes passam.
- Publicado: Railway `/health` = 940284a.
- Efeito: a partir da próxima atualização, ninguém precisa entrar de novo e a sincronização do motor segue sem novo login. A atualização que acabou de entrar ainda pediu login uma última vez.

### 2026-11-11 - Codex (planilha de vendas de novembro atualizada)
- Pedido: atualizar `C:/Users/gabri/OneDrive/Área de Trabalho/VENDAS 11-26.xlsx` com as notas disponíveis no Operações Café.
- Fonte: banco local consultado somente em modo leitura; nenhuma alteração feita no banco do programa.
- Critério: operações de venda confirmadas, com documento confirmado e não cancelado, de novembro/2026.
- Resultado: 222 notas fiscais (237 operações consolidadas por NF), de 02/11/2026 a 10/11/2026, totalizando 71.157,736333 sacas.
- A aba `DADOS` foi preenchida preservando o modelo; a aba `RESUMO` foi recalculada com as tarifas efetivamente aplicadas no mês. A tarifa variável de JOÃO MÁRIO foi registrada pela média ponderada para manter o valor financeiro exato.
- Novos clientes adicionados ao resumo: ISABELA KATUAI, RHOWIN e YURI MG.
- Validação: arquivo exportado, reaberto e recalculado; nenhuma ocorrência de `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?` ou `#N/A`; prévias visuais das duas abas conferidas.
- Saída: `outputs/01a0ca6f-27e8-7743-8958-a0a8a9e6d7c6/VENDAS 11-26 - ATUALIZADA 11-11-2026.xlsx`. O original da Área de Trabalho foi preservado.

### 2026-11-11 - Claude (polimento visual, etapa 1)
- Pedido: polir o site inteiro. Exemplos dados: botões pretos com texto preto; confirmação abrindo atrás da janela de cadastro; caixas de seleção; tela de carregamento.
- Feito (`6e5f8cb`):
  - **Camadas (index.css, vale também para o programa):** a confirmação `.ui-dialog` foi para o z 90 (estava em 50, abaixo da janela de cadastro, z 70) e os avisos `.ui-toast` para 120 (estavam em 60).
  - **Janelas de cadastro no site (site-theme.css):** o cabeçalho e o rodapé ficaram claros. No rodapé preto, "Fechar" (`data-tone=quiet`: transparente com texto escuro) ficava invisível. O fundo tem desfoque leve, e a confirmação ganhou largura e espaçamento padrão.
  - **Botões discretos** (Fechar, Cancelar, Voltar, Limpar) ganharam borda leve.
  - **Caixas de seleção:** tamanho de 17 px, cor do site (`accent-color`), sempre ao lado do texto (`label:has(> input[type=checkbox])` em form-grid, inline-check e checkbox).
  - **Carregamento (providers.tsx + index.css):** cartão com spinner verde, "Processando..." e, depois de 5 s, "Ainda trabalhando...".
  - **Cartões em grade** (Configurações, Resumo, Cafés armazenados, Assistente): a margem de `.ui-card + .ui-card` desalinhava o primeiro cartão. Ela foi zerada nas grades, e `.cards > .ui-card` passou a usar `align-content: start`.
- Auditoria automática no site local, em todas as rotas e nas janelas de cliente, empresa e regra: verificados contraste de texto, caixas de seleção acima do texto e áreas escuras com botões. O único caso encontrado foi o rodapé das janelas. A confirmação foi conferida por cima da janela, com a opção cancelada.
- Próximas etapas possíveis: estados vazios, padronizar tabelas e detalhes de nota e cobrança, revisar no celular.

### 2026-11-11 - Claude (repasses: CNPJ em qualquer cliente)
- Pedido: com o cliente ALCA e a empresa FRANCA escolhida no filtro, apareciam só as notas da FRANCA lançadas no ALCA. Faltavam as que foram lançadas no KATUAI.
- Feito (`7259ff8`):
  - `listTransferReconciliationInvoices` aceita `partyDocuments`: todas as notas com esse destinatário (venda) ou emitente (compra), em qualquer cliente. Também inclui as notas já salvas na conferência (`reconciliationId`), para reabrir sem perder nenhuma.
  - Ao salvar, o CNPJ das notas escolhidas é passado para a validação, que aceita as notas de outros clientes.
  - A tela recarrega a lista ao trocar o filtro de empresa. As notas de outro cliente aparecem com "Lançada em KATUAI".
  - A empresa em operação continua filtrando.
  - Teste novo em `transfer-reconciliations.test.ts`; 367 testes passam.
- Publicado: Railway e Pages. Desktop: só na próxima versão.

### 2026-11-11 - Claude (repasses responsivo)
- Pedido: conferir a responsividade da Conferência de repasses.
- Problema: em 1366 px a tabela de notas, com `min-width: 1100px`, alargava a coluna do formulário e ficava cortada embaixo do card de totais. Os campos do topo ficavam espremidos, e no celular o botão "Continuar para pagamentos" saía da tela.
- Feito (`0809c62`, CSS só do site em `web/site-layout.css`, e `data-label` nas células da tabela):
  - `.transfer-page` virou container (`transfer`). Os breakpoints são do espaço real do conteúdo.
  - Até 1320 px de container, os totais saem da coluna lateral e viram uma faixa acima do formulário, sem flutuar por cima das notas. Os botões Salvar e Concluir ficam na faixa.
  - As colunas da tabela ficaram flexíveis, sem largura mínima. Até 860 px, cada nota vira um cartão de 3 colunas com o nome de cada campo; até 520 px, de 2 colunas.
  - Campos e pagamentos usam auto-fit; o título e a barra de busca quebram linha.
- Conferido: sem overflow em 1920, 1366, 1000 e 375 px, nas etapas de notas e de pagamentos.

### 2026-11-11 - Claude (repasses por empresa)
- Pedido: na seleção de notas da Conferência de repasses, mostrar só as notas faturadas pela empresa em operação. Exemplo: em Villa MG, só as da Villa MG; em Grão MG, só as da Grão MG.
- Feito (`b4660e3`):
  - `listTransferReconciliationInvoices` devolve o `ownLegalEntityId` da nota.
  - A tela filtra pela `profile.defaultLegalEntityId` (a empresa em operação). Uma nota já marcada na conferência continua visível, para poder ser desmarcada.
  - O contador mostra "N nota(s) de <empresa>".
- Testado no site local com o cliente ADRIANO D E G, que tem 6 notas: em Villa MG aparecem 4; em Grão MG aparecem 0, porque as outras 2 são da Grão SP.
- Publicado: Railway e Pages.

### 2026-11-11 - Claude (DAE da nota fiscal)
- Pedido: além do DAE de frete, cobrar o DAE referente à nota fiscal no mesmo esquema (marcar e informar o valor), e melhorar o visual das caixas de seleção abaixo de "Observações desta nota".
- Feito (`0888f3a`). É o trabalho não commitado que o Codex viu, agora entregue.
  - Migração `062_fiscal_document_invoice_dae` cria a tabela própria `fiscal_document_invoice_daes`, com uma linha por nota: reference e amount_cents. Ela está em `CENTRAL_SYNCED_TABLES` e em `SYNCED_TABLES`.
  - Foi uma tabela, e não uma coluna em fiscal_documents, porque um PC em versão antiga reenviaria a nota sem a coluna e apagaria o valor. Tabela desconhecida, a versão antiga ignora.
  - `appRepository`: `withInvoiceDae`, `invoiceDaeMap` e `saveInvoiceDae`. Os campos `invoiceDaeReference` e `invoiceDaeAmountCents` entram no FiscalDocument, no create/update, nas resoluções da importação XML e nos esquemas.
  - Na reserva da cobrança, o DAE de frete e o DAE da nota da mesma NF viram um único ajuste, porque há um índice único por nota em cada cobrança. A descrição é "DAE de frete e DAE da nota referentes a NF X" e o motivo traz os dois valores.
  - Os alertas do Resumo somam o DAE da nota.
- Telas:
  - Na importação de XML, as opções viraram o bloco `.note-options` (Financeiro, DAE de frete, DAE da nota fiscal), com a caixa ao lado do título, uma explicação e os campos abrindo quando a opção é marcada. CSS em `src/renderer/styles/index.css`.
  - No detalhe da nota há a seção "DAE da nota fiscal".
  - A prévia da cobrança mostra uma linha para cada DAE.
- Testes: 366 passam, incluindo um teste novo de DAE da nota somado ao de frete. Os testes que fixam o nome da última migração foram atualizados. No site local, importei um XML com DAE da nota de R$ 150 e o valor foi salvo na nota.
- Publicado: Railway e Pages (master). Desktop: só na próxima versão; até lá o DAE da nota deve ser lançado pelo site.

### 2026-11-11 - Codex
- Pedido: depois de alguns dias sem tokens, conferir o que foi feito no período sem refazer trabalho do Claude.
- Feito: releitura integral deste registro; conferidos `git status`, histórico desde `7494eee`, commits-chave da migração, estado remoto e produção. A importação por planilha e os blocos seguintes já tinham sido implementados pelo Claude; o site completo passou a reutilizar o motor e as telas do app, recebeu melhorias visuais, responsivas e de desempenho, além de PNG e importação de pasta XML.
- Verificado em produção: `/health` saudável no commit `769b4f5`, `/ready` com banco conectado e `graobase.com.br` respondendo 200. O Git local e remoto estão em `ff4743f`; os commits posteriores ao servidor são de site/layout.
- Preservado: 14 arquivos rastreados atualmente alterados por outro trabalho em andamento (DAE próprio da nota fiscal, separado do DAE de frete), além dos arquivos locais não rastreados já conhecidos. Nenhum código, banco local ou `tmp/importar-thadeu*` foi alterado nesta auditoria.
- Publicado: nada.
- Pendente: decidir a próxima tarefa somente depois de o trabalho não commitado do Claude ser concluído ou claramente entregue, para evitar sobreposição.

### 2026-11-11 - Claude
- Pedido: primeiro o site (funcionamento, visual, responsividade); as notas antigas ficam para depois. Railway (volume) a ver junto com o Gabriel logado.
- Feito (`769b4f5`):
  - `electronShim`: `BrowserWindow.webContents.executeJavaScript` devolve o SVG do comparativo (extraído do `image.src`) como data URL. "Escolher pasta" (`openDirectory`) junta os uploads em `web-uploads/pasta-<uuid>`; na pasta temporária da chamada, o rmSync do fim apagaria os arquivos antes do inspect.
  - `web/electronRenderer.ts`: download ou clipboard com bytes SVG (.svg/.png) vira PNG por canvas 2x. `deliver` passou a ser async. "Escolher pasta" sem filtro envia só .xml.
  - Testado no site local: comparativo PNG 3200×2320 (salvar e copiar), imagem da cobrança PNG 2200×1796, selectFolder + inspect com 3 XMLs da Vulpe.
- `b3579dd`: o teste `operational-management-api` tinha due_date 2026-11-10 e falhou em 11/11 (OVERDUE). Agora usa 2099.
- Publicado no Railway e no Pages (09:53).

### 2026-11-10 - Claude
- Pedido: seguir os próximos passos e corrigir a responsividade do site inteiro (o conteúdo saía dos cartões ao diminuir a janela).
- Feito:
  - `00e308d`, responsividade, só em `web/site-layout.css`:
    - `.ui-page-section` e `.import-column` com `grid-template-columns: minmax(0,1fr)`, e min-width 0 nos blocos e filhos. O "grid blowout" fazia a coluna implícita crescer até a tabela.
    - `.import-columns` em auto-fit. Resumo e Cobranças viram uma coluna abaixo de 1.250 px.
    - Cartões de resumo em auto-fit com minmax(240px).
    - `.ui-filter-bar` flex, `.charge-cte-card` em auto-fit e select com max-width 100%.
    - Detector de transbordo rodado em 15 telas a 1.000, 1.100 e 1.366 px e no celular: nada fora dos cartões.
  - `8907745`: `getFiscalNumberingAudit` lê os cancelamentos (-eve.xml, 110111/135) de `C:\Vulpe\NFe`. Das 99 vendas "não lançadas" da Villa MG, 52 eram canceladas. Lista das 47 (+2 de novembro) em `outputs/villa-mg-vendas-nao-lancadas.csv` (fora do git).
  - 9 notas tpNF=0 da Grão analisadas, sem mexer em nada:
    - NF 5679 e 5763 (ARAPONGA, só cliente) são compras de produtor.
    - NF 6808, 6810, 6811, 6818, 6821, 6860 e 6867 são "ESTORNO DE NF-E NAO CANCELADA NO PRAZO LEGAL" das vendas 6766, 6741, 6740, 6529, 6782, 6823 e 6737 (KATUAI, BRUNO MAIS BRASIL, EXCELENCIA 3.5 em cobrança PAGA, THADEU, RAFAEL x2, EVANDRO), e essas vendas seguem ativas.
    - Proposta ao Gabriel, aguardando ok: cancelar os 7 estornos e as 6 vendas não cobradas, a 6782 só depois de ele conferir, e 5679/5763 viram compra.
- Não feito:
  - Coletor Villa: `C:\ProgramData\GraoBase\Coletor\coletor-config.json` exige administrador. Criei `coletor-config.json.antes-vulpe-raiz.bak`. O Gabriel vai trocar o xmlRoot para C:\Vulpe e reiniciar o coletor.
  - Login que não cai: adiado. Ao reiniciar, o motor perde também o token do central (só volta quando alguém entra). Manter as sessões deixaria o site sem sincronizar sem aviso. Precisa de uma credencial de serviço do motor junto ao central.
- Pendente do Gabriel: abrir o programa para sincronizar as 259 entradas da Grão (ainda não sincronizadas às 17:47).

### 2026-11-10 - Claude
- Pedido: a próxima parte da reorganização visual.
- Feito (`bb8e94f`, só no site):
  - `ensureSearchPicker`: `.vulpe-search-actions` vira select + "Buscar notas emitidas/recebidas", que clica no botão original escondido. A escolha fica em `localStorage` "site-vulpe-search-choice".
  - O menu "⋯" também vale para duas ações quando a segunda é de perigo. Regras por saca caiu de 13.754 para 8.791 px.
  - `ensureDesktopOnlyHidden` esconde Backups, Criar backup, Restaurar, Retenção, Diretórios e Perfil da instalação, nas Configurações e no menu.
  - `sitePage`: `DEFAULT_CLOSED` (warehouse-stock: "Ajustar estoque manualmente") e reconhece `.warehouse-panel__heading`.
  - `.charge-context-note` fica numa linha.
- Testado no site local: a busca da Villa ES pelo seletor carregou 27 NF-e, sem gravar; mais typecheck, eslint, vitest e build. Publicado no Pages às 17:43.

### 2026-11-10 - Claude
- Pedido: aplicar as melhorias visuais sugeridas na varredura ("do jeito que você achar melhor").
- Feito (`3e4161d`), só no site (`web/siteLayout.ts`, `web/site-layout.css`, `web/siteEnhancer.ts`), mais um ajuste em `ClientLedgerPage.tsx` (app e site):
  - Topo: some o brandline no computador. O nome do usuário vira o menu Trocar senha / Bloquear / Sair (`html.site-user-open`).
  - Menu lateral: grupos recolhíveis, guardados em `localStorage` "site-nav-collapsed-groups". O rodapé fica sem Backup/Versão.
  - Notas e operações:
    - Saem o `.ui-stepper` do topo e o `.notes-direction-hero`; as abas ficam em destaque.
    - A busca deixa de ser caixa dentro de caixa (`:has(.collector-monitor)`).
    - O monitor do coletor fica compacto, com o botão "Detalhes" (`site-monitor-open`).
  - Resumo: `data-site-card` esconde fluxo e estrutura e reordena (sacas-periodo, gráfico, status). Os cartões do topo ganham `data-site-link` e viram clicáveis.
  - Cobranças: "Buscar operações" passa a ser primary. "Dados para pagamento" fica numa linha (`data-site-bank`). A coluna da direita fica sticky. `.charges-column` passa a minmax(0,1fr), o que acabou com a rolagem lateral de 10 px.
  - Linhas com 3 ou mais ações: só a primeira aparece, mais o menu "⋯" (`site-row-menu`/`site-row-open`), em `.row-actions`, `td .actions` e `.table-row > .actions`.
  - `.sub-tabs` com visual de abas. A Conta-corrente sem cliente mostra o EmptyState "Escolha um cliente".
- Testado: no site local (1600×900 e celular), typecheck, eslint, vitest (365) e build do site. Publicado no Pages às 17:28.

### 2026-11-10 - Claude
- Pedido: uma varredura visual do site com sugestões de melhoria. Exemplo do Gabriel: o menu de empresas do topo ficava por cima da empresa.
- Feito (`0675603`): `html.site .app-topbar { z-index: 45 }`. O topo é sticky com z 10, a barra "Nesta página" é fixed com z 40, e o menu de empresas abria por baixo dela.
- Varredura feita no site local (Resumo, Notas e operações, Cobranças, Clientes, Confirmações, Conta-corrente). A lista de sugestões foi entregue ao Gabriel na conversa; nada implementado além do z-index.

### 2026-11-10 - Claude
- Pedido: lançar as entradas antigas da Grão.
- Situação:
  - O coletor da Grão quase não traz notas de fornecedor: só envia a pasta das emitidas, e na inbox há 5 da SP de out/2025. Para essas, precisa mudar a pasta do coletor no PC da Grão (pendente, o Gabriel vai ver se lá usa Vulpe).
  - As notas de entrada que a própria Grão emite (tpNF=0, compra de produtor CFOP 1101/1102/2101/2102) estão na inbox.
- Feito: `tmp/importar-entradas-grao.mts --execute` criou o fornecedor "ENTRADAS NOTAS" da Grão (76e34474…) e lançou MG 256 e SP 3 como PURCHASE, sem erro. A importação gravou direction OUTBOUND (o emitente é a própria Grão), e eu acertei as 259 para INBOUND por UPDATE, com o programa fechado. Cópia antes: `database/backup-antes-entradas-grao-2026-11-10`.
- Achado: 9 notas tpNF=0 da Grão MG já estavam lançadas como SALE/OUTBOUND.
  - NF 5679 e 5763: compras de produtor no ARAPONGA.
  - NF 6808, 6810, 6811, 6818, 6821, 6860 e 6867 (set/2026): no THADEU NOTAS, para RANCHEIRO, MASSIMO ZANETTI, AROMA e GRAN CAFE, ≈3.280 sacas, provável devolução.
  - Causa: com o emitente próprio, a importação deduz venda quando a escolha de compra não é informada. Correção aguardando o Gabriel.

### 2026-11-10 - Claude
- Pedido: lançar também ago/2026 da Grão no THADEU NOTAS.
- O Gabriel enviou o período 01–31/08 no coletor da Grão e fez a busca de MG e SP. Os furos grandes de agosto sumiram da collector-inbox.
- Feito: `PERIOD_END=2026-08-31 tmp/importar-thadeu-grao.mts --execute` (o script agora aceita PERIOD_END). Lançadas MG 212 e SP 10, sem erro. Cópia antes: `database/backup-antes-thadeu-agosto-2026-11-10`.
- Sincronizado às 14:57, sem erro: revisão 3355, 0 chaves duplicadas e nada pendente. THADEU NOTAS cobre as vendas da Grão de out/2024 a ago/2026.

### 2026-11-10 - Claude
- Pedido: ter certeza do número de notas lançadas. O Gabriel mandou `MARCELO.rar` (87 XMLs da Grão para o Marcelo Café, enviados pela funcionária) porque algumas não tinham sido pegas no THADEU.
- Conferência do RAR (`tmp/conferir-xmls.cjs`): as 87 estão no sistema (19 em THADEU NOTAS, 68 em MARCELO). As que faltavam eram 24 de jul/2026 (o furo de julho do coletor) e 6 de 28/08 (fora do período do THADEU). O Gabriel lançou essas hoje às 10:06 no MARCELO.
- Feito (`da452ec`): "Conferência de numeração das notas emitidas" em Notas e operações > Notas emitidas (`NumberingAudit.tsx`, canal `fiscalDocuments:getNumberingAudit`, `getFiscalNumberingAudit` no repositório).
  - Por empresa, série e período, lista os números que faltam, pela chave de acesso (substr 7–20 = CNPJ).
  - Explica pelos XMLs do coletor (`xml-imports/collector-inbox`) e da Vulpe (`C:\Vulpe\NFe`): entre empresas próprias, não é venda (CFOP), complemento, cancelada (evento no banco ou na pasta do coletor), marcada para não cadastrar.
  - Destaca o que precisa de conferência: venda com XML e não lançada, e número sem XML.
- Resultado na base deste PC (jan–out/2026), vendas com XML e não lançadas: Grão MG 969 (≈775 de julho e ≈190 de agosto), Grão SP 32, Villa MG 99. No site o motor só tem os XMLs que já baixou, então lá aparecem mais números "sem XML".
- Pendente: lançar jul/2026 da Grão no THADEU (os XMLs já estão na collector-inbox) depois que terminar a gravação das entradas da Vulpe.

### 2026-11-10 - Claude
- Resultado: entradas lançadas em ENTRADAS NOTAS (fornecedor e4dc1f05…), MG 1.030 e ES 525, sem erro. Depois, jul/2026 da Grão no THADEU NOTAS: MG 762 e SP 19, sem erro (cópia antes: database/backup-antes-thadeu-julho-2026-11-10). Ao abrir, a sincronização falhou com "10 violações de relacionamento": o site tinha lançado às 10:49 cinco notas de entrada (NF 907, 908, 909 e 910 do CNPJ 67994763000176 e NF 832 do 68359026000164) com a mesma chave que o lote, e o INSERT OR REPLACE do pull troca a nota local, deixando órfãos o item e a operação. Removidas as 5 cópias locais (`tmp/remover-duplicadas-site.mts`, com deleteFiscalDocument, ainda não sincronizadas). Às 12:10 o Gabriel sincronizou sem erro: revisão 3345, 0 chaves duplicadas e nada pendente. Ficaram ENTRADAS NOTAS com MG 1.029 e ES 521, e o THADEU de jul/2026 com Grão MG 762 e SP 24. A cobrança do Neto foi para o central com SALARIO GUSTAVO. Melhoria a fazer no app: o pull deve tratar conflito de access_key com uma nota local não sincronizada, em vez de travar.
- Pedido: lançar as notas de ENTRADA antigas da Villa MG/ES. Daqui para frente o Gabriel lança à mão.
- Onde estão: `C:\Vulpe\XML Terceiros\VILLA_COFFEE_MG|VILLA_COFFEE\AAAAMM\Down` (`-nfe.xml` completos; `-resNFe.xml` são só resumo, sem manifestação). Cancelamentos ficam em `AAAAMM\Evento`.
  - O programa ("Recebidas por Villa MG") procura em `C:\Vulpe\NFe`, por isso não acha.
  - O coletor VILLA_MG_ES (`C:\ProgramData\GraoBase\Coletor\coletor-config.json`, `xmlRoot = C:\Vulpe\NFe`) também não envia as entradas. Não alterei.
- Decisões do Gabriel:
  - Fornecedor coringa "ENTRADAS NOTAS", porque o fornecedor do sistema é quem negociou e o mesmo CNPJ emitente aparece em LUCAS, UNI GRAO ES etc.
  - Só compras: CFOP 5101/5102/5103/5105/5106/5356 e 6xxx equivalentes. Ficam de fora armazém e devoluções.
- Script `tmp/importar-entradas-vulpe.mts` (cria o fornecedor e usa o mesmo caminho do THADEU). Simulação: MG 1.030 compras (abr–nov/2026) e ES 524 (nov/2025–nov/2026). Ficaram de fora: MG 114 intercompany, 208 não-compra, 5 complementos e 115 já cadastradas; ES 68 não-compra, 2 complementos e 196 já cadastradas.
- Cópia antes de gravar: `database/backup-antes-entradas-vulpe-2026-11-10`. A gravação foi iniciada às 10:30, com o programa fechado.
- Pendente: depois do Gabriel sincronizar, conferir `access_key` duplicada em fiscal_documents (a última sincronização local antes da gravação foi às 10:18).

### 2026-11-10 - Claude
- Pedidos:
  - Conferência de repasses: somar as notas do Marcelo Café lançadas no THADEU NOTAS, e depois filtrar por empresa/CNPJ, independente do cliente.
  - A cobrança NOSSAS VENDAS out/2026 ainda saía zerada no PDF.
- Feito:
  - `b755994`: `listTransferReconciliationInvoices` também traz notas cujo `fiscal_snapshot_json` recipient.cnpjCpf (venda) ou issuer.cnpjCpf (compra) é um CNPJ do cliente, mesmo com outro responsável. Elas aparecem com "Lançada em X". No banco deste PC, o MARCELO ganhou 19 notas da Grão lançadas em THADEU NOTAS (R$ 16.509.000). A validação ao salvar usa a mesma função.
  - `34ac5da` e o commit anterior: cada nota traz `partyDocument`, e a tela ganhou o select "Empresa/CNPJ da nota". O PDF e a imagem da cobrança negativa mostram "Saldo a favor do cliente R$ - x". `adjustedChargeTotal` não trava mais em 0, com o teste atualizado. A prévia da tela mostra o negativo.
- Testado: vitest (365), typecheck, lista do MARCELO na base deste PC e PDF negativo numa cópia (-8.010,21 no resumo).
- Pendente: o Gabriel gerar de novo a cobrança NOSSAS VENDAS e conferir.

### 2026-11-10 - Claude
- Pedidos do Gabriel:
  - Excluir a cobrança "NOSSAS VENDAS" 01–31/10 (R$ 0,00, "Paga").
  - Cobrança com saldo negativo virando crédito na próxima (opção 2).
  - As barras de título das tabelas do site cobriam as linhas.
- Feito:
  - `99366f6`: `deleteClientCharge` e o botão Excluir não barram mais `PAID` sem valor recebido. O Gabriel excluiu a cobrança. A publicação do site ficou na fila do GitHub por uns minutos.
  - `ffb25f6`: `web/site-theme.css`, com o cabeçalho e o total das tabelas em `position: static`. Presos (sticky), cobriam as linhas, principalmente nas tabelas com rolagem própria.
  - `828f94f`:
    - `recalculateClientCharge` permite `final_amount_cents` negativo, com open ≥ 0 e SERVICE_CHARGE ≥ 0.
    - `syncChargeCarryoverCredit` cria e mantém um CREDIT (`reference_number` SALDO-COBRANCA, `entry_date` = fim do período) quando a cobrança emitida fica negativa. O crédito acompanha enquanto não é usado e é cancelado se a cobrança voltar a ser positiva ou for cancelada. `assertCarryoverCreditUnused` impede excluir ou cancelar se o crédito já foi usado.
    - Cobrança "PAID" zerada ou negativa sem pagamento aceita ajustes.
    - Na tela, aparece "Saldo a favor do cliente".
- Testado: typecheck, vitest (365) e cópia do banco (`tmp/testar-cobranca-negativa.mts`, que está no gitignore). Desconto maior que a cobrança deu -3.000 e crédito de 3.000; ao tirar o desconto, o crédito foi cancelado e a cobrança voltou a 14.024.
- Não testado na tela: emitir no site uma cobrança negativa e ver o crédito entrar na próxima.

### 2026-11-10 - Claude
- Pedido: ajustes repetidos na cobrança. Neto: +1.500 "SALARIO GUSTAVO" todo mês, mais avulsos. Valani (cobrança semanal): juros de 25.000 no dia 6 e 50.000 no dia 16 de todo mês, cada um só na sua semana.
- Como era: a cobrança somava todos os acréscimos e adiantamentos disponíveis da conta-corrente, sem olhar a data (`refreshClientLedgerAvailability`). A observação do lançamento não ia para o ajuste: `applyCredit` gravava reason NULL.
- Feito (`7b42cd3`, app e site):
  - `ClientLedgerPage`:
    - "Repetir" (mensal no mesmo dia, com o dia 31 virando o último dia do mês; ou semanal), de 2 a 60 vezes. Cria um lançamento por data com `referenceNumber` `REPETE-xxxxxxxx` comum.
    - Quadro "Próximos lançamentos programados" e "Cancelar esta e as próximas" (só os ainda não usados: available == amount).
  - `ChargesPage`:
    - Puxa só lançamentos com `entry_date <= periodEnd` da cobrança, do mais antigo para o mais novo. O pré-preenchimento refaz ao trocar o fim do período.
    - O valor coberto pela conta-corrente não exige observação e mostra "Da conta-corrente: …".
  - `applyCredit` grava `reason = notes` do lançamento.
- Testado: typecheck, eslint, vitest (365) e o site local com PAULO BAIA. Séries de 25k (dia 6) e 50k (dia 16) por 3 meses: semana 02–08/11 = só 25k; semana 16–22/11 = 75k (o do dia 6 não cobrado entra junto, de propósito). "Cancelar esta e as próximas" cancelou as 3 do dia 6.
- Não testado: emissão com PDF mostrando a observação vinda da conta-corrente.

### 2026-11-10 - Claude (continuação da velocidade do site)
- Medição em produção depois de `7554e4c`: entrar em Notas e operações deu 20 pedidos e 114 consultas, sem bloqueio. Mas no Resumo, o `billingDashboard:summary` levava 13–45 s.
- Causa: o handler `getBillingSummary` (e também Comparativo e Assistente) faz `await centralSync.synchronize()` antes de calcular. No motor, isso roda dentro da fila única e trava todos os usuários. Somava-se o `getDiagnostics` a cada 5 s, que disparava CENTRAL_DATA_UPDATED e recarregava o Resumo sem parar.
- Feito (`80c79e7`):
  - `server/engine/host.ts` sobrescreve `centralSync.synchronize`. Com `last_success_at` a menos de 2 min, dispara em segundo plano e não espera; sem isso, espera como antes.
  - `useCentralDataRefresh` junta avisos em sequência numa recarga só.
  - `AppLayout` não empilha `getDiagnostics` e faz 15 s no site.
  - O lote não inclui diagnóstico, atualização nem coletor.
- Testado: typecheck, motor, eslint e vitest (365). Publicado no Railway e no Pages. Falta medir em produção, porque o Gabriel precisa entrar de novo depois do reinício.

### 2026-11-10 - Claude
- Pedido: deixar a comunicação do site com o servidor mais rápida. O círculo de carregamento travava a tela a cada troca de página, principalmente em Notas e operações.
- Medição no site (Villa MG, Notas e operações): 2.060 chamadas, 45 s até a última resposta e 22 s com a tela bloqueada.
  - 1.948 chamadas eram `fiscalDocuments:get` (a lista abria nota por nota para somar sacas e serviço).
  - 90 chamadas eram `partnerLegalEntities:list` (uma por parceiro, padrão repetido em 9 telas).
  - A lista de notas tem 8,4 MB e ia sem compressão. Cada ida e volta custa ~270 ms (borda do Railway em gru1, servidor fora do Brasil).
- Feito:
  - `824f3ce` (servidor/app):
    - `POST /v1/app/rpc-batch` (até 200 consultas, em ordem).
    - gzip nas respostas acima de 4 KB (`sendJson` em `appEngineRoutes.ts`).
    - Canal `fiscalDocuments:listServiceSummaries` (`listFiscalDocumentServiceSummaries` no repositório).
    - Preload: métodos list/get/find/preview/calculate/suggest/search/lookup/compare não acendem o overlay e contam em `subscribeReads`.
  - `7554e4c` (telas):
    - `web/electronRenderer.ts` junta as consultas disparadas no mesmo instante (espera 8 ms, até 150 por pedido). Volta a um por um se a rota der 404.
    - `OperationsPage` usa o resumo.
    - `ReadingBar` (barra fina no topo, `.ui-reading-bar`) em `providers.tsx`.
- Testado: typecheck (app, servidor e motor), eslint e vitest (365). No site local, Notas e operações deu 199 consultas em 8 pedidos e 0 ms de overlay. gzip conferido com curl: 8,4 MB viraram 1,8 MB.
- Publicado: servidor primeiro (Railway `824f3ce` conferido), depois o site.
- Observação: cada publicação do servidor derruba as sessões do site, que ficam só na memória do motor, e todos precisam entrar de novo. Vale guardar as sessões no disco.

### 2026-11-09 - Claude
- Pedido: na busca de notas, poder ignorar as remessas simbólicas.
- Feito (commit seguinte a `c243726`, app e site), em `OperationsPage.tsx`:
  - O cartão de remessa/retorno de armazém ganhou a caixa "Não cadastrar", que só aparece na busca (`vulpeScan`). O backend já tratava `ignore` como SKIPPED, e `wasIgnoredByUser` (`handlers.ts`) esconde a chave nas próximas buscas.
  - A revisão da fila ganhou o botão "Não cadastrar as N remessa(s) simbólica(s)" e o inverso. Usa `classifyWarehouseXml(...).movementKind === "SYMBOLIC"`.
  - Na lista, a classificação mostra "Não cadastrar".
- Também: a cobrança do Neto foi corrigida no banco local (reason do acréscimo = SALARIO GUSTAVO), com o programa fechado. Ela sobe ao abrir o programa.
- Testado: typecheck e eslint. NÃO testado na tela, porque o ambiente local não tem busca com remessas simbólicas.
- Grão jul/2026: a collector-inbox não recebeu nada desde 15:18. Falta o Gabriel enviar o período 01/07–31/07/2026 e buscar MG e SP.

### 2026-11-09 - Claude
- Pedido: na cobrança, poder dar uma observação diferente para cada ajuste.
- Feito (`c243726`, app e site), em `ChargesPage.tsx`:
  - O campo único "Motivo do ajuste" (`adjustmentReason`) virou `adjustmentReasons` {advance, discount, surcharge}.
  - Cada valor preenchido (adiantamento, desconto, acréscimo) abre a sua "Observação" logo abaixo. É exigida para aplicar, preparar, emitir e gerar documento (`missingAdjustmentReason`). Cada `addChargeAdjustment` grava a sua.
  - CSS `.charge-adjustment-reason` em `src/renderer/styles/index.css`.
- Testado: typecheck, eslint e o site local sobre a cópia do banco. Sem a observação do acréscimo, o site barra. A cobrança de teste emitida (PAULO BAIA) ficou com "Desconto: PAGO AO ADVOGADO" e "Acréscimo: SALARIO GUSTAVO".
- Publicado: no site. O programa do computador só recebe na próxima versão.

### 2026-11-09 - Claude
- Pedido: cobrança do Neto de out/2026 (`b4205173…`, emitida). O acréscimo de +R$ 1.500 deveria ter a observação "SALARIO GUSTAVO", e não "PAGO AO ADVOGADO".
- Causa: a tela de cobrança (`ChargesPage.tsx`, `applyPendingAdjustmentsToCharge`) usa um só campo `adjustmentReason` para adiantamento, desconto e acréscimo. Não há tela para editar ajuste de cobrança emitida.
- Feito: o PDF corrigido foi gerado por `tmp/pdf-neto-corrigido.mts` sobre uma CÓPIA do banco (o banco real não foi alterado) e salvo em Downloads como "Neto 01-10-2026 a 31-10-2026 (corrigido).pdf". Conferi o texto do PDF: desconto com "PAGO AO ADVOGADO", acréscimo com "SALARIO GUSTAVO", total R$ 30.945,63.
- Pendente: corrigir também no banco, com o programa fechado. O script está pronto no scratchpad (`fix-neto-adjustment.cjs`): faz UPDATE de `client_charge_adjustments` `525a1299…` reason = SALARIO GUSTAVO. Depois o programa sincroniza. Ofereci ao Gabriel separar a observação por tipo de ajuste na tela; sem resposta ainda.

### 2026-11-09 - Claude
- Pedido (retomado, item 1 de "Em andamento"): vendas da Grão & Grão no THADEU NOTAS.
- Feito: `tmp/importar-thadeu-grao.mts --execute` rodou de ~14:55 a 16:18. Lento porque cada arquivo novo do lote demora mais que o anterior. Resultado:
  - Lote MG `19642377…`: 4.098 notas.
  - Lote SP `2572048d…`: 674 notas.
  - As 4.772 estão confirmadas e todas com operação.
  - Por ano na MG: 2024 = 39, 2025 = 1.693, 2026 = 2.377. Na SP: 2024 = 17, 2025 = 473, 2026 = 184.
  - Ficaram de fora: MG 183 intercompany, 317 não-venda e 153 canceladas; SP 1.368 intercompany, 38 não-venda e 27 canceladas.
  - O Gabriel abriu o programa às 15:37 para importar 128 notas de compra da FUTURA (Villa). As duas gravações coexistiram sem erro.
- Cópia anterior do banco: `database/backup-antes-thadeu-grao-2026-11-09`.
- Pendente: o Gabriel abrir o programa para sincronizar. Depois, julho/2026: "Enviar notas do período" de 01/07 a 31/07/2026, busca MG e SP, programa fechado e rodar o script de novo. Ele pula as chaves já cadastradas.

### 2026-11-09 - Claude
- Pedido: na Conferência de repasses, uma caixa para marcar todas as notas de uma vez.
- Feito (`c3984d3`), em `TransferReconciliationsPage.tsx` (app e site):
  - Caixa no cabeçalho da lista. Marca ou desmarca todas as notas que batem com a pesquisa, inclusive as ainda escondidas pelo "Mostrar mais notas".
  - Só entram notas com saldo disponível, cada uma com o saldo inteiro. Fica no estado intermediário quando só parte das notas está marcada.
- Testado: typecheck, eslint e o site local, com o fornecedor CEREAIS (121 notas): marcar, desmarcar uma, estado intermediário, marcar e desmarcar todas.
- Publicado: no site.
- Em paralelo: `tmp/importar-thadeu-grao.mts --execute` rodando desde ~14:55. Cópia do banco em `database/backup-antes-thadeu-grao-2026-11-09`. Simulação: MG 4.098 vendas e SP 674. Pela numeração, as duas começam em set/2024. Falta jul/2026: MG nº 4819–5992 e SP nº 2078–2304. Isso precisa de novo "Enviar notas do período" de 01/07 a 31/07/2026.

### 2026-11-09 - Claude
- Pedido: na lista de notas, nota com responsável trocado para fornecedor mostrava um id no lugar do nome. Pedido também de diferença visual entre notas de cliente e de fornecedor.
- Feito (`96f2376`), no app e no site, porque `OperationsPage.tsx` e `src/renderer/styles/index.css` são os mesmos:
  - `documentClientName` passou a procurar em `allKnownPartners` (clientes e fornecedores), e não só em `partners`, que tem apenas o papel da tela.
  - Cada linha ganhou etiqueta e faixa na borda pela direção da nota: Cliente (OUTBOUND, verde), Fornecedor (INBOUND, laranja) ou Triangulada (com `secondaryResponsiblePartnerId`, roxo).
- Testado: typecheck, eslint e o site local sobre uma cópia do banco. As notas 963–970 aparecem como Fornecedor (LUCAS, PRIME), sem nenhum id na lista.
- Publicado: no site (Pages). O programa do computador só recebe na próxima versão, que não foi gerada.

### 2026-11-09 - Claude
- Pedido: no site, "Trocar responsável e recalcular" (detalhe da nota) dava "Caminho de arquivo não permitido no site".
- Causa: a tela manda a nota inteira em `updateFiscalDocument`, inclusive `xmlFilePath` gravado por um PC (`C:\Users\...`), e a proteção de caminhos do motor barrava qualquer caminho fora das pastas dele. O schema do app descarta esse campo, então o caminho nem seria usado.
- Feito (`bf24984`): em `server/engine/host.ts`, `assertSafePaths` virou `sanitizePaths`. Campo de objeto com nome terminado em `Path` e caminho fora das pastas do motor vira `null`. Os demais caminhos de fora continuam barrados.
- Testado: typecheck do motor, eslint, build do motor e chamada direta ao motor (`xmlFilePath` de fora passa, outro campo com `C:/Windows/...` é barrado). Publicado no Railway, porque a mudança está em `server/`.
- Grão: o envio do período antigo terminou às ~12:13, com 7.029 XMLs e 1 "aguardando novo envio" (status "falhou" só por isso). Falta o Gabriel buscar no programa (Grão MG e SP, 01/01/2024–30/06/2026), fechar o programa e rodar `tmp/importar-thadeu-grao.mts`. Conferir furos na numeração das vendas.

### 2026-11-09 - Claude
- Pedido: na tela de Cobranças do site, a tabela de notas (com "Receber NF") passava por cima do painel de ajustes ao lado.
- Causa: o `overflow: clip` que pus em `.table` para o cabeçalho fixo faz o `min-width` automático do item da grade valer o conteúdo, e a tabela larga empurrava a coluna. Feito (`e01a2a2`): `.table`/`.ui-table-wrap`/`.warehouse-table-wrap` com `min-width: 0` e `overflow-x: auto` (como no app); `web/siteTables.ts` marca `site-table-fits` nas que cabem na largura, e só essas usam `overflow: clip` (cabeçalho fixo). Tabela larga rola para o lado e o cabeçalho dela não fica fixo.
- Também em andamento: coletor da Grão (1.1.71) recebeu "Enviar notas do período" 01/01/2024–30/06/2026 às ~10:43; o "Comando desconhecido" anterior era de antes da atualização.

### 2026-11-09 - Claude
- Pedido: tela de entrada com a marca e uso no celular/tablet.
- Feito (`4f7e58a`), só no site:
  - Marca: usei a **Grãonex** (logo e ícone que já existem em `public/assets/branding/graonex`, os mesmos do rodapé dos PDFs), não "GrãoBase" (que é só o domínio). `web/siteLayout.ts` acrescenta um `aside.site-auth-brand` no `.auth-shell` (login e escolha de empresa); o aviso "Computador autorizado" fica escondido no site.
  - Celular/tablet (`web/site-layout.css`, até 960 px): menu lateral vira gaveta (`html.site-menu-open`, botão `.site-menu-toggle` acrescentado no topo; fecha ao clicar num item, porque o app troca de tela por `pushState`, sem evento de hash); nomes do menu reaparecem na gaveta (o app esconde `.nav-label` em telas estreitas); topo em duas linhas (seletor de empresa embaixo, só o botão Sair); grades com `-grid`/`grid-`/`.form-grid` em uma coluna, `.cards` em duas; `.table` rola para o lado (linhas com `min-width: 760px`); linhas de título com botões quebram.
- Testado no motor local em 375 px e 1440 px: entrada, escolha de empresa, gaveta, Cobranças, Confirmações (botões dentro da tela, tabela rolando). Pages às 10:33; Railway não republicou.
- Observação para testes: com o painel do navegador escondido, as capturas de tela podem vir atrasadas; recarregar a página resolve.

### 2026-11-09 - Claude
- Pedido: tabelas e menu lateral.
- Feito (`f3d0464`), só no site (Railway não republicou, confirmando os watchPatterns):
  - `web/siteTables.ts`: linha "Total · N linhas" no fim das tabelas `.table` (div com `.table-head`) e `<table>` (tfoot), somando colunas cujo cabeçalho é de valor (Valor, Total, Saldo, Pago, Aberto, Sacas, Quantidade, Desconto, Crédito, Débito...) quando 80% das células visíveis são números; só reescreve quando os números mudam.
  - CSS: cabeçalho das tabelas `sticky` (`--site-sticky-top` = 44px quando há a barra "Nesta página"); `.table` com `overflow: clip` (com `hidden` o sticky não funciona); linha de total presa no rodapé; botões de ação da linha com opacidade até o mouse passar (só em telas com mouse).
  - Menu: `.app-sidebar__nav` em coluna e o botão "Mostrar administração" com `order: 99` (fim do menu). `web/siteCommand.ts`: botão "Ir para..." inserido após `.app-sidebar__brand` e atalho Ctrl+K; lista as telas de `navigationGroups` (inclusive administração) e navega por `location.hash`.
- Testado no motor local: total das confirmações bate com o resumo (24.566,853 sacas; R$ 28.480.332,64), cabeçalho e total fixos ao rolar, busca "conta" → Conta-corrente, menu com administração no fim.

### 2026-11-09 - Claude
- Pedido: na importação de XML pelo site apareciam dois avisos "Erro XML: Failed to fetch", mas a nota ficava importada.
- Causa provável: o Railway republicava o servidor a cada push no GitHub, inclusive commits só de documentação (o `702bf03`, do registro, foi publicado às ~09:50). A troca de versão corta pedidos em andamento e zera as sessões do motor. A nota já tinha sido gravada.
- Feito (`3fd92e8`): `railway.toml` com `watchPatterns` (server, electron/main, src/shared, scripts/engine, public, package*, tsconfig.server.json, railway.toml); push só de docs, `web/` ou `src/renderer` não republica o servidor. **Atenção:** quem mexer em arquivo que o servidor usa fora dessa lista precisa incluir o caminho. No site: `postRpc` em `web/electronRenderer.ts` repete consultas (canais de leitura) até 2 vezes e troca "Failed to fetch" por mensagem clara ("a operação pode ter sido concluída"); avisos com o mesmo texto em 8 s aparecem uma vez só.

### 2026-11-09 - Claude
- Pedido: avisos flutuantes e telas longas mais navegáveis; no meio, arrumar o nome no canto superior esquerdo ("Villa Coffee Operações" colado com "Villa Coffee").
- Feito (`a616952`), só no site:
  - `web/siteToasts.ts`: observa `.feedback`, `.transfer-message`, `.ui-alert--success`, `.warehouse-feedback`, `.period-comparison__message` e `p.success`; cada texto novo vira aviso no canto (erro pelo texto: "Erro", "não foi possível", "selecione", "informe", "inválido"...). O texto passa por `accentText` antes de comparar, para a correção de acento não gerar aviso duplicado. O parágrafo original fica discreto na página.
  - `web/sitePage.ts`: barra fixa "Nesta página" (anexada ao body, fora do React) com os h2/h3 visíveis da tela quando há 3 ou mais; títulos de `.admin-block`/`.ui-page-section` ficam clicáveis para recolher, guardado em localStorage `operacoes-cafe-site-secoes-fechadas` por rota.
  - CSS: grupo `.actions/.toolbar/.inline-actions` que é o último filho de uma seção e tem botão principal fica `sticky` no rodapé. Nome do sistema e do grupo empilhados na barra lateral.
- Testado no motor local (Cobranças e Conta-corrente): índice, atalho, recolher/lembrar, avisos simulados de sucesso e erro. Pages às 09:46.

### 2026-11-09 - Claude
- Pedido: itens 1, 2 e 3 da lista de melhorias visuais (seletor único de empresa, acentos, números formatados).
- Feito (`2c9f3fc`):
  - `src/renderer/layouts/CompanySwitcher.tsx`: seletor único (empresas de todos os grupos, agrupadas, com bandeira) que troca grupo e CNPJ de uma vez (`changeCompany` em `App.tsx`). Só aparece no site: `AppLayout` recebe `companySwitcher` quando `isWebSite()` (classe `site` posta por `web/siteFlag.ts` antes das telas carregarem); no app do Windows o topo continua com Grupo + Empresa/CNPJ. `stateFlagSrc` mudou de `AppLayout.tsx` para esse arquivo.
  - `web/siteText.ts`: acentos só na exibição do site (dicionário de palavras; texto exibido e atributos placeholder/title/aria-label; nunca input/textarea/select nem palavras TODAS MAIÚSCULAS). Corrige também mensagens do servidor. Para pôr acento de verdade no código do app, cuidado com textos usados como chave (ex.: menus legados em `navigation.ts`).
  - `formatSacks` em `src/shared/utils/format.ts`, usado nas confirmações (resumo, lista), cobranças (`ChargeOperationsTable`) e detalhes de nota. Cartões de resumo com fonte que se ajusta à largura (container query) para valores grandes caberem numa linha.
- Testado no motor local: seletor (troca Grão MG → Villa ES muda grupo e tema), acentos, sacas; suíte (365), typecheck, ESLint, build. Pages às 09:37.

### 2026-11-09 - Claude
- Pedido: melhorar o visual do site (separar botões, seções e funções; rebranding permitido; mais intuitivo e bonito).
- Feito (`a9676fa`): tema só do site em `web/site-theme.css` (importado por último em `web/main.ts`, tudo sob `html.site`; o programa do Windows não muda). `web/siteEnhancer.ts` marca cada botão com `data-tone` pelo texto: `primary` (salvar, emitir, gerar, criar...), `accent` (buscar, abrir, selecionar, prévia...), `danger` (excluir, estornar, "cancelar X"...), `quiet` (cancelar, fechar, voltar, limpar). Botões que o app já marca (`primary`, `danger`, `ui-button--*`) e abas/menu ficam fora. Abas de página (`.settings-tabs`) sublinhadas; `.ui-tabs` vira seletor em pílula; `admin-block`/`ui-page-section` viram cartões com faixa de título; tabelas com linhas alternadas; topo em uma linha (o quadro "Operando em" mantém a bandeira do estado); cartões de empresa na entrada com a escolhida destacada. A cor de ação vem de `--color-sidebar` recalculada em `.app-shell` (Villa preto/dourado, Grão verde).
- Atenção para quem mexer: a regra base de botão usa `:where()` de propósito (especificidade baixa) para as variações vencerem; as regras do tema usam `!important` porque o CSS do app tem seletores `button:not(...)` muito específicos.
- Testado no motor local com cópia dos dados: entrada, Cobranças, Notas e operações, Confirmações, Financeiro, Villa e Grão; build do site.

### 2026-11-06 - Claude
- Pedido: "Pode upar o site, a gente vai ajustando isso com o tempo de uso".
- Feito (`20c71a2`): o site completo (mesmas telas do app) virou a página principal de graobase.com.br (`vite.web.config.ts` com base `/`). O site de consulta (mobile-viewer, melhor no celular) é montado com `--base=/consulta/` e fica em graobase.com.br/consulta/. /app/ redireciona para a raiz mantendo a tela (hash). O workflow do Pages monta tudo na pasta `site/` (raiz + ícones + consulta + app).
- Conferido: montagem local completa (raiz, /consulta/ e o redirecionamento de /app/) e produção às 20:10 (raiz abre o login do app; /consulta/ abre o login da consulta).

### 2026-11-06 - Claude
- Pedido: "Os coletores não estão funcionando" (site novo).
- Causa: Villa MG e Villa ES nunca tiveram coletor; o app do computador principal lê `C:\Vulpe\NFe\VILLA_COFFEE_MG` e `VILLA_COFFEE` direto. No servidor essas pastas não existem, então as fontes ficavam indisponíveis (e "Todas as empresas" também).
- Feito (`9576b4e`): em `handlers.ts`, `vulpeDevSources` ganhou `collectorSourceCode: "VILLA_MG_ES"`; sem a pasta e com sessão central, a busca usa a fila do coletor `VILLA_MG_ES` (no PC principal nada muda). Railway em `9576b4e` às 19:59.
- Pacote do coletor para este PC em `.codex-tmp/Coletor GraoBase - Villa MG e ES/` (exe 1.1.70, `sourceCode` VILLA_MG_ES, CNPJs 44963370000523 e 44963370000280, `xmlRoot` C:\Vulpe\NFe). Tem a credencial do coletor: não commitar `.codex-tmp`. Falta Gabriel rodar INSTALAR-COLETOR.cmd (pede administrador) e, depois, pedir pelo site o envio das notas antigas (BACKFILL), porque o coletor só manda o último mês.
- Não verificado em produção: coletores da Grão e da Villa SP pelo site (precisa de login real). Depois de cada publicação no Railway o motor reinicia e é preciso entrar de novo no site.

### 2026-11-06 - Claude
- Pedido: no site novo o botão "Cancelar lançamento" da conta-corrente não funcionava.
- Causa: a tela usava `window.prompt`, que não existe no Electron e é bloqueado por alguns navegadores. Trocado por `requestTextInput` (janela do próprio app) em `ClientLedgerPage.tsx` e em `WarehouseStockPage.tsx` (NF de remessa). Vale também para o app na próxima versão.
- Testado na cópia local (motor + site): janela aparece e o lançamento fica Cancelado. Publicado `5bb3869`; Pages atualizado às 19:46.

### 2026-11-06 - Claude
- Pedido: site 100% igual ao app (visual e funções), "tipo copia e cola", para parar de usar o app. Gabriel escolheu o caminho "motor do programa".
- Corrigido antes: cartões de confirmação vazios no site atual (`2f03641`; o botão invisível que abria o cartão recebia o fundo do estilo global de botões).
- Feito: `server/engine/`: `host.ts` cria o mesmo `AppRepository`, `CentralSyncService` e `registerIpcHandlers` do app sobre um SQLite próprio (`ENGINE_DATA_DIR`, padrão `/data/engine` se existir, senão `/tmp/operacoes-cafe-engine`). `electronShim.ts` troca o Electron: `showSaveDialog` devolve um caminho temporário e o que o app gravar ali vira download; `shell.openPath` vira download; `showOpenDialog` pede arquivo ao navegador (`needsUpload`), que envia por `/v1/app/upload` e repete a chamada; impressão e área de transferência vão para o navegador. `scripts/engine/build-engine.mjs` (esbuild) monta `dist-engine/host.mjs`. Uma chamada por vez; antes de cada uma o motor aponta a sessão (`AuthService.useSession`) e a empresa ativa (`installation_profiles`) do navegador que pediu. Bloqueados no site: criar primeiro administrador, restaurar/backup/reset e atualização do instalador; caminhos de arquivo vindos do navegador só podem apontar para os uploads/temporários do motor. `authNeedsBootstrap` é sempre falso e `authCentralConnectionStatus` diz configurado, porque o login do app provisiona o usuário a partir do central.
- `server/src/appEngineRoutes.ts`: `POST /v1/app/rpc` e `POST /v1/app/upload`, com o cabeçalho `x-app-session` (64 hex gerados no navegador). `index.ts` carrega o motor só no primeiro uso e aponta `OPERACOES_CAFE_CENTRAL_URL` para o próprio servidor.
- `web/`: `main.ts` carrega `electron/preload/index.ts` (com `electron` trocado por `web/electronRenderer.ts`) e depois `src/renderer/App.tsx`. Config `vite.web.config.ts` (base `/app/`, pasta pública `public/`). O workflow do Pages monta e copia para `mobile-viewer/dist/app`.
- No app (sem mudar comportamento): `AuthService.getCurrentSessionId/useSession`, `registerIpcHandlers(..., { auth })`, `OPERACOES_CAFE_CENTRAL_URL` em `centralSyncService.ts`, e logos de PDF achadas também em `process.cwd()/public` (`chargeDocuments.ts`, `dealConfirmationFiles.ts`, `financialFiles.ts`).
- `server/Dockerfile`: agora `node:22-bookworm-slim`, copia `electron/main`, `src/shared` e `scripts/engine`, monta o motor e leva `dist-engine` para a imagem final. `tsconfig.server.json` exclui `server/engine`; checagem em `tsconfig.engine.json`.
- Testado: motor local sobre uma cópia do banco deste PC (`tmp/engine-local/`, com central falso e usuário de teste criado só na cópia): login do app, escolha de empresa, Resumo, Confirmações e PDF de prévia indo para o navegador. Suíte completa (365), typecheck, ESLint, build do site atual e do novo, simulação Docker. Produção: Railway em `a4ff0db`; `/v1/app/rpc` responde e exige login; graobase.com.br/app/ abre a tela de login do app.
- Para testar local: `node tmp/engine-local/fake-central.mjs`, `node tmp/engine-local/run-engine.mjs <pasta>`, `web/.env.local` com `VITE_API_URL=http://127.0.0.1:4790` e a configuração `app-web-dev` (porta 5175, abrir /app/).

### 2026-11-06 - Claude
- Pedido: "Pode continuar com repasses e acertos de entrada".
- Feito: `server/src/settlementManagement.ts`. Repasses em `/v1/manage/transfer-reconciliations`: `/partners` (por papel), `/invoices` (mesma conta do app: notas de cadastros com o mesmo CNPJ ou nome normalizado, de qualquer empresa, descontando o que outras conferências usaram; rascunho usa o valor das notas, concluída usa o que foi pago), `/balances`, `GET /:id`, `POST` (criar ou editar, notas ou valor manual, pagamentos; reaproveita a linha da mesma nota por causa do UNIQUE do app), `/:id/cancel` e `DELETE /:id`. Acertos de entrada em `/v1/manage/purchase-settlements`: `/options` (fornecedores e categorias), `/eligible` (compras confirmadas, sem pendência, com regra de entrada e não acertadas), `POST` (conta a pagar IMPORT já confirmada, `account_payable_operations`, compras SETTLED, histórico DRAFT → OPEN), `/:id/operations` e `/:id/cancel` (sem pagamento; libera as compras para UNSETTLED). `/v1/viewer/payables` passou a devolver `source`.
- Tela: `TransferReconciliationsTab.tsx` reescrita (lista, saldos por cliente, gaveta de criar/editar, cancelar, excluir). `PurchaseSettlementsTab.tsx` reescrita: aba "Gerar acerto" (compras agrupadas por fornecedor e empresa, desmarcar notas, categoria e vencimento) e aba "Histórico" (só acertos, ver notas, cancelar).
- Diferença deliberada: o site não roda `completeKnownSupplierTriangulations` antes de listar as compras.
- Testado: `tests/settlement-management-api.test.ts` (3), suíte completa (365), typecheck, ESLint, build do site, simulação Docker. Tela conferida com `tmp/fake-settlement-api.mts`: conferência com NF da Villa e da Grão, 2 pagamentos, crédito de R$ 5.000, edição recarregando tudo, saldos; acerto com uma nota desmarcada, histórico, cancelamento devolvendo as notas; gaveta no celular.
- Publicado: commit `f310587` na branch e na `master`. Railway em `f310587` às 15:46 (rota nova devolve 401 sem sessão). GitHub Pages publicou `index-BrjC44I4.js` às 15:46.
- Pendente: ver "Falta do bloco 4" em Em andamento.

### 2026-11-06 - Claude
- Pedido: "Pode continuar com cobranças e conta-corrente".
- Feito: `server/src/chargeManagement.ts`. Cada ação carrega a cobrança com as linhas ligadas (`ChargeWork` sobre um `RowSet` que guarda o original), aplica a regra do `AppRepository` e grava só a diferença. Rotas em `/v1/manage/client-charges`: `POST /drafts` (reserva as notas como RESERVED, retrato da nota, DAE automático), `GET/PUT/DELETE /:id`, `/operations` e `/operations/release` (DAE sai junto com a nota), `/adjustments` e `DELETE /adjustments/:id`, `/cte` (mesmo `calculateChargeCte` do app), `/credits` (consome `available_amount_cents`), `/submit-review`, `/issue` (BILLED, `SERVICE_CHARGE`, `snapshot_json`), `/cancel` (devolve notas e créditos), `GET /:id/pdf|excel|image` (imagem vai em SVG e o navegador converte em PNG) e `POST /control` (controle interno em xlsx ou HTML para imprimir). Pagamentos: `GET /v1/manage/client-payments`, `POST /client-payments/batch` (um recebimento distribuído entre várias cobranças, sobra fica disponível) e `/client-payments/:id/allocate`. Conta-corrente: `/ledger-entries/:id/apply` e `/ledger-entries/:id/collected` (empréstimo recebido). `recalculate` repete `recalculateClientCharge` e atualiza o `SERVICE_CHARGE`.
- No app: `chargeDocuments.ts` passou a exportar `buildChargeWorkbook` e `buildChargeSummarySvg` (sem mudar o que o app gera). `viewer.ts` exporta `refreshedOperationSnapshots`. `server/Dockerfile` copia `chargeControlWorkbook.ts`.
- Diferença deliberada: remover no site um ajuste que veio de crédito da conta-corrente cancela a alocação e devolve o saldo ao lançamento; o app hoje só apaga o ajuste e o saldo fica preso (ver Recados).
- Tela: `mobile-viewer/src/ChargeEditor.tsx` (gaveta da cobrança e "Receber e distribuir"). Em `ChargesTab.tsx`: "Gerar rascunho" ao lado de "Emitir direto", botão "Abrir" nos cards, "Controle em Excel", "Imprimir controle" e "Receber e distribuir". Em `LedgerTab.tsx`: "Usar em cobrança", "Marcar recebido" e o quadro de pagamentos com sobra.
- Testado: `tests/charge-management-api.test.ts` (4, inclui PDF, Excel e SVG reais), suíte completa (362), typecheck, ESLint, build do site, simulação Docker. Tela conferida com `tmp/fake-charge-api.mts`: rascunho com 4 notas e DAE, desconto, CT-e das notas Vassuler (520 sc × R$ 1,50), empréstimo e adiantamento usados, conferência, emissão, imagem convertida em PNG, recebimento de R$ 2.500 com sobra de R$ 205, empréstimo marcado como recebido, gaveta no celular.
- Publicado: commit `7e53877` na branch e na `master`. Railway em `7e53877` às 15:32 (rota nova devolve 401 sem sessão). GitHub Pages publicou `index-xXlaYP6Y.js` às 15:33.
- Pendente: ver "Falta do bloco 3" em Em andamento.

### 2026-11-06 - Claude
- Pedido: "Pode começar as confirmações".
- Feito: `server/src/confirmationManagement.ts`. Cada ação carrega a confirmação inteira (`DealWork`), aplica a regra do `AppRepository` em memória e grava só a diferença. Rotas em `/v1/manage/confirmations`: criar (em branco ou a partir de notas, com itens oficiais da NF, contas e condições padrão da empresa e modelo padrão), editar cabeçalho, itens, partes (empresa, cliente ou manual, com retrato do cadastro), cláusulas (com modelos), parcelas (soma 100% quando há percentual), assinantes (status agregado), conferência, emitir (pendências críticas bloqueiam; número com o prefixo da empresa, piso de `document_sequences` e reaproveitamento de buracos, igual ao app), enviada/assinada, cancelar, substituir, duplicar, excluir rascunho sem número, GET `/:id/pdf` com o mesmo `buildConfirmationPdf` do app. Diferenças: o site não grava `deal_confirmation_document_versions` (arquivos locais de cada PC); a prévia do rascunho não reserva número. `server/Dockerfile` copia `dealConfirmationFiles.ts` e `electron/main/database/mappers.ts`. Tela: `mobile-viewer/src/ConfirmationEditor.tsx` (nova confirmação e editor), cards clicáveis em `ConfirmationsTab.tsx`, `downloadConfirmationPdf` em `api.ts`.
- Testado: `tests/confirmation-management-api.test.ts` (6, inclui PDF real), suíte completa (358), typecheck, ESLint, build do site, simulação Docker. Tela conferida com `tmp/fake-confirmation-api.mts` (ids UUID): criada a partir da NF 1203, comprador e vendedor incluídos, cláusula de modelo, emitida como VCMG 0001, PDF aberto e conferido.
- Observação: no PDF o título "Clausulas" encosta no texto da primeira cláusula; vem do gerador do app (`dealConfirmationFiles.ts`), igual nos dois.
- Publicado: commit `8aaa85d` na branch e na `master`. Railway em `8aaa85d` às 14:55 (`/ready` com banco conectado; rota devolve 401 sem sessão). GitHub Pages publicou `index-DjSmU2hw.js` às 14:58.
- Pendente: PDF assinado, modelos de confirmação/cláusula, piso da numeração e relatórios; depois completar cobranças e conta-corrente.

### 2026-11-06 - Claude (continuando o Codex)
- Pedido: continuar a migração depois que os créditos do Codex acabaram no meio da importação por planilha.
- Feito: revisão do `server/src/spreadsheetManagement.ts` do Codex (inspect/validate/import, limite web 1.000 linhas/15 MB, duplicidade por empresa+responsável+NF+série+data). Ajustes para ficar igual ao app: coluna Cliente escolhe o cadastro pelo nome exato em cada linha (erro se não for único ou sem o papel certo), linhas com aviso só entram com `importWarnings`, conflito de tarifa vira erro da linha. As tabelas `spreadsheet_import_jobs/rows` gravadas no central não sincronizam com os PCs e não têm chave estrangeira nas notas: conferido que não quebra a sincronização. Tela `mobile-viewer/src/SpreadsheetImport.tsx` (arquivo, aba, cabeçalho, colunas sugeridas, padrões, validação linha a linha, importar) e botão "Importar planilha" em `InvoicesTab.tsx`.
- Testado: `tests/spreadsheet-management-api.test.ts` (3, com .xlsx real gerado pelo exceljs), suíte completa (352), typecheck, ESLint, build do site, simulação Docker. Tela conferida com o servidor de teste: 5 linhas, NF 101 agrupada (120,5 sacas), cliente inexistente com erro, linha de aviso fora por padrão.
- Publicado: commit `80a5a3d` na branch e na `master`. Railway em `80a5a3d` às 14:36 (`/ready` com banco conectado; rota da planilha devolve 401 sem sessão). GitHub Pages publicou `index-qrTS0Cn4.js` às 14:39.
- Pendente: confirmações e documentos; resto da lista em "Em andamento".

### 2026-11-06 09:25 - Codex
- Pedido: manter o trabalho do Codex e do Claude coordenado pelo `REGISTRO_AGENTES.md`, sem repetir alterações.
- Feito: reli Recados, Em andamento, Situação atual, Git e código depois dos commits simultâneos do Claude. Não refiz nenhuma implementação. Confirmei que os blocos posteriores do Claude contêm e ampliam o importador XML iniciado no commit `8858b50` e atualizei o estado compartilhado: XMLs especiais estão concluídos; o próximo bloco é planilha.
- Testado: Railway `/health` no commit `e70ec03` e `/ready` com banco conectado; `graobase.com.br` serve o bundle `index-DhUaSF-9.js`, contendo as rotas `/xml/inspect`, `/xml/warehouse` e `/xml/triangulated`.
- Publicado: código já havia sido enviado pelo Claude; esta entrada somente registra a verificação da produção.
- Pendente: importação por planilha; depois confirmações, repasses, contas a pagar e administração. Recado do endereço de empresas terceirizadas no app permanece para uma próxima versão do desktop.

### 2026-11-06 - Claude
- Pedido: "Pode continuar com os XMLs especiais".
- Feito: `server/src/specialXml.ts` com POST `/v1/manage/invoices/xml/inspect` (classifica INVOICE/EVENT/WAREHOUSE/TRIANGULATED), `/xml/event` (registra evento; cancelamento aceito cancela nota e movimentos de armazém, mesmo nota cobrada, como o app), `/xml/warehouse` (movimentos com `deterministicUuid("warehouseMovement", chave, item)`, nomes canônicos dos ajustes manuais, referência da remessa, simbólica sem referência fica PENDING_REVIEW) e `/xml/triangulated` (compra do fornecedor + venda ao cliente por item, contrapartes como no app). `server/src/fiscalEvents.ts`: evento recebido antes da nota faz a nota entrar cancelada (usado também na importação do Codex). Tela: `mobile-viewer/src/SpecialXmlImport.tsx`; `InvoicesTab.tsx` chama /inspect antes da prévia normal.
- Testado: `tests/special-xml-api.test.ts` (4), suíte completa (349), typecheck, ESLint, build do site, simulação do build Docker. Tela conferida com servidor de teste (triangulada e armazém); painel de evento não aberto no navegador.
- Publicado: commit `e70ec03` enviado à branch e à `master`; Railway e Pages conferidos depois pelo Codex (ver entrada acima).
- Pendente: importação por planilha; recado do endereço das terceirizadas no app.

### 2026-11-06 - Claude
- Pedido: "Pode continuar com as operações de terceiros".
- Feito: `server/src/thirdPartyEntities.ts` cria ou reaproveita a empresa TERC-XML pelo CNPJ com o mesmo `deterministicUuid("thirdPartyLegalEntity", cnpj)` do app (conferido: 9 das 16 empresas atuais têm esse id; as 7 de 28/07 são anteriores e são reaproveitadas pelo CNPJ). `server/Dockerfile` copia `deterministicId.ts`. Lançamento manual aceita `issuerPartnerLegalEntityId` (empresas sem cliente vinculado, GET `/v1/manage/third-party-issuers`), como `resolveIssuerLegalEntityFromPartner`. Importação de XML do Codex (`operationalManagement.ts`): empresas TERC-XML deixam de contar como próprias; nota sem CNPJ próprio vira terceirizada (venda sob a TERC-XML do emitente, observação "Nota terceirizada..."); emitente que é fornecedor cadastrado (triangulada) é recusado com aviso para usar o app. Permissão de nota terceirizada vale pela organização. Tela: emissora própria/terceirizada no lançamento, aviso na prévia do XML, etiqueta "Terceirizada" no painel.
- Testado: 2 testes novos (manual com id determinístico e reaproveitamento; XML terceirizado e triangulado recusado), suíte completa (345), typecheck, ESLint, build do site, simulação do build Docker. Tela conferida com o servidor de teste local.
- Publicado: commit `9989a0e` na branch e na `master`. Railway em `9989a0e` às 12:11 (`/ready` com banco conectado; rota de emissoras devolve 401 sem sessão). GitHub Pages publicou `index-whUTenIg.js` às 12:13.
- Pendente: XMLs especiais (armazém, eventos de cancelamento, triangulação) e planilha.

### 2026-11-06 - Claude
- Pedido: "Pode continuar com as devoluções e o DAE".
- Feito: em `server/src/invoiceManagement.ts`, POST `/v1/manage/invoices/:id/returns` e DELETE `/v1/manage/invoice-returns/:id`, espelhando `addFiscalDocumentReturn`/`recalculateDocumentReturnQuantities`/`recalculateClientCharge`: kg ÷ 60, abate na ordem das vendas, limite das sacas brutas, bloqueio depois de pagamento na cobrança, sacaria bloqueada; se a operação está numa cobrança em aberto, atualiza o retrato em `client_charge_operations`, os totais de `client_charges` e o lançamento `SERVICE_CHARGE` da conta-corrente. DAE de frete (valor e referência) no lançamento e na edição; a referência é descartada quando o valor é zero, como no app. Tela: seção Devoluções no painel da nota, sacas brutas x líquidas na operação, campos de DAE nos formulários.
- Testado: 3 testes novos (DAE, devolução e exclusão, cobrança em aberto com DAE e bloqueio após pagamento), suíte completa (343), typecheck, ESLint e build do site. Tela conferida com o servidor de teste local: devolução de 600 kg virou 10 sacas e baixou o serviço de R$ 2.200 para R$ 2.150, remoção restaurou, DAE aparece no resumo e no formulário.
- Publicado: commit `2f13c61` na branch e na `master`. Railway em `2f13c61` às 11:53 (`/ready` com banco conectado; rota de devolução devolve 401 sem sessão). GitHub Pages publicou `index-DJsZw3Jo.js` às 12:01, com devoluções e DAE.
- Pendente: operações de terceiros, XMLs especiais e planilha; o Gabriel testar logado em produção.

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
- Publicado: commit `8858b50`; a implementação foi ampliada pelos commits posteriores do Claude e está em produção no commit `e70ec03`.
- Pendente: importação por planilha, confirmações, repasses, contas a pagar e administração. Coletor, certificados do Windows, backups/restauração locais e atualizador continuarão num agente local.

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
