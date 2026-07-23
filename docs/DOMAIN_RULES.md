# Regras De Dominio

Organizacao e a marca/grupo, como Villa Coffee ou Grao & Grao. CNPJ e o estabelecimento legal vinculado a uma organizacao. Local e uma unidade operacional que pode ou nao estar ligada a um CNPJ.

CNPJ deve ser armazenado sem formatacao. Datas sao persistidas em ISO 8601 UTC e exibidas em padrao brasileiro apenas na interface.

Novos CNPJs ativos exigem CNPJ valido por digitos verificadores. Cadastros incompletos podem ser salvos como rascunho para preservar dados demonstrativos ou pendentes. Locais pertencem obrigatoriamente a uma organizacao e so podem ser vinculados a CNPJs da mesma organizacao.

Variantes: `villa` autoriza apenas Villa Coffee; `grao` autoriza apenas Grao & Grao; `multiempresa` permite novas organizacoes e alternancia validada no processo principal.

BusinessPartner representa qualquer parceiro comercial. O mesmo cadastro pode ser Cliente, Fornecedor, Vendedor, Comprador, Destino, Transportadora, Prestador de servico ou Outro.

Estabelecimento do parceiro e o CNPJ/unidade vinculada ao parceiro. Ele nao deve ser confundido com CNPJ proprio da organizacao.

Perfil de cobranca so existe para parceiro com papel Cliente. Regras por saca podem ser para venda na mesma UF, venda em outra UF ou gerais, com vigencia e prioridade. O resolvedor escolhe a regra mais especifica e retorna conflito quando houver empate deterministico.

Notas manuais podem ter varios itens e varias operacoes. Cada operacao possui classificacao de compra/venda e UF da venda: mesma UF ou outra UF. A regra por saca e aplicada automaticamente quando encontrada; alteracao manual exige motivo. Uma nota com pendencias nao pode ser confirmada.

Duplicidade: chave de acesso, quando informada, e unica. Sem chave, o sistema alerta possivel duplicidade por organizacao, cliente, numero, serie, data e valor.

Importacao de planilhas aceita apenas `.xlsx`. Cabecalhos sao normalizados sem acento, caixa ou pontuacao para sugerir mapeamento. Linhas vazias e totalizadoras sao ignoradas. Datas e decimais brasileiros sao convertidos para ISO e texto decimal normalizado antes de virar nota, item ou operacao.

Aliases de parceiros resolvem nomes historicos de planilha para o cadastro oficial. Durante a importacao, linhas com a mesma organizacao, cliente, numero, serie e chave sao agrupadas na mesma nota e geram multiplos itens/operacoes. Erros de linha nao bloqueiam a importacao das demais linhas validas. Reversao cancela logicamente as notas geradas e marca as linhas importadas como revertidas.

XML de NF-e e fonte fiscal preservada. A importacao aceita `nfeProc`, `NFe`, `procEventoNFe` e `evento` compativeis, principalmente NF-e modelo 55 versao 4.00. Eventos nao criam nova nota; cancelamento e carta de correcao entram em `fiscal_document_events`.

Chave de acesso deve ter 44 digitos e digito verificador valido. A chave do `infNFe` deve bater com o protocolo quando houver. Mesma chave nao cria nova nota: o XML pode ser mesclado ao registro existente, preservando cliente interno, classificacao, valor de servico e operacoes.

CNPJ proprio e determinado comparando emitente/destinatario com CNPJs ativos da organizacao. Emitente proprio sugere saida/venda; destinatario proprio sugere entrada/compra. CNPJ proprio ausente, inativo ou de outra organizacao gera pendencia ou bloqueio.

Conversao de sacas usa decimal exato. Unidades `SC`, `SACA`, `SACAS` e `SAC` equivalem a saca. `KG` e `TON` dependem do peso padrao da saca do produto. Sem produto ou peso, a operacao fica pendente de resolucao manual.

Cobrancas por periodo usam apenas operacoes confirmadas, do mesmo cliente, organizacao e CNPJ proprio, ainda nao cobradas. Ao criar rascunho, as operacoes ficam reservadas; ao cancelar rascunho ou cobranca emitida, a reserva e liberada ou a cobranca e estornada conforme o status.

Periodos sugeridos podem ser mensal, quinzenal, semanal ou personalizado. O valor da cobranca parte do snapshot do servico calculado nas operacoes, aceita acrescimos e descontos manuais com motivo, aplica creditos disponiveis da conta-corrente e recalcula subtotal, total, pago e aberto.

Adiantamentos, creditos, cobrancas emitidas e pagamentos geram lancamentos de conta-corrente. Pagamentos podem ser alocados parcialmente, e a cobranca muda para emitida, parcialmente paga, paga, vencida ou cancelada conforme datas e saldos.

Numeracao de cobranca e sequencial por organizacao, CNPJ proprio, ano e tipo de documento. A emissao grava snapshot imutavel dos dados usados, gera versao de documento e preserva caminho/hash dos arquivos locais para auditoria.

Financeiro controla despesas internas e contas a pagar, separado de cobrancas de clientes. Toda conta pertence a uma organizacao e a um CNPJ proprio. Local e o lugar fisico; centro de custo e a classificacao gerencial do gasto.

Categorias de despesa podem ser fixas, variaveis, impostos, pessoal, financeiras, investimento ou outras. Centros de custo e categorias podem ter hierarquia, sem ciclos, e sao desativados logicamente quando deixam de ser usados.

Valor final de conta a pagar e calculado no backend: valor original menos desconto, mais juros, multa e outros acrescimos. Saldo aberto e valor final menos pagamentos confirmados. Dinheiro usa centavos inteiros; o renderer nao define totais finais.

Recorrencias geram contas idempotentes por competencia. Valor fixo gera conta confirmada; valor variavel pode nascer estimado ou prevista. Parcelamentos distribuem centavos de forma deterministica, colocando a diferenca na ultima parcela.

Pagamentos de contas podem ser parciais ou totais e podem ser alocados a contas do mesmo CNPJ proprio. Conta aberta vencida vira vencida ao listar/visualizar. Conta paga ou cancelada nao deve ser editada silenciosamente.

Anexos de contas e comprovantes de pagamento sao documentos auxiliares, nao alteram valores financeiros. Arquivos de registros confirmados exigem motivo para remocao logica. Abertura de arquivos ocorre somente por ID de anexo ou relatorio ja registrado.

Relatorios financeiros sao gerenciais. Filtros sao validados no backend e registros cancelados sao ignorados quando o filtro nao pedir status especifico. Fluxo projetado mostra recebimentos previstos menos pagamentos previstos, sem representar saldo bancario real.

Confirmacoes de negocio podem nascer manualmente, de operacoes ou de notas fiscais. Uma confirmacao pertence a uma organizacao e a um CNPJ proprio, tem cliente responsavel, direcao compra/venda, UF da venda, comprador, vendedor e demais participantes opcionais com snapshot.

Itens de confirmacao usam decimal exato em texto para quantidade e preco comercial, permitindo mais de duas casas decimais. O valor total por item e calculado em centavos no backend. A soma dos itens alimenta o subtotal da confirmacao; o renderer nao define totais finais.

Confirmacao emitida recebe numero sequencial por organizacao, CNPJ proprio, ano e tipo. Depois de emitida, itens, participantes, clausulas, pagamentos e signatarios nao sao editados silenciosamente. Alteracoes relevantes exigem cancelamento ou substituicao por novo rascunho.

Previa, emissao e PDF assinado importado geram versoes em `deal_confirmation_document_versions`, com hash SHA-256. Importar PDF assinado preserva o arquivo externo copiado para pasta interna, mas a validacao criptografica da assinatura nao e realizada.

Durante o feature freeze da homologacao `1.0.0-rc.1`, regras de negocio aprovadas nao devem ser alteradas sem defeito real identificado. Melhorias ficam registradas para versao posterior.
