COLETOR GRAOBASE - GRAO E GRAO

1. Copie a pasta inteira para o computador onde a Vulpe da Grao e Grao esta instalada.
2. Confirme que existe a pasta C:\Vulpe\NFe. Se a Vulpe estiver em outro local,
   edite apenas o campo xmlRoot do arquivo coletor-config.json.
3. Execute INSTALAR-COLETOR.cmd uma unica vez. Ele instala o coletor em
   C:\ProgramData\GraoBase\Coletor. O Windows pedira permissao de administrador
   para registrar o inicio antes do login.
4. Aguarde dois minutos e execute VER-STATUS.cmd.

O resultado esperado e status OK. O coletor inicia junto com o Windows e verifica
novos XMLs a cada minuto. O Operacoes Cafe nao precisa estar aberto nesse computador.
Ele roda em segundo plano e, por isso, nao exibe uma janela na barra de tarefas.

O coletor envia somente NF-e autorizadas e cancelamentos aceitos cujo emitente seja
um dos CNPJs configurados. Nenhuma nota e lancada automaticamente: ela fica aguardando
classificacao no Operacoes Cafe do computador principal.

A partir da versao 1.1.33, o computador principal mostra se este coletor esta
online, a ultima verificacao bem-sucedida, o ultimo XML enviado e eventuais erros.

A partir da versao 1.1.36, o programa principal permite buscar notas agora,
atualizar, reiniciar o coletor e consultar os registros recentes a distancia.
A atualizacao so comeca quando o usuario aciona "Atualizar coletor" no programa;
se a nova versao nao permanecer aberta, o coletor anterior e iniciado novamente.
A inicializacao fica registrada antes do login, no perfil do usuario e na pasta
Inicializar. Uma vigilancia do Windows executada a cada dois minutos reabre o
coletor caso ele tenha parado. O executavel tambem mantem uma vigilancia propria:
se o processo encerrar inesperadamente, ela tenta reabri-lo sem aguardar o Windows.

Arquivos de diagnostico:
- coletor-status.json: resumo da ultima verificacao
- coletor.log: historico de verificacoes e eventuais erros
- coletor-inicializacao.log: tentativas do Windows de abrir o coletor
- coletor-atualizacao.log: tentativas de troca e recuperacao de versao
- coletor-state.json: controle dos XMLs ja enviados
