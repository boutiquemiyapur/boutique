const ORIGIN = 'https://abcollectionbyaadya.in';
const staticPaths = ['/', '/shop', '/about', '/contact', '/collections/kanjeevaram-silks', '/collections/banarasi-brocades', '/collections/designer-sarees', '/collections/bridal-lehengas', '/collections/chikankari-suits', '/collections/temple-antique-jewelry'];
type FirestoreValue = { stringValue?: string; booleanValue?: boolean; mapValue?: { fields?: Record<string, FirestoreValue> } };
type FirestoreDocument = { fields?: Record<string, FirestoreValue> };
const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]!);
const entry = (path: string) => `<url><loc>${escapeXml(`${ORIGIN}${path}`)}</loc></url>`;

const loadProductPaths = async () => {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) return [];
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/products?pageSize=1000`, { signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error(`Firestore catalog request returned ${response.status}.`);
  const payload = await response.json() as { documents?: FirestoreDocument[] };
  return (payload.documents || []).flatMap((document) => {
    const fields = document.fields || {};
    const data = fields.data?.mapValue?.fields || {};
    const id = data.id?.stringValue;
    const active = data.isActive?.booleanValue !== false && fields.status?.stringValue !== 'inactive' && fields.status?.stringValue !== 'archived';
    return id && active ? [`/product/${encodeURIComponent(id)}`] : [];
  });
};

export default async function handler(request: { method?: string }, response: { status: (code: number) => { setHeader: (name: string, value: string) => unknown; send: (value: string) => void } }) {
  if (request.method !== 'GET') return response.status(405).send('Method not allowed');
  let productPaths: string[] = [];
  try { productPaths = await loadProductPaths(); } catch (error) { console.warn('Product sitemap fallback used.', error); }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...staticPaths, ...productPaths].map(entry).join('')}</urlset>`;
  response.status(200).setHeader('Content-Type', 'application/xml; charset=utf-8');
  response.status(200).setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  return response.status(200).send(xml);
}
