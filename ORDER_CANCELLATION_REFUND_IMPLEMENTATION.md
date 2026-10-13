# AB Collections: Cart cleanup, cancellation and admin-approved refunds

Local implementation and validation: 2026-10-13. Work is uncommitted against 023d8a23a26a64549fa297aa884f0b9b542d15a8. No staging, new commit, push, deployment, Production record change, LIVE payment/refund, credential change or new infrastructure was performed. This supersedes the earlier deferred-cleanup report/proposal for current work.

## Existing features discovered during inspection

The gateway already creates trusted server-priced INR orders, reserves inventory atomically, verifies signatures and provider mapping/amounts, fetches authoritative capture evidence and records paid status. It handles payment.authorized/captured/failed, order.paid and refund.created/processed/failed through signed raw-body webhooks. Existing authenticated polling and CRON_SECRET reconciliation refetch provider evidence. Paid inventory is consumed once; expired reservations release once; late capture is held for inventory review. Refund amounts/statuses were observed through GET APIs but there was no refund-initiation API.

Customer cancellation was direct Firestore cancellation for historical COD only, allowed through Ready for Dispatch. Razorpay customers were told to contact the store. Admin fulfilment could set Cancelled directly, with no admin approval lifecycle or coupled inventory correction. Cart cleanup was deferred; browser whole-Cart deletion had already been removed. Stable checkout intents were retained indefinitely.

Existing payment state machine: CREATED -> PAYMENT_PENDING -> AUTHORIZED -> PAID; failed/expired uncaptured evidence remains FAILED/EXPIRED. Trusted refund evidence yields REFUND_PENDING, PARTIALLY_REFUNDED or REFUNDED. Capture/refunded amounts are monotonic; a failure callback cannot demote verified paid evidence. Reservations: RESERVED -> CONSUMED on capture or RELEASED on expiry. Existing collections, price calculations, provider order creation, verification endpoints/signatures, credentials and scheduler configuration are reused.

## Confirmed policy and implementation plan

Owner explicitly confirmed:

- ADMIN-APPROVED REFUNDS ONLY. Customer action creates a request; only a Firebase custom-claim admin can approve/reject.
- Cancellation requests and approval only at Order Placed or Confirmed. Processing and later stages are blocked. Recorded timeline evidence of an advanced stage also blocks cancellation, even if an older record's current status was rolled back.
- Refund the full remaining captured amount, derived from current provider evidence minus authoritative prior refunds. No client-supplied refund amount.
- Restore trustworthy ledger-backed stock exactly once at approval. Missing ledger evidence requires manual inventory review; no guessed restoration.

The implementation extends the existing service rather than replacing the gateway. It adds an immutable checkout Cart snapshot, separately recoverable cleanup, one durable cancellation request/decision, a trusted refund operation with provider idempotency and a hard disabled-by-default LIVE execution gate. The backend rechecks every decision atomically. Source policy is shared with display helpers; changing policy requires a reviewed code change, not new credentials or environment variables.

## Purchased-only Cart cleanup

Every new checkout request stores versioned immutable purchased product/color/size/tailoring identities and exact server-validated quantities. It additionally records unambiguous persisted Cart line IDs and their quantities at checkout. No browser amount or callback proves payment.

On the first trusted capture, the payment transaction marks cleanup PENDING alongside durable paid evidence. A separate transaction reads checkout -> order -> owning Cart, subtracts only matching original line quantities, and atomically commits the Cart and DONE receipt. Removal is capped by purchased quantity, quantity present at checkout and quantity currently present. Extra quantities, newly re-added IDs, unrelated products and variants are retained. Duplicate events, polling and reconciliation cannot repeat a completed cleanup.

Missing/ambiguous Cart lines, deleted Cart records, invalid Cart structure, historical requests without snapshots and historical paid orders are never guessed. Unsafe association/review cases retain selections with SKIPPED; a transient transaction failure leaves PENDING. Expired/released inventory and late capture on a cancelled order remain under review and do not clean the Cart. Customer cancellation before payment does not clear Cart. No frontend callback clears Cart.

A cleanup error is caught after paid evidence is committed: the order stays paid, no new charge is created, and the existing reconciliation/polling path retries. The scheduler retains its short retry interval for pending cleanup. Its hosted operation/frequency was not verified here.

Capture completion writes a backend-only lastPurchasedOrderId receipt and checkoutGeneration marker on the Cart. Approval of an uncaptured cancellation advances only the generation, preserving selections while allowing a fresh purchase intent instead of reusing the retired cancelled order. Confirmed Cart snapshots carry this generation into the browser's local intent key; ordinary Cart transactions preserve it. An identical purchase after completed cleanup gets a fresh intent, while unchanged pending/failed retries reuse their intent. If another completed purchase advances Cart generation while an owned matching attempt is still outstanding, the customer Store reuses that trusted existing attempt. Review-held attempts block another checkout; cancellation-completed attempts are retired. The Razorpay request schema, order-history retry mapping and provider order-creation algorithm are unchanged. Customer rules reject forged generation markers. Refresh/cross-device Cart synchronization uses the existing listeners.

## Cancellation and inventory state machine

A customer request is REQUESTED, with immutable reason, owner and timestamp. It changes neither order fulfilment status, money nor inventory. REQUESTED holds fulfilment. Admin REJECTED retains the existing order/stock and releases the hold. Admin APPROVED changes the order to Cancelled, records actor/reason/audit, restores/releases verified inventory once and records the refund approval/amount.

Request/review/fulfilment transactions contend on the same canonical order. Approval rechecks eligibility after provider reads; a concurrent advanced fulfilment transition cannot be cancelled. The fulfilment API cannot directly set Cancelled, advance a held/cancelled order, or move an advanced order back into a cancellable stage. Other existing fulfilment-stage choices are preserved.

Ledger policy:

| Reservation/ledger | Approved cancellation effect |
| --- | --- |
| RESERVED with matching reserve movement | Return reserved stock; mark RELEASED once |
| CONSUMED with matching reserve and consume movements | Return stock; mark RESTORED once |
| Already RELEASED/RESTORED | No additional stock change |
| Missing/untrustworthy ledger | MANUAL_REVIEW; no stock guess |
| Changed/malformed variant inventory on a trustworthy ledger | Fail approval atomically; no cancellation, restoration or refund initiation |

Archived products remain archived when stock is restored. Current inventory shape, quantities and variant keys are validated before writes. A deterministic cancellation movement prevents repeated restoration. Refund initiation/processing failure does not reopen a cancelled order or restore stock again; this follows the approved restore-at-approval policy.

Historical COD records can be copied faithfully into canonical orders from only the authenticated customer's own legacy path when a cancellation is requested. The historical document is not modified or bulk-migrated. Cash refund handling is outside the Razorpay workflow; missing historical stock ledgers require manual review. Late capture after an uncaptured cancellation records paid evidence truthfully and remains held; an admin must explicitly review/recover any resulting refund.

## Refund state machine and execution protection

REQUESTED -> admin APPROVED -> AWAITING_ENABLEMENT (current Production-safe default). Once a separate owner-approved release enables execution: APPROVED -> INITIATING -> PENDING or PROCESSED; ambiguous errors/timeouts -> UNKNOWN; provider processing failure -> FAILED. Unmatched evidence or expired uncertain retries -> MANUAL_REVIEW. No captured remainder -> NOT_REQUIRED.

The server refetches payment/order evidence, verifies captured status, payment ID, mapped order ID, INR and exact captured amount, validates refund references/amounts, rejects another pending provider refund and derives the full remaining amount. Partial prior refunds are represented accurately; arbitrary partial amounts cannot be requested by clients.

One immutable approved refund amount/payment and deterministic idempotency key are persisted before any provider POST. The request body and X-Refund-Idempotency header stay identical across uncertain retries; refund receipt carries the same key. Provider calls occur outside Firestore transactions. An initiation lease prevents simultaneous admin calls from racing; a crashed initiation can recover after the lease. Approved UNKNOWN/INITIATING recovery may run through the existing scheduler only when execution is enabled. Requests without admin approval can never enter that path.

The 24-hour local retry window is a conservative application policy, not a claimed provider retention guarantee. Before retries, existing refund evidence is matched by immutable reference/receipt. Stale ambiguous approvals and unmatched external refunds stop for manual review. A known failed refund is not automatically reissued with another key. Clear status comes from provider GET evidence, never accepted HTTP responses or client status. Accepted/pending refunds are not described as money received; processed refunds still have bank credit timing caveats.

Cancellation/refund transitions have private durable audit records and a bounded recent audit history in the order. Reviewed/processed states resist stale browser responses. Customer status is displayed in My Orders, detail/confirmation/tracking views; the admin panel receives confirmed canonical-order snapshots for progress synchronization and lists requests, retrieves a verified amount before approval, offers approve/reject and approved recovery, and displays progress/reference/audit.

**LIVE execution is disabled in server/orders/refundPolicy.ts.** The admin endpoint, scheduler construction and real Razorpay provider enforce this gate; client input cannot enable it. Approval currently records cancellation and restores authorized ledger-backed stock but holds refund execution at AWAITING_ENABLEMENT. No LIVE refund POST ran. Enabling the gate requires separate owner approval and another review/release. No new environment variable was introduced.

Primary API reference: [Razorpay normal refund idempotency](https://github.com/razorpay/markdown-docs/blob/master/api/refunds/normal-refunds-idempotent.md). The implementation uses a stable allowed-character key, immutable body and provider receipt; a conflicting/in-flight or unknown result is reconciled instead of creating a fresh refund key.

## Security protections and dependencies

- Revocation-checked Firebase ID tokens; customer ownership; trusted admin custom claim for quote/approve/reject/retry. Expired/absent authentication, cross-account IDs and customer admin actions are rejected.
- Strict action/body allowlist and rate limiting. No client payment ID, amount, approval actor or status is accepted.
- Browser customers and admins cannot write canonical order, financial, cancellation, reservation, audit or cleanup records directly. Firestore rules close the prior COD direct-cancellation/admin-fulfilment bypass; backend APIs perform those operations.
- Existing HMAC/raw-body signature checks, provider capture/amount/mapping validation, paid protection, environment validation and server-only secrets remain. Existing webhook configuration and reconciliation schedule were not changed.
- Server/runtime shared imports use .js extensions for the deployed TypeScript ESM graph. Dependencies and credential files are unchanged. Local builds remain Firebase-disconnected; synthetic hosted-build tests verify server secrets are excluded from the browser bundle.

## Final validation

| Check | Result |
| --- | --- |
| Cart/cancellation/refund and endpoint authorization fixtures | 28 passed |
| Shopping/Wishlist/provider UI | 30 passed |
| Payment foundation/environment | 37 passed |
| Payment client/presentation | 37 passed |
| Signed webhook handler | 3 passed |
| Catalog/admin confirmed-order synchronization | 23 passed |
| Inventory management | 11 passed |
| Trusted order creation | 1 passed |
| Cloudinary/security | 10 passed |
| **Application regressions** | **180 passed, 0 failed** |
| Firestore authorization | 60 checks passed |
| Existing payment/inventory and shopping functional emulator suites | Passed, exit 0 |
| New Cart cleanup/cancellation/inventory functional emulator suite | Passed, exit 0 |
| TypeScript (npm.cmd run lint) | Passed |
| Production-mode Vite build (npm.cmd run build) | Passed; existing large-bundle warning, local Firebase disabled |
| git diff --check | Passed |

Logs are under node_modules/.cache/refund-final-*.log. All Firestore emulator operations use demo-ab-payments at 127.0.0.1:8189; all payment/refund transports are synthetic fixtures. Authorization suites include customer/admin order-write denial, forged refund/cancellation/cleanup fields and Cart-generation spoofing. Fixtures include ownership/expired auth, stage eligibility, concurrency, capture/cleanup recovery, old orders, partial prior refund, invalid amount/payment, pending/processed/failed/unknown refunds, API timeout and interrupted initiation. Existing catalog/inventory/order/Cloudinary regressions pass. No stress tests touched Production.

## Exact files changed

There are 45 content-changed/new files relative to 023d8a23a26a64549fa297aa884f0b9b542d15a8, including this report and supersession notices in the two historical reports. No unrelated files were staged. The exact manifest is:

- `ORDER_CANCELLATION_REFUND_IMPLEMENTATION.md`
- `PAYMENT_CART_CLEANUP_PROPOSAL.md`
- `WISHLIST_CART_REPORT.md`
- `api/orders/cancellation.ts`
- `api/payments/reconcile.ts`
- `api/payments/status.ts`
- `api/payments/webhook.ts`
- `firestore.rules`
- `package.json`
- `scripts/admin-driven-catalog.test.mjs`
- `scripts/cancellation-api.test.mjs`
- `scripts/cart-cancellation-refund-emulator.test.ts`
- `scripts/cart-cancellation-refund.test.ts`
- `scripts/payment-client.test.mjs`
- `scripts/payment-emulator-runner.mjs`
- `scripts/payment-environment.test.ts`
- `scripts/payment-fixture.ts`
- `scripts/payment-foundation.test.ts`
- `scripts/payment-presentation.test.mjs`
- `scripts/payment-rules.test.mjs`
- `scripts/payment-webhook.test.mjs`
- `scripts/shopping-ux.test.mjs`
- `server/orders/cancellation.ts`
- `server/orders/fulfil.ts`
- `server/orders/inventory.ts`
- `server/orders/refundPolicy.ts`
- `server/payments/cartCleanup.ts`
- `server/payments/provider.ts`
- `server/payments/service.ts`
- `src/components/account/CustomerAccountPage.tsx`
- `src/components/admin/AdminCancellationPanel.tsx`
- `src/components/admin/AdminOrders.tsx`
- `src/components/checkout/OrderConfirmationPage.tsx`
- `src/components/checkout/PaymentRecovery.tsx`
- `src/components/common/CancellationStatus.tsx`
- `src/components/common/ShoppingConnectionNotice.tsx`
- `src/components/tracking/OrderTrackingPage.tsx`
- `src/context/StoreContext.tsx`
- `src/services/cancellationClient.ts`
- `src/services/commerceRepository.ts`
- `src/services/paymentClient.ts`
- `src/types/index.ts`
- `src/utils/cancellationPolicy.ts`
- `src/utils/orderReporting.ts`
- `src/utils/paymentState.ts`

## Limitations and required owner decisions

The two business decisions are confirmed; no new cancellation/refund amount policy is being requested. Remaining requirements are release/audit authorization and separate authorization before enabling or executing LIVE refunds.

- Production/hosted webhook delivery, scheduler timing, real provider refund availability/permissions, bank credit timing, multi-device/offline browser timing and browser visual/accessibility QA have not been exercised here. Local tests do not establish LIVE behavior.
- Production refund execution is intentionally disabled. Approvals can accumulate awaiting store action; communicate this before any release. An approval held beyond the conservative retry window needs renewed/manual review rather than an unbounded provider POST retry.
- Definitive refund FAILED is based on provider refund status. Initiation transport errors/rejections are conservatively UNKNOWN until reconciled; they do not mark the paid order failed or imply money was refunded.
- One cancellation request per order is supported. Rejected requests are retained for audit rather than automatically resubmitted. Item-level cancellation, new arbitrary partial refunds and returns after delivery are outside this implementation.
- Historical/ambiguous Cart associations and review-held late captures can require manual Cart removal. Missing inventory ledgers, prior manual stock corrections, changed variant structures and historical COD cash refunds require store review; there is no bulk data correction/migration.
- The implementation is ready for the separate comprehensive payment/security audit requested by the owner. It is not authorization to deploy or enable LIVE refund execution.

## Safe Production rollout requirements

1. Conduct the separate payment/security audit. Review the exact new backend write sets, leases, idempotency receipts, owner/admin enforcement, Cart generation, inventory restoration and late capture behavior.
2. Leave LIVE_REFUND_EXECUTION_ENABLED=false unless the owner separately authorizes enabling it. Keep existing Firebase/Razorpay credentials, webhook configuration and scheduler infrastructure.
3. After separate deployment authorization, coordinate restrictive Firestore rules with the new backend/frontend release. Deploy reviewed rules first or in a controlled maintenance window so direct client COD cancellation/admin fulfilment cannot bypass the approval policy. Old COD cancellation UI can temporarily fail safely until the new UI is served. Rules deployment is a separate Production-affecting action; none was performed here.
4. Use the existing GitHub/Vercel Production infrastructure, approved commit and current Production variables. Do not create Preview infrastructure or new keys. Inspect source SHA/build/function logs. Record the then-current known-good deployment and open cancellation/refund states before release; older report deployment snapshots may be stale.
5. Perform the owner-authorized ordinary manual checklist below, with no new LIVE payment or refund unless separately approved. Validate existing scheduler delivery and webhook observations through read-only logs/records rather than sending test financial events to Production.
6. Rollback requires care: code predating this workflow ignores REQUESTED/APPROVED holds. Pause admin fulfilment/cancellation/refund actions and retain restrictive rules; do not blindly roll back to a backend that can fulfil held/cancelled orders. Prefer a reviewed fix-forward preserving the new guards. A full prior-code rollback is appropriate only after reviewing active workflow records and obtaining owner approval. Never reverse payments or restore database/inventory records as an automated rollback.

## Manual verification checklist after approved deployment

- Confirm Wishlist/Cart counts, variants, persistence and tab/account isolation remain correct; verify no browser whole-Cart clearing.
- For an explicitly authorized real capture, confirm only exact purchased quantities are removed once, added/extra/re-added selections remain, and a later identical purchase receives a fresh intent. Observe pending cleanup/recovery without charging again. Until such testing is approved, mark hosted capture behavior unverified.
- Confirm eligible early-stage orders show Request cancellation, reason selection and admin/refund implications; Processing and later/historically advanced orders do not. Confirm no repeat request after a recorded decision.
- In owner-authorized accounts, submit an ordinary cancellation request and confirm no customer-triggered financial action or stock restoration, status synchronization and fulfilment hold. This modifies Production order data and requires separate permission; it was not performed here.
- Verify admin-only verified quote, approve/reject controls and audit/progress. Rejection preserves stock/order; approval restores ledger-backed stock once or flags manual review. With the current gate, refund shows awaiting store action and no POST is made. Do not approve a real cancellation merely as a test without explicit permission.
- Once LIVE execution is separately approved, observe one approved refund reference and full remaining amount through existing provider records, pending versus processed/failed/unknown labels and eventual reconciliation; do not claim acceptance is bank receipt. Do not trigger repeated LIVE transactions to test concurrency.
- Verify forged/customer refund actions and direct order writes using local emulators; do not run destructive Production permission/concurrency experiments.
