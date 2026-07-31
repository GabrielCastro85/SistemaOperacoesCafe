/* global URL, console, process */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import WebSocket from "ws";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const email = process.argv[2];
if (!email) {
  console.error("uso: node scripts/supabase/bootstrap-admin.mjs <email>");
  process.exit(1);
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: WebSocket } });

const { data: existingList, error: listError } = await admin.auth.admin.listUsers();
if (listError) throw listError;
const existing = existingList.users.find((u) => u.email === email);

let userId;
let password = null;
if (existing) {
  userId = existing.id;
  console.log("usuario ja existe em auth.users:", userId, "(senha nao alterada)");
} else {
  password = randomBytes(9).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Administrador" } });
  if (error) throw error;
  userId = data.user.id;
  console.log("usuario criado em auth.users:", userId);
}

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await client.connect();

// espelho em app_users deveria ter sido feito pela trigger handle_new_user,
// mas confirma (idempotente) caso o trigger nao tenha disparado por algum motivo.
await client.query(
  `insert into app_users (id, display_name, username, normalized_username, email, status)
   values ($1, 'Administrador', $2, lower($2), $3, 'ACTIVE')
   on conflict (id) do nothing`,
  [userId, email.split("@")[0], email]
);

const roleRow = await client.query("select id from roles where code = 'SYSTEM_ADMIN'");
if (roleRow.rows.length === 0) throw new Error("role SYSTEM_ADMIN nao encontrada -- rode as migrations primeiro.");
const roleId = roleRow.rows[0].id;

const existingAssignment = await client.query(
  "select id from user_role_assignments where user_id = $1 and role_id = $2 and organization_id is null",
  [userId, roleId]
);
if (existingAssignment.rows.length === 0) {
  await client.query(
    `insert into user_role_assignments (user_id, role_id, organization_id, legal_entity_id, is_active)
     values ($1, $2, null, null, true)`,
    [userId, roleId]
  );
  console.log("papel SYSTEM_ADMIN (escopo global) atribuido.");
} else {
  console.log("papel SYSTEM_ADMIN ja atribuido.");
}

await client.end();

console.log("\n--- pronto ---");
console.log("email:", email);
if (password) console.log("senha temporaria:", password);
console.log("user id:", userId);
