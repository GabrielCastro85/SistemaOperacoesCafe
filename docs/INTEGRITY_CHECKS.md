# Verificacoes de integridade

## Banco

As verificacoes incluem:

- `PRAGMA quick_check`;
- `PRAGMA foreign_key_check`;
- migration atual;
- existencia de administrador ativo;
- tabelas essenciais por migration.

## Documentos

O sistema verifica referencias conhecidas no banco, caminhos dentro de `userData`, existencia de arquivo e se a referencia nao aponta para diretorio.

## Orfaos e temporarios

Arquivos em `userData/documents` sem referencia direta sao classificados como orfaos ou temporarios candidatos a limpeza. Arquivos oficiais nao sao removidos automaticamente.

## Relatorio

O relatorio de integridade e gerado em JSON local sanitizado dentro de `userData/backups/integrity-reports`.
