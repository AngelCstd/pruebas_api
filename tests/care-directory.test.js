const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IncomingMessage, ServerResponse } = require('node:http');
const { Duplex } = require('node:stream');
const { once } = require('node:events');
const { Module, ValidationPipe } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { CareDirectoryController } = require('../dist/controllers/care-directory.controller');
const { CareDirectoryService } = require('../dist/services/care-directory.service');
const { CARE_RESERVATION_REPOSITORY } = require('../dist/repositories/care-reservation.repository.interface');
const { InMemoryCareReservationRepository } = require('../dist/repositories/in-memory-care-reservation.repository');

test('GET /clients and GET /persons validate scope and apply filters and limits', async () => {
  const repository = new InMemoryCareReservationRepository({
    clients: [
      { organizationId: 'org-z', name: 'Zulu', creditAccountId: 'crd-z', currency: 'MXN', creditStatus: 'ACTIVE', creditLimit: 2000, used: 500, available: 1500 },
      { organizationId: 'org-a', name: 'Acme', creditAccountId: 'crd-a', currency: 'MXN', creditStatus: 'ACTIVE', creditLimit: 1000, used: 100, available: 900 },
    ],
    persons: [
      { personId: 'per-b', fullName: 'Beatriz Luna', email: 'bea@example.com', phone: null, organizationId: 'org-a' },
      { personId: 'per-c', fullName: 'Carlos Mendez', email: 'carlos@example.com', phone: null, organizationId: 'org-a' },
      { personId: 'per-z', fullName: 'Persona Zulu', email: 'z@example.com', phone: null, organizationId: 'org-z' },
    ],
  });
  class TestModule {}
  Module({
    controllers: [CareDirectoryController],
    providers: [CareDirectoryService, { provide: CARE_RESERVATION_REPOSITORY, useValue: repository }],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  try {
    await app.init();
    const fetch = async path => {
      const chunks = [];
      const socket = new Duplex({ read() {}, write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
      const req = new IncomingMessage(socket);
      req.method = 'GET';
      req.url = path;
      req.headers = { 'content-length': '0' };
      const res = new ServerResponse(req);
      res.assignSocket(socket);
      const finished = once(res, 'finish');
      app.getHttpAdapter().getInstance().handle(req, res);
      req.complete = true;
      req.push(null);
      await finished;
      const raw = Buffer.concat(chunks).toString();
      return { status: res.statusCode, body: JSON.parse(raw.slice(raw.indexOf('\r\n\r\n') + 4)) };
    };

    assert.equal((await fetch('/clients')).status, 400);
    assert.deepEqual((await fetch('/clients?tenantId=tenant-a')).body.items.map(item => item.name), ['Acme', 'Zulu']);
    assert.equal((await fetch('/persons?tenantId=tenant-a')).status, 400);
    assert.equal((await fetch('/persons?tenantId=tenant-a&organizationId=org-a&limit=51')).status, 400);
    const people = await fetch('/persons?tenantId=tenant-a&organizationId=org-a&q=example&limit=1');
    assert.equal(people.status, 200);
    assert.deepEqual(people.body.items.map(item => item.fullName), ['Beatriz Luna']);
  } finally {
    await app.close();
  }
});
