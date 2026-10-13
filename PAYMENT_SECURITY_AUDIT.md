# AB Collections payment security audit and stabilization

Updated 2026-10-13. Current manual-only release delta baseline: `e4c0e7828feaf13f055adcf8dc5313329ef79f32`. The prior 20-file stabilization and 30-file admin-management deltas are now baseline/historical evidence. The latest manual-only section below and the 16-file ADMIN_REFUND_MANAGEMENT_IMPLEMENTATION.md manifest supersede their code-gate, automatic recovery, manifest and test-count conclusions. This remains the authoritative findings disposition.

## Recommendation

**Local manual-only implementation: GO for review. Production deployment/LIVE activation: NO-GO pending E1 cron incident closure, a new decision on the residual gRPC advisory for LIVE refunds, hosted release verification and explicit approval. The local code gate is prepared true; the admin setting defaults OFF and Production was not activated. Prior hosted evidence is historical, not verification of this new release.**

H1 and M1/M2/M4/M5/M6 remain fixed locally. M3 preserves legitimate independent purchases and documents the cross-device limit. The owner explicitly accepted the residual Firebase/gRPC advisory on 2026-10-13 **for a release with LIVE refunds disabled only**. That acceptance does not cover LIVE activation of this prepared gate. No unsafe override or Firebase downgrade was introduced. Hosted financial behavior and all transitive reachability are not fully verified.

The local `LIVE_REFUND_EXECUTION_ENABLED` gate is now prepared true in server/orders/refundPolicy.ts:4, with false retained as the server emergency disable. The persisted private admin toggle must also be ON, and every send requires a fresh explicit admin review/confirmation. Production gate/settings were not changed or newly inspected. Cancellation approval still holds refunds and restores trustworthy ledger-backed stock once. Reconciliation/webhooks observe status only, even with old confirmations and both gates ON. No LIVE payment/refund, Production record modification, credential/configuration change, staging, commit, push or deployment occurred.

Remaining release requirements:

1. Prior deployed rules matched the earlier reviewed source. The current local rules additionally deny refundSettings/history/refundReviews explicitly; prior implicit deny already protected these new namespaces. Publish/reverify the reviewed rules as coordinated, separately approved release work. Vercel does not deploy Firebase rules. Current deployed parity was not rechecked in this implementation task.
2. Owner verified the LIVE webhook and cron-job.org configuration/history. The exposed cron bearer token is compromised: coordinate its replacement in Vercel Production and cron-job.org, activate a new deployment and confirm normal scheduled recovery. This requires separate approval; no rotation occurred during this review. Do not invoke reconciliation as a read-only probe.
3. Preserve the observed npm install/build path. Do not assume unchanged bun.lock has the dependency patches. No hosted setting was changed.
4. Review the current 16-file manifest in ADMIN_REFUND_MANAGEMENT_IMPLEMENTATION.md and obtain separate commit/push/deploy/activation approval. Verify the existing private admin setting absent/OFF before deploying the prepared true gate; no saved Production value is assumed. The actual INR 1 order and hosted settlement behavior were not inspected or tested. Old approvals can require manual review, not a renewed timestamp or new key. A new dependency risk decision is required for LIVE activation.

## Scope and evidence boundaries

Audited trusted checkout, payment creation/verification/status/webhook/reconciliation, provider transport, authentication/schema/rate limits, cancellation/admin approval/refund recovery, reservation consumption/restoration, purchased-only Cart cleanup, Firestore rules, customer/admin browser flows, secrets/logging and adjacent Cloudinary signing. Existing architecture and gateway credentials were preserved.

All financial responses were synthetic. Real Firestore integration used only project demo-ab-payments on 127.0.0.1:8189; test scripts assert the emulator host. Rules tokens are deliberately unsigned emulator fixtures, not evidence that Production accepts forged tokens. Browser tests use mocked SDK/network/hooks, not hosted visual verification. Hosted Vercel project/build metadata was read, without invoking app financial endpoints. This was not a Git-history secret scan, hosted IAM audit or LIVE financial experiment.

Initial sandbox/esbuild/CLI access failures were rerun with authorization outside the sandbox. Synthetic fixture issues were corrected rather than weakening controls: webhook fallback IDs use the same double-hash document key as production; interrupted approval precedes initiation; shared signer helpers do not hoist Firebase SDK imports outside guarded error handling. Expected emulator denial diagnostics are not test failures; exit status and assertions establish the results.

## Findings and fixes

### H1 - HIGH: stale unpaid cancellation quote - FIXED

Source: server/orders/cancellation.ts:65, approval transaction; server/payments/service.ts:108.

Before the initial fix, capture or authorization between an unpaid quote and approval could produce NOT_REQUIRED and stock restoration for a newly paid order. Approval now atomically revalidates both paid and unpaid quote branches before cancellation writes. A changed payment state/balance produces REFUND_QUOTE_CHANGED; historical COD remains supported.

Proof: scripts/payment-security-audit.test.ts:18, :29 and :37; scripts/cart-cancellation-refund-emulator.test.ts deterministic quote/capture and quote/authorization interleavings. The original two expected-rejection tests failed before the fix; they now pass without cancellation/refund/stock approval writes. External capture after an approved cancellation remains possible and uses the existing late-capture review hold.

### M1 - MEDIUM: duplicate or malformed refund evidence - FIXED

Source: server/payments/refundEvidence.ts:5, server/payments/service.ts:154, server/orders/cancellation.ts:61.

Shared strict validation requires a bounded array, unique valid rfnd IDs, matching payment ID, mandatory INR currency, positive safe-integer amounts within capture, pending/processed/failed statuses, and a combined nonfailed amount no greater than capture. It runs before any trusted state mutation. Invalid evidence throws REFUND_EVIDENCE_INVALID while preserving the last trusted order, inventory, event and Cart state. Cancellation quotes and individual initiation responses use the same validation.

Proof: scripts/payment-security-audit.test.ts:95 checks duplicate IDs, wrong/missing currency, ID/payment mismatches, invented/created statuses, negative/zero/fractional amounts and excess totals, comparing complete state before/after rejection. Real Firestore regression retains paid evidence after duplicate synthetic rows. Valid pending, processed, failed and partial refunds still pass. Synthetic fixtures now include real provider currency; validation was not relaxed for fixtures.

### M2 - MEDIUM: malformed expiry inventory silently normalized - FIXED

Source: server/payments/service.ts:189; server/orders/inventory.ts:8.

Expired reservation release reuses the existing raw inventory-validation restoration helper and verifies reservation ownership before writes. Invalid totals, unsafe/negative stocks, invalid/duplicate keys, changed shape, nonarray variant data, null rows and invalid reservation lines are rejected. A failed transaction leaves products, reservation, movements and payment status unchanged. No guessed stock normalization occurs; authorized inventory review is required before retrying corrupted data.

Proof: scripts/payment-security-audit.test.ts:103 covers invalid keys, NaN, negative stock, duplicate keys, inconsistent totals and false variants with atomic-state comparisons. Real Firestore retains malformed product and RESERVED state. Existing normal expiry/retry, stock competition and exactly-once cancellation restoration suites pass.

### M3 - MEDIUM: cross-device independent intents - DOCUMENTED POLICY LIMIT

Source: server/payments/service.ts:22; src/services/paymentClient.ts:47.

No automatic server merge was introduced. A matching outstanding owned order visible in synchronized history reuses its intent across devices and Cart generations. Stale/missing history or an independent explicit intent can create a separate order/reservation. Each still requires an actual provider payment; no autonomous second charge occurs. Completed-generation repeat purchases remain independent. Customers should recover outstanding payments from My Orders before starting another checkout.

Proof: scripts/payment-client.test.mjs:121 and :131 cover generation changes, review holds, synchronized reuse, stale-history behavior and legitimate repeat purchases. scripts/payment-security-audit.test.ts:110 proves distinct explicit intents remain distinct provider orders/reservations. Global business-request deduplication requires an approved business policy and is deliberately outside this release.

### M4 - MEDIUM: failed refund observer skipped on webhook retry - FIXED

Source: server/payments/service.ts:146; api/payments/webhook.ts:20.

The financial event transaction durably marks refundObserverStatus=PENDING. DONE is written only after syncRefund succeeds. Observer or completion-write failure leaves recovery retryable. Identical signed delivery validates the event hash and reruns only the unfinished observer using the stored order mapping; it does not replay payment, inventory or Cart effects. Legacy mapped events lacking the marker also recover. Ignored/completed events acknowledge normally; conflicting hashes remain rejected.

Proof: scripts/payment-webhook.test.mjs:47 verifies failure leaves PENDING, signed retry completes DONE, payment synchronization occurs once, and subsequent delivery is a no-op. :56 covers legacy mapped events; the completion-write failure case proves PENDING survives marker-write failure as well. Real Firestore duplicate capture/reconciliation tests verify financial/Cart/inventory idempotency. Status synchronization does not initiate refunds. If webhook retries end, existing authenticated polling/reconciliation remains the recovery path; its hosted operation must be verified.

### M5 - MEDIUM: invalid refund retry timestamps - FIXED

Source: server/orders/cancellation.ts:117, :126, :163, :169.

Uncertain initiation requires canonical finite ISO approval/update times, coherent chronological order and no future update. Validation occurs before provider inspection can rewrite metadata and again in the initiation transaction. Bad metadata enters MANUAL_REVIEW without a refund POST. The existing 24-hour retry cutoff is also checked at the transaction claim. Recovery routes uncertain states through execute before synchronization could mask bad timestamps. Approval is not silently renewed and no fresh key is generated.

Proof: scripts/payment-security-audit.test.ts:116 covers missing, malformed, impossible and future dates with zero synthetic refund calls; :127 corrupts a timestamp after quoting and verifies transactional manual review. Real Firestore verifies manual review with no initiation. Existing known-ID, timeout/unknown outcome, immutable key/body, interrupted initiation and expired-window tests pass. The 24-hour cutoff is application policy, not verified provider retention.

### M6 - MEDIUM: Cloudinary signer revocation/limits - FIXED

Source: api/cloudinary/sign.ts:46, :48, :52; shared helpers in server/payments/validation.ts:62 and :69, re-exported by http.ts.

Signer requires verifyIdToken(token,true) and strict admin claim. Requests require application/json, encoded body <=32 KiB, only folder/recordId, approved folder and bounded identifier, bounded authorization header, and a durable per-UID 30/minute signing limit. Parsing/rate helpers were extracted without moving Firebase SDK initialization outside its guarded dynamic-load path. Safe SDK-load failures and sanitized logging remain intact.

Proof: scripts/cloudinary-sign.test.ts:112 rejects revoked unexpired admin tokens; :210 rejects oversized/unexpected requests and tests 30 successes followed by 429. Existing role, schema, signing/upload contract, SDK-load failure and secret-free log checks pass. No actual upload/account revocation was performed.

### D1 - CRITICAL package advisory: proxy-addr trust subnet - PATCHED

package-lock.json carries proxy-addr 2.0.8 instead of 2.0.7. Original package severity is CRITICAL; no reachable app-level IP authorization bypass was demonstrated because this code has no Express trust-proxy server or IP-based payment authentication. Dedicated audit regression rejects arbitrary IPv4 attackers for the malformed mapped-IPv6 trust subnet and retains valid subnet behavior. [Maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).

### D2 - HIGH package advisories - PARTLY PATCHED / ACCEPTED FOR DISABLED REFUNDS ONLY

Compatible patches retained from the initial audit: brace-expansion 2.1.4 -> 2.1.7, nested google-gax grpc-js 1.14.4 -> 1.14.6, source-map-js 1.2.1 -> 1.2.2. Root grpc-js remains 1.9.16 under Firestore's ~1.9.0 pin. No override, force fix or Firebase downgrade was introduced.

Read-only registry metadata on 2026-10-13 reports Firebase latest 13.0.0 and Firestore latest 4.18.0, which still pins ~1.9.0. A major SDK change would not solve that pin and was not installed. npm audit --omit=dev reports 0 critical, 4 high and 9 moderate affected-package entries; the four high entries are the single inherited grpc-js/firestore/firestore-compat/firebase chain, not four reproduced payment vulnerabilities. Advisory check exits 1 because findings remain.

Exact residual: package certificate-authorization/getAuthContext and server-error advisories remain present. No app gRPC server or getAuthContext-based authorization was found; Firebase is used as a client. This limits demonstrated reachability, not proof that every transitive use is safe. Owner accepted this residual advisory for a release with LIVE refunds disabled; continue tracking a supported upstream patch. Remaining moderate dependency alerts were not force-upgraded. Evidence: stabilize-dependencies.json and stabilize-firestore-metadata.json. [Advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j).

### L1 - LOW: operational comments - PARTLY RESOLVED

StoreContext's stale deferred-cleanup comment now states that trusted backend capture performs purchased-only cleanup. Owner has now verified the existing external scheduler: every minute in UTC with a 30-second timeout and repeated scheduled HTTP 200. vercel.json has no cron because scheduling is external. No scheduler change was made; token rotation remains outstanding.

## Vercel package manager: read-only verification

Linked project boutique uses Vite, Node 24.x and automatic install/build settings. Latest observed Production deployment: https://boutique-d363gjgd8-boutique8.vercel.app. Build logs at 2026-10-13T08:55:22Z show dependency installation with npm output and at 08:55:23Z Running npm run build. The observed build uses **npm**, not Bun. The repository includes package-lock.json; standard npm installation consumes it. No lock-disabling npm configuration was found. Logs do not prove frozen-lock installation or parity with this uncommitted checkout.

No hosted install setting was changed; bun.lock remains unchanged. Preserve npm for this reviewed release and verify the next approved deployment's resolved dependency versions. Evidence: ignored stabilize-vercel-project.log, stabilize-vercel-deployments.log and stabilize-vercel-build.log. Only install/build metadata was displayed. Do not blindly share raw build/debug logs.

## Final local validation

| Command | Result |
| --- | --- |
| npm.cmd run test:payments | 37/37 |
| npm.cmd run test:cancellation-refunds | 28/28 |
| npm.cmd run test:payment-client | 38/38 |
| npm.cmd run test:payment-webhook | 6/6 |
| npm.cmd run test:shopping-ux | 30/30 |
| node scripts/admin-driven-catalog.test.mjs | 23/23 |
| node scripts/inventory-management.test.mjs | 11/11 |
| node scripts/order-transaction.test.mjs | 1/1 |
| node --import tsx --test scripts/cloudinary-sign.test.ts | 12/12 |
| npm.cmd run test:payment-security | 17/17 |
| npm.cmd run test:payment-emulator | 60 authorization checks + three functional suites, exit 0 |
| npm.cmd run lint | TypeScript passes |
| npm.cmd run build | Production-mode local build passes |
| git diff --check | Passes; Git LF/CRLF conversion notices only |
| npm.cmd audit --omit=dev --json | 0 critical / 4 high / 9 moderate; exit 1, residual documented |

**203 tests pass**, plus emulator assertions. M1/M2/M4/M5/M6 now assert safe outcomes rather than unsafe characterization results. M3 intentionally documents independent orders; it is not a claim that all cross-device duplicates are prevented. Affected payment/cancellation/emulator/type/build suites were rerun after final guards. Evidence is in ignored node_modules/.cache/stabilize-*.log. Local Firebase-disabled and large-bundle warnings remain; the local build does not establish hosted runtime configuration. Existing synthetic environment tests separately cover Production-mode validator requirements. Local Node is 22; hosted project metadata says Node 24, so full hosted runtime parity remains unverified.

Additional retained coverage: forged callbacks/valid signature with uncaptured evidence; wrong amount/currency/payment/order/customer; server-priced checkout; signature byte fidelity; duplicate and out-of-order events; foreign-order and browser-admin financial write denial; concurrent fulfilment/cancellation; last-stock competition; exactly-once restoration; Cart later additions, variants, retries and historical paid orders; ambiguous provider responses; payment recovery; fail/cancel/pending Cart preservation. No Production stress testing occurred.

PowerShell emulator rerun:

```powershell
$env:JAVA_HOME='C:/Program Files/Java/jdk-23'
$env:PATH="$env:JAVA_HOME/bin;$env:PATH"
npm.cmd run test:payment-emulator
```

## Exact changed files

Relative to baseline 1deb57c, **20 modified/new files**, including earlier uncommitted audit patches preserved during stabilization:

1. api/cloudinary/sign.ts - revoked-token checks, strict body/auth limits and UID rate limiting.
2. api/payments/webhook.ts - durable observer completion and signed retry recovery.
3. package-lock.json - four compatible transitive patches from the initial audit.
4. package.json - test:payment-security command.
5. scripts/cart-cancellation-refund-emulator.test.ts - H1/M1/M2/M5 emulator regressions.
6. scripts/cart-cancellation-refund.test.ts - realistic currency and interrupted timestamp fixtures.
7. scripts/cloudinary-sign.test.ts - revoked-token/request/rate-limit regressions.
8. scripts/payment-client.test.mjs - cross-device outstanding/repeat-purchase tests.
9. scripts/payment-fixture.ts - realistic INR synthetic refund evidence.
10. scripts/payment-foundation.test.ts - realistic INR synthetic refund evidence.
11. scripts/payment-webhook.test.mjs - observer failure/retry/legacy-event tests.
12. scripts/payment-security-audit.test.ts - audited security regressions and policy-limit tests.
13. server/orders/cancellation.ts - H1 revalidation, shared refund validator, timestamp guards/manual review.
14. server/orders/inventory.ts - raw inventory/reservation validation hardening.
15. server/payments/http.ts - re-export shared limits, preserving existing callers.
16. server/payments/service.ts - strict evidence, raw expiry restoration, durable pending observer marker.
17. server/payments/validation.ts - shared JSON-body and durable rate-limit helpers.
18. server/payments/refundEvidence.ts - new shared strict validator.
19. src/context/StoreContext.tsx - stale cleanup comment only.
20. PAYMENT_SECURITY_AUDIT.md - this updated report.

No financial gate, credentials, Production data, Firestore rules, Vercel configuration, webhook subscriptions or scheduler configuration changed during agent work. Owner subsequently supplied manual webhook/scheduler verification and reported cron-token exposure. Installed packages/local build logs are ignored artifacts. Index remains empty and HEAD unchanged.

## Rules, hosted checks and release coordination

The verified deployed rules deny client financial writes even for browser admins. paymentEvents markers and paymentRateLimits remain server-only; no new collection/rules permission is needed for these fixes. The signer now writes its rate-limit records through Admin SDK, not browser permissions. Existing canonical/legacy order owner reads and private ledger/audit denial pass 60 emulator checks. Read-only Rules API inspection confirmed current deployed/local source parity. A later Vercel app release does not itself publish Firebase rules. Older browser-admin order writes must not be restored by loosening rules.

Verify the existing Razorpay LIVE webhook points to /api/payments/webhook and enables payment.authorized/payment.captured/payment.failed/order.paid plus refund.created/refund.processed/refund.failed. Original raw bytes/HMAC and safe duplicate recovery must run in the hosted serverless runtime. Verify existing RAZORPAY_WEBHOOK_SECRET wiring without printing values. No new keys or webhook subscription changes were made. refund.speed_changed is not required by this implementation.

Verify the existing scheduler calls GET /api/payments/reconcile with the server-only CRON_SECRET bearer and that its actual cadence/batch capacity (five attempts/invocation) meets recovery needs. No scheduler invocation was used as a test; it can mutate stock, orders and Cart even when refunds are disabled. Authenticated status polling synchronizes existing refunds without initiation. The scheduler only initiates from approved durable records when the code gate is enabled; it remains disabled here.

After separate approval, release the matching frontend/backend commit and deploy verified restrictive rules as separately approved work. Preserve npm and current credentials. Do not enable LIVE refunds as part of deployment. Read-only owner-account checks must distinguish paid/refunded status from Cart selections. Any Cart edit, cancellation/approval, reconciliation or financial action against Production needs its own approved scope.

Rollback requires separate approval to restore a known-good app/API deployment. Keep restrictive financial-write rules unless a reviewed rules rollback is approved. Code rollback cannot undo captures, refunds, cancellation approvals, stock restoration or Cart subtraction; those need case-by-case authorized review, not bulk rewrites or fresh refund keys.

Remaining risks: exposed cron token pending rotation; exact October 10 webhook response-code attribution; broader hosted IAM/account assignments, scheduler backlog/30-second timeout under slow-provider conditions, full new-code Node 24 behavior, provider refund permissions/settlement/idempotency retention, actual historical orders and the existing INR 1 cancellation. Owner has verified current webhook subscriptions and cron configuration/history. Deployed rule-source parity and current deployment Git baseline are verified. The global gate remains false; held approvals older than 24 hours require review. No new project, TEST keys or Preview infrastructure is required or proposed.

## Final Production release-gate inspection - 2026-10-13

Inspection snapshot recorded at 16:36 IST (11:06 UTC), using existing Firebase/Vercel CLI logins and GET-only configuration APIs. No customer/order document reads, app status/reconciliation calls, webhook test/replay, cron manual execution or financial operation were performed. Only this local report was changed during this verification; ignored evidence files were written locally. Prior 203 tests and 60 authorization checks remain the stabilization evidence and were not rerun in this read-only inspection.

| Gate | Result | Evidence / limitation |
| --- | --- | --- |
| Deployed Firestore rules | VERIFIED MATCH | boutique-79308 default database's active cloud.firestore release was retrieved via Rules API GET; normalized source matches firestore.rules with no differences. |
| Deployment baseline and domain | VERIFIED | abcollectionbyaadya.in serves READY Production deployment dpl_2hdjC2cfqqBi7jT8Go5wEtcxva54, Git main SHA 1deb57cc1a8907f870d11d985bb314868bec2c05, matching the manifest baseline. |
| 20-file manifest | VERIFIED | Git diff plus untracked files equals all 20 report entries: zero missing/extra files. firestore.rules is unchanged from this deployed baseline and therefore correctly absent from the delta. |
| npm install/build path | VERIFIED OBSERVED | Existing build used npm; current deployment settings are Vite, automatic install/build, Node 24.x. No setting changed. |
| LIVE refund exclusion | VERIFIED IN SOURCE / BASELINE | Current and deployed-commit refundPolicy.ts both set LIVE_REFUND_EXECUTION_ENABLED=false. No runtime refund environment switch is introduced by this release. |
| Vercel Production variable presence | VERIFIED PRESENCE ONLY | RAZORPAY_WEBHOOK_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, PAYMENTS_LIVE_ENABLED, CRON_SECRET and three FIREBASE_ADMIN_* variables are present in Production scope. No values were printed or saved. Presence does not prove matching dashboard secrets, valid credentials or current immutable deployment injection. |
| Razorpay LIVE webhook dashboard | OWNER-VERIFIED | Owner confirms enabled status, official-domain URL, all seven subscriptions, October 12 HTTP 200 deliveries and successful retries of older event IDs. Agent did not access Dashboard; recent Vercel POST 200 logs provide additional read-only corroboration. |
| cron-job.org job | OWNER-VERIFIED; TOKEN COMPROMISED | Enabled, correct GET endpoint, every minute, UTC, 30-second timeout, bearer header and repeated scheduled HTTP 200 confirmed by owner. Exposed bearer token requires coordinated rotation before release. No job was manually triggered. |
| Residual Firebase/gRPC advisory | ACCEPTANCE PRESERVED | Owner's temporary acceptance remains restricted to LIVE refunds disabled. Remaining HIGH inherited alerts and moderate debt are unchanged; no override/downgrade or new acceptance scope. |

### Firebase rule-source comparison

Project boutique-79308 matches local Firebase configuration, the sole accessible Firebase CLI project, and the compiled public Production JavaScript asset /assets/index-DB9AM0DQ.js. The public HTML/asset were fetched with GET only; JavaScript was not executed and no Firebase data endpoint was called. Only the project ID was extracted; public API keys and other configuration values were not printed or retained. Active release: projects/boutique-79308/releases/cloud.firestore. Ruleset: projects/boutique-79308/rulesets/475f4632-81be-4e10-91a0-0d7043ed1195. Release updated 2026-10-13 at 14:25:55 IST (08:55:55.993579 UTC). Retrieved filename: firestore.rules.

Both sources have normalized SHA-256 91588daac678089ffd92311d4ff47469ae463c0a10081b2602257ff1ef694bcd. Normalization changes CRLF to LF and trims outer whitespace; comments and rule expressions are retained. The diff is empty. No Production data was queried to establish this comparison.

Verified protections include canonical/legacy order ownership reads, denied browser financial writes even for admins, private checkout/payment/reservation/inventory/cancellation-audit/rate-limit records, and owner Cart edits limited to items/updatedAt so trusted checkoutGeneration/lastPurchasedOrderId cannot be forged. New refundObserverStatus fields use already-private paymentEvents, and signer limits use already-private paymentRateLimits. Admin SDK writes bypass client rules as intended. Therefore **no coordinated rules deployment or additional rules file is required for these 20 changes**. Broader service-account IAM and admin-claim assignments were not audited live.

### Deployed application compatibility and ordering

Vercel Git metadata ties the served Production application to the exact reviewed baseline 1deb57c (Cancel and refund). That baseline already includes purchased-only Cart cleanup, customer cancellation requests, backend admin decisions, held refunds and the trusted fulfilment API. Current rules are compatible with that baseline; this is not an upgrade from a browser-written financial-order model.

The 20-file delta contains all stabilization implementation, helper imports, tests, report and compatible dependency-lock patches. Frontend Cart/Wishlist implementation is already in the baseline; the only frontend source delta is its cleanup comment. The unchanged reviewed rules and refundPolicy.ts must remain present in the full repository checkout used to build, although neither needs a new delta entry.

Deploy the complete approved commit through the existing npm pipeline, not selected API files: webhook observer marking/recovery, shared refund validation, strict expiry restoration, timestamp guards and signer request helpers must be bundled together. No new schema migration, secret, index or collection permission is required. In-flight old signed webhook events remain compatible; mapped events without observer markers recover safely. Existing inventory whose raw records are malformed will now fail closed and require authorized review rather than normalization. Old uncertain refund records with malformed/expired timestamps need manual review; this release does not renew them.

Do not revert rules to enable old browser financial writes. A later app rollback cannot undo Cart subtraction, stock restoration, cancellation approvals or financial effects already committed. Existing runtime is Node 24 while the local validation used Node 22; metadata and successful prior builds establish the existing runtime, not complete hosted behavioral verification of the new code.

### Original Razorpay evidence request - superseded by owner verification below

Expected Production path: https://abcollectionbyaadya.in/api/payments/webhook (or another verified Production alias serving the same endpoint without redirect). This is the expected path, **not an observed Razorpay Dashboard setting**.

Required subscriptions for the current integration: payment.authorized, payment.captured, payment.failed, order.paid, refund.created, refund.processed and refund.failed. refund.speed_changed is not required by the current workflow. The source preserves bodyParser:false, original wire-byte consumption and constant-time HMAC-SHA256 using RAZORPAY_WEBHOOK_SECRET before JSON parsing. It validates duplicate IDs/hashes, refetches provider evidence and safely retries pending refund observers. These checks match [Razorpay's signature and duplicate-delivery guidance](https://razorpay.com/docs/webhooks/validate-test/); refund lifecycle events match [Razorpay's event documentation](https://raw.githubusercontent.com/razorpay/markdown-docs/master/webhooks/refunds.md). The baseline and new code use the same signature scheme. Production variable presence is verified; matching Dashboard secret and hosted delivery acceptance are not.

Please provide these existing Dashboard screenshots or equivalent redacted text; do not click Test, Replay, Resend, Save or create a new payment/refund:

- Razorpay **LIVE mode** Webhooks list/details showing enabled status, complete webhook URL and the full subscribed-event list.
- Recent delivery history showing timestamps/timezone, event type, HTTP status, delivery/retry outcome and duration if available; include the latest successful payment event and any recent failures. If there are no refund deliveries, state that explicitly; do not generate one.
- Redacted details for one existing successful delivery and one failed delivery if present: endpoint, timestamp, HTTP status and response error code. Hide secrets, full signatures, payment/customer payloads, email/phone/card details and account identifiers not needed for this check.
- Owner confirmation that the existing configured Dashboard webhook secret is the same secret configured as RAZORPAY_WEBHOOK_SECRET in Vercel Production. Do not send either value, a hash or a secret-bearing screenshot.

### Original cron-job.org evidence request - superseded by owner verification below

Expected target: GET https://abcollectionbyaadya.in/api/payments/reconcile (or equivalent verified Production alias without redirect). Expected request header: Authorization: Bearer [REDACTED], matching existing Vercel CRON_SECRET. CRON_SECRET is present in Production scope. This does not establish that the cron job is configured or enabled.

Please provide existing cron-job.org screenshots or redacted details without Run now/Test/Save:

- Job overview/details showing enabled/active state, full URL, HTTP method, schedule/frequency, timezone and configured timeout.
- Request header names and authorization format with the entire token hidden. Confirm the stored bearer token matches Vercel Production CRON_SECRET; do not reveal it. A job title that says reconciliation is insufficient evidence.
- Execution history for at least the last five scheduled runs, showing timestamps/timezone, HTTP status, success/failure and elapsed duration.
- Details of the latest successful scheduled run showing HTTP 200 and response summary if retained (expected processed count and failed:0); include any recent non-200/timeout failures with safe error codes. Redact request header values and any customer/order identifiers.

The source processes at most five due attempts per invocation and requests minute-scale recovery. Inspect actual cadence and timeouts against recorded duration/backlog; a 200 with processed:0 proves reachability/authentication only, not that pending records were successfully processed. Do not manually invoke the endpoint to obtain proof. If request-header/history screenshots are unavailable, an existing redacted configuration/history export is acceptable. No API key should be created for this inspection.

### Final disposition

**Superseded by the final review below: owner has supplied webhook and scheduler verification. NO-GO now remains because the cron bearer token is compromised and has not been rotated.** Firebase rule parity, manifest completeness, Production baseline and LIVE-refund exclusion are verified; the accepted dependency advisory is not being reintroduced as an owner-decision blocker. No new Firebase, TEST credentials or Preview infrastructure is needed. After approved credential rotation and normal scheduled recovery verification, reassess GO for the scoped release with LIVE refunds disabled; separate commit/push/deploy approval still applies. If an actual webhook/scheduler defect is revealed, report the specific defect and obtain approval before configuration changes.

Evidence files are ignored local artifacts: release-firestore-deployed.rules, release-firestore-metadata.json, release-firestore-diff.txt, release-deployment-safe-metadata.json, release-env-presence-only.json, release-public-bundle-project.json and release-current-deployment.json under node_modules/.cache. Vercel env responses were filtered in memory to presence booleans; secret values were not retained. No live request payloads or financial records were copied.

## Final release-gate review after owner verification - 2026-10-13

### Current disposition: NO-GO solely for the unresolved credential incident

Local fixes, 20-file manifest, deployed rule parity, webhook compatibility and temporary dependency acceptance support the scoped release with LIVE refunds disabled. The owner has now manually verified the LIVE webhook and external scheduler. **The cron bearer token was exposed in a screenshot and must be treated as compromised. Rotation has not been performed or authorized. Production release is NO-GO until coordinated rotation and post-cutover scheduled recovery are verified.** Approval to rotate/deploy is separate from this review.

Evidence provenance matters: Dashboard/job details below are owner-provided assertions, not screenshots or direct dashboard access in this agent session. Vercel runtime-log results, code/Git history and deployment-protection metadata were independently inspected read-only. No new transactions, webhook replay, manual cron run or Production record inspection was used.

### October 10 webhook failures and current compatibility

Owner evidence:

- Existing LIVE webhook is enabled on the correct official Production domain and subscribes to payment.authorized, payment.captured, payment.failed, order.paid, refund.created, refund.processed and refund.failed.
- On October 12, order.paid, payment.captured and payment.authorized each have HTTP 200 deliveries.
- October 10 HTTP 400 attempts were followed by HTTP 200 deliveries for the same event IDs.

Assessment: those event deliveries recovered. This does **not** establish that the original 400 was a transient network error; 400 can be an application validation rejection. The handler can acknowledge duplicates/ignored unmapped events, so HTTP 200 alone does not prove every financial or stock side effect. No correlated October 10 response error code, exact timestamps or request IDs were provided.

Read-only Git history identifies a plausible historical processing cause: commit 52c03b2b38aecae53f68e79e80bd3617c601bb05 at October 10 19:47:56 IST replaced direct req.body access with descriptor inspection and original data/end wire-stream consumption. The previous implementation could invoke Vercel's lazy parsed-body getter and return RAW_BODY_REQUIRED (default HTTP 400). The same commit added explicit INVALID_JSON classification. This is a confirmed historical code correction, but attribution of the owner's specific failures to it is **an inference**, not established incident root cause; deployment timing/event correlation is unavailable.

The first dated Vercel historical-query request failed with a Vercel log API Response Error (400); this is not a new webhook failure. A successful alternate query (explicit project ID, last three days, limit 100) returned only five current request records, not the October 10 failures. Known response code counts for the old events therefore cannot be recovered from the returned data. Do not infer that unreturned old logs contained no errors.

Available Vercel request records, October 13 IST (all correlated to reviewed deployment dpl_2hdjC2cfqqBi7jT8Go5wEtcxva54 and the official Production domain):

- 17:23:46.093, 17:23:46.704, 17:23:46.907 and 17:23:58.278: POST /api/payments/webhook, HTTP 200.
- 16:42:18.896: GET /api/payments/webhook, HTTP 405, METHOD_NOT_ALLOWED. This is correct POST-only rejection before payment processing, not evidence of a failed Razorpay POST. Caller/event identities were not attributed.

No ongoing webhook processing defect is established by available evidence. The appropriate disposition is **historical delivery failures recovered; exact cause unconfirmed**. Do not add gateway changes or replay events merely to diagnose old failures. If still available, provide a redacted October 10 failed-attempt response code/body and timestamp plus its matching later successful delivery; this can resolve attribution without secrets, payment/customer payloads or new transactions. This diagnostic gap is a recorded risk, not by itself a new release blocker in light of later successful deliveries and regression coverage.

Current/local compatibility: api/payments/webhook.ts:8 retains bodyParser:false; :13 verifies original bytes using constant-time HMAC-SHA256 before JSON parsing. server/payments/http.ts:31 avoids the lazy getter. server/payments/provider.ts:18 retains the same signature calculation and server-only RAZORPAY_WEBHOOK_SECRET. The 20-file delta does not change webhook URL, secret name, subscription names, byte-verification scheme or payment credentials. It only adds durable post-event observer recovery plus shared validation. Legacy mapped events without the observer marker remain compatible. Existing local tests cover signed wire bytes, duplicate/out-of-order events, malformed requests and pending-observer recovery; new refund behavior is not claimed LIVE-tested. [Razorpay verification guidance](https://razorpay.com/docs/webhooks/validate-test/).

### Scheduler evidence and limits

Owner confirms the existing cron-job.org job is enabled, targets the correct Production GET /api/payments/reconcile, runs every minute in UTC, uses a 30-second timeout and an Authorization Bearer header, and has repeated scheduled HTTP 200 responses. This satisfies the configuration/history gate on owner evidence, but the token is no longer safe to retain. No manual job trigger occurred.

Source api/payments/reconcile.ts:12-15 requires exact bearer equality with CRON_SECRET before obtaining Firebase/provider access. It then processes up to five due attempts and can write orders, reservation releases, Cart cleanup and retry schedules. The compromised token therefore grants privileged maintenance access and potential request/cost exhaustion even though it cannot bypass trusted payment evidence or enable LIVE refunds. A 30-second external timeout is shorter than the function's configured maximum and slow paginated provider reads can exceed it. Repeated observed successes support current operation but do not prove worst-case duration or backlog capacity; monitor existing scheduled outcomes and durations rather than stress-test Production.

### E1 - HIGH operational incident: exposed cron bearer token - OPEN / RELEASE BLOCKER

The token's value was not supplied to this agent, reproduced, hashed or stored. Treat every screenshot/copy containing it as compromised. Redacting or restricting copies prevents further disclosure but does not revoke existing copies. The incident is not covered by the owner's temporary gRPC acceptance.

Vercel Production environment changes apply to a new deployment; updating CRON_SECRET in Settings alone does not change the current immutable deployment. Likewise, changing only cron-job.org's header produces authorization failure rather than server-side revocation. Old retained deployments may still hold the old environment value. [Vercel environment-variable behavior](https://vercel.com/docs/environment-variables).

Read-only protection check: the existing Vercel project reports ssoProtection.deploymentType=all_except_custom_domains. HEAD-only homepage checks of the current and two older generated deployment URLs returned 302 to vercel.com without following redirects. This corroborates anonymous deployment protection for those sampled URLs; it is not proof that every old custom-domain alias, protection exception or shared bypass is covered. No reconciliation route was probed. Preserve existing protection and inventory old custom aliases/automation exceptions during rotation. [Deployment protection scopes](https://vercel.com/docs/deployment-protection).

### Coordinated rotation procedure - instructions only, separate approval required

1. Obtain explicit approval for this incident-maintenance scope: secure token replacement, job pause/header update/resume, a Production redeployment and any necessary temporary path restriction or old-alias protection. Prefer an urgent rebuild of the currently trusted deployed commit with the new secret; do not silently combine rotation with the uncommitted 20-file release. A combined stabilization release requires its own explicit approval.
2. Prepare a fresh high-entropy token privately in a trusted password manager/secure generator (for example 32 random bytes). Do not paste it into chat, screenshots, Git, shell arguments, .env exports or logs. Keep the existing name CRON_SECRET; no new environment variable, Razorpay credential or infrastructure is required. Prepare both authenticated owner dashboard sessions before the brief maintenance window.
3. Verify existing protection covers old generated URLs and that any old custom-domain aliases cannot expose a retained deployment's reconciliation endpoint. If a gap exists, obtain approval to restrict/remove the affected alias or otherwise protect that route. Do not delete deployments casually: this can remove rollback options. Where existing Vercel firewall capability permits, an approved short-lived restriction on **only /api/payments/reconcile** can contain the exposed token during cutover without blocking checkout or the Razorpay webhook. Do not apply project-wide protection to the official Production domain in a way that blocks customer access/webhook deliveries. Feature availability/coverage must be reviewed before configuration changes; no upgrade or new service is proposed.
4. Pause the existing cron job for the cutover and allow the prior scheduled request to finish according to normal recorded durations (the client's 30-second timeout is not proof that the server stopped). Pausing the job alone does not revoke attacker access. If temporary route containment is approved, apply it while replacing the exposed credential; otherwise the old server token remains valid until the replacement deployment becomes active, so keep that interval minimal and monitor rather than claim immediate revocation.
5. Replace the **existing Vercel Production CRON_SECRET** securely. Leave Firebase/Razorpay/webhook credentials, PAYMENTS_LIVE_ENABLED and LIVE_REFUND_EXECUTION_ENABLED unchanged. Redeploy the approved commit into Production using current environment settings, wait for READY and verify the official domain now points to the new deployment. Do not merely promote a build made before the secret update or reuse the previous deployment's captured environment. [Vercel redeployment guidance](https://vercel.com/docs/deployments/managing-deployments).
6. While the job remains paused, replace its existing Authorization header with Bearer followed by the same new token. Keep GET, official-domain endpoint, every-minute schedule, UTC timezone and 30-second timeout. Confirm configuration privately; do not include header values in proof screenshots. Remove only the approved temporary reconciliation restriction after the new deployment/header are aligned; retain old-deployment protection.
7. Resume the existing scheduled job. Verify the next three to five **automatic scheduled** executions return HTTP 200, with failed:0 where a response summary is retained, and normal duration/no persistent auth failures. Use history/log inspection only; do not Run now/Test or manually call reconciliation. Also inspect ordinary existing webhook outcomes; do not generate/replay events.
8. Confirm revocation coverage by deployment/env provenance and routing/protection inventory, not by transmitting the old token to an uncertain endpoint. Account for every reachable old alias/retained deployment and any automation bypass. Protect or retire exposed old access only with separate approval. Rollback must rebuild the chosen old code with the **new** secret; instant rollback to a pre-rotation deployment could reactivate the compromised token.
9. Restrict/redact the exposed screenshot and shared copies, and retain an incident note with rotation time, deployment ID and masked success evidence only. Do not retain either token. If an unauthorized request is suspected, perform a separately approved read-only investigation; do not repair records or initiate refunds automatically.

The interruption is restricted to scheduled reconciliation during the coordinated redeploy/header cutover; normal checkout and signed webhook handling need not be paused. An exact interruption duration cannot be guaranteed before the actual build and in-flight request durations are known. No dual-token grace period or weaker authentication is needed.

### Manifest, dependency acceptance and final recommendation

The current manifest still matches exactly 20 files against 1deb57c, with no missing/extra entries. Current deployed Firestore rules match the local file and need no deployment for this delta. The baseline already contains Cart cleanup/cancellation/refund-hold UI; release all shared helpers/backend changes together through npm. LIVE_REFUND_EXECUTION_ENABLED remains false and refund enablement is excluded. Owner's temporary acceptance of the inherited gRPC advisory remains in force only for this disabled-refund release. The prior 203 tests/60 rule checks are unchanged stabilization evidence, not freshly run hosted tests.

**Final NO-GO: rotate the compromised cron token and verify the replacement deployment plus normal scheduled execution before approving the release.** Webhook/job configuration evidence is now accepted as owner-verified. Historical 400 deliveries were recovered; exact attribution remains unverified, with no currently demonstrated webhook defect. Once incident closure is evidenced, the code is eligible for GO for the scoped release with LIVE refunds disabled, subject to separate commit/push/deploy approval. No credentials/configuration/records/transactions were changed by this review.

Read-only evidence artifacts under node_modules/.cache: finalgate-webhook-history-safe.json, finalgate-webhook-history-alternative-safe.json, finalgate-webhook-log-shapes-safe.json, finalgate-webhook-request-summary-safe.json, finalgate-webhook-deployment-correlation-safe.json, finalgate-deployment-protection-safe.json and finalgate-old-deployment-access-safe.json. Raw log messages, signatures, secret values and customer payloads were discarded rather than copied into the report.

## Prior Admin Refund Management verification — superseded by manual-only release below

2026-10-13, against local HEAD `3c48bff13d28004b99b71d2a4429e2d9bc562d6d`. The previous stabilization is now in that baseline. **The current delta is exactly 30 files**, including this audit and the implementation handoff; it is not the historical 20-file delta. The complete file-by-file manifest, database schema, release sequence and rollback requirements are in [ADMIN_REFUND_MANAGEMENT_IMPLEMENTATION.md](ADMIN_REFUND_MANAGEMENT_IMPLEMENTATION.md).

### Changes and safety disposition

Admin Settings now includes Payment & Refund Settings, an audited OFF-by-default switch and explicit ON confirmation. `server/orders/refundPolicy.ts` remains unchanged, with `LIVE_REFUND_EXECUTION_ENABLED=false`. The admin setting cannot bypass it. Both the cancellation service and actual provider adapter require both gates. Settings ON and Refund execution are visibly locked pending security approval; authorized OFF remains possible for a pre-existing saved ON setting. Existing account/admin components, gateway, credentials and database are reused.

`server/orders/refundSettings.ts` validates stored boolean/revision/actor/canonical non-future timestamp metadata, performs expected-revision transactional updates and writes private history. `api/admin/refund-settings.ts` reuses revocation-checked admin auth, no-store responses, strict schemas and 30/minute per-UID request limits. `api/orders/cancellation.ts` adds authenticated `reviewRefund` and `executeRefund`; customer roles, unconfirmed requests and extra client-selected financial fields are rejected.

`server/orders/cancellation.ts` separates cancellation approval from execution: approval always holds the captured refundable amount without submitting funds. `prepareRefundReview` obtains trusted provider payment/history, enforces the original 24-hour approval limit and creates a five-minute review bound to admin, order, payment, amount, key, original approval and settings revision. `confirmReviewedRefund` rechecks evidence and these bindings transactionally, consumes the review, records an individual execution authorization and schedules an existing payment attempt for prompt recovery. The actual initiation retains its immutable key/body, 60-second lease, provider validation, durable lifecycle auditing and exactly-once ledger restoration. A remaining amount below Razorpay's documented INR 1 minimum is held for manual review, without rounding or a transport attempt. [Provider requirements](https://raw.githubusercontent.com/razorpay/markdown-docs/master/api/refunds/normal-refunds-idempotent.md).

Reconciliation initiates/retries only attempts with a coherent individual authorization and the currently enabled settings revision. Unmarked historical approvals cannot start when the switch is enabled. An OFF/ON cycle cannot revive an old permit. Existing provider refunds continue to synchronize while OFF. Review, confirmation, retries and setting changes leave audit evidence. The old retry endpoint cannot authorize a first refund or reset an approval timestamp after late capture. Expired, malformed or otherwise uncertain approvals remain manual review; receipt/key discovery can still recover a submitted refund without another financial request.

The frontend confirms trusted order/payment/amount, blocks repeated local clicks, rejects account switching and wrong-order responses, and reports processing/processed/failed/manual/unknown distinctly. Concurrent order panels share only their in-flight UID-scoped settings read. No financial permission/credential is persisted in local storage. New dialogs include keyboard focus/cancel behavior and responsive styles. Mock-hook tests establish control behavior, not actual browser viewport/accessibility verification.

### Final local results

| Check | Result |
| --- | --- |
| Complete payment, environment, cancellation/refund, client/presentation, webhook, payment-security, Cloudinary, shopping, catalog, inventory, order and new refund-management tests | **227/227**, 0 failed/cancelled/skipped, exit 0 |
| New `npm.cmd run test:refund-management` subset | **24/24**; included in the total above |
| `npm.cmd run test:payment-emulator` | **90 authorization checks** plus all three functional runner suites; exit 0 |
| `npm.cmd run lint` | Pass, exit 0 |
| `npm.cmd run build` | Local Production-mode build pass, exit 0 |
| `git diff --check` | Pass; only existing LF/CRLF conversion notices |
| Manifest/index/HEAD | 30 exact files against 3c48bff; no staged changes or new commit |

Evidence: ignored `node_modules/.cache/refund-management-final.log`, `refund-management-new.log`, `refund-management-emulator.log`, `refund-management-types.log`, `refund-management-build.log`. Emulator denial diagnostics and its absent optional VSCode notification endpoint did not fail the suite. Local Firebase-disabled and bundle-size build warnings remain. Production/Preview validator build tests use synthetic configurations and create only local bundles; no hosted Preview infrastructure was created.

### Tests proving the safeguards

- `scripts/refund-management.test.ts`: default OFF and code lock; confirmation/revision/history; malformed persisted settings; old approvals remain held after ON; review binding and explicit confirmation; simultaneous admins/recovery produce one refund; five-minute review expiry; OFF/ON invalidation; original 24-hour expiry; changed amount/capture/external pending refund; lost process before transport with durable scheduled authorization; OFF status synchronization; sub-minimum balances require manual review.
- `scripts/refund-management-api.test.mjs`: actual endpoint/shared authentication calls `verifyIdToken(..., true)`; expired/revoked/customer access rejected; real schemas, forced code lock, private history response and transactional request limits.
- `scripts/refund-management-ui.test.mjs`: settings and per-order execution locked; enable dialog requires confirmation; reviewing/cancelling does not execute; trusted dialog amount/payment/order; single-flight duplicate clicks; truthful pending/processed/failed/manual/unknown responses.
- `scripts/refund-management-client.test.mjs`: only concurrent settings reads are shared; later refresh fetches again; UID changes before token/after response and wrong-order responses rejected.
- `scripts/cart-cancellation-refund-emulator.test.ts`: real Firestore revision races, legacy hold, individually confirmed admins racing scheduled-recovery logic, one mock provider refund, inventory restored once and status synchronization after OFF. All provider responses are synthetic.
- `scripts/payment-rules.test.mjs`: existing 60 owner/financial-write checks plus 30 new settings/history/review seed/read/write/delete checks; browser customers and admins cannot read or change private controls.
- Existing lifecycle/security/payment/client/webhook suites were retained, adapted only where explicit confirmation or truthful held-state copy changed, and rerun. Existing malformed-timestamp initiation regression seeds a trusted authorization so it still exercises the initiation transaction rather than merely failing an earlier gate. Signed refund events and durable observer recovery remain covered by the existing webhook suite.

### Remaining risks and release requirements

**E1 remains HIGH / OPEN / Production release blocker.** The exposed cron bearer token has not been rotated, reconfigured or tested here. Follow the separately approved coordinated procedure above, preserving the official webhook/customer access and protecting old deployments. No incident closure is inferred from local implementation tests.

The inherited Firebase/gRPC HIGH advisory and its exact pinned range/residual impact remain documented above. **The owner's temporary acceptance applies only while LIVE refunds remain disabled.** Neither lockfile, SDK version, override nor hosted installer was changed in this task; registry/audit results above are retained dated evidence, not a newly refreshed advisory audit. Existing observed npm/package-lock.json build behavior must remain the release path; no Bun or Production configuration change was made. Reassess the advisory before any future LIVE-refund security approval.

New private collections and optional authorization fields are backwards readable; old orders are not migrated. Prior deployed rules implicitly deny the new collections, but the new explicit restrictive rules must be published/reverified as coordinated approved release work. Admin SDK settings/execution APIs must ship with the matching UI and service/provider policy. Releasing only the UI or reverting to an older backend can remove the individual-confirmation guarantees. Leave the emergency code gate false throughout this release. A future code-gate release must occur separately with the persisted admin setting OFF; ON still never initiates a batch.

Prior owner LIVE webhook/cron evidence and recovered October 10 delivery assessment remain valid historical evidence; no new Dashboard/runtime verification occurred here. Signature scheme, webhook URL/events and credentials are unchanged. After an approved release inspect ordinary signed delivery outcomes and automatic scheduled reconciliation, without replay, manual triggers or new transactions. Hosted Node 24 behavior is not established by local Node 22 tests. The actual INR 1 order, hosted refund execution/settlement and browser/mobile rendering remain unverified. Expired old approvals must not be renewed to force a refund.

OFF blocks new backend authorization/recovery sends and is rechecked at claim/pre-transport/provider boundaries. It cannot retract an already submitted request; a concurrent toggle after the last settings read cannot atomically cancel an external request. Preserve status synchronization and treat in-flight/unknown outcomes as reconciliation work, never a new refund identity. This operational boundary remains even after future enablement.

**Final disposition: GO for the local implementation with both refund gates OFF; NO-GO for Production release pending E1 closure and separately approved coordinated deployment; NO-GO for LIVE refund enablement.** No staging, commit, push, deployment, Production records/credentials/configuration changes, LIVE transactions or credential rotation were performed.

## Final admin-only manual LIVE refund workflow — current release evidence

2026-10-13. Current local HEAD is `e4c0e7828feaf13f055adcf8dc5313329ef79f32`; the implementation change is uncommitted. The existing UI/backend was retained rather than rebuilt. The complete **16-file current manifest**, schema compatibility and approval/release/rollback procedure are in [ADMIN_REFUND_MANAGEMENT_IMPLEMENTATION.md](ADMIN_REFUND_MANAGEMENT_IMPLEMENTATION.md).

### Manual initiation invariant

`server/orders/cancellation.ts` now has one private initiation function, called only after `confirmReviewedRefund` consumes a fresh five-minute review inside the authenticated admin action. Its entry and transaction bind the currently confirming admin/review to the stored authorization. Previously consumed reviews return status observation, not a send. The legacy `retryRefund` route remains admin-authenticated but always rejects financial execution with REFUND_CONFIRMATION_REQUIRED; a new review and explicit confirmation are required instead.

`recoverRefund` cannot call the initiation function. This holds for AWAITING_ENABLEMENT, APPROVED, INITIATING, UNKNOWN, old confirmations and enabled settings, including expired leases. It can synchronize provider outcomes or mark malformed/expired approvals for manual review only. `api/payments/reconcile.ts` no longer imports the execution gate and explicitly constructs an execution-disabled status observer. Webhooks retain existing signed status synchronization/durable observer processing and cannot initiate a refund. Cancellation requests/approval and settings ON/OFF also do not initiate funds.

A lost process before transport or UNKNOWN provider response no longer triggers financial retries in scheduled recovery. Observation first attempts to discover an existing refund through the immutable provider receipt/key. If no reference is found and original eligibility/24-hour expiry remain valid, only a fresh explicit admin confirmation may retry with the SAME key, amount, payment and body. Never create a new refund identity, renew timestamps or bypass manual-review/failed/existing-refund states. Already submitted refunds remain tracked, including while OFF. Pending payment confirmation, trusted Cart cleanup and stock workflows are unchanged.

### Prepared gate and authorization

`server/orders/refundPolicy.ts` prepares `LIVE_REFUND_EXECUTION_ENABLED=true` locally for the requested admin-controlled release. No Production activation or deployment occurred. Missing `refundSettings/control` still means OFF. Both server gates are enforced by the service and actual provider adapter. The same code gate can be set false in a separately approved emergency rebuild/deployment; normal admin OFF prevents subsequent initiation without routine source edits. Neither stop recalls an in-flight/submitted external request.

Both admin endpoints retain `verifyIdToken(token, true)`, exact admin claims, strict input schemas, transactional request limits, private Firestore state and audit history. Customer/direct unauthorized requests cannot set the toggle, create reviews or execute/retry refunds. No new variable, credentials, integration or database is introduced. Before deploying the prepared true gate, verify the actual existing admin setting absent/OFF through approved read-only access; if ON, obtain specific approval to disable it. This task did not inspect or modify its hosted value.

### Final test results

| Check | Result |
| --- | --- |
| Complete payment/environment/cancellation/refund/client/presentation/webhook/security/Cloudinary/shopping/catalog/inventory/order/provider suites | **232/232**, 0 failed/cancelled/skipped; exit 0 |
| Existing refund-management command with new adapter tests | **29/29**, included in total |
| Existing Firestore emulator runner | **90 authorization checks** plus all functional suites; exit 0 |
| TypeScript | Pass |
| Local Production-mode build | Pass |
| Diff/index/manifest review | Exactly 16 files, no missing/extra files, empty staging area |

`scripts/refund-management-api.test.mjs` tests real settings ON/OFF and admin execution handlers with synthetic Firebase SDK/provider boundaries, including revocation checking, roles, schemas, limits and consumed-review replay. It also executes the actual cron handler and signed webhook handler with a confirmed UNKNOWN attempt and settings ON: **zero refund initiations**, then discovers/records an externally represented processed refund and replays its event without financial or stock duplication.

`scripts/refund-management.test.ts` checks status-only observation across legacy/confirmed states and expired leases with both gates ON, rejection of old retry permits, no automatic resume after process loss, consumed review no-resend, and a new explicit manual confirmation using the original key. Existing expiry, balance/capture/history, sub-minimum amount, settings revisions and simultaneous-admin guards remain covered. `scripts/cart-cancellation-refund.test.ts` now requires explicit confirmation for unknown/interrupted manual retries. The initiation-time M5 regression still corrupts metadata after the final provider quote and proves transaction-level manual review.

`scripts/cart-cancellation-refund-emulator.test.ts` proves a confirmed UNKNOWN record produces no financial initiation during concurrent status observation with both gates ON, followed by simultaneous manual confirmations racing the status observer producing one mock provider refund and one inventory restoration. Existing 90 rules checks are retained. UI tests cover the existing functional toggle, confirmation dialogs, exact trusted amount/order, double clicks and truthful status messages; source labels now say Refund Now and explain no automatic retries.

`scripts/manual-refund-provider.test.mjs` bundles the actual provider adapter with in-memory database and intercepted fetch only. It proves absent/OFF settings deny transport, ON retains exact amount/speed/receipt and X-Refund-Idempotency, subsequent OFF denies transport, and an emergency-false adapter rejects BEFORE even reading settings. No request reaches Razorpay. Existing signed-wire-byte, refund observer, payment verification, Cart, inventory and authorization regressions all pass.

Logs/evidence: ignored `node_modules/.cache/manual-refund-full.log`, `manual-refund-new.log`, `manual-refund-emulator.log`, `manual-refund-types.log`, `manual-refund-build.log`, `manual-refund-audit.json`. Optional emulator notification/expected denial diagnostics are not failures. Local Firebase-disabled and large-bundle warnings remain. These are local synthetic/emulator checks, not hosted financial/visual/runtime verification.

### Dependency and Production disposition

Read-only `npm ls` confirms Firebase 12.18.0 → Firestore 4.17.1 → grpc-js 1.9.16; the firebase-admin 14.3.0 → google-cloud/firestore 8.7.1 → google-gax 5.0.8 chain uses grpc-js 1.14.6. A registry audit refresh still reports **0 critical / 4 high / 9 moderate** affected-package entries. Exact inherited HIGH certificate/getAuthContext advisory: [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j), affected <1.13.6; the same old package has a LOW server-error disclosure advisory [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4), affected <1.13.6. No app gRPC server/getAuthContext authorization is used, which limits demonstrated reachability without proving all transitive safety. No dependency/lockfile/override/downgrade was changed or newly upgraded in this scoped workflow task.

The earlier owner's acceptance was explicitly limited to disabled refunds. **D2 therefore needs a new owner risk decision or a supported tested upstream fix before this LIVE activation can be approved.** Do not silently extend acceptance because initiation is now manual-only. The registry fetch initially failed in the sandbox and succeeded after authorized read-only retry; no dependency installation occurred.

**E1 remains HIGH / OPEN / RELEASE BLOCKER:** the compromised cron token incident is not resolved by removing financial initiation from the scheduler. Its token still authorizes privileged payment/Cart/inventory maintenance. Rotation, safe old-deployment access and normal scheduled execution evidence remain separately approved work; no rotation took place here.

Firestore rules/schema are unchanged relative to this admin-management baseline; the reviewed restrictive rules must nevertheless be deployed/reverified alongside the full matching application if not already hosted. Existing historical rules parity did not cover a newly observed current release. Preserve the existing npm/package-lock.json build path and publish the complete matching backend/UI, not selected files. The actual INR 1 order, browser/mobile behavior, hosted Node 24 execution and LIVE refund/settlement remain unverified. Inspect ordinary existing webhook/scheduled outcomes after approval without replay/manual triggering or generating a new transaction.

**Current disposition: GO for the local manual-only implementation review; NO-GO for Production deployment/LIVE activation until E1 closure, the D2 LIVE risk decision, hosted release verification and explicit user approval.** Keep the admin setting OFF during any approved application deployment; activating ON and executing an actual refund are separate scopes. Rollback/emergency release must use current safe credentials and code gate false; do not restore old automatic-initiation code with gate true or a compromised-secret deployment. No staging, commit, push, deployment, Production record/configuration/credential change or LIVE financial operation was performed.

## Provider references

The immutable key/body matches [Razorpay normal-refund idempotency documentation](https://raw.githubusercontent.com/razorpay/markdown-docs/master/api/refunds/normal-refunds-idempotent.md). Lifecycle validation matches [Razorpay refund events](https://raw.githubusercontent.com/razorpay/markdown-docs/master/webhooks/refunds.md); signature/duplicate handling follows [webhook validation](https://razorpay.com/docs/webhooks/validate-test/). Documentation and synthetic tests are not proof of LIVE financial execution.
