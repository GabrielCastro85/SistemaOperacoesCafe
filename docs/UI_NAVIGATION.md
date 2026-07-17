# UI Navigation

A navegacao principal foi centralizada em `src/renderer/app/navigation.ts`.

Grupos atuais:

- Visao geral: Dashboard.
- Operacoes: Notas e operacoes.
- Comercial: Clientes e parceiros, Regras por saca, Confirmacoes.
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

Enquanto nao ha roteador externo, `legacyMenuFromPath` e `pathFromLegacyMenu` mantem compatibilidade entre a navegacao nova e os menus funcionais existentes.
