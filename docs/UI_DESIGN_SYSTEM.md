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
