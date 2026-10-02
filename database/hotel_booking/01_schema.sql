-- BORRADOR, lo corre el usuario a mano

create table public.hotel_booking_operations (
  id text primary key default public.noktos_id('hbo'),
  tenant_id text not null references public.tenants(id),
  provider text not null check (provider in ('mock','nemo','convenio')),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('PENDING','BOOKED','CANCELLED','FAILED')),
  booking_locator text,
  supplier_confirmation_code text,
  client_reference text not null,
  hotel_code text,
  hotel_name text,
  check_in date,
  check_out date,
  total_amount numeric(18,2),
  currency text,
  lead_passenger_name text not null,
  request_payload jsonb not null,
  response_payload jsonb,
  cancellation_payload jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (tenant_id, provider, idempotency_key)
);
create unique index hotel_booking_operations_locator_uq
  on public.hotel_booking_operations (tenant_id, provider, booking_locator)
  where booking_locator is not null;
alter table public.hotel_booking_operations enable row level security;  -- sin políticas: solo llave de servicio
