# Checklist de release 1.0

Status atual: RELEASE CANDIDATE `1.0.0-rc.1`.

| Item | Status | Evidencia |
| --- | --- | --- |
| Versao ajustada | PASSED | `package.json` em `1.0.0-rc.1` |
| Migration atual | PASSED | `018_legal_entity_confirmation_defaults` |
| Contexto multiempresa unico | PASSED | Villa MG/ES e Grao MG/SP no mesmo app |
| Lint | PASSED | Executar `npm run lint` |
| Typecheck | PASSED | Executar `npm run typecheck` |
| Testes automatizados | PASSED | Executar `npm run test:run` |
| Build | PASSED | Executar `npm run build` |
| Package unico | PASSED | Executar `npm run package` |
| Audit completo | FAILED | `npm audit` reportou 15 vulnerabilidades em dev/build, incluindo Electron; bloqueia stable |
| Audit producao | PASSED | Executar `npm audit --omit=dev` |
| Instalador unico | PASSED | Executar `npm run dist` |
| Manifestos | PASSED | Executar `npm run release:verify` |
| Smoke empacotado | PASSED | Executar `npm run smoke:packaged` |
| Segurança Electron | PASSED | Executar `npm run security:review` |
| Migrations | PASSED | Executar `npm run migrations:check` |
| Desempenho basico | PASSED | Executar `npm run performance:baseline` |
| Manual do usuario | PASSED | `docs/USER_MANUAL.md` |
| Guia rapido | PASSED | `docs/QUICK_START.md` |
| Checklist diario | PASSED | `docs/DAILY_OPERATION_CHECKLIST.md` |
| Aceite do usuario | PENDING_MANUAL_VALIDATION | `docs/USER_ACCEPTANCE_TEST.md` |
| Instalacao limpa real | PENDING_MANUAL_VALIDATION | Maquina limpa com o instalador unico |
| Atualizacao 0.13.0 -> 1.0.0 | PENDING_MANUAL_VALIDATION | Ambiente isolado com dados reais de teste |
| Operacao multiempresa real | PENDING_MANUAL_VALIDATION | Villa + Grao operando dentro do mesmo app |
| Assinatura Authenticode | NOT_APPLICABLE | Sem certificado; `signed: false` |

Promover para `1.0.0` somente depois dos itens `PENDING_MANUAL_VALIDATION` e da correcao/aceite formal de `REL-002`.
