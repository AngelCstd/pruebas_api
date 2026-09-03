# Contrato de la API HTTP

Última actualización: 2026-09-03.

Este documento describe la API que **este repositorio expone actualmente**. La documentación de Nemo incluida en `API_DOCUMENTATION.md` enumera más operaciones del proveedor externo, pero este servicio sólo implementa por ahora la búsqueda de hoteles.

## Resumen rápido

| Método | Ruta | Autenticación del cliente | Para qué sirve |
| --- | --- | --- | --- |
| `GET` | `/health` | Ninguna | Comprueba que el servicio está en ejecución. |
| `GET` | `/providers/status` | Ninguna | Informa qué proveedores están configurados sin conectarse a ellos. |
| `GET` | `/hotels/destinations` | Ninguna | Lista los destinos disponibles en los fixtures mock. |
| `GET` | `/hotels/room-types` | Ninguna | Lista los tipos de habitación admitidos. |
| `GET` | `/hotels/catalog` | Ninguna | Consulta y filtra el catálogo mock sin crear ni modificar datos. |
| `GET` | `/hotels/catalog/:hotelCode` | Ninguna | Obtiene el detalle de un hotel mock. |
| `POST` | `/hotels/search` | Ninguna | Busca hoteles usando datos simulados (`mock`) o el proveedor externo Nemo (`nemo`). |

- URL local predeterminada: `http://localhost:3000`
- Formato de entrada y salida: JSON
- Encabezado requerido: `Content-Type: application/json`
- Proveedor predeterminado: `mock`
- No existe un prefijo global como `/api` ni versionado en la URL.

## Consultas GET de prueba

Todos estos endpoints son de sólo lectura. Usan `provider=mock` de forma predeterminada. Se acepta `provider=nemo` para dejar explícita la intención del cliente, pero por ahora ninguna de estas rutas realiza llamadas externas.

Comportamiento de `provider=nemo`:

- Catálogo y detalle sí aparecen en la documentación disponible de Nemo. Mientras falte `NEMO_ENABLED=true` o `NEMO_AUTH_TOKEN`, responden `503`. Con configuración presente seguirán respondiendo `501` hasta implementar y verificar sus adaptadores XML.
- Listado de destinos y catálogo independiente de tipos de habitación no aparecen en la documentación disponible. Responden `501` y deben confirmarse contra el Excel de documentación de Nemo.

### `GET /health`

Devuelve el estado del proceso, nombre del servicio, fecha de respuesta y segundos en ejecución.

```json
{
  "status": "ok",
  "service": "hotel-provider-service",
  "timestamp": "2026-09-03T16:36:41.649Z",
  "uptimeSeconds": 18
}
```

### `GET /providers/status`

Muestra el estado local de Mock y los indicadores `enabled`, `configured` y `ready` de Nemo. No valida credenciales ni abre conexiones externas. `ready: false` significa que Nemo no se ha implementado ni comprobado para estas consultas.

### `GET /hotels/destinations`

Lista los destinos presentes en el catálogo mock junto con su número de hoteles.

```http
GET http://localhost:3000/hotels/destinations
```

```http
GET http://localhost:3000/hotels/destinations?provider=nemo
```

La segunda llamada devuelve `501`: la operación no existe en la documentación disponible y debe revisarse en el Excel de Nemo.

### `GET /hotels/room-types`

Lista los códigos de habitación, su nombre legible y la ocupación máxima usada por los fixtures.

```http
GET http://localhost:3000/hotels/room-types
```

`GET /hotels/room-types?provider=nemo` devuelve `501` porque no se documenta una operación independiente para obtener este catálogo.

### `GET /hotels/catalog`

Devuelve el catálogo mock completo o filtrado. Todos los parámetros son opcionales y se pueden combinar.

| Query parameter | Tipo | Reglas | Ejemplo |
| --- | --- | --- | --- |
| `destinationId` | string | Máximo 64 caracteres | `2262` |
| `hotelName` | string | Coincidencia parcial, máximo 120 caracteres | `Grand` |
| `city` | string | Coincidencia parcial, máximo 80 caracteres | `Madrid` |
| `countryCode` | string | Código ISO de dos letras | `MX` |
| `minRating` | integer | De 1 a 5 | `4` |
| `provider` | string | `mock` o `nemo`; predeterminado `mock` | `mock` |

```http
GET http://localhost:3000/hotels/catalog?destinationId=2262&minRating=5
```

La variante preparada para Nemo es:

```http
GET http://localhost:3000/hotels/catalog?provider=nemo&destinationId=2262
```

No se conecta externamente mientras Nemo esté deshabilitado o no exista token; en ese caso devuelve `503`.

```json
{
  "source": "mock",
  "totalItems": 1,
  "hotels": [
    {
      "hotelCode": "MOCK-2262-001",
      "destinationId": "2262",
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
      "description": "Hotel urbano de prueba con habitaciones ejecutivas y servicios de bienestar.",
      "checkInTime": "15:00",
      "checkOutTime": "12:00",
      "amenities": [{ "code": "WIFI", "name": "Wi-Fi" }],
      "images": [{
        "category": "Exterior",
        "url": "https://example.com/mock-hotels/2262-001/exterior.jpg"
      }],
      "roomTypes": ["NMO.HTL.RMT.SGL", "NMO.HTL.RMT.DBL"]
    }
  ]
}
```

Una búsqueda sin coincidencias responde `200 OK` con `totalItems: 0` y `hotels: []`.

### `GET /hotels/catalog/:hotelCode`

Devuelve un hotel mock con su dirección, descripción, amenidades, imágenes y tipos de habitación.

```http
GET http://localhost:3000/hotels/catalog/MOCK-2262-001
```

El detalle preparado para el proveedor real se selecciona con `?provider=nemo`.

Si el código no existe, devuelve `404 Not Found`.

## Arranque local

Requisitos: Node.js 20 o una versión compatible y npm.

```powershell
npm install
npm run start:dev
```

El puerto se toma de `PORT`; si no está definido, se usa `3000`.

## `POST /hotels/search`

Busca disponibilidad hotelera para un destino, fechas, habitaciones y pasajeros. El mismo contrato JSON sirve para ambos proveedores:

- `mock`: genera resultados locales sin credenciales ni llamadas externas. Es la opción predeterminada y la recomendada para desarrollo.
- `nemo`: transforma la solicitud a XML y llama a Nemo Price Navigator. Requiere `NEMO_AUTH_TOKEN`.

### Query parameters

| Parámetro | Tipo | Requerido | Valores | Predeterminado | Descripción |
| --- | --- | --- | --- | --- | --- |
| `provider` | string | No | `mock`, `nemo` | `mock` | Selecciona el origen de los resultados. Cualquier otro valor devuelve `400`. |

### Body

| Campo | Tipo | Requerido | Reglas | Descripción |
| --- | --- | --- | --- | --- |
| `destinationId` | string | Sí | No vacío, máximo 64 caracteres | Identificador del destino en el proveedor. |
| `checkIn` | string | Sí | Formato `YYYY-MM-DD` | Fecha de entrada. |
| `checkOut` | string | Sí | Formato `YYYY-MM-DD`; debe ser posterior a `checkIn` | Fecha de salida. |
| `rooms` | array | Sí | Entre 1 y 8 elementos | Habitaciones solicitadas. |
| `rooms[].roomSequence` | integer | Sí | Mínimo 1 y único en `rooms` | Identificador local de la habitación. |
| `rooms[].roomType` | string enum | Sí | Ver valores abajo | Tipo de habitación Nemo. |
| `passengers` | array | Sí | Entre 1 y 32 elementos | Pasajeros y su asignación de habitación. |
| `passengers[].ageType` | string enum | Sí | `ADT`, `CHD`, `INF` | Adulto, menor o infante. |
| `passengers[].age` | integer | Condicional | De 0 a 17; requerido para `CHD` e `INF` | Edad del menor o infante. Para `ADT` se omite. |
| `passengers[].roomSequence` | integer | Sí | Mínimo 1; debe existir en `rooms` | Habitación asignada al pasajero. |
| `hotelName` | string | No | Máximo 120 caracteres | Filtra por nombre. En `mock`, la coincidencia es parcial y no distingue mayúsculas. |
| `minRating` | integer | No | De 1 a 5 | Calificación mínima del hotel. |

Valores admitidos para `roomType`:

| Valor | Significado |
| --- | --- |
| `NMO.HTL.RMT.SGL` | Habitación individual |
| `NMO.HTL.RMT.DBL` | Habitación doble |
| `NMO.HTL.RMT.TPL` | Habitación triple |
| `NMO.HTL.RMT.QUD` | Habitación cuádruple |

Reglas entre campos:

- Cada `roomSequence` de `rooms` debe ser único.
- Cada pasajero debe referenciar una habitación existente.
- Cada habitación debe tener al menos un pasajero.
- El validador rechaza propiedades adicionales no declaradas en este contrato.

### Ejemplo con PowerShell

```powershell
$body = @{
  destinationId = '2262'
  checkIn = '2026-10-15'
  checkOut = '2026-10-20'
  rooms = @(
    @{ roomSequence = 1; roomType = 'NMO.HTL.RMT.DBL' }
  )
  passengers = @(
    @{ roomSequence = 1; ageType = 'ADT' },
    @{ roomSequence = 1; ageType = 'ADT' }
  )
  minRating = 4
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri 'http://localhost:3000/hotels/search?provider=mock' `
  -ContentType 'application/json' `
  -Body $body
```

### Ejemplo con curl

```bash
curl -X POST "http://localhost:3000/hotels/search?provider=mock" \
  -H "Content-Type: application/json" \
  -d '{
    "destinationId": "2262",
    "checkIn": "2026-10-15",
    "checkOut": "2026-10-20",
    "rooms": [
      {"roomSequence": 1, "roomType": "NMO.HTL.RMT.DBL"}
    ],
    "passengers": [
      {"roomSequence": 1, "ageType": "ADT"},
      {"roomSequence": 1, "ageType": "ADT"}
    ],
    "minRating": 4
  }'
```

### Respuesta exitosa: `200 OK`

```json
{
  "transactionId": "MOCK_SEARCH_1789500000000_AB12CD34",
  "provider": "mock",
  "totalItems": 2,
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
          "currency": "EUR",
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

Los identificadores y los importes del ejemplo son ilustrativos. En el proveedor `mock`, el precio se calcula según el número de noches. Una tarifa no reembolsable no incluye `deadline`. Nemo puede omitir también `latitude` y `longitude` cuando el proveedor no los devuelve.

### Significado de la respuesta

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `transactionId` | string | Identificador de la búsqueda, útil para seguimiento y logs. |
| `provider` | `mock` o `nemo` | Proveedor que produjo la respuesta. |
| `totalItems` | number | Total comunicado por el proveedor; en `mock`, cantidad después de aplicar filtros. |
| `hotels` | array | Hoteles encontrados. Puede estar vacío. |
| `hotels[].hotelCode` | string | Código del hotel. |
| `hotels[].hotelName` | string | Nombre comercial. |
| `hotels[].rating` | number | Calificación del hotel. |
| `hotels[].address` | object | Calle, ciudad, código postal y código de país. |
| `hotels[].latitude`, `longitude` | number | Coordenadas opcionales. |
| `hotels[].rates` | array | Tarifas disponibles para el hotel. |
| `rates[].tripProductId` | string | Identificador de la tarifa/producto devuelto por el proveedor. |
| `rates[].rateClass` | string | Clase comercial de la tarifa. |
| `rates[].amount` | number | Importe total comunicado para la estancia. |
| `rates[].currency` | string | Moneda, normalmente `EUR`. |
| `rates[].roomRates` | array | Desglose por habitación y régimen alimenticio. |
| `rates[].cancellationPolicy.refundable` | boolean | Indica si admite reembolso. |
| `rates[].cancellationPolicy.deadline` | string | Fecha límite ISO 8601; sólo aparece cuando está disponible. |

## Errores

NestJS devuelve normalmente errores JSON con `statusCode`, `message` y `error`. Los mensajes de validación pueden ser un arreglo.

```json
{
  "message": ["checkIn must use YYYY-MM-DD format"],
  "error": "Bad Request",
  "statusCode": 400
}
```

| HTTP | Cuándo ocurre | Acción recomendada |
| --- | --- | --- |
| `400 Bad Request` | Body inválido, propiedad no permitida, fechas incoherentes, habitaciones mal asignadas, `provider` desconocido o Nemo rechaza el esquema XML. | Corregir la solicitud; revisar `message`. |
| `401 Unauthorized` | El token de Nemo falta, es inválido o fue rechazado. | Configurar o renovar `NEMO_AUTH_TOKEN`. |
| `404 Not Found` | Nemo indica que la habitación o tarifa ya no está disponible. | Ejecutar una búsqueda nueva. |
| `409 Conflict` | El precio cambió en Nemo. | Mostrar el cambio y volver a validar el flujo. |
| `410 Gone` | Expiró la sesión de la tarifa Nemo. | Ejecutar una búsqueda nueva. |
| `500 Internal Server Error` | Nemo devuelve un error de proveedor no mapeado. | Registrar el mensaje y `transactionId`; escalar o reintentar según el caso. |
| `502 Bad Gateway` | Timeout, error HTTP de Nemo o XML de respuesta inválido. | Reintentar brevemente y revisar conectividad/configuración. |
| `501 Not Implemented` | La operación Nemo no aparece en la documentación disponible o su adaptador todavía no fue implementado. | Revisar el Excel del proveedor antes de añadir la operación. |
| `503 Service Unavailable` | Se solicitó una operación Nemo documentada, pero el proveedor está deshabilitado o no tiene token. | Configurar Nemo sólo cuando existan credenciales válidas. |

## Configuración para Nemo

Para llamar al proveedor real:

```dotenv
PORT=3000
NEMO_ENABLED=false
NEMO_BASE_URL=https://service-cert.psurfer.net/pricesurfer
NEMO_AUTH_TOKEN=
```

Después:

```text
POST http://localhost:3000/hotels/search?provider=nemo
```

El cliente de esta API no envía el token: el backend lo lee de `NEMO_AUTH_TOKEN` y lo transmite a Nemo en `X-PS-AUTHTOKEN`. No se debe guardar un token real en Git.

## Alcance actual

Los endpoints GET utilizan fixtures locales cuando `provider=mock`. La selección `provider=nemo` está preparada con respuestas explícitas `501` o `503`, pero todavía no ejecuta llamadas externas. Aunque `API_DOCUMENTATION.md` describe búsqueda, validación, cancelación y reserva en Nemo, no están implementadas rutas REST para validar tarifas, consultar penalizaciones, reservar, consultar reservas ni cancelarlas.
