# Project Handoff & Technical Summary: Hotel Provider Service

> [!IMPORTANT]
> **Nemo rate limit: 10 requests / 10 seconds.**
> All upstream operations against Nemo Group (Price Navigator) share this strict budget per `X-PS-AUTHTOKEN`. Shared rate throttling must be provided before activating live production traffic.

---

## 1. Contexto y Objetivos del Proyecto

El objetivo de este proyecto es construir un backend desacoplado, modular y fuertemente tipado en **NestJS** para integrar la API de inventario hotelero de **Price Navigator (Nemo Group)**.

El sistema fue diseñado bajo 4 patrones arquitectónicos clave:
1. **Arquitectura en Capas Limpia (Clean Architecture)**: Separación estricta entre presentación (Controllers), orquestación (Services), dominio (DTOs, Enums y Modelos) e infraestructura (Adapters y Repositorios).
2. **Patrón Adapter (`NemoXmlAdapter`)**: Aísla la serialización y deserialización de XML propietario de Nemo Group, con validación de tipos y manejo robusto de excepciones.
3. **Patrón Strategy (`HotelProviderStrategy`)**: Permite alternar dinámicamente entre el proveedor real (`nemo`) y el proveedor de pruebas offline (`mock` con retención de estado en memoria por 30 minutos).
4. **Patrón Repository (`ICatalogRepository`)**: Desacopla el acceso a catálogos maestros y diccionarios mediante interfaces y tokens de inyección (`CATALOG_REPOSITORY`), cargando semillas CSV en memoria para desarrollo offline y preparado para migrar a PostgreSQL / Prisma sin tocar servicios de negocio.

---

## 2. Decisiones Técnicas y Justificación

### ¿Por qué NestJS?
- **Inyección de Dependencias (IoC / DI)**: Facilita el desacoplamiento de estrategias y repositorios mediante tokens (`CATALOG_REPOSITORY`, `NemoHotelStrategy`, etc.).
- **Validación Estricta sin `any`**: Integración global de `ValidationPipe`, `class-validator` y `class-transformer` con `whitelist: true, transform: true, forbidNonWhitelisted: true`.
- **OpenAPI / Swagger Nativo**: Documentación interactiva y esquemas JSON generados en tiempo de ejecución.

### Patrón Strategy (`HotelProviderStrategy`)
- **`MockHotelStrategy`**: Simula inventario realista, retiene precios y políticas por 30 minutos, simula drift de precios (`MOCK-PRICE-002`) y expiración de sesiones (`MOCK-EXP-001`).
- **`NemoHotelStrategy`**: Conecta contra el servidor real de Price Navigator (`https://service-cert.psurfer.net/pricesurfer`).
- **Resolución dinámica**: Mediante query parameter `?provider=mock` (por defecto) o `?provider=nemo`.

### Patrón Repository (`ICatalogRepository`)
- **`LocalCatalogRepository`**: Implementación en memoria que carga las semillas CSV (`amenities.csv`, `suppliers.csv`, `accommodations.csv`) al iniciar.
- **Migración a PostgreSQL**: Para conectar una base de datos real con Prisma o TypeORM, solo se debe crear `PrismaCatalogRepository` implementando `ICatalogRepository` y cambiar la vinculación del token en `src/modules/catalog.module.ts`.

---

## 3. Catálogo de Destinos (Ubicaciones)

Para evitar saturar el repositorio con millones de registros, el archivo de destinos no se incluyó en el código fuente. Se cargó en la tabla `hotel_destinations` de Supabase (base de pruebas):
* **Origen**: Confluence de Nemo Group, Sección **3.2 Destinos** (`Destination_ES` y `Destination_EN`).
* **Tabla**: `hotel_destinations`, un registro por destino **y por idioma** (llave primaria `destination_id` + `language_id`). Columnas: `destination_id, language_id, city, country, country_id, state, state_id, city_country, created_at`.
* **Índices**: trigram (`pg_trgm`) sobre `city_country`, más `country_id` y `language_id`. RLS activado; solo el backend accede con la llave de servicio.
* **Acceso**: `GET /locations/search` mediante `IDestinationRepository` (`SupabaseDestinationRepository`). Requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env` (ver `.env.example`); sin ellas solo ese endpoint responde `503`.
* **Calidad de datos**: se limpiaron duplicados, espacios, caracteres mal codificados y textos `NULL`. La etiqueta `city_country` conserva el formato inconsistente de Nemo.
* **Mejora pendiente**: la búsqueda es `ILIKE '%q%'` sobre `city_country` con orden alfabético; ver `PROGRESS.md`, Fase 6.

---

## 4. Guía de Ejecución y Pruebas

### Levantar el servidor
```bash
npm run dev
```
El servicio iniciará en `http://localhost:3000`.

### Acceder a la Documentación Interactiva (Swagger UI)
Abre en tu navegador:
👉 **`http://localhost:3000/api/docs`**

### Ejecutar la Suite de Pruebas Automatizadas
```bash
npm test
```
Ejecuta 12 suites de tests en menos de 1.5 segundos:
- Validación de rutas HTTP.
- Paginación, ordenamiento y filtrado de catálogos.
- Serialización y parseo de XML con escape de caracteres.
- Verificación estricta de AST garantizando **cero `any`**.
- Verificación de que las rutas de reserva están **deshabilitadas**.
- Verificación de generación del documento Swagger.

---

## 5. Ejemplos de Peticiones cURL

### A. Búsqueda de Hoteles con Filtros Enriquecidos
```bash
curl -s -X POST "http://localhost:3000/hotels/search?provider=mock" \
  -H "Content-Type: application/json" \
  -d '{
    "destinationId": "2262",
    "checkIn": "2026-10-15",
    "checkOut": "2026-10-20",
    "rooms": [{"roomSequence": 1, "roomType": "NMO.HTL.RMT.DBL"}],
    "passengers": [{"roomSequence": 1, "ageType": "ADT"}, {"roomSequence": 1, "ageType": "ADT"}],
    "minRating": 4,
    "maxRating": 5,
    "hotelName": "Plaza"
  }' | jq .
```

### B. Verificación de Tarifa en Vivo
```bash
curl -s -X POST "http://localhost:3000/hotels/validate?provider=mock" \
  -H "Content-Type: application/json" \
  -d '{"tripProductId": "MOCK-TX_SEARCH_1740000000000_123456-1"}' | jq .
```

### C. Consulta de Gastos de Cancelación
```bash
curl -s -X POST "http://localhost:3000/hotels/cancellation-fees?provider=mock" \
  -H "Content-Type: application/json" \
  -d '{"tripProductId": "MOCK-TX_SEARCH_1740000000000_123456-1"}' | jq .
```

### D. Ficha Técnica y Fotos del Hotel
```bash
curl -s "http://localhost:3000/hotels/MOCK-2262-001/details?provider=mock&language=es" | jq .
```

### E. Catálogo Maestro de Hoteles por Destino
```bash
curl -s "http://localhost:3000/hotels/catalog?destinationCode=2262&activeOnly=true&provider=mock" | jq .
```

### F. Autocompletado de Destinos
```bash
curl -s "http://localhost:3000/locations/search?q=cancun&language=es&limit=5" | jq .
```

### G. Catálogos Paginados y Filtrados
```bash
# Amenidades filtradas por grupo y texto
curl -s "http://localhost:3000/catalogs/amenities?groupCode=MNO.HTL.AMT.SER&search=toalla&page=1&limit=10" | jq .

# Proveedores mayoristas
curl -s "http://localhost:3000/catalogs/suppliers?search=expedia" | jq .

# Tipos de habitación y capacidad
curl -s "http://localhost:3000/catalogs/room-types" | jq .
```

---

## 6. Operaciones de Reserva Deshabilitadas por Seguridad

Las rutas de reserva y post-venta están completamente implementadas en DTOs, Estrategias y Adaptadores XML, pero **comentadas en `src/controllers/hotel.controller.ts`**:
- `POST /hotels/book`: Creación de reserva.
- `GET /hotels/bookings/:locator`: Consulta de reserva y voucher.
- `POST /hotels/bookings/:locator/cancel`: Cancelación de reserva.

**Para activarlas en producción**:
1. Configurar credenciales definitivas y límite de crédito en Nemo (`NEMO_AUTH_TOKEN`).
2. Descomentar los bloques correspondientes en `src/controllers/hotel.controller.ts`.
3. Aplicar control de acceso / autenticación (ej. Supabase JWT Guard) y rate limiting compartido.

---

## 7. Próximos Pasos Recomendados

1. **Implementar Rate Limiter Outbound**: Middleware Token Bucket limitando a 8 peticiones / 10 segundos hacia Nemo.
2. **Capa de Autenticación Inbound**: `SupabaseAuthGuard` para proteger las rutas que consuma el frontend.
3. **Activar Reservas en Producción**: Descomentar los handlers cuando el contrato y límite de crédito estén activos.
