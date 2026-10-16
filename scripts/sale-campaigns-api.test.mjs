import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixture } from './payment-fixture.ts';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const outfile = resolve('node_modules/.cache/sale-campaigns-api.mjs');
await build({ stdin: { resolveDir: process.cwd(), contents: "export {default as admin} from './server/sales/adminHandler'; export {default as publicSales} from './api/sales';" }, outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'synthetic-auth-only', setup(b) {
  b.onResolve({ filter: /^firebase-admin\/(auth|app|firestore)$/ }, a => ({ path: a.path, namespace: 'fixture' }));
  b.onResolve({ filter: /environment\.js$/ }, () => ({ path: 'environment', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: {
    'firebase-admin/app': "export const getApps=()=>[{options:{projectId:'demo-ab-payments'}}]; export const initializeApp=()=>{}; export const cert=()=>{};",
    'firebase-admin/firestore': 'export const getFirestore=()=>globalThis.campaignFixture.db;',
    'firebase-admin/auth': "export const getAuth=()=>({verifyIdToken:async(token,revoked)=>{globalThis.revocationChecks.push(revoked);if(['expired','revoked'].includes(token))throw Error('fixture invalid');return {uid:token,admin:token==='admin'};}});",
    environment: "export const validateServerFirebase=()=> 'demo-ab-payments';",
  }[path] }));
} }] });
const api = await import(pathToFileURL(outfile).href);
function reset() { globalThis.campaignFixture = fixture(10); const db = campaignFixture.db; db.getAll = async (...refs) => Promise.all(refs.map(ref => ref.get())); globalThis.revocationChecks = []; }
async function invoke(handler, body, auth = 'admin', method = 'POST', url = '/api/sales', query = {}) {
  let status, data; await handler({ method, url, query, headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}), 'content-type': 'application/json' }, body }, { setHeader() {}, status(v) { status = v; return this; }, json(v) { data = v; } }); return { status, data };
}
const fields = () => ({ name: 'Diwali Special Sale', slug: 'diwali-2026', description: 'Fixture only', desktopImage: 'https://example.com/banner.jpg', mobileImage: '', ctaText: 'Shop Diwali', startsAt: Date.now() - 60000, endsAt: Date.now() + 3600000, mode: 'percentage', percentage: 20, categoryNames: [], displayOrder: 1, homepage: true, featured: false });
test('all privileged campaign actions require a valid revoked-checked admin custom claim', async () => {
  reset();
  for (const action of ['list', 'assignments', 'save', 'assign', 'transition']) for (const auth of ['', 'customer', 'expired', 'revoked']) {
    const result = await invoke(api.admin, { action, id: 'diwali', revision: 0 }, auth);
    assert.equal(result.status, auth === 'customer' ? 403 : 401);
  }
  assert.ok(revocationChecks.length > 0); assert.ok(revocationChecks.every(Boolean));
  assert.equal([...campaignFixture.docs.keys()].some(k => k.startsWith('saleCampaigns/')), false);
});
test('shared function routes original and rewritten admin URLs without weakening authentication', async () => {
  reset();
  for (const [url, query] of [['/api/admin/sale-campaigns', {}], ['/api/sales?__campaignAdmin=1', {}], ['/api/sales', { __campaignAdmin: '1' }]]) {
    for (const auth of ['', 'customer', 'revoked']) assert.equal((await invoke(api.publicSales, { action: 'list' }, auth, 'POST', url, query)).status, auth === 'customer' ? 403 : 401);
    assert.equal((await invoke(api.publicSales, { action: 'list' }, 'admin', 'POST', url, query)).status, 200);
    assert.equal((await invoke(api.publicSales, null, 'admin', 'GET', url, query)).status, 405);
  }
  assert.equal((await invoke(api.publicSales, { action: 'list' }, 'admin')).status, 400);
  assert.deepEqual((await invoke(api.publicSales, null, '', 'GET')).data.campaigns, []);
});
test('deployment keeps the admin URL rewrite ahead of the SPA fallback and stays within Hobby function budget', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const route = config.rewrites.findIndex(r => r.source === '/api/admin/sale-campaigns');
  const fallback = config.rewrites.findIndex(r => r.source === '/(.*)');
  assert.ok(route >= 0 && route < fallback);
  assert.equal(config.rewrites[route].destination, '/api/sales?__campaignAdmin=1');
  assert.match(execFileSync(process.execPath, ['scripts/check-vercel-function-budget.mjs'], { encoding: 'utf8' }), /12\/12/);
});
test('actual admin creation/assignment/publication and public projections preserve draft privacy and server pricing', async () => {
  reset();
  let result = await invoke(api.admin, { action: 'save', id: 'diwali', revision: 0, campaign: fields() }); assert.equal(result.status, 200); let c = result.data.campaign;
  assert.deepEqual((await invoke(api.publicSales, null, '', 'GET')).data.campaigns, []);
  assert.equal((await invoke(api.publicSales, null, '', 'GET', '/api/sales?slug=diwali-2026')).data.campaign, null);
  result = await invoke(api.admin, { action: 'assign', id: c.id, revision: c.revision, changes: [{ productId: 'dress', remove: false }] }); assert.equal(result.status, 200); c = result.data.campaign;
  result = await invoke(api.admin, { action: 'transition', id: c.id, revision: c.revision, status: 'published' }); assert.equal(result.status, 200);
  const publicResult = await invoke(api.publicSales, null, '', 'GET'); assert.equal(publicResult.data.campaigns[0].slug, 'diwali-2026'); assert.equal(publicResult.data.campaigns[0].updatedBy, undefined);
  const prices = await invoke(api.publicSales, { productIds: ['dress'] }, ''); assert.equal(prices.status, 200); assert.equal(prices.data.prices.dress.priceINR, 1199.2);
  assert.equal(campaignFixture.docs.get('products/dress').data.priceINR, 1499);
});
test('public pricing rejects client money and campaign eligibility; admin rejects unexpected fields and invalid images', async () => {
  reset();
  for (const body of [{ productIds: ['dress'], priceINR: 1 }, { productIds: ['dress'], campaignId: 'diwali' }, { productIds: Array(101).fill('dress') }, { productIds: ['../secret'] }]) assert.equal((await invoke(api.publicSales, body, '')).status, 400);
  assert.equal((await invoke(api.admin, { action: 'save', id: 'diwali', revision: 0, campaign: { ...fields(), desktopImage: 'javascript:alert(1)' } })).status, 400);
  assert.equal((await invoke(api.admin, { action: 'save', id: 'diwali', revision: 0, campaign: { ...fields(), status: 'published' } })).status, 400);
  for (const bad of [{ name: 1 }, { slug: 123 }, { ctaText: {} }, { mobileImage: 0 }]) assert.equal((await invoke(api.admin, { action: 'save', id: 'diwali', revision: 0, campaign: { ...fields(), ...bad } })).status, 400);
});
