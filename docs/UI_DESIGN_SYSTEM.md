# UI Design System

A etapa 10 iniciou um design system interno do renderer.

Estrutura principal:

- `src/renderer/design-system/tokens`: espacamento, raios, alturas e camadas.
- `src/renderer/design-system/theme`: temas Villa, Grao e multiempresa.
- `src/renderer/design-system/components`: componentes React reutilizaveis.
- `src/renderer/styles/index.css`: tokens CSS, layout, responsividade e estados visuais.

Componentes disponiveis nesta etapa:

- `Button`;
- `Input`;
- `Select`;
- `FormField`;
- `Card`;
- `Badge`;
- `StatusBadge`;
- `Alert`;
- `EmptyState`;
- `LoadingState`;
- `Tabs`;
- `DataTable`.

A continuacao da etapa 10 adicionou:

- `Textarea`;
- `DateInput`;
- `CurrencyInput`;
- `DecimalInput`;
- `CnpjInput`;
- `SearchInput`;
- `IconButton`;
- `ConfirmationDialog`;
- `Drawer`;
- `Stepper`;
- `Breadcrumb`;
- `PageHeader`;
- `Skeleton`;
- `ProgressBar`;
- `Pagination`;
- `FilterBar`;
- `FileDropzone`;
- `AttachmentList`;
- `DocumentPreviewCard`;
- `DropdownMenu`;
- `Toast`.

Os fluxos migrados de operacoes e confirmacoes passam a usar `PageHeader`, `Stepper`, componentes de feedback e primitivos compartilhados de secao.

Dialogs simples de acao reutilizam os estilos do design system por meio de `requestTextInput` e `requestDecision`, evitando chamadas nativas do navegador enquanto os formularios completos sao migrados para componentes React dedicados.

Na continuacao da etapa 10, `requestTextInput` e `requestDecision` passaram a abrir um `DialogProvider` React em `src/renderer/app/providers.tsx`. O utilitario `src/renderer/utils/dialogs.ts` apenas dispara requisicoes tipadas para o provider, sem `window.prompt`, `window.alert`, `window.confirm` ou `document.createElement`.

Foram criadas estruturas visuais dedicadas para:

- `src/renderer/pages/partners/components`, `forms` e `hooks`;
- `src/renderer/pages/products/components`, `forms` e `hooks`;
- `src/renderer/pages/serviceRates/components`, `forms` e `hooks`;
- `src/renderer/pages/charges/components`, `forms` e `hooks`;
- `src/renderer/pages/clientLedger/components`, `forms` e `hooks`.

Todos usam classes padronizadas `ui-*`, foco visivel e tokens CSS. O objetivo e migrar gradualmente os formularios e tabelas legados para esses componentes sem alterar regras de negocio.

Tokens principais:

- `--color-primary`;
- `--color-accent`;
- `--color-background`;
- `--color-surface`;
- `--color-surface-muted`;
- `--color-text`;
- `--color-text-muted`;
- `--color-border`;
- `--color-success`;
- `--color-warning`;
- `--color-danger`;
- `--color-info`;
- `--sidebar-width`;
- `--sidebar-collapsed-width`;
- `--control-height`.

O catalogo `src/renderer/pages/uiKit/UiKitPage.tsx` fica fora do menu comum e serve como referencia de desenvolvimento.
