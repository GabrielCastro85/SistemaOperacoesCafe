# Desinstalacao

O desinstalador remove os arquivos do aplicativo, atalhos e metadados da instalacao, mas preserva os dados locais por padrao.

Antes de desinstalar:

1. Gere um backup completo.
2. Copie o backup para uma pasta externa ao `userData`.
3. Confirme o SHA-256 do backup se ele sera arquivado.

Dados preservados ficam em `%APPDATA%/Sistema de Operacoes de Cafe Multiempresa/`. A remocao manual dessa pasta apaga banco, documentos, backups internos, logs e branding local.

Na homologacao, confirme que desinstalar o aplicativo remove apenas arquivos do programa e atalhos, preservando o `userData` enquanto essa opcao estiver ativa no instalador.
