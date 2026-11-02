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

- **Atualizado em:** 2026-11-02, pelo Claude.
- **Branch:** `codex/central-server-neon`.
- **Última versão publicada:** 1.1.66, em 2026-11-02.
- **Commits:** o código das versões 1.1.63 e 1.1.64 foi commitado junto com a 1.1.65. Faça commit antes de publicar, para o que está no ar sempre existir no Git.
- **`docs/CHANGELOG.md`:** não tem a versão 1.1.61.
- **Próxima versão:** 1.1.67. **Não publique sem o Gabriel pedir.**

### Onde fica o Comparativo de períodos

Menu Visão geral > Comparativo, rota `/comparison`. Lógica em `electron/main/services/periodComparison.ts`, datas em `src/shared/utils/periodComparison.ts`, tela em `src/renderer/pages/comparison/PeriodComparisonPage.tsx`.

## Decisões do Gabriel

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
