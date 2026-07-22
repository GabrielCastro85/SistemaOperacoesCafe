# Distribuicao Windows

O sistema agora possui um unico instalador Windows oficial. As empresas Villa Coffee e Grao & Grao continuam separadas dentro do aplicativo por organizacao, CNPJ, tema e branding, mas nao geram mais instaladores independentes.

| Distribuicao | Produto | App ID | Executavel | UserData |
| --- | --- | --- | --- | --- |
| `multiempresa` | Sistema de Operacoes de Cafe | `br.com.operacoescafe.multiempresa` | `SistemaOperacoesCafe.exe` | `Sistema de Operacoes de Cafe Multiempresa` |

As configuracoes ficam em `src/shared/buildVariants.ts` e `scripts/release/variant-config.mjs`. O processo principal define `app.setName`, `app.setAppUserModelId` e `app.setPath("userData", ...)` antes de abrir o banco. O caminho `userData` multiempresa foi preservado para manter compatibilidade com instalacoes ja testadas.

## Comandos

- `npm run package`: build em modo diretorio do aplicativo unico.
- `npm run dist`: instalador NSIS unico.
- `npm run release`: alias de `npm run dist`.
- `npm run release:all`: alias legado que tambem gera apenas o instalador unico.

Os artefatos sao gravados em `release/multiempresa/<version>/`.
