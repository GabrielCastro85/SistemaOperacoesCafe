# Sistema Operacoes Cafe

Aplicativo desktop Windows offline-first para operacoes internas de empresas do ramo de cafe.

## Requisitos

- Node.js 22 ou superior.
- npm.

## Comandos

- `npm install`
- `npm run dev` inicia o Vite.
- `npm run dev:electron` abre o Electron em desenvolvimento.
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:run`
- `npm run build`
- `npm run package` prepara pacote Windows em modo diretorio.

## Dados Locais

O banco fica em `app.getPath("userData")/database/operations.sqlite`. Documentos ficam em `app.getPath("userData")/documents`. Esses dados nao ficam na pasta de instalacao e devem ser preservados em atualizacoes.

## Branding

Variantes suportadas: `villa`, `grao` e `multiempresa`. Logos e icones devem ser colocados em `assets/branding/<variante>/` como PNG, SVG ou WebP.

## Estrutura

- `electron/main`: banco, migrations, IPC e filesystem.
- `electron/preload`: ponte segura para o renderer.
- `src/renderer`: interface React.
- `src/shared`: tipos, schemas, branding e canais IPC.
- `src/modules`: modulos atuais e placeholders futuros.
- `docs`: documentacao de produto e arquitetura.
