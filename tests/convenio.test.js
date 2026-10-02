const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HttpException, NotFoundException, ServiceUnavailableException } = require('@nestjs/common');
const { ConvenioHotelStrategy } = require('../dist/strategies/convenio-hotel.strategy');
const { CompositeHotelStrategy } = require('../dist/strategies/composite-hotel.strategy');
const { normalizeCityKey } = require('../dist/repositories/convenio-hotel.repository.interface');
const { ProviderType } = require('../dist/domain/enums/provider.enum');

function hotel(overrides = {}) {
  return {
    supplierId: 'sup_mia_h_1',
    legacyId: '1',
    hotelName: 'Hotel Convenio Cancun',
    rating: 4,
    address: { street: 'Blvd. Kukulcan', city: 'Cancún', state: 'Quintana Roo', postalCode: '77500', countryCode: 'MX' },
    latitude: 21.1,
    longitude: -86.8,
    description: 'Hotel de prueba',
    photoUrls: ['https://example.com/1.jpg'],
    agreementExpiresAt: '2027-12-31',
    currency: 'MXN',
    ratePerNight: 1500,
    rateIncludesTax: null,
    breakfastIncluded: false,
    breakfastPrice: null,
    availabilityNotes: null,
    bookingNotes: null,
    ...overrides,
  };
}

function repository(hotels, calls = []) {
  return {
    async findByCity(_tenantId, cityKey) { calls.push(cityKey); return hotels; },
    async findBySupplierId(_tenantId, id) { return hotels.find((item) => item.supplierId === id) ?? null; },
  };
}

const destinations = (city) => ({
  async findById() { return city === null ? null : { destinationId: '2262', languageId: 'es', city, state: null, stateId: null, country: 'México', countryId: 'MX', label: city }; },
  async search() { return []; },
});

const dto = {
  tenantId: 'tenant-a',
  destinationId: '2262', checkIn: '2026-11-10', checkOut: '2026-11-13',
  rooms: [{ roomSequence: 1, roomType: 'NMO.HTL.RMT.DBL' }, { roomSequence: 2, roomType: 'NMO.HTL.RMT.DBL' }],
  passengers: [{ ageType: 'ADT', roomSequence: 1 }, { ageType: 'ADT', roomSequence: 2 }],
};

test('normalizeCityKey removes accents and case', () => {
  assert.equal(normalizeCityKey('  Cancún '), 'cancun');
  assert.equal(normalizeCityKey('MÉRIDA'), 'merida');
  assert.equal(normalizeCityKey('Año Nuevo'), 'ano nuevo');
});

test('convenio search resolves the destination city and prices nights x rooms x rate', async () => {
  const calls = [];
  const strategy = new ConvenioHotelStrategy(repository([hotel()], calls), destinations('Cancún'));
  const result = await strategy.searchHotels(dto);
  assert.deepEqual(calls, ['cancun']);
  assert.equal(result.provider, ProviderType.CONVENIO);
  assert.equal(result.totalItems, 1);
  const found = result.hotels[0];
  assert.equal(found.hotelCode, 'CNV-sup_mia_h_1');
  assert.equal(found.source, ProviderType.CONVENIO);
  const rate = found.rates[0];
  assert.equal(rate.amount, 1500 * 2 * 3);
  assert.equal(rate.currency, 'MXN');
  assert.equal(rate.bookable, false);
  assert.equal(rate.bookableReason, 'PENDING_OPERATIONS');
  assert.equal(rate.bookingNote, 'Reserva pendiente: la confirma Operaciones.');
  assert.equal(rate.roomRates.length, 2);
  assert.equal(rate.roomRates[0].boardCode, 'RO');
  assert.equal(rate.cancellationPolicy.refundable, false);
  assert.ok(rate.cancellationPolicy.note);
  assert.equal(rate.tripProductId, 'CNV~sup_mia_h_1~2026-11-10~2026-11-13~2');
});

test('convenio search excludes expired agreements, missing rates and filtered hotels', async () => {
  const strategy = new ConvenioHotelStrategy(repository([
    hotel({ supplierId: 'a', agreementExpiresAt: '2026-11-09' }),   // vence antes de la llegada
    hotel({ supplierId: 'b', agreementExpiresAt: null }),            // sin vigencia registrada
    hotel({ supplierId: 'c', ratePerNight: null }),                  // sin tarifa
    hotel({ supplierId: 'd', hotelName: 'Otro', rating: 2 }),
    hotel({ supplierId: 'e', agreementExpiresAt: '2026-11-10' }),   // vence el día de la llegada: vale
  ]), destinations('Cancún'));
  const all = await strategy.searchHotels(dto);
  assert.deepEqual(all.hotels.map((item) => item.hotelCode).sort(), ['CNV-d', 'CNV-e']);
  const filtered = await strategy.searchHotels({ ...dto, minRating: 3 });
  assert.deepEqual(filtered.hotels.map((item) => item.hotelCode), ['CNV-e']);
  const byName = await strategy.searchHotels({ ...dto, hotelName: 'otro' });
  assert.deepEqual(byName.hotels.map((item) => item.hotelCode), ['CNV-d']);
});

test('convenio marks breakfast hotels as bed and breakfast', async () => {
  const strategy = new ConvenioHotelStrategy(repository([hotel({ breakfastIncluded: true })]), destinations('Cancún'));
  const result = await strategy.searchHotels(dto);
  assert.equal(result.hotels[0].rates[0].roomRates[0].boardCode, 'BB');
  const none = await strategy.searchHotels({ ...dto, boardTypes: ['1'] });
  assert.equal(none.totalItems, 0);
});

test('convenio search returns no hotels when the destination cannot be resolved', async () => {
  const calls = [];
  const strategy = new ConvenioHotelStrategy(repository([hotel()], calls), destinations(null));
  const result = await strategy.searchHotels(dto);
  assert.equal(result.totalItems, 0);
  assert.deepEqual(calls, []);
  const noRepo = new ConvenioHotelStrategy(repository([hotel()], calls), undefined);
  assert.equal((await noRepo.searchHotels(dto)).totalItems, 0);
});

test('convenio validate re-prices from the catalog and rejects unknown or expired rates', async () => {
  const strategy = new ConvenioHotelStrategy(repository([hotel()]), destinations('Cancún'));
  const search = await strategy.searchHotels(dto);
  const validated = await strategy.validateRate({ tenantId: dto.tenantId, tripProductId: search.hotels[0].rates[0].tripProductId });
  assert.equal(validated.validatedPrice.amount, 9000);
  assert.equal(validated.validatedPrice.priceChanged, false);
  assert.equal(validated.availabilityStatus, 'Confirmed');
  await assert.rejects(strategy.validateRate({ tenantId: dto.tenantId, tripProductId: 'CNV~nope~2026-11-10~2026-11-13~1' }), NotFoundException);
  await assert.rejects(strategy.validateRate({ tenantId: dto.tenantId, tripProductId: 'garbage' }), NotFoundException);
  const expired = new ConvenioHotelStrategy(repository([hotel({ agreementExpiresAt: '2026-01-01' })]), destinations('Cancún'));
  await assert.rejects(expired.validateRate({ tenantId: dto.tenantId, tripProductId: 'CNV~sup_mia_h_1~2026-11-10~2026-11-13~1' }), NotFoundException);
});

test('convenio details and catalog map the catalog hotel', async () => {
  const strategy = new ConvenioHotelStrategy(repository([hotel()]), destinations('Cancún'));
  const details = await strategy.getHotelDetails('CNV-sup_mia_h_1', { tenantId: dto.tenantId });
  assert.equal(details.description, 'Hotel de prueba');
  assert.equal(details.images[0].url, 'https://example.com/1.jpg');
  await assert.rejects(strategy.getHotelDetails('MOCK-1', { tenantId: dto.tenantId }), NotFoundException);
  const catalog = await strategy.getHotelCatalog({ tenantId: dto.tenantId, destinationCode: '2262' });
  assert.equal(catalog.hotelCount, 1);
  assert.equal(catalog.hotels[0].hotelCode, 'CNV-sup_mia_h_1');
});

test('convenio booking is not enabled yet', async () => {
  const strategy = new ConvenioHotelStrategy(repository([]), undefined);
  await assert.rejects(strategy.bookHotel({}), error => {
    assert.equal(error.getStatus(), 501);
    assert.equal(error.getResponse().code, 'BOOKING_NOT_ENABLED');
    return true;
  });
});

function fakeExternal(hotels, fail) {
  const search = async () => {
    if (fail) throw new ServiceUnavailableException('external down');
    return { transactionId: 'X', provider: 'mock', totalItems: hotels.length, hotels };
  };
  return {
    searchHotels: search,
    validateRate: async (value) => ({ via: 'external', value }),
    getCancellationFees: async (value) => ({ via: 'external', value }),
    getHotelDetails: async (code) => ({ via: 'external', code }),
    getHotelCatalog: async () => ({ destinationCode: '2262', destinationName: 'Cancún', hotelCount: hotels.length, hotels: [] }),
  };
}

const externalHotel = { hotelCode: 'MOCK-2262-001', hotelName: 'Mock Hotel', rating: 5, address: {}, rates: [] };

test('combined search merges convenio first, tags sources and reports status', async () => {
  const convenio = new ConvenioHotelStrategy(repository([hotel()]), destinations('Cancún'));
  const composite = new CompositeHotelStrategy(fakeExternal([externalHotel]), fakeExternal([]), convenio);
  const result = await composite.searchHotels(dto);
  assert.equal(result.provider, ProviderType.ALL);
  assert.deepEqual(result.hotels.map((item) => [item.hotelCode, item.source]), [
    ['CNV-sup_mia_h_1', ProviderType.CONVENIO],
    ['MOCK-2262-001', ProviderType.MOCK],
  ]);
  assert.deepEqual(result.sources.map((entry) => [entry.source, entry.status, entry.hotels]), [
    [ProviderType.CONVENIO, 'OK', 1],
    [ProviderType.MOCK, 'OK', 1],
  ]);
});

test('combined search survives one failing source and fails only when all fail', async () => {
  const failingRepo = { async findByCity() { throw new ServiceUnavailableException('not configured'); }, async findBySupplierId() { return null; } };
  const convenioDown = new ConvenioHotelStrategy(failingRepo, destinations('Cancún'));
  const partial = await new CompositeHotelStrategy(fakeExternal([externalHotel]), fakeExternal([]), convenioDown).searchHotels(dto);
  assert.equal(partial.totalItems, 1);
  assert.deepEqual(partial.sources.map((entry) => entry.status), ['ERROR', 'OK']);
  assert.match(partial.sources[0].message, /not configured/);

  await assert.rejects(
    new CompositeHotelStrategy(fakeExternal([], true), fakeExternal([]), convenioDown).searchHotels(dto),
    (error) => error instanceof HttpException,
  );
});

test('combined routing sends convenio ids to convenio and the rest to the external provider', async () => {
  const convenio = new ConvenioHotelStrategy(repository([hotel()]), destinations('Cancún'));
  const mock = fakeExternal([]);
  const composite = new CompositeHotelStrategy(mock, fakeExternal([]), convenio);
  const viaConvenio = await composite.validateRate({ tenantId: dto.tenantId, tripProductId: 'CNV~sup_mia_h_1~2026-11-10~2026-11-13~1' });
  assert.equal(viaConvenio.provider, ProviderType.CONVENIO);
  const viaMock = await composite.validateRate({ tripProductId: 'MOCK_TRIP_123' });
  assert.deepEqual(viaMock, { via: 'external', value: { tripProductId: 'MOCK_TRIP_123' } });
  const details = await composite.getHotelDetails('CNV-sup_mia_h_1', { tenantId: dto.tenantId });
  assert.equal(details.hotelCode, 'CNV-sup_mia_h_1');
  assert.throws(() => composite.bookHotel({}), { name: 'BadRequestException' });
});

test('convenio requires tenantId and combined search degrades to mock without it', async () => {
  const convenio = new ConvenioHotelStrategy(repository([hotel()]), destinations('Cancún'));
  const withoutTenant = { ...dto };
  delete withoutTenant.tenantId;
  await assert.rejects(
    convenio.searchHotels(withoutTenant),
    error => error.getStatus() === 400 && error.message === 'tenantId is required',
  );
  const composite = new CompositeHotelStrategy(fakeExternal([externalHotel]), fakeExternal([]), convenio);
  const result = await composite.searchHotels(withoutTenant);
  assert.deepEqual(result.hotels.map((item) => item.hotelCode), ['MOCK-2262-001']);
  assert.deepEqual(result.sources.map((entry) => [entry.source, entry.status, entry.message]), [
    [ProviderType.CONVENIO, 'ERROR', 'tenantId is required'],
    [ProviderType.MOCK, 'OK', undefined],
  ]);
});

test('convenio reports taxesIncluded from the catalog and omits it when unknown', async () => {
  const withTax = new ConvenioHotelStrategy(repository([hotel({ rateIncludesTax: true })]), destinations('Cancún'));
  const included = await withTax.searchHotels({ ...dto, tenantId: 'tnt_test' });
  assert.equal(included.hotels[0].rates[0].taxesIncluded, true);

  const unknown = new ConvenioHotelStrategy(repository([hotel({ rateIncludesTax: null })]), destinations('Cancún'));
  const omitted = await unknown.searchHotels({ ...dto, tenantId: 'tnt_test' });
  assert.equal('taxesIncluded' in omitted.hotels[0].rates[0], false);
});
