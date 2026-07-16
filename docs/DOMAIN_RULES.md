# Regras De Dominio

Organizacao e a marca/grupo, como Villa Coffee ou Grao & Grao. CNPJ e o estabelecimento legal vinculado a uma organizacao. Local e uma unidade operacional que pode ou nao estar ligada a um CNPJ.

Notas e operacoes futuras deverao aceitar cadastro manual e importacao de XML. Cobrancas por periodo, valores por saca, adiantamentos, descontos e conta-corrente do cliente ainda nao foram implementados.

Confirmacao de negocio, contas a pagar, despesas por local/CNPJ, importacao multipla de XML e anexos ficam reservados para etapas futuras.

CNPJ deve ser armazenado sem formatacao. Datas sao persistidas em ISO 8601 UTC e exibidas em padrao brasileiro apenas na interface.

Novos CNPJs ativos exigem CNPJ valido por digitos verificadores. Cadastros incompletos podem ser salvos como rascunho para preservar dados demonstrativos ou pendentes. Locais pertencem obrigatoriamente a uma organizacao e so podem ser vinculados a CNPJs da mesma organizacao.

Variantes: `villa` autoriza apenas Villa Coffee; `grao` autoriza apenas Grao & Grao; `multiempresa` permite novas organizacoes e alternancia validada no processo principal.
