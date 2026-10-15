// READ-ONLY diagnostic: for a given email, shows the two SEPARATE mechanisms
// that decide "access to an organization" in this system, side by side:
//   - memberships: requires login (user_id NOT NULL) -- "acceso como usuario"
//     (lo que usa el login OTP / el selector de organización de la Topbar)
//   - person_organization_links: NO requiere login -- "acceso como persona
//     viajera" (lo que usa pruebas_api para decidir quién sale en el
//     buscador de huéspedes al armar una reserva, GET /persons)
// Estas dos tablas NO se mantienen sincronizadas automáticamente hoy -- una
// persona puede tener membership en una organización sin tener (todavía)
// ningún person_organization_links ahí, y viceversa.
//
// Run yourself, from your own terminal (uses SUPABASE_SERVICE_ROLE_KEY from .env):
//   node scripts/dev-inspect-person-access.mjs <email>

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

const [email] = process.argv.slice(2);
if (!email) {
  console.error("Uso: node scripts/dev-inspect-person-access.mjs <email>");
  process.exit(1);
}

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

async function get(path) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(`GET ${path} failed: ${JSON.stringify(data)}`);
  return data;
}

const persons = await get(`persons?email=eq.${encodeURIComponent(email)}&select=id,tenant_id,full_name,email`);
if (persons.length === 0) {
  console.log(`No existe ninguna fila en "persons" con el correo ${email}.`);
  process.exit(0);
}

for (const person of persons) {
  console.log(`\n=== persona ${person.id} (${person.full_name}, tenant=${person.tenant_id}) ===`);

  const memberships = await get(
    `memberships?tenant_id=eq.${person.tenant_id}&person_id=eq.${person.id}&select=organization_id,roles,created_at&order=created_at.asc`,
  );
  console.log(`\nACCESO COMO USUARIO (memberships, requiere login) -- ${memberships.length} fila(s):`);
  for (const m of memberships) console.log(`  - organization_id=${m.organization_id} roles=${JSON.stringify(m.roles)} desde=${m.created_at}`);
  if (memberships.length === 0) console.log("  (ninguna)");

  const links = await get(
    `person_organization_links?tenant_id=eq.${person.tenant_id}&person_id=eq.${person.id}&select=organization_id,relationship_type,created_at&order=created_at.asc`,
  );
  console.log(`\nACCESO COMO PERSONA VIAJERA (person_organization_links, NO requiere login) -- ${links.length} fila(s):`);
  for (const l of links) console.log(`  - organization_id=${l.organization_id} relationship_type=${l.relationship_type} desde=${l.created_at}`);
  if (links.length === 0) console.log("  (ninguna)");

  const membershipOrgs = new Set(memberships.map((m) => m.organization_id));
  const linkOrgs = new Set(links.map((l) => l.organization_id));
  const onlyMembership = [...membershipOrgs].filter((id) => !linkOrgs.has(id));
  if (onlyMembership.length > 0) {
    console.log(`\n>> Tienes acceso como USUARIO pero NO como persona viajera en: ${onlyMembership.join(", ")}`);
    console.log("   Por eso no apareces en el buscador de huéspedes de esas organizaciones todavía --");
    console.log("   se crea solo la primera vez que reservas (o eres huésped) ahí.");
  }
}
