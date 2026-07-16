# Banco De Dados

Tabelas iniciais: `organizations`, `legal_entities`, `locations`, `users`, `installation_profiles`, `app_settings`, `migration_history`.

Migration `003_admin_modules`: adiciona `organizations.compact_logo_path`, `legal_entities.is_draft` e indices auxiliares para status, busca, tipo e UF. A migration preserva dados existentes e nao duplica seeds.

Relacionamentos: CNPJs pertencem a organizacoes; locais pertencem a organizacoes e podem apontar para um CNPJ; perfil de instalacao pode apontar para organizacao e CNPJ padrao.

Indices: slug de organizacao unico, username unico, chave de setting unica, CNPJ unico quando preenchido e indices por chaves estrangeiras principais.

IDs: UUID v4 via `crypto.randomUUID()`. A escolha privilegia robustez local/offline e baixa colisao sem coordenacao central.

Datas: ISO 8601 em texto. Valores monetarios futuros devem ser armazenados em centavos inteiros para evitar erro de ponto flutuante.

CNPJs ficam somente com numeros. Cadastros ativos exigem digitos verificadores validos; rascunhos podem manter CNPJ ausente enquanto dados reais nao forem informados.

Migration `004_partners_products_billing`: cria `business_partners`, `business_partner_roles`, `partner_legal_entities`, `partner_contacts`, `products`, `client_billing_profiles` e `service_rate_rules`.

Dinheiro fica em centavos inteiros em `service_rate_rules.rate_value_cents`. Quantidades futuras, como sacas com valores decimais, deverao usar campos decimais controlados; operacoes ainda nao foram criadas nesta etapa.
