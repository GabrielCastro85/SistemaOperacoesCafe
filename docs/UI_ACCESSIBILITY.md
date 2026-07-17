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

Responsividade:

- layout testado por CSS para 1366 px e abaixo;
- sidebar recolhe em telas estreitas;
- topbar reorganiza em duas colunas;
- tabelas possuem rolagem horizontal segura;
- cards e grids caem para duas ou uma coluna conforme a largura.

Limitacoes restantes:

- dialogs legados ainda devem migrar de `confirm()`/`alert()` nativos para `Dialog`/`ConfirmationDialog`;
- formularios extensos ainda devem migrar para stepper completo;
- testes automatizados de contraste cobrem a funcao de cor legivel, mas nao substituem auditoria visual completa.
