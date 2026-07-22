# Relatorio de homologacao 1.0

Versao homologada: `1.0.0-rc.1`

Recomendacao atual: NO-GO para `1.0.0` stable ate concluir instalacao limpa, atualizacao 0.13.0 -> 1.0.0, operacao multiempresa, aceite do usuario em ambiente real e tratamento do achado `REL-002`. GO para distribuicao interna de release candidate.

## Inventario

- Electron, React, TypeScript, Vite e SQLite `better-sqlite3`.
- Offline-first.
- Migrations ate `018_legal_entity_confirmation_defaults`.
- Distribuicao oficial: instalador unico multiempresa.
- Villa Coffee e Grao & Grao permanecem como organizacoes/branding dentro do mesmo app.
- App ID e `userData` multiempresa mantidos sem alteracao.
- Artefatos sem Authenticode: `signed: false`.

## Matriz de distribuicao

| Teste | Sistema unico |
| --- | --- |
| App ID em configuracao | PASSED |
| Executavel em configuracao | PASSED |
| Icone `.ico` | PASSED |
| Pacote `win-unpacked` | PASSED |
| Instalador NSIS | PASSED |
| Manifesto e SHA-256 | PASSED |
| Smoke empacotado | PASSED |
| Instalacao limpa real | PENDING_MANUAL_VALIDATION |
| Operacao multiempresa real | PENDING_MANUAL_VALIDATION |
| Atualizacao 0.13.0 -> RC | PENDING_MANUAL_VALIDATION |

## Testes automatizados

| ID | Modulo | Variante | Pre-condicao | Passos | Resultado esperado | Resultado obtido | Status | Evidencia | Defeito | Observacao |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTO-001 | Lint | Todas | Codigo fonte | `npm run lint` | Sem erros | Sem erros | PASSED | Terminal | - | - |
| AUTO-002 | TypeScript | Todas | Codigo fonte | `npm run typecheck` | Sem erros | Sem erros | PASSED | Terminal | - | - |
| AUTO-003 | Testes | Todas | Dependencias instaladas | `npm run test:run` | Suite verde | 62 testes verdes | PASSED | Vitest | - | - |
| AUTO-004 | Build | Todas | Typecheck ok | `npm run build` | `dist` e `dist-electron` gerados | Gerados | PASSED | Vite/tsc | - | - |
| AUTO-005 | Migrations | Todas | Fonte atual | `npm run migrations:check` | Ultima `018_legal_entity_confirmation_defaults` | Confirmado | PASSED | Script | - | - |
| AUTO-006 | Seguranca | Todas | Fonte atual | `npm run security:review` | Controles presentes | 11 controles ok | PASSED | Script | - | - |
| AUTO-007 | Desempenho basico | Todas | SQLite local | `npm run performance:baseline` | Insercao/consulta e quick_check ok | Ok | PASSED | Script | - | Sintetico |
| AUTO-008 | Audit producao | Todas | Lockfile atual | `npm audit --omit=dev` | 0 vulnerabilidades | 0 | PASSED | npm audit | - | - |
| AUTO-009 | Audit completo | Todas | Lockfile atual | `npm audit` | Sem vulnerabilidades | 15 vulnerabilidades em dev/build, incluindo Electron/tar/esbuild | FAILED | npm audit | REL-002 | Bloqueia stable; RC apenas para homologacao controlada |

## Testes empacotados

| ID | Modulo | Variante | Pre-condicao | Passos | Resultado esperado | Resultado obtido | Status | Evidencia | Defeito | Observacao |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PKG-001 | Package | Sistema unico | Build ok | `npm run package` | `win-unpacked` | Gerado | PASSED | release/multiempresa | - | - |
| PKG-002 | Instalador | Sistema unico | Build ok | `npm run dist` | NSIS unico | Gerado | PASSED | release/multiempresa/1.0.0-rc.1 | - | Sem assinatura |
| PKG-005 | Manifestos | Todas | Release gerado | `npm run release:verify` | Hash valido | Valido | PASSED | SHA256SUMS | - | - |
| PKG-006 | Smoke | Todas | Release gerado | `npm run smoke:packaged` | exe/app.asar/native ok | Ok | PASSED | Script | - | - |

## Testes manuais executados

Nenhum teste manual de instalacao limpa, atualizacao real, operacao multiempresa ou aceite foi marcado como executado nesta etapa, porque o ambiente atual nao representa maquina limpa de usuario final.

## Testes manuais pendentes

- Instalacao limpa do instalador unico.
- Atualizacao de 0.13.0 para 1.0.0 em diretorio isolado.
- Operacao real com Villa e Grao dentro do mesmo aplicativo.
- Desinstalacao preservando `userData`.
- Aceite por responsavel Villa.
- Aceite por responsavel Grao & Grao.
- Validacao visual em resolucoes e escalas Windows finais.

## Dados de homologacao

Nao foram versionados dados reais. Dados ficticios devem ser criados por operador em ambiente isolado seguindo `docs/USER_ACCEPTANCE_TEST.md`. Instaladores finais nao embutem banco de homologacao.

## Desempenho

Baseline sintetico inseriu 20.000 linhas em SQLite local, consultou agrupamento e executou `quick_check`. Tempos finais devem ser medidos na maquina do usuario durante aceite.

## Seguranca

Controles Electron e IPC verificados por script. Riscos aceitos: sem Authenticode, sem validacao criptografica de assinatura externa, sem atualizacao automatica. Risco nao aceito para stable: vulnerabilidades reportadas por `npm audit` completo em Electron/build tools.

## Acessibilidade e responsividade

Fluxos devem ser validados manualmente por teclado e nas resolucoes 1280x720, 1366x768, 1600x900 e 1920x1080. Nenhuma correcao bloqueante foi identificada por testes automatizados.

## Conclusao

`1.0.0-rc.1` esta apta para homologacao operacional controlada. Nao promover para `1.0.0` enquanto os testes manuais pendentes nao forem aprovados e `REL-002` nao for corrigido ou formalmente aceito.
