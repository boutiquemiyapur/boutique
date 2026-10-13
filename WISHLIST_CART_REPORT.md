# AB Collections Cart and Wishlist stabilization report

Release review and local validation: 2026-10-13. This report supersedes the earlier report that included server payment-success Cart cleanup. The owner authorized a local commit on 2026-10-13. This report is prepared before that commit; its SHA is reported separately. No push, deployment, Production data write, credential/configuration change or LIVE transaction is authorized or performed.

## Release decision

GO for the scoped Cart/Wishlist changes based on local automated validation, with the retained-Cart limitation explicitly accepted by the owner. Local commit is authorized; push and deployment remain subject to separate approval. NO-GO for claiming automatic purchased-only payment-success cleanup or fully verified hosted payments. That backend dependency is deliberately deferred for separate approval in PAYMENT_CART_CLEANUP_PROPOSAL.md.

Current result: successful payments retain the Cart, as do failed/cancelled/pending payments. This prevents unrelated-item deletion and repeated clearing by existing confirmed orders. Automatic purchased-quantity removal is not implemented. Stable checkout intents remain so unchanged details reuse their existing order. Purchased items may remain in the Cart after payment. Customers can manually remove them and should check My Orders before paying again. A shared notice on the Cart page, drawer and checkout states that saved selections do not indicate payment status; Cart totals describe selections, not outstanding paid-order balances. No Cart line is assigned an unpaid status or removed using frontend status.

## Root causes and completed fixes

- Wishlist previously counted raw saved IDs while displaying only catalog-resolved products. One provider-derived wishlistProducts list now determines the header, drawer, page, account tab and selected hearts. Loading/error states do not display a false empty result. Missing and hidden/archived references are preserved, counted separately and explained. Active out-of-stock styles remain visible and saved.
- Shopping listeners suppressed pending writes but did not request metadata-change notifications. Acknowledgements could be missed when only metadata changed; a cache-only initial snapshot could appear empty. Metadata notifications now deliver confirmed server snapshots. Cache/pending snapshots wait for confirmation. Offline first load can remain loading until reconnection; an offline notice explains this rather than presenting an empty account.
- Absolute quantity writes based on rendered state could lose rapid increments. +/- now apply transactional deltas to persisted quantities. Exact product/color/size/tailoring identities deduplicate; different variants remain separate. Badge counts sum item quantities. Limits match the existing checkout's 25-unit per line and 30-variant limits, with aggregate stock checks. These new frontend limits are separated from shared server validation.
- Buy now could enter checkout for an existing unavailable line. It now checks the Cart issue; checkout's button and form handler also block unavailable new purchases. Existing payment recovery through order history remains available.
- Buy again ignored addToCart's boolean result and always announced success. It now counts confirmed additions, reports partial results honestly, blocks repeated batch clicks and stops after account changes/unmounting.
- Cart/Wishlist mutations retain UID/version guards and confirmed subscription state; failed writes do not invent success. Existing secure Firestore transaction architecture, collections and stored field names remain intact. Refresh/login persistence and second-client synchronization are covered locally.
- Customer-facing shopping Bag terminology and icons are now Cart. Garment/storage bag descriptions and existing internal DOM IDs are preserved. Wishlist Add to Cart no longer deletes the saved reference automatically.
- Browser success previously cleared the entire current Cart, including unrelated items. That clearing and intent deletion are removed. Correct exactly-once purchased-only cleanup needs a separately approved backend transaction change.

## Payment protection and separated changes

server/payments/service.ts and scripts/payment-emulator.test.ts match HEAD byte for byte. The prior service Cart snapshot/cleanup and lock-order additions and their proposed tests were archived under node_modules/.cache/cart-cleanup-review, then removed from the release. scripts/payment-foundation.test.ts now has only a new preservation regression added to the original tests.

No content diffs remain under api/, server/, src/firebase/, Firestore rules, firebase.json, vercel.json, vite.config.ts, package.json or package-lock.json. Payment client/state changes are customer-facing Bag-to-Cart strings only. Shared productData validation predicates remain the original implementation; its changes are message copy only. Razorpay creation/verification, provider signatures, webhook processing, reconciliation/refunds/statuses and inventory reservation/confirmation are unchanged.

Existing paid orders cannot trigger Cart cleanup; old checkout requests retain their original schema and behavior. A new fixture regression verifies capture, duplicate event replay and paid-order polling leave later Cart quantities intact. Ordinary emulator tests verify duplicate capture, expiry/retry, consumption and historical/admin fulfilment using the restored service.

The earlier standalone concurrency diagnostic produced contention/code 3 failures in baseline and candidate with persisted invariants intact. This does not establish a candidate-specific race or prove hosted concurrency safety. The diagnostic and backend implementation patch are excluded; the proposal document is retained as a deferred reference only; the final standard emulator concurrency regressions pass. No concurrency stress tests were run against Production.

## Final test results

| Check | Result |
| --- | --- |
| Shopping/Wishlist/provider/UI regressions | 30/30 passed |
| Payment foundation/environment fixtures | 36/36 passed |
| Payment client/presentation | 32/32 passed |
| Payment webhook fixtures | 3/3 passed |
| Admin-driven catalog | 22/22 passed |
| Inventory management | 11/11 passed |
| Trusted order transactions | 1/1 passed |
| Cloudinary/security fixtures | 10/10 passed |
| Total application regressions | 145/145 passed |
| Firestore authorization checks | 51 passed |
| Local payment/inventory concurrency, expiry/retry, duplicate processing, consumption and historical/admin fulfilment emulator suite | Passed, exit 0 |
| Local shopping persistence, transactional variant identity, confirmed subscriptions, second-client synchronization and cross-account denial emulator suite | Passed, exit 0 |
| TypeScript: npm.cmd run lint | Passed |
| Production-mode Vite build: npm.cmd run build | Passed; existing large-bundle warning |
| git diff --check | Passed; Git line-ending notices only |

All emulator writes target localhost 127.0.0.1:8189 and the existing demo-ab-payments emulator ID. No cloud project was created. Provider/environment tests use synthetic configuration and mock transports. The local build leaves Firebase disconnected; it proves compilation/minification, not hosted Production Firebase or LIVE Razorpay behavior. Existing environment isolation tests do not require provisioning any environment.

Evidence logs: node_modules/.cache/commit-verification-shopping.log, commit-verification-payments.log, commit-verification-client.log, commit-verification-webhook.log, commit-verification-catalog.log, commit-verification-inventory.log, commit-verification-orders.log, commit-verification-cloudinary.log, commit-verification-emulator.log, commit-verification-types.log and commit-verification-build.log.

## Exact release files and safe commit instructions

Reviewed all 28 content-changed/new release files below for accidental changes and security regressions. No new secret exposure, authorization bypass, inventory/payment predicate change, catalog fallback, collection/schema rename or unrelated redesign was found. Hosted behavior remains outside this review's evidence.

server/payments/service.ts, scripts/payment-emulator.test.ts and src/data/mockProducts.ts may appear stat-dirty in git status but have no content diff; exclude them. PREVIEW_VERIFICATION_PLAN.md is superseded and excluded. Exclude caches, logs, dist, .env files, .vercel and the archived payment proposal patch. Do not use git add . or git add -A.

The owner authorized staging and committing this exact manifest. Commands below remain reference instructions; do not repeat them after the reported commit.

```powershell
Set-Location 'C:\Users\pavan\Downloads\ab-collection'
git status --short
git branch --show-current
git remote -v
git diff --check
$releaseFiles = @(
  "scripts/admin-driven-catalog.test.mjs"
  "scripts/payment-foundation.test.ts"
  "scripts/shopping-emulator.test.mjs"
  "scripts/shopping-ux.test.mjs"
  "src/components/account/CustomerAccountPage.tsx"
  "src/components/cart/CartDrawer.tsx"
  "src/components/cart/CartPage.tsx"
  "src/components/checkout/CheckoutPage.tsx"
  "src/components/common/ProductCard.tsx"
  "src/components/common/QuickViewModal.tsx"
  "src/components/common/Skeleton.tsx"
  "src/components/common/WishlistDrawer.tsx"
  "src/components/common/WishlistPage.tsx"
  "src/components/home/FeaturedGrid.tsx"
  "src/components/home/InstagramLookbook.tsx"
  "src/components/layout/Header.tsx"
  "src/components/pages/StaticPage.tsx"
  "src/components/product/ProductDetailPage.tsx"
  "src/context/StoreContext.tsx"
  "src/services/commerceRepository.ts"
  "src/services/paymentClient.ts"
  "src/utils/paymentState.ts"
  "src/utils/productData.ts"
  "src/components/common/ShoppingConnectionNotice.tsx"
  "src/components/common/WishlistReferenceNotice.tsx"
  "src/utils/shoppingState.ts"
  "PAYMENT_CART_CLEANUP_PROPOSAL.md"
  "WISHLIST_CART_REPORT.md"
)
git add -- $releaseFiles
git diff --cached --name-only
git diff --cached --check
git diff --cached
# Confirm exactly the reviewed files; stop if any unrelated or backend changes appear.
git commit -m "Stabilize Cart and Wishlist without changing payment processing"
git show --stat --oneline HEAD
```

Only after separate push AND Production deployment approval:

```powershell
git fetch origin main
git log --oneline HEAD..origin/main
# If this shows remote commits, stop and reconcile/retest; do not force push.
git push origin main
```

Local checkout is main with origin https://github.com/boutiquemiyapur/boutique.git. The existing Vercel project is boutique in team boutique8; Production branch is main. A push to that branch can automatically deploy Production, so push approval must explicitly include deployment approval. Do not push a separate Preview branch for testing. See https://vercel.com/docs/git.

## Production deployment and rollback

1. Before approved push, open the existing Vercel project and record the currently active READY Production deployment and SHA as the rollback target. Confirm branch/main and existing Production configuration; do not change credentials, Firebase/Razorpay resources or scheduler/webhook settings.
2. Use the approved Git push above. Inspect the resulting deployment's source SHA, Production target and build logs. Ensure it is READY and assigned to the normal storefront domain. Do not run a second CLI deployment of the same commit.
3. If automatic Git deployment does not run, use the existing project's Deployments > Create Deployment with the approved main commit SHA and Production target. Do not select Preview or alter variables.
4. Watch existing Vercel function logs for build/import errors, Firebase permission/configuration failures and payment API failures. Monitoring does not establish successful payment delivery or scheduler execution.
5. If a release regression occurs, stop verification writes. In the existing Vercel Production deployment menu select Instant Rollback to the recorded prior READY deployment. If rollback is unavailable, restore that known-good SHA through the existing project's Production redeploy flow. See https://vercel.com/docs/instant-rollback.
6. After rollback, verify the active SHA/domain and existing order history. Rollback changes serving code; it does not undo Firestore writes or payments. Make no database reversal or order/inventory edits. The previous code includes the old browser whole-Cart clearing behavior, so avoid further payment tests while investigating.
7. With approval, revert only the release commit in Git and push that revert so Git reflects the rollback. Never reset shared history or force push.

The earlier read-only snapshot identified baseline SHA b2ff7cc39d47a8ffda9668cf4949292f06e3865d and deployment dpl_49xdyDaQYTcqoQKZhtU6awcvuFiw (https://boutique-9qz301h2y-boutique8.vercel.app). Treat this as an earlier snapshot and recheck the active deployment before release.

## Manual verification after deployment

Owner-authorized ordinary account Cart/Wishlist writes only; no stress runs, catalog/product edits, credentials changes or LIVE payment transaction without separate approval.

- On desktop/mobile, confirm Cart labels/icons and accessible header quantities. Save an existing active product; compare header, drawer, standalone page and account Wishlist. Refresh; confirm persistence and no false empty state during loading.
- Use existing hidden/missing/out-of-stock references where available; do not modify Production products to manufacture fixtures. Confirm hidden/missing notices and retained references, and visible out-of-stock saved styles. If unavailable, mark this hosted case unverified; local tests cover it.
- Add an existing in-stock variant once, repeat Add to Cart and confirm one line with unchanged quantity. Add a different available size/color and confirm a separate line. Increase/decrease quantities modestly and compare header/drawer/page totals. Check real stock and the 25-unit/30-line policy without creating a stress-sized Production Cart.
- Refresh, sign out, switch accounts and return. Verify the second account never displays the first account's Cart/Wishlist, and the original account's selections persist.
- In a second browser tab on the same account, make one ordinary change and confirm synchronization. Disconnect/reconnect the browser briefly: expect an offline/loading notice and no false success; confirm recovery. Do not submit checkout while offline.
- Use an already-unavailable Cart selection if one exists: the new checkout button/form must be blocked; existing order-history payment checks remain separate. Do not edit inventory or initiate a payment to reproduce this.
- Open and leave the ordinary checkout page before placing an order; confirm the Cart remains. Read existing paid/pending/failed order history and confirm no Cart removal or false success labels. Do not press retry/check-payment actions solely as a test or open another LIVE payment without explicit approval.
- Successful/cancelled/failed LIVE modal behavior, hosted capture/webhook/reconciliation timing and real cross-device/offline timing remain unverified in this task. Local fixtures/emulator coverage is evidence for code behavior only. Current successful-payment Cart retention is intentional and automatic cleanup remains deferred.

## Next owner action

The owner has chosen the scoped release with automatic cleanup deferred and authorized the local commit. Do not implement PAYMENT_CART_CLEANUP_PROPOSAL.md. Review the reported commit SHA and Git status, then give separate push/deployment approval if desired. No additional infrastructure or credentials are needed.
