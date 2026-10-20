import test from 'node:test';
import assert from 'node:assert/strict';
import { devProxyOrigin } from '../src/utils/devProxyOrigin.ts';

test('local proxy normalizes only a same-origin loopback frontend request', () => {
  const allowed = 'http://127.0.0.1:5177';
  assert.equal(devProxyOrigin('http://localhost:5177', 'localhost:5177', allowed), allowed);
  assert.equal(devProxyOrigin('http://localhost:5173', 'localhost:5173', allowed), allowed);
  assert.equal(devProxyOrigin(allowed, '127.0.0.1:5177', allowed), allowed);
  for (const origin of ['https://evil.example', 'http://localhost:9999', 'null', 'http://127.0.0.1:5177/']) {
    assert.equal(devProxyOrigin(origin, 'localhost:5177', allowed), origin);
  }
  assert.equal(devProxyOrigin('http://localhost:5177', 'evil.example', allowed), 'http://localhost:5177');
  assert.equal(devProxyOrigin(undefined, 'localhost:5177', allowed), undefined);
  assert.equal(devProxyOrigin('http://localhost:5177', 'localhost:5177', undefined), 'http://localhost:5177');
});
