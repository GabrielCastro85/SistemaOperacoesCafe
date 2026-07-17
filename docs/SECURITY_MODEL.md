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
