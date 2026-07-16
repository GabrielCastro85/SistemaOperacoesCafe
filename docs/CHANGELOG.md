# Changelog

## 0.1.0

- Criada fundacao Electron, React, TypeScript e Vite.
- Adicionado SQLite local com migrations e seeds demonstrativos.
- Adicionado perfil de instalacao e variantes de branding.
- Criadas telas de splash, setup, shell, diagnostico e placeholders.
- Criada documentacao inicial do produto, dominio, arquitetura, banco, dados, branding e roadmap.
- Validado `lint`, `typecheck`, `test:run`, `build` e `package` em modo diretorio.

## 0.2.0

- Adicionada migration `003_admin_modules`.
- Criadas telas administrativas para organizacoes, empresas/CNPJs, locais, identidade visual e perfil da instalacao.
- Adicionadas regras de variante no processo principal.
- Adicionada validacao de CNPJ e suporte a rascunho de pessoa juridica.
- Adicionado fluxo seguro de branding com copia para `userData/settings/branding`.
- Ampliados testes de banco, servicos administrativos, restricoes e branding.

## 0.3.0

- Adicionada migration `004_partners_products_billing`.
- Criados cadastros de parceiros comerciais, papeis, estabelecimentos, contatos e produtos.
- Criados perfis de cobranca para clientes.
- Criadas regras de valor por saca com dinheiro em centavos, vigencia, prioridade e escopo interno/externo.
- Criado resolvedor de regra aplicavel para futuras operacoes.
- Adicionadas telas em Clientes e Cobrancas.
- Ampliados testes para parceiros, produtos, cobranca e resolvedor.
