-- ============================================================================
-- IMPORTAR DESDE STAGING A organizations / suppliers / supplier_hotel_profiles
-- BORRADOR, NO PROBADO. Correr primero en pruebas.
--
-- Antes de correr:
--   1. Reemplazar tnt_stg_personal (buscar y reemplazar en todo el archivo) por el id del
--      tenant al que pertenecen estos hoteles (existe en public.tenants).
--   2. Ya cargados los CSV en public.stg_mia_hoteles y public.stg_mia_tarifas.
--
-- Es reimportable: los ids son determinísticos (org_mia_h_<id_hotel>, sup_mia_h_<id_hotel>,
-- shp_mia_h_<id_hotel>) y todo usa ON CONFLICT DO NOTHING, así que correrlo dos veces no
-- duplica. Para probar sin guardar: cambiar el COMMIT del final por ROLLBACK.
--
-- Sobre las tarifas:
--   * CONFIRMADO por el usuario (2026-10-01): tarifas.precio es por noche y por cuarto
--     (supplier_hotel_profiles.rate).
--   * Impuestos: primero se dijo que el precio NO los incluía; después, que los precios de convenio
--     se capturan "ya con todo", y que debe mostrarse como "precio con impuestos". Se guarda
--     rate_includes_tax = true (precio final). PENDIENTE de que el usuario confirme cuál es la verdad.
--   * SUPUESTO sin confirmar: la moneda de las tarifas es MXN.
-- ============================================================================

begin;

-- Limpia el texto del CSV: decodifica los valores "b64:..." (ver 02_mia_export_queries.sql),
-- quita espacios y trata '' y 'NULL' como nulo. Los ids vienen en claro y pasan tal cual.
create or replace function pg_temp.c(v text) returns text
language sql immutable as $$
  select nullif(nullif(btrim(
    case when v like 'b64:%' then convert_from(decode(substr(v, 5), 'base64'), 'UTF8') else v end
  ), ''), 'NULL')
$$;

-- Número seguro: si no es un número válido devuelve nulo en vez de fallar.
create or replace function pg_temp.n(v text) returns numeric
language sql immutable as $$
  select case when pg_temp.c(v) ~ '^-?[0-9]+(\.[0-9]+)?$' then pg_temp.c(v)::numeric end
$$;

-- 1. organizations (una por hotel, kind = 'PROVIDER') -------------------------
insert into public.organizations (id, tenant_id, name, kind, status, commercial_name)
select distinct on (h.id_hotel)
  'org_mia_h_' || h.id_hotel,
  'tnt_stg_personal',
  coalesce(pg_temp.c(h.nombre), 'Hotel ' || h.id_hotel),
  'PROVIDER',
  case when coalesce(pg_temp.c(h.activo), '1') in ('1', 'true') then 'ACTIVE' else 'SUSPENDED' end,
  pg_temp.c(h.nombre)
from public.stg_mia_hoteles h
where pg_temp.c(h.id_hotel) is not null
order by h.id_hotel
on conflict (id) do nothing;

-- 2. suppliers -----------------------------------------------------------------
insert into public.suppliers (
  id, tenant_id, organization_id, categories, is_intermediary,
  payment_terms, credit_term_days, status, agreement_expires_at, negotiation_notes,
  international, bilingual,
  address_street, address_neighborhood, address_city, address_state, address_postal_code,
  address_country, address_country_code,
  contacts_agreement, availability_request_notes, booking_request_notes, payment_notes, general_notes,
  legacy_source, legacy_id
)
select distinct on (h.id_hotel)
  'sup_mia_h_' || h.id_hotel,
  'tnt_stg_personal',
  'org_mia_h_' || h.id_hotel,
  array['HOTEL'],
  coalesce(pg_temp.c(h.intermediario), '0') = '1',
  -- Cómo le pagamos al hotel: primero lo que dice proveedores, si no, lo que dice hoteles.
  case when lower(coalesce(pg_temp.c(h.proveedor_tipo_pago), pg_temp.c(h.hotel_tipo_pago), '')) like 'cr%dito%'
       then 'CREDIT' else 'PREPAID' end,
  case when pg_temp.c(h.vencimiento_credito) ~ '^[0-9]+$' then pg_temp.c(h.vencimiento_credito)::smallint end,
  case when coalesce(pg_temp.c(h.activo), '1') in ('1', 'true') then 'ACTIVE' else 'INACTIVE' end,
  -- Las fechas '0000-00-00' de MySQL se ignoran.
  case when pg_temp.c(h.vigencia_convenio) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        and left(pg_temp.c(h.vigencia_convenio), 4) <> '0000'
       then left(pg_temp.c(h.vigencia_convenio), 10)::date end,
  nullif(concat_ws(E'\n', pg_temp.c(h.tipo_negociacion), pg_temp.c(h.comentario_vigencia)), ''),
  coalesce(pg_temp.c(h.internacional), '0') = '1',
  coalesce(pg_temp.c(h.bilingue), '0') = '1',
  pg_temp.c(h.direccion),
  pg_temp.c(h.colonia),
  pg_temp.c(h.ciudad),
  pg_temp.c(h.estado),
  pg_temp.c(h.codigo_postal),
  coalesce(pg_temp.c(h.pais), 'MEXICO'),
  case when upper(translate(coalesce(pg_temp.c(h.pais), 'MEXICO'), 'É', 'E')) = 'MEXICO' then 'MX' end,
  pg_temp.c(h.contacto_convenio),
  pg_temp.c(h.disponibilidad_precio),
  pg_temp.c(h.contacto_recepcion),
  pg_temp.c(h.comentario_pago),
  pg_temp.c(h.comentarios),            -- texto completo, sin separar por secciones '## ... ##'
  'MIA_HOTELES',
  h.id_hotel
from public.stg_mia_hoteles h
where pg_temp.c(h.id_hotel) is not null
order by h.id_hotel
on conflict (id) do nothing;

-- 3. supplier_hotel_profiles (una tarifa por hotel: la activa con id_tarifa más alto) ----
with best as (
  select distinct on (t.id_hotel) t.*
  from public.stg_mia_tarifas t
  where pg_temp.c(t.id_hotel) is not null
  order by t.id_hotel,
           (coalesce(pg_temp.c(t.activa), '1') = '1') desc,
           pg_temp.n(t.id_tarifa) desc nulls last
)
insert into public.supplier_hotel_profiles (
  id, tenant_id, supplier_id,
  hotel_type, rating, latitude, longitude, description, contact_email, contact_phone,
  rate, cost, currency, rate_includes_tax,
  breakfast_included, breakfast_price, breakfast_notes, extra_night_price, extra_person_price,
  minors_policy, extra_person_policy, pets_notes, venues_notes, transport_notes,
  photo_urls
)
select distinct on (h.id_hotel)
  'shp_mia_h_' || h.id_hotel,
  'tnt_stg_personal',
  'sup_mia_h_' || h.id_hotel,
  case when lower(pg_temp.c(h.tipo_hospedaje)) in ('hotel','motel','casa','departamento')
       then lower(pg_temp.c(h.tipo_hospedaje)) end,
  case when pg_temp.n(h.calificacion) is not null then least(5, pg_temp.n(h.calificacion)) end,  -- LEAST ignora nulos, por eso el CASE
  pg_temp.n(h.lat),
  pg_temp.n(h.lng),
  pg_temp.c(h.descripcion),
  pg_temp.c(h.correo),
  pg_temp.c(h.telefono),
  pg_temp.n(t.precio),
  pg_temp.n(t.costo),
  'MXN',
  true,                                 -- rate_includes_tax: precio final de convenio, "ya con todo" (ver cabecera)
  lower(coalesce(pg_temp.c(t.incluye_desayuno), pg_temp.c(h.desayuno_incluido), '0')) in ('1', 'si', 'sí', 'true'),
  coalesce(pg_temp.n(t.precio_desayuno), pg_temp.n(h.desayuno_precio_por_persona)),
  nullif(concat_ws(E'\n', pg_temp.c(t.comentario_desayuno), pg_temp.c(t.tipo_desayuno), pg_temp.c(h.desayuno_comentarios)), ''),
  pg_temp.n(t.precio_noche_extra),
  pg_temp.n(t.precio_persona_extra),
  pg_temp.c(h.menores_edad),
  pg_temp.c(h.pax_extra_persona),
  pg_temp.c(h.mascotas),
  pg_temp.c(h.salones),
  nullif(concat_ws(E'\n', pg_temp.c(h.transportacion), pg_temp.c(h.transportacion_comentarios)), ''),
  array_remove(array[
    pg_temp.c(h.url_imagen_hotel), pg_temp.c(h.url_imagen_hotel_q), pg_temp.c(h.url_imagen_hotel_qq)
  ], null)
from public.stg_mia_hoteles h
left join best t on t.id_hotel = h.id_hotel
where pg_temp.c(h.id_hotel) is not null
order by h.id_hotel
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Verificación (correr antes del COMMIT; los números deben tener sentido)
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.stg_mia_hoteles)                                        as hoteles_en_staging,
  (select count(*) from public.organizations where id like 'org_mia_h_%')              as organizaciones,
  (select count(*) from public.suppliers where legacy_source = 'MIA_HOTELES')          as proveedores,
  (select count(*) from public.supplier_hotel_profiles where id like 'shp_mia_h_%')    as perfiles,
  (select count(*) from public.supplier_hotel_profiles where id like 'shp_mia_h_%' and rate is null) as sin_tarifa,
  (select count(*) from public.suppliers where legacy_source = 'MIA_HOTELES' and address_city is null) as sin_ciudad,
  (select count(*) from public.suppliers where legacy_source = 'MIA_HOTELES'
     and agreement_expires_at >= current_date)                                         as con_convenio_vigente;

commit;   -- cambiar por ROLLBACK para probar sin guardar
