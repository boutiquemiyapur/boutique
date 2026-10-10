import type { IncomingMessage } from 'node:http';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { PaymentError, requireCondition } from './errors.js';
import { digest } from './validation.js';
import { validateServerFirebase } from './environment.js';
export type Request = IncomingMessage & { body?: unknown };
export type Response = { status: (code: number) => Response; json: (value: unknown) => unknown; setHeader: (name: string, value: string) => unknown };
export function database(): Firestore {
  const expectedProject = validateServerFirebase(process.env);
  let app = getApps()[0];
  if (!app) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim(); const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim(); const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
    requireCondition(projectId && clientEmail && privateKey, 'SERVER_CONFIGURATION_MISSING', 503);
    app = initializeApp({ projectId: expectedProject, credential: cert({ projectId, clientEmail, privateKey }) });
  }
  requireCondition(app.options.projectId === expectedProject, 'FIREBASE_CACHED_ENVIRONMENT_MISMATCH', 503);
  return getFirestore(app);
}
export async function authenticate(req: Request, admin = false) {
  const header = req.headers.authorization;
  requireCondition(typeof header === 'string' && header.startsWith('Bearer ') && header.length < 8192, 'AUTH_REQUIRED', 401);
  database();
  let decoded;
  try { decoded = await getAuth().verifyIdToken(header.slice(7), true); }
  catch { throw new PaymentError('AUTH_INVALID', 401); }
  requireCondition(!admin || decoded.admin === true, 'ADMIN_REQUIRED', 403);
  return decoded.uid;
}
export function jsonBody(req: Request) {
  requireCondition(String(req.headers['content-type'] || '').startsWith('application/json'), 'CONTENT_TYPE_REQUIRED', 415);
  try {
    const encoded = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    requireCondition(encoded && Buffer.byteLength(encoded) <= 32_768, 'REQUEST_TOO_LARGE', 413); return JSON.parse(encoded);
  } catch (e) { if (e instanceof PaymentError) throw e; throw new PaymentError('INVALID_JSON'); }
}
export async function rawBody(req: Request) {
  // Vercel Node helpers expose body as a lazy JSON getter and restore the wire
  // stream for data/end consumers. Never invoke that getter or reserialize JSON.
  // A supplied parsed data property has no trustworthy bytes and remains rejected.
  const descriptor = Object.getOwnPropertyDescriptor(req, 'body');
  const supplied = descriptor && 'value' in descriptor ? descriptor.value : undefined;
  requireCondition(supplied === undefined || Buffer.isBuffer(supplied), 'RAW_BODY_REQUIRED');
  if (Buffer.isBuffer(supplied)) { requireCondition(supplied.length <= 262_144, 'REQUEST_TOO_LARGE', 413); return supplied; }
  requireCondition(typeof req.on === 'function', 'RAW_BODY_REQUIRED');
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []; let length = 0; let settled = false;
    const cleanup = () => { clearTimeout(timer); req.removeListener('data', data); req.removeListener('end', end); req.removeListener('error', error); req.removeListener('aborted', aborted); };
    const fail = (e: unknown) => { if (settled) return; settled = true; cleanup(); reject(e); };
    const data = (chunk: unknown) => {
      if (settled) return;
      if (!Buffer.isBuffer(chunk) && !(chunk instanceof Uint8Array)) return fail(new PaymentError('RAW_BODY_REQUIRED'));
      const bytes = Buffer.from(chunk); length += bytes.length;
      if (length > 262_144) return fail(new PaymentError('REQUEST_TOO_LARGE', 413));
      chunks.push(bytes);
    };
    const end = () => { if (settled) return; settled = true; cleanup(); resolve(Buffer.concat(chunks)); };
    const error = () => fail(new PaymentError('RAW_BODY_REQUIRED'));
    const aborted = error;
    const timer = setTimeout(error, 15_000);
    req.on('data', data); req.on('end', end); req.on('error', error); req.on('aborted', aborted);
  });
}
export async function rateLimit(db: Firestore, uid: string, action: string, now = Date.now()) {
  const ref = db.collection('paymentRateLimits').doc(digest(`${uid}:${action}`));
  await db.runTransaction(async tx => {
    const old = (await tx.get(ref)).data(); const windowStart = Math.floor(now / 60_000) * 60_000;
    const count = old?.windowStart === windowStart ? old.count + 1 : 1;
    requireCondition(count <= (action === 'create' ? 10 : 30), 'RATE_LIMITED', 429);
    tx.set(ref, { windowStart, count, expiresAt: new Date(windowStart + 120_000) });
  });
}
export function failure(res: Response, error: unknown) {
  const known = error instanceof PaymentError;
  const code = known ? error.code : 'PAYMENT_SERVICE_ERROR';
  console.error('Payment operation failed', { code });
  return res.status(known ? error.status : 503).json({ code, error: code });
}
export function prepare(req: Request, res: Response, method = 'POST') {
  res.setHeader('Cache-Control', 'no-store');
  requireCondition(req.method === method, 'METHOD_NOT_ALLOWED', 405);
}
