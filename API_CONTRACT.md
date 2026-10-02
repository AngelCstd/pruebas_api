# Contrato de API - Servicio de Proveedores de Hoteles (Hotel Provider Service)

> [!IMPORTANT]
> **Límite upstream de Nemo: 10 peticiones cada 10 segundos** por `X-PS-AUTHTOKEN`.
> Todas las llamadas al proveedor Nemo (`AvailabilityQuery`, `AvailabilityValidation`, `CancellationFeesQuery`, `AdditionalInfoQuery`, `HotelCatalogQuery`, reservas y cancelaciones) consumen este presupuesto común.
> Cualquier ráfaga que exceda este umbral provocará errores HTTP `429 Too Many Requests` o el cierre abrupto de la conexión TCP por parte de los balanceadores de Nemo.
> **Recomendación prioritaria para producción**: Implementar un middleware o interceptor de Rate Limiting distribuido (Token Bucket / Leaky Bucket con Redis) antes de habilitar el tráfico de producción hacia Nemo.

---

## 1. Información General y Documentación Interactiva

- **Servicio**: `hotel-provider-service` (NestJS 10, TypeScript estricto, Clean Architecture)
- **Documentación Interactiva (Swagger UI)**: `http://localhost:3000/api/docs`
- **Especificación OpenAPI (JSON)**: `http://localhost:3000/api/docs-json`
- **Puerto por defecto**: `3000` (configurable mediante variable de entorno `PORT`)
- **Parámetro global de proveedor**: La mayoría de endpoints de `/hotels` aceptan `?provider=mock` (por defecto, simulación local sin red) o `?provider=nemo` (integración XML real con Nemo Price Navigator).

---

## 2. Arquitectura del Sistema

El servicio sigue los principios de **Clean Architecture**, desacoplando totalmente la lógica de negocio de los detalles de infraestructura:

1. **Capa de Presentación (`src/controllers/`)**:
   - `HotelController`: Endpoints de búsqueda, validación de tarifas, penalizaciones de cancelación, ficha de hotel/fotos y catálogo de hoteles.
   - `CatalogController`: 10 endpoints REST para consultar catálogos maestros codificados y tabulares.
   - `HealthController`: Chequeo de salud del servicio y estado de los proveedores configurados.
   - Controladores decorados con anotaciones OpenAPI (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiQuery`).

2. **Capa de Aplicación (`src/services/`)**:
   - `HotelService`: Orquesta la resolución de la estrategia del proveedor mediante `HotelStrategyFactory`.
   - `CatalogService`: Gestiona la consulta de catálogos y delega a la capa de persistencia mediante inyección de dependencias (`CATALOG_REPOSITORY`).

3. **Capa de Dominio (`src/domain/`)**:
   - DTOs con validaciones estrictas (`class-validator` y `class-transformer`). Sin uso de `any`.
   - Enums tipados para tipos de habitación, regímenes de pensión, grupos de amenidades, estatus de reserva, tipos de documentos de pasajero, tipos de penalización de cancelación y calificaciones de estrellas.
   - Modelos de dominio (`PaginatedResult<T>`, `HotelDetails`, `HotelCatalog`, `RateValidation`, `CancellationFees`, etc.).

4. **Capa de Infraestructura (`src/strategies/`, `src/adapters/`, `src/repositories/`)**:
   - **Patrón Strategy**: `IHotelProviderStrategy` implementado por `MockHotelStrategy` y `NemoHotelStrategy`.
   - **Patrón Adapter**: `NemoXmlBuilder` y `NemoXmlParser` (`fast-xml-parser`) para transformar entre modelos TypeScript limpios y esquemas XML de Nemo Price Navigator (`*RQ` y `*RS`).
   - **Patrón Repository**: `ICatalogRepository` implementado por `LocalCatalogRepository`, cargando semillas CSV en memoria (`database/seeds/`).

---

## 3. Endpoints del Sistema y Salud

### `GET /health`
Verifica la operatividad del servicio y su tiempo activo.

- **Respuesta `200 OK`**:
```json
{
  "status": "ok",
  "service": "hotel-provider-service",
  "timestamp": "2026-09-28T19:30:00.000Z",
  "uptimeSeconds": 142
}
```

### `GET /providers/status`
Reporta el estado y disponibilidad de los proveedores integrados (`mock` y `nemo`).

- **Respuesta `200 OK`**:
```json
{
  "providers": [
    {
      "provider": "mock",
      "mode": "offline",
      "enabled": true,
      "ready": true,
      "configured": true,
      "message": "Available locally without credentials or external requests."
    },
    {
      "provider": "nemo",
      "mode": "external",
      "enabled": false,
      "ready": false,
      "configured": false,
      "message": "Not tested or called by this endpoint; use mock endpoints until credentials are available."
    }
  ]
}
```

---

## 4. Endpoints de Catálogos Maestros (`/catalogs`)

Los catálogos están divididos estratégicamente entre **Enums/Constantes en Código** (pocos valores o estándares de la industria) y **Tablas / Base de Datos con semillas CSV** (conjuntos de datos extensos y dinámicos).

### 4.1 Catálogos en Código (Enums / Constantes)
Retornan arreglos directos con `code` y `description`.

| Endpoint | Descripción | Entradas |
| :--- | :--- | :--- |
| `GET /catalogs/room-types` | Tipos de habitación (`NMO.HTL.RMT.SGL`, `DBL`, `TPL`, `QUD`) | 4 |
| `GET /catalogs/board-types` | Regímenes alimenticios (`RO`, `BB`, `HB`, `FB`, `AI`) | 5 |
| `GET /catalogs/star-ratings` | Calificaciones en estrellas (código Nemo a valor numérico decimal) | 54 |
| `GET /catalogs/amenity-groups` | Grupos lógicos de amenidades (General, Habitación, Negocios, Spa, etc.) | 8 |
| `GET /catalogs/booking-statuses` | Estados del ciclo de vida de una reserva (`CONFIRMED`, `CANCELLED`, etc.) | 6 |
| `GET /catalogs/passenger-document-types`| Documentos de identidad (`PASSPORT`, `NATIONAL_ID`, `TAX_ID`) | 3 |
| `GET /catalogs/cancellation-fee-types` | Tipos de penalización (`PERCENTAGE`, `FIXED_AMOUNT`, `NIGHTS`) | 3 |

### 4.2 Catálogos Extensos (Semillas CSV con Paginación y Filtrado)
Consultados a través de `LocalCatalogRepository` (enriquecidos con paginación, ordenamiento y filtros multi-criterio).

Parámetros comunes de consulta (Query Params):
- `page` (entero, opcional, por defecto `1`, mín `1`)
- `limit` (entero, opcional, por defecto `20`, mín `1`, máx `100`)
- `sortBy` (string, opcional, `code` o `description`)
- `sortOrder` (string, opcional, `asc` o `desc`, por defecto `asc`)
- `search` (string, opcional, búsqueda parcial en código o descripción)
- `codes` (string, opcional, lista separada por comas para búsqueda exacta, ej. `WIFI,POOL`)

| Endpoint | Registros | Parámetros adicionales | Archivo semilla |
| :--- | :--- | :--- | :--- |
| `GET /catalogs/amenities` | 895 | `groupCode`, `groupCodes` | `database/seeds/amenities.csv` |
| `GET /catalogs/suppliers` | 378 | - | `database/seeds/suppliers.csv` |
| `GET /catalogs/accommodation-types` | 95 | - | `database/seeds/accommodations.csv` |

#### Formato de Respuesta Paginada (`PaginatedResult<T>`):
```json
{
  "items": [
    {
      "code": "WIFI",
      "description": "Acceso inalámbrico a internet",
      "groupCode": "INTERNET",
      "groupDescription": "Servicios de Conectividad"
    }
  ],
  "total": 895,
  "page": 1,
  "limit": 20,
  "totalPages": 45
}
```

### 4.3 Destinos: tabla `hotel_destinations` y `GET /locations/search`
El catálogo de destinos de Nemo (`Destination_ES` / `Destination_EN`, Sección 3.2) supera los 100,000 registros y **nunca debe cargarse en código ni en memoria**. Vive en una base de datos Postgres (Supabase) y se consulta a través del repositorio `IDestinationRepository` (token `DESTINATION_REPOSITORY`).

**Tabla `hotel_destinations`** (un registro por destino **y por idioma**; llave primaria compuesta):

```sql
CREATE TABLE hotel_destinations (
    destination_id VARCHAR(50)  NOT NULL,
    language_id    VARCHAR(10)  NOT NULL,   -- 'es' | 'en'
    city           VARCHAR(255),
    country        VARCHAR(150),
    country_id     VARCHAR(10),
    state          VARCHAR(150),
    state_id       VARCHAR(50),
    city_country   VARCHAR(500),            -- etiqueta de origen, usada para buscar y mostrar
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (destination_id, language_id)
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_hotel_destinations_city_country_trgm ON hotel_destinations USING gin (city_country gin_trgm_ops);
CREATE INDEX idx_hotel_destinations_country_id ON hotel_destinations (country_id);
CREATE INDEX idx_hotel_destinations_language_id ON hotel_destinations (language_id);
```

- La tabla tiene RLS activado: solo el backend accede con la llave de servicio (`SUPABASE_SERVICE_ROLE_KEY`).
- Los datos de origen traen formatos inconsistentes en `city_country` (comas, guiones pegados, país en otro idioma); se limpiaron espacios, caracteres mal codificados y textos `NULL`, pero la etiqueta se conserva tal como viene de Nemo.

#### `GET /locations/search`
Autocompletado de destinos para el buscador del frontend.

- **Query Params**:
  - `q` (string, **requerido**, 3–100 caracteres): texto a buscar.
  - `language` (`es` | `en`, opcional, por defecto `es`).
  - `countryId` (string, opcional, 2–10 caracteres): filtra por código de país (ej. `MX`).
  - `limit` (entero, opcional, 1–50, por defecto `10`).
- **Búsqueda**: coincidencia parcial sin distinguir mayúsculas (`ILIKE '%q%'`) sobre `city_country`, ordenada alfabéticamente por `city_country`. Como `city_country` incluye el país, `can` también coincide con "Canadá". No ignora acentos.
- **Respuesta `200 OK`**:
```json
[
  {
    "destinationId": "2262",
    "languageId": "es",
    "city": "Cancún",
    "state": "Quintana Roo",
    "stateId": "ROO",
    "country": "México",
    "countryId": "MX",
    "label": "Cancún, Quintana Roo - México"
  }
]
```
- **Errores**: `400` si los parámetros son inválidos (por ejemplo `q` de menos de 3 caracteres); `503` si el catálogo no está configurado (faltan `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) o Supabase no responde.

---

## 5. Endpoints de Búsqueda y Ciclo de Vida de Hoteles (`/hotels`)

### 5.1 `POST /hotels/search`
Búsqueda de disponibilidad hotelera con tarifas en tiempo real.

- **Query Param**: `provider` (`mock` | `nemo`, opcional, por defecto `mock`)
- **Body (`SearchHotelsDto`)**:
```json
{
  "destinationId": "2262",
  "checkIn": "2026-10-15",
  "checkOut": "2026-10-20",
  "rooms": [
    { "roomSequence": 1, "roomType": "NMO.HTL.RMT.DBL" }
  ],
  "passengers": [
    { "roomSequence": 1, "ageType": "ADT" },
    { "roomSequence": 1, "ageType": "ADT" }
  ],
  "minRating": 4,
  "maxRating": 5,
  "ratings": ["5_STAR", "4_STAR"],
  "boardTypes": ["BB", "AI"],
  "hotelCodeList": ["HOTEL-001", "HOTEL-002"],
  "hotelName": "Plaza"
}
```

- **Respuesta `201 Created`**:
```json
{
  "transactionId": "MOCK_SEARCH_1789500000000_AB12CD34",
  "provider": "mock",
  "totalItems": 1,
  "hotels": [
    {
      "hotelCode": "MOCK-2262-001",
      "hotelName": "Grand Hotel Plaza",
      "rating": 5,
      "address": {
        "street": "120 Grand Avenue",
        "city": "Madrid",
        "postalCode": "28046",
        "countryCode": "ES"
      },
      "latitude": 40.443912,
      "longitude": -3.690831,
      "rates": [
        {
          "tripProductId": "MOCK_TRIP_1789500000000_EF56GH78",
          "rateClass": "Standard",
          "amount": 862.5,
          "currency": "MXN",
          "roomRates": [
            {
              "roomSequence": 1,
              "roomType": "Deluxe Double Room",
              "boardCode": "BB",
              "boardDescription": "Bed & Breakfast"
            }
          ],
          "cancellationPolicy": {
            "refundable": true,
            "deadline": "2026-10-12T00:00:00.000Z"
          }
        }
      ]
    }
  ]
}
```

> **Proveedor `mock` (datos deterministas).** Devuelve 8 hoteles por búsqueda, con ciudad y país tomados del destino (`hotel_destinations`) y precios que dependen de la categoría, las noches y el tipo/cantidad de habitaciones. Los mismos parámetros siempre devuelven los mismos hoteles. Todas sus tarifas son MXN, incluida `MOCK-PRICE-002`, sin escalar los montos. Si el catálogo de destinos no está disponible o el destino no existe, usa el fixture offline de Madrid. Las coordenadas de destinos distintos al fixture son ficticias.

### 5.2 `POST /hotels/validate`
Revalida la vigencia de la tarifa y detecta posibles variaciones de precio (*Price Drift*) antes de comprometer una reserva.

- **Query Param**: `provider` (`mock` | `nemo`)
- **Body (`ValidateRateDto`)**:
```json
{
  "tripProductId": "MOCK_TRIP_1789500000000_EF56GH78"
}
```
- **Respuesta `200 OK`**:
```json
{
  "tripProductId": "MOCK_TRIP_VALIDATED_EF56GH78",
  "status": "AVAILABLE",
  "priceChanged": false,
  "amount": 862.5,
  "currency": "MXN"
}
```

### 5.3 `POST /hotels/cancellation-fees`
Calcula los importes y fechas límite exactas de penalización en caso de cancelación.

- **Query Param**: `provider` (`mock` | `nemo`)
- **Body (`CancellationFeesDto`)**:
```json
{
  "tripProductId": "MOCK_TRIP_1789500000000_EF56GH78"
}
```
- **Respuesta `200 OK`**:
```json
{
  "tripProductId": "MOCK_TRIP_1789500000000_EF56GH78",
  "refundable": true,
  "currency": "MXN",
  "tiers": [
    {
      "from": "2026-10-12T00:00:00.000Z",
      "to": "2026-10-14T23:59:59.000Z",
      "type": "PERCENTAGE",
      "amount": 50.0
    },
    {
      "from": "2026-10-15T00:00:00.000Z",
      "to": "2026-10-20T23:59:59.000Z",
      "type": "PERCENTAGE",
      "amount": 100.0
    }
  ]
}
```

### 5.4 `GET /hotels/:hotelCode/details`
Obtiene la ficha técnica del hotel, lista de amenidades y galería fotográfica clasificada por categorías.

- **Ruta**: `/hotels/{hotelCode}/details`
- **Query Params**:
  - `provider` (`mock` | `nemo`)
  - `language` (`ES` | `EN`, opcional, por defecto `ES`)
- **Respuesta `200 OK`**:
```json
{
  "hotelCode": "MOCK-2262-001",
  "hotelName": "Grand Hotel Plaza",
  "description": "Hotel de lujo situado en el corazón comercial y turístico.",
  "amenities": [
    "Acceso a internet inalámbrico de alta velocidad",
    "Piscina climatizada al aire libre",
    "Centro de spa y bienestar"
  ],
  "photos": [
    {
      "url": "https://images.example.com/hotels/grand-plaza/facade.jpg",
      "caption": "Fachada exterior del hotel",
      "category": "EXTERIOR"
    },
    {
      "url": "https://images.example.com/hotels/grand-plaza/room-double.jpg",
      "caption": "Habitación Doble Deluxe",
      "category": "ROOM"
    }
  ]
}
```

> **Proveedor `mock`:** la ficha varía por hotel y respeta `language`. Las amenidades usan códigos y nombres del catálogo oficial de Nemo (`GET /catalogs/amenities`). Los códigos válidos son `MOCK-<destinationId>-001` a `-008`.

### 5.5 `GET /hotels/catalog`
Consulta el catálogo general de hoteles asignados a un destino en Nemo.

- **Query Params**:
  - `destinationCode` (string, requerido)
  - `activeOnly` (booleano, opcional, por defecto `true`)
  - `provider` (`mock` | `nemo`)
- **Respuesta `200 OK`**:
```json
{
  "destinationCode": "2262",
  "totalItems": 1,
  "hotels": [
    {
      "hotelCode": "MOCK-2262-001",
      "hotelName": "Grand Hotel Plaza",
      "starRating": "5_STAR",
      "supplierCode": "HOTELBEDS",
      "isActive": true
    }
  ]
}
```

---

## 6. Reservas temporales con mock

Las rutas están habilitadas únicamente con `provider=mock`. `convenio` y `nemo` responden `501` con `code: BOOKING_NOT_ENABLED`; `all` responde `400`.

- `POST /hotels/book`: requiere el header `Idempotency-Key` y un `BookHotelDto`. Retiene crédito, reserva en el mock y crea la reserva en Care. Devuelve `BookingResult` con `reservation`, `operationId` e `idempotentReplay`. Las operaciones se reclaman y cierran en `hotel_booking_operations`.
- `GET /hotels/bookings/:locator`: devuelve el detalle persistido y usa el estado en memoria del mock como respaldo.
- `POST /hotels/bookings/:locator/cancel`: cancela una reserva; repetir la cancelación devuelve el mismo resultado persistido.
- `GET /hotels/bookings?tenantId=...&limit=50&status=BOOKED`: lista las reservas de `hotel_reservations_v`. `limit` acepta 1–100 y `status` acepta `BOOKED`, `CANCELLED` o `FAILED`.

Las tarifas indican si admiten reserva mediante `bookable`, `bookableReason` y `bookingNote`. Solo las tarifas mock tienen `bookable: true`.

El almacén requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; el `tenantId` se recibe en cada petición y todas las consultas se filtran por `tenant_id`. Sin configuración, las operaciones mock responden `503`. El esquema está en `database/hotel_booking/01_schema.sql` y debe aplicarlo manualmente el usuario.

### 6.1 Clientes y personas de Care

- `GET /clients?tenantId=...` devuelve `{ items: ClientCredit[] }`, ordenado por nombre. Lee `client_credit_v`; los importes `creditLimit`, `used` y `available` son números.
- `GET /persons?tenantId=...&organizationId=...&q=...&limit=20` devuelve `{ items: PersonSummary[] }`, ordenado por nombre. `tenantId` y `organizationId` son obligatorios, `q` busca sin distinguir mayúsculas en nombre o correo y `limit` acepta 1–50.

Ambos endpoints usan el repositorio de Care con llave de servicio y filtran siempre por `tenant_id`; `/persons` también filtra por `organization_id`.

### 6.2 Reserva con crédito

`POST /hotels/book?provider=mock` requiere ahora `clientOrganizationId`. El titular y cada huésped pueden ser una persona existente (`{ "personId": "per_..." }`) o una persona nueva con sus campos de nombre actuales; no se permite mezclar `personId` con campos de nombre.

Tras reclamar la idempotencia, el back valida la tarifa, resuelve el nombre del titular, retiene crédito con `hold_hotel_credit_v1`, reserva en el mock y crea toda la reserva de Care con `create_hotel_reservation_v1`. Cualquier fallo posterior a la retención intenta `release_hotel_credit_v1`. Un replay devuelve lo guardado sin repetir retención, proveedor ni creación.

La respuesta `201` agrega:

```json
{
  "reservation": {
    "tripId": "trp_...",
    "serviceId": "svc_...",
    "bookingId": "bkg_...",
    "hotelDetailId": "hot_...",
    "chargeIds": ["chg_..._1"],
    "itemIds": ["tsi_..._1"],
    "dueAt": "2026-11-01"
  }
}
```

Los rechazos de crédito responden `409` con `code` y, cuando aplican, `available`, `requested` y `currency`. `PRICE_CHANGED` responde `409`; `PERSON_NOT_FOUND` responde `404`. Los fallos esperados al crear en Care mapean `INVALID_PAYLOAD` y `PERSON_INCOMPLETE` a `400`, `PERSON_NOT_FOUND` a `404` y los demás a `409`.

### 6.3 Lista de reservas

`GET /hotels/bookings?tenantId=...&provider=mock&limit=50&status=BOOKED` lee `hotel_reservations_v`, no `hotel_booking_operations`. Conserva el límite 1–100 y agrega a cada `BookingSummary`:

- `clientName: string | null`
- `tripId: string`
- `outstanding: number | null`
- `dueAt: string | null`

`booking_status='CANCELLED'` se mapea a `CANCELLED`; cualquier otro estado a `BOOKED`. `status=FAILED` devuelve una lista vacía porque las operaciones fallidas no existen en las tablas de reserva de Care. El detalle y la cancelación siguen leyendo `hotel_booking_operations`.

> [!WARNING]
> `POST /hotels/bookings/:locator/cancel` todavía sólo cancela el mock y marca la operación. No actualiza las tablas de Care ni libera crédito.

---

## 7. Manejo Canónico de Errores

| Código HTTP | Causa | Acción Recomendada |
| :--- | :--- | :--- |
| `400 Bad Request` | Fallo de validación en DTO (fechas incoherentes, campos obligatorios ausentes, tipos no admitidos). | Revisar el arreglo `message` devuelto por NestJS. |
| `401 Unauthorized` | Token `NEMO_AUTH_TOKEN` no configurado o revocado en Price Navigator. | Actualizar la variable de entorno `NEMO_AUTH_TOKEN`. |
| `404 Not Found` | Hotel o producto no encontrado en el proveedor. | Realizar una nueva búsqueda. |
| `409 Conflict` | Price drift detectado: la tarifa cambió de precio en el proveedor. | Mostrar el nuevo importe al usuario antes de reintentar. |
| `410 Gone` | La sesión del `TripProductID` expiró (límite de 30 minutos de Nemo). | Reiniciar el flujo desde la búsqueda. |
| `429 Too Many Requests`| Se sobrepasó el límite de 10 peticiones / 10 segundos en Nemo. | Esperar al reinicio de la ventana de tiempo y encolar peticiones. |
| `502 Bad Gateway` | Error en el transporte HTTPS o respuesta XML inválida desde Nemo. | Reintentar con backoff exponencial. |
| `503 Service Unavailable`| Se solicitó `provider=nemo` pero el proveedor está apagado (`NEMO_ENABLED=false`). | Habilitar el proveedor en `.env` cuando se cuente con credenciales válidas. |
