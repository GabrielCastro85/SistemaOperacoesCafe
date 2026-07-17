# Sistema Operacoes Cafe

Aplicativo desktop Windows offline-first para operacoes internas de empresas do ramo de cafe.

## Requisitos

- Node.js 22 ou superior.
- npm.

## Comandos

- `npm install`
- `npm run dev` inicia o Vite.
- `npm run dev:electron` abre o Electron em desenvolvimento.
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:run`
- `npm run build`
- `npm run package` prepara pacote Windows em modo diretorio.

## Dados Locais

O banco fica em `app.getPath("userData")/database/operations.sqlite`. Documentos ficam em `app.getPath("userData")/documents`. Esses dados nao ficam na pasta de instalacao e devem ser preservados em atualizacoes.

## Branding

Variantes suportadas: `villa`, `grao` e `multiempresa`. Na tela Configuracoes > Identidade visual, o app abre o seletor no processo principal, valida PNG/SVG/WebP ate 5 MB, copia o arquivo para `userData/settings/branding/<organization-id>/` e salva apenas o caminho interno no banco.

## Cadastros Administrativos

Use Configuracoes para administrar Organizacoes, Empresas e CNPJs, Locais, Identidade visual, Perfil da instalacao e Diagnostico. CNPJs sao armazenados apenas com numeros e validados por digitos verificadores. Dados demonstrativos sem CNPJ podem permanecer como rascunho ate serem substituidos.

Regras de variante: `villa` limita a Villa Coffee, `grao` limita a Grao & Grao, e `multiempresa` permite novas organizacoes e alternancia autorizada.

## Parceiros, Produtos E Regras

Use Clientes para cadastrar parceiros comerciais com um ou mais papeis, seus estabelecimentos/CNPJs e contatos. Produtos possuem categoria, unidade e peso sugerido de saca. Use Cobrancas para cadastrar regras de valor por saca por cliente, tipo interno/externo, produto e CNPJ proprio.

Valores monetarios sao salvos em centavos inteiros. Exemplo: R$ 5,00 vira `500`.

## Notas E Operacoes Manuais

Use Notas e operacoes para cadastrar uma nota manual, adicionar multiplos itens e gerar multiplas operacoes vinculadas. Quantidades e precos comerciais sao armazenados como decimal em texto normalizado, com ate 6 casas, para evitar perda de precisao. O valor do servico usa a regra por saca vigente ou um valor manual com motivo obrigatorio.

## Importacao De Planilhas

A tela Notas e operacoes tambem importa historicos em `.xlsx` usando biblioteca local (`exceljs`). O fluxo seleciona o arquivo, identifica abas, sugere mapeamento por cabecalho, valida linhas, cria um job de importacao, processa linhas validas ou com alerta e permite reversao logica. Nesta etapa nao ha XML, PDF nem cobranca por periodo.

## Importacao De XML NF-e

A sexta etapa adiciona importacao local/offline de XMLs de NF-e. Em Notas e operacoes, use selecao individual, selecao multipla ou pasta para criar uma fila, validar XMLs, identificar notas/eventos, aplicar cliente/classificacao do lote, importar para `fiscal_documents`, `fiscal_document_items` e `operations`, registrar eventos fiscais e reverter jobs permitidos.

O parser le os dados contidos no XML e no protocolo arquivado, mas nao consulta a situacao atual da nota na SEFAZ. Consulta automatica, certificado digital, PDF/DANFE e cobrancas continuam fora do escopo.

## Cobrancas E Conta-corrente

A setima etapa adiciona cobrancas por periodo e conta-corrente do cliente. Use Cobrancas para sugerir periodos mensal, quinzenal, semanal ou personalizado, selecionar operacoes confirmadas ainda nao cobradas, reservar operacoes em rascunho, aplicar creditos, ajustar acrescimos/descontos com motivo, emitir cobranca numerada e gerar PDF, Excel e imagem local em `userData/documents/charges`.

Use Conta-corrente para registrar adiantamentos e consultar lancamentos do cliente. Pagamentos podem ser registrados pela tela de Cobrancas e alocados parcial ou totalmente, atualizando o saldo aberto da cobranca.

## Financeiro E Contas A Pagar

A oitava etapa adiciona o modulo Financeiro para controle gerencial interno de despesas e contas a pagar. Ele reutiliza organizacoes, CNPJs proprios, locais e parceiros existentes, cria categorias, centros de custo, contas financeiras, lancamentos manuais, recorrencias, parcelamentos, rateios, pagamentos e indicadores de fluxo projetado.

Valores financeiros permanecem em centavos inteiros. Competencia, emissao, vencimento e pagamento sao datas de calendario `YYYY-MM-DD`, sem conversao UTC. O modulo nao possui integracao bancaria, contabilidade oficial, Open Finance, boletos ou Pix automatico.

A conclusao da etapa 8 adiciona anexos e comprovantes com copia segura para `userData/documents/accounts-payable`, hash SHA-256, abertura por ID interno e remocao logica. Tambem adiciona relatorios gerenciais PDF/Excel em `userData/documents/financial-reports`, com historico de geracao.

## Confirmacoes De Negocio

A nona etapa adiciona Confirmacoes de negocio. O modulo cria confirmacoes manualmente ou a partir de operacoes/notas, registra comprador, vendedor e demais participantes com snapshot, aceita itens com decimal exato, clausulas, condicoes de pagamento, entrega, signatarios, numeracao sequencial e versoes de documento.

PDFs de previa e emissao sao gerados localmente em `userData/documents/confirmations`, com hash SHA-256. PDFs assinados externamente podem ser importados e preservados como nova versao, mas o app nao valida criptograficamente assinatura digital nesta etapa.

## Estrutura

- `electron/main`: banco, migrations, IPC e filesystem.
- `electron/preload`: ponte segura para o renderer.
- `src/renderer`: interface React.
- `src/shared`: tipos, schemas, branding e canais IPC.
- `src/modules`: modulos atuais e placeholders futuros.
- `docs`: documentacao de produto e arquitetura.
