const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, HttpException } = require('@nestjs/common');
const { BookingProviderGuard } = require('../dist/guards/booking-provider.guard');
const { ProviderType } = require('../dist/domain/enums/provider.enum');

// Unit test directo del guard real que protege POST /hotels/book. Es la puerta HTTP que corre
// ANTES del servicio: si este guard se rompe, nada de lo que valide BookingApplicationService
// importa, porque la petición nunca llega a él (o se rechaza una que sí debía pasar).
function contextWithProvider(provider) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ query: provider === undefined ? {} : { provider } }),
    }),
  };
}

test('BookingProviderGuard allows mock, convenio and the default (no provider)', () => {
  const guard = new BookingProviderGuard();
  assert.equal(guard.canActivate(contextWithProvider(ProviderType.MOCK)), true);
  assert.equal(guard.canActivate(contextWithProvider(ProviderType.CONVENIO)), true);
  assert.equal(guard.canActivate(contextWithProvider(undefined)), true);
});

test('BookingProviderGuard still blocks nemo with 501 BOOKING_NOT_ENABLED, unchanged by the convenio feature', () => {
  const guard = new BookingProviderGuard();
  assert.throws(() => guard.canActivate(contextWithProvider(ProviderType.NEMO)), error => {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), 501);
    const body = error.getResponse();
    assert.equal(body.code, 'BOOKING_NOT_ENABLED');
    return true;
  });
});

test('BookingProviderGuard still rejects provider=all with 400 before any booking logic runs', () => {
  const guard = new BookingProviderGuard();
  assert.throws(() => guard.canActivate(contextWithProvider(ProviderType.ALL)), BadRequestException);
});
