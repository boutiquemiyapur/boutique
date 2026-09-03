import { createHash } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const allowedFolders = new Set(['products', 'banners', 'about']);
const adminApp = () => {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin credentials are not configured.');
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
};

export default async function handler(request: { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }, response: { status: (code: number) => { json: (value: unknown) => void } }) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  try {
    const authorization = request.headers.authorization;
    const token = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return response.status(401).json({ error: 'Authentication is required.' });
    const decoded = await getAuth(adminApp()).verifyIdToken(token);
    if (decoded.admin !== true) return response.status(403).json({ error: 'Administrator access is required.' });
    const body = typeof request.body === 'string' ? JSON.parse(request.body) as { folder?: string; recordId?: string } : request.body as { folder?: string; recordId?: string } | undefined;
    if (!body?.folder || !allowedFolders.has(body.folder) || !body.recordId || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.recordId)) return response.status(400).json({ error: 'Invalid upload request.' });
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) return response.status(503).json({ error: 'Cloudinary is not configured.' });
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `ab-collections/${body.folder}/${body.recordId}`;
    const publicId = `upload-${timestamp}`;
    const signature = createHash('sha1').update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest('hex');
    return response.status(200).json({ cloudName, apiKey, timestamp, folder, publicId, signature });
  } catch (error) { console.error('Cloudinary signature request failed.', error); return response.status(401).json({ error: 'Could not authorize this upload.' }); }
}
