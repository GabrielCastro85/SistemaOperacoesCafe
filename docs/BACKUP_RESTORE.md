# Backup e restauracao

## Formato

Backups usam extensao `.cafebackup` e magic bytes internos `OPERACOES_CAFE_BACKUP`.

O pacote contem:

- manifesto versionado;
- snapshot consistente do SQLite criado por `better-sqlite3.backup()`;
- documentos dentro de `userData/documents`;
- branding e configuracoes persistidas em `userData/settings`;
- lista de arquivos com caminho relativo, tamanho e SHA-256.

O pacote nao inclui executavel, `node_modules`, cache, logs antigos, temporarios externos, tokens ou senhas.

## Criptografia

Backups podem ser criptografados com AES-256-GCM. A chave e derivada por `scrypt`, com salt aleatorio. A senha nao e salva no banco, em logs, em auditoria nem nas configuracoes. Sem a senha, o backup criptografado nao pode ser recuperado.

## Destinos

O backup interno fica em `userData/backups`. Um destino externo pode ser escolhido pelo seletor do processo principal. O renderer nao recebe permissao para escrever em caminhos arbitrarios.

## Restauração

A restauracao exige sessao ativa, permissao `backups.restore`, senha atual do usuario e backup validado. Antes de substituir dados, o sistema cria um backup `PRE_RESTORE` protegido.

Backups com migration mais nova sao bloqueados. Backups com migration mais antiga sao migrados em area temporaria antes da substituicao.

## Homologacao 1.0

Na homologacao `1.0.0-rc.1`, restauracoes destrutivas devem ser executadas somente em diretorio isolado. O aceite de usuario deve confirmar backup completo, backup criptografado, verificacao, restauracao e rollback quando aplicavel.
