# Cloudinary media uploads

New Admin uploads use a signed browser-to-Cloudinary flow. Firebase remains responsible for Authentication and Firestore; existing Firebase Storage and external image URLs continue to render.

Configure these server-only Vercel and local environment variables (never prefix them with `VITE_`):

```text
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```

`FIREBASE_ADMIN_PRIVATE_KEY` should contain the service-account private key, with newline characters represented as `\n` in Vercel. The Firebase Admin credentials let `/api/cloudinary/sign` verify the caller's Firebase ID token and `admin: true` custom claim.

The browser requests a signature, uploads directly to Cloudinary, then stores Cloudinary `secure_url` values in the existing Firestore fields (`Product.images`, banner image fields, and About image). New assets are organized under `ab-collections/products/{id}`, `ab-collections/banners/{id}`, and `ab-collections/about/{id}` with a server-signed upload ID. Replacing an image updates Firestore only; old Cloudinary assets are not automatically deleted because they may still be referenced.
