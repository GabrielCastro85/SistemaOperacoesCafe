# UI Navigation

A navegacao principal foi centralizada em `src/renderer/app/navigation.ts`.

Grupos atuais:

- Visao geral: Dashboard.
- Operacoes: Notas e operacoes.
- Comercial: Clientes e parceiros, Regras por saca, Confirmacoes.
- Comercial tambem expoe Produtos como rota propria.
- Recebimentos: Cobrancas, Conta-corrente.
- Financeiro: Visao financeira, Relatorios.
- Administracao: Configuracoes.

O layout desktop fica em `src/renderer/layouts/AppLayout.tsx` e oferece:

- sidebar recolhivel;
- logo da organizacao ou fallback textual;
- item ativo com `aria-current`;
- grupos de menu;
- rodape com versao;
- topbar com pagina atual, breadcrumb simples, organizacao ativa, CNPJ proprio e usuario provisorio.

A etapa preservou os nomes de menu usados pelo workspace funcional para nao quebrar os fluxos existentes. Novas paginas devem expor rotas internas por `src/renderer/app/routes.tsx` e usar os mesmos ids de navegacao.

Rotas hash identificaveis adicionadas:

- `#/operations`;
- `#/operations/documents`;
- `#/operations/operations`;
- `#/operations/pending`;
- `#/operations/new`;
- `#/imports/spreadsheets`;
- `#/imports/spreadsheets/history`;
- `#/imports/spreadsheets/templates`;
- `#/imports/xml`;
- `#/imports/xml/history`;
- `#/imports/xml/classification-rules`;
- `#/imports/xml/product-aliases`;
- `#/confirmations`;
- `#/confirmations/new`;
- `#/confirmations/templates`;
- `#/confirmations/clauses`;
- `#/confirmations/reports`.
- `#/partners`;
- `#/products`;
- `#/billing/rates`;
- `#/charges`;
- `#/client-ledger`.

Enquanto nao ha roteador externo, `legacyMenuFromPath` e `pathFromLegacyMenu` mantem compatibilidade entre a navegacao nova e os menus funcionais existentes.

Na etapa 10.2, `App.tsx` passou a rotear diretamente:

- `#/operations*` para `OperationsPage`;
- `#/imports/spreadsheets*` para paginas de planilha;
- `#/imports/xml*` para paginas de XML;
- `#/confirmations*` para paginas de confirmacao, templates, clausulas e relatorios.

Na continuacao da etapa 10, `App.tsx` tambem passou a rotear diretamente:

- `#/partners*` para `PartnersPage`;
- `#/products*` para `ProductsPage`;
- `#/billing/rates*` para `ServiceRateRulesPage`;
- `#/charges*` para `ChargesPage`;
- `#/client-ledger*` para `ClientLedgerPage`.

Na conclusao da etapa 10, nenhuma rota depende de workspace legado. Rotas financeiras diretas incluem `#/finance`, `#/finance/payables`, `#/finance/payables/new`, `#/finance/recurring`, `#/finance/installments`, `#/finance/payments`, `#/finance/calendar`, `#/finance/categories`, `#/finance/cost-centers`, `#/finance/accounts`, `#/finance/reports` e `#/finance/reports/history`.

Rotas administrativas diretas incluem `#/settings`, `#/settings/organizations`, `#/settings/legal-entities`, `#/settings/locations`, `#/settings/branding`, `#/settings/installation`, `#/settings/diagnostics`, `#/settings/directories`, `#/settings/document-sequences`, `#/settings/import-templates`, `#/settings/confirmation-templates`, `#/settings/clauses` e `#/settings/system`.

Rota desconhecida renderiza `NotFoundPage` com retorno ao Dashboard.
