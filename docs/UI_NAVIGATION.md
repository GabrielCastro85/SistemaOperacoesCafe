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
