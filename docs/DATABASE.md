# Banco De Dados

Tabelas iniciais: `organizations`, `legal_entities`, `locations`, `users`, `installation_profiles`, `app_settings`, `migration_history`.

Relacionamentos: CNPJs pertencem a organizacoes; locais pertencem a organizacoes e podem apontar para um CNPJ; perfil de instalacao pode apontar para organizacao e CNPJ padrao.

Indices: slug de organizacao unico, username unico, chave de setting unica, CNPJ unico quando preenchido e indices por chaves estrangeiras principais.

IDs: UUID v4 via `crypto.randomUUID()`. A escolha privilegia robustez local/offline e baixa colisao sem coordenacao central.

Datas: ISO 8601 em texto. Valores monetarios futuros devem ser armazenados em centavos inteiros para evitar erro de ponto flutuante.
