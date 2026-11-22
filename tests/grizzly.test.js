import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { parseOrderArgs } from '../lib/bot.js';
import { detectIndonesiaOperator } from '../lib/config.js';
import * as grizzly from '../lib/grizzly.js';

const originalFetch = globalThis.fetch;

describe('GrizzlySMS API client', () => {
  beforeEach(() => {
    process.env.GRIZZLY_API_KEY = 'test-api-key';
    process.env.GRIZZLY_API_BASE_URL = 'https://api.grizzlysms.com/stubs/handler_api.php';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses text getBalance response', async () => {
    globalThis.fetch = async () => new Response('ACCESS_BALANCE:12.50', { status: 200 });
    const res = await grizzly.getBalance();
    assert.deepEqual(res, { ok: true, balance: '12.50' });
  });

  it('parses getNumber success response', async () => {
    globalThis.fetch = async () =>
      new Response('ACCESS_NUMBER:987654321:+628123456789', { status: 200 });
    const res = await grizzly.getNumber({ service: 'wa', country: '6' });
    assert.deepEqual(res, { ok: true, id: '987654321', phone: '+628123456789' });
  });

  it('translates NO_BALANCE error nicely', async () => {
    globalThis.fetch = async () => new Response('NO_BALANCE', { status: 200 });
    const res = await grizzly.getNumber({ service: 'wa', country: '6' });
    assert.equal(res.ok, false);
    assert.match(res.error, /Saldo GrizzlySMS tidak mencukupi/);
  });

  it('parses STATUS_OK with OTP code', async () => {
    globalThis.fetch = async () => new Response('STATUS_OK:482910', { status: 200 });
    const res = await grizzly.getStatus('987654321');
    assert.equal(res.ok, true);
    assert.equal(res.state, 'OK');
    assert.equal(res.code, '482910');
  });

  it('parses setStatus cancel response', async () => {
    globalThis.fetch = async () => new Response('ACCESS_CANCEL', { status: 200 });
    const res = await grizzly.setStatus('987654321', 8);
    assert.equal(res.ok, true);
    assert.match(res.message, /dibatalkan/i);
  });

  it('passes operator and phoneException parameters to getNumber for Indonesia', async () => {
    let calledUrl = '';
    globalThis.fetch = async (url) => {
      calledUrl = String(url);
      return new Response('ACCESS_NUMBER:111222:+628120000111', { status: 200 });
    };

    const res = await grizzly.getNumber({
      service: 'wa',
      country: '6',
      operator: 'telkomsel',
    });
    assert.equal(res.ok, true);
    assert.match(calledUrl, /operator=telkomsel/);
    assert.match(calledUrl, /phoneException=6283/);
  });

  it('normalizes operator alias tsel/isat and sends matching phoneException', async () => {
    let calledUrl = '';
    globalThis.fetch = async (url) => {
      calledUrl = String(url);
      return new Response('ACCESS_NUMBER:111224:+628570000111', { status: 200 });
    };

    const res = await grizzly.getNumber({
      service: 'wa',
      country: '6',
      operator: 'isat',
    });
    assert.equal(res.ok, true);
    assert.match(calledUrl, /operator=indosat/);
    assert.match(calledUrl, /phoneException=6282/);
  });

  it('omits operator and phoneException parameters when operator is any', async () => {
    let calledUrl = '';
    globalThis.fetch = async (url) => {
      calledUrl = String(url);
      return new Response('ACCESS_NUMBER:111223:+628120000112', { status: 200 });
    };

    const res = await grizzly.getNumber({
      service: 'wa',
      country: '6',
      operator: 'any',
    });
    assert.equal(res.ok, true);
    assert.doesNotMatch(calledUrl, /operator=/);
    assert.doesNotMatch(calledUrl, /phoneException=/);
  });

  it('parses getOperators countryOperators response', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: 'success',
          countryOperators: {
            '6': ['any', 'telkomsel', 'indosat', 'axis'],
          },
        }),
        { status: 200 }
      );

    const res = await grizzly.getOperators('6');
    assert.equal(res.ok, true);
    assert.deepEqual(res.operators, ['telkomsel', 'indosat', 'axis']);
  });

  it('parses getActiveActivations response with Unix time', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: 'success',
          activeActivations: [
            {
              activationId: '635468021',
              serviceCode: 'wa',
              phoneNumber: '628123456789',
              countryCode: '6',
              time: '1700000000',
              cost: '15.00',
            },
          ],
        }),
        { status: 200 }
      );

    const res = await grizzly.getActiveActivations();
    assert.equal(res.ok, true);
    assert.equal(res.activations.length, 1);
    assert.equal(res.activations[0].id, '635468021');
    assert.equal(res.activations[0].phone, '628123456789');
    assert.equal(res.activations[0].createdAt, 1700000000 * 1000);
  });

  it('handles NO_ACTIVATIONS cleanly', async () => {
    globalThis.fetch = async () => new Response('NO_ACTIVATIONS', { status: 200 });
    const res = await grizzly.getActiveActivations();
    assert.deepEqual(res, { ok: true, activations: [] });
  });
});

describe('Order command argument parser', () => {
  it('parses single order with default operator', () => {
    assert.deepEqual(parseOrderArgs(['wa', '6']), {
      service: 'wa',
      country: '6',
      operator: 'any',
      qty: 1,
      maxPrice: undefined,
    });
  });

  it('parses multi-order without operator: /order wa 6 5', () => {
    assert.deepEqual(parseOrderArgs(['wa', '6', '5']), {
      service: 'wa',
      country: '6',
      operator: 'any',
      qty: 5,
      maxPrice: undefined,
    });
  });

  it('parses multi-order with operator: /order wa 6 telkomsel 3', () => {
    assert.deepEqual(parseOrderArgs(['wa', '6', 'telkomsel', '3']), {
      service: 'wa',
      country: '6',
      operator: 'telkomsel',
      qty: 3,
      maxPrice: undefined,
    });
  });

  it('parses multi-order with operator and maxPrice: /order wa 6 telkomsel 3 0.5', () => {
    assert.deepEqual(parseOrderArgs(['wa', '6', 'telkomsel', '3', '0.5']), {
      service: 'wa',
      country: '6',
      operator: 'telkomsel',
      qty: 3,
      maxPrice: '0.5',
    });
  });

  it('parses decimal arg3 as maxPrice: /order tg 187 0.5', () => {
    assert.deepEqual(parseOrderArgs(['tg', '187', '0.5']), {
      service: 'tg',
      country: '187',
      operator: 'any',
      qty: 1,
      maxPrice: '0.5',
    });
  });

  it('parses provider= and except= flags', () => {
    assert.deepEqual(parseOrderArgs(['wa', '6', 'telkomsel', '3', 'provider=311,312', 'except=99']), {
      service: 'wa',
      country: '6',
      operator: 'telkomsel',
      qty: 3,
      maxPrice: undefined,
      providerIds: '311,312',
      exceptProviderIds: '99',
    });
  });
});

describe('Indonesia operator prefix detector', () => {
  it('detects Telkomsel, Indosat, XL, Axis, Three, Smartfren', () => {
    assert.deepEqual(detectIndonesiaOperator('+6281234567890'), {
      code: 'telkomsel',
      name: 'Telkomsel',
    });
    assert.deepEqual(detectIndonesiaOperator('6285712345678'), {
      code: 'indosat',
      name: 'Indosat',
    });
    assert.deepEqual(detectIndonesiaOperator('087812345678'), {
      code: 'xl',
      name: 'XL Axiata',
    });
    assert.deepEqual(detectIndonesiaOperator('6283812345678'), {
      code: 'axis',
      name: 'Axis',
    });
    assert.deepEqual(detectIndonesiaOperator('6289612345678'), {
      code: 'three',
      name: 'Three (3)',
    });
    assert.deepEqual(detectIndonesiaOperator('6288212345678'), {
      code: 'smartfren',
      name: 'Smartfren',
    });
  });

  it('returns null for non-Indonesian numbers', () => {
    assert.equal(detectIndonesiaOperator('+19145550198'), null);
  });
});
