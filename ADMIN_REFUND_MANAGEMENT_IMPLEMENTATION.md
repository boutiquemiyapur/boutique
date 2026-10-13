# Admin Refund Management — implementation handoff

2026-10-13. Local delta against `3c48bff13d28004b99b71d2a4429e2d9bc562d6d`. This work is uncommitted. No Production records, credentials, configuration or transactions were changed.

## Implemented behavior

Admin Panel → Settings → Payment & Refund Settings provides the LIVE Refund Execution switch, effective ENABLED/DISABLED status, explicit enable confirmation, last update/admin identity, recent settings audit history, refresh, loading, errors and success notices. The setting defaults OFF when its document is absent.

The emergency gate in `server/orders/refundPolicy.ts` is unchanged and remains **false**. The UI displays “Refund execution is locked pending security approval.” ON and refund execution are disabled. Backend endpoints and the actual provider adapter also enforce the lock. Effective permission requires both the emergency gate and the private admin setting; a client cannot supply either code permission or the refund amount.

Cancellation approval still cancels eligible Order Placed/Confirmed orders and restores trustworthy ledger-backed inventory once. It **never initiates a refund**, even in the synthetic future-enabled tests. Every financial initiation requires separate admin review and explicit confirmation. Customer cancellation requests remain supported and cannot execute refunds.

Approved orders show a separate Refund ₹amount action and Review / synchronize action. The execution button remains disabled while locked. Review fetches trusted payment/refund evidence; confirmation uses that review's order, payment and amount rather than the displayed cached amount. The modal identifies the specific order/payment/refund amount. Pending, processed, failed, unknown and manual-review results are distinct; submission alone is never described as successful bank credit. Existing order audit history and refund status badges remain visible. Dialogs support keyboard focus, Escape/cancel and single-flight buttons. Actual browser/mobile visual verification remains outstanding; UI behavior was tested with mocked React hooks.

## Backend safeguards

- Both admin endpoints use existing Firebase ID-token verification with `checkRevoked=true` and exact `admin === true`; customer access is rejected. Strict schemas reject additional fields, malformed bodies and client-selected amounts. Existing no-store responses and per-UID transactional limits apply (30 requests/minute per action bucket).
- Setting changes use expected revision checks and transactionally append private actor/time audit records. Invalid stored metadata fails closed. ON requires explicit confirmation and the emergency gate. OFF is allowed even if a previously saved ON setting is blocked by the emergency gate.
- Each review is bound to admin UID, order, verified captured payment, exact remaining INR amount, immutable idempotency key, original approval timestamp and settings revision. Reviews expire after five minutes. Confirmation re-fetches provider evidence and rechecks these bindings inside the transaction.
- Individual confirmation records a durable execution authorization and consumed review, appends an audit entry and wakes an existing payment attempt in 60 seconds. The existing refund lease and stable `X-Refund-Idempotency` key/body govern concurrent admin/recovery attempts. No timestamp, key or amount is renewed to bypass expiry.
- Reconciliation may retry only an individually confirmed, coherent authorization with the current enabled settings revision. Turning ON alone cannot initiate old approvals. OFF → ON does not revive an earlier authorization: a fresh individual review/confirmation is needed.
- Known provider refunds continue to synchronize while OFF. UNKNOWN outcomes are discovered by the existing receipt/key mapping before a retry. Malformed/expired original approvals remain manual review; no replacement refund key is generated. Raw inventory validation, exactly-once restoration, trusted Cart cleanup, signed webhooks and durable webhook observers are preserved.
- The provider adapter independently reads the current settings immediately before transport and retains the code lock. OFF cannot recall a request already authorized/in flight or reverse a submitted refund; it blocks subsequent authorization/recovery sends. A concurrent OFF after the final read cannot atomically cancel an external request. This is an explicit operational boundary.
- A remaining INR balance below 100 paise is held for manual review without rounding or provider submission. This follows the provider's documented INR 1 minimum. The unchanged immutable key/body requirement follows [Razorpay normal-refund documentation](https://raw.githubusercontent.com/razorpay/markdown-docs/master/api/refunds/normal-refunds-idempotent.md).
- Concurrent order panels share only an in-flight settings read, scoped to UID; no financial permission or credentials are persisted in browser storage. Account changes and wrong-order API responses fail closed.

## Firestore changes

No migration, bulk update, new project, index or environment variable is needed.

| Record | Purpose / access |
| --- | --- |
| `refundSettings/control` | `enabled`, `revision`, `updatedBy`, canonical `updatedAt`; absent means OFF. Admin API writes only. |
| `refundSettings/control/history/{uuid}` | Setting-change `enabled`, `revision`, `by`, `at`. Latest 20 are returned by the admin API; durable entries remain stored. |
| `refundReviews/{uuid}` | Admin/order/payment/amount/key/original approval/revision bindings, numeric expiry, creation and consumption metadata. Trusted API only. Expiry is checked logically; this release does not add a TTL policy. |
| `orders/{id}.data.refund.executionAuthorization` | Durable individually confirmed authorization; optional, so older orders remain readable. |
| Existing `cancellationAudits` and order audit | Review, execution request, confirmation and trusted lifecycle evidence. |
| Existing `paymentAttempts` | Confirmation schedules prompt recovery; global toggle never starts a batch. |

`firestore.rules` explicitly denies browser reads/writes to refund settings, nested history and reviews, including browser admins. Existing owner order reads and server-only financial writes remain intact. Admin SDK APIs enforce roles themselves. Prior hosted rule parity applies to the previous source only; the updated rules have not been deployed or retrieved from Production in this task. Prior rules' implicit deny already covered the new namespaces, but publish the reviewed explicit rules as coordinated, separately approved release work. Vercel does not deploy Firestore rules.

## Historical approvals, including the INR 1 order

Old approvals have no individual execution authorization and cannot be initiated by switching ON or by scheduled reconciliation. An admin must review each one. Within the original valid 24-hour window, unchanged eligible captured evidence can receive a new five-minute review and explicit individual confirmation after both gates are separately authorized. Beyond 24 hours, malformed timestamps, late captures approved as NOT_REQUIRED, ambiguous mappings or changed balances require manual review. Existing refunds can still be discovered/synchronized without another financial initiation.

The actual INR 1 order was **not inspected or changed**. Its eligibility, capture/refund history, timestamp and inventory ledger are unverified. Do not promise it can be refunded through this action. Do not reset its timestamps/state/key to force eligibility. A separately approved recovery review is required for an expired or otherwise uncertain record.

## Validation

Final results are recorded in `PAYMENT_SECURITY_AUDIT.md`. New coverage includes dual gates, default OFF, confirmation/revision controls, revocation-checked roles, strict input/rate limits, malformed stored settings, legacy holds, review expiry, changed provider evidence, concurrent admins and recovery, interrupted confirmation, OFF status synchronization, immutable retry identity, provider minimum, truthful UI and account switching.

New suite: `npm.cmd run test:refund-management`. Existing payment, cancellation/refund, client/presentation, signed webhook, payment-security, Cloudinary, shopping, catalog, inventory and order suites are retained. The emulator is restricted to `demo-ab-payments` on `127.0.0.1:8189` and uses synthetic Razorpay responses. Local Production-mode builds and synthetic environment build checks do not establish hosted LIVE behavior.

## Exact release manifest: 30 files

| File | Change |
| --- | --- |
| `ADMIN_REFUND_MANAGEMENT_IMPLEMENTATION.md` | This handoff, schema, safeguards and deployment requirements. |
| `PAYMENT_SECURITY_AUDIT.md` | Current disposition, validation and historical evidence boundaries. |
| `api/admin/refund-settings.ts` | New revocation-checked admin settings/history endpoint. |
| `api/orders/cancellation.ts` | Review and individually confirmed execution actions. |
| `api/payments/reconcile.ts` | Prompt scheduling for held, individually confirmed attempts. |
| `firestore.rules` | Explicit private controls/reviews/history denial. |
| `package.json` | New local refund-management test command; no dependency changes. |
| `server/orders/cancellation.ts` | Separate approval/confirmation, nonce/authorization, safe recovery and expiry. |
| `server/orders/refundSettings.ts` | Dual-gate policy, strict metadata, revision transactions and setting audits. |
| `server/payments/provider.ts` | Independent settings guard before existing refund transport; minimum amount validation. |
| `src/components/admin/AdminCancellationPanel.tsx` | Separate individual refund workflow; approval wording corrected. |
| `src/components/admin/AdminPortalPage.tsx` | Settings section integration. |
| `src/components/admin/AdminRefundActions.tsx` | Trusted per-order review/confirmation and truthful outcomes. |
| `src/components/admin/AdminRefundSettings.tsx` | Locked switch, explicit confirmation, status/history/error UI. |
| `src/components/admin/RefundConfirmationDialog.tsx` | Responsive confirmation and keyboard behavior. |
| `src/components/common/CancellationStatus.tsx` | Accurate held-refund copy and status badges. |
| `src/services/refundManagementClient.ts` | Authenticated calls, UID/order checks, single in-flight settings read. |
| `src/types/index.ts` | Optional durable refund authorization field. |
| `src/types/refundManagement.ts` | Settings, audit and review response types. |
| `scripts/cancellation-api.test.mjs` | New-action role/schema/code-lock regression assertions. |
| `scripts/cart-cancellation-refund-emulator.test.ts` | Real transaction/settings/confirmation/recovery races with mock provider. |
| `scripts/cart-cancellation-refund.test.ts` | Existing lifecycle tests adapted to explicit confirmation; no approval auto-refund. |
| `scripts/payment-fixture.ts` | Synthetic nested settings-history query support. |
| `scripts/payment-presentation.test.mjs` | Updated truthful awaiting-confirmation assertion. |
| `scripts/payment-rules.test.mjs` | Private settings/reviews/history reads/writes/deletes denied. |
| `scripts/payment-security-audit.test.ts` | Explicit trusted synthetic authorization for initiation-time corruption regression. |
| `scripts/refund-management-api.test.mjs` | Real endpoint/shared revocation authentication, schema, lock and limits. |
| `scripts/refund-management-client.test.mjs` | UID switching, wrong-order responses and in-flight read sharing. |
| `scripts/refund-management-ui.test.mjs` | Locked controls, explicit dialogs, duplicate clicks and truthful statuses. |
| `scripts/refund-management.test.ts` | Policy, review, recovery, concurrency, expiry and minimum-amount tests. |

`server/orders/refundPolicy.ts`, package-lock.json, bun.lock, credentials, webhook signature processing and fulfilment/inventory/Cart cleanup implementations are unchanged.

## Deployment requirements — instructions only

1. Keep this task local until separate approval. Resolve the previously documented compromised cron token incident under separately approved scope; no rotation was performed here. Production release remains NO-GO pending that closure.
2. Review the entire 30-file delta against the above HEAD. Use the existing npm/package-lock.json installation and build pipeline. Do not switch to Bun or change hosted settings. Include new untracked files explicitly in any later approved commit.
3. Obtain separate approval to commit/push and publish the updated restrictive Firestore rules. Confirm the correct existing Production project privately. Deploy the reviewed rules before or alongside the complete matching frontend/backend application, not individual API files. Existing public settings remain separate. No document needs to be pre-created; OFF is the missing-document default.
4. Deploy the complete approved commit through existing GitHub/Vercel Production infrastructure, with the emergency gate still false. Verify the official domain serves that deployment and ordinary webhook/scheduled reconciliation outcomes remain healthy without replay/manual triggering or new financial transactions. Prior owner-provided hosted configuration evidence is retained, not refreshed by these local tests.
5. Under approved read-only admin verification, check Settings displays locked/DISABLED and disables ON; approved orders disable Refund but expose existing trusted state/history. Check normal account/order/Cart/Wishlist views and customer denial of admin API actions. Review/synchronize, save OFF and other API actions can write audits/settings; they require approved Production write scope. Do not use them as read-only probes.
6. For rollback, rebuild a reviewed earlier commit with the currently authorized credentials and emergency gate false. Never reactivate a deployment retaining the compromised cron secret. Preserve restrictive rules/private records. Rollback does not undo Cart changes, cancellations, restored stock or submitted refunds. Do not enable an old backend that lacks individual-confirmation safeguards.

## Steps still required before LIVE refunds

Close the cron incident; publish and verify the complete safeguards/rules; inspect hosted admin authentication, UI and existing webhook/reconciliation history; review the inherited dependency advisory again because its acceptance was limited to disabled refunds. Obtain a separate security release approval before changing the emergency code gate. Leave the admin setting OFF during that release, then use its explicit confirmation only after authorization. Gate changes alone do not authorize a LIVE financial test. Any actual refund/payment, including the INR 1 order, still requires explicit user approval and per-order trusted eligibility review. Never extend expiry or regenerate a key for an uncertain attempt.

Local implementation readiness is separate from Production/LIVE readiness. Hosted refund execution, bank settlement, browser/mobile rendering and the actual historical order remain unverified.
