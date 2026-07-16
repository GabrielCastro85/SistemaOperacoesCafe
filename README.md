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

Variantes suportadas: `villa`, `grao` e `multiempresa`. Na tela Configuracoes > Identidade visual, o app abre o seletor no processo principal, valida PNG/SVG/WebP ate 5 MB, copia o arquivo para `userData/settings/branding/<organization-id>/` e salva apenas o caminho interno no banco.

## Cadastros Administrativos

Use Configuracoes para administrar Organizacoes, Empresas e CNPJs, Locais, Identidade visual, Perfil da instalacao e Diagnostico. CNPJs sao armazenados apenas com numeros e validados por digitos verificadores. Dados demonstrativos sem CNPJ podem permanecer como rascunho ate serem substituidos.

Regras de variante: `villa` limita a Villa Coffee, `grao` limita a Grao & Grao, e `multiempresa` permite novas organizacoes e alternancia autorizada.

## Parceiros, Produtos E Regras

Use Clientes para cadastrar parceiros comerciais com um ou mais papeis, seus estabelecimentos/CNPJs e contatos. Produtos possuem categoria, unidade e peso sugerido de saca. Use Cobrancas para cadastrar regras de valor por saca por cliente, tipo interno/externo, produto e CNPJ proprio.

Valores monetarios sao salvos em centavos inteiros. Exemplo: R$ 5,00 vira `500`.

## Estrutura

- `electron/main`: banco, migrations, IPC e filesystem.
- `electron/preload`: ponte segura para o renderer.
- `src/renderer`: interface React.
- `src/shared`: tipos, schemas, branding e canais IPC.
- `src/modules`: modulos atuais e placeholders futuros.
- `docs`: documentacao de produto e arquitetura.
