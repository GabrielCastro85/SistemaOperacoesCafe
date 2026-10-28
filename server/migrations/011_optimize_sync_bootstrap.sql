-- A instalação nova baixa um retrato completo da base ordenado por tabela e
-- chave. Sem este índice parcial, o PostgreSQL precisa ordenar todos os
-- registros centrais novamente a cada página, fazendo o primeiro acesso
-- expirar quando a base cresce.
CREATE INDEX IF NOT EXISTS idx_central_records_bootstrap
  ON central_records(table_name, row_key)
  WHERE deleted = false;
