import { createClient } from "@supabase/supabase-js";

// Mesmo projeto/chave publica ja embutida no app desktop -- protegida por RLS
// (papel VIEWER, somente leitura, escopo por CNPJ). Ver supabase/migrations/
// 0004, 0005 e 0019 no repositorio principal do Sistema de Operacoes de Cafe.
const SUPABASE_URL = "https://nughallusfqshtnrerha.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_oougmIpGXTX5Ws5EiFKiJg_LC0KqTn7";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const CONFIRMATION_FILES_BUCKET = "confirmation-files";
