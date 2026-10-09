import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { validateBuildEnvironment, validateClientFirebase, validatePaymentEnvironment, validateServerFirebase, paymentMode } from '../server/payments/environment.js';
import { razorpayProvider } from '../server/payments/provider.js';
import { database } from '../server/payments/http.js';

function fixture(deployment = 'preview'): Record<string, string> {
  const live = deployment === 'production';
  const project = live ? 'production-project' : 'test-project';
  return {
    VERCEL_ENV: deployment, FIREBASE_PRODUCTION_PROJECT_ID: 'production-project', FIREBASE_TEST_PROJECT_ID: 'test-project',
    FIREBASE_PRODUCTION_WEB_API_KEY: 'production-public-fixture', FIREBASE_TEST_WEB_API_KEY: 'test-public-fixture',
    VITE_FIREBASE_ENABLED: 'true', VITE_FIREBASE_PROJECT_ID: project, VITE_FIREBASE_API_KEY: live ? 'production-public-fixture' : 'test-public-fixture',
    VITE_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`, VITE_FIREBASE_STORAGE_BUCKET: `${project}.firebasestorage.app`,
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123456', VITE_FIREBASE_APP_ID: '1:123456:web:fixture',
    FIREBASE_ADMIN_PROJECT_ID: project, FIREBASE_ADMIN_CLIENT_EMAIL: `fixture@${project}.iam.gserviceaccount.com`, FIREBASE_ADMIN_PRIVATE_KEY: 'fixture-only-not-a-key',
    RAZORPAY_KEY_ID: `rzp_${live ? 'live' : 'test'}_fixture`, RAZORPAY_KEY_SECRET: 'fixture-only-api-secret',
    RAZORPAY_WEBHOOK_SECRET: 'fixture-only-webhook-secret', PAYMENTS_LIVE_ENABLED: live ? 'true' : 'false',
  };
}

test('Production uses LIVE; Preview and development use TEST with distinct Firebase targets', () => {
  for (const deployment of ['production', 'preview', 'development']) {
    const env = fixture(deployment);
    assert.equal(validatePaymentEnvironment(env).mode, deployment === 'production' ? 'live' : 'test');
    assert.equal(validateServerFirebase(env), env.VITE_FIREBASE_PROJECT_ID);
    assert.equal(razorpayProvider(env).keyId, env.RAZORPAY_KEY_ID);
  }
  const local = fixture(); delete local.VERCEL_ENV;
  assert.equal(validatePaymentEnvironment(local).mode, 'test');
});

test('wrong Razorpay mode and live-enable flags fail before any provider request', () => {
  for (const [deployment, key] of [['production', 'rzp_test_fixture'], ['preview', 'rzp_live_fixture'], ['development', 'rzp_live_fixture']]) {
    assert.throws(() => razorpayProvider({ ...fixture(deployment), RAZORPAY_KEY_ID: key }), /PAYMENT_CREDENTIAL_ENVIRONMENT_MISMATCH/);
  }
  for (const [deployment, enabled] of [['production', 'false'], ['production', ''], ['preview', 'true'], ['preview', 'TRUE']]) {
    assert.throws(() => validatePaymentEnvironment({ ...fixture(deployment), PAYMENTS_LIVE_ENABLED: enabled }), /PAYMENT_MODE_DISABLED_OR_INVALID/);
  }
  assert.throws(() => paymentMode({ VERCEL: '1' }), /DEPLOYMENT_ENVIRONMENT_MISSING/);
  assert.throws(() => paymentMode({ VERCEL_ENV: 'staging' }), /DEPLOYMENT_ENVIRONMENT_INVALID/);
});

test('Production pins match both SDKs; non-production requires distinct Test pins', () => {
  for (const deployment of ['production', 'preview']) {
    const env = fixture(deployment);
    for (const key of deployment === 'production' ? ['FIREBASE_PRODUCTION_PROJECT_ID'] : ['FIREBASE_PRODUCTION_PROJECT_ID', 'FIREBASE_TEST_PROJECT_ID']) {
      assert.throws(() => validatePaymentEnvironment({ ...env, [key]: '' }), /ISOLATION_CONFIGURATION/);
    }
    if (deployment !== 'production') assert.throws(() => validatePaymentEnvironment({ ...env, FIREBASE_TEST_PROJECT_ID: env.FIREBASE_PRODUCTION_PROJECT_ID }), /ISOLATION_CONFIGURATION/);
    const otherProject = deployment === 'production' ? 'test-project' : 'production-project';
    assert.throws(() => validatePaymentEnvironment({ ...env, VITE_FIREBASE_PROJECT_ID: otherProject }), /CLIENT_ENVIRONMENT_MISMATCH/);
    assert.throws(() => validatePaymentEnvironment({ ...env, VITE_FIREBASE_API_KEY: deployment === 'production' ? env.FIREBASE_TEST_WEB_API_KEY : env.FIREBASE_PRODUCTION_WEB_API_KEY }), /AUTH_KEY_ENVIRONMENT_MISMATCH/);
    assert.throws(() => validatePaymentEnvironment({ ...env, FIREBASE_ADMIN_PROJECT_ID: otherProject }), /SERVER_ENVIRONMENT_MISMATCH/);
    if (deployment !== 'production') assert.throws(() => validatePaymentEnvironment({ ...env, FIREBASE_ADMIN_CLIENT_EMAIL: `fixture@${otherProject}.iam.gserviceaccount.com` }), /CREDENTIAL_ENVIRONMENT_MISMATCH/);
    assert.throws(() => validateClientFirebase({ ...env, VITE_FIREBASE_AUTH_DOMAIN: `${otherProject}.firebaseapp.com` }), /AUTH_ENVIRONMENT_MISMATCH/);
    assert.throws(() => validateClientFirebase({ ...env, VITE_FIREBASE_STORAGE_BUCKET: `${otherProject}.appspot.com` }), /STORAGE_ENVIRONMENT_MISMATCH/);
  }
});

test('missing credentials, disabled Firebase, incorrect web config and emulator overrides fail closed', () => {
  const env = fixture();
  for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'FIREBASE_ADMIN_PRIVATE_KEY', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_APP_ID']) {
    assert.throws(() => validatePaymentEnvironment({ ...env, [key]: '' }));
  }
  assert.throws(() => validateClientFirebase({ ...env, VITE_FIREBASE_ENABLED: 'false' }), /CLIENT_ENVIRONMENT_MISMATCH/);
  assert.throws(() => validateClientFirebase({ ...env, VITE_FIREBASE_APP_ID: '1:999:web:wrong-project' }), /CLIENT_CONFIGURATION_INVALID/);
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
    assert.throws(() => validatePaymentEnvironment({ ...env, [key]: 'localhost:8189' }), /EMULATOR_NOT_ALLOWED/);
  }
});

test('wrong API secret is rejected by Razorpay authentication; provider errors reveal no credentials', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  try {
    await assert.rejects(razorpayProvider(fixture()).payment('pay_fixture'), error => {
      assert.equal((error as Error).message, 'PROVIDER_UNAVAILABLE'); return true;
    });
  } finally { globalThis.fetch = original; }
});

test('cached Firebase app from another project cannot be reused', async () => {
  const env = fixture(); const previous = { ...process.env };
  Object.assign(process.env, env);
  const app = initializeApp({ projectId: 'production-project' });
  try { assert.throws(() => database(), /FIREBASE_CACHED_ENVIRONMENT_MISMATCH/); }
  finally {
    await deleteApp(app);
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
  assert.equal(getApps().length, 0);
});

test('build fails for mixed environments and unconfigured local builds cannot enable Firebase', () => {
  assert.equal(validateBuildEnvironment({}), false);
  assert.equal(validateBuildEnvironment({ VITE_FIREBASE_PROJECT_ID: 'production-project' }), false);
  for (const deployment of ['production', 'preview']) {
    const env = fixture(deployment);
    assert.equal(validateBuildEnvironment(env), true);
    if (deployment !== 'production') assert.throws(() => validateBuildEnvironment({ ...env, FIREBASE_TEST_PROJECT_ID: '' }));
    assert.throws(() => validateBuildEnvironment({ ...env, VITE_FIREBASE_PROJECT_ID: deployment === 'production' ? 'test-project' : 'production-project' }));
  }
});

test('Production works without Test pins; payment credentials do not gate Firebase builds or Admin services', () => {
  const env = fixture('production');
  delete env.FIREBASE_TEST_PROJECT_ID; delete env.FIREBASE_TEST_WEB_API_KEY;
  assert.equal(validateBuildEnvironment(env), true);
  assert.equal(validateServerFirebase(env), 'production-project');
  assert.equal(validatePaymentEnvironment(env).mode, 'live');
  for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) {
    const missing = { ...env, [key]: '' };
    assert.equal(validateBuildEnvironment(missing), true);
    assert.equal(validateServerFirebase(missing), 'production-project');
    assert.throws(() => razorpayProvider(missing), /PAYMENT_CONFIGURATION_MISSING/);
  }
  assert.equal(validateBuildEnvironment({ ...env, RAZORPAY_KEY_ID: 'rzp_test_fixture' }), true);
  assert.throws(() => razorpayProvider({ ...env, RAZORPAY_KEY_ID: 'rzp_test_fixture' }), /CREDENTIAL_ENVIRONMENT_MISMATCH/);
  delete env.FIREBASE_ADMIN_PRIVATE_KEY;
  assert.equal(validateBuildEnvironment(env), true);
  assert.throws(() => validateServerFirebase(env), /SERVER_CONFIGURATION_MISSING/);
});

test('Preview and Development cannot connect until distinct safe Firebase config exists', () => {
  for (const deployment of ['preview', 'development']) {
    const env = fixture(deployment);
    for (const key of ['FIREBASE_TEST_PROJECT_ID', 'FIREBASE_TEST_WEB_API_KEY', 'FIREBASE_PRODUCTION_WEB_API_KEY']) {
      assert.throws(() => validateBuildEnvironment({ ...env, [key]: '' }));
      assert.throws(() => validateServerFirebase({ ...env, [key]: '' }));
    }
    assert.throws(() => validateClientFirebase({ ...env, FIREBASE_TEST_WEB_API_KEY: env.FIREBASE_PRODUCTION_WEB_API_KEY }), /AUTH_ISOLATION_CONFIGURATION/);
    assert.throws(() => validateClientFirebase({ ...env, VITE_FIREBASE_AUTH_DOMAIN: 'custom.example.com' }), /AUTH_ENVIRONMENT_MISMATCH/);
    assert.throws(() => validateClientFirebase({ ...env, VITE_FIREBASE_STORAGE_BUCKET: 'custom-bucket' }), /STORAGE_ENVIRONMENT_MISMATCH/);
    assert.throws(() => razorpayProvider({ ...env, RAZORPAY_KEY_ID: 'rzp_live_fixture' }), /CREDENTIAL_ENVIRONMENT_MISMATCH/);
  }
});

test('Production accepts custom authorized Firebase resources and rejects malformed/default cross-project config', () => {
  const env = { ...fixture('production'), VITE_FIREBASE_AUTH_DOMAIN: 'auth.shop.example.com', VITE_FIREBASE_STORAGE_BUCKET: 'shop-custom-bucket', FIREBASE_ADMIN_CLIENT_EMAIL: 'fixture@central-iam.iam.gserviceaccount.com' };
  assert.equal(validateClientFirebase(env), 'production-project');
  assert.equal(validateServerFirebase(env), 'production-project');
  for (const domain of ['https://auth.shop.example.com', 'other-project.firebaseapp.com', 'auth.shop.example.com/path']) assert.throws(() => validateClientFirebase({ ...env, VITE_FIREBASE_AUTH_DOMAIN: domain }), /AUTH_ENVIRONMENT_MISMATCH/);
  for (const bucket of ['gs://shop-custom-bucket', 'other-project.appspot.com', 'other-project.firebasestorage.app']) assert.throws(() => validateClientFirebase({ ...env, VITE_FIREBASE_STORAGE_BUCKET: bucket }), /STORAGE_ENVIRONMENT_MISMATCH/);
  assert.throws(() => validateServerFirebase({ ...env, FIREBASE_ADMIN_CLIENT_EMAIL: 'not-an-email' }), /CREDENTIAL_ENVIRONMENT_MISMATCH/);
});

test('frontend uses only the server-issued public key; build never defines server environment', () => {
  const client = readFileSync('src/services/paymentClient.ts', 'utf8');
  assert.match(client, /key: c.keyId/);
  assert.doesNotMatch(client, /RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|CRON_SECRET|FIREBASE_ADMIN_PRIVATE_KEY/);
  const config = readFileSync('vite.config.ts', 'utf8');
  assert.match(config, /validateBuildEnvironment\(env\)/);
  assert.doesNotMatch(config, /define:\s*\{\s*['"]process\.env/);
  assert.match(readFileSync('src/firebase/config.ts', 'utf8'), /VITE_FIREBASE_ENV_VALIDATED === 'true'/);
});

test('real Production and Preview builds select the correct Firebase config and exclude all server secrets', () => {
  for (const deployment of ['production', 'preview']) {
    const env = fixture(deployment);
    if (deployment === 'production') {
      delete env.FIREBASE_TEST_PROJECT_ID; delete env.FIREBASE_TEST_WEB_API_KEY;
      delete env.RAZORPAY_KEY_ID; delete env.RAZORPAY_KEY_SECRET; delete env.RAZORPAY_WEBHOOK_SECRET;
    }
    const workspace = resolve('.');
    const outDir = resolve('node_modules/.cache', `payment-environment-${deployment}`);
    assert.ok(outDir.startsWith(`${workspace}\\node_modules\\.cache\\`) || outDir.startsWith(`${workspace}/node_modules/.cache/`));
    const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir, '--emptyOutDir', 'false'], {
      encoding: 'utf8', timeout: 60000, env: { ...process.env, ...env, CRON_SECRET: 'fixture-only-cron-secret' },
    });
    // Avoid printing build output/env: tests use only fixture credentials.
    assert.equal(result.status, 0, `${deployment} build failed`);
    const bundle = readdirSync(resolve(outDir, 'assets')).filter(name => name.endsWith('.js')).map(name => readFileSync(resolve(outDir, 'assets', name), 'utf8')).join('\n');
    assert.ok(bundle.includes(env.VITE_FIREBASE_PROJECT_ID));
    assert.ok(bundle.includes(env.VITE_FIREBASE_API_KEY));
    assert.ok(!bundle.includes(deployment === 'production' ? 'test-project' : 'production-project'));
    for (const value of ['fixture-only-api-secret', 'fixture-only-webhook-secret', env.FIREBASE_ADMIN_PRIVATE_KEY, 'fixture-only-cron-secret']) assert.ok(!bundle.includes(value));
  }
});
