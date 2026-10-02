-- ============================================================================
-- CATÁLOGO DE HOTELES (convenio) — tablas destino en la base de Care (Supabase)
-- BORRADOR, NO APLICADO. NO PROBADO contra la base real: correr primero en pruebas.
--
-- Orden de ejecución completo de esta carpeta:
--   1. 01_schema.sql              (este archivo: tablas + vista + tablas staging)
--   2. 02_mia_export_queries.sql  (se corre en MIA/MySQL; exporta 2 CSV)
--   3. cargar los CSV en stg_mia_hoteles y stg_mia_tarifas (Table Editor > Import CSV)
--   4. 03_import_from_staging.sql (llena organizations, suppliers y supplier_hotel_profiles)
--
-- Sigue el diseño de Care (docs/SUPPLIERS_CATALOG_ARCHITECTURE.md en noktos-care-foundation):
--   un hotel = una organization (kind='PROVIDER') + una fila en suppliers + un perfil de hotel.
-- Aquí solo se crean suppliers y supplier_hotel_profiles. Fiscal y cuentas bancarias
-- (supplier_tax_identities, supplier_bank_accounts...) NO se crean todavía.
--
-- Prerrequisitos: ya existen public.tenants, public.organizations y public.noktos_id().
-- Esquema privado: se usa el esquema "private" que ya existe en Care.
--
-- Mapeo MIA -> Care (detalle de columnas en 03_import_from_staging.sql):
--   hoteles.nombre               -> organizations.name
--   hoteles.Ciudad_Zona/Estado   -> suppliers.address_city / address_state
--   hoteles.vigencia_convenio    -> suppliers.agreement_expires_at
--   proveedores.tipo_pago        -> suppliers.payment_terms (CREDIT/PREPAID)
--   proveedores.vencimiento_credito -> suppliers.credit_term_days
--   tarifas.precio / costo       -> supplier_hotel_profiles.rate / cost
--   hoteles.id_hotel             -> suppliers.legacy_id (trazabilidad, reimportable)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. suppliers — ficha comercial del proveedor (1:1 con organizations)
-- ----------------------------------------------------------------------------
create table public.suppliers (
  id text primary key default public.noktos_id('sup'),
  tenant_id text not null references public.tenants(id),
  organization_id text not null,

  categories text[] not null default '{}',
  is_intermediary boolean not null default false,

  payment_terms text not null check (payment_terms in ('CREDIT', 'PREPAID')),  -- como NOSOTROS le pagamos al proveedor
  credit_term_days smallint,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  agreement_expires_at date,           -- convenio vigente si es >= la fecha de llegada
  negotiation_notes text,

  international boolean not null default false,
  international_notes text,
  bilingual boolean not null default false,
  bilingual_notes text,

  address_street text,
  address_exterior_number text,
  address_neighborhood text,
  address_municipality text,
  address_city text,
  address_city_key text,               -- ciudad en minúsculas y sin acentos (lo llena el trigger); sirve para buscar
  address_state text,
  address_postal_code text,
  address_country text,
  address_country_code text,           -- 'MX', etc.

  contacts_agreement text,
  availability_request_notes text,     -- cómo se pide disponibilidad
  booking_request_notes text,          -- cómo se reserva
  payment_notes text,
  general_notes text,

  legacy_source text,                  -- p. ej. 'MIA_HOTELES'
  legacy_id text,                      -- id del sistema anterior (hoteles.id_hotel)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, id),
  unique (tenant_id, organization_id),
  constraint suppliers_categories_chk check (categories <@ array['HOTEL','AIRLINE','CAR_RENTAL']::text[]),
  constraint suppliers_legacy_chk check ((legacy_source is null) = (legacy_id is null)),
  constraint suppliers_org_same_tenant_fk foreign key (tenant_id, organization_id)
    references public.organizations (tenant_id, id)
);

create unique index suppliers_legacy_uq on public.suppliers (tenant_id, legacy_source, legacy_id)
  where legacy_source is not null;
create index suppliers_tenant_status_idx on public.suppliers (tenant_id, status);
create index suppliers_city_idx on public.suppliers (tenant_id, address_city_key);

create or replace function private.suppliers_set_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.address_city_key := translate(lower(coalesce(new.address_city, '')), 'áéíóúüñ', 'aeiouun');
  new.updated_at := now();
  return new;
end;
$$;

create trigger suppliers_set_keys
  before insert or update on public.suppliers
  for each row execute function private.suppliers_set_keys();


-- ----------------------------------------------------------------------------
-- 2. supplier_hotel_profiles — datos del hotel y su tarifa (1:1 con suppliers)
--    Una sola tarifa por hotel: en MIA el desglose por tipo de cuarto y por agente
--    existe en el esquema pero nunca se usó.
-- ----------------------------------------------------------------------------
create table public.supplier_hotel_profiles (
  id text primary key default public.noktos_id('shp'),
  tenant_id text not null references public.tenants(id),
  supplier_id text not null,

  hotel_type text check (hotel_type in ('hotel','motel','casa','departamento')),
  rating numeric(3,1) check (rating is null or (rating >= 0 and rating <= 5)),
  latitude numeric(10,6),
  longitude numeric(10,6),
  description text,
  contact_email text,
  contact_phone text,

  rate numeric(12,2),                  -- precio por noche y por cuarto (confirmado por el usuario)
  cost numeric(12,2),                  -- lo que le cuesta a MIA
  currency text not null default 'MXN' check (currency in ('MXN','USD','EUR')),  -- MXN es un supuesto sin confirmar
  rate_includes_tax boolean,           -- true = precio final con impuestos (así se captura en convenio); false = sin impuestos; NULL = no se sabe

  breakfast_included boolean not null default false,
  breakfast_price numeric(12,2),
  breakfast_notes text,
  extra_night_price numeric(12,2),
  extra_person_price numeric(12,2),

  minors_policy text,
  extra_person_policy text,
  pets_notes text,
  venues_notes text,
  transport_notes text,

  photo_urls text[] not null default '{}',
  quote_image_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, id),
  unique (tenant_id, supplier_id),
  constraint supplier_hotel_profiles_supplier_fk foreign key (tenant_id, supplier_id)
    references public.suppliers (tenant_id, id) on delete cascade
);


-- ----------------------------------------------------------------------------
-- 3. Vista que consume el back (pruebas_api, estrategia "convenio")
-- ----------------------------------------------------------------------------
create view public.hotel_catalog_v with (security_invoker = true) as
select
  s.tenant_id,
  s.id as supplier_id,
  s.organization_id,
  o.name as hotel_name,
  s.legacy_id,
  s.status,
  s.agreement_expires_at,
  s.address_street,
  s.address_city,
  s.address_city_key,
  s.address_state,
  s.address_postal_code,
  s.address_country,
  s.address_country_code,
  s.payment_terms,
  s.credit_term_days,
  s.is_intermediary,
  s.availability_request_notes,
  s.booking_request_notes,
  p.hotel_type,
  p.rating,
  p.latitude,
  p.longitude,
  p.description,
  p.contact_email,
  p.contact_phone,
  p.rate,
  p.cost,
  p.currency,
  p.rate_includes_tax,
  p.breakfast_included,
  p.breakfast_price,
  p.breakfast_notes,
  p.extra_night_price,
  p.extra_person_price,
  p.photo_urls
from public.suppliers s
join public.organizations o on o.tenant_id = s.tenant_id and o.id = s.organization_id
join public.supplier_hotel_profiles p on p.tenant_id = s.tenant_id and p.supplier_id = s.id
where 'HOTEL' = any (s.categories);


-- ----------------------------------------------------------------------------
-- 4. RLS por tenant (mismo patrón que el resto de Care).
--    El back usa la llave de servicio (se salta la RLS), por eso el propio back
--    debe filtrar siempre por tenant_id.
-- ----------------------------------------------------------------------------
alter table public.suppliers enable row level security;
alter table public.supplier_hotel_profiles enable row level security;

create policy suppliers_isolation on public.suppliers for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy supplier_hotel_profiles_isolation on public.supplier_hotel_profiles for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.suppliers, public.supplier_hotel_profiles to authenticated;
grant select on public.hotel_catalog_v to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Tablas de paso (staging) para cargar los CSV de MIA. Todo en texto a propósito.
--    Los nombres de columna son EXACTAMENTE los alias de 02_mia_export_queries.sql.
--    RLS activado sin políticas: nadie las ve por la API. Se pueden borrar al terminar.
-- ----------------------------------------------------------------------------
create table public.stg_mia_hoteles (
  id_hotel text, nombre text, correo text, telefono text, direccion text,
  lat text, lng text, descripcion text, calificacion text, tipo_hospedaje text,
  estado text, ciudad text, codigo_postal text, colonia text, pais text,
  url_imagen_hotel text, url_imagen_hotel_q text, url_imagen_hotel_qq text,
  activo text, tipo_negociacion text, vigencia_convenio text, comentario_vigencia text,
  hotel_tipo_pago text, disponibilidad_precio text, contacto_convenio text,
  contacto_recepcion text, comentario_pago text,
  desayuno_incluido text, desayuno_comentarios text, desayuno_precio_por_persona text,
  menores_edad text, pax_extra_persona text, mascotas text, salones text,
  transportacion text, transportacion_comentarios text, comentarios text,
  id_proveedor text, proveedor_tipo_pago text, vencimiento_credito text,
  intermediario text, internacional text, bilingue text
);

create table public.stg_mia_tarifas (
  id_tarifa text, id_hotel text, precio text, costo text, incluye_desayuno text,
  precio_desayuno text, precio_noche_extra text, comentario_desayuno text,
  precio_persona_extra text, tipo_desayuno text, activa text
);

alter table public.stg_mia_hoteles enable row level security;
alter table public.stg_mia_tarifas enable row level security;
