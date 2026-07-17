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

## Cenarios de homologacao

- Computador danificado: instalar mesma variante em outro computador e restaurar backup completo.
- Troca de computador: copiar backup externo, instalar variante correta e restaurar.
- Banco corrompido: usar backup valido mais recente; nao prometer recuperacao sem backup.
- Documento ausente: executar integridade e restaurar de backup se o arquivo for essencial.
- Backup invalido: rejeitar pacote e usar backup anterior.
- Senha de backup esquecida: backup criptografado nao pode ser recuperado sem senha.
- Instalacao removida: reinstalar e confirmar se `userData` preservado ainda existe.
- Atualizacao com falha: usar backup pre-atualizacao e reinstalador da variante correta.
- Restauracao com rollback: testar somente em ambiente isolado.
