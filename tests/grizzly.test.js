import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

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

  it('passes operator parameter to getNumber when specified', async () => {
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
  });

  it('omits operator parameter when operator is any', async () => {
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
});
