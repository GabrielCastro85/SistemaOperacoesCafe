-- Nota triangulada: uma nota de XML onde nem o emitente nem o destinatario
-- e' CNPJ proprio pode representar uma compra de um fornecedor revendida a
-- um corretor/cliente na mesma remessa (ex: fornecedor emite direto pro CNPJ
-- do comprador final, e a empresa e' so' o intermediario). Essas duas colunas
-- guardam o SEGUNDO parceiro/tipo de operacao da nota -- o primeiro continua
-- em responsible_partner_id (operation_type e' por operacao, nao por
-- documento). Sem mudanca de RLS: sao colunas novas na mesma linha ja
-- coberta pelas policies existentes (select/write por linha inteira).

alter table fiscal_documents add column secondary_responsible_partner_id uuid references business_partners(id);
alter table fiscal_documents add column secondary_operation_type text check (secondary_operation_type in ('PURCHASE','SALE'));
