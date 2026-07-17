# Teste de aceite do usuario

Versao em avaliacao: 1.0.0-rc.1

Preencha uma copia deste documento para Villa Coffee e outra para Grao & Grao.

| Campo | Preenchimento |
| --- | --- |
| Responsavel |  |
| Empresa |  |
| Variante |  |
| Data |  |
| Versao instalada |  |
| Aprovado para producao | Sim / Nao |

## Cenarios

| ID | Objetivo | Passos | Resultado esperado | Aprovado | Reprovado | Observacoes |
| --- | --- | --- | --- | --- | --- | --- |
| UAT-001 | Instalar e abrir | Executar instalador, abrir app, conferir nome e logo | App abre com marca correta |  |  |  |
| UAT-002 | Criar administrador | Criar admin inicial e fazer login | Login bem-sucedido, sem senha padrao |  |  |  |
| UAT-003 | Configurar empresa | Revisar organizacao, CNPJ e local | Dados ficam salvos apos reiniciar |  |  |  |
| UAT-004 | Cadastrar cliente e produto | Criar cliente, CNPJ, contato e produto | Cadastros aparecem em listas e detalhes |  |  |  |
| UAT-005 | Criar regra por saca | Criar regra interna/externa | Regra fica ativa e aplicavel |  |  |  |
| UAT-006 | Lancar nota manual | Criar nota, itens e operacao | Nota confirma e calcula servico |  |  |  |
| UAT-007 | Importar planilha | Selecionar `.xlsx`, mapear e processar | Linhas validas importadas, avisos visiveis |  |  |  |
| UAT-008 | Importar XML | Importar XML de teste | Nota/evento identificado sem internet |  |  |  |
| UAT-009 | Emitir cobranca | Criar periodo, emitir e gerar documentos | PDF/Excel/imagem gerados |  |  |  |
| UAT-010 | Registrar pagamento | Registrar pagamento parcial ou total | Conta-corrente atualizada |  |  |  |
| UAT-011 | Financeiro | Criar conta a pagar, rateio e pagamento | Saldos em centavos corretos |  |  |  |
| UAT-012 | Confirmacao | Criar, emitir PDF e importar assinado | Versoes e hash registrados |  |  |  |
| UAT-013 | Backup | Criar e verificar backup completo | Backup valido e localizavel |  |  |  |
| UAT-014 | Restauracao em ambiente isolado | Restaurar backup de teste | Dados e documentos retornam |  |  |  |
| UAT-015 | Desinstalacao | Desinstalar uma variante | Dados preservados conforme esperado |  |  |  |
