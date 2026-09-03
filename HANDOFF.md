# Project Handoff & Technical Summary: Hotel Provider Service

> **Actualización local:** el código fue reorganizado por funcionalidad bajo `src/modules/hotel` y `src/modules/health`. Se añadieron consultas GET de sólo lectura para salud, estado de proveedores y catálogo mock. Estas rutas no llaman a Nemo y no crean ni modifican información. Consulte `API_CONTRACT.md` para el contrato vigente.

## Actualización de entrega — 2026-09-03

### Cambios implementados

- La estructura anterior por capas globales fue migrada a módulos funcionales NestJS.
- Todo el dominio hotelero quedó agrupado en `src/modules/hotel`.
- La infraestructura Nemo quedó aislada en `src/modules/hotel/infrastructure/nemo`.
- Se creó `src/modules/health` para endpoints operativos.
- Se eliminaron archivos duplicados y sin referencias bajo `src/common`.
- Se agregó un repositorio de fixtures mock exclusivamente de lectura.

### Consultas disponibles

- `GET /health`
- `GET /providers/status`
- `GET /hotels/destinations`
- `GET /hotels/room-types`
- `GET /hotels/catalog`
- `GET /hotels/catalog/:hotelCode`

Todas usan Mock de manera predeterminada. Se puede indicar `provider=nemo`, pero la integración permanece bloqueada hasta contar con habilitación, credenciales y adaptadores verificados.

### Protección de la integración Nemo

- No se realizó ninguna llamada externa a Nemo durante esta entrega.
- `NEMO_ENABLED=false` es el valor recomendado mientras no exista API key.
- Catálogo y detalle Nemo devuelven `503` sin configuración y `501` mientras falte el adaptador.
- Destinos y tipos de habitación Nemo devuelven `501` porque esas operaciones no aparecen en la documentación disponible.
- Se dejaron comentarios `TODO(Nemo Excel)` para validar dichas operaciones contra el archivo oficial.

### Verificación

- Compilación TypeScript exitosa.
- Respuestas `200`, `400`, `404`, `501` y `503` verificadas según cada escenario.
- Contrato actualizado en `API_CONTRACT.md`.
- Estado consolidado en `PROGRESS.md`.

## 1. Contexto y Objetivos del Proyecto

El objetivo de este proyecto es construir un backend desacoplado, modular y fuertemente tipado en **NestJS** para integrar la API de inventario hotelero de **Price Navigator (Nemo Group)**.

El requerimiento principal exigido por liderazgo fue:
1. **Arquitectura en Capas**: Estructura visualmente intuitiva para que cualquier stakeholder técnico o directivo comprenda qué operaciones se ofrecen, cómo fluyen los datos y cómo se orquestan las reglas de negocio.
2. **Patrón Adapter**: Aislar por completo la complejidad de los mensajes XML de Nemo Group (tanto la serialización de peticiones como la deserialización y validación de respuestas).
3. **Patrón Strategy**: Permitir alternar dinámicamente entre proveedores de hoteles (e.g. proveedor real Nemo, proveedor Mock offline, y a futuro base de datos local o agregadores como Amadeus/Hotelbeds).
4. **Preparación para Workers**: Arquitectura lista para ejecutar tareas pesadas en segundo plano (workers/colas BullMQ) sin duplicar lógica de negocio.
5. **Restricciones Técnicas Estrictas**:
   - **Cero uso de `any`** en TypeScript.
   - **Sin tests** en esta fase inicial.
   - Dos estrategias operativas: **Endpoint Real** y **Mock para pruebas offline**.

---

## 2. Decisiones Técnicas y Justificación

### ¿Por qué NestJS?
- **Inyección de Dependencias (IoC / DI)**: Facilita enormemente el desacoplamiento requerido por el patrón Strategy. El controlador y el servicio no conocen los detalles de bajo nivel de Nemo; solo conocen la abstracción `HotelProviderStrategy`.
- **Preparación nativa para Workers**: NestJS soporta de forma transparente contextos independientes (`NestFactory.createApplicationContext`) y microservicios/colas (BullMQ/Redis) reutilizando los mismos módulos, adaptadores y estrategias que la API HTTP.
- **Validación Estricta sin `any`**: Integración de `class-validator` y `class-transformer` para garantizar que los DTOs entrantes cumplan el contrato de dominio antes de llegar al servicio.

### Patrón Adapter (`NemoXmlAdapter`)
- **Propósito**: Actuar como traductor bidireccional entre los objetos de dominio de TypeScript/JSON y los esquemas XML propietarios de Nemo Group.
- **Librería**: `fast-xml-parser` (sin dependencias pesadas y con soporte estricto de atributos y arrays).
- **Componentes**:
  - `NemoXmlBuilder`: Convierte el DTO de búsqueda en el XML `<AvailabilityQueryRQ>`.
  - `NemoXmlParser`: Transforma la respuesta `<AvailabilityQueryRS>` en modelos de dominio y detecta nodos de error/excepciones.
  - `NemoXmlAdapter`: Configura cabeceras obligatorias (`X-PS-AUTHTOKEN`, `Accept`, `Content-Type: application/xml`), invoca el endpoint vía Axios y mapea los errores de red.

### Patrón Strategy (`HotelProviderStrategy`)
- **Propósito**: Desacoplar el servicio de búsqueda de cualquier proveedor concreto.
- **Implementaciones**:
  1. `MockHotelStrategy`: Genera datos realistas de hoteles, tarifas, habitaciones y políticas de cancelación offline, sin consumir créditos ni saturar los rate-limits del proveedor.
  2. `NemoHotelStrategy`: Invoca el `NemoXmlAdapter` para conectar con el servidor real de Nemo Group (`https://service-cert.psurfer.net/pricesurfer`).
- **Resolución**: `HotelStrategyFactory` resuelve la estrategia según el parámetro de consulta `?provider=mock` o `?provider=nemo` (por defecto `mock`).

---

## 3. Incidentes, Errores Encontrados y Soluciones

Durante el desarrollo e investigación se resolvieron tres retos principales:

### Reto 1: Extracción de Documentación en Atlassian Confluence
- **Problema**: La URL de la documentación de Nemo Group provista era una Single Page Application (SPA) de Confluence que requería JavaScript para renderizar, por lo que las descargas HTTP estáticas solo devolvían el esqueleto inicial sin contenido.
- **Solución**: Se utilizó un navegador headless con Chrome DevTools Protocol (CDP) para esperar el ciclo de renderizado de React de Confluence y volcar toda la especificación técnica, códigos de error y esquemas XML a los archivos `API_DOCUMENTATION.md` y `ARCHITECTURE.md`.

### Reto 2: Fallo de Sintaxis al Copiar Comandos cURL en Terminal (zsh)
- **Problema**: Al ejecutar el comando cURL multilinea con barras invertidas (`\`), la terminal zsh de macOS quebró la línea tras el flag `-d`, resultando en:
  `curl: option -d: requires parameter` y `zsh: command not found: {"destinationId"...}`.
- **Solución**: Se simplificó la sintaxis a una sola línea sin espacios entre la bandera y el payload (`-d'{...}'`), evitando que la terminal interprete saltos de línea indeseados.

### Reto 3: Falso Positivo de Éxito en Nemo al no Enviar Token de Autenticación
- **Problema**: Al probar el endpoint real sin un token válido configurado, la API respondió con HTTP 200 y `{"totalItems":0,"hotels":[]}` en lugar de un error de autenticación.
- **Causa Raíz**: El servidor de certificación de Nemo Group no devuelve un código HTTP 401 a nivel de transporte ni utiliza la etiqueta estándar `<Errors>`. En su lugar, devuelve HTTP 200 con un XML que contiene:
  ```xml
  <AvailabilityQueryRS>
    <Exceptions>
      <Notification>
        <NotificationId>1000</NotificationId>
        <NotificationDetailedMessage>Exception: Error to locate configuration for token test_auth_token_here</NotificationDetailedMessage>
      </Notification>
    </Exceptions>
  </AvailabilityQueryRS>
  ```
  Como el parser solo buscaba la etiqueta `<Errors>`, no detectó el fallo y retornó un arreglo de hoteles vacío.
- **Solución**: Se actualizó `NemoXmlParser` para interceptar el nodo `<Exceptions><Notification>`. Al detectar que el mensaje corresponde a un fallo de credenciales/token, el parser lanza una excepción `UnauthorizedException` (HTTP 401) de NestJS con el detalle devuelto por Nemo.

---

## 4. Estructura del Proyecto

```text
hotel-provider-service/
├── API_DOCUMENTATION.md          # Especificación completa de la API de Nemo Group
├── ARCHITECTURE.md               # Documento arquitectónico formal para directivos
├── HANDOFF.md                    # Este documento de entrega y registro histórico
├── package.json                  # Dependencias y scripts (dev, build, start:dev)
├── tsconfig.json                 # Configuración TypeScript estricta (noImplicitAny: true)
├── .env                          # Variables de entorno locales
├── .env.example                  # Plantilla de variables de entorno
└── src/
    ├── domain/
    │   ├── dtos/
    │   │   └── search-hotels.dto.ts      # DTO validado con class-validator
    │   ├── models/
    │   │   └── hotel.model.ts            # Entidades de dominio tipadas (Hoteles, Tarifas)
    │   └── enums/
    │       ├── provider.enum.ts          # Enum ProviderType ('mock' | 'nemo')
    │       ├── room-type.enum.ts         # Enum de tipos de habitación Nemo
    │       └── passenger-age-type.enum.ts# Enum de tipos de pasajero (ADT, CHD, INF)
    ├── strategies/
    │   ├── hotel-provider.strategy.ts    # Interfaz común de la estrategia
    │   ├── mock-hotel.strategy.ts        # Estrategia de pruebas offline
    │   ├── nemo-hotel.strategy.ts        # Estrategia real conectada a Nemo
    │   └── hotel-strategy.factory.ts     # Factoría para resolver estrategias dinámicas
    ├── adapters/
    │   └── nemo/
    │       ├── nemo-xml.adapter.ts       # Orquestador de transporte HTTP y XML
    │       ├── nemo-xml.builder.ts       # Generador de <AvailabilityQueryRQ>
    │       ├── nemo-xml.parser.ts        # Parser de <AvailabilityQueryRS> y excepciones
    │       └── nemo-types.ts             # Interfaces TypeScript del XML (sin any)
    ├── services/
    │   └── hotel.service.ts              # Reglas de negocio y orquestación
    ├── controllers/
    │   └── hotel.controller.ts           # Controlador REST POST /hotels/search
    ├── modules/
    │   └── hotel.module.ts               # Módulo de NestJS con proveedores inyectados
    ├── app.module.ts                     # Módulo raíz de la aplicación
    └── main.ts                           # Punto de entrada y arranque de NestJS
```

---

## 5. Guía de Ejecución y Pruebas

### Levantar el servidor
```bash
cd ~/Documents/Programación/hotel-provider-service
npm run start:dev
# o también:
npm run dev
```
El servicio iniciará en `http://localhost:3000`.

### Probar Estrategia Mock (Offline)
```bash
curl -X POST "http://localhost:3000/hotels/search?provider=mock"   -H "Content-Type: application/json"   -d'{"destinationId":"2262","checkIn":"2026-10-15","checkOut":"2026-10-20","rooms":[{"roomSequence":1,"roomType":"NMO.HTL.RMT.DBL"}],"passengers":[{"roomSequence":1,"ageType":"ADT"},{"roomSequence":1,"ageType":"ADT"}]}'
```
**Resultado esperado**: HTTP 200 con lista de hoteles simulados (`Grand Hotel Plaza`, `Hotel Resort & Spa`) y tarifas calculadas.

### Probar Estrategia Real Nemo (Conectada a Nemo)
```bash
curl -X POST "http://localhost:3000/hotels/search?provider=nemo"   -H "Content-Type: application/json"   -d'{"destinationId":"2262","checkIn":"2026-10-15","checkOut":"2026-10-20","rooms":[{"roomSequence":1,"roomType":"NMO.HTL.RMT.DBL"}],"passengers":[{"roomSequence":1,"ageType":"ADT"},{"roomSequence":1,"ageType":"ADT"}]}'
```
**Resultado esperado**: 
- Con token inválido/prueba: HTTP 401 Unauthorized detallando el error de Nemo.
- Con token real en `.env` (`NEMO_AUTH_TOKEN`): HTTP 200 con los hoteles reales devueltos por Nemo.

---

## 6. Próximos Pasos Recomendados

1. **Configuración de Credenciales Reales**: Una vez firmado el contrato o entregadas las credenciales de Nemo Group, colocar el token en `.env` (`NEMO_AUTH_TOKEN`).
2. **Implementación de Operaciones Restantes del Ciclo de Reserva**:
   - Validación de Tarifa: `POST /catalog/product/validate`
   - Gastos de Cancelación: `POST /booking/cancellation/fees`
   - Creación de Reserva: `POST /catalog/product/book`
   - Detalle de Reserva: `POST /booking/detail`
3. **Integración con Workers**: Para consultas asíncronas de disponibilidad masiva, crear un procesador de cola BullMQ que inyecte `HotelStrategyFactory` para ejecutar búsquedas acumulativas (`TransactionMode="StartAsync"` y `"ContinueAsync"`) sin bloquear el hilo principal.
