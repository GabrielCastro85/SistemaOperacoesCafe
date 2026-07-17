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
- `npm audit --omit=dev`

Para variantes oficiais:

- `npm run package:villa`
- `npm run package:grao`
- `npm run release:verify`
- `npm run smoke:packaged`

Para instaladores NSIS:

- `npm run release:villa`
- `npm run release:grao`
- `npm run release:multiempresa`

Cada release gera `release-manifest.json`, `SHA256SUMS.txt` e `release-notes.md` em `release/<variant>/<version>/`.
