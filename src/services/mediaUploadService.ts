import { firebaseAuth } from '../firebase/config';

export type MediaFolder = 'products' | 'banners' | 'about';
export interface UploadedMedia { secureUrl: string; publicId: string; width?: number; height?: number; bytes?: number; format?: string; }

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadMedia = async (file: File, folder: MediaFolder, recordId: string, onProgress: (percent: number) => void): Promise<UploadedMedia> => {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Please upload a JPG, PNG, or WEBP image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image size must be 8 MB or smaller.');
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Please sign in as an administrator before uploading an image.');
  const token = await user.getIdToken();
  const signatureResponse = await fetch('/api/cloudinary/sign', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ folder, recordId })
  });
  const signature = await signatureResponse.json().catch(() => null) as { error?: string; cloudName?: string; apiKey?: string; timestamp?: number; signature?: string; folder?: string; publicId?: string } | null;
  if (!signatureResponse.ok || !signature?.cloudName || !signature.apiKey || !signature.signature || !signature.folder || !signature.publicId || !signature.timestamp) throw new Error(signature?.error || 'Could not prepare the secure image upload.');
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new Error('Image upload failed. Check your connection and try again.'));
    request.onload = () => {
      const result = (() => { try { return JSON.parse(request.responseText) as Record<string, unknown>; } catch { return null; } })();
      if (request.status < 200 || request.status >= 300 || !result || typeof result.secure_url !== 'string' || typeof result.public_id !== 'string') { reject(new Error(typeof result?.error === 'object' && result.error ? 'Cloudinary rejected the image upload.' : 'Image upload failed. Please try again.')); return; }
      resolve({ secureUrl: result.secure_url, publicId: result.public_id, width: typeof result.width === 'number' ? result.width : undefined, height: typeof result.height === 'number' ? result.height : undefined, bytes: typeof result.bytes === 'number' ? result.bytes : undefined, format: typeof result.format === 'string' ? result.format : undefined });
    };
    const body = new FormData();
    body.append('file', file); body.append('api_key', signature.apiKey); body.append('timestamp', String(signature.timestamp)); body.append('signature', signature.signature); body.append('folder', signature.folder); body.append('public_id', signature.publicId);
    request.send(body);
  });
};
