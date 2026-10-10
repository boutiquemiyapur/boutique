# Payment gateway and shopping UX audit (2026-10-10)

## Scope and evidence

Audited current local commit 614458e and the attached Production screenshots. The
working tree was clean at the start; earlier cancellation/environment/status/loading
work is already present in that commit. This task added only the changes below.
No Production data, credentials, prices, orders or transactions were changed.
No commit, push or deployment occurred. No hosted API requests were performed.

## Findings and existing protections

The screenshots show old standalone Order Placed badges and raw PAYMENT_PENDING
labels. Current local customer/admin components already use shared payment-aware
presentation. A screenshot cannot establish which source revision is deployed.
The URL showing order-confirmation while account history is visible also does not
establish successful payment. Exact-ID lookup and captured-only success remain.

Server pricing, strict product/variant/stock validation, full UID-scoped intent
mapping and transactions already protect initiation. Authentication/ownership,
checkout HMAC, fresh provider payment fetch, exact payment/order IDs, internal
receipt/checkout mapping, INR and exact paise protect verification. A provider
payment belonging to another order cannot pass these mappings. A 100-paise capture
cannot approve an unrelated 135000-paise order. Conflicting captured payment IDs
are rejected; client callbacks never write paid status or release inventory.

Event deduplication and transactional reservation consumption/release already
prevent repeated fulfilment effects. Capture/refund evidence remains monotonic;
late capture after release requires review. Failed callbacks/dismissal do not erase
capture, clear the cart or force a financial failure. Refresh/disconnection recovery
uses listeners, status checks and reconciliation. Refund creation/processing/failure
is refreshed from Razorpay; actual refunded amounts and pending refund evidence
control processing/partial/full labels and net captured receipts. Failed refunds
are not treated as money returned. Provider errors retain retry/review paths.

GET /api/payments/reconcile requires timing-safe Authorization: Bearer CRON_SECRET.
It processes five due attempts, checks provider payments/refunds before expiry
release, retries failures and revisits captured payments daily. Missing/invalid
credentials fail before operations; the minute scheduler, capacity/backlogs and
provider latency must be monitored. Firestore rules and paid/review fulfilment
guards are unchanged. Production-only Firebase/LIVE credential policy is unchanged.

## RAW_BODY_REQUIRED investigation and correction

The old rawBody guard read req.body before reading the wire stream. Vercel Node
helpers install body as a lazy JSON getter and restore buffered wire bytes to a
data/end stream. Touching that getter creates a parsed object which our guard then
rejects, even for a genuine signed JSON delivery. The exported Next-style parser
hint alone was not a sufficient assumption for this standalone Vite/Node handler.

The correction inspects the property descriptor without invoking an accessor and
collects original Buffer/Uint8Array chunks through data/end events. It accepts an
explicit Buffer, rejects an explicitly parsed object/string, limits bytes to 256KiB,
and bounds collection to 15 seconds. Interrupted/non-byte streams fail. It never
serializes JSON to reconstruct signed bytes. HMAC verification remains timing-safe
and runs before JSON/database/provider processing. Signed malformed JSON now returns
INVALID_JSON (400) instead of a generic transient 503. No success bypass was added.

A fixture reproduces the Vercel restored stream/lazy getter and executes the real
handler with mocked provider/database boundaries for all seven supported events.
It covers wrong signatures, parsed bodies, malformed payloads, duplicate deliveries
and conflicting hashes. Foundation/emulator tests retain real financial transaction
checks; handler mocks alone are not claimed as payment integration verification.

The supplied log screenshot proves three requests reached the handler and were
rejected before signature checks. It contains no delivery IDs, request headers or
raw bytes. Actual Razorpay delivery versus another JSON caller cannot be determined
from it. Correlate Dashboard webhook delivery IDs/times with Vercel request IDs and
HTTP responses after approved deployment. Never log secrets, signatures or payloads.

Source: [Vercel Node helper implementation](https://github.com/vercel/vercel/blob/main/packages/node/src/serverless-functions/helpers.ts).

## Shared customer/admin mapping

| Evidence | Presentation |
| --- | --- |
| Verified captured PAID, no review hold | Payment Successful; initial order stage Order Confirmed |
| CREATED / PAYMENT_PENDING / legacy Pending | Payment Pending |
| AUTHORIZED awaiting capture | Verifying Payment |
| Current checkout dismissed without confirmation | Payment Incomplete feedback, cart preserved, possible delayed capture explained |
| Trusted failure | Payment Failed |
| Expired reservation | Payment Expired |
| Pending / partial / completed refund | Refund Processing / Partially Refunded / Refunded |
| Review, incomplete provider evidence, unknown status | Payment Under Review |
| Historical COD | Historical order / Cash on Delivery; no online capture claim |

Historical pending records are not retroactively classified as dismissed. No
historical financial fields are rewritten. Customer history/details/tracking,
confirmation, notifications and admin filters/export use shared helpers. Unpaid
orders remain ineligible for fulfilment and completed-sale/revenue calculations.

## Shopping bag behavior

XS and S are different valid rows, not duplicate evidence. Existing identity already
used product ID, trimmed case-normalized color/size and tailored-vs-ready selection.
Identity is now encoded as a JSON tuple to avoid delimiter collisions. No persisted
cart ID migration is needed. Existing duplicate rows normalize to one row while
retaining total quantity; distinct variants remain separate.

Existing same-variant adds and pending rapid clicks never increment quantity. The
new cross-tab correction tracks whether the final Firestore transaction callback
actually inserted the line. If another tab won, it returns false and reports
Already in Bag rather than false Added success. A View Bag toast action opens the
existing drawer. In-flight additions use honest saving feedback until persisted.
Quantity controls remain the sole subsequent quantity-change path, with existing
catalog/inventory limits, UID ownership and confirmed listener synchronization.

## Circular loading and website-wide UX

Chakra is not installed. Existing lightweight circular Spinner/ButtonProgress is
reused; no dependency was added. CSS rotates at 900ms, enters at 200ms and respects
reduced motion. Pay Online becomes disabled immediately with Preparing secure
payment, then Opening Razorpay during SDK initialization. Stable responsive width
and minimum height prevent label-induced button jumps. Hosted Checkout displays
text without a competing spinner/overlay. Verification shows circular progress;
dismissal/error clears it. SDK, HTTP and raw-body waits are bounded. Content
skeletons, branded page loaders, listener-backed details and admin saving/error
feedback from the previous implementation remain intact.

## Exact files changed in this task

- server/payments/http.ts
- api/payments/webhook.ts
- src/services/commerceRepository.ts
- src/context/StoreContext.tsx
- src/components/common/ToastContainer.tsx
- src/utils/paymentState.ts
- src/services/paymentClient.ts
- src/components/checkout/CheckoutPage.tsx
- scripts/payment-foundation.test.ts
- scripts/payment-webhook.test.mjs (new)
- scripts/payment-client.test.mjs
- scripts/payment-presentation.test.mjs
- scripts/shopping-ux.test.mjs
- scripts/shopping-emulator.test.mjs
- package.json
- PAYMENT_UX_REPORT.md
- PAYMENT_GATEWAY_SHOPPING_AUDIT.md (new)

## Validation

TypeScript; payment foundation/environment 32/32; payment UI/presentation 32/32;
webhook handler 3/3 (all seven events covered); shopping/store 21/21; Cloudinary
10/10; legacy order 1/1; admin/catalog 22/22; inventory 11/11; production build;
Git diff checks. Demo emulator authorization (51 checks), real payment/inventory/
fulfilment and shopping concurrency checks run against demo-ab-payments only.

All external provider/database boundaries in unit/handler/UI tests are simulated.
The emulator exercises real local Firestore, not LIVE Firebase. Fixture hosted-mode
builds verify environment isolation and secret exclusion. The ordinary local build
stays offline without safe local Firebase configuration. Browser tooling returned
no available browsers; hosted Razorpay modal, desktop/mobile geometry, actual
webhook delivery, current Vercel settings and scheduler execution were not verified.
Existing large-bundle warning remains.

## Deployment readiness

GO for the locally validated fixes; NO-GO for claiming verified LIVE webhook health
until an approved new deployment passes signed-delivery checks. Include both new
files with the tracked diff; redeploying an old revision cannot include local fixes.
Verify the two Production Firebase identity pins, existing LIVE credential scopes,
Node/Admin runtime, rules/indexes, CRON_SECRET and active minute scheduler. Then
verify genuine signed Razorpay delivery receives 200 and matching capture updates
the exact internal order once. Check dismissal, pending/retry, history, variants,
quantity controls, desktop/mobile loading and delayed confirmation. If the provider
has stopped/retried deliveries, use its documented recovery controls only after
separate approval. Do not weaken signatures or mark historical orders paid manually.
Stop before deployment. No additional live transaction is required for this local audit.
