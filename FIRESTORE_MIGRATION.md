# Firestore migration guide

The app deliberately does not bulk-copy browser `localStorage` to Firestore. The catalog is curated production data; customer data is private and must be created under an authenticated user ID.

## Collection layout

- `products/{productId}`: `{ data: Product, category, sku, status, createdAt, updatedAt }`
- `categories/{categoryId}`: curated category metadata
- `users/{uid}`: `{ profile: CustomerProfile, role: 'customer', createdAt, updatedAt }`
- `users/{uid}/orders/{orderId}`: private customer checkout request/display snapshot
- `carts/{uid}` and `wishlists/{uid}`: private customer state
- `coupons/{couponId}`, `reviews/{reviewId}`, `customers/{uid}`, `settings/{settingId}`
- `orders/{orderId}`: reserved for canonical, server-validated fulfilment orders. The browser never writes this collection.

## Required Firebase Console work

1. Create a Firestore database in production mode for project `boutique-79308`.
2. Deploy `firestore.rules` with Firebase CLI: `firebase deploy --only firestore:rules`.
3. In **Authentication → Sign-in method**, enable **Email/Password**. This app implements email/password sign-up, sign-in, sign-out, session persistence, and password reset. Add your deployed domain under **Authentication → Settings → Authorized domains**.
4. Set Firebase custom claim `admin: true` only from a trusted Admin SDK environment. Never issue it in the browser.
5. Seed product/category/coupon documents from a reviewed export or trusted server task. Do not import a customer's local browser storage.
6. Build a Cloud Function/Run endpoint before accepting real orders. It must load current product/coupon data, calculate totals and GST, reserve stock, and set payment/fulfilment fields.

## Current migration behavior

Catalog and coupons attempt Firestore reads first and retain their bundled curated data if Firestore is empty/unavailable. Private cart, wishlist, profile, measurements, addresses, and checkout requests use Firestore only when a Firebase user is authenticated; otherwise they retain local fallback data. On the first successful sign-in, a non-empty guest cart and wishlist are deliberately copied to an empty authenticated cart/wishlist; no other browser storage is bulk-migrated.

## Security boundary

Firestore Rules protect customer documents by Firebase UID and use a Firebase Authentication custom claim (`admin: true`) for administration. The claim must be assigned on a trusted server with the Firebase Admin SDK. The customer-side order document is not trusted for payment, pricing, discount, inventory, or fulfilment. A Cloud Function/Run checkout endpoint must validate those values and create the canonical `orders/{orderId}` record before this application can process real sales.
