// READ-ONLY diagnostic: lists every `trips` row for a tenant (optionally
// filtered by organization), with its linked trip_services/bookings, ordered
// by creation time -- used to see exactly what got written by which path
// (our OTP RPC vs. pruebas_api's own create_hotel_reservation_v1) without
// guessing from the UI.
//
// Run yourself, from your own terminal (uses SUPABASE_SERVICE_ROLE_KEY from .env):
//   node scripts/dev-inspect-trips.mjs <tenantId> [organizationId]

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

const [tenantId, organizationId] = process.argv.slice(2);
if (!tenantId) {
  console.error("Uso: node scripts/dev-inspect-trips.mjs <tenantId> [organizationId]");
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

let tripsQuery = `trips?tenant_id=eq.${tenantId}&order=created_at.desc&select=id,organization_id,traveler_id,owner_person_id,title,destination,starts_at,ends_at,status,source,workspace_id,created_at`;
if (organizationId) tripsQuery += `&organization_id=eq.${organizationId}`;

const trips = await get(tripsQuery);
console.log(`\n${trips.length} trips encontrados para tenant=${tenantId}${organizationId ? ` organization=${organizationId}` : ""}:\n`);

for (const trip of trips) {
  console.log(`--- trip ${trip.id} ---`);
  console.log(`  título: ${trip.title} | destino: ${trip.destination}`);
  console.log(`  org: ${trip.organization_id} | traveler_id: ${trip.traveler_id} | owner_person_id: ${trip.owner_person_id}`);
  console.log(`  fechas: ${trip.starts_at} -> ${trip.ends_at} | status: ${trip.status} | source: ${trip.source}`);
  console.log(`  workspace: ${trip.workspace_id} | creado: ${trip.created_at}`);

  const services = await get(`trip_services?tenant_id=eq.${tenantId}&trip_id=eq.${trip.id}&select=id,type,title,status,source,provenance,created_at`);
  for (const svc of services) {
    console.log(`    trip_service ${svc.id}: ${svc.type} "${svc.title}" status=${svc.status} source=${svc.source} provenance=${JSON.stringify(svc.provenance)}`);
  }

  const bookings = await get(`bookings?tenant_id=eq.${tenantId}&trip_id=eq.${trip.id}&select=id,locator,status,source,external_refs,created_at`);
  for (const bk of bookings) {
    console.log(`    booking ${bk.id}: locator=${bk.locator} status=${bk.status} source=${bk.source}`);
    console.log(`      external_refs: ${JSON.stringify(bk.external_refs)}`);
  }

  const participants = await get(`trip_participants?tenant_id=eq.${tenantId}&trip_id=eq.${trip.id}&select=person_id,role,is_primary,status`);
  console.log(`    participants: ${JSON.stringify(participants)}`);
  console.log();
}
