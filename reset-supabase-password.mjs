import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const newPassword = process.env.SUPABASE_NEW_PASSWORD;

const userId = "459d4495-db13-4520-8ced-a85014b862ad";

if (!supabaseUrl || !serviceRoleKey || !newPassword) {
  console.error(
    "Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_NEW_PASSWORD no PowerShell."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  realtime: {
    transport: ws
  }
});

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  password: newPassword
});

if (error) {
  console.error("Erro ao alterar senha:", error.message);
  process.exit(1);
}

console.log("Senha alterada para:", data.user?.email);