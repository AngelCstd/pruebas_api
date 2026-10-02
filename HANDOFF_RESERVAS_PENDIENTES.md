# Handoff — Reservas de hotel (actualizado 2026-10-02)

## Estado actual

La reserva `provider=mock` con crédito en Care quedó implementada conforme a `CONTRATO_RESERVAS_V1_2.md`:

- El back lista clientes desde `client_credit_v` y personas desde `client_persons_v` mediante `GET /clients` y `GET /persons`.
- `BookHotelDto` exige `clientOrganizationId` y acepta personas existentes (`personId`) o nuevas.
- La aplicación reclama la idempotencia, valida la tarifa, resuelve al titular, retiene crédito, reserva en el mock, crea la reserva completa en Care y cierra la operación.
- Si falla el proveedor o la creación en Care después de retener, se intenta liberar el crédito y la operación queda `FAILED`.
- `response_payload` contiene el resultado del proveedor y `reservation` con los ids de Care; un replay no repite efectos.
- `GET /hotels/bookings` lee `hotel_reservations_v`. El detalle y la cancelación conservan `hotel_booking_operations`.
- Todas las tarifas mock son MXN, incluida `MOCK-PRICE-002`, sin escalar importes.
- `npm test`: 43 pruebas en verde al cerrar esta fase.

## Infraestructura

El acceso a Care está detrás de `ICareReservationRepository`:

- Producción/local configurado: `SupabaseCareReservationRepository`, con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- Pruebas: `InMemoryCareReservationRepository`.
- Las lecturas y RPCs reciben el tenant de la petición; las lecturas filtran siempre por `tenant_id`, y las personas también por `organization_id`.

No se ejecutó SQL ni se probó contra una base real. Los archivos de `database/` no se modificaron.

## Pendientes deliberados

1. **Cancelación en Care:** `POST /hotels/bookings/:locator/cancel` sólo cancela el mock y actualiza la operación. Todavía no cambia bookings/servicios/cargos de Care ni libera crédito.
2. **Convenio y Nemo:** continúan sin reserva (`501 BOOKING_NOT_ENABLED`); `provider=all` continúa en `400` para reservar.
3. **Proveedor confirmado pero Care rechazado:** el mock ya conserva esa reserva en memoria. No existe compensación/cancelación del proveedor en esta versión.
4. **Base real:** el usuario debe aplicar y verificar manualmente los SQL de `database/hotel_booking/` en el entorno correspondiente.
5. **Fuera de alcance:** excepciones de crédito, facturas, pagos, items por noche, autenticación, API key e interruptor de activación.

## Siguiente trabajo recomendado

Implementar la cancelación transaccional en Care y definir qué ocurre con cargos, utilización de crédito y estado del viaje/servicio. Ese cambio necesita un contrato y funciones SQL nuevas; no debe inferirse desde el flujo actual.
