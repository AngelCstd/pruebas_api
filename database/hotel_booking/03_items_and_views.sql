-- ============================================================================
-- RESERVAS DE HOTEL EN CARE: items, origen del proveedor y vistas
-- BORRADOR. Lo corre el usuario a mano (primero en pruebas). Probado en una base local con el
-- esquema de Care (sin triggers ni políticas reales); puede haber diferencias en tu base.
--
-- Orden de la carpeta:  01_schema.sql  ->  02_demo_client_seed.sql  ->  03 (este)  ->  04_reservation_functions.sql
--
-- Prerrequisitos: tablas base de Care (trips, trip_services, hotel_*, commercial_charges, credit_*,
-- payment_allocations, organizations, persons...) y public.suppliers / distribution_channels
-- (suppliers viene de ../hotel_catalog/01_schema.sql).
--
-- Decisiones: un cargo (commercial_charges) por item; todos los cargos de un servicio llevan
-- source_type='TRIP_SERVICE' y source_id = trip_service_id; un pago se aplica a varios cargos con
-- payment_allocations; facturas fuera de alcance (ver docs/PARTIAL_INVOICING_PENDING.md en Care).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. trip_service_items: desglose cobrable de un servicio. Cada item tiene su cargo (1:1).
--    Sin desglose = UN item kind 'SERVICE' por el total.
-- ----------------------------------------------------------------------------
create table public.trip_service_items (
  id text primary key default public.noktos_id('tsi'),
  tenant_id text not null references public.tenants(id),
  trip_service_id text not null,
  hotel_room_id text,
  charge_id text not null,

  kind text not null check (kind in (
    'SERVICE', 'ROOM_NIGHT', 'BREAKFAST', 'TICKET', 'SEAT', 'DOCUMENTATION', 'TAX', 'FEE', 'ADJUSTMENT'
  )),
  description text not null,
  usage_date date,

  currency text not null check (currency in ('MXN','USD','EUR')),
  subtotal numeric(18,2) not null,
  tax numeric(18,2) not null default 0,
  total numeric(18,2) not null,
  cost_subtotal numeric(18,2),
  cost_tax numeric(18,2),
  cost_total numeric(18,2),

  parent_item_id text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','VOID')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, id),
  unique (tenant_id, charge_id),
  constraint trip_service_items_charge_fk
    foreign key (tenant_id, charge_id) references public.commercial_charges (tenant_id, id),
  constraint trip_service_items_service_fk
    foreign key (tenant_id, trip_service_id) references public.trip_services (tenant_id, id),
  constraint trip_service_items_room_fk
    foreign key (tenant_id, hotel_room_id) references public.hotel_rooms (tenant_id, id),
  constraint trip_service_items_parent_fk
    foreign key (tenant_id, parent_item_id) references public.trip_service_items (tenant_id, id),

  constraint trip_service_items_total_chk check (total = subtotal + tax),
  constraint trip_service_items_cost_chk check (
    cost_total is null or cost_total = coalesce(cost_subtotal, 0) + coalesce(cost_tax, 0)
  ),
  constraint trip_service_items_sign_chk check (kind = 'ADJUSTMENT' or (subtotal >= 0 and tax >= 0)),
  constraint trip_service_items_adjustment_chk check (kind <> 'ADJUSTMENT' or parent_item_id is not null)
);

create index trip_service_items_service_idx on public.trip_service_items (tenant_id, trip_service_id);

create unique index trip_service_items_night_uq
  on public.trip_service_items (tenant_id, trip_service_id, (coalesce(hotel_room_id, '')), usage_date)
  where kind = 'ROOM_NIGHT' and status = 'ACTIVE';


-- ----------------------------------------------------------------------------
-- 2. hotel_booking_sourcing: de dónde viene la reserva y a quién se le compró (1:1 con el servicio)
-- ----------------------------------------------------------------------------
create table public.hotel_booking_sourcing (
  id text primary key default public.noktos_id('hbs'),
  tenant_id text not null references public.tenants(id),
  trip_service_id text not null,

  source text not null check (source in ('MOCK','NEMO','CONVENIO','MANUAL')),
  supplier_id text references public.suppliers (id),
  intermediary_supplier_id text references public.suppliers (id),
  distribution_channel_id text references public.distribution_channels (id),

  provider_booking_ref text,
  supplier_confirmation_code text,
  provider_status text,
  offer_snapshot jsonb not null default '{}'::jsonb,

  currency text not null check (currency in ('MXN','USD','EUR')),
  sale_amount numeric(18,2),
  cost_amount numeric(18,2),
  tax_amount numeric(18,2),

  cancellation_deadline timestamptz,
  supplier_payment_due_at date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, id),
  unique (tenant_id, trip_service_id),
  constraint hotel_booking_sourcing_service_fk
    foreign key (tenant_id, trip_service_id) references public.trip_services (tenant_id, id)
);

create index hotel_booking_sourcing_supplier_idx on public.hotel_booking_sourcing (tenant_id, supplier_id);


-- ----------------------------------------------------------------------------
-- 3. Vistas (security_invoker: heredan la RLS de las tablas base)
-- ----------------------------------------------------------------------------

-- 3a. Una fila por CARGO (= por item).
create view public.charge_balances_v with (security_invoker = true) as
select
  c.tenant_id,
  c.id as charge_id,
  c.source_id as trip_service_id,
  it.id as item_id,
  it.kind,
  it.description,
  it.usage_date,
  c.currency,
  c.status as charge_status,
  c.amount as charged,
  coalesce(a.paid, 0) as paid,
  c.amount - coalesce(a.paid, 0) as outstanding,
  c.due_at
from public.commercial_charges c
left join public.trip_service_items it on it.tenant_id = c.tenant_id and it.charge_id = c.id
left join lateral (
  select sum(pa.amount) as paid
  from public.payment_allocations pa
  where pa.tenant_id = c.tenant_id and pa.charge_id = c.id
) a on true
where c.source_type = 'TRIP_SERVICE' and c.status <> 'VOID';

-- 3b. Una fila por SERVICIO: todos sus cargos juntos.
create view public.booking_financials_v with (security_invoker = true) as
select
  f.tenant_id,
  f.trip_service_id,
  ts.trip_id,
  (select min(l.booking_id) from public.booking_service_links l
    where l.tenant_id = f.tenant_id and l.trip_service_id = f.trip_service_id) as booking_id,
  f.currency,
  f.charges,
  f.charged,
  f.paid,
  f.outstanding,
  f.next_due_at,
  f.charged - coalesce(i.items_total, 0) as items_gap
from (
  select tenant_id, trip_service_id, currency,
         count(*) as charges,
         sum(charged) as charged,
         sum(paid) as paid,
         sum(outstanding) as outstanding,
         min(due_at) filter (where outstanding > 0) as next_due_at
  from public.charge_balances_v
  group by tenant_id, trip_service_id, currency
) f
join public.trip_services ts on ts.tenant_id = f.tenant_id and ts.id = f.trip_service_id
left join lateral (
  select sum(it.total) as items_total
  from public.trip_service_items it
  where it.tenant_id = f.tenant_id and it.trip_service_id = f.trip_service_id and it.status = 'ACTIVE'
) i on true;

-- 3c. Pagos mal repartidos.
create view public.payment_allocation_check_v with (security_invoker = true) as
select
  p.tenant_id,
  p.id as payment_record_id,
  p.amount,
  coalesce(x.allocated, 0) as allocated,
  p.amount - coalesce(x.allocated, 0) as unallocated,
  coalesce(x.charges, 0) as charges_paid,
  coalesce(x.allocated, 0) > p.amount as over_allocated
from public.payment_records p
left join lateral (
  select sum(pa.amount) as allocated, count(distinct pa.charge_id) as charges
  from public.payment_allocations pa
  where pa.tenant_id = p.tenant_id and pa.payment_record_id = p.id
) x on true;

-- 3d. Crédito disponible: usado = pendiente de los cargos ligados a utilizaciones ACTIVAS; mientras la
--     retención aún no tiene cargo, cuenta el monto retenido. (Misma lógica del demo de Care.)
create view public.credit_availability_v with (security_invoker = true) as
select
  ca.tenant_id,
  ca.id as credit_account_id,
  ca.organization_id,
  ca.currency,
  ca.status,
  ca.credit_limit,
  coalesce(u.used, 0) as used,
  greatest(0, ca.credit_limit - coalesce(u.used, 0)) as available
from public.credit_accounts ca
left join lateral (
  select sum(coalesce(ch.outstanding, cu.amount)) as used
  from public.credit_utilizations cu
  left join lateral (
    select sum(greatest(0, c.amount - coalesce((
      select sum(pa.amount) from public.payment_allocations pa
      where pa.tenant_id = c.tenant_id and pa.charge_id = c.id
    ), 0))) as outstanding
    from public.commercial_charges c
    where c.tenant_id = cu.tenant_id and c.source_type = cu.source_type
      and c.source_id = cu.source_id and c.status <> 'VOID'
  ) ch on true
  where cu.tenant_id = ca.tenant_id and cu.credit_account_id = ca.id and cu.status = 'ACTIVE'
) u on true;

-- 3e. Reservas de hotel para listarlas (pantalla de Reservas).
create view public.hotel_reservations_v with (security_invoker = true) as
select
  ts.tenant_id,
  ts.id as trip_service_id,
  ts.trip_id,
  f.booking_id,
  b.locator as booking_locator,
  b.status as booking_status,
  b.external_refs->>'operationId' as operation_id,
  b.external_refs->>'clientReference' as client_reference,
  ts.details->>'hotelCode' as hotel_code,
  ts.source as service_source,
  t.organization_id as client_organization_id,
  o.name as client_name,
  t.traveler_id,
  pe.full_name as traveler_name,
  h.hotel_name,
  h.check_in_at,
  h.check_out_at,
  h.number_of_rooms,
  h.confirmation_number,
  s.source,
  s.supplier_id,
  s.provider_status,
  s.cancellation_deadline,
  s.supplier_payment_due_at,
  f.currency,
  f.charged,
  f.paid,
  f.outstanding,
  f.next_due_at,
  f.items_gap,
  ts.created_at
from public.trip_services ts
join public.trips t on t.tenant_id = ts.tenant_id and t.id = ts.trip_id
join public.hotel_service_details h on h.tenant_id = ts.tenant_id and h.trip_service_id = ts.id
left join public.organizations o on o.tenant_id = t.tenant_id and o.id = t.organization_id
left join public.persons pe on pe.tenant_id = t.tenant_id and pe.id = t.traveler_id
left join public.hotel_booking_sourcing s on s.tenant_id = ts.tenant_id and s.trip_service_id = ts.id
left join public.booking_financials_v f on f.tenant_id = ts.tenant_id and f.trip_service_id = ts.id
left join public.bookings b on b.tenant_id = f.tenant_id and b.id = f.booking_id
where ts.type = 'HOTEL';

-- 3f. Clientes con crédito (selector de cliente).
create view public.client_credit_v with (security_invoker = true) as
select
  o.tenant_id,
  o.id as organization_id,
  o.name,
  ca.id as credit_account_id,
  ca.currency,
  ca.status as credit_status,
  ca.credit_limit,
  cv.used,
  cv.available
from public.organizations o
join public.credit_accounts ca on ca.tenant_id = o.tenant_id and ca.organization_id = o.id
join public.credit_availability_v cv on cv.tenant_id = ca.tenant_id and cv.credit_account_id = ca.id
where o.kind = 'CLIENT' and o.status = 'ACTIVE';

-- 3g. Personas de cada cliente (selector de titular y huéspedes).
create view public.client_persons_v with (security_invoker = true) as
select
  p.tenant_id,
  p.id as person_id,
  p.full_name,
  p.email,
  p.phone,
  l.organization_id
from public.persons p
join public.person_organization_links l on l.tenant_id = p.tenant_id and l.person_id = p.id;


-- ----------------------------------------------------------------------------
-- 4. RLS: solo lectura heredando la visibilidad del servicio padre. Escritura: solo llave de servicio.
-- ----------------------------------------------------------------------------
alter table public.trip_service_items enable row level security;
alter table public.hotel_booking_sourcing enable row level security;

create policy trip_service_items_read on public.trip_service_items for select to authenticated
  using (exists (
    select 1 from public.trip_services s
    where s.tenant_id = trip_service_items.tenant_id and s.id = trip_service_items.trip_service_id
  ));

create policy hotel_booking_sourcing_read on public.hotel_booking_sourcing for select to authenticated
  using (exists (
    select 1 from public.trip_services s
    where s.tenant_id = hotel_booking_sourcing.tenant_id and s.id = hotel_booking_sourcing.trip_service_id
  ));

grant select on public.trip_service_items, public.hotel_booking_sourcing to authenticated;
grant select on public.charge_balances_v, public.booking_financials_v, public.payment_allocation_check_v,
                public.credit_availability_v, public.hotel_reservations_v,
                public.client_credit_v, public.client_persons_v to authenticated;
