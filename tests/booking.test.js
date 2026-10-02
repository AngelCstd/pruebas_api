const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, ServiceUnavailableException } = require('@nestjs/common');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { BookingApplicationService } = require('../dist/services/booking-application.service');
const { CareDirectoryService } = require('../dist/services/care-directory.service');
const { InMemoryBookingOperationRepository } = require('../dist/repositories/in-memory-booking-operation.repository');
const { InMemoryCareReservationRepository } = require('../dist/repositories/in-memory-care-reservation.repository');
const { MockHotelStrategy } = require('../dist/strategies/mock-hotel.strategy');
const { ProviderType } = require('../dist/domain/enums/provider.enum');
const { BookHotelDto } = require('../dist/domain/dtos/book-hotel.dto');
const { QueryClientsDto } = require('../dist/domain/dtos/query-clients.dto');
const { QueryPersonsDto } = require('../dist/domain/dtos/query-persons.dto');

const searchDto = {
  destinationId: '2262', checkIn: '2027-11-10', checkOut: '2027-11-13',
  rooms: [{ roomSequence: 1, roomType: 'NMO.HTL.RMT.DBL' }],
  passengers: [{ roomSequence: 1, ageType: 'ADT' }],
};

const clients = [
  { organizationId: 'org-z', name: 'Zulu', creditAccountId: 'crd-z', currency: 'MXN', creditStatus: 'ACTIVE', creditLimit: 50000, used: 1000, available: 49000 },
  { organizationId: 'org-a', name: 'Acme', creditAccountId: 'crd-a', currency: 'MXN', creditStatus: 'ACTIVE', creditLimit: 100000, used: 10000, available: 90000 },
];
const persons = [
  { personId: 'per-2', fullName: 'Beatriz Luna', email: 'bea@example.com', phone: null, organizationId: 'org-a' },
  { personId: 'per-1', fullName: 'Carlos Mendez', email: 'carlos@example.com', phone: '+5215512345678', organizationId: 'org-a' },
  { personId: 'per-z', fullName: 'Otro Cliente', email: 'otro@example.com', phone: null, organizationId: 'org-z' },
];

function bookingDto(tripProductId, clientReference = 'CLIENT-BOOK-1') {
  return {
    tenantId: 'tenant-a', clientOrganizationId: 'org-a', tripProductId, clientReference,
    leadPassenger: {
      title: 'MR', firstName: 'Carlos', lastName: 'Mendez',
      email: 'carlos@example.com', phone: '+5215512345678',
    },
    rooms: [{
      roomSequence: 1,
      guests: [{ title: 'MR', firstName: 'Carlos', lastName: 'Mendez', type: 'ADT' }],
    }],
  };
}

async function fixture(careOptions = {}) {
  const repository = new InMemoryBookingOperationRepository();
  const care = new InMemoryCareReservationRepository({ clients, persons, ...careOptions });
  const mock = new MockHotelStrategy(undefined);
  const unsupported = { bookHotel() { throw new Error('unsupported strategy must not be called'); } };
  const factory = { resolve(provider) { return provider === ProviderType.MOCK ? mock : unsupported; } };
  const service = new BookingApplicationService(factory, repository, care);
  const search = await mock.searchHotels(searchDto);
  return { repository, care, mock, service, dto: bookingDto(search.hotels[0].rates[0].tripProductId) };
}

function response(error) {
  const value = error.getResponse();
  return typeof value === 'object' ? value : { message: value };
}

test('happy booking holds credit, books provider, creates Care reservation and returns its ids', async () => {
  const { care, mock, service, dto } = await fixture();
  const order = [];
  const hold = care.holdCredit.bind(care);
  const create = care.createReservation.bind(care);
  const book = mock.bookHotel.bind(mock);
  care.holdCredit = async input => { order.push('hold'); return hold(input); };
  mock.bookHotel = async input => { order.push('provider'); return book(input); };
  care.createReservation = async input => { order.push('create'); return create(input); };

  const result = await service.bookHotel(dto, ProviderType.MOCK, 'booking-key-001');
  assert.deepEqual(order, ['hold', 'provider', 'create']);
  assert.equal(result.idempotentReplay, false);
  assert.equal(result.totalPrice.currency, 'MXN');
  assert.equal(result.reservation.serviceId, care.holds[0].tripServiceId);
  assert.equal(result.reservation.tripId.startsWith('trp_'), true);
  assert.equal(care.createdReservations[0].items, undefined);
  assert.deepEqual(care.createdReservations[0].offerSnapshot, { tripProductId: dto.tripProductId });
});

test('same-key replay returns the stored reservation without a second hold or provider call', async () => {
  const { care, mock, service, dto } = await fixture();
  const original = mock.bookHotel.bind(mock);
  let calls = 0;
  mock.bookHotel = async value => { calls += 1; return original(value); };
  const first = await service.bookHotel(dto, ProviderType.MOCK, 'booking-key-002');
  const reordered = { rooms: dto.rooms, tenantId: dto.tenantId, leadPassenger: dto.leadPassenger,
    clientReference: dto.clientReference, tripProductId: dto.tripProductId, clientOrganizationId: dto.clientOrganizationId };
  const replay = await service.bookHotel(reordered, ProviderType.MOCK, 'booking-key-002');
  assert.equal(replay.idempotentReplay, true);
  assert.deepEqual(replay.reservation, first.reservation);
  assert.equal(care.holds.length, 1);
  assert.equal(care.createdReservations.length, 1);
  assert.equal(calls, 1);
});

test('CREDIT_INSUFFICIENT returns details, skips provider and marks the operation FAILED', async () => {
  const holdResult = { ok: false, errorCode: 'CREDIT_INSUFFICIENT', message: 'Insufficient credit.', available: 200, requested: 500, currency: 'MXN' };
  const { care, mock, repository, service, dto } = await fixture({ holdResult });
  let providerCalls = 0;
  mock.bookHotel = async () => { providerCalls += 1; throw new Error('must not run'); };
  await assert.rejects(service.bookHotel(dto, ProviderType.MOCK, 'booking-key-003'), error => {
    assert.equal(error.getStatus(), 409);
    assert.deepEqual(response(error), { statusCode: 409, error: 'Conflict', message: 'Insufficient credit.', code: 'CREDIT_INSUFFICIENT', available: 200, requested: 500, currency: 'MXN' });
    return true;
  });
  assert.equal(providerCalls, 0);
  assert.equal(care.releases.length, 0);
  assert.equal((await repository.list(dto.tenantId, 50, 'FAILED'))[0].failureCode, 'CREDIT_INSUFFICIENT');
});

test('CURRENCY_MISMATCH returns 409 and never calls the provider', async () => {
  const { mock, repository, service, dto } = await fixture({
    holdResult: { ok: false, errorCode: 'CURRENCY_MISMATCH', message: 'Currency mismatch.', currency: 'USD' },
  });
  let called = false;
  mock.bookHotel = async () => { called = true; throw new Error('must not run'); };
  await assert.rejects(service.bookHotel(dto, ProviderType.MOCK, 'booking-key-004'), error => (
    error.getStatus() === 409 && response(error).code === 'CURRENCY_MISMATCH'
  ));
  assert.equal(called, false);
  assert.equal((await repository.list(dto.tenantId, 50, 'FAILED')).length, 1);
});

test('provider failure releases credit, marks FAILED and can retry with the same key', async () => {
  const { care, mock, repository, service, dto } = await fixture();
  const original = mock.bookHotel.bind(mock);
  let fail = true;
  mock.bookHotel = async value => {
    if (fail) { fail = false; throw new ServiceUnavailableException('Mock temporary failure.'); }
    return original(value);
  };
  await assert.rejects(service.bookHotel(dto, ProviderType.MOCK, 'booking-key-005'), error => error.getStatus() === 503);
  assert.equal(care.releases.length, 1);
  assert.equal((await repository.list(dto.tenantId, 50, 'FAILED')).length, 1);
  const retried = await service.bookHotel(dto, ProviderType.MOCK, 'booking-key-005');
  assert.equal(retried.idempotentReplay, false);
  assert.equal(care.holds.length, 2);
});

test('Care creation failures release credit, mark FAILED and map 404, 400 and 409', async () => {
  for (const [code, expectedStatus] of [['PERSON_NOT_FOUND', 404], ['INVALID_PAYLOAD', 400], ['PERSON_INCOMPLETE', 400], ['CLIENT_NOT_FOUND', 409]]) {
    const { care, repository, service, dto } = await fixture({ createResult: { ok: false, errorCode: code, message: `${code} message` } });
    await assert.rejects(service.bookHotel(dto, ProviderType.MOCK, `create-${code.toLowerCase()}`), error => (
      error.getStatus() === expectedStatus && response(error).code === code
    ));
    assert.equal(care.releases.length, 1, code);
    assert.equal((await repository.list(dto.tenantId, 50, 'FAILED'))[0].failureCode, code);
  }
});

test('PRICE_CHANGED is a 409 before holding credit', async () => {
  const { care, repository, service, dto } = await fixture();
  await assert.rejects(
    service.bookHotel({ ...dto, tripProductId: 'MOCK-PRICE-002' }, ProviderType.MOCK, 'booking-price-002'),
    error => error.getStatus() === 409 && response(error).code === 'PRICE_CHANGED',
  );
  assert.equal(care.holds.length, 0);
  assert.equal((await repository.list(dto.tenantId, 50, 'FAILED'))[0].failureCode, 'PRICE_CHANGED');
});

test('all mock rates, including MOCK-PRICE-002, keep their amounts and use MXN', async () => {
  const mock = new MockHotelStrategy(undefined);
  const search = await mock.searchHotels(searchDto);
  assert(search.hotels.flatMap(hotel => hotel.rates).every(rate => rate.currency === 'MXN'));
  const changed = await mock.validateRate({ tripProductId: 'MOCK-PRICE-002' });
  assert.deepEqual(changed.validatedPrice, { amount: 935, currency: 'MXN', priceChanged: true });
});

test('an existing lead person is resolved before credit, and a missing person returns 404', async () => {
  const valid = await fixture();
  const existing = { ...valid.dto, leadPassenger: { personId: 'per-1' }, rooms: [{ roomSequence: 1, guests: [{ personId: 'per-2' }] }] };
  const result = await valid.service.bookHotel(existing, ProviderType.MOCK, 'booking-person-001');
  assert.equal(result.reservation.serviceId, valid.care.holds[0].tripServiceId);
  assert.deepEqual(valid.care.createdReservations[0].lead, { personId: 'per-1' });
  assert.equal((await valid.repository.list(valid.dto.tenantId, 50))[0].leadPassengerName, 'Carlos Mendez');

  const missing = await fixture();
  await assert.rejects(
    missing.service.bookHotel({ ...missing.dto, leadPassenger: { personId: 'per-missing' } }, ProviderType.MOCK, 'booking-person-404'),
    error => error.getStatus() === 404 && response(error).code === 'PERSON_NOT_FOUND',
  );
  assert.equal(missing.care.holds.length, 0);
});

test('same idempotency key with different content conflicts and invalid keys return 400', async () => {
  const { service, dto } = await fixture();
  await service.bookHotel(dto, ProviderType.MOCK, 'booking-key-006');
  await assert.rejects(
    service.bookHotel({ ...dto, clientReference: 'OTHER' }, ProviderType.MOCK, 'booking-key-006'),
    error => error.getStatus() === 409 && response(error).code === 'IDEMPOTENCY_KEY_REUSED',
  );
  for (const key of [undefined, '', 'short', '-invalid-start']) {
    await assert.rejects(service.bookHotel(dto, ProviderType.MOCK, key), error => error.getStatus() === 400);
  }
});

test('convenio and nemo return 501, and all returns 400 before client validation', async () => {
  const { service, dto } = await fixture();
  const invalidClient = { ...dto, clientOrganizationId: '' };
  for (const provider of [ProviderType.CONVENIO, ProviderType.NEMO]) {
    await assert.rejects(service.bookHotel(invalidClient, provider, 'booking-key-007'), error => (
      error.getStatus() === 501 && response(error).code === 'BOOKING_NOT_ENABLED'
    ));
  }
  await assert.rejects(service.bookHotel(invalidClient, ProviderType.ALL, 'booking-key-007'), error => error.getStatus() === 400);
});

test('detail remains operation-backed and cancellation remains idempotent without changing Care', async () => {
  const { care, mock, service, dto } = await fixture();
  const booked = await service.bookHotel(dto, ProviderType.MOCK, 'booking-key-008');
  mock.getBookingDetail = async () => { throw new Error('fallback must not run'); };
  assert.equal((await service.getBookingDetail(booked.bookingLocator, ProviderType.MOCK, dto.tenantId)).bookingLocator, booked.bookingLocator);
  const originalCancel = mock.cancelBooking.bind(mock);
  let calls = 0;
  mock.cancelBooking = async (locator, body) => { calls += 1; return originalCancel(locator, body); };
  const first = await service.cancelBooking(booked.bookingLocator, { tenantId: dto.tenantId }, ProviderType.MOCK);
  assert.deepEqual(await service.cancelBooking(booked.bookingLocator, { tenantId: dto.tenantId }, ProviderType.MOCK), first);
  assert.equal(calls, 1);
  assert.equal((await care.listReservations(dto.tenantId, 50))[0].status, 'BOOKED');
});

test('Care booking list maps new fields, includes CANCELLED and returns no FAILED rows', async () => {
  const cancelled = {
    operationId: 'hbo-cancelled', provider: ProviderType.MOCK, status: 'CANCELLED', bookingLocator: 'LOC-C',
    supplierConfirmationCode: 'CONF-C', clientReference: '', hotelCode: 'H-C', hotelName: 'Hotel Cancelado',
    checkIn: '2027-12-01', checkOut: '2027-12-03', totalPrice: { amount: 1200, currency: 'MXN' },
    leadPassengerName: 'Beatriz Luna', createdAt: '2027-01-02T00:00:00.000Z', cancelledAt: null,
    clientName: 'Acme', tripId: 'trp-c', outstanding: 1200, dueAt: '2027-02-01',
  };
  const { service, dto } = await fixture({ reservations: [cancelled] });
  const all = await service.listBookings(ProviderType.MOCK, 50, undefined, dto.tenantId);
  assert.deepEqual(all.items[0], cancelled);
  assert.equal((await service.listBookings(ProviderType.MOCK, 50, 'CANCELLED', dto.tenantId)).items.length, 1);
  assert.equal((await service.listBookings(ProviderType.MOCK, 50, 'FAILED', dto.tenantId)).items.length, 0);
});

test('clients and persons list in name order and apply organization, search and limit', async () => {
  const care = new InMemoryCareReservationRepository({ clients, persons });
  const directory = new CareDirectoryService(care);
  assert.deepEqual((await directory.listClients('tenant-a')).items.map(item => item.name), ['Acme', 'Zulu']);
  assert.deepEqual((await directory.listPersons('tenant-a', 'org-a', 'EXAMPLE', 1)).items.map(item => item.fullName), ['Beatriz Luna']);
  assert.deepEqual((await directory.listPersons('tenant-a', 'org-z', undefined, 20)).items.map(item => item.personId), ['per-z']);
});

test('tenantId and organizationId are required and query limit is constrained to 1-50', async () => {
  const care = new InMemoryCareReservationRepository();
  const directory = new CareDirectoryService(care);
  await assert.rejects(directory.listClients(), error => error.message === 'tenantId is required');
  await assert.rejects(directory.listPersons('tenant-a'), error => error.message === 'organizationId is required');
  assert((await validate(plainToInstance(QueryClientsDto, {}))).length > 0);
  assert((await validate(plainToInstance(QueryPersonsDto, { tenantId: 'tenant-a' }))).length > 0);
  assert((await validate(plainToInstance(QueryPersonsDto, { tenantId: 'tenant-a', organizationId: 'org-a', limit: 51 }))).length > 0);
});

test('booking DTO accepts existing people, rejects mixed shapes and requires clientOrganizationId', async () => {
  const { dto } = await fixture();
  const validateDto = value => validate(plainToInstance(BookHotelDto, value), { whitelist: true, forbidNonWhitelisted: true });
  assert.equal((await validateDto(dto)).length, 0);
  assert.equal((await validateDto({ ...dto, leadPassenger: { personId: 'per-1' }, rooms: [{ roomSequence: 1, guests: [{ personId: 'per-2' }] }] })).length, 0);
  assert((await validateDto({ ...dto, leadPassenger: { personId: 'per-1', firstName: 'Mixed' } })).length > 0);
  assert((await validateDto({ ...dto, clientOrganizationId: undefined })).length > 0);
});

test('mock booking operations require tenantId', async () => {
  const { service, dto } = await fixture();
  const withoutTenant = { ...dto };
  delete withoutTenant.tenantId;
  await assert.rejects(service.bookHotel(withoutTenant, ProviderType.MOCK, 'booking-key-tenant'), error => error.message === 'tenantId is required');
  await assert.rejects(service.getBookingDetail('UNKNOWN', ProviderType.MOCK), error => error.message === 'tenantId is required');
  await assert.rejects(service.cancelBooking('UNKNOWN', {}, ProviderType.MOCK), error => error.message === 'tenantId is required');
  await assert.rejects(service.listBookings(ProviderType.MOCK, 50), error => error.message === 'tenantId is required');
});

test('if closing the operation fails AFTER the Care reservation exists, credit is kept and the operation is not marked FAILED', async () => {
  const { care, repository, service, dto } = await fixture();
  repository.markBooked = async () => { throw new Error('operation store went down'); };

  await assert.rejects(service.bookHotel(dto, ProviderType.MOCK, 'booking-key-closing'), /operation store went down/);

  assert.equal(care.createdReservations.length, 1);   // la reserva y su cargo sí existen en Care
  assert.equal(care.releases.length, 0);              // el crédito NO se libera: habría un cargo sin crédito retenido
  const stored = [...repository.operations.get(dto.tenantId).values()].find((item) => item.idempotencyKey === 'booking-key-closing');
  assert.ok(stored);
  assert.notEqual(stored.status, 'FAILED'); // no se marca FAILED: un reintento no debe duplicar la reserva
});
