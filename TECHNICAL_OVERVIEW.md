# AB Collection by Aadya — Technical Overview

This document describes the current application architecture and is intended as an onboarding reference for developers working on the project.

## 1. Project summary

AB Collection by Aadya is a responsive boutique storefront and administration application. It is implemented as a React single-page application, backed by Firebase Authentication and Cloud Firestore. Product and CMS media are uploaded directly from the browser to Cloudinary after a protected Vercel function creates a signed upload request.

The public site includes product browsing, search and filters, cart, wishlist, customer authentication, account management, Cash on Delivery checkout, order history/tracking, customer cancellation, contact enquiries, responsive banners, and route-aware SEO metadata. The `/admin` area includes catalog, inventory, order, customer, banner, content, contact, About, enquiry, and settings management.

## 2. Technology stack

| Area | Technology |
| --- | --- |
| UI | React 19, TypeScript 5.8 |
| Build and local development | Vite 6 |
| Styling | Tailwind CSS 4 through `@tailwindcss/vite`, plus shared CSS in `src/index.css` |
| Icons and motion | Lucide React, Motion |
| Client state | React Context and hooks in `StoreContext.tsx` |
| Authentication | Firebase Authentication, email/password |
| Database | Cloud Firestore |
| Server authentication | Firebase Admin SDK and Firebase custom claims |
| Media | Cloudinary signed browser uploads |
| Hosting and functions | Vercel static hosting and Node.js serverless functions |
| Routing | Custom History API router; React Router is not installed |
| SEO | Client-managed metadata/JSON-LD, `robots.txt`, and a serverless XML sitemap |
| Tests | Node test runner with `tsx` for the Cloudinary signer regression suite |

The package name is still `react-example`; it has not been renamed to the product name.

## 3. Application structure

```text
api/
  cloudinary/sign.ts          Protected Cloudinary signature endpoint
  sitemap.ts                  Dynamic XML sitemap endpoint
public/
  robots.txt                  Crawler rules
scripts/
  set-admin-claim.mjs         Grant/revoke Firebase admin custom claims
  cloudinary-sign.test.ts     Signer and upload-contract regression tests
src/
  components/
    account/                  Customer profile, addresses, orders
    admin/                    Protected store administration
    auth/                     Sign-in, registration, password reset
    cart/                     Cart page and drawer
    checkout/                 Checkout and order confirmation
    common/                   Shared product/UI/SEO components
    home/                     Storefront homepage sections
    layout/                   Header and footer
    pages/                    About, contact, tailoring and policy pages
    product/                  Product detail page
    shop/                     Product listing, search, filtering and sorting
    tracking/                 Order tracking
  config/                     Brand and SEO configuration
  context/StoreContext.tsx    Main application state and business orchestration
  data/                       Catalog and content fallback data
  firebase/                   Firebase client initialization and auth helpers
  services/                   Firestore, contact and media repositories
  types/index.ts              Shared domain model
```

`src/App.tsx` is the application shell and view switch. `StoreProvider` owns most global state and exposes storefront, account, checkout and admin operations. Repository modules contain Firebase and Cloudinary access so UI components do not call those services directly.

## 4. Routing

The application does not use React Router. `StoreContext.tsx` maps `AppView` values to paths, calls `window.history.pushState`, parses `window.location.pathname`, and listens for `popstate` in `App.tsx`. Vercel rewrites unknown paths to `index.html` so direct SPA navigation works.

Primary routes:

| Route | Purpose | Access/indexing |
| --- | --- | --- |
| `/` | Home | Public, indexable |
| `/shop` | All products | Public, indexable unless search state is active |
| `/collections/{supported-slug}` | Category-filtered shop | Public, indexable |
| `/product/{id}` | Active product details | Public, indexable when valid/active |
| `/about`, `/contact` | Business content and enquiries | Public, indexable |
| `/cart`, `/wishlist` | Customer shopping state | Public UI, noindex |
| `/login`, `/register`, `/forgot-password` | Authentication | Noindex |
| `/account` | Profile, addresses and orders | Authenticated customer, noindex |
| `/checkout` | Cash on Delivery checkout | Authenticated customer, noindex |
| `/order-confirmation/{id}` | Newly placed order | Noindex |
| `/orders/{id}` | Order tracking/details | Customer/admin data rules apply, noindex |
| `/admin` | Store administration | Authenticated user with `admin: true`, noindex |
| `/shipping`, `/returns`, `/cancellation`, `/privacy`, `/terms`, `/cookies` | Static policy views | Currently noindex |

Supported category slugs are explicitly mapped in both routing and SEO configuration. When adding a new indexed category route, update `categoryFromSlug` in `StoreContext.tsx`, `CATEGORY_PATHS` in `src/config/seo.ts`, and the static sitemap routes in `api/sitemap.ts`.

## 5. State and data flow

`StoreContext.tsx` is the main orchestration layer. It manages:

- authentication status and session;
- catalog, filters, selected product and currency display;
- cart, wishlist and coupons;
- customer profile, saved addresses and measurements;
- orders, order cancellation and tracking;
- checkout totals and order creation;
- modals, drawers and toast messages;
- selected route/view and History API navigation;
- a subset of admin mutations.

The public catalog uses a Firestore onSnapshot subscription and shared product normalization. Empty or failed reads never show bundled/local products. Coupons also load only from Firestore. Product and coupon browser-storage fallbacks are no longer used. Missing optional product characteristics remain empty; see ADMIN_DRIVEN_CATALOG_REPORT.md for the schema, editor controls and validation limits.

Authenticated customer data is not persisted in browser storage. Profile, cart, wishlist, addresses, measurements and orders are loaded from and written to Firestore using the signed-in Firebase UID. Logging out resets private in-memory state.

## 6. Firestore data model

The application stores domain objects inside a `data` field in several documents while keeping selected fields at the document root for rules and queries.

| Path | Purpose | Typical shape/access |
| --- | --- | --- |
| `/products/{productId}` | Product catalog | `data`, `category`, `sku`, `status`, timestamps; public read, admin write |
| `/categories/{categoryId}` | Category definitions | Public read, admin write |
| `/banners/{bannerId}` | Responsive homepage banners | `data.image`, optional `data.mobileImage`; public read, admin write |
| `/siteContent/home` | Homepage/footer copy | Public read, admin write |
| `/about/main` | About-page content | Public read, admin write |
| `/contact/main` | Public business/contact details | Public read, admin write |
| `/settings/admin` | Admin/store settings | Public read in current rules, admin write |
| `/coupons/{code}` | Coupon definitions | Public read, admin write |
| `/users/{uid}` | Customer profile and saved private data | Owner/admin read; owner profile updates are constrained |
| `/carts/{uid}` | Customer cart | Owner/admin only |
| `/wishlists/{uid}` | Customer wishlist product IDs | Owner/admin only |
| `/orders/{orderId}` | Canonical order record | Owner by `customerId` or admin; narrowly constrained customer create/cancel |
| `/users/{uid}/orders/{orderId}` | Legacy orders | Read-compatible; new checkout does not write here |
| `/reviews/{reviewId}` | Product reviews | Public read; signed-in submission; admin/owner rules apply |
| `/contactMessages/{messageId}` | Customer enquiries | Validated public create; admin-only read/update/delete |
| `/customers/{customerId}` | Admin customer records | Admin only |

All new orders use `/orders/{orderId}` as the canonical path. The code reads older `/users/{uid}/orders` records for compatibility, and the admin initialization includes an idempotent migration that promotes missing legacy orders to the canonical collection.

Firestore rules are maintained in `firestore.rules`. The project does not currently contain a `firebase.json`, so rule deployment is a separate operational step and should not be assumed from a frontend/Vercel deployment.

## 7. Authentication and authorization

Customer authentication uses Firebase email/password sign-in, registration, sign-out and password-reset email. Persistence can be local or session-based through the “remember” choice.

Admin access is based on a Firebase custom claim:

```json
{ "admin": true }
```

The client refreshes the ID token before deriving `isAdmin`. This only controls the UI; real authorization is enforced again by Firestore rules and by `/api/cloudinary/sign` using Firebase Admin `verifyIdToken`.

Use the existing script to manage the claim:

```bash
npm run admin:grant -- user@example.com
npm run admin:revoke -- user@example.com
```

The script requires Firebase Admin credentials or `GOOGLE_APPLICATION_CREDENTIALS`. After changing a claim, the user must obtain a refreshed token, normally by signing out and back in.

## 8. Commerce behavior

Cart lines are distinguished by product, color, size and tailoring choice. Quantities are normalized before persistence. Current cart product data is resolved against the live catalog; options and combined product-level quantities are validated. Checkout re-reads the catalog before saving, while historical orders retain their purchased snapshots. Wishlist entries are normalized into unique product IDs.

Checkout requires an authenticated customer and a non-empty cart. It records a canonical Firestore order with customer ownership, totals, shipping choice, coupon data, timeline and a `Pending` payment state. Standard and express shipping are represented; the current payment type is intentionally limited to:

```ts
type PaymentMethod = 'cod';
```

There is no live Razorpay or other online-payment transaction in the current checkout. Do not describe online payment as implemented without adding a trusted server-side payment/order-verification flow.

Customers may cancel only eligible pre-dispatch orders. Firestore rules restrict the exact fields that an owner may change. Fulfilment status, tracking, prices, stock and administrative order changes remain admin-controlled.

Product stock is displayed and editable in admin. Order creation currently records an order but does not implement an atomic server-side inventory reservation/transaction, so concurrent overselling protection should be treated as a future backend concern.

## 9. CMS and admin portal

The `/admin` route is rendered only when the Firebase session contains `admin: true`. Its navigation contains:

- dashboard metrics and recent orders;
- products and publication/archive controls;
- order status management;
- customer list;
- inventory and low-stock threshold management;
- desktop/mobile banners;
- storefront copy;
- contact information;
- About-page content and image;
- customer enquiries and enquiry statuses;
- settings.

Admin mutations generally write from the browser to Firestore and rely on Firebase Auth plus Firestore rules. Product, banner and About images use the shared `MediaUploader`, `cmsRepository.uploadImage`, and `mediaUploadService` path.

## 10. Cloudinary media uploads

The upload sequence is:

```text
Admin selects an image
  → shared MediaUploader validates JPG/PNG/WEBP and maximum 8 MB
  → browser obtains a fresh Firebase ID token
  → POST /api/cloudinary/sign with Bearer token, folder and recordId
  → Vercel function verifies Firebase token and admin claim
  → function signs folder, public_id and timestamp with CLOUDINARY_API_SECRET
  → browser uploads the file directly to Cloudinary
  → Cloudinary returns secure_url and public_id
  → secure_url is placed into the form
  → saving the form writes the URL into Firestore
```

Allowed logical folders are `products`, `banners`, and `about`. Assets are organized below `ab-collections/{folder}/{recordId}`. Desktop banners expect 1920 × 800; mobile banners expect 1080 × 1350. When no mobile image exists, the storefront uses the desktop image on mobile.

The Cloudinary API secret and Firebase Admin credentials must never use a `VITE_` prefix or be returned to the browser.

Current checkout note: the production signer failure has been diagnosed as Firebase Admin's `jwks-rsa` dependency requiring the ESM-only `jose` package while Vercel disables CommonJS `require(esm)` by default. The handler diagnostics and regression coverage are present in the current checkout. Production requires this server variable and a new deployment containing the fix:

```text
NODE_OPTIONS=--experimental-require-module
```

See `CLOUDINARY_SETUP.md` for the full status and verification procedure.

## 11. SEO and deployment

`SeoManager.tsx` and `src/config/seo.ts` update title, description, canonical URL, robots directives, Open Graph/Twitter metadata and JSON-LD for the active client route. Valid active products and supported collections are indexable; private, invalid, search-result and policy placeholder views are noindex.

`api/sitemap.ts` returns `/sitemap.xml`. It fetches active public products from the Firestore REST API and falls back to static public routes when catalog loading fails. `public/robots.txt` points crawlers to the sitemap.

`vercel.json` maps `/sitemap.xml` before the SPA catch-all. Vercel recognizes files under `/api` as serverless functions, so `/api/cloudinary/sign` and `/api/sitemap` are not handled by the SPA fallback.

Route metadata is client-rendered because this is a Vite SPA. Crawlers that do not execute JavaScript and some social preview bots may see only the base `index.html` metadata. Full route-level HTML metadata would require prerendering or SSR.

The production origin in SEO configuration is:

```text
https://abcollectionbyaadya.in
```

## 12. Environment variables

Browser-visible Firebase configuration:

```text
VITE_FIREBASE_ENABLED
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_ENABLE_ANONYMOUS_AUTH
```

Server-only Vercel function configuration:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
NODE_OPTIONS=--experimental-require-module
```

`FIREBASE_ADMIN_PRIVATE_KEY` should preserve newline characters as documented in `CLOUDINARY_SETUP.md`. Never place an Admin credential or Cloudinary API secret in `.env.example`, frontend code, a `VITE_` variable, logs or API responses.

## 13. Local development and validation

Prerequisites:

- Node.js 22 or newer for the installed Firebase Admin version;
- npm dependencies installed from `package-lock.json`;
- a local `.env.local` containing the required client Firebase variables;
- server credentials only when running or testing server-side authenticated functionality.

Commands:

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
node --experimental-require-module --import tsx --test scripts/cloudinary-sign.test.ts
git diff --check
```

The Vite development command serves the frontend at port 3000. Vite alone does not execute Vercel `/api` functions. Use a Vercel-compatible local environment when exercising serverless routes end to end.

The `lint` script currently runs `tsc --noEmit`; ESLint is not configured. The production build emits a known large JavaScript chunk warning. The repository includes the Cloudinary regression suite and 18 catalog/data/rendering regression tests. Run the latter with `node --test scripts/admin-driven-catalog.test.mjs`; its Firebase/context adapters are local test doubles. Browser interaction and live Admin/Firebase propagation still need the manual checks in ADMIN_DRIVEN_CATALOG_REPORT.md.

## 14. Important maintenance notes

- Preserve the repository/context/component separation when extending the application.
- Update the custom route parser, SEO mapping and sitemap together when introducing public routes.
- Treat Firestore rules as part of every schema or client-write change.
- Do not store customer profiles, addresses, carts, wishlists or orders in local storage.
- Keep Cloudinary signing and Firebase Admin credentials server-side.
- Use canonical `/orders/{orderId}` records for new order work; keep legacy reads until migration is confirmed complete.
- Online payments, atomic inventory reservation, server-side checkout price verification and SSR/prerendering are not implemented.
- The current checkout contains the Cloudinary signer fix, its regression test and documentation. Configure Vercel, deploy the relevant commit and smoke-test it before considering that production issue resolved.
