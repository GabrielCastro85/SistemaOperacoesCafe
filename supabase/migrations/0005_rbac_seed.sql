-- ============================================================================
-- Seed do catalogo real de RBAC, extraido do SQLite local em producao (5
-- roles, 29 permissoes, 61 vinculos role->permissao) -- sem essa carga, as
-- funcoes user_has_permission/user_has_org_access (migration 0003) e as
-- policies de RLS (migration 0004) nunca retornam true pra ninguem, ja que
-- dependem de role_permissions/roles existirem. Idempotente via
-- ON CONFLICT (code) DO NOTHING, mesmo padrao das migrations anteriores.
-- ============================================================================

insert into roles (code, name, description, scope_type, is_system, is_active) values
  ('FINANCE_MANAGER', 'Gestor financeiro', 'Gerencia cobrancas, conta-corrente, contas a pagar e relatorios.', 'ORGANIZATION', true, true),
  ('OPERATIONS_MANAGER', 'Gestor operacional', 'Gerencia notas, operacoes, importacoes e confirmacoes.', 'ORGANIZATION', true, true),
  ('OPERATOR', 'Operador', 'Lanca e consulta rotinas do dia a dia.', 'LEGAL_ENTITY', true, true),
  ('SYSTEM_ADMIN', 'Administrador do sistema', 'Acesso total, incluindo usuarios, roles e auditoria.', 'GLOBAL', true, true),
  ('VIEWER', 'Consulta', 'Acesso somente leitura.', 'LEGAL_ENTITY', true, true)
on conflict (code) do nothing;

insert into permissions (code, name, description, module, risk_level, is_active) values
  ('audit.view', 'Ver auditoria', 'Permite consultar trilha de auditoria.', 'audit', 'HIGH', true),
  ('backups.configure', 'Configurar backups', 'Permite alterar configuracao de backup automatico.', 'backups', 'HIGH', true),
  ('backups.create', 'Criar backups', 'Permite criar backups manuais e automaticos.', 'backups', 'MEDIUM', true),
  ('backups.delete', 'Apagar backups', 'Permite remover backups nao protegidos.', 'backups', 'HIGH', true),
  ('backups.protect', 'Proteger backups', 'Permite proteger e desproteger backups contra retencao.', 'backups', 'HIGH', true),
  ('backups.restore', 'Restaurar backups', 'Permite substituir a instalacao por um backup validado.', 'backups', 'CRITICAL', true),
  ('backups.verify', 'Verificar backups', 'Permite validar integridade de pacotes de backup.', 'backups', 'MEDIUM', true),
  ('backups.view', 'Ver backups', 'Permite consultar historico de backups.', 'backups', 'LOW', true),
  ('billing.manage', 'Gerenciar cobrancas', 'Permite emitir cobrancas e lancar recebimentos.', 'billing', 'HIGH', true),
  ('commercial.manage', 'Gerenciar cadastros comerciais', 'Permite alterar parceiros, produtos e regras.', 'commercial', 'HIGH', true),
  ('commercial.view', 'Ver cadastros comerciais', 'Permite consultar parceiros, produtos e regras.', 'commercial', 'LOW', true),
  ('confirmations.manage', 'Gerenciar confirmacoes', 'Permite emitir, cancelar e substituir confirmacoes.', 'confirmations', 'HIGH', true),
  ('finance.manage', 'Gerenciar financeiro', 'Permite criar contas a pagar, pagamentos e anexos.', 'finance', 'HIGH', true),
  ('finance.view', 'Ver financeiro', 'Permite consultar financeiro e relatórios.', 'finance', 'MEDIUM', true),
  ('imports.manage', 'Gerenciar importacoes', 'Permite importar e reverter XML/planilhas.', 'operations', 'HIGH', true),
  ('integrity.export', 'Exportar integridade', 'Permite gerar relatorios de integridade.', 'integrity', 'MEDIUM', true),
  ('integrity.run', 'Executar integridade', 'Permite executar verificacoes de integridade.', 'integrity', 'MEDIUM', true),
  ('integrity.view', 'Ver integridade', 'Permite consultar integridade de banco, documentos e backups.', 'integrity', 'LOW', true),
  ('operations.manage', 'Gerenciar operacoes', 'Permite criar, confirmar e cancelar notas/operacoes.', 'operations', 'HIGH', true),
  ('operations.view', 'Ver operacoes', 'Permite consultar notas e operacoes.', 'operations', 'LOW', true),
  ('retention.manage', 'Gerenciar retencao', 'Permite aplicar politicas de retencao de backups e temporarios.', 'backups', 'HIGH', true),
  ('roles.manage', 'Gerenciar roles', 'Permite alterar atribuicoes de roles.', 'access', 'CRITICAL', true),
  ('roles.view', 'Ver roles', 'Permite consultar matriz de permissoes.', 'access', 'MEDIUM', true),
  ('settings.manage', 'Gerenciar configuracoes', 'Permite alterar organizacoes, filiais e parametrizacoes.', 'settings', 'HIGH', true),
  ('system.bootstrap', 'Criar primeiro administrador', 'Permite concluir a criacao local inicial.', 'system', 'CRITICAL', true),
  ('system.view', 'Ver sistema', 'Permite abrir diagnosticos e contexto do app.', 'system', 'LOW', true),
  ('temporary_files.cleanup', 'Limpar temporarios', 'Permite limpar somente arquivos temporarios seguros.', 'integrity', 'HIGH', true),
  ('users.manage', 'Gerenciar usuarios', 'Permite criar, alterar, bloquear e reativar usuarios.', 'access', 'CRITICAL', true),
  ('users.view', 'Ver usuarios', 'Permite listar usuarios e perfis.', 'access', 'MEDIUM', true)
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('FINANCE_MANAGER', 'audit.view'),
  ('FINANCE_MANAGER', 'backups.create'),
  ('FINANCE_MANAGER', 'backups.verify'),
  ('FINANCE_MANAGER', 'backups.view'),
  ('FINANCE_MANAGER', 'billing.manage'),
  ('FINANCE_MANAGER', 'commercial.view'),
  ('FINANCE_MANAGER', 'finance.manage'),
  ('FINANCE_MANAGER', 'finance.view'),
  ('FINANCE_MANAGER', 'integrity.export'),
  ('FINANCE_MANAGER', 'integrity.run'),
  ('FINANCE_MANAGER', 'integrity.view'),
  ('FINANCE_MANAGER', 'operations.view'),
  ('FINANCE_MANAGER', 'system.view'),
  ('OPERATIONS_MANAGER', 'billing.manage'),
  ('OPERATIONS_MANAGER', 'commercial.manage'),
  ('OPERATIONS_MANAGER', 'commercial.view'),
  ('OPERATIONS_MANAGER', 'confirmations.manage'),
  ('OPERATIONS_MANAGER', 'finance.view'),
  ('OPERATIONS_MANAGER', 'imports.manage'),
  ('OPERATIONS_MANAGER', 'operations.manage'),
  ('OPERATIONS_MANAGER', 'operations.view'),
  ('OPERATIONS_MANAGER', 'system.view'),
  ('OPERATOR', 'commercial.view'),
  ('OPERATOR', 'finance.view'),
  ('OPERATOR', 'operations.manage'),
  ('OPERATOR', 'operations.view'),
  ('OPERATOR', 'system.view'),
  ('SYSTEM_ADMIN', 'audit.view'),
  ('SYSTEM_ADMIN', 'backups.configure'),
  ('SYSTEM_ADMIN', 'backups.create'),
  ('SYSTEM_ADMIN', 'backups.delete'),
  ('SYSTEM_ADMIN', 'backups.protect'),
  ('SYSTEM_ADMIN', 'backups.restore'),
  ('SYSTEM_ADMIN', 'backups.verify'),
  ('SYSTEM_ADMIN', 'backups.view'),
  ('SYSTEM_ADMIN', 'billing.manage'),
  ('SYSTEM_ADMIN', 'commercial.manage'),
  ('SYSTEM_ADMIN', 'commercial.view'),
  ('SYSTEM_ADMIN', 'confirmations.manage'),
  ('SYSTEM_ADMIN', 'finance.manage'),
  ('SYSTEM_ADMIN', 'finance.view'),
  ('SYSTEM_ADMIN', 'imports.manage'),
  ('SYSTEM_ADMIN', 'integrity.export'),
  ('SYSTEM_ADMIN', 'integrity.run'),
  ('SYSTEM_ADMIN', 'integrity.view'),
  ('SYSTEM_ADMIN', 'operations.manage'),
  ('SYSTEM_ADMIN', 'operations.view'),
  ('SYSTEM_ADMIN', 'retention.manage'),
  ('SYSTEM_ADMIN', 'roles.manage'),
  ('SYSTEM_ADMIN', 'roles.view'),
  ('SYSTEM_ADMIN', 'settings.manage'),
  ('SYSTEM_ADMIN', 'system.bootstrap'),
  ('SYSTEM_ADMIN', 'system.view'),
  ('SYSTEM_ADMIN', 'temporary_files.cleanup'),
  ('SYSTEM_ADMIN', 'users.manage'),
  ('SYSTEM_ADMIN', 'users.view'),
  ('VIEWER', 'commercial.view'),
  ('VIEWER', 'finance.view'),
  ('VIEWER', 'operations.view'),
  ('VIEWER', 'roles.view'),
  ('VIEWER', 'system.view')
) as seed(role_code, permission_code)
join roles r on r.code = seed.role_code
join permissions p on p.code = seed.permission_code
on conflict (role_id, permission_id) do nothing;
