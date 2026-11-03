# Registro compartilhado: Claude e Codex

O Gabriel alterna entre o Claude Code e o Codex neste projeto, geralmente quando os créditos de um acabam. Este arquivo é a ligação entre os dois.

## Regras

1. **Ao começar:** leia "Situação atual" e as últimas entradas do histórico, depois rode `git status` e `git log -5`. O que está no Git e no disco vale mais do que este arquivo; se discordarem, corrija o registro.
2. **Ao terminar uma tarefa, e antes de parar por falta de créditos:** atualize "Situação atual" e acrescente uma entrada no topo do histórico.
3. **Não apague nem refaça o trabalho do outro** sem o Gabriel pedir. Alterações não commitadas de outra origem devem ser mantidas.
4. **Não registre segredos:** senhas, tokens e strings de conexão ficam fora deste arquivo.
5. **Escreva o que o Git não mostra:** o que falta, decisões do Gabriel, testes feitos e não feitos, o que já foi publicado.

Modelo de entrada:

```
### AAAA-MM-DD HH:MM - Claude | Codex
- Pedido:
- Feito:
- Testado:
- Publicado:
- Pendente:
```

## Situação atual

- **Atualizado em:** 2026-11-03, pelo Claude.
- **Branch:** `codex/central-server-neon`.
- **Última versão publicada:** 1.1.68, em 2026-11-03.
- **Commits:** o código das versões 1.1.63 e 1.1.64 foi commitado junto com a 1.1.65. Faça commit antes de publicar, para o que está no ar sempre existir no Git.
- **`docs/CHANGELOG.md`:** não tem a versão 1.1.61.
- **Próxima versão:** 1.1.69. **Não publique sem o Gabriel pedir.**

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
