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

test('catalog and lifecycle HTTP routes, including Nemo XML transport', async () => {
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
    for (const [route, count] of Object.entries({ 'room-types': 12, 'board-types': 9, 'amenity-groups': 14, amenities: 895, suppliers: 378, 'accommodation-types': 95, 'booking-statuses': 9, 'passenger-document-types': 7, 'cancellation-fee-types': 3, 'star-ratings': 54 })) {
      const response = await fetch(`${base}/catalogs/${route}`);
      assert.equal(response.status, 200, route);
      const body = await response.json();
      let items = body;
      if (['amenities', 'suppliers', 'accommodation-types'].includes(route)) {
        assert.equal(body.total, count);
        assert.equal(body.page, 1);
        assert.equal(body.limit, 20);
        assert.equal(body.totalPages, Math.ceil(count / 20));
        assert.equal(body.data.length, 20);
        items = [];
        for (let page = 1; page <= Math.ceil(count / 100); page++) {
          const result = await (await fetch(`${base}/catalogs/${route}?page=${page}&limit=100`)).json();
          items.push(...result.data);
        }
      }
      assert.equal(items.length, count, route);
      assert.equal(new Set(items.map(item => `${item.groupCode || ''}:${item.code}`)).size, count, `${route} unique codes`);
    }
    const groups = await (await fetch(`${base}/catalogs/amenity-groups`)).json();
    const amenities = await (await fetch(`${base}/catalogs/amenities`)).json();
    assert(amenities.data.every(item => groups.some(group => group.code === item.groupCode)));
    for (const route of ['amenities?groupCode=mno.htl.amt.ser', 'suppliers?search=hotel', 'accommodation-types?search=hotel']) {
      assert((await (await fetch(`${base}/catalogs/${route}`)).json()).data.length > 0);
    }
    assert.equal((await fetch(`${base}/catalogs/suppliers?search=x&search=y`)).status, 400);
    for (const route of ['amenities', 'suppliers', 'accommodation-types']) {
      for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=abc', 'limit=0', 'limit=101', 'limit=2.5', 'sortOrder=asc', 'sortOrder=invalid', 'page=1&page=2', 'codes=x&codes=y']) {
        assert.equal((await fetch(`${base}/catalogs/${route}?${query}`)).status, 400, `${route}?${query}`);
      }
      const scope = route === 'amenities' ? '&groupCode=MNO.HTL.AMT.SER' : '';
      const first = await (await fetch(`${base}/catalogs/${route}?limit=2${scope}`)).json();
      const codes = first.data.map(item => item.code);
      const selected = await (await fetch(`${base}/catalogs/${route}?codes=${encodeURIComponent(codes.join(','))}&limit=1&page=2&sortOrder=DESC${scope}`)).json();
      assert.equal(selected.total, 2);
      assert.equal(selected.totalPages, 2);
      assert.equal(selected.page, 2);
      assert.equal(selected.limit, 1);
      assert.equal(selected.data[0].code, codes[0]);
    }
    const search = await post('/hotels/search?provider=mock', { destinationId: '2262', checkIn: '2026-11-15', checkOut: '2026-11-20', rooms: [{ roomType: 'NMO.HTL.RMT.DBL', roomSequence: 1 }], passengers: [{ ageType: 'ADT', roomSequence: 1 }] });
    assert.equal(search.status, 201);
    for (const rate of search.body.hotels[0].rates) {
      assert.equal(rate.bookable, true);
      const result = await post('/hotels/validate', { tripProductId: rate.tripProductId });
      assert.equal(result.status, 200);
      assert.equal(result.body.validatedPrice.amount, rate.amount);
      const charges = await post('/hotels/cancellation-fees?provider=mock', { tripProductId: rate.tripProductId });
      assert.equal(charges.status, 200);
      assert.equal(charges.body.feeSchedule.at(-1).feeAmount, rate.amount);
      assert.equal(Boolean(charges.body.freeCancellationDeadline), rate.cancellationPolicy.refundable);
    }
    for (const route of ['validate', 'cancellation-fees']) {
      for (const body of [{}, { tripProductId: '' }, { tripProductId: '   ' }, { tripProductId: 42 }, { tripProductId: null }, { tripProductId: 'x', extra: true }]) {
        assert.equal((await post(`/hotels/${route}`, body)).status, 400);
      }
      assert.equal((await post(`/hotels/${route}?provider=invalid`, { tripProductId: 'x' })).status, 400);
      assert.equal((await post(`/hotels/${route}`, { tripProductId: 'MOCK-EXP-001' })).status, 410);
      assert.equal((await post(`/hotels/${route}`, { tripProductId: 'missing' })).status, 404);
    }
    assert.equal((await post('/hotels/validate', { tripProductId: 'MOCK-PRICE-002' })).body.validatedPrice.priceChanged, true);
    const escapedId = 'ID<&"001';
    let result = await post('/hotels/validate?provider=nemo', { tripProductId: escapedId });
    assert.equal(result.status, 200);
    assert.equal(result.body.tripProductId, 'NEW-ID');
    assert.equal(result.body.validatedPrice.priceChanged, false);
    assert.equal(received.at(-1).path, '/catalog/product/validate');
    assert.equal(received.at(-1).token, 'test-token');
    assert.equal(new XMLParser().parse(received.at(-1).body).AvailabilityValidationRQ.TripProductID, escapedId);
    upstreamBody = fees;
    result = await post('/hotels/cancellation-fees?provider=nemo', { tripProductId: 'NEW-ID' });
    assert.equal(result.status, 200);
    assert.equal(result.body.feeSchedule[0].feeAmount, 170);
    assert.equal(received.at(-1).path, '/booking/cancellation/fees');
    for (const [code, status] of [[5011, 410], [1101, 404], [1106, 409], [1108, 502], [401, 401]]) {
      upstreamBody = `<ErrorRS><Error Code="${code}" Message="Test error"/></ErrorRS>`;
      assert.equal((await post('/hotels/validate?provider=nemo', { tripProductId: 'ID' })).status, status);
    }
    upstreamBody = '<broken';
    assert.equal((await post('/hotels/validate?provider=nemo', { tripProductId: 'ID' })).status, 502);
    upstreamStatus = 503;
    assert.equal((await post('/hotels/validate?provider=nemo', { tripProductId: 'ID' })).status, 502);
  } finally {
    await app.close();
    axios.default.post = originalPost;
    if (oldUrl === undefined) delete process.env.NEMO_BASE_URL; else process.env.NEMO_BASE_URL = oldUrl;
    if (oldToken === undefined) delete process.env.NEMO_AUTH_TOKEN; else process.env.NEMO_AUTH_TOKEN = oldToken;
  }
});

test('Nemo parser rejects corrupt monetary data and normalizes fee tiers', () => {
  const parser = new NemoXmlParser();
  for (const value of ['NaN', '', '-1', 'Infinity']) assert.throws(() => parser.parseValidationResponse(validation.replace('850.00', value), 'TX'));
  assert.throws(() => parser.parseValidationResponse(validation.replace('PriceChanged="false"', 'PriceChanged="maybe"'), 'TX'));
  assert.equal(parser.parseValidationResponse(validation.replace('PriceChanged="false"', 'PriceChanged="true"'), 'TX').validatedPrice.priceChanged, true);
  assert.equal(parser.parseCancellationFeesResponse(fees.replace(/<Tier[^>]+\/>/, ''), 'TX').feeSchedule.length, 0);
  assert.equal(parser.parseCancellationFeesResponse(fees.replace(/(<Tier[^>]+\/>)/, '$1$1'), 'TX').feeSchedule.length, 2);
  assert.throws(() => parser.parseCancellationFeesResponse(fees.replace('170.00', 'bad'), 'TX'));
  assert.throws(() => parser.parseCancellationFeesResponse(fees.replace(/<FeeSchedule>.*<\/FeeSchedule>/, ''), 'TX'));
});

test('source TypeScript contains no explicit any', () => {
  const ts = require('typescript');
  const visitDir = dir => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${item.name}`;
      if (item.isDirectory()) visitDir(path);
      else if (path.endsWith('.ts')) {
        const source = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
        const visit = node => { assert.notEqual(node.kind, ts.SyntaxKind.AnyKeyword, path); ts.forEachChild(node, visit); };
        visit(source);
      }
    }
  };
  visitDir('src');
});


test('catalog CSV preserves escaped quotes and empty columns are rejected', () => {
  const { LocalCatalogRepository } = require('../dist/repositories/local-catalog.repository');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-'));
  const file = path.join(dir, 'seed.csv');
  const repository = new LocalCatalogRepository();
  try {
    fs.writeFileSync(file, 'code,description\r\n001,"Hotel, with ""quotes"""\r\n');
    assert.deepEqual(repository.parseCsv(file), [['001', 'Hotel, with "quotes"']]);
    fs.writeFileSync(file, 'code,description\n001,\n');
    assert.throws(() => repository.parseCsv(file));
    fs.writeFileSync(file, 'code,description\n001,"unterminated');
    assert.throws(() => repository.parseCsv(file));
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
