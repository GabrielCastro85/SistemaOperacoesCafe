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

Migration `005_manual_invoices_operations`: cria `fiscal_documents`, `fiscal_document_items` e `operations`.

Estrategia decimal: quantidades, sacas e precos comerciais ficam como texto decimal normalizado com ate 6 casas (`quantity_decimal`, `unit_price_decimal`, `sacks_quantity_decimal`, `quantity_sacks_decimal`). Dinheiro final permanece em centavos inteiros.

Migration `006_spreadsheet_imports`: adiciona `source`, `import_job_id` e `import_row_id` em `fiscal_documents` e `operations`, e cria `spreadsheet_mapping_templates`, `spreadsheet_import_jobs`, `spreadsheet_import_rows` e `partner_aliases`.

Importacoes armazenam o arquivo original copiado para `userData/documents/spreadsheet-imports/<job-id>/`, o job, cada linha bruta, os dados normalizados, alertas, erros, ids gerados e status de reversao. O banco mantem origem `MANUAL` ou `SPREADSHEET` para separar lancamentos digitados de historicos importados.

Migration `007_xml_imports`: reconstrói `fiscal_documents` e `operations` para permitir `source = XML`, adiciona campos fiscais do XML/protocolo e cria `xml_import_jobs`, `xml_import_files`, `fiscal_document_events`, `product_aliases`, `operation_classification_rules` e `fiscal_document_merge_history`.

Campos principais adicionados em notas: `xml_file_path`, `xml_file_hash`, `protocol_number`, `protocol_date`, `authorization_status_code`, `authorization_status_message`, `xml_import_job_id`, `merged_from_source`, `merged_at`, `direction` e `fiscal_snapshot_json`.

Eventos fiscais possuem unicidade por chave, tipo, sequencia e protocolo. Arquivos XML guardam hash SHA-256, tipo detectado, status, dados extraidos e resolucoes internas. Mesclagens registram origem anterior, decisao e diferencas em JSON auditavel.

Migration `008_client_charges_ledger`: adiciona `billing_status` e `client_charge_id` em `operations`, cria `client_charges`, `client_charge_operations`, `client_charge_adjustments`, `client_ledger_entries`, `client_credit_allocations`, `client_payments`, `client_payment_allocations`, `document_sequences`, `charge_document_versions` e `charge_status_history`.

Cada operacao confirmada pode estar `UNBILLED`, `RESERVED` ou `BILLED`. A tabela `client_charge_operations` mantem historico e possui indice unico parcial para impedir que a mesma operacao esteja reservada em duas cobrancas abertas ao mesmo tempo.

Valores financeiros continuam em centavos inteiros. Quantidades de sacas usadas na cobranca sao snapshots decimais em texto, preservando o valor operacional original. Cobrancas emitidas guardam `snapshot_json`, numero sequencial por organizacao/CNPJ/ano em `document_sequences` e caminhos dos arquivos gerados em `userData/documents/charges`.
