COLETOR GRAOBASE - GRAO E GRAO

1. Copie a pasta inteira para o computador onde a Vulpe da Grao e Grao esta instalada.
2. Confirme que existe a pasta C:\Vulpe\NFe. Se a Vulpe estiver em outro local,
   edite apenas o campo xmlRoot do arquivo coletor-config.json.
3. Execute INSTALAR-COLETOR.cmd. Em uma atualizacao, ele encerra a versao anterior
   e inicia automaticamente o executavel mais recente da pasta. O Windows pedira
   permissao de administrador para registrar o inicio antes do login.
4. Aguarde dois minutos e execute VER-STATUS.cmd.

O resultado esperado e status OK. O coletor inicia junto com o Windows e verifica
novos XMLs a cada minuto. O Operacoes Cafe nao precisa estar aberto nesse computador.
Ele roda em segundo plano e, por isso, nao exibe uma janela na barra de tarefas.

O coletor envia somente NF-e autorizadas e cancelamentos aceitos cujo emitente seja
um dos CNPJs configurados. Nenhuma nota e lancada automaticamente: ela fica aguardando
classificacao no Operacoes Cafe do computador principal.

A partir da versao 1.1.33, o computador principal mostra se este coletor esta
online, a ultima verificacao bem-sucedida, o ultimo XML enviado e eventuais erros.

A partir da versao 1.1.34, o coletor consulta o servidor e instala sozinho as
proximas versoes do executavel. A inicializacao no Windows fica registrada no
inicio do computador, no perfil do usuario e na pasta Inicializar. Uma vigilancia
executada a cada cinco minutos reabre o coletor caso ele tenha parado.

Arquivos de diagnostico:
- coletor-status.json: resumo da ultima verificacao
- coletor.log: historico de verificacoes e eventuais erros
- coletor-inicializacao.log: tentativas do Windows de abrir o coletor
- coletor-state.json: controle dos XMLs ja enviados
