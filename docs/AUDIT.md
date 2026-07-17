# Auditoria

## Registro

A tabela `audit_events` registra eventos de autenticacao, autorizacao, usuarios e acoes sensiveis.

Cada evento guarda:

- usuario e sessao, quando existirem;
- acao, entidade, escopo de organizacao/CNPJ e resultado;
- severidade;
- metadados sanitizados;
- `previous_hash` e `event_hash`.

## Sanitizacao

Campos com nomes contendo `password`, `senha`, `hash`, `salt`, `token` ou `secret` sao substituidos por `[REDACTED]`.

## Integridade

O hash usa SHA-256 sobre o conteudo do evento e o hash anterior. A tela `#/audit` mostra o resultado da verificacao da cadeia local.

## Backup e restauracao

Sao auditados inicio, conclusao, falha, verificacao, protecao, exclusao, configuracao, restauracao, rollback, integridade, relatorio e limpeza. Metadados de senha do backup sao sempre sanitizados.
