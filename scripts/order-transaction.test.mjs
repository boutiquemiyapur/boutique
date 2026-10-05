import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const outfile = resolve('node_modules/.cache/order-transaction-tests.mjs');
await build({ entryPoints: [resolve('api/orders/create.ts')], outfile, bundle: true, platform: 'node', format: 'esm' });
const { default: handler } = await import(pathToFileURL(outfile).href);
test('legacy COD creation endpoint rejects all new purchases without touching inventory', () => {
  for (const method of ['POST', 'GET']) {
    let status; let body;
    handler({ method, headers: { authorization: 'Bearer fixture-only' } }, { status: value => { status=value; return { json: value => { body=value; } }; } });
    assert.equal(status,410); assert.equal(body.code,'COD_DISABLED');
  }
});
