# Matriz de permissoes

## Roles do sistema

| Role | Escopo | Uso |
| --- | --- | --- |
| `SYSTEM_ADMIN` | Global | Usuarios, roles, auditoria e todos os modulos. |
| `OPERATIONS_MANAGER` | Organizacao | Operacoes, importacoes, cadastros comerciais, cobrancas e confirmacoes. |
| `FINANCE_MANAGER` | Organizacao | Financeiro, cobrancas, relatorios e auditoria. |
| `OPERATOR` | CNPJ | Lancamentos operacionais e consultas basicas. |
| `VIEWER` | CNPJ | Consulta. |

## Permissoes principais

- `users.view`, `users.manage`
- `roles.view`, `roles.manage`
- `audit.view`
- `settings.manage`
- `operations.view`, `operations.manage`, `imports.manage`
- `commercial.view`, `commercial.manage`
- `billing.manage`
- `finance.view`, `finance.manage`
- `confirmations.manage`

Toda chamada IPC passa por `getIpcPolicy`. Canais desconhecidos caem em `authenticated`, e testes garantem que todos os canais registrados possuem politica resolvida.
