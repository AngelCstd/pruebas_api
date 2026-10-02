# Contrato de reservas de hotel — v1 (2026-10-01)

Fuente única de verdad para tres trabajos que corren en paralelo y **no deben depender entre sí**:

| Trabajo | Dónde | Qué toca |
|---|---|---|
| **BACK** | `pruebas_api/` | Reservar con `mock`, idempotencia en Supabase, lista de reservas, marca `bookable`. |
| **CLIENTE** | `noktos-care-foundation/src/integrations/nemu-hotels/` | Cliente de API tipado hacia el back. |
| **FRONT** | `noktos-care-foundation/app/reservas/` | Pantalla de Reservas y modal de crear. |

Cada trabajo solo implementa lo que dice este contrato. Si algo no está aquí, **no lo inventes**: déjalo anotado en tu reporte final.

## 0. Reglas generales

- El back (`http://localhost:3000`) es de pruebas y se va a migrar a Care. **Sin login, sin API key, sin interruptor de activación.** No sobreingenierizar.
- El back habilita CORS para cualquier origen (temporal).
- El parámetro `?provider=` acepta `all` | `mock` | `convenio` | `nemo`. El cliente usa `all` para buscar y `mock` para reservar.
- Todo en español en textos para el usuario; código y nombres de campo en inglés, como ya están.
- Errores: cuerpo estándar de Nest `{ statusCode, message, error }`. Los que llevan `code` están marcados abajo.

### 0.1 Tenant (cambio v1.1, 2026-10-01): lo manda el front, en el cuerpo

Sin autenticación, el tenant (la empresa dueña de los datos) **lo manda quien llama**. La variable de entorno `CATALOG_TENANT_ID` **se elimina**: el back ya no la lee.

- **Peticiones POST** (`/hotels/search`, `/hotels/validate`, `/hotels/cancellation-fees`, `/hotels/book`, `/hotels/bookings/:locator/cancel`): campo **`tenantId`** en el **cuerpo** JSON.
- **Peticiones GET** (`/hotels/:code/details`, `/hotels/catalog`, `/hotels/bookings`, `/hotels/bookings/:locator`): un GET no tiene cuerpo, así que va como parámetro de query **`tenantId`**.
- `GET /locations/search` no necesita tenant (los destinos no son por empresa).
- Es **opcional** en los DTOs (el mock de búsqueda no lo usa) y **obligatorio** donde se toca la base: hoteles de convenio y operaciones de reserva. Si falta ahí: `400` con mensaje `tenantId is required`.
- En `provider=all`, si falta el tenant solo falla la fuente convenio: sus resultados se omiten y `sources` lo informa como `ERROR` con ese mensaje; los demás resultados siguen.
- Forma: texto no vacío de hasta 100 caracteres. Se usa tal cual para filtrar por `tenant_id`.
- Limitación asumida a propósito: quien llame puede declarar cualquier tenant. Es aceptable solo porque este back es temporal y local; al migrar a Care, el tenant saldrá de la sesión.

Cliente (Care): `createNemuHotelsClient({ tenantId })` agrega `tenantId` a **todos** los cuerpos POST y a la query de los GET que lo requieren; los tipos de request de `types.ts` **no** cambian (lo inyecta el cliente). El front lo toma de `NEXT_PUBLIC_NEMU_TENANT_ID` por ahora.

## 1. Cambios a respuestas existentes

`HotelRate` gana tres campos:

| Campo | Tipo | Significado |
|---|---|---|
| `bookable` | `boolean` | Si hoy se puede reservar esta tarifa desde el back. `mock` = `true`. `convenio` y `nemo` = `false`. |
| `bookableReason` | `'PENDING_OPERATIONS' \| 'PROVIDER_BOOKING_DISABLED'` (opcional) | Por qué no. Convenio = `PENDING_OPERATIONS`. Nemo = `PROVIDER_BOOKING_DISABLED`. |
| `bookingNote` | `string` (opcional) | Texto para mostrar. Convenio: `Reserva pendiente: la confirma Operaciones.` |
| `taxesIncluded` | `boolean` (opcional) | `true` = el precio ya incluye impuestos. Convenio = `true` (se capturan "ya con todo"; sale de `rate_includes_tax` del catálogo). `mock` y `nemo` no lo informan (ausente). El front muestra "Precio con impuestos" cuando es `true`. |

Se conservan `HotelItem.source` y `HotelSearchResult.sources` tal como están hoy (`'mock' | 'nemo' | 'convenio'`).

## 2. Endpoints de reserva (solo `provider=mock`)

Todos los demás proveedores responden `501` con `code: 'BOOKING_NOT_ENABLED'`, salvo `all`, que responde `400` (ya existe).

### `POST /hotels/book?provider=mock`
- Header obligatorio **`Idempotency-Key`**: regex `^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$`.
- Body: `BookHotelDto` (ya existe en `src/domain/dtos/book-hotel.dto.ts`).
- `201`: `BookingResult` + `operationId: string` + `idempotentReplay: boolean`.
- Errores:
  - `400` falta o es inválida la `Idempotency-Key`, o body inválido.
  - `404` la tarifa no existe (el mock responde "Search for a mock hotel before booking").
  - `410` la tarifa venció (30 min).
  - `409` con `code: 'IDEMPOTENCY_KEY_REUSED'`: misma clave con **otro** contenido.
  - `409` con `code: 'IDEMPOTENCY_IN_PROGRESS'`: misma clave y contenido, pero la primera llamada sigue en curso.
  - `503` el almacén de operaciones (Supabase) no está configurado o no responde.

### `GET /hotels/bookings/:locator?provider=mock`
`BookingDetailResult` (ya existe). Se arma desde la operación guardada; si no existe ahí, se intenta con el mock en memoria; si tampoco, `404`.

### `POST /hotels/bookings/:locator/cancel?provider=mock`
Body `CancelBookingDto` (ya existe). `200` `BookingCancellationResult`. Marca la operación como `CANCELLED`. Repetirlo devuelve el mismo resultado. Limitación conocida: el mock guarda sus reservas en memoria, así que tras reiniciar el back una cancelación responde `404`.

### `GET /hotels/bookings?provider=mock&limit=50&status=BOOKED`
`200`:
```json
{ "items": [ BookingSummary ] }
```
Más recientes primero. `limit` 1–100 (por defecto 50). `status` opcional: `BOOKED | CANCELLED | FAILED`. **Siempre filtra por el `tenantId` recibido** (ver 0.1; obligatorio aquí).

`BookingSummary`:
```ts
{
  operationId: string;
  provider: 'mock' | 'nemo' | 'convenio';
  status: 'BOOKED' | 'CANCELLED' | 'FAILED';
  bookingLocator: string | null;
  supplierConfirmationCode: string | null;
  clientReference: string;
  hotelCode: string | null;
  hotelName: string | null;
  checkIn: string | null;      // YYYY-MM-DD
  checkOut: string | null;     // YYYY-MM-DD
  totalPrice: { amount: number; currency: string } | null;
  leadPassengerName: string;
  createdAt: string;           // ISO
  cancelledAt: string | null;  // ISO
}
```
Las operaciones en `PENDING` no se listan.

## 3. Idempotencia y tabla en Supabase

Tabla `public.hotel_booking_operations` (el SQL va en `pruebas_api/database/hotel_booking/01_schema.sql`; **lo corre el usuario a mano**):

```sql
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
```

Algoritmo de `book` (patrón "reclamar, llamar, cerrar"):
1. Validar la clave y calcular `request_fingerprint` = SHA-256 del `BookHotelDto` en JSON canónico (llaves ordenadas).
2. Insertar la fila en `PENDING`. Si choca con el índice único `(tenant, provider, key)`, leer la existente:
   - fingerprint distinto → `409 IDEMPOTENCY_KEY_REUSED`;
   - `BOOKED` o `CANCELLED` → devolver la respuesta guardada con `idempotentReplay: true` **sin** llamar al proveedor;
   - `PENDING` → `409 IDEMPOTENCY_IN_PROGRESS`;
   - `FAILED` → reintento permitido: volver a `PENDING` y seguir.
3. Llamar a `strategy.bookHotel`. Éxito → fila `BOOKED` con los campos del resultado. Error → fila `FAILED` con `failure_code` y relanzar el error original.

El acceso a la tabla va detrás de una interfaz `IBookingOperationRepository` con implementación Supabase y una implementación en memoria **solo para pruebas** (patrón igual al de `IConvenioHotelRepository`).

## 4. Contrato TypeScript para Care

Lo consumen CLIENTE y FRONT. Vive en `noktos-care-foundation/src/integrations/nemu-hotels/types.ts` (ya creado como andamio; **no lo modifiques sin avisar**). La interfaz que el CLIENTE implementa y el FRONT usa:

```ts
export interface NemuHotelsClient {
  searchDestinations(params: { q: string; language?: 'es' | 'en'; limit?: number }, signal?: AbortSignal): Promise<Destination[]>;
  searchHotels(body: SearchHotelsRequest, options?: { provider?: ProviderType; signal?: AbortSignal }): Promise<HotelSearchResult>;
  getHotelDetails(hotelCode: string, options?: { provider?: ProviderType; language?: 'es' | 'en'; signal?: AbortSignal }): Promise<HotelDetails>;
  validateRate(tripProductId: string, options?: { provider?: ProviderType; signal?: AbortSignal }): Promise<RateValidation>;
  getCancellationFees(tripProductId: string, options?: { provider?: ProviderType; signal?: AbortSignal }): Promise<CancellationFees>;
  bookHotel(body: BookHotelRequest, options: { idempotencyKey: string; provider?: ProviderType; signal?: AbortSignal }): Promise<BookingResult>;
  getBooking(locator: string, options?: { provider?: ProviderType; signal?: AbortSignal }): Promise<BookingDetail>;
  cancelBooking(locator: string, body?: { reason?: string }, options?: { provider?: ProviderType; signal?: AbortSignal }): Promise<BookingCancellation>;
  listBookings(params?: { provider?: ProviderType; limit?: number; status?: BookingOperationStatus }, signal?: AbortSignal): Promise<BookingSummary[]>;
}
```

Valores por defecto del cliente: `searchHotels` → `provider='all'`; `getHotelDetails`/`validateRate`/`getCancellationFees` → `provider='all'` (el back enruta por el prefijo del id); `bookHotel`, `getBooking`, `cancelBooking`, `listBookings` → `provider='mock'`.

Errores del cliente: una clase `NemuApiError` con `status: number`, `message: string`, `code?: string` (el `code` del cuerpo si viene) y `isTimeout: boolean`. Configuración: `NEXT_PUBLIC_NEMU_API_URL` (por defecto `http://localhost:3000`), timeout 15 s.

## 5. Flujo del front (para el FRONT)

Pantalla `/reservas`: encabezado, tabla de reservas (de `listBookings`) y botón **Crear reserva** que abre un modal con pasos:

1. **Buscar**: destino (autocompletar con `searchDestinations`, mínimo 3 caracteres), fechas, habitaciones y huéspedes, filtros opcionales.
2. **Resultados**: hoteles de `searchHotels` (provider `all`) con insignia de fuente (`Convenio`, `Mock`, `Nemo`). Panel lateral con detalle (`getHotelDetails`). Por tarifa: validar (`validateRate`) y ver gastos de cancelación (`getCancellationFees`).
3. **Huéspedes**: titular (`leadPassenger`) y huéspedes por habitación.
4. **Confirmación**: `bookHotel` con una `Idempotency-Key` nueva por intento (se reutiliza solo si el usuario reintenta el mismo envío). Muestra el localizador.

Reglas de pantalla:
- Si `rate.bookable === false`, el botón de reservar está **deshabilitado** y se muestra `bookingNote` (convenio: "Reserva pendiente: la confirma Operaciones."). No es un error.
- Si `sources` trae una fuente con `status: 'ERROR'`, avisar discretamente ("No se pudo consultar: Convenio") sin bloquear los resultados de las otras.
- Los hoteles de convenio no traen `checkInTime`/`checkOutTime` (llegan vacíos): ocultar esos campos si están vacíos.
- Moneda por tarifa (mock = EUR, convenio = MXN): mostrar siempre la moneda de cada tarifa, nunca sumar entre monedas.

## 6. Qué NO incluye esta versión

Autenticación, Nemo real, reserva de convenio (la hace Operaciones, diferido), crédito y cobros, facturas, la transacción en la base de Care. Nada de eso se toca.
