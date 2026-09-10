import { createHash } from 'node:crypto';

const allowedFolders = new Set(['products', 'banners', 'about']);
// Only fixed, known codes may be logged. SDK error messages can contain credentials or tokens.
const safeErrorCodes = new Set([
  'ERR_REQUIRE_ESM', 'ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND',
  'app/invalid-credential', 'auth/invalid-credential',
  'auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired',
  'auth/id-token-revoked', 'auth/user-disabled', 'auth/internal-error',
]);
const invalidTokenCodes = new Set([
  'auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired',
  'auth/id-token-revoked', 'auth/user-disabled',
]);

export default async function handler(request: { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }, response: { status: (code: number) => { json: (value: unknown) => void } }) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const authorization = request.headers.authorization;
  const token = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return response.status(401).json({ error: 'Authentication is required.' });
  let stage = 'firebase-sdk-load';
  try {
    // Keep dependency-load failures inside the handler so Vercel can return safe JSON diagnostics.
    // The runtime still needs NODE_OPTIONS=--experimental-require-module; see CLOUDINARY_SETUP.md.
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    stage = 'firebase-configuration';
    let app = getApps()[0];
    if (!app) {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
      if (!projectId || !clientEmail || !privateKey) {
        console.error('Cloudinary signature request failed.', { stage, code: 'incomplete-configuration' });
        return response.status(503).json({ error: 'Upload authorization server configuration is incomplete.' });
      }
      app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
    stage = 'firebase-token-verification';
    const decoded = await getAuth(app).verifyIdToken(token);
    if (decoded.admin !== true) return response.status(403).json({ error: 'Administrator access is required.' });
    let body: unknown;
    try {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    } catch {
      return response.status(400).json({ error: 'Invalid upload request.' });
    }
    if (!body || typeof body !== 'object' || !('folder' in body) || typeof body.folder !== 'string' || !allowedFolders.has(body.folder) || !('recordId' in body) || typeof body.recordId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.recordId)) return response.status(400).json({ error: 'Invalid upload request.' });
    stage = 'cloudinary-configuration';
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (!cloudName || !apiKey || !apiSecret) {
      console.error('Cloudinary signature request failed.', { stage, code: 'incomplete-configuration' });
      return response.status(503).json({ error: 'Cloudinary server configuration is incomplete.' });
    }
    stage = 'cloudinary-signature';
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `ab-collections/${body.folder}/${body.recordId}`;
    const publicId = `upload-${timestamp}`;
    const signature = createHash('sha1').update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest('hex');
    return response.status(200).json({ cloudName, apiKey, timestamp, folder, publicId, signature });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && safeErrorCodes.has(error.code) ? error.code : 'unexpected-error';
    console.error('Cloudinary signature request failed.', { stage, code });
    if (stage === 'firebase-token-verification' && invalidTokenCodes.has(code)) return response.status(401).json({ error: 'Could not authorize this upload. Please sign in again.' });
    if (stage === 'firebase-sdk-load') return response.status(503).json({ error: 'Secure upload service could not start. Check the server runtime configuration.' });
    if (stage === 'firebase-configuration') return response.status(503).json({ error: 'Upload authorization server configuration is invalid.' });
    if (stage === 'firebase-token-verification') return response.status(503).json({ error: 'Upload authorization service is temporarily unavailable.' });
    return response.status(500).json({ error: 'Could not prepare the secure image upload.' });
  }
}
