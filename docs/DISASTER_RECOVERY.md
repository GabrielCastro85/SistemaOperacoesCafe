# Recuperacao de desastre

## Procedimento recomendado

1. Criar backup completo regularmente.
2. Copiar backups importantes para outro dispositivo fisico.
3. Proteger backups pre-restauracao e pre-migration.
4. Validar backups periodicamente.
5. Testar restauracao em ambiente controlado.

O backup interno nao protege contra perda total do disco. O aplicativo nao envia backups para nuvem e nao executa backup quando fechado.

## Rollback

Durante restauracao, o estado atual e preservado em area de rollback antes da substituicao. Se a restauracao falhar, a falha e registrada e o backup pre-restauracao permanece protegido.
