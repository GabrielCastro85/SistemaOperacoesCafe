-- Empresa/CNPJ (partner_legal_entities) deixa de exigir um cliente/corretor
-- dono desde a criacao -- agora e' possivel cadastrar so' a empresa (ex: via
-- "Buscar CNPJ") e vincular a um cliente/corretor depois, quando a relacao
-- comercial de fato comecar. organization_id passa a existir na propria linha
-- porque antes ela so' sabia sua organizacao atraves do cliente/corretor dono
-- -- sem dono, nao ha' mais como derivar isso (nem pra RLS, nem pra filtros
-- por organizacao nas telas).

alter table partner_legal_entities add column organization_id uuid references organizations(id);

update partner_legal_entities ple
set organization_id = bp.organization_id
from business_partners bp
where bp.id = ple.business_partner_id;

alter table partner_legal_entities alter column organization_id set not null;
alter table partner_legal_entities alter column business_partner_id drop not null;

create index idx_partner_legal_entities_organization_id on partner_legal_entities(organization_id);

drop policy if exists partner_legal_entities_select on partner_legal_entities;
drop policy if exists partner_legal_entities_write on partner_legal_entities;

create policy partner_legal_entities_select on partner_legal_entities for select
  using (user_has_org_access(organization_id));
create policy partner_legal_entities_write on partner_legal_entities for all
  using (user_has_permission('commercial.manage', organization_id))
  with check (user_has_permission('commercial.manage', organization_id));
