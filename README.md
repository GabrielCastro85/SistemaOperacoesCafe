# Sistema Operacoes Cafe

Aplicativo desktop Windows offline-first para operacoes internas de empresas do ramo de cafe.

## Requisitos

- Node.js 20.19.0 ou superior.
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
- `npm run package` prepara pacote Windows unico em modo diretorio.
- `npm run dist` gera o instalador NSIS unico.
- `npm run release` tambem gera o instalador NSIS unico.
- `npm run release:verify` valida manifestos e checksums.
- `npm run smoke:packaged` valida artefatos empacotados.
- `npm run homologation:check` valida documentos e pre-condicoes da homologacao.
- `npm run security:review` verifica controles de seguranca Electron/IPC.
- `npm run migrations:check` confirma a ultima migration aprovada.
- `npm run performance:baseline` executa um baseline SQLite local sintetico.

## Dados Locais

O banco fica em `app.getPath("userData")/database/operations.sqlite`. Documentos ficam em `app.getPath("userData")/documents`. Esses dados nao ficam na pasta de instalacao e devem ser preservados em atualizacoes.

O release oficial possui um unico instalador Windows. Villa Coffee, Grao & Grao e outras empresas ficam separadas dentro do app por organizacao, CNPJ, permissao e branding.

## Branding

Variantes suportadas: `villa`, `grao` e `multiempresa`. Na tela Configuracoes > Identidade visual, o app abre o seletor no processo principal, valida PNG/SVG/WebP ate 5 MB, copia o arquivo para `userData/settings/branding/<organization-id>/` e salva apenas o caminho interno no banco.

## Cadastros Administrativos

Use Configuracoes para administrar Organizacoes, Empresas e CNPJs, Locais, Identidade visual, Perfil da instalacao e Diagnostico. CNPJs sao armazenados apenas com numeros e validados por digitos verificadores. Dados demonstrativos sem CNPJ podem permanecer como rascunho ate serem substituidos.

Regra de distribuicao: o aplicativo oficial roda em modo multiempresa e permite novas organizacoes e alternancia autorizada.

Na abertura da sessao, o usuario escolhe a empresa/CNPJ operacional, como Villa Coffee Minas Gerais, Villa Coffee Espirito Santo, Grao & Grao Minas Gerais ou Grao & Grao Sao Paulo. A troca pela barra superior muda o contexto dos dados e aplica a identidade visual da empresa ativa.

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

## Interface Profissional

A decima etapa iniciou a refatoracao visual do renderer. `src/renderer/App.tsx` ficou responsavel apenas pelo boot React, a navegacao foi centralizada em `src/renderer/app`, o layout desktop em `src/renderer/layouts`, e o design system em `src/renderer/design-system`.

O app agora possui sidebar recolhivel, topbar com organizacao e CNPJ ativo, tokens visuais, temas Villa/Grao/multiempresa, logos empacotadas em `public/assets/branding`, componentes reutilizaveis e dashboard reorganizado.

A continuacao da etapa 10 migrou Notas e operacoes, importacoes de planilha/XML e Confirmacoes de negocio para paginas reais em `src/renderer/pages/operations`, `src/renderer/pages/imports` e `src/renderer/pages/confirmations`.

A etapa 10.2 removeu essa casca para os modulos migrados: as rotas hash agora sao resolvidas diretamente em `src/renderer/app/App.tsx`, envolvidas por `AppLayout`.

A continuacao da etapa 10 tambem migrou Clientes e parceiros, Produtos, Regras por saca, Cobrancas e Conta-corrente para paginas diretas em `src/renderer/pages/partners`, `products`, `serviceRates`, `charges` e `clientLedger`.

A conclusao da etapa 10 removeu definitivamente o workspace legado. Financeiro, Contas a pagar, Recorrencias, Parcelamentos, Pagamentos, Cadastros financeiros, Relatorios e Configuracoes agora possuem rotas diretas em `src/renderer/pages/finance` e `src/renderer/pages/settings`. Rota desconhecida abre uma pagina "Nao encontrada".

## Usuarios, Permissoes E Auditoria

A decima primeira etapa adiciona autenticacao local obrigatoria. Na primeira abertura sem usuario ativo, o app cria um administrador definido pelo operador, sem senha padrao. Senhas usam hash `scrypt` versionado com salt aleatorio e comparacao segura.

Sessoes ficam no processo principal, com lock, unlock, logout e troca de usuario. Canais IPC passam por politica deny-by-default baseada em roles/permissoes. Use Configuracoes > Usuarios, Configuracoes > Roles e Auditoria para administrar acesso e verificar a trilha de eventos com hash encadeado.

Na versao multiempresa unica, usuarios logados acessam todos os modulos operacionais. A criacao e manutencao de usuarios permanece restrita ao administrador.

## Backups, Restauracao E Integridade

A decima segunda etapa adiciona backups locais `.cafebackup`, com snapshot consistente do SQLite, documentos, branding, manifesto, hashes e opcao de criptografia AES-256-GCM com senha nao persistida.

Use Configuracoes > Backups para criar backups completos ou somente do banco, escolher destino interno/externo, verificar pacotes, proteger backups e configurar execucao automatica quando o app estiver aberto. Use Configuracoes > Restaurar para validar e restaurar um backup com criacao automatica de backup pre-restauracao. Use Configuracoes > Integridade para verificar banco, documentos, orfaos e gerar relatorio local.

Backup interno nao protege contra perda total do disco; copie backups importantes para outro dispositivo. O app nao envia backups para nuvem e nao executa backups quando estiver fechado.

## Distribuicao Windows

A decima terceira etapa profissionaliza a distribuicao Windows. `src/shared/buildVariants.ts` centraliza App ID, nome de produto, executavel, icone, artefato e diretorio `userData` do instalador unico.

Os scripts em `scripts/release` geram icones `.ico`, empacotam o app, criam manifesto de release, checksums SHA-256, notas de release e teste smoke de artefato. A tela Configuracoes > Sobre exibe produto, versao, variante, App ID, executavel, arquitetura, Electron, migration e status de assinatura.

## Homologacao 1.0

A decima quarta etapa gerou `1.0.0-rc.1` como release candidate. A versao stable `1.0.0` fica bloqueada ate concluir instalacao limpa, atualizacao 0.13.0 -> 1.0.0, operacao multiempresa e aceite de usuario em ambiente real. Consulte `docs/HOMOLOGATION_REPORT_1_0.md`, `docs/RELEASE_1_0_CHECKLIST.md` e `docs/USER_ACCEPTANCE_TEST.md`.

## Estrutura

- `electron/main`: banco, migrations, IPC e filesystem.
- `electron/preload`: ponte segura para o renderer.
- `src/renderer`: interface React, layout, design system e paginas.
- `src/shared`: tipos, schemas, branding e canais IPC.
- `src/modules`: modulos atuais e placeholders futuros.
- `docs`: documentacao de produto e arquitetura.
