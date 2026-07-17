# Produto

Sistema desktop Windows para operacoes internas de empresas do ramo de cafe. O app nasce offline-first, com um unico codigo-fonte e variacao visual por organizacao.

Usuarios esperados: administradores, operadores e leitores internos.

Organizacao representa a marca ou grupo empresarial. Pessoa juridica representa cada CNPJ/estabelecimento vinculado. Local representa escritorio, filial, armazem, propriedade, deposito ou outro ponto operacional.

Objetivos: preservar dados locais, permitir atualizacoes manuais sem apagar historico e preparar modulos de notas, clientes, cobrancas, conta-corrente, financeiro, confirmacoes e relatorios.

A segunda etapa transforma os cadastros multiempresa em modulos administrativos: organizacoes, empresas/CNPJs, locais, identidade visual e perfil da instalacao.

A terceira etapa adiciona cadastros de parceiros comerciais, estabelecimentos dos parceiros, contatos, produtos, perfil de cobranca do cliente e regras de valor por saca para uso futuro nas operacoes.

A quarta etapa adiciona cadastro manual de notas e operacoes, ainda sem XML, PDF ou cobranca real. Ela prepara o fluxo operacional com itens, regras por saca, pendencias, confirmacao e cancelamento.

A quinta etapa adiciona importacao assistida de planilhas Excel `.xlsx` para historicos de notas e operacoes. O usuario escolhe a planilha, seleciona a aba, valida cabecalhos e linhas, aplica cliente/produto/classificacao padrao quando necessario e processa parcialmente o que estiver valido. A importacao grava jobs auditaveis, permite reversao logica e continua sem XML, PDF ou geracao de cobrancas.

A sexta etapa adiciona importacao local de XMLs de NF-e. Ela suporta arquivo unico, multiplos arquivos e pasta, cria fila de processamento, diferencia nota autorizada de eventos, extrai dados fiscais, determina CNPJ proprio, registra eventos de cancelamento e carta de correcao, mescla XML com notas manuais ou de planilha por chave e reutiliza itens, operacoes e regras por saca ja existentes.

A setima etapa adiciona cobrancas por periodo e conta-corrente do cliente. Ela permite sugerir janelas mensal, quinzenal, semanal ou personalizada, selecionar operacoes confirmadas ainda nao cobradas, reservar operacoes em rascunho, aplicar ajustes, adiantamentos e creditos, emitir cobranca numerada, gerar PDF/Excel/imagem e registrar pagamentos parciais ou totais.

A oitava etapa adiciona Financeiro e contas a pagar. O modulo controla despesas internas por organizacao, CNPJ proprio, local, centro de custo, categoria e favorecido, com contas manuais, recorrentes, parceladas, rateadas e pagas parcial ou totalmente.

A conclusao da oitava etapa adiciona anexos de contas, comprovantes de pagamento e relatorios financeiros PDF/Excel, mantendo tudo offline e armazenado em pastas internas do usuario.

A nona etapa adiciona Confirmacoes de negocio. O usuario pode criar uma confirmacao manual ou a partir de operacoes/notas, revisar participantes, itens, clausulas, pagamento, entrega e signatarios, gerar previa, emitir PDF numerado, importar PDF assinado externamente, cancelar, substituir e consultar indicadores basicos.
