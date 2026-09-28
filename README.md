# Hotel Provider Service

## Interactive API documentation

Start the service with `npm run start:dev`, then open [Swagger UI](http://localhost:3000/api/docs). The OpenAPI JSON is available at `http://localhost:3000/api/docs-json`. Use the configured `PORT` when it differs from 3000.

The UI groups all 15 active endpoints under **Hotels** and **Catalogs**, with query parameters, request schemas, examples, and response statuses. Use **Try it out** with `provider=mock` for offline hotel requests; Nemo requests require supplier configuration. Search returns HTTP 201; the other active operations return HTTP 200 on success. Commented booking handlers remain disabled and are excluded from the specification.

Swagger is configured in `src/main.ts`; controllers and DTOs own HTTP documentation metadata. Services, provider strategies, and XML adapters retain their existing responsibilities. `tests/swagger.test.js` verifies document generation, routes, tags, and nested request schemas without contacting a supplier.

> [!IMPORTANT]
> **Nemo rate limit: 10 requests / 10 seconds.**
> All upstream operations against Nemo Group (Price Navigator), including hotel search, rate validation, cancellation fees, booking detail, and cancellation, share this strict budget per `X-PS-AUTHTOKEN`. Coordinate callers across service instances; retries also consume requests. Provide shared rate throttling before activating live production traffic.

Backend microservice built in **NestJS** and **TypeScript** to search, validate, and orchestrate hotel inventory across upstream travel wholesalers, specifically integrating with **Nemo Group (Price Navigator)**.

---

## Architecture & Design Patterns

1. **Strategy Pattern (`HotelProviderStrategy`)**:
   - `MockHotelStrategy`: In-memory fixtures with 30-minute state retention, realistic price drift, and cancellation penalty calculation for offline development.
   - `NemoHotelStrategy`: Connects directly to Nemo Group via HTTPS XML.
   - Dynamic selection via query param: `?provider=mock` (default) or `?provider=nemo`.
2. **Adapter Pattern (`NemoXmlAdapter`)**:
   - Encapsulates XML building (`NemoXmlBuilder`) and parsing (`NemoXmlParser`) for Price Navigator schemas.
   - Strongly-typed domain models with **zero explicit `any`**.
3. **Repository Pattern for Master Catalogs (`ICatalogRepository`)**:
   - Decoupled data access behind `CATALOG_REPOSITORY` token.
   - `LocalCatalogRepository` loads in-memory seed CSVs (`database/seeds/`) for offline execution.
   - Ready to swap with `PrismaCatalogRepository` for PostgreSQL persistence.

---

## Available REST Endpoints

### 1. Master Catalogs (`/catalogs/*`)
Returns domain code tables and dictionaries. Large catalogs support pagination (`page`, `limit`), sorting (`sortOrder`), and multi-criteria filters (`search`, `codes`, `groupCode`, `groupCodes`):

* `GET /catalogs/room-types`: Standard room types (`SGL`, `DBL`, `TPL`, `QUA`, etc.) and max adult capacities.
* `GET /catalogs/board-types`: Meal plan regimes (`1: Room Only`, `2: Bed & Breakfast`, `7: All Inclusive`, etc.).
* `GET /catalogs/amenity-groups`: The 14 main amenity categories (`SER`, `BCH`, `FCL`, `SPO`, `CAT`, etc.).
* `GET /catalogs/amenities`: 895 hotel amenities with text, group, and code filtering.
* `GET /catalogs/suppliers`: 378 wholesale inventory providers (Hotelbeds, Expedia, Webbeds, etc.).
* `GET /catalogs/accommodation-types`: 95 property categories (Hotel, Resort, Apartahotel, Boutique, etc.).
* `GET /catalogs/booking-statuses`: Lifecycle booking states (`CONFIRMED`, `CANCELLED`, `PENDING`, etc.).
* `GET /catalogs/passenger-document-types`: Legal guest documents (`DNI`, `PASSPORT`, `CEDULA`, `VISA`).
* `GET /catalogs/cancellation-fee-types`: Cancellation penalty categories (`CANCELLATION`, `NO_SHOW`, `MODIFICATION`).
* `GET /catalogs/star-ratings`: Decimal star rating conversion matrix (1.0 to 6.0).

### 2. Live Hotel Search & Lifecycle Operations (`/hotels/*`)
* `POST /hotels/search?provider=mock|nemo`: Real-time availability search. Accepts destination, dates, rooms, passenger breakdowns, and rich filters (`hotelName`, `minRating`, `maxRating`, `ratings`, `boardTypes`, `hotelCodeList`).
* `POST /hotels/validate?provider=mock|nemo`: Pre-checkout price stability and live availability verification.
* `POST /hotels/cancellation-fees?provider=mock|nemo`: Cancellation penalty schedules, free cancellation deadlines, and monetary fees.
* `GET /hotels/:hotelCode/details?provider=mock|nemo&language=es`: Rich hotel details, descriptions, check-in/out policies, amenities, and image gallery.
* `GET /hotels/catalog?destinationCode=2262&activeOnly=true&provider=mock|nemo`: Master property catalog for a destination.

### 3. Prepared Booking & Post-Sale Handlers (Intentionally Disabled / Commented)
To safeguard against accidental executions before production credentials and credit limits are activated, the following routes are fully implemented across DTOs, Strategies, and XML Adapters, but remain **commented out in [`hotel.controller.ts`](file:///Users/angelcstd/Documents/Programación/hotel-provider-service/src/controllers/hotel.controller.ts)**:
* `POST /hotels/book`: Booking creation and guest roster submission.
* `GET /hotels/bookings/:locator`: Booking retrieval, voucher URL, and current status.
* `POST /hotels/bookings/:locator/cancel`: Live booking cancellation and penalty application.

---

## Getting Started

### Prerequisites
* Node.js v18+
* npm

### Installation
```bash
npm install
```

### Running Locally
```bash
# Development mode with hot-reload
npm run dev

# Production build
npm run build
npm run start
```

### Running Automated Tests
```bash
npm test
```
Runs 11 test suites covering route validation, XML builders/parsers, CSV parsing, and AST checks ensuring zero explicit `any`.
