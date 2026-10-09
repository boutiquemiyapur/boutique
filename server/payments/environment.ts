import { requireCondition } from './errors.js';

type Environment = Record<string, string | undefined>;

// VERCEL_ENV is supplied by Vercel, not by the browser. Unknown/custom environments
// deliberately fail closed until an explicit policy is added.
export function paymentMode(env: Environment): 'live' | 'test' {
  const deployment = env.VERCEL_ENV;
  requireCondition(!env.VERCEL || Boolean(deployment), 'DEPLOYMENT_ENVIRONMENT_MISSING', 503);
  requireCondition(!deployment || ['production', 'preview', 'development'].includes(deployment), 'DEPLOYMENT_ENVIRONMENT_INVALID', 503);
  return deployment === 'production' ? 'live' : 'test';
}

export function firebaseProject(env: Environment) {
  const production = env.FIREBASE_PRODUCTION_PROJECT_ID?.trim();
  const test = env.FIREBASE_TEST_PROJECT_ID?.trim();
  const live = paymentMode(env) === 'live';
  requireCondition(production && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(production), 'FIREBASE_ISOLATION_CONFIGURATION_INVALID', 503);
  if (live) return production;
  requireCondition(test && production !== test && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(test), 'FIREBASE_ISOLATION_CONFIGURATION_INVALID', 503);
  return test;
}

// Also used by the build: reject a Preview bundle pointing at Production Firebase
// before it can read customer data or write inventory through the browser SDK.
export function validateClientFirebase(env: Environment) {
  const projectId = firebaseProject(env);
  // Firebase Auth selects its project through the web API key, not projectId.
  // Pin those keys too so a copied Production Auth key cannot create live users
  // from an otherwise correctly labelled Test Firebase configuration.
  const productionKey = env.FIREBASE_PRODUCTION_WEB_API_KEY?.trim();
  const testKey = env.FIREBASE_TEST_WEB_API_KEY?.trim();
  const live = paymentMode(env) === 'live';
  requireCondition(productionKey && (live || (testKey && productionKey !== testKey)), 'FIREBASE_AUTH_ISOLATION_CONFIGURATION_INVALID', 503);
  const expectedKey = live ? productionKey : testKey;
  requireCondition(env.VITE_FIREBASE_API_KEY === expectedKey, 'FIREBASE_AUTH_KEY_ENVIRONMENT_MISMATCH', 503);
  requireCondition(env.VITE_FIREBASE_ENABLED !== 'false' && env.VITE_FIREBASE_PROJECT_ID?.trim() === projectId, 'FIREBASE_CLIENT_ENVIRONMENT_MISMATCH', 503);
  requireCondition(env.VITE_FIREBASE_API_KEY?.trim() && env.VITE_FIREBASE_APP_ID?.trim() && env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(), 'FIREBASE_CLIENT_CONFIGURATION_MISSING', 503);
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || '';
  const bucket = env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || '';
  // Production may use an authorized custom Auth domain / IAM-authorized bucket.
  // Reject another project's recognizable default domain or bucket. Non-production
  // keeps exact Test defaults until an explicit custom-resource isolation policy exists.
  requireCondition(live
    ? /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+$/i.test(authDomain) && (!authDomain.endsWith('.firebaseapp.com') || authDomain === `${projectId}.firebaseapp.com`)
    : authDomain === `${projectId}.firebaseapp.com`, 'FIREBASE_AUTH_ENVIRONMENT_MISMATCH', 503);
  const defaultBuckets = [`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`];
  requireCondition(live
    ? /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket) && (!/\.(?:appspot\.com|firebasestorage\.app)$/.test(bucket) || defaultBuckets.includes(bucket))
    : defaultBuckets.includes(bucket), 'FIREBASE_STORAGE_ENVIRONMENT_MISMATCH', 503);
  requireCondition(env.VITE_FIREBASE_APP_ID!.startsWith(`1:${env.VITE_FIREBASE_MESSAGING_SENDER_ID!.trim()}:web:`), 'FIREBASE_CLIENT_CONFIGURATION_INVALID', 503);
  return projectId;
}

export function validateServerFirebase(env: Environment) {
  const projectId = validateClientFirebase(env);
  requireCondition(env.FIREBASE_ADMIN_PROJECT_ID?.trim() === projectId, 'FIREBASE_SERVER_ENVIRONMENT_MISMATCH', 503);
  const email = env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() || '';
  // A cross-project service account can legitimately have Production IAM access.
  // Test remains restricted to its own service account; actual IAM/key validity is
  // enforced by Firebase, not inferred from an email suffix.
  requireCondition(paymentMode(env) === 'live'
    ? /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.gserviceaccount\.com$/.test(email)
    : email.endsWith(`@${projectId}.iam.gserviceaccount.com`), 'FIREBASE_CREDENTIAL_ENVIRONMENT_MISMATCH', 503);
  requireCondition(env.FIREBASE_ADMIN_PRIVATE_KEY?.trim(), 'SERVER_CONFIGURATION_MISSING', 503);
  requireCondition(!env.FIRESTORE_EMULATOR_HOST && !env.FIREBASE_AUTH_EMULATOR_HOST && !env.FIREBASE_STORAGE_EMULATOR_HOST, 'FIREBASE_EMULATOR_NOT_ALLOWED', 503);
  return projectId;
}

export function validatePaymentEnvironment(env: Environment) {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  requireCondition(keyId && env.RAZORPAY_KEY_SECRET?.trim() && env.RAZORPAY_WEBHOOK_SECRET?.trim(), 'PAYMENT_CONFIGURATION_MISSING', 503);
  const mode = paymentMode(env);
  requireCondition(new RegExp(`^rzp_${mode}_[A-Za-z0-9]+$`).test(keyId), 'PAYMENT_CREDENTIAL_ENVIRONMENT_MISMATCH', 503);
  requireCondition(mode === 'live' ? env.PAYMENTS_LIVE_ENABLED === 'true' : !env.PAYMENTS_LIVE_ENABLED || env.PAYMENTS_LIVE_ENABLED === 'false', 'PAYMENT_MODE_DISABLED_OR_INVALID', 503);
  validateServerFirebase(env);
  return { keyId, secret: env.RAZORPAY_KEY_SECRET!.trim(), mode };
}

export function validateBuildEnvironment(env: Environment) {
  if (!env.VERCEL && !env.VERCEL_ENV && !env.FIREBASE_PRODUCTION_PROJECT_ID && !env.FIREBASE_TEST_PROJECT_ID) return false;
  validateClientFirebase(env);
  // Storefront builds need only public Firebase configuration. Payment and Admin
  // credentials are checked by their server operations, never browser initialization.
  return true;
}
