// Creates (or reuses, if they already exist) the 4 rows `create_hotel_reservation_v1`
// requires for ANY organization to book a hotel: client_accounts, a CORPORATE
// workspace + its workspace_client_accounts link, billing_accounts, and
// credit_accounts -- same shape as database/hotel_booking/02_demo_client_seed.sql's
// manual SQL seed for org_demo_cliente, but runnable for any organization without
// hand-writing SQL each time.
//
// Idempotent: checks each table before inserting, never duplicates.
//
// Run yourself, from your own terminal (uses SUPABASE_SERVICE_ROLE_KEY from .env):
//   node scripts/dev-provision-client-accounts.mjs <organizationId> "<Nombre>" [tenantId] [creditLimit] [currency]
//
// tenantId defaults to tnt_stg_personal, creditLimit to 100000, currency to MXN.

import { readFileSync } from "node:fs";

function loadEnv() {
  const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

const [organizationId, name, tenantId = "tnt_stg_personal", creditLimitRaw = "100000", currency = "MXN"] = process.argv.slice(2);
if (!organizationId || !name) {
  console.error('Uso: node scripts/dev-provision-client-accounts.mjs <organizationId> "<Nombre>" [tenantId] [creditLimit] [currency]');
  process.exit(1);
}
const creditLimit = Number(creditLimitRaw);

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

async function getOne(table, query) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}&select=*`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(`GET ${table} failed: ${JSON.stringify(data)}`);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function insertOne(table, body) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`INSERT ${table} failed: ${JSON.stringify(data)}`);
  return data[0];
}

async function ensure(table, query, body, label) {
  const existing = await getOne(table, query);
  if (existing) {
    console.log(`- ${label}: ya existía (${existing.id})`);
    return existing;
  }
  const created = await insertOne(table, body);
  console.log(`- ${label}: creada (${created.id})`);
  return created;
}

const clientAccount = await ensure(
  "client_accounts",
  `tenant_id=eq.${tenantId}&organization_id=eq.${organizationId}`,
  { tenant_id: tenantId, organization_id: organizationId, name, status: "ACTIVE" },
  "client_accounts",
);

const workspace = await ensure(
  "workspaces",
  `tenant_id=eq.${tenantId}&organization_id=eq.${organizationId}&workspace_type=eq.CORPORATE`,
  { tenant_id: tenantId, workspace_type: "CORPORATE", name: `${name} · Viajes corporativos`, organization_id: organizationId, client_account_id: clientAccount.id, status: "ACTIVE" },
  "workspaces (CORPORATE)",
);

await ensure(
  "workspace_client_accounts",
  `tenant_id=eq.${tenantId}&workspace_id=eq.${workspace.id}&client_account_id=eq.${clientAccount.id}`,
  { tenant_id: tenantId, workspace_id: workspace.id, client_account_id: clientAccount.id, relationship_type: "OWNS", status: "ACTIVE" },
  "workspace_client_accounts",
);

await ensure(
  "billing_accounts",
  `tenant_id=eq.${tenantId}&organization_id=eq.${organizationId}`,
  { tenant_id: tenantId, organization_id: organizationId, currency, billing_terms: "Crédito corporativo · 30 días", payment_terms_days: 30, status: "ACTIVE" },
  "billing_accounts",
);

await ensure(
  "credit_accounts",
  `tenant_id=eq.${tenantId}&organization_id=eq.${organizationId}`,
  { tenant_id: tenantId, organization_id: organizationId, credit_limit: creditLimit, currency, terms: "30 días", status: "ACTIVE" },
  "credit_accounts",
);

console.log(`\nListo -- ${organizationId} ya puede reservar con crédito de ${creditLimit} ${currency}.`);
