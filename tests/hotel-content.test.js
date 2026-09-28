const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IncomingMessage, ServerResponse } = require('node:http');
const { Duplex } = require('node:stream');
const axios = require('axios');
const { once } = require('node:events');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/app.module');
const { NemoXmlParser } = require('../dist/adapters/nemo/nemo-xml.parser');
const { XMLParser } = require('fast-xml-parser');
const fs = require('node:fs');

const validation = '<AvailabilityValidationRS Status="Success"><TripProductID>NEW-ID</TripProductID><ValidatedPrice Amount="850.00" Currency="EUR" PriceChanged="false"/><AvailabilityStatus>Confirmed</AvailabilityStatus><RateStatus>Available</RateStatus></AvailabilityValidationRS>';
const fees = '<CancellationFeesQueryRS Status="Success"><TripProductID>NEW-ID</TripProductID><Currency>EUR</Currency><FreeCancellationDeadline>2026-11-10T23:59:59Z</FreeCancellationDeadline><FeeSchedule><Tier StartDate="2026-11-11T00:00:00Z" FeeAmount="170.00" PenaltyPercentage="20.00"/></FeeSchedule></CancellationFeesQueryRS>';


const documentation = fs.readFileSync('API_DOCUMENTATION.md', 'utf8');
const xmlExample = root => documentation.match(new RegExp(`<${root} [\\s\\S]*?</${root}>`))[0];
const detailXml = xmlExample('AdditionalInfoQueryRS');
const catalogXml = xmlExample('HotelCatalogQueryRS');
const bookingXml = xmlExample('BookingProductsRS');

test('hotel details and catalog HTTP routes and disabled booking', async () => {
  let upstreamBody = validation;
  let upstreamStatus = 200;
  const received = [];
  const originalPost = axios.default.post;
  axios.default.post = async (url, body, options) => {
    received.push({ path: new URL(url).pathname, body, token: options.headers['X-PS-AUTHTOKEN'] });
    if (upstreamStatus !== 200) throw new axios.AxiosError('upstream failure', 'ERR_BAD_RESPONSE', undefined, undefined, { status: upstreamStatus });
    return { data: upstreamBody };
  };
  const oldUrl = process.env.NEMO_BASE_URL;
  process.env.NEMO_BASE_URL = 'https://nemo.test';
  const oldToken = process.env.NEMO_AUTH_TOKEN;
  process.env.NEMO_AUTH_TOKEN = 'test-token';
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  try {
    await app.init();
    const base = 'http://in-process';
    const fetch = async (url, options = {}) => {
      const data = options.body || '';
      const socket = new Duplex({ read() {}, write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
      const chunks = [];
      const req = new IncomingMessage(socket);
      req.httpVersion = '1.1';
      req.httpVersionMajor = 1;
      req.httpVersionMinor = 1;
      req.method = options.method || 'GET';
      req.url = url.replace(base, '');
      req.headers = { ...options.headers, 'content-length': String(Buffer.byteLength(data)) };
      const res = new ServerResponse(req);
      res.assignSocket(socket);
      const finished = once(res, 'finish');
      app.getHttpAdapter().getInstance().handle(req, res);
      req.complete = true;
      req.push(Buffer.from(data));
      req.push(null);
      await finished;
      const raw = Buffer.concat(chunks).toString();
      const body = raw.slice(raw.indexOf('\r\n\r\n') + 4);
      return { status: res.statusCode, json: async () => JSON.parse(body) };
    };
    const post = async (path, body) => {
      const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    for (const provider of ['', '&provider=mock']) {
      const catalog = await (await fetch(`${base}/hotels/catalog?destinationCode=2262${provider}`)).json();
      assert.equal(catalog.hotelCount, 2);
      const details = await (await fetch(`${base}/hotels/${catalog.hotels[0].hotelCode}/details?language=es${provider}`)).json();
      assert.equal(details.hotelCode, catalog.hotels[0].hotelCode);
      assert(details.amenities.length >= 4);
      assert(details.images.every(image => image.url.startsWith('https://')));
    }
    assert.equal((await (await fetch(`${base}/hotels/catalog?destinationCode=2262&activeOnly=false`)).json()).hotelCount, 3);
    for (const query of ['', 'destinationCode=', 'destinationCode=x&activeOnly=1', 'destinationCode=x&activeOnly=false&activeOnly=true', 'destinationCode=x&provider=invalid', 'destinationCode=x&extra=true']) {
      assert.equal((await fetch(`${base}/hotels/catalog?${query}`)).status, 400, query);
    }
    for (const query of ['language=', 'language=es&language=en', 'provider=invalid', 'extra=true']) {
      assert.equal((await fetch(`${base}/hotels/MOCK-2262-001/details?${query}`)).status, 400, query);
    }
    assert.equal((await fetch(`${base}/hotels/missing/details`)).status, 404);
    assert.equal((await post('/hotels/book', {})).status, 404);
    upstreamBody = detailXml;
    let result = await fetch(`${base}/hotels/MAD00123/details?provider=nemo&language=en`);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).amenities[0].name, 'Spa & Wellness Centre');
    assert.equal(received.at(-1).path, '/catalog/product/detail');
    assert.equal(received.at(-1).token, 'test-token');
    assert.equal(new XMLParser().parse(received.at(-1).body).AdditionalInfoQueryRQ.LanguageCode, 'en');
    upstreamBody = catalogXml;
    result = await fetch(`${base}/hotels/catalog?destinationCode=2262&activeOnly=false&provider=nemo`);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).hotels[0].longitude, -3.690831);
    assert.equal(received.at(-1).path, '/catalog/hotels/list');
    assert.equal(new XMLParser().parse(received.at(-1).body).HotelCatalogQueryRQ.ActiveOnly, false);
    for (const route of ['/hotels/MAD00123/details?provider=nemo', '/hotels/catalog?destinationCode=2262&provider=nemo']) {
      upstreamBody = '<broken';
      assert.equal((await fetch(base + route)).status, 502);
      upstreamBody = '<ErrorRS><Error Code="401" Message="unauthorized"/></ErrorRS>';
      assert.equal((await fetch(base + route)).status, 401);
    }
  } finally {
    await app.close();
    axios.default.post = originalPost;
    if (oldUrl === undefined) delete process.env.NEMO_BASE_URL; else process.env.NEMO_BASE_URL = oldUrl;
    if (oldToken === undefined) delete process.env.NEMO_AUTH_TOKEN; else process.env.NEMO_AUTH_TOKEN = oldToken;
  }
});


test('content XML parsing handles collections and rejects corrupt responses', () => {
  const parser = new NemoXmlParser();
  assert.equal(parser.parseHotelDetailsResponse(detailXml).amenities.length, 4);
  assert.equal(parser.parseHotelDetailsResponse(detailXml.replace(/<Amenities>[\s\S]*?<\/Amenities>/, '<Amenities/>')).amenities.length, 0);
  assert.equal(parser.parseHotelDetailsResponse(detailXml.replace(/<Images>[\s\S]*?<\/Images>/, '')).images.length, 0);
  assert.equal(parser.parseHotelCatalogResponse(catalogXml).hotelCount, 1);
  assert.equal(parser.parseHotelCatalogResponse(catalogXml.replace(/<Hotels>[\s\S]*?<\/Hotels>/, '<Hotels/>').replace('<HotelCount>1', '<HotelCount>0')).hotelCount, 0);
  for (const invalid of [catalogXml.replace('40.443912', 'NaN'), catalogXml.replace('40.443912', '91'), catalogXml.replace('<HotelCount>1', '<HotelCount>2')]) {
    assert.throws(() => parser.parseHotelCatalogResponse(invalid));
  }
  assert.throws(() => parser.parseHotelDetailsResponse(detailXml.replace('15:00', '25:00')));
  assert.throws(() => parser.parseHotelDetailsResponse(detailXml.replace('https://cdn.psurfer.net/hotels/MAD00123/exterior_01.jpg', 'javascript:alert(1)')));
  assert.equal(parser.parseBookingResponse(bookingXml).totalPrice.amount, 850);
  assert.throws(() => parser.parseBookingResponse(bookingXml.replace('850.00', '-1')));
});

test('booking DTO validates nested guests and XML builder escapes user values', async () => {
  const { plainToInstance } = require('class-transformer');
  const { validate } = require('class-validator');
  const { BookHotelDto } = require('../dist/domain/dtos/book-hotel.dto');
  const { NemoXmlBuilder } = require('../dist/adapters/nemo/nemo-xml.builder');
  const dto = { tripProductId: 'ID<&"', clientReference: 'CLIENT-1',
    leadPassenger: { title: 'MR', firstName: 'Carlos', lastName: 'Mendez', email: 'carlos@example.com', phone: '+34611223344' },
    rooms: [{ roomSequence: 1, guests: [{ title: 'CHD', firstName: 'Mateo', lastName: 'Mendez', type: 'CHD', age: 8 }] }] };
  const errors = value => validate(plainToInstance(BookHotelDto, value), { whitelist: true, forbidNonWhitelisted: true });
  assert.equal((await errors(dto)).length, 0);
  for (const patch of [{ leadPassenger: null }, { rooms: [] }, { rooms: [dto.rooms[0], dto.rooms[0]] }, { clientReference: '   ' }, { leadPassenger: { ...dto.leadPassenger, email: 'bad' } },
    { rooms: [{ roomSequence: 1, guests: [{ ...dto.rooms[0].guests[0], age: undefined }] }] }]) {
    assert((await errors({ ...dto, ...patch })).length > 0);
  }
  const xml = new NemoXmlBuilder().buildBookingRequest(dto, 'TX');
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml).BookingProductsRQ;
  assert.equal(parsed.TripProductID, dto.tripProductId);
  assert.equal(parsed.Rooms.Room.Guests.Guest['@_Age'], '8');
  assert.equal(parsed.PaymentDetails['@_Method'], 'CreditLimit');
  const details = new XMLParser().parse(new NemoXmlBuilder().buildHotelDetailsRequest('H<&', {}, 'TX'));
  assert.equal(details.AdditionalInfoQueryRQ.HotelCode, 'H<&');
  assert.equal(details.AdditionalInfoQueryRQ.LanguageCode, 'es');
});
