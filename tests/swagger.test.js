const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
const { AppModule } = require('../dist/app.module');
const { BookHotelDto } = require('../dist/domain/dtos/book-hotel.dto');
const { CancelBookingDto } = require('../dist/domain/dtos/cancel-booking.dto');

const hotelRoutes = {
  '/hotels/search': ['post', 201, ['provider']],
  '/hotels/validate': ['post', 200, ['provider']],
  '/hotels/cancellation-fees': ['post', 200, ['provider']],
  '/hotels/catalog': ['get', 200, ['destinationCode', 'activeOnly', 'provider']],
  '/hotels/{hotelCode}/details': ['get', 200, ['language', 'provider']],
};
const catalogRoutes = ['room-types', 'board-types', 'amenity-groups', 'amenities', 'suppliers',
  'accommodation-types', 'booking-statuses', 'passenger-document-types', 'cancellation-fee-types', 'star-ratings'];
const systemRoutes = {
  '/health': ['get', 200, []],
  '/providers/status': ['get', 200, []],
};

test('Swagger generates all active paths, tags, query parameters and nested schemas', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    await app.init();
    const config = new DocumentBuilder()
      .setTitle('Hotel Provider Service API')
      .setDescription('Production-ready NestJS hotel provider service integrating with Nemo Group (Price Navigator) and offline Mock provider.')
      .setVersion('1.0.0').addTag('Hotels').addTag('Catalogs').addTag('System').build();
    const document = SwaggerModule.createDocument(app, config);
    assert.match(document.openapi, /^3\./);
    assert.deepEqual(document.tags.map(tag => tag.name), ['Hotels', 'Catalogs', 'System']);
    assert.deepEqual(Object.keys(document.paths).sort(), [
      ...Object.keys(hotelRoutes), ...catalogRoutes.map(route => `/catalogs/${route}`), ...Object.keys(systemRoutes),
    ].sort());
    for (const [path, [method, status, queries]] of Object.entries(hotelRoutes)) {
      const operation = document.paths[path][method];
      assert.deepEqual(operation.tags, ['Hotels']);
      assert(operation.summary);
      assert(operation.responses[status]);
      assert(operation.responses[400]);
      assert.deepEqual(operation.parameters.filter(param => param.in === 'query').map(param => param.name).sort(), queries.sort());
    }
    for (const [path, [method, status]] of Object.entries(systemRoutes)) {
      const operation = document.paths[path][method];
      assert.deepEqual(operation.tags, ['System']);
      assert(operation.summary);
      assert(operation.responses[status]);
    }
    for (const route of catalogRoutes) {
      const operation = document.paths[`/catalogs/${route}`].get;
      assert.deepEqual(operation.tags, ['Catalogs']);
      assert(operation.summary);
      assert(operation.responses[200]);
      if (['amenities', 'suppliers', 'accommodation-types'].includes(route)) {
        const expected = ['page', 'limit', 'sortOrder', 'search', 'codes'];
        if (route === 'amenities') expected.push('groupCode', 'groupCodes');
        assert.deepEqual(operation.parameters.map(param => param.name).sort(), expected.sort());
        assert(operation.parameters.every(param => param.required === false));
        assert(operation.responses[400]);
      }
    }
    const schemas = document.components.schemas;
    assert.equal(document.paths['/hotels/search'].post.requestBody.content['application/json'].schema.$ref, '#/components/schemas/SearchHotelsDto');
    assert.equal(schemas.SearchHotelsDto.properties.rooms.items.$ref, '#/components/schemas/SearchRoomDto');
    assert.equal(schemas.SearchHotelsDto.properties.passengers.items.$ref, '#/components/schemas/PassengerDto');
    assert(schemas.SearchHotelsDto.required.includes('destinationId'));
    assert(!schemas.SearchHotelsDto.required.includes('hotelName'));
    assert.deepEqual(schemas.PassengerDto.properties.ageType.enum, ['ADT', 'CHD', 'INF']);
    assert.equal(schemas.SearchHotelsDto.properties.checkIn.example, '2026-11-10');
    assert.equal(schemas.ValidateRateDto.properties.tripProductId.type, 'string');
    assert.equal(schemas.CancellationFeesDto.properties.tripProductId.type, 'string');
    assert.doesNotThrow(() => JSON.stringify(document));

    // Check prepared booking schemas without registering disabled HTTP routes.
    const withBookingSchemas = SwaggerModule.createDocument(app, config, { extraModels: [BookHotelDto, CancelBookingDto] });
    const bookingSchemas = withBookingSchemas.components.schemas;
    assert.equal(bookingSchemas.BookHotelDto.properties.rooms.items.$ref, '#/components/schemas/BookingRoomDto');
    assert.equal(bookingSchemas.BookingRoomDto.properties.guests.items.$ref, '#/components/schemas/BookingGuestDto');
    assert.equal(bookingSchemas.LeadPassengerDto.properties.email.type, 'string');
    assert.equal(bookingSchemas.CancelBookingDto.properties.reason.type, 'string');
    assert.deepEqual(Object.keys(withBookingSchemas.paths), Object.keys(document.paths));
  } finally {
    await app.close();
  }
});
