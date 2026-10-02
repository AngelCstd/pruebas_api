# Contrato de reservas — v1.2: reserva con crédito en Care (2026-10-02)

Extiende `CONTRATO_RESERVAS_V1.md` (v1 + v1.1). **Lo que no se menciona aquí no cambia.** Donde haya conflicto, manda este documento.

Trabajos en paralelo (no deben depender entre sí):

| Trabajo | Dónde | Qué toca |
|---|---|---|
| **BACK** | `pruebas_api/` | Listar clientes y personas, orquestar la reserva con las funciones de base de datos, listar reservas desde las tablas de Care, mock en MXN. |
| **FRONT** | `noktos-care-foundation/app/reservas/` y `tests/reservas-*.test.ts` | Selector de cliente, selector de personas, errores de crédito, lista con más columnas. |
| (ya hecho) CLIENTE | `noktos-care-foundation/src/integrations/nemu-hotels/` | Tipos y métodos nuevos ya agregados por el coordinador; el FRONT **no** los modifica. |

## 1. Idea general

Al confirmar una reserva con `mock`, el back: (1) valida la tarifa y **retiene el crédito** del cliente, (2) reserva con el proveedor (mock), (3) crea **toda la reserva en las tablas de Care en una sola transacción** (viaje, servicio, reserva, hotel, items, cargo, personas). Si algo falla después de retener, **libera el crédito**. Quien cobra es la agencia vendedora; quien paga es el cliente.

La base de datos ya tiene las funciones (probadas en una base local): ver `database/hotel_booking/04_reservation_functions.sql`, que documenta el payload exacto de `create_hotel_reservation_v1`. El back las llama con la llave de servicio por RPC (`supabase.rpc(nombre, argumentos)`).

## 2. Endpoints nuevos (GET, el tenant va en la query, ver 0.1 de v1.1)

### `GET /clients?tenantId=…`
`200 { items: ClientCredit[] }`. Lee la vista `public.client_credit_v` filtrando por `tenant_id`. Orden: nombre.
```ts
ClientCredit = {
  organizationId: string; name: string; creditAccountId: string; currency: 'MXN'|'USD'|'EUR';
  creditStatus: 'ACTIVE'|'HOLD'|'SUSPENDED'; creditLimit: number; used: number; available: number;
}
```
Columnas de la vista: `organization_id, name, credit_account_id, currency, credit_status, credit_limit, used, available` (numéricos pueden llegar como texto: convertir a número).

### `GET /persons?tenantId=…&organizationId=…&q=…&limit=…`
`200 { items: PersonSummary[] }`. Lee `public.client_persons_v` filtrando por `tenant_id` **y** `organization_id` (ambos obligatorios; sin `organizationId` → `400 organizationId is required`). `q` (opcional): coincide sin distinguir mayúsculas con `full_name` o `email`. `limit` 1–50, por defecto 20. Orden: `full_name`.
```ts
PersonSummary = { personId: string; fullName: string; email: string | null; phone: string | null; organizationId: string }
```
Columnas: `person_id, full_name, email, phone, organization_id`.

## 3. `POST /hotels/book?provider=mock` (cambios)

Campos nuevos / modificados del cuerpo (todo lo demás igual: `tenantId`, `tripProductId`, `clientReference`, `rooms[].roomSequence`, `rooms[].specialRequests`…):

- **`clientOrganizationId`**: texto, **obligatorio**. Es el cliente que paga.
- **`leadPassenger`**: una de dos formas:
  - persona existente: `{ "personId": "per_…" }` (sin más campos);
  - persona nueva: la forma actual (`title, firstName, lastName, email, phone`).
- **`rooms[].guests[]`**: cada huésped, una de dos formas:
  - existente: `{ "personId": "per_…", "type"?: "ADT"|"CHD"|"INF", "age"?: number }` (`type` por defecto `ADT`);
  - nuevo: la forma actual (`title, firstName, lastName, type, age?`).
  - Un objeto con `personId` **no** debe traer campos de nombre.

### Orquestación (en orden)
1. **Claim de idempotencia** (ya existe). Un reintento con la misma clave y contenido devuelve la respuesta guardada **sin** volver a retener ni reservar (`idempotentReplay: true`).
2. **Ids**: `serviceId = 'svc_' + <operationId sin su prefijo 'hbo_'>` (la parte después del primer `_`). Las funciones SQL derivan lo mismo.
3. **Validar tarifa**: `validateRate` de la estrategia mock → monto y moneda. Si `priceChanged` es `true` → `409` con `code: 'PRICE_CHANGED'`.
4. **Nombre del titular**: si `leadPassenger` es existente, obtener `full_name` de `client_persons_v` (tenant + organizationId + personId); si no existe → `404` con `code: 'PERSON_NOT_FOUND'`. `leadPassengerName` de la operación = nombre completo.
5. **Retener crédito**: RPC `hold_hotel_credit_v1(p_tenant_id, p_client_organization_id, p_trip_service_id, p_amount, p_currency)`. Devuelve `{ ok, errorCode?, message?, available?, requested?, currency? }`. Si `ok:false`: operación → `FAILED` con ese `errorCode` y responder `409` con cuerpo `{ statusCode: 409, error: 'Conflict', message, code: errorCode, available?, requested?, currency? }`. Códigos: `CREDIT_INSUFFICIENT`, `CURRENCY_MISMATCH`, `CREDIT_ACCOUNT_NOT_FOUND`, `CREDIT_ACCOUNT_NOT_ACTIVE`, `INVALID_AMOUNT`, `HOLD_AMOUNT_CONFLICT`.
6. **Reservar con el proveedor** (mock). Si lanza error: RPC `release_hotel_credit_v1(p_tenant_id, p_trip_service_id)`, operación → `FAILED`, relanzar el error original.
7. **Crear la reserva**: RPC `create_hotel_reservation_v1(p_payload jsonb)` con un solo argumento `p_payload` (objeto JSON; claves exactas en el comentario de cabecera de la sección 3 del archivo SQL). Valores: `tenantId`, `operationId` (= id de la operación), `clientOrganizationId`, `source: 'MOCK'`, `providerLabel: 'Mock provider'`, `hotel { code, name, checkIn, checkOut }` (del resultado del proveedor; `address` y `city` solo si se conocen), `providerBookingRef` = `bookingLocator`, `supplierConfirmationCode`, `providerStatus` = `bookingStatus`, `clientReference`, `amount` y `currency` = `totalPrice`, `lead` y `rooms[].guests[]` (`{personId}` o `{firstName,lastName,email?,phone?}`), `rooms[].roomSequence`, `offerSnapshot { tripProductId }`. **No** enviar `items` (la función crea un solo item `SERVICE` por el total).
   - Respuesta `{ ok:true, tripId, serviceId, bookingId, hotelDetailId, chargeIds, itemIds, personIds, dueAt, currency, amount, replay }`.
   - Si `ok:false`: RPC `release_hotel_credit_v1`, operación → `FAILED` con `errorCode`, y responder: `PERSON_NOT_FOUND` → `404`; `INVALID_PAYLOAD` / `PERSON_INCOMPLETE` → `400`; resto → `409`; en todos el cuerpo lleva `code` = errorCode y `message`.
   - Aunque falle este paso, el proveedor mock ya reservó en memoria (limitación conocida del mock, sin impacto en Care).
8. **Cerrar**: marcar la operación `BOOKED` guardando el resultado **más** los ids de Care en `response_payload`.

### Respuesta `201`
Igual que hoy (`BookingResult` + `operationId` + `idempotentReplay`) **más**:
```ts
reservation: { tripId: string; serviceId: string; bookingId: string; hotelDetailId: string;
               chargeIds: string[]; itemIds: string[]; dueAt: string }   // dueAt: YYYY-MM-DD
```
En un replay se devuelve el mismo `reservation` guardado.

### Cancelar
`POST /hotels/bookings/:locator/cancel` no cambia: cancela solo el mock y la operación; **todavía no** actualiza las tablas de Care ni libera crédito (pendiente, fuera de este alcance). Debe quedar anotado en `API_CONTRACT.md`.

## 4. `GET /hotels/bookings` (cambio: ahora lee las tablas de Care)

Lee `public.hotel_reservations_v` filtrando por `tenant_id` (obligatorio, v1.1), ordenado por `created_at` desc, con `limit` y `status` como hoy. Cada fila → `BookingSummary`:

| Campo | Origen |
|---|---|
| `operationId` | `operation_id` (si es null, `trip_service_id`) |
| `provider` | `source` en minúsculas (`mock`) |
| `status` | `booking_status = 'CANCELLED'` → `CANCELLED`; cualquier otro → `BOOKED` |
| `bookingLocator` | `booking_locator` |
| `supplierConfirmationCode` | `confirmation_number` |
| `clientReference` | `client_reference` (o `''`) |
| `hotelCode`, `hotelName` | `hotel_code`, `hotel_name` |
| `checkIn`, `checkOut` | fecha `YYYY-MM-DD` de `check_in_at`, `check_out_at` |
| `totalPrice` | `{ amount: charged, currency }` (null si `charged` es null) |
| `leadPassengerName` | `traveler_name` (o `''`) |
| `createdAt` | `created_at` (ISO) |
| `cancelledAt` | siempre `null` por ahora |
| **nuevos** `clientName` | `client_name` (string \| null) |
| **nuevos** `tripId` | `trip_id` |
| **nuevos** `outstanding` | `outstanding` (número \| null): pendiente de pago |
| **nuevos** `dueAt` | `next_due_at` (`YYYY-MM-DD` \| null) |

Filtro `status=FAILED` → lista vacía (las operaciones fallidas no están en Care). La tabla `hotel_booking_operations` sigue existiendo para la idempotencia y para el detalle (`GET /hotels/bookings/:locator`), no para la lista.

## 5. Mock en MXN

`MockHotelStrategy` cotiza **siempre en MXN** (incluida la tarifa fija `MOCK-PRICE-002`). Los montos no se escalan. Ajustar las pruebas existentes que esperaban otra moneda.

## 6. Errores de la pantalla (para el FRONT)

Todos llegan como `NemuApiError` con `status`, `message`, `code` y **`details`** (el cuerpo completo del error, p. ej. `available`, `requested`, `currency`).

| `code` | Mensaje para el usuario |
|---|---|
| `CREDIT_INSUFFICIENT` | `Crédito insuficiente: disponible {available} {currency}, se requieren {requested}.` (formato de moneda) |
| `CURRENCY_MISMATCH` | `La moneda de la tarifa no coincide con la del crédito del cliente.` |
| `CREDIT_ACCOUNT_NOT_FOUND` / `CREDIT_ACCOUNT_NOT_ACTIVE` | `El cliente no tiene una cuenta de crédito activa.` |
| `PRICE_CHANGED` | `El precio cambió. Repite la búsqueda.` |
| `PERSON_NOT_FOUND` | `Una de las personas seleccionadas ya no existe. Vuelve a elegirla.` |
| `CLIENT_NOT_FOUND`, `WORKSPACE_NOT_FOUND`, `BILLING_ACCOUNT_NOT_FOUND`, `SELLER_NOT_RESOLVED` | `El cliente no está listo para reservar (falta configuración). Avisa a un administrador.` |
| (los de v1: `IDEMPOTENCY_*`, 410, 404…) | como ya están |

## 7. Pantalla (FRONT)

- **Cliente**: en el paso 1 del modal, un `select` **obligatorio** con `listClients()`: `"{name} · disponible {available} {currency}"`; deshabilitar las opciones con `creditStatus !== 'ACTIVE'`. Si hay un solo cliente activo, preseleccionarlo. Sin cliente elegido no se puede continuar a Huéspedes.
- **Personas** (titular y cada huésped): conmutador `Existente | Nueva`.
  - Existente: buscador (combobox) con `listPersons({ organizationId, q })`; muestra nombre y correo; al elegir se guarda el `personId`. Mostrar los primeros 20 al abrir. No permitir la misma persona dos veces en un mismo cuarto.
  - Nueva: el formulario actual.
  - El titular y los huéspedes se arman en `BookHotelRequest` según los tipos de `types.ts` (`LeadPassengerInput`, `BookingGuestInput`).
- **Confirmación**: mostrar el cliente y su crédito disponible, y el monto a cargar. Tras reservar, volver a pedir `listClients()` para mostrar el crédito restante.
- **Lista de reservas**: columnas nuevas **Cliente**, **Pendiente de pago** (`outstanding` con moneda) y **Vence** (`dueAt`). Mantener las demás.
- Textos en español; reglas de v1 (`bookable`, fuentes con error, impuestos) intactas.

## 8. Fuera de alcance

Cancelación que toque Care, convenio y Nemo (siguen no reservables), excepciones de crédito, facturas, pagos, items por noche (el mock usa un solo item `SERVICE`).
