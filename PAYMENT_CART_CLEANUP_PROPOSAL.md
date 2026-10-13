> Superseded by the owner-approved local implementation in ORDER_CANCELLATION_REFUND_IMPLEMENTATION.md. The text below records the earlier deferred proposal; it is not the current execution instruction. No new commit, push, deployment or LIVE refund is authorized.

# Payment-success Cart cleanup: separate approval required

Status: DEFERRED by owner decision on 2026-10-13. Documentation only; do not implement at this stage. This replaces earlier reports that included backend Cart cleanup in the release.

## Current safe behavior

The original PaymentService is restored byte for byte. Gateway creation/verification, provider signatures, webhooks, reconciliation, refunds, trusted payment statuses and inventory reservation/confirmation remain unchanged. Frontend checkout no longer calls clearCart after a confirmed order. Cancelled, failed, pending and successful outcomes retain Cart selections. Existing paid orders cannot clear a later Cart. The stable checkout intent is retained so unchanged checkout details reuse their existing order.

Limitation: purchased quantities also remain after success. Customers must explicitly remove them. This can be confusing and prevents a claim that automatic payment-success cleanup is complete. A modified basket/address can represent a new checkout; customers should check existing orders before paying again.

## Exact dependency and smallest proposed change

A browser cannot reliably provide atomic, exactly-once purchased-only cleanup: it can close before confirmation; capture can arrive through a webhook or reconciliation; different tabs can race or replace a line. The existing trusted capture transaction is the point where order evidence and an exactly-once cleanup receipt can be committed together.

Only after separate approval, change PaymentService.create and its trusted capture/apply transaction, with a small pure Cart helper and local tests:

1. For newly created checkoutRequests only, read the owning customer's persisted Cart and record unambiguous matched line IDs, canonical product/color/size/tailoring identities and purchased quantities. Match the server-validated requested quantities, not arbitrary browser totals. Do not retrofit older requests or infer missing snapshots.
2. In an eligible first trusted capture, read checkout metadata and current Cart before writes, in a consistent document order across creation/capture/retry paths. Keep every existing payment evidence, amount, mapping, reservation and review check.
3. Require no previous paidAt and no cleanup receipt. For each original line still present with the same ID and variant identity, subtract only its recorded purchased quantity, capped at the current quantity. Preserve extra quantities, unrelated variants, newly re-added line IDs and all unmatched records. Do not guess on ambiguous or malformed Cart data.
4. Commit the Cart delta and cleanup receipt atomically with the already trusted order confirmation. Replays and already-paid orders must be no-ops for Cart. Older requests without a snapshot must preserve Cart. Define malformed-Cart handling so Cart cleanup cannot prevent truthful payment recording; retaining the Cart with a recorded skip reason is preferable to guessing or blocking confirmation.
5. Run fixture/emulator regressions for duplicate capture, capture/retry overlap, old paid orders, legacy requests, late capture/review, malformed Cart, extra quantity, removal/re-add and different variants. Hosted webhook/scheduler/payment behavior will still remain unverified without an approved hosted transaction.

No gateway endpoints, provider request algorithms, credentials, webhook routing/signature configuration, scheduler, new infrastructure or Production migrations are proposed. This still changes the transaction's read/write set and contention profile, so it requires approval and a fresh review before implementation. Do not apply the archived patch blindly.

## Separated work

The prior service/create/capture delta and its tests are archived locally under node_modules/.cache/cart-cleanup-review/separated-backend-and-tests.patch, with the old helper and diagnostic source alongside it. They are excluded from staging. The standalone concurrency diagnostic was removed from release source; ordinary emulator concurrency regressions remain. No Production stress tests or LIVE transactions were run.

Owner decision: release the current Cart/Wishlist fixes with automatic cleanup deferred. Local commit is authorized. Push, deployment, Production data changes and LIVE payment testing remain prohibited without separate approval. This proposal is retained as a deferred reference only, not active work.
