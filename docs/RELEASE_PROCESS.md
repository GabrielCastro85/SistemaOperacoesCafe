# Processo de release

## Preparacao

1. Confirme que a branch esta limpa ou que as alteracoes da release foram revisadas.
2. Execute `npm install`.
3. Execute `npm run generate:icons`.
4. Atualize `package.json`, `docs/CHANGELOG.md` e a documentacao afetada.

## Validacao

Execute:

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run package`
- `npm run dist`
- `npm run release:verify`
- `npm run smoke:packaged`
- `npm audit --omit=dev`

O release oficial gera um unico instalador NSIS: `SistemaOperacoesCafe-Setup-<versao>-x64.exe`.

Cada release gera `release-manifest.json`, `SHA256SUMS.txt` e `release-notes.md` em `release/multiempresa/<version>/`.

## Homologacao 1.0

Quando houver validacoes manuais pendentes, gere `1.0.0-rc.1` e registre NO-GO para stable no relatorio. Somente promova para `1.0.0` depois de concluir instalacao limpa, atualizacao do instalador unico e aceite de usuario.
