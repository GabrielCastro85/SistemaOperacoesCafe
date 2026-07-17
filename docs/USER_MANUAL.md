# Manual do usuario

Versao: 1.0.0-rc.1

Este manual descreve o uso operacional do Sistema de Operacoes de Cafe. O sistema e desktop Windows, local e offline-first. Ele nao depende de internet para operar, nao usa banco remoto e nao envia dados para nuvem.

## Instalacao

Use o instalador correto da empresa:

- Villa Coffee: `VillaCoffee-Operacoes-Setup-<versao>-x64.exe`.
- Grao & Grao: `GraoEGrao-Operacoes-Setup-<versao>-x64.exe`.
- Multiempresa: `SistemaOperacoesCafe-Multiempresa-Setup-<versao>-x64.exe`.

Antes de atualizar uma instalacao usada em producao, gere um backup completo em Configuracoes > Backups.

## Primeiro administrador

Na primeira abertura, crie o administrador inicial. Nao existe senha padrao. Use uma senha forte e guarde-a com seguranca. Depois do primeiro administrador, usuarios e permissoes sao administrados em Configuracoes > Usuarios e Configuracoes > Roles.

## Login e bloqueio

Informe usuario e senha. Ao terminar o expediente, use bloquear ou sair. Se o usuario for bloqueado por tentativas incorretas, um administrador deve revisar o cadastro.

## Organizacoes, CNPJs e locais

Em Configuracoes:

- Organizacoes representam Villa Coffee, Grao & Grao ou outra empresa no modo multiempresa.
- Empresas e CNPJs representam os estabelecimentos proprios.
- Locais representam escritorio, filial, armazem, propriedade, deposito ou outro ponto operacional.
- Identidade visual guarda logos e cores locais.

## Parceiros e produtos

Use Clientes para cadastrar parceiros comerciais, papeis, CNPJs/estabelecimentos e contatos. Use Produtos para cadastrar cafes, unidade, categoria e peso sugerido de saca.

## Regras por saca

Use Cobrancas > Regras por saca para cadastrar valores de servico por cliente, CNPJ proprio, produto, tipo interno/externo, vigencia e prioridade. O calculo oficial fica no processo principal, nao na tela.

## Notas e operacoes

Use Notas e operacoes para:

1. cadastrar nota manual;
2. adicionar itens;
3. criar uma ou mais operacoes;
4. classificar compra/venda e interno/externo;
5. confirmar ou cancelar.

Quantidades e precos comerciais usam decimal exato. Valores financeiros finais sao guardados em centavos.

## Importacao de planilha

Em Notas e operacoes, importe `.xlsx`, escolha a aba, revise o mapeamento, confira avisos e processe somente o que estiver correto. Jobs ficam registrados e podem ser revertidos logicamente.

## Importacao de XML

Importe XMLs de NF-e por arquivo, varios arquivos ou pasta. O sistema valida tamanho, estrutura, chave, duplicidade e eventos. O app nao consulta a SEFAZ e nao valida certificado digital do XML.

## Cobrancas e conta-corrente

Use Cobrancas para selecionar operacoes confirmadas, criar periodo, reservar operacoes, aplicar creditos, emitir cobranca e gerar documentos. Use Conta-corrente para adiantamentos, creditos e pagamentos.

## Financeiro

Use Financeiro para categorias, centros de custo, contas financeiras, contas a pagar, recorrencias, parcelamentos, pagamentos, anexos, calendario e relatorios.

## Confirmacoes de negocio

Use Confirmacoes para criar documentos manuais ou a partir de notas/operacoes, revisar participantes, itens, clausulas, pagamento, entrega, signatarios, previa, emissao, PDF, assinatura externa arquivada, cancelamento e substituicao. O app arquiva PDF assinado externamente, mas nao valida criptograficamente a assinatura.

## Auditoria

Administradores e auditores podem consultar eventos em Auditoria. A trilha possui hash encadeado e sanitizacao de senhas, tokens e segredos.

## Backups, restauracao e integridade

Crie backups em Configuracoes > Backups. Prefira backup completo e copie arquivos importantes para outro dispositivo. Backups criptografados exigem senha; se a senha for esquecida, nao ha recuperacao.

Restaure em Configuracoes > Restaurar. O sistema valida o pacote e cria backup pre-restauracao. Use Configuracoes > Integridade para verificar banco, documentos, orfaos e historico.

## Relatorios, diagnostico e documentos

Relatorios PDF/Excel e documentos ficam em `userData`. Use Configuracoes > Sobre para conferir versao, variante, App ID, executavel, migration e assinatura. Use Configuracoes > Diagnostico para copiar informacoes tecnicas.

## Atualizacao e desinstalacao

Atualize sempre com instalador da mesma variante. A desinstalacao preserva dados locais por padrao. Apagar manualmente a pasta `userData` remove banco, documentos, logs e backups internos.
