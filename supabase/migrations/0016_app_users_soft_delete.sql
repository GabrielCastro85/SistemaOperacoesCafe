-- Exclusao de usuario precisa propagar pros outros PCs (ao contrario do
-- resto do app, onde excluir e' sempre so' local -- ver comentario em
-- AuthService.deleteUser/pushUserDeletionToShared, electron/main/services/security.ts).
-- Um pull incremental por updated_at nao tem como detectar "essa linha sumiu"
-- se a linha for apagada de verdade aqui -- por isso marca deleted_at em vez
-- de excluir, e o PC que puxa essa linha (ver upsertLocalRow em
-- electron/main/services/appRepository.ts) replica a exclusao localmente.

begin;

alter table app_users add column if not exists deleted_at timestamptz;

commit;
