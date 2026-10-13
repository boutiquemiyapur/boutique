# Admin-only manual LIVE refund release handoff

Updated 2026-10-13. Current delta baseline: `e4c0e7828feaf13f055adcf8dc5313329ef79f32`. The existing UI/backend were retained. This handoff supersedes the earlier automatic-recovery design and 30-file manifest, which are now in the baseline.

## Current behavior

Only the revocation-checked authorized admin cancellation endpoint may initiate a refund, through a new review and explicit per-order confirmation. Cancellation request/approval, settings changes, webhooks, reconciliation, background jobs and scheduled retries cannot initiate refunds. Already initiated refunds remain observable through trusted provider evidence. Unknown or interrupted attempts are NOT resent automatically, even when both gates are ON and a durable prior confirmation exists.

Admin Settings retains its functional ON/OFF switch, explicit ON confirmation, effective status, actor/time history and errors. It defaults OFF when `refundSettings/control` is absent. The existing Refund Now button shows the amount; its confirmation dialog uses the exact server-reviewed order/payment/remaining INR amount. Submission alone is not reported as successful bank credit. Customer actions and direct requests cannot bypass backend role, settings, review or financial checks.

## Prepared code gate and emergency disable

`server/orders/refundPolicy.ts` now prepares `LIVE_REFUND_EXECUTION_ENABLED = true` LOCALLY for a separately approved admin-controlled release. This is not deployed or Production activation. No environment variable, secret or hosted setting was changed. The private persisted admin setting must also be ON; missing/OFF remains blocked. Existing Production settings were not read or changed in this task, so absence/OFF must be verified before deploying this prepared gate.

The same server code gate remains the emergency disable: set it to false, rebuild the complete reviewed application with current approved credentials and deploy only with separate approval. It blocks settings ON, admin execution and provider transport, including when a saved setting is ON. The admin OFF control is the normal runtime stop for subsequent initiations without editing code. OFF/emergency disable cannot recall already submitted/in-flight requests; these must continue to synchronize.

No recurring source edit is required for routine authorized ON/OFF changes after the one approved gate release.

## Initiation and retry safeguards

1. Admin authentication uses `verifyIdToken(token, true)` and exact `admin === true` at both settings and cancellation endpoints. Existing strict schemas, no-store responses, request limits and private Firestore controls are retained.
2. Review reads actual captured payment and refund history, validates order/payment ownership mappings, currency, exact server amount, remaining captured balance, original cancellation approval and original 24-hour recovery limit. Existing refunds, pending external refunds, invalid evidence, manual-review/failed/processed states and expired approvals block new initiation. Less than the provider INR 1 minimum is held without rounding.
3. The five-minute review binds order, authenticated admin UID, payment, amount, original approval timestamp, settings revision and immutable idempotency key. Confirmation re-fetches evidence and checks these bindings transactionally. Only a newly consumed review permits one initiation path. Replaying a consumed review observes status only; it never resends money.
4. The private execution function binds the current admin and review to the stored authorization at entry and in the lease transaction. Existing refund lease, stable `X-Refund-Idempotency` header and identical request body are retained. Simultaneous admins/confirmation duplicates/reconciliation cannot create independent refunds. Settings are checked again immediately before transport by the service and existing provider adapter.
5. A manual retry after an unknown or interrupted attempt requires a NEW review and explicit confirmation. It uses the SAME original refund key, payment, amount and approval timestamp. The old `retryRefund` action is retained only as a safe rejection (`REFUND_CONFIRMATION_REQUIRED`); it cannot reuse an old permit or renew an approval.
6. `recoverRefund` is status-only regardless of constructor gate value, saved settings or old execution authorization. It may discover an existing provider refund or mark an expired/malformed attempt for manual review. The cron endpoint explicitly constructs an execution-disabled observer and never imports the execution gate. Signed webhooks retain status-only refund observers and durable duplicate-event handling.
7. Inventory is restored only by the existing approved cancellation transaction and trustworthy movement ledger, once. Refund review/retry/status observation never restores stock again. Cart cleanup remains server-authoritative and purchased-only.
8. Confirmation still schedules the existing payment attempt promptly, but this now schedules STATUS TRACKING ONLY. There is no financial retry queue. Failed/unknown/processing messages remain truthful; the UI states that tracking does not resend funds.

## Existing approvals and the INR 1 order

Enabling settings starts no refunds and cannot initiate a batch. Old confirmations are not automatic retry permissions. Each existing eligible approval needs a new individual admin review and explicit confirmation. Respect the ORIGINAL 24-hour approval limit, manual-review states, exact balance and existing provider references; never reset a timestamp/state/key to force recovery. A previously submitted refund can be discovered and tracked even if no new initiation is allowed.

The actual INR 1 order was not inspected or changed. Do not promise eligibility or a refund. Its capture, remaining balance, existing refunds, approval time and inventory ledger require separately authorized inspection. An expired or uncertain order remains manual review; this release introduces no expiry override.

## Database and rules

This delta adds no schema, collection, migration, index, credentials or environment variable. It reuses `refundSettings/control`, private setting history, `refundReviews`, optional order execution authorization, cancellation audit records and existing payment attempts. The prior reviewed `firestore.rules` is unchanged in this delta and denies browser settings/history/review access, including browser admins, while financial writes remain server-only. Emulator authorization still passes 90 checks.

Prior deployed rules parity predated the admin-management baseline. Current hosted parity was not refreshed in this task. Before approval, verify/deploy the complete reviewed rules under separately approved Firebase release scope. Vercel does not publish rules. Never place this toggle in public/browser-admin-writable settings or loosen rules for direct browser refunds.

## Final local validation

| Check | Result |
| --- | --- |
| Complete payment/environment/cancellation/refund/Cart/client/webhook/security/Cloudinary/shopping/catalog/inventory/order suites | 232 tests passed; 0 failed/cancelled/skipped |
| Refund-management subset, included above | 29 passed, including actual provider adapter boundary tests |
| Firestore emulator | 90 authorization checks plus all functional runner suites; exit 0 |
| TypeScript | Pass |
| Production-mode Vite build | Pass |
| Diff/index/manifest checks | 16 exact files; no staged changes or new commit |
| Read-only production dependency audit | 0 critical, 4 high, 9 moderate; advisory remains unresolved |

Evidence is in ignored `node_modules/.cache/manual-refund-*.log` and `manual-refund-audit.json`. Provider operations, signatures and credentials are synthetic fixtures; real Firestore testing is restricted to `demo-ab-payments` on `127.0.0.1:8189`. No LIVE operation occurred. Mocked UI tests cover controls, explicit dialogs, double clicks, accurate amount/order and statuses, not actual browser/mobile viewport behavior. Local Firebase-disabled/large-bundle warnings remain. Local Node 22 tests/builds do not establish hosted Node 24 parity.

## Exact release manifest: 16 files

| File | Change |
| --- | --- |
| `ADMIN_REFUND_MANAGEMENT_IMPLEMENTATION.md` | Current manual-only handoff, release/activation and rollback instructions. |
| `PAYMENT_SECURITY_AUDIT.md` | Current evidence, gate state and release risk disposition. |
| `api/payments/reconcile.ts` | Status-only execution-disabled observer; no execution gate import. |
| `package.json` | Add actual provider-boundary test to existing refund-management command. |
| `server/orders/cancellation.ts` | Remove automatic initiation; private admin/review-bound send; consume once; legacy retry blocked. |
| `server/orders/refundPolicy.ts` | Prepare admin-controlled code gate true locally; retain emergency false switch. |
| `src/components/admin/AdminRefundActions.tsx` | Refund Now label and truthful manual-retry guidance. |
| `src/components/admin/AdminRefundSettings.tsx` | Explain webhooks/reconciliation never initiate/retry funds. |
| `scripts/cancellation-api.test.mjs` | Default admin OFF and blocked legacy action expectations. |
| `scripts/cart-cancellation-refund-emulator.test.ts` | Real Firestore confirmed-UNKNOWN observation sends zero; manual confirmations race observer. |
| `scripts/cart-cancellation-refund.test.ts` | Explicit manual retry tests; interrupted attempt cannot auto-resume; emergency disable retained. |
| `scripts/payment-environment.test.ts` | Invalid refund blocked before database/transport access. |
| `scripts/payment-security-audit.test.ts` | Prepared gate assertion and real manual-path timestamp corruption test. |
| `scripts/refund-management-api.test.mjs` | Actual ON/OFF, admin-only execution, replay rejection, real cron/webhook status-only evidence. |
| `scripts/refund-management.test.ts` | Manual-only unknown/interrupted/legacy recovery across ON/OFF and lease states. |
| `scripts/manual-refund-provider.test.mjs` | Actual adapter OFF/emergency denial and exact permitted mock transport/header/body. |

All existing settings/auth endpoints, Firestore rules, schema, credentials, payment processing, webhook verification, stock/Cart logic, package-lock.json and bun.lock are retained. Release the full checkout, including existing baseline files; the 16-file delta alone is not a standalone application.

## Approval and safe release sequence

Production release/activation is currently NO-GO despite passing local checks:

- E1: the exposed cron token incident remains unresolved. Closure/rotation/old-deployment protection requires its own approval and evidence. No rotation occurred here.
- The inherited Firebase/gRPC advisory remains: Firebase 12.18.0 -> Firestore 4.17.1 pins root grpc-js 1.9.16; the admin Firestore chain uses 1.14.6. No unsafe override, downgrade or dependency change was made. Earlier risk acceptance applied only with LIVE refunds disabled and DOES NOT authorize this prepared LIVE release. A new owner risk decision or supported tested upstream fix is required before activation. See PAYMENT_SECURITY_AUDIT.md for exact advisory links and limited demonstrated reachability.
- Hosted rules/app version, admin authorization/UI, webhook/refund synchronization and scheduler outcomes require release verification. No new hosted evidence, LIVE refund/settlement or actual INR 1 order verification is claimed.

After these gates and SEPARATE explicit user approval:

1. Approve the exact reviewed commit/push scope; retain the existing npm/package-lock.json build pipeline. No commit/push has been performed. Approval to deploy does not automatically authorize credential changes or financial transactions.
2. Inspect the existing private refund setting read-only and verify absent/OFF. If ON, obtain approval to disable it before deploying the prepared code gate. Publish/reverify restrictive rules under approved Firebase scope. No schema migration is required.
3. Deploy the entire matching application via existing GitHub/Vercel Production infrastructure, with admin setting OFF. Confirm the official domain/new deployment and ordinary webhook/scheduled history through read-only evidence, without replay or manual cron triggering.
4. Verify the authenticated admin switch works and customers/unauthenticated/revoked/non-admin users cannot access settings/execution. Observe settings, amount/order dialogs and statuses. Saving settings or reviewing/synchronizing refunds writes audits/settings and needs authorized Production write scope; do not describe those actions as read-only.
5. Activate ON only with explicit LIVE activation approval. ON alone sends nothing. Reconciliation/webhook delivery must still never initiate funds. Any actual individual refund or financial verification, including the INR 1 order, requires separate explicit transaction approval and a fresh valid admin confirmation.
6. For a normal runtime stop, turn the admin setting OFF under authorized scope. For server emergency disable, set the code gate false and rebuild/deploy the reviewed complete app with separate approval. Continue observing submitted refunds; neither stop reverses them.
7. Roll back only to reviewed code with the code gate false and current safe credentials. Do not promote old deployments containing the compromised cron token or old auto-initiation code with gate true. Preserve restrictive rules/private records. Rollback cannot undo prior refunds, stock restoration, cancellation or Cart cleanup.

Local implementation is ready for review. Production deployment and LIVE activation await the specific evidence/risk decisions and explicit approval above. No Production record/configuration/credential change, LIVE transaction, staging, commit, push or deployment occurred.
