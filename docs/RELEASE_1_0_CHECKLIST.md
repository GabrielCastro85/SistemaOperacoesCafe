# Checklist de release 1.0

Status atual: RELEASE CANDIDATE `1.0.0-rc.1`.

| Item | Status | Evidencia |
| --- | --- | --- |
| Versao ajustada | PASSED | `package.json` em `1.0.0-rc.1` |
| Migration atual | PASSED | `013_backups_integrity` |
| Sem migration nova artificial | PASSED | Nenhuma migration 014 criada |
| Lint | PASSED | Executar `npm run lint` |
| Typecheck | PASSED | Executar `npm run typecheck` |
| Testes automatizados | PASSED | Executar `npm run test:run` |
| Build | PASSED | Executar `npm run build` |
| Package multiempresa | PASSED | Executar `npm run package` |
| Audit completo | FAILED | `npm audit` reportou 15 vulnerabilidades em dev/build, incluindo Electron; bloqueia stable |
| Audit producao | PASSED | Executar `npm audit --omit=dev` |
| Pacote Villa | PASSED | Executar `npm run package:villa` |
| Pacote Grao | PASSED | Executar `npm run package:grao` |
| Pacote multiempresa | PASSED | Executar `npm run package:multiempresa` |
| Instaladores | PASSED | Executar `npm run release:all` |
| Manifestos | PASSED | Executar `npm run release:verify` |
| Smoke empacotado | PASSED | Executar `npm run smoke:packaged` |
| Segurança Electron | PASSED | Executar `npm run security:review` |
| Migrations | PASSED | Executar `npm run migrations:check` |
| Desempenho basico | PASSED | Executar `npm run performance:baseline` |
| Manual do usuario | PASSED | `docs/USER_MANUAL.md` |
| Guia rapido | PASSED | `docs/QUICK_START.md` |
| Checklist diario | PASSED | `docs/DAILY_OPERATION_CHECKLIST.md` |
| Aceite do usuario | PENDING_MANUAL_VALIDATION | `docs/USER_ACCEPTANCE_TEST.md` |
| Instalacao limpa real | PENDING_MANUAL_VALIDATION | Maquina limpa por variante |
| Atualizacao 0.13.0 -> 1.0.0 | PENDING_MANUAL_VALIDATION | Ambiente isolado com dados reais de teste |
| Lado a lado real | PENDING_MANUAL_VALIDATION | Villa + Grao + multiempresa instalados |
| Assinatura Authenticode | NOT_APPLICABLE | Sem certificado; `signed: false` |

Promover para `1.0.0` somente depois dos itens `PENDING_MANUAL_VALIDATION` e da correcao/aceite formal de `REL-002`.
