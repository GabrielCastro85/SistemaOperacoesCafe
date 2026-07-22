# Instalacao Windows

## Requisitos

- Windows 10 ou superior, x64.
- Usuario com permissao para instalar aplicativos no perfil atual.
- Backup `.cafebackup` recente antes de substituir uma instalacao usada em producao.

## Instalador

Use o instalador unico do sistema:

- `SistemaOperacoesCafe-Setup-<versao>-x64.exe`

O instalador e por usuario (`perMachine=false`) e nao apaga dados locais. Os dados ficam em `%APPDATA%/Sistema de Operacoes de Cafe Multiempresa/`.

## Primeira abertura

Na primeira execucao, o aplicativo cria ou valida o banco SQLite local, aplica migrations, cria o primeiro administrador quando necessario e permite operar Villa Coffee, Grao & Grao e outras organizacoes no mesmo app.

Se o Windows SmartScreen alertar sobre aplicativo desconhecido, confirme apenas artefatos cujo SHA-256 conste em `SHA256SUMS.txt` e `release-manifest.json`.

Para `1.0.0-rc.1`, a instalacao limpa em maquina de usuario final ainda precisa ser validada manualmente antes da promocao para stable.
