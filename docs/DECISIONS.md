# Decisoes Tecnicas

## SQLite

Escolha: `better-sqlite3`.

Justificativa: biblioteca madura, local, transacional, sincronizada, sem servidor, compativel com Electron mediante empacotamento de modulo nativo e sem dependencia de servicos pagos.

Alternativas consideradas: `sqlite3`, que usa API callback/async mais verbosa; ORMs completos, que aumentariam complexidade antes das regras de negocio.

## IDs

Escolha: UUID v4 com `crypto.randomUUID()`. Funciona offline, dispensa servidor central e e suficiente para dados locais com futuras exportacoes.

## Migrations

Escolha: mecanismo proprio simples com `migration_history`. A etapa inicial precisa de controle previsivel e audivel sem introduzir framework extra.
