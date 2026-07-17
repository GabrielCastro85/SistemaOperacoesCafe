# Instalacao Windows

## Requisitos

- Windows 10 ou superior, x64.
- Usuario com permissao para instalar aplicativos no perfil atual.
- Backup `.cafebackup` recente antes de substituir uma instalacao usada em producao.

## Instalador

Use o instalador correto para a empresa:

- `VillaCoffee-Operacoes-Setup-<versao>-x64.exe`
- `GraoEGrao-Operacoes-Setup-<versao>-x64.exe`
- `SistemaOperacoesCafe-Multiempresa-Setup-<versao>-x64.exe`

O instalador e por usuario (`perMachine=false`) e nao apaga dados locais. Os dados ficam em `%APPDATA%/<UserData da variante>/`.

## Primeira abertura

Na primeira execucao, o aplicativo cria ou valida o banco SQLite local, aplica migrations, cria o primeiro administrador quando necessario e mostra a variante visual correspondente.

Se o Windows SmartScreen alertar sobre aplicativo desconhecido, confirme apenas artefatos cujo SHA-256 conste em `SHA256SUMS.txt` e `release-manifest.json`.

Para `1.0.0-rc.1`, a instalacao limpa em maquina de usuario final ainda precisa ser validada manualmente antes da promocao para stable.
