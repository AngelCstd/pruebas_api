# Project Progress: Hotel Provider Service

> [!IMPORTANT]
> **Nemo rate limit: 10 requests / 10 seconds.**
> All upstream operations against Nemo Group (Price Navigator) share this strict budget per `X-PS-AUTHTOKEN`. Shared rate throttling must be provided before activating live production traffic.

---

## 1. Estado Actual del Proyecto (Status Overview)

El servicio backend en **NestJS** (`hotel-provider-service`) ha alcanzado la fase de **pre-producción e integración completa de contratos**, con soporte para proveedores en vivo (**Nemo Group**) y simulación offline (**Mock** con retención de estado en memoria).

* **Compilación**: TypeScript compila al 100% con `strict: true` y `noImplicitAny: true` (**0 errores**).
* **Calidad de Código**: **Cero usos explícitos de `any`** en todo el código fuente (verificado automáticamente por análisis de AST en las pruebas).
* **Pruebas Automatizadas**: **43 pruebas** ejecutándose y pasando en verde con `npm test`.
* **Documentación Interactiva**: **Swagger / OpenAPI** montado y operativo en `http://localhost:3000/api/docs`.

---

## 2. Fases y Funcionalidades Completadas

### Fase 1: Catálogos y Diccionarios Maestros (Sección 3.1 Confluence Nemo)
- [x] Extracción y análisis de las 20 tablas de códigos oficiales de Nemo Group.
- [x] Creación de Enums fuertemente tipados (`RoomType`, `BoardType`, `BookingStatus`, `PassengerDocumentType`, `AmenityGroup`, `CancellationFeeType`, `HotelRatingType`, `DestinationType`).
- [x] Generación de archivos CSV de semillas en `database/seeds/`:
  - `amenities.csv` (895 registros)
  - `suppliers.csv` (378 registros)
  - `accommodations.csv` (95 registros)
- [x] Exclusión deliberada del catálogo masivo de destinos de código fuente (se consulta desde la tabla `hotel_destinations` en Supabase; ver Fase 6).
- [x] Implementación del patrón Repository (`ICatalogRepository`, token `CATALOG_REPOSITORY`, y `LocalCatalogRepository` en memoria con carga de CSVs).
- [x] Creación de 10 endpoints REST de catálogos (`GET /catalogs/*`).
- [x] Paginación (`page`, `limit`, `totalPages`), ordenamiento (`sortOrder`), búsqueda por texto (`search`) y filtros por listas de códigos (`codes`, `groupCodes`).

### Fase 2: Ciclo de Vida de Tarifas y Búsqueda Enriquecida
- [x] Búsqueda de disponibilidad en vivo (`POST /hotels/search`) enriquecida con filtros:
  - `minRating` y `maxRating`
  - Array de estrellas `ratings`
  - Regímenes de pensión `boardTypes`
  - Lista de códigos de hotel `hotelCodeList`
  - Subcadena de nombre `hotelName`
- [x] Verificación de tarifa y disponibilidad previa al checkout (`POST /hotels/validate`):
  - Serialización y parseo de `AvailabilityValidationRQ/RS`.
  - Detección de cambios de precio (`priceChanged`) y expiración de sesiones (30 min).
- [x] Consulta de gastos de cancelación y penalizaciones (`POST /hotels/cancellation-fees`):
  - Serialización y parseo de `CancellationFeesQueryRQ/RS`.
  - Cálculo de tramos de penalización (`feeSchedule`) y fecha límite de cancelación gratuita.

### Fase 3: Ficha Técnica Multimedia y Catálogo Maestro
- [x] Ficha técnica y contenido visual del hotel (`GET /hotels/:hotelCode/details`):
  - Serialización y parseo de `AdditionalInfoQueryRQ/RS`.
  - Galería multimedia con URLs de imágenes categorizadas, descripciones, horarios de check-in/out y amenidades.
- [x] Catálogo maestro de hoteles por destino (`GET /hotels/catalog`):
  - Serialización y parseo de `HotelCatalogQueryRQ/RS`.
  - Códigos de hotel, nombres, estrellas, dirección y coordenadas GPS.

### Fase 4: Operaciones de Reserva (Preparadas y Deshabilitadas por Seguridad)
- [x] Modelos DTO completos con validación estricta (`BookHotelDto`, `CancelBookingDto`).
- [x] Modelos de resultado (`BookingResult`, `BookingDetailResult`, `BookingCancellationResult`).
- [x] Implementación en `HotelService`, `MockHotelStrategy`, `NemoHotelStrategy`, `NemoXmlBuilder` y `NemoXmlParser`.
- [x] **Deshabilitación intencional en `HotelController`**: Las rutas `POST /hotels/book`, `GET /hotels/bookings/:locator` y `POST /hotels/bookings/:locator/cancel` se encuentran comentadas con bloques explicativos, respondiendo `404 Not Found` para evitar cualquier cobro o reserva accidental en Nemo hasta activar el entorno de producción.

### Fase 5: Documentación y OpenAPI / Swagger
- [x] Instalación e integración de `@nestjs/swagger` y `swagger-ui-express`.
- [x] Decoradores `@ApiTags`, `@ApiOperation`, `@ApiResponse` y `@ApiProperty` en todos los controladores y DTOs activos.
- [x] Interfaz interactiva Swagger UI lista en `http://localhost:3000/api/docs`.
- [x] Prueba automatizada que valida la generación del OpenAPI schema en `tests/swagger.test.js`.

### Fase 6: Catálogo de Destinos (`hotel_destinations`)
- [x] Carga de los archivos `Destination_ES` y `Destination_EN` (Nemo, Sección 3.2) en la tabla `hotel_destinations` de Supabase (base de pruebas), con llave primaria `(destination_id, language_id)`.
- [x] Limpieza de datos: duplicados, espacios raros, caracteres mal codificados y textos `NULL`.
- [x] Patrón Repository para destinos (`IDestinationRepository`, token `DESTINATION_REPOSITORY`, `SupabaseDestinationRepository`).
- [x] Endpoint `GET /locations/search` (`q` mín. 3 caracteres, `language`, `countryId`, `limit`) documentado en Swagger bajo el tag `Locations`.
- [x] Configuración por `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; sin ellas solo este endpoint responde `503`.
- Pendiente (mejora): la búsqueda usa `ILIKE '%q%'` sobre `city_country` y ordena alfabéticamente, por lo que términos cortos como `can` también traen `Canadá`. Ideas: buscar solo en `city`, priorizar coincidencias por prefijo e ignorar acentos (`unaccent`).

### Fase 7: Hoteles con convenio y búsqueda combinada (2026-10-01)
- [x] Catálogo de hoteles de MIA en la base de Care: tablas `suppliers` y `supplier_hotel_profiles` + vista `hotel_catalog_v` (`database/hotel_catalog/`, **borrador sin aplicar**). Exportación desde MIA a CSV e importación por staging incluidas.
- [x] `ConvenioHotelStrategy` (`provider=convenio`): busca por la **ciudad** del destino pedido (se resuelve con `hotel_destinations`); si el destino no se resuelve no hay resultados. Siempre disponible mientras el convenio esté vigente a la llegada. Precio = tarifa por noche × noches × cuartos.
- [x] `CompositeHotelStrategy` (`provider=all`): convenio + proveedor externo (`mock` por defecto, `nemo` con `HOTEL_EXTERNAL_PROVIDER=nemo`). Cada hotel lleva `source`; si una fuente falla el resultado lo informa en `sources` y las demás siguen. Validar, cancelación y detalle se enrutan por el prefijo del id (`CNV~` / `CNV-` = convenio, `MOCK` = mock).
- [x] `tenantId` llega en el cuerpo de los POST y en la query de los GET; la llave de servicio se salta la RLS, por eso el back filtra siempre por el tenant recibido. `HOTEL_EXTERNAL_PROVIDER` selecciona la fuente externa.
- [x] Pruebas en `tests/convenio.test.js` (repositorios falsos).
- Pendiente: reserva de convenio (hoy responde 501), reserva con `provider=all` (responde 400 a propósito), persona extra y desayuno aparte en el precio, política de cancelación de convenio (hoy "por confirmar con el hotel"), confirmar si `tarifas.precio` incluye impuestos y es por noche y por cuarto.

### Fase 8: Reservas mock idempotentes (2026-10-01)
- [x] Tarifas con `bookable`, motivo y nota: mock reservable; convenio pendiente de Operaciones; Nemo deshabilitado.
- [x] CORS temporal abierto y rutas de reserva, detalle, cancelación y listado habilitadas.
- [x] Reservas limitadas a `provider=mock`; convenio/Nemo responden `501 BOOKING_NOT_ENABLED` y `all` responde `400`.
- [x] Patrón Repository para `hotel_booking_operations`, con implementación Supabase filtrada siempre por el `tenantId` recibido e implementación en memoria aislada por tenant para pruebas.
- [x] Algoritmo idempotente reclamar–llamar–cerrar con fingerprint SHA-256 de JSON canónico, replay, conflictos y reintento de operaciones fallidas.
- [x] Detalle desde la operación persistida, cancelación idempotente y listado por estado sin operaciones `PENDING`.
- [x] Borrador SQL en `database/hotel_booking/01_schema.sql` (no ejecutado).
- [x] Suite automatizada ampliada con escenarios de reserva, proveedores, cancelación, listado y recuperación de fallos.

### Fase 9: Reserva mock con crédito en Care (2026-10-02)
- [x] Repositorio `ICareReservationRepository` con implementaciones Supabase y en memoria para pruebas; lecturas siempre acotadas por tenant y RPCs de retención, liberación y creación.
- [x] `GET /clients` y `GET /persons`, con validación de tenant, cliente, búsqueda y límite.
- [x] `BookHotelDto` ampliado con `clientOrganizationId` y referencias a personas existentes o nuevas.
- [x] Orquestación claim → validar tarifa → resolver titular → retener crédito → reservar proveedor → crear reserva Care → cerrar operación, incluida liberación compensatoria en fallos.
- [x] Replay idempotente con los identificadores de Care guardados en `response_payload`.
- [x] Listado desde `hotel_reservations_v`, con cliente, viaje, saldo pendiente y vencimiento; las operaciones fallidas no se listan.
- [x] Mock unificado en MXN, incluida `MOCK-PRICE-002`, sin conversión de montos.
- [x] Suite de 43 pruebas en verde, con escenarios felices y fallos de crédito, proveedor, persona y creación en Care.
- Pendiente: la cancelación aún no modifica Care ni libera el crédito retenido.

---

## 3. Próximos Pasos Recomendados (Backlog Priorizado)

1. **Rate Limiter Outbound (Token Bucket para Nemo)**:
   - Crear un interceptor/middleware en `NemoXmlAdapter` que limite a 8 peticiones cada 10 segundos para respetar el límite de 10 req/10s de Nemo.
2. **Capa de Autenticación Inbound**:
   - Integrar `SupabaseAuthGuard` para validar el JWT de los usuarios que consuman la API desde el frontend, o un `ApiKeyGuard` para llamadas entre microservicios.
3. **Activación de Reservas en Producción**:
   - Una vez configuradas las credenciales definitivas y el límite de crédito en Nemo, descomentar los handlers de reserva en `hotel.controller.ts`.
