# Variantes de build

O sistema possui tres distribuicoes Windows isoladas:

| Variante | Produto | App ID | Executavel | UserData |
| --- | --- | --- | --- | --- |
| `villa` | Villa Coffee | `br.com.operacoescafe.villa` | `VillaCoffeeOperacoes.exe` | `Villa Coffee Operacoes` |
| `grao` | Grao & Grao | `br.com.operacoescafe.graoegrao` | `GraoEGraoOperacoes.exe` | `Grao & Grao Operacoes` |
| `multiempresa` | Sistema de Operacoes de Cafe | `br.com.operacoescafe.multiempresa` | `SistemaOperacoesCafe.exe` | `Sistema de Operacoes de Cafe Multiempresa` |

As configuracoes ficam em `src/shared/buildVariants.ts` e `scripts/release/variant-config.mjs`. O processo principal define `app.setName`, `app.setAppUserModelId` e `app.setPath("userData", ...)` antes de abrir o banco, garantindo isolamento de dados entre as variantes.

## Comandos

- `npm run package:villa`: build em modo diretorio para Villa Coffee.
- `npm run package:grao`: build em modo diretorio para Grao & Grao.
- `npm run package:multiempresa`: build em modo diretorio multiempresa.
- `npm run release:villa`: instalador NSIS da Villa Coffee.
- `npm run release:grao`: instalador NSIS da Grao & Grao.
- `npm run release:multiempresa`: instalador NSIS multiempresa.
- `npm run release:all`: gera os tres instaladores.

Os artefatos sao gravados em `release/<variant>/<version>/`.
