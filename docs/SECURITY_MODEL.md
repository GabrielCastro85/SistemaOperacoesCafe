# Modelo de seguranca local

## Etapa 11

O aplicativo agora possui autenticacao local obrigatoria antes do acesso ao shell principal.

- Nao existe senha padrao.
- Quando nao ha usuario ativo, o app abre o fluxo de primeiro administrador.
- As senhas sao armazenadas em formato versionado `scrypt$v1$...`, com salt aleatorio por credencial.
- A verificacao usa `crypto.scrypt` e `timingSafeEqual`.
- A sessao ativa vive no processo principal do Electron; o renderer apenas solicita acoes via IPC.
- Lock, unlock, logout e troca de usuario passam pelo processo principal.
- Os IPCs usam politica deny-by-default: canal sem regra explicita exige sessao autenticada.

## Tabelas

A migration `012_users_permissions_audit` cria `app_users`, `user_credentials`, `user_password_history`, `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `user_role_legal_entity_access`, `local_sessions` e `audit_events`.

## Backups

Backups e restauracoes usam permissoes dedicadas. Senhas de backup nao sao armazenadas. Auditoria sanitiza senha, token, hash, salt e segredo. A restauracao completa exige permissao critica `backups.restore` e senha atual do usuario.

## Distribuicao Windows

O processo principal aplica hardening antes de abrir a janela:

- `contextIsolation` permanece ativo.
- `nodeIntegration` permanece desativado.
- `webSecurity` permanece ativo.
- DevTools ficam indisponiveis em build empacotado, exceto quando `OPERACOES_CAFE_ENABLE_DEVTOOLS=1`.
- Novas janelas sao negadas.
- Navegacao do renderer e restrita a `file://` em build empacotado e `http://127.0.0.1:` em desenvolvimento.
- Permissoes de browser sao negadas por padrao.
- Cada variante define `appId`, nome de produto e `userData` antes do banco ser aberto.

## Homologacao 1.0

O script `npm run security:review` verifica controles basicos de Electron, preload, CSP, navegacao, permissoes, IPC e auditoria. A revisao completa esta em `docs/SECURITY_REVIEW_1_0.md`.
