# Controle de defeitos da release 1.0

Status: ha achado HIGH de dependencia que bloqueia promocao para `1.0.0` stable. O release candidate pode ser usado para homologacao operacional controlada.

## Defeitos registrados

| Codigo | Titulo | Severidade | Modulo | Variante | Reproducao | Esperado | Atual | Causa | Correcao | Teste de regressao | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REL-001 | Validacoes manuais ainda pendentes | LOW | Release | Todas | Tentar liberar stable sem instalacao limpa e aceite em maquina final | Stable somente apos aceite manual | RC gerado corretamente | Limite do ambiente atual | Documentado como RC e bloqueio de promocao | `docs/RELEASE_1_0_CHECKLIST.md` | OPEN |
| REL-002 | `npm audit` completo aponta vulnerabilidades em Electron/build tools | HIGH | Dependencias | Todas | Executar `npm audit` | Sem vulnerabilidades ou plano aprovado | 15 vulnerabilidades em dev/build, incluindo Electron e tar | Dependencias atuais exigem upgrade major/breaking para corrigir | Nao atualizado durante feature freeze; requer etapa especifica de upgrade Electron/electron-builder e regressao empacotada | `npm audit`, `npm audit --omit=dev` | BLOCKS_STABLE |

## Politica

Nao liberar `1.0.0` stable com defeito CRITICAL ou HIGH conhecido sem justificativa formal. Validacoes manuais pendentes nao indicam defeito funcional, mas bloqueiam recomendacao GO para stable.
