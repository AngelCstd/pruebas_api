-- ============================================================================
-- PRUEBA DE HUMO EN TU BASE (no guarda NADA)
-- Corre DESPUÉS de 02, 03 y 04. Verifica que las funciones de reserva funcionan contra TU base real
-- (por si tiene triggers o restricciones que el esquema de referencia no tiene).
--
-- Es un SOLO bloque que hace una reserva de prueba y al final lanza un error a propósito: eso revierte
-- todo automáticamente. ESE ERROR ES LA SALIDA ESPERADA: el editor mostrará algo como
--     ERROR: SMOKE_TEST_RESULT {"ok": true, "reserva": {...}, "credito": {...}, ...}
-- Cópialo completo. Lo importante:
--   "respuesta_crear": {"ok": true ...}  → todo bien.
--   "ok": false, o "reserva": null       → ahí viene el motivo exacto.
-- Si el error es OTRO (no empieza con SMOKE_TEST_RESULT), también cópialo: es el problema real.
-- ============================================================================

do $$
declare
  v_hold jsonb;
  v_create jsonb;
  v_result jsonb;
begin
  v_hold := public.hold_hotel_credit_v1('tnt_stg_personal', 'org_demo_cliente', 'svc_prueba01', 6000, 'MXN');

  v_create := public.create_hotel_reservation_v1(jsonb_build_object(
    'tenantId', 'tnt_stg_personal',
    'operationId', 'hbo_prueba01',
    'clientOrganizationId', 'org_demo_cliente',
    'source', 'MOCK',
    'providerLabel', 'Mock provider',
    'hotel', jsonb_build_object('code', 'MOCK-3703-001', 'name', 'Hotel de Prueba', 'address', 'Calle 1, Cancún',
                                'city', 'Cancún', 'checkIn', '2026-11-10', 'checkOut', '2026-11-13'),
    'providerBookingRef', 'MOCK_BOOK_PRUEBA01',
    'supplierConfirmationCode', 'MOCK_CONF_PRUEBA01',
    'providerStatus', 'Confirmed',
    'clientReference', 'PRUEBA-1',
    'amount', 6000,
    'currency', 'MXN',
    'lead', jsonb_build_object('firstName', 'Prueba', 'lastName', 'Titular', 'email', 'prueba@example.com'),
    'rooms', jsonb_build_array(
      jsonb_build_object('roomSequence', 1, 'roomType', 'NMO.HTL.RMT.DBL', 'guests', jsonb_build_array(
        jsonb_build_object('firstName', 'Prueba', 'lastName', 'Titular'),
        jsonb_build_object('personId', 'per_demo_ana')))
    )
  ));

  v_result := jsonb_build_object(
    'respuesta_retener', v_hold,
    'respuesta_crear',   v_create,
    'reserva',           (select to_jsonb(v) from public.hotel_reservations_v v where v.trip_service_id = 'svc_prueba01'),
    'credito',           (select to_jsonb(c) from public.client_credit_v c where c.organization_id = 'org_demo_cliente'),
    'cargos',            (select count(*) from public.commercial_charges where source_id = 'svc_prueba01'),
    'items',             (select count(*) from public.trip_service_items where trip_service_id = 'svc_prueba01'),
    'participantes',     (select count(*) from public.trip_participants where trip_id = 'trp_prueba01')
  );

  -- Error a propósito: revierte TODO lo anterior y muestra el resultado.
  raise exception 'SMOKE_TEST_RESULT %', v_result::text using errcode = 'P0001';
end;
$$;
