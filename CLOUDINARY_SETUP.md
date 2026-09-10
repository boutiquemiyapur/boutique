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

## Vercel runtime requirement

The installed dependency chain is `firebase-admin@14.3.0` → `jwks-rsa@4.1.0` → `jose@6.2.10`. `jwks-rsa` loads the ESM-only `jose` package using CommonJS `require()`. Vercel disables this Node feature by default. Without enabling it, importing Firebase Admin Auth fails with `ERR_REQUIRE_ESM` before the original handler runs, producing HTTP 500 / `FUNCTION_INVOCATION_FAILED`.

In Vercel, open **boutique8 → boutique → Settings → Environment Variables** and add:

```text
NODE_OPTIONS=--experimental-require-module
```

Select **Production**. For Preview testing, configure this setting and the six server variables above in **Preview** as well. If `NODE_OPTIONS` already exists, preserve any needed options and remove a conflicting `--no-experimental-require-module` flag. Under **Settings → Build and Deployment**, verify a supported Node.js version meeting Firebase Admin 14's Node >=22 requirement (22.x or 24.x).

This is Vercel's documented [require(ESM) configuration](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration#experimental-nodejs-require-of-es-module). It preserves the existing dependency versions, Firebase token verification, and signed-upload contract. Changing credentials or rewriting the uploader does not fix this runtime failure. Environment changes apply to a **new deployment**; redeploy after approval ([Vercel environment documentation](https://vercel.com/docs/environment-variables/managing-environment-variables)).

Production inspection on 2026-09-10 confirmed all six server variable names exist with Production scope, while `NODE_OPTIONS` was absent. Values were not retrieved or validated. The active deployment was `2fed545`; logs for both GET and POST `/api/cloudinary/sign` showed `ERR_REQUIRE_ESM` from `jwks-rsa/src/utils.js`. The endpoint was deployed as a Node function, so the SPA rewrite did not intercept these requests. No routing change is needed.

The handler now catches Firebase SDK loading failures and returns safe JSON with HTTP 503. Configuration failures also return 503, invalid input returns 400, missing/invalid authentication returns 401, and a missing admin claim returns 403. Logs contain only a fixed stage and allowlisted error code, never raw SDK exceptions, tokens, or environment values. These diagnostics alone do not enable the required runtime feature.

## Local verification and deployment smoke test

Run:

```text
npm run lint
npm run build
node --experimental-require-module --import tsx --test scripts/cloudinary-sign.test.ts
git diff --check
```

The regression test uses generated disposable credentials and mocks token verification and Cloudinary transport; it never reads production secrets or uploads assets. It also reproduces the import failure with require(ESM) disabled, and verifies the runtime flag fixes that import.

`npm run dev` serves the Vite frontend only; it does not execute `/api` functions. After an approved deployment, check GET `/api/cloudinary/sign` returns JSON 405, then use an authenticated admin to upload and save a desktop banner (1920 × 800) and mobile banner (1080 × 1350). Confirm signer 200, Cloudinary success, progress, preview, and saved images after reload. Check product and About uploads through the same uploader. The existing mobile-to-desktop fallback remains in place. A real end-to-end upload still requires this deployment and a valid admin session.

The browser requests a signature, uploads directly to Cloudinary, then stores Cloudinary `secure_url` values in the existing Firestore fields (`Product.images`, banner image fields, and About image). New assets are organized under `ab-collections/products/{id}`, `ab-collections/banners/{id}`, and `ab-collections/about/{id}` with a server-signed upload ID. Replacing an image updates Firestore only; old Cloudinary assets are not automatically deleted because they may still be referenced.
