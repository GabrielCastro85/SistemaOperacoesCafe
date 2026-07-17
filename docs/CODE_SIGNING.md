# Assinatura de codigo

Esta etapa prepara a distribuicao para assinatura, mas os artefatos locais continuam sem certificado Authenticode configurado.

## Politica atual

- `release-manifest.json` marca `signed: false`.
- A tela Configuracoes > Sobre mostra `Assinatura: UNSIGNED`.
- O Windows SmartScreen pode exibir alerta em maquinas novas.

## Preparacao futura

Quando houver certificado:

1. Configurar segredo de certificado fora do repositorio.
2. Assinar instaladores e executaveis com Authenticode.
3. Atualizar `release-manifest.json` com `signed: true` e assunto do certificado.
4. Verificar assinatura em smoke test.
5. Documentar cadeia de confianca e renovacao.

Nunca versionar `.pfx`, senha de certificado ou token de emissor.
