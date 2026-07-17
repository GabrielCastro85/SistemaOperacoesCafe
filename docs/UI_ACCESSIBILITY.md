# UI Accessibility

Padroes aplicados na etapa 10:

- foco visivel em botoes, inputs, selects, links e textareas;
- labels persistentes nos componentes novos;
- badges com texto, nao apenas cor;
- `aria-current` no item ativo da sidebar;
- `role=status` para carregamento e alertas informativos;
- `role=alert` para alertas destrutivos;
- controles com altura minima consistente;
- sidebar recolhivel com `aria-label`;
- tabelas com cabecalho sem depender de snapshot visual.
- stepper com `aria-current=step`;
- dialog e drawer com `role=dialog` e `aria-modal`;
- progresso com `role=progressbar`;
- dropzone textual sem depender apenas de icone ou cor.

Responsividade:

- layout testado por CSS para 1366 px e abaixo;
- sidebar recolhe em telas estreitas;
- topbar reorganiza em duas colunas;
- tabelas possuem rolagem horizontal segura;
- cards e grids caem para duas ou uma coluna conforme a largura.

Limitacoes restantes:

- formularios extensos ainda devem migrar para stepper completo;
- testes automatizados de contraste cobrem a funcao de cor legivel, mas nao substituem auditoria visual completa;
- algumas tabelas comerciais ainda usam classes legadas de grade enquanto os componentes dedicados sao incorporados nas telas finais.

Na etapa 10.2, chamadas funcionais nativas de prompt, alert e confirm foram removidas do renderer. Acoes que precisam de texto ou decisao usam dialogs locais em `src/renderer/utils/dialogs.ts`, mantendo label, Escape e foco inicial.

Na continuacao da etapa 10, os dialogs passaram a ser renderizados por `DialogProvider` dentro da arvore React principal, sem criacao manual de elementos DOM.

Na conclusao da etapa 10, financeiro e configuracoes usam `DataTable`, `TreeView`, `CalendarGrid`, `DefinitionList`, `Timeline`, `PageHeader`, `FilterBar`, `Stepper`, `Alert`, `AttachmentList` e dialogs React. Status, vencimentos e pagamentos sao expostos por texto e nao apenas por cor.
