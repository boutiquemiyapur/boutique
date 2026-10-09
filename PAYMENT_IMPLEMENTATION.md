# AB Collections Razorpay implementation handoff

Implemented locally on 2026-10-05. No deployment, commit, push, live credentials or real payments. This is not a production-readiness certification.

## Current deployment policy (supersedes historical staging instructions below)

Use existing Production Firebase and LIVE Razorpay. Production requires only its
own Firebase identity pins; it does not require a Test Firebase project. Firebase
storefront builds and Cloudinary authorization are independent of Razorpay secrets.
Connected Preview/Development remains blocked until separate safe Test configuration
exists. See PAYMENT_ENVIRONMENTS.md for the authoritative variables and checklist.
Historical sections 18-22 describe the earlier staging plan, not current requirements.

## 1. What was implemented

Razorpay-only new checkout, trusted server pricing, stable checkout identity, 15-minute transactional inventory reservations, server signature verification, raw-body signed webhooks, refund synchronization, durable event deduplication, scheduled reconciliation, and customer retry/recovery. Existing Firebase Authentication, Firestore catalog, historical COD reads and Cloudinary uploads remain.

## 2. Files created

```text
api/payments/create-order.ts
api/payments/verify.ts
api/payments/webhook.ts
api/payments/status.ts
api/payments/reconcile.ts
api/orders/fulfil.ts
server/payments/errors.ts
server/payments/validation.ts
server/payments/checkout.ts
server/payments/provider.ts
server/payments/http.ts
server/payments/service.ts
server/orders/fulfil.ts
src/services/paymentClient.ts
src/components/checkout/PaymentRecovery.tsx
scripts/payment-foundation.test.ts
scripts/payment-client.test.mjs
scripts/payment-rules.test.mjs
scripts/payment-emulator.test.ts
scripts/payment-emulator-runner.mjs
firebase.payments.test.json
firestore.indexes.json
PAYMENT_IMPLEMENTATION.md
```

## 3. Files modified

`src/types/index.ts`, `src/context/StoreContext.tsx`, `src/services/commerceRepository.ts`, `src/services/cmsRepository.ts`, checkout/confirmation/account/tracking components, `AdminPortalPage.tsx`, `api/orders/create.ts`, `scripts/order-transaction.test.mjs`, `firestore.rules`, `firebase.json`, `package.json`, `.env.example`.

No dependencies were added. Local secret files and existing asset/media files were not changed. The obsolete COD transaction tests were replaced with a COD-disabled endpoint regression; payment transaction coverage lives in the new suites.

## 4. New Firestore collections/schema

Records are created at runtime, not seeded into a live database by this implementation.

| Collection | Fields/purpose |
|---|---|
| `checkoutRequests/{businessId}` | `customerId`, normalized request `fingerprint`, `orderId`, server `createdAt` |
| `paymentAttempts/{businessId}` | `customerId`, `orderId`, `receipt`, `state: CREATING/UNKNOWN/READY`, `startedAt`, `nextCheckAt`, optional `razorpayOrderId` |
| `paymentEvents/{hash(eventId)}` | raw-body `hash`, `orderId`, `paymentId`, `processedAt`; unrelated unsupported events can be recorded as ignored |
| `inventoryReservations/{businessId}` | `customerId`, `orderId`, `state: RESERVED/CONSUMED/RELEASED`, server `expiresAt` milliseconds, optional `generation`, transition timestamps, lean reserved item/variant/quantity records |
| `inventoryMovements/{transitionId}` | `orderId`, `type: RESERVE/CONSUME/RELEASE`, quantities/options, optional generation, timestamp |
| `paymentRateLimits/{hashedUidAction}` | server minute window, count, timestamp expiry |

Canonical `/orders/{businessId}` retains the existing envelope and nested `data: Order`. New snapshot fields are `checkoutIntentId`, `paymentProvider: razorpay`, `paymentMethod: razorpay`, `amountPaise`, INR currency, payment state, reservation expiry, provider IDs, captured/verified timestamps, refunded paise and `paymentReviewRequired`.

Payment states: `CREATED`, `PAYMENT_PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `EXPIRED`, `REFUND_PENDING`, `PARTIALLY_REFUNDED`, `REFUNDED`. Historical `Paid/Pending/Failed` remain readable. Fulfilment status is separate.

## 5. Firestore security changes

Customers and browser admins cannot create/delete canonical orders or write payment operational collections. Canonical browser-admin updates allow only fulfilment/timeline/tracking fields. Payment provider, IDs, amount, currency, refund state, review flag and verification timestamps are protected by nested/top-level diff allowlists.

Ordinary customer cancellation remains available for eligible historical COD orders only. Online cancellations/refund assistance go through the store. Legacy subcollection orders remain readable but browser writes are denied. Their financial fields are never converted to Razorpay fields.

Admin fulfilment API checks the trusted custom claim and rejects unpaid/review-held online orders. A missing canonical historical COD document can be copied faithfully from one existing legacy record inside that trusted transaction when an admin performs fulfilment. The prior automatic browser migration is disabled.

Deploy these rules together with the application only after test-environment validation. Old deployed rules do not protect newly added financial fields.

Environment selection and the current Production/Preview setup are documented in
[PAYMENT_ENVIRONMENTS.md](./PAYMENT_ENVIRONMENTS.md). Its strict deployment guards
supersede the original Test/Live configuration instructions in this document.

## 6. New API endpoints

| Endpoint | Access/behavior |
|---|---|
| `POST /api/payments/create-order` | Revocation-checked Firebase identity, bounded request, rate limit, trusted pricing/reservation, server Razorpay Orders API; returns customer order and client-safe Checkout parameters |
| `POST /api/payments/verify` | Owner check, stored provider mapping, HMAC signature, fresh provider payment/refund evidence, shared transactional updater |
| `POST /api/payments/status` | Owner-scoped trusted reconciliation and status |
| `POST /api/payments/webhook` | Raw-body HMAC authentication, durable event deduplication, fresh provider evidence, same updater |
| `GET /api/payments/reconcile` | Constant-time `Bearer CRON_SECRET` check; processes five oldest due attempts concurrently and reschedules them |
| `POST /api/orders/fulfil` | Revocation-checked admin custom claim; only fulfilment/tracking changes, preserving financial truth |

`/api/orders/create` now returns HTTP 410 with `COD_DISABLED`. No endpoint initiates refunds.

## 7. Inventory reservation design

Available catalog stock is reduced transactionally when a reservation is created. This is a temporary availability hold, not a second permanent stock deduction on payment. `inventoryVersion` advances so existing optimistic inventory editors notice concurrent changes.

Captured payment changes RESERVED to CONSUMED without deducting stock again. Expiry restores units and changes RESERVED to RELEASED once. Server time is authoritative. Never use document TTL deletion to release stock: the ledger transaction must run first.

The protected scheduler, webhooks and owner status checks reconcile provider evidence before releasing. If the provider is unavailable, fail closed and retry later. Paid inventory cannot be released.

Late captured payment after release is truthfully recorded as PAID with `paymentReviewRequired=true`. No inventory is silently deducted from another customer's units. Fulfilment is blocked; the store must review and use Dashboard refund or a separately reviewed trusted inventory-recovery operation. There is no browser override for this flag.

Inventory admin counts now mean AVAILABLE stock, excluding unpaid reserved units. Do not add reserved units back manually or change/delete variant identities while reservations exist. If a reserved variant disappears, release fails closed for operator review rather than creating guessed inventory.

## 8. Idempotency design

Browser storage contains only UID-scoped request hashes and intent IDs, not addresses or payment credentials. Web Locks serialize ID acquisition across tabs where available. Context also guards one in-flight checkout. Identical requests survive refresh/retry/back navigation.

Server identity is SHA-256 of the FULL verified UID plus intent ID. A separately stored fingerprint binds normalized business data; conflicting reuse is rejected. Prices/status/currency are not accepted as request fields.

Provider creation occurs outside transaction callbacks. Only a newly committed attempt issues that POST. Uncertain outcomes never automatically issue another provider POST. After a grace period, recovery searches the provider creation window for the stored receipt and checks amount/currency/internal mapping. Zero or multiple matches require review. Receipt is not treated as provider idempotency.

## 9. Retry Payment behavior

Unpaid Razorpay orders are reused under the same business intent. Failed attempts and Checkout dismissal do not create another purchase. Expired released reservations can be renewed under the same business/provider order if current trusted options/stock and frozen prices still match. Changed pricing fails closed.

Unknown provider creation is held for reconciliation/review; no unsafe automatic replacement order is created. The current architecture has one durable provider attempt per business intent. A future replacement-provider-order workflow must first establish that the old order cannot charge and remain under that same intent.

## 10. Webhook behavior

`config.api.bodyParser=false` is set. The handler rejects already-parsed objects, reads bounded raw bytes and validates HMAC-SHA256 using the webhook secret before parsing JSON. It deduplicates `x-razorpay-event-id`, falling back to the raw-body hash when absent.

Subscriptions handled: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.

Provider order notes/receipt and stored mapping must agree. Amount, INR currency and payment identity must match. Event acknowledgement follows the database commit. Failed events cannot downgrade captured/refunded state. Duplicate processing cannot add timeline events or consume stock again.

Signed events whose fresh provider order has no application checkout mapping are durably ignored. An event claiming an AB mapping must pass the full stored receipt/amount/currency checks. Use dedicated storefront keys and monitor webhook failures.

## 11. Refund synchronization

Refunds are initiated manually in Razorpay Dashboard. The server fetches payment and paginated refund records, recognizes pending/processed refunds, records integer refunded paise, and represents partial/full refunds. Trusted refunded amounts are monotonic so stale events cannot undo a processed refund. No browser-admin refund/payment write is permitted.

Scheduler fallback checks pending attempts approximately every minute and captured/refunded records daily. Signed refund webhooks are the prompt update path; owner Check Payment also reconciles. Already consumed inventory is not automatically restored on refund because refund and physical stock return are separate business operations.

## 12. COD removal

Active checkout contains Razorpay messaging and no COD option. COD creation endpoint is disabled. Historical COD payment labels, statuses, customer history, tracking, admin reads and legitimate fulfilment are retained.

## 13. Environment variables

Empty placeholders were added for:

```dotenv
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
CRON_SECRET=
PAYMENTS_LIVE_ENABLED=
```

All are server variables. Key ID is returned by create-order. Never use `VITE_` for secrets. Existing Firebase Admin server credentials are still required.

Missing Razorpay credentials return a safe configuration error before reserving stock. Live keys require BOTH `VERCEL_ENV=production` and `PAYMENTS_LIVE_ENABLED=true`; otherwise they fail closed. Preview/development must use test keys only.

## 14. Tests added

Foundation: request bounds/browser money rejection, integer money/trusted pricing, products/options/stock, malformed finances/coupons, UID identity, idempotency conflicts/concurrency, reservation expiry/renewal, one-time release/consumption, capture/refund monotonicity, mapping/signature/owner checks, raw bytes, event conflicts, rate limits and provider uncertainty.

Client: stable ID reuse, dismissal state, callback/server verification race, pending confirmation and historical COD rendering.

Rules: customer/admin financial write denial, operational collection denial, owner reads, admin fulfilment, held-order denial, historical/legacy reads and writes.

Real emulator: last-item concurrency, expiry/release, retry without another provider order, concurrent duplicate processing, consumed stock, paid-only fulfilment and faithful historical COD fulfilment.

## 15. Executed checks/results

- TypeScript (`npm.cmd run lint`): passed.
- Vite production build: passed; existing large-bundle warning remains.
- Seven payment/admin API entry points bundled successfully with server dependencies external.
- Payment foundation: 15 tests passed.
- Payment client/recovery: 4 tests passed.
- Firestore authorization: 51 checks passed against demo emulator.
- Real Firestore transaction/lifecycle/admin compatibility checks: passed.
- Existing catalog: 22 tests passed.
- Existing inventory: 11 tests passed.
- Existing Cloudinary: 9 tests passed.
- COD-disabled endpoint regression: passed.
- `git diff --check`: passed.
- Exact existing local secret values in inspected source/build: zero matches; server credential imports/names absent from browser bundle.

Some esbuild tests initially hit Windows sandbox directory restrictions; authorized reruns passed. Emulator transaction contention produced lock retries, then completed successfully. No test connected to a live Firebase database or made a Razorpay payment.

Commands:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test:payments
npm.cmd run test:payment-client
node scripts/admin-driven-catalog.test.mjs
node scripts/inventory-management.test.mjs
node --import tsx --test scripts/cloudinary-sign.test.ts
node scripts/order-transaction.test.mjs
# Ensure Java 21+ is on PATH before this isolated demo test:
npm.cmd run test:payment-emulator
git diff --check
```

## 16. Tests not executed

Real Razorpay Test Mode Checkout, dashboard webhook deliveries, provider raw-body behavior on deployed Vercel, mobile/device/browser E2E, Vercel packaging/route smoke tests and any live-mode tests. Credentials are unavailable and production deployment is prohibited. Mocked client tests do not establish actual browser viewport behavior.

## 17. Remaining concerns

Not production-ready yet. Verify actual Vercel Firebase Admin runtime/bundling, raw body availability, `/api` routes versus SPA rewrites, secret scopes and scheduler capacity. Deployed rules/indexes must match these files. Every-minute scheduling is mandatory; five-item batches need capacity monitoring and repeated invocations for larger queues. Paid fallback reconciliation is daily, so webhook health matters.

Uncertain provider creation, late capture and variant-schema changes can require trusted operator intervention. They deliberately fail closed rather than guessing. No self-service online cancellation, automated inventory return, or refund initiation is included. Refunded/held orders cannot proceed through ordinary paid fulfilment. Approve the business recovery/refund runbook before activation.

Strict pricing rejects malformed legacy catalog/config data. `settings/admin.data.checkoutCharges` must explicitly be an array, even if empty. Address validation supports India but does not establish carrier serviceability. Public signup/contact abuse remains outside the payment rate limiter. Existing policy placeholders require owner-approved copy. Firestore order snapshots remain subject to document-size limits.

## 18. Manual configuration

Confirm Firebase project/environment isolation and Admin credentials. Validate products, variant totals, coupons and checkout charges. Prepare staging hosting and deploy rules/indexes with the application only when deployment is separately authorized. Configure optional TTL for `paymentRateLimits.expiresAt`, never for reservation release. Set `CRON_SECRET` and schedule protected GET `/api/payments/reconcile` at least once per minute; scale queue draining to purchase volume.

## 19. Dashboard configuration

Obtain test Key ID/Secret, create a separate webhook secret, configure the staging HTTPS webhook URL and listed subscriptions, and configure automatic capture. Monitor failures/retries. Use separate keys/secrets/endpoints for live mode. Dashboard is the sole V1 refund initiation surface.

## 20. Before adding TEST credentials

Review this diff and passing tests. Resolve policy/business decisions. Confirm staging uses the intended nonproduction Firebase database. Validate explicit trusted checkout charges and catalog records. Establish expiry scheduling and operator recovery procedures. Keep all new secret placeholders empty until supplied securely.

## 21. After TEST credentials

Set server-only test credentials and webhook secret; leave live enablement unset. With separate deployment authorization, publish a staging build plus rules/indexes, configure scheduler/webhook, and run the full test-mode matrix: capture, failure/retry/dismissal, tampering, duplicate/out-of-order deliveries, refresh/closed browser, network/database failures, expiry/late capture, partial/full/manual refunds, history and mobile. Verify webhook raw-body signatures on the actual host. Compare Dashboard evidence with Firestore and inventory movements.

## 22. Before LIVE mode

Complete staging evidence and review remaining concerns. Obtain approved policies, account activation, operational monitoring and refund/recovery ownership. Verify production HTTPS/domain, database/rules/indexes, environment isolation, credential permissions and scheduler capacity. Only then, under separate authorization, set live server credentials, production webhook secret and `PAYMENTS_LIVE_ENABLED=true`, deploy and perform an approved small-value smoke test with refund/reconciliation checks. This implementation did not perform these steps.

Official references used: [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [Webhook validation](https://razorpay.com/docs/webhooks/validate-test/), [Order payments](https://razorpay.com/docs/api/orders/fetch-payments/), [Payment evidence](https://razorpay.com/docs/api/payments/fetch-with-id/), [Refunds](https://razorpay.com/docs/api/refunds/fetch-all/).
