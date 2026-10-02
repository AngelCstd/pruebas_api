-- ============================================================================
-- FUNCIONES DE RESERVA DE HOTEL CON CRÉDITO (Care)
-- BORRADOR. Lo corre el usuario a mano. Probado en una base local con el esquema de Care (sin triggers
-- ni políticas reales): puede haber diferencias en tu base. Las llama el back con la llave de servicio.
--
-- Orden de uso por reserva (lo hace el back):
--   1. hold_hotel_credit_v1        retiene el crédito del cliente (antes de llamar al proveedor)
--   2. (el back llama al proveedor)
--   3. create_hotel_reservation_v1 crea TODO en una sola transacción (o nada)
--   4. release_hotel_credit_v1     si el proveedor falla o el paso 3 falla, libera el crédito
--
-- Ids derivados del operationId (hbo_xxx): reintentar con la misma operación no duplica nada.
-- Los errores esperados se devuelven como { ok:false, errorCode, message }.
-- La excepción de crédito (credit_exceptions) NO se implementa: si no alcanza, se rechaza.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Persona: usa una existente (personId) o crea una nueva (firstName + lastName), y la liga al cliente
-- ----------------------------------------------------------------------------
create or replace function public.resolve_reservation_person_v1(
  p_tenant_id text,
  p_organization_id text,
  p_ref jsonb,
  p_new_person_id text
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id text := nullif(btrim(p_ref->>'personId'), '');
  v_first text := nullif(btrim(p_ref->>'firstName'), '');
  v_last text := nullif(btrim(p_ref->>'lastName'), '');
begin
  if v_id is not null then
    if not exists (select 1 from public.persons where tenant_id = p_tenant_id and id = v_id) then
      raise exception using errcode = 'P0001', message = 'PERSON_NOT_FOUND: ' || v_id;
    end if;
  else
    if v_first is null or v_last is null then
      raise exception using errcode = 'P0001', message = 'PERSON_INCOMPLETE: firstName and lastName are required';
    end if;
    v_id := p_new_person_id;
    insert into public.persons (id, tenant_id, full_name, email, phone)
    values (v_id, p_tenant_id, v_first || ' ' || v_last,
            nullif(btrim(p_ref->>'email'), ''), nullif(btrim(p_ref->>'phone'), ''))
    on conflict (id) do nothing;
  end if;

  insert into public.person_organization_links (id, tenant_id, person_id, organization_id, relationship_type)
  select 'pol_' || substr(md5(v_id || ':' || p_organization_id), 1, 24), p_tenant_id, v_id, p_organization_id, 'TRAVELER'
  where not exists (
    select 1 from public.person_organization_links l
    where l.tenant_id = p_tenant_id and l.person_id = v_id and l.organization_id = p_organization_id
  );
  return v_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- 1. Retener crédito (idempotente por servicio). Bloquea la cuenta para que dos reservas simultáneas
--    no excedan el límite.
-- ----------------------------------------------------------------------------
create or replace function public.hold_hotel_credit_v1(
  p_tenant_id text,
  p_client_organization_id text,
  p_trip_service_id text,
  p_amount numeric,
  p_currency text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account public.credit_accounts%rowtype;
  v_existing public.credit_utilizations%rowtype;
  v_used numeric;
  v_available numeric;
  v_utilization_id text;
  v_has_existing boolean;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'errorCode', 'INVALID_AMOUNT', 'message', 'The amount must be greater than zero.');
  end if;

  select * into v_account from public.credit_accounts
  where tenant_id = p_tenant_id and organization_id = p_client_organization_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'errorCode', 'CREDIT_ACCOUNT_NOT_FOUND', 'message', 'The client has no credit account.');
  end if;
  if v_account.status <> 'ACTIVE' then
    return jsonb_build_object('ok', false, 'errorCode', 'CREDIT_ACCOUNT_NOT_ACTIVE', 'message', 'The credit account is ' || v_account.status || '.');
  end if;
  if v_account.currency <> p_currency then
    return jsonb_build_object('ok', false, 'errorCode', 'CURRENCY_MISMATCH',
      'message', 'The credit account is in ' || v_account.currency || ' and the booking in ' || p_currency || '.');
  end if;

  select * into v_existing from public.credit_utilizations
  where tenant_id = p_tenant_id and credit_account_id = v_account.id
    and source_type = 'TRIP_SERVICE' and source_id = p_trip_service_id;
  v_has_existing := found;   -- FOUND se reinicia con la siguiente consulta: se guarda aquí
  if v_has_existing and v_existing.status = 'ACTIVE' then
    if v_existing.amount <> p_amount then
      return jsonb_build_object('ok', false, 'errorCode', 'HOLD_AMOUNT_CONFLICT', 'message', 'An active hold exists with a different amount.');
    end if;
    return jsonb_build_object('ok', true, 'utilizationId', v_existing.id, 'replay', true);
  end if;

  select coalesce(cv.used, 0) into v_used from public.credit_availability_v cv
  where cv.tenant_id = p_tenant_id and cv.credit_account_id = v_account.id;
  v_available := v_account.credit_limit - coalesce(v_used, 0);
  if p_amount > v_available then
    -- EXCEPCIÓN DE CRÉDITO (diseño, NO implementado): aquí se crearía un credit_exceptions en PENDING con su
    -- approval_request_id y la reserva esperaría aprobación. Por ahora solo se rechaza.
    return jsonb_build_object('ok', false, 'errorCode', 'CREDIT_INSUFFICIENT',
      'message', 'Insufficient credit.', 'available', greatest(v_available, 0), 'requested', p_amount, 'currency', v_account.currency);
  end if;

  if v_has_existing then
    update public.credit_utilizations set status = 'ACTIVE', amount = p_amount, currency = p_currency
    where id = v_existing.id
    returning id into v_utilization_id;
  else
    insert into public.credit_utilizations (id, tenant_id, credit_account_id, source_type, source_id, amount, currency, status)
    values (public.noktos_id('cutl'), p_tenant_id, v_account.id, 'TRIP_SERVICE', p_trip_service_id, p_amount, p_currency, 'ACTIVE')
    returning id into v_utilization_id;
  end if;

  return jsonb_build_object('ok', true, 'utilizationId', v_utilization_id, 'replay', false,
    'available', v_available - p_amount, 'currency', v_account.currency);
end;
$$;


-- ----------------------------------------------------------------------------
-- 2. Liberar crédito (la retención vuelve a estar disponible)
-- ----------------------------------------------------------------------------
create or replace function public.release_hotel_credit_v1(
  p_tenant_id text,
  p_trip_service_id text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_released integer;
begin
  update public.credit_utilizations set status = 'RELEASED'
  where tenant_id = p_tenant_id and source_type = 'TRIP_SERVICE'
    and source_id = p_trip_service_id and status = 'ACTIVE';
  get diagnostics v_released = row_count;
  return jsonb_build_object('ok', true, 'released', v_released);
end;
$$;


-- ----------------------------------------------------------------------------
-- 3. Crear la reserva completa (todo o nada)
--
-- Payload (jsonb, camelCase):
-- { tenantId, operationId, clientOrganizationId, sellerOrganizationId?,
--   source: 'MOCK'|'NEMO'|'CONVENIO'|'MANUAL', providerLabel?,
--   hotel: { code, name, address?, city?, checkIn:'YYYY-MM-DD', checkOut:'YYYY-MM-DD', supplierOrganizationId? },
--   providerBookingRef, supplierConfirmationCode, providerStatus?, clientReference?,
--   amount, currency, cancellationNote?, offerSnapshot?,
--   lead:  { personId } | { firstName, lastName, email?, phone? },
--   rooms: [ { roomSequence, roomType?, guests: [ <persona>... ] } ],
--   items?: [ { kind, description, usageDate?, subtotal, tax?, total } ]   -- si falta: un item SERVICE por el total
-- }
-- ----------------------------------------------------------------------------
create or replace function public.create_hotel_reservation_v1(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tenant text := nullif(btrim(p_payload->>'tenantId'), '');
  v_op text := nullif(btrim(p_payload->>'operationId'), '');
  v_client text := nullif(btrim(p_payload->>'clientOrganizationId'), '');
  v_seller text := nullif(btrim(p_payload->>'sellerOrganizationId'), '');
  v_hotel jsonb := p_payload->'hotel';
  v_hotel_name text := nullif(btrim(v_hotel->>'name'), '');
  v_currency text := p_payload->>'currency';
  v_amount numeric := (p_payload->>'amount')::numeric;
  v_source text := coalesce(nullif(btrim(p_payload->>'source'), ''), 'MOCK');
  v_provider_label text := coalesce(nullif(btrim(p_payload->>'providerLabel'), ''), v_source);
  v_check_in date;
  v_check_out date;
  v_nights integer;
  v_rooms jsonb := p_payload->'rooms';
  v_items jsonb := p_payload->'items';
  v_suffix text;
  v_trip_id text;
  v_service_id text;
  v_booking_id text;
  v_detail_id text;
  v_workspace_id text;
  v_client_account_id text;
  v_billing public.billing_accounts%rowtype;
  v_credit_account_id text;
  v_hold_amount numeric;
  v_lead_id text;
  v_person_map jsonb := '{}'::jsonb;
  v_person_counter integer := 0;
  v_room jsonb;
  v_guest jsonb;
  v_room_idx integer;
  v_guest_idx integer;
  v_person_id text;
  v_key text;
  v_room_people jsonb := '[]'::jsonb;
  v_room_people_ids text[];
  v_participants text[];
  v_participant_map jsonb := '{}'::jsonb;
  v_participant_id text;
  v_item jsonb;
  v_item_idx integer;
  v_item_total numeric := 0;
  v_charge_ids text[] := '{}';
  v_item_ids text[] := '{}';
  v_charge_id text;
  v_due date;
  v_total_guests integer;
  v_room_id text;
  v_msg text;
  v_state text;
begin
  -- Validación de entrada -------------------------------------------------------------------
  if v_tenant is null or v_op is null or v_client is null or v_hotel_name is null
     or v_hotel->>'checkIn' is null or v_hotel->>'checkOut' is null then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYLOAD: tenantId, operationId, clientOrganizationId, hotel.name, hotel.checkIn and hotel.checkOut are required';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYLOAD: amount must be greater than zero';
  end if;
  if v_currency is null or v_currency not in ('MXN', 'USD', 'EUR') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYLOAD: currency must be MXN, USD or EUR';
  end if;
  if v_source not in ('MOCK', 'NEMO', 'CONVENIO', 'MANUAL') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYLOAD: unknown source';
  end if;
  v_check_in := (v_hotel->>'checkIn')::date;
  v_check_out := (v_hotel->>'checkOut')::date;
  if v_check_out <= v_check_in then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYLOAD: checkOut must be after checkIn';
  end if;
  if v_rooms is null or jsonb_typeof(v_rooms) <> 'array' or jsonb_array_length(v_rooms) = 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYLOAD: at least one room is required';
  end if;
  if p_payload->'lead' is null or jsonb_typeof(p_payload->'lead') <> 'object' then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYLOAD: lead is required';
  end if;
  v_nights := v_check_out - v_check_in;

  -- Ids derivados de la operación (reintentar no duplica) ----------------------------------------
  v_suffix := substr(v_op, position('_' in v_op) + 1);
  v_trip_id := 'trp_' || v_suffix;
  v_service_id := 'svc_' || v_suffix;
  v_booking_id := 'bkg_' || v_suffix;
  v_detail_id := 'hot_' || v_suffix;

  if exists (select 1 from public.trips where tenant_id = v_tenant and id = v_trip_id) then
    return jsonb_build_object(
      'ok', true, 'replay', true,
      'tripId', v_trip_id, 'serviceId', v_service_id, 'bookingId', v_booking_id, 'hotelDetailId', v_detail_id,
      'chargeIds', (select coalesce(to_jsonb(array_agg(c.id order by c.id)), '[]'::jsonb)
                    from public.commercial_charges c
                    where c.tenant_id = v_tenant and c.source_type = 'TRIP_SERVICE' and c.source_id = v_service_id),
      'itemIds', (select coalesce(to_jsonb(array_agg(i.id order by i.id)), '[]'::jsonb)
                  from public.trip_service_items i
                  where i.tenant_id = v_tenant and i.trip_service_id = v_service_id),
      'personIds', (select coalesce(to_jsonb(array_agg(p.person_id order by p.id)), '[]'::jsonb)
                    from public.trip_participants p
                    where p.tenant_id = v_tenant and p.trip_id = v_trip_id),
      'dueAt', (select min(c.due_at) from public.commercial_charges c
                where c.tenant_id = v_tenant and c.source_type = 'TRIP_SERVICE' and c.source_id = v_service_id),
      'currency', (select h.currency from public.hotel_service_details h
                   where h.tenant_id = v_tenant and h.trip_service_id = v_service_id),
      'amount', (select h.total_amount from public.hotel_service_details h
                 where h.tenant_id = v_tenant and h.trip_service_id = v_service_id));
  end if;

  -- Cliente, vendedor, workspace, cuentas -----------------------------------------------------------
  if not exists (select 1 from public.organizations where tenant_id = v_tenant and id = v_client and kind = 'CLIENT') then
    raise exception using errcode = 'P0001', message = 'CLIENT_NOT_FOUND: ' || v_client;
  end if;

  if v_seller is null then
    if (select count(*) from public.organizations where tenant_id = v_tenant and kind = 'AGENCY' and status = 'ACTIVE') <> 1 then
      raise exception using errcode = 'P0001',
        message = 'SELLER_NOT_RESOLVED: exactly one active AGENCY organization is required, or send sellerOrganizationId';
    end if;
    select id into v_seller from public.organizations
    where tenant_id = v_tenant and kind = 'AGENCY' and status = 'ACTIVE';
  elsif not exists (select 1 from public.organizations where tenant_id = v_tenant and id = v_seller) then
    raise exception using errcode = 'P0001', message = 'SELLER_NOT_FOUND: ' || v_seller;
  end if;

  select id into v_workspace_id from public.workspaces
  where tenant_id = v_tenant and organization_id = v_client and workspace_type = 'CORPORATE' and status = 'ACTIVE'
  order by created_at limit 1;
  if v_workspace_id is null then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_NOT_FOUND: the client has no active corporate workspace';
  end if;

  select id into v_client_account_id from public.client_accounts
  where tenant_id = v_tenant and organization_id = v_client;
  if v_client_account_id is null then
    raise exception using errcode = 'P0001', message = 'CLIENT_ACCOUNT_NOT_FOUND';
  end if;

  select * into v_billing from public.billing_accounts
  where tenant_id = v_tenant and organization_id = v_client and status = 'ACTIVE';
  if not found then
    raise exception using errcode = 'P0001', message = 'BILLING_ACCOUNT_NOT_FOUND: the client has no active billing account';
  end if;
  if v_billing.currency <> v_currency then
    raise exception using errcode = 'P0001', message = 'CURRENCY_MISMATCH: billing account is ' || v_billing.currency;
  end if;

  -- El crédito debe estar retenido (paso 1) por el mismo monto ---------------------------------------
  select cu.credit_account_id, cu.amount into v_credit_account_id, v_hold_amount
  from public.credit_utilizations cu
  where cu.tenant_id = v_tenant and cu.source_type = 'TRIP_SERVICE' and cu.source_id = v_service_id and cu.status = 'ACTIVE';
  if v_credit_account_id is null then
    raise exception using errcode = 'P0001', message = 'CREDIT_NOT_HELD: hold the credit before creating the reservation';
  end if;
  if v_hold_amount <> v_amount then
    raise exception using errcode = 'P0001', message = 'HOLD_AMOUNT_CONFLICT: held ' || v_hold_amount || ' but the amount is ' || v_amount;
  end if;

  -- Items (por defecto, uno solo por el total) -----------------------------------------------------------
  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    v_items := jsonb_build_array(jsonb_build_object(
      'kind', 'SERVICE', 'description', v_hotel_name, 'subtotal', v_amount, 'tax', 0, 'total', v_amount));
  end if;
  select coalesce(sum((i->>'total')::numeric), 0) into v_item_total from jsonb_array_elements(v_items) i;
  if round(v_item_total, 2) <> round(v_amount, 2) then
    raise exception using errcode = 'P0001', message = 'ITEMS_MISMATCH: items add up to ' || v_item_total || ' but the amount is ' || v_amount;
  end if;

  -- Personas: titular y huéspedes (existentes o nuevas) -----------------------------------------------------
  v_lead_id := public.resolve_reservation_person_v1(v_tenant, v_client, p_payload->'lead', 'per_' || v_suffix || '_0');
  if p_payload->'lead'->>'personId' is null then
    v_person_map := v_person_map || jsonb_build_object(
      lower(btrim(p_payload->'lead'->>'firstName')) || '|' || lower(btrim(p_payload->'lead'->>'lastName')), v_lead_id);
  end if;
  v_participants := array[v_lead_id];

  v_room_idx := 0;
  for v_room in select value from jsonb_array_elements(v_rooms) loop
    v_room_idx := v_room_idx + 1;
    if v_room->'guests' is null or jsonb_typeof(v_room->'guests') <> 'array' or jsonb_array_length(v_room->'guests') = 0 then
      raise exception using errcode = 'P0001', message = 'INVALID_PAYLOAD: every room needs at least one guest';
    end if;
    v_room_people_ids := '{}';
    for v_guest in select value from jsonb_array_elements(v_room->'guests') loop
      if v_guest->>'personId' is not null then
        v_person_id := public.resolve_reservation_person_v1(v_tenant, v_client, v_guest, null);
      else
        v_key := lower(btrim(coalesce(v_guest->>'firstName', ''))) || '|' || lower(btrim(coalesce(v_guest->>'lastName', '')));
        if v_person_map ? v_key then
          v_person_id := v_person_map->>v_key;
        else
          v_person_counter := v_person_counter + 1;
          v_person_id := public.resolve_reservation_person_v1(v_tenant, v_client, v_guest, 'per_' || v_suffix || '_' || v_person_counter);
          v_person_map := v_person_map || jsonb_build_object(v_key, v_person_id);
        end if;
      end if;
      v_room_people_ids := v_room_people_ids || v_person_id;
      if not (v_person_id = any (v_participants)) then
        v_participants := v_participants || v_person_id;
      end if;
    end loop;
    v_room_people := v_room_people || jsonb_build_array(to_jsonb(v_room_people_ids));
  end loop;

  -- Viaje, participantes, servicio ---------------------------------------------------------------------------
  insert into public.trips (
    id, tenant_id, organization_id, traveler_id, owner_person_id, workspace_id, client_account_id,
    title, origin, destination, starts_at, ends_at, status, source, care_status, operability_status,
    missing_operational_context
  ) values (
    v_trip_id, v_tenant, v_client, v_lead_id, v_lead_id, v_workspace_id, v_client_account_id,
    v_hotel_name || ' · ' || to_char(v_check_in, 'DD/MM/YYYY') || ' – ' || to_char(v_check_out, 'DD/MM/YYYY'),
    null, nullif(btrim(v_hotel->>'city'), ''),
    (v_check_in::text || 'T00:00:00Z')::timestamptz, (v_check_out::text || 'T00:00:00Z')::timestamptz,
    'UPCOMING', 'NOKTOS', 'CLEAR', 'CARE_READY', '[]'::jsonb
  );

  for v_room_idx in 1 .. cardinality(v_participants) loop
    v_participant_id := 'tpt_' || v_suffix || '_' || v_room_idx;
    insert into public.trip_participants (id, tenant_id, trip_id, person_id, role, status, traveler_type, is_primary, is_contact, metadata)
    values (v_participant_id, v_tenant, v_trip_id, v_participants[v_room_idx], 'TRAVELER', 'CONFIRMED', 'OTHER',
            v_room_idx = 1, v_room_idx = 1, jsonb_build_object('source', 'HOTEL_RESERVATION_V1'));
    v_participant_map := v_participant_map || jsonb_build_object(v_participants[v_room_idx], v_participant_id);
  end loop;

  insert into public.trip_services (
    id, tenant_id, trip_id, workspace_id, client_account_id, type, title, provider, supplier_org_id,
    starts_at, ends_at, status, source, details, provenance, care_status
  ) values (
    v_service_id, v_tenant, v_trip_id, v_workspace_id, v_client_account_id, 'HOTEL', v_hotel_name, v_provider_label,
    nullif(btrim(v_hotel->>'supplierOrganizationId'), ''),
    (v_check_in::text || 'T00:00:00Z')::timestamptz, (v_check_out::text || 'T00:00:00Z')::timestamptz,
    'CONFIRMED', 'NOKTOS_HOTEL_' || v_source,
    jsonb_build_object('hotelCode', v_hotel->>'code', 'clientReference', p_payload->>'clientReference'),
    jsonb_build_object('operationId', v_op, 'source', v_source),
    'CLEAR'
  );

  for v_room_idx in 1 .. cardinality(v_participants) loop
    insert into public.trip_service_participants (id, tenant_id, trip_id, trip_service_id, trip_participant_id, status)
    values ('tsp_' || v_suffix || '_' || v_room_idx, v_tenant, v_trip_id, v_service_id,
            v_participant_map->>(v_participants[v_room_idx]), 'CONFIRMED');
  end loop;

  -- Reserva ------------------------------------------------------------------------------------------------------
  insert into public.bookings (id, tenant_id, trip_id, locator, status, source, external_refs)
  values (v_booking_id, v_tenant, v_trip_id, p_payload->>'providerBookingRef', 'CONFIRMED', 'NOKTOS_HOTEL_' || v_source,
          jsonb_build_object('supplierConfirmationCode', p_payload->>'supplierConfirmationCode',
                             'clientReference', p_payload->>'clientReference', 'operationId', v_op));
  insert into public.booking_service_links (id, tenant_id, trip_id, booking_id, trip_service_id)
  values ('bsl_' || v_suffix, v_tenant, v_trip_id, v_booking_id, v_service_id);

  -- Detalle del hotel, cuartos y huéspedes --------------------------------------------------------------------------
  insert into public.hotel_service_details (
    id, tenant_id, trip_id, trip_service_id, hotel_name, address, check_in_at, check_out_at, number_of_rooms,
    rate, taxes, total_amount, currency, confirmation_number, payment_status, payment_method_reference,
    cancellation_policy_reference
  ) values (
    v_detail_id, v_tenant, v_trip_id, v_service_id, v_hotel_name, nullif(btrim(v_hotel->>'address'), ''),
    (v_check_in::text || 'T00:00:00Z')::timestamptz, (v_check_out::text || 'T00:00:00Z')::timestamptz,
    jsonb_array_length(v_rooms),
    round(v_amount / greatest(v_nights * jsonb_array_length(v_rooms), 1), 2), null, v_amount, v_currency,
    coalesce(p_payload->>'supplierConfirmationCode', p_payload->>'providerBookingRef'), 'PENDING', v_credit_account_id,
    nullif(btrim(p_payload->>'cancellationNote'), '')
  );

  v_room_idx := 0;
  for v_room in select value from jsonb_array_elements(v_rooms) loop
    v_room_idx := v_room_idx + 1;
    v_room_id := 'rom_' || v_suffix || '_' || v_room_idx;
    v_room_people_ids := array(select jsonb_array_elements_text(v_room_people->(v_room_idx - 1)));
    insert into public.hotel_rooms (id, tenant_id, hotel_service_detail_id, room_type, rate, currency, occupancy, confirmation, status)
    values (v_room_id, v_tenant, v_detail_id, coalesce(nullif(btrim(v_room->>'roomType'), ''), 'STANDARD'),
            round(v_amount / greatest(v_nights * jsonb_array_length(v_rooms), 1), 2), v_currency,
            cardinality(v_room_people_ids), p_payload->>'supplierConfirmationCode', 'CONFIRMED');
    v_guest_idx := 0;
    foreach v_person_id in array v_room_people_ids loop
      v_guest_idx := v_guest_idx + 1;
      insert into public.hotel_room_guests (id, tenant_id, hotel_room_id, trip_participant_id)
      select 'hrg_' || v_suffix || '_' || v_room_idx || '_' || v_guest_idx, v_tenant, v_room_id, v_participant_map->>v_person_id
      where not exists (
        select 1 from public.hotel_room_guests g
        where g.tenant_id = v_tenant and g.hotel_room_id = v_room_id and g.trip_participant_id = v_participant_map->>v_person_id
      );
    end loop;
  end loop;

  -- Cargos e items: un cargo por item --------------------------------------------------------------------------------------
  v_due := current_date + v_billing.payment_terms_days;
  v_item_idx := 0;
  for v_item in select value from jsonb_array_elements(v_items) loop
    v_item_idx := v_item_idx + 1;
    v_charge_id := 'chg_' || v_suffix || '_' || v_item_idx;
    insert into public.commercial_charges (
      id, tenant_id, billing_account_id, source_type, source_id, source_label, payer_organization_id,
      payee_organization_id, amount, currency, status, issued_at, due_at, reference, finalized
    ) values (
      v_charge_id, v_tenant, v_billing.id, 'TRIP_SERVICE', v_service_id,
      left(v_hotel_name || ' · ' || coalesce(v_item->>'description', 'Hotel'), 200), v_client, v_seller,
      (v_item->>'total')::numeric, v_currency, 'OPEN', current_date, v_due,
      'NK-HTL-' || upper(v_suffix) || '-' || v_item_idx, false
    );
    insert into public.trip_service_items (
      id, tenant_id, trip_service_id, charge_id, kind, description, usage_date, currency, subtotal, tax, total
    ) values (
      'tsi_' || v_suffix || '_' || v_item_idx, v_tenant, v_service_id, v_charge_id,
      coalesce(nullif(btrim(v_item->>'kind'), ''), 'SERVICE'), coalesce(v_item->>'description', v_hotel_name),
      nullif(v_item->>'usageDate', '')::date, v_currency,
      coalesce((v_item->>'subtotal')::numeric, (v_item->>'total')::numeric), coalesce((v_item->>'tax')::numeric, 0),
      (v_item->>'total')::numeric
    );
    v_charge_ids := v_charge_ids || v_charge_id;
    v_item_ids := v_item_ids || ('tsi_' || v_suffix || '_' || v_item_idx);
  end loop;

  -- Origen del proveedor ----------------------------------------------------------------------------------------------------
  insert into public.hotel_booking_sourcing (
    id, tenant_id, trip_service_id, source, supplier_id, provider_booking_ref, supplier_confirmation_code,
    provider_status, offer_snapshot, currency, sale_amount
  ) values (
    'hbs_' || v_suffix, v_tenant, v_service_id, v_source,
    (select s.id from public.suppliers s where s.tenant_id = v_tenant and s.organization_id = nullif(btrim(v_hotel->>'supplierOrganizationId'), '')),
    p_payload->>'providerBookingRef', p_payload->>'supplierConfirmationCode', p_payload->>'providerStatus',
    coalesce(p_payload->'offerSnapshot', '{}'::jsonb), v_currency, v_amount
  );

  return jsonb_build_object(
    'ok', true, 'replay', false,
    'tripId', v_trip_id, 'serviceId', v_service_id, 'bookingId', v_booking_id, 'hotelDetailId', v_detail_id,
    'chargeIds', to_jsonb(v_charge_ids), 'itemIds', to_jsonb(v_item_ids),
    'personIds', to_jsonb(v_participants), 'dueAt', v_due, 'currency', v_currency, 'amount', v_amount);
exception
  when others then
    get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
    return jsonb_build_object(
      'ok', false,
      'errorCode', case when v_msg ~ '^[A-Z_]+:' then split_part(v_msg, ':', 1) else 'DB_ERROR_' || v_state end,
      'message', v_msg);
end;
$$;


-- ----------------------------------------------------------------------------
-- Permisos: solo el back (llave de servicio) las ejecuta.
-- ----------------------------------------------------------------------------
revoke all on function public.resolve_reservation_person_v1(text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.hold_hotel_credit_v1(text, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.release_hotel_credit_v1(text, text) from public, anon, authenticated;
revoke all on function public.create_hotel_reservation_v1(jsonb) from public, anon, authenticated;
grant execute on function public.resolve_reservation_person_v1(text, text, jsonb, text) to service_role;
grant execute on function public.hold_hotel_credit_v1(text, text, text, numeric, text) to service_role;
grant execute on function public.release_hotel_credit_v1(text, text) to service_role;
grant execute on function public.create_hotel_reservation_v1(jsonb) to service_role;
