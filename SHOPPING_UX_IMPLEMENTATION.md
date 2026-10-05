# AB Collections shopping and loading UX handoff

Implemented locally on 2026-10-05. No deployment, commit, push, production data changes, credentials or payments.

## 1. Bag root cause

The inspected checkout already blocked guest writes. The remaining data-flow defects were one-time private hydration and whole-array saves computed from a render snapshot. Two different additions or a quantity change plus removal could overwrite each other. Guest action recovery retained an old guest closure. The header displayed a presence dot rather than an item count. Cart and wishlist pages also rendered empty content during private hydration.

## 2. Wishlist/count root cause

Per-product pending guards prevented some duplicate clicks, but different hearts still wrote competing full arrays. No ongoing wishlist listener refreshed changes from another session. The resumed guest handler could re-enter the guest guard. Read failures were converted into an apparently successful empty customer snapshot. Header dots did not express unique saved-product count.

## 3. Bag behavior

Guests have an empty canonical UI bag and cannot persist or mutate it. Add/Buy Now requiring actual cart mutation open login; the existing in-memory intended action resumes after authenticated private hydration. Cards requiring option selection open login before allowing cart use. Signed-in add, quantity, remove and clear operate on the latest Firestore document in a transaction. Existing identical lines are not added twice. Buy Now can proceed with an existing matching line without duplicating it. Transactional add/quantity checks still use the current public catalog; server checkout remains the authority for price and inventory.

## 4. Wishlist behavior

Guests have no selected hearts or saved count. Signed-in hearts transact against `wishlists/{uid}`, normalize unique IDs and toggle the current stored membership. A pending guard ignores simultaneous repeat clicks on the same product; different products can change concurrently without replacing each other's data. Selected state has `aria-pressed` on product cards, featured cards, product details and quick view.

## 5. Authentication transitions

The provider masks shopping state unless the resolved session owns it. Ownership changes reset private state before hydration, invalidate stale reads, remove previous shopping listeners and ignore old callbacks/completions. Sign-out clears UI state before awaiting Firebase sign-out; if sign-out fails, the prior session is rehydrated. Queued shopping actions invoke current handlers rather than old closures. A rejected guest action closes overlays so login can be used. No guest browser cart/wishlist was introduced.

## 6. Firestore synchronization

One cart listener and one wishlist listener exist for the active UID; both unsubscribe on ownership changes. Their normalized, confirmed snapshots are the shopping UI source. No optimistic array is published before a successful write, so rejected transactions cannot leave false counts or hearts. Pending local snapshots are ignored. Shopping/profile hydration failures produce an error and refresh/retry action instead of an endless private skeleton. Duplicate one-time cart/wishlist reads were removed from profile/order hydration. Existing public catalog and auth listeners are reused.

## 7. Header counts

Bag: sum of normalized cart quantities. Wishlist: unique canonical saved IDs. The desktop and mobile headers show numeric badges only above zero, with accessible count labels. Bag drawer title also uses total quantity. Wishlist page's saved count uses canonical saved IDs; unavailable catalog products are not fabricated into cards.

## 8. Checkout scroll root cause

`navigate` and `AppContent` each invoked smooth scrolling before/around route rendering. Changing checkout step did not change the route, so neither reacted. A previous scroll position could survive into the next step.

## 9. Scroll fix

`useNavigationScroll` is the shared committed-navigation hook. App keys include view, selected product and selected order; checkout uses its step key and a checkout-top anchor. It schedules immediate `behavior: 'auto'` positioning after rendering and overlay cleanup, cancels obsolete scheduled positions, and subtracts the actual sticky header height for anchored content. Both competing smooth-scroll calls were removed. Forward/back steps, confirmation and order/recovery route entry use the same behavior.

## 10. Skeleton components

`Skeleton`, `ProductCardSkeleton`, `ProductGridSkeleton`, `HomeSkeleton`, `DetailsSkeleton` and `PrivateLoading` are in one reusable module. Home waits for actual catalog/CMS hydration; listing and product detail use catalog status. Account, cart, wishlist, drawers and checkout use private readiness. Neutral boutique tones, actual product image aspect ratios, responsive grids and restrained `motion-safe:animate-pulse` are used. Decorative blocks are hidden from accessibility; loading regions have descriptive status/busy semantics. Loaded-empty catalogs show an explicit empty message. Strict public CMS loading surfaces failures; absent optional CMS documents still retain the existing supported defaults.

## 11. Image loading

The existing shared ProductImage adds a neutral image-area loading background and restrained pulse. Load events or an already-complete cached image remove loading styling. Successfully loaded sources are remembered within that mounted image component; switching back does not repeat animation. Failed/missing media uses the existing friendly neutral fallback. Native lazy loading is the default, existing explicit priorities are respected, decoding is asynchronous, and hero picture sources remain intact. No unrelated fallback product images or new product content were added.

## 12. Files created

- `src/hooks/useNavigationScroll.ts`
- `src/components/common/Skeleton.tsx`
- `scripts/shopping-ux.test.mjs`
- `scripts/shopping-emulator.test.mjs`
- `SHOPPING_UX_IMPLEMENTATION.md`

## 13. Files modified

- `src/context/StoreContext.tsx`
- `src/services/commerceRepository.ts`, `src/services/cmsRepository.ts`
- `src/App.tsx`, `src/components/layout/Header.tsx`
- `src/components/cart/CartPage.tsx`, `CartDrawer.tsx`
- `src/components/common/WishlistPage.tsx`, `WishlistDrawer.tsx`, `ProductCard.tsx`, `ProductImage.tsx`, `QuickViewModal.tsx`
- `src/components/home/StorefrontHomePage.tsx`, `FeaturedGrid.tsx`, `HeroBanner.tsx`
- `src/components/product/ProductDetailPage.tsx`
- `src/components/shop/ProductListingPage.tsx`
- `src/components/checkout/CheckoutPage.tsx`
- `package.json`, `scripts/admin-driven-catalog.test.mjs`, `scripts/payment-emulator-runner.mjs`

The stale cart-page COD CTA was corrected to secure checkout. No dependencies or asset changes were required.

## 14. Tests added/updated

The new shopping suite executes the actual StoreProvider, commerceRepository, navigation hook and image component with deterministic hook/auth/Firestore boundaries, plus server-rendered home/header output. Fourteen grouped tests cover guest actions/counts, login recovery, quantity/remove/clear, concurrent different products, duplicate hearts, write failures, refresh-equivalent restoration, immediate logout, direct account switch, stale callbacks/handlers, unconfirmed snapshots, header counts, desktop/mobile header geometry, step forward/back hook scheduling, image load/source/error and loading/empty/error presentation. These are automated state/geometry tests, not a substitute for a real browser render.

The shopping emulator suite executes the actual Firebase client repository against the dedicated demo Firestore emulator, including real concurrent transaction retries, normalized unique IDs, restored documents, subscription delivery and cross-account denial. The existing catalog fixture now identifies its intended authenticated cart-render context. The emulator runner includes the new shopping suite alongside existing payment suites.

## 15. Executed validation

| Check | Result |
| --- | --- |
| TypeScript (`npm.cmd run lint`) | Passed |
| Production build | Passed; existing large-bundle warning remains |
| New shopping UX tests | 14 passed |
| Catalog regression tests | 22 passed |
| Inventory regression tests | 11 passed |
| Payment foundation tests | 15 passed |
| Payment client tests | 4 passed |
| Payment Firestore authorization | 51 checks passed |
| Real payment lifecycle emulator suite | Passed |
| Real shopping client emulator suite | Passed |
| `git diff --check` | Passed |
| Diff of payment APIs/server/payment-client/rules | No changes |

Some esbuild commands required the existing sandbox escalation because directory reads were denied. The first combined emulator run passed payment checks but failed the new test bundle's virtual Firebase import resolution. After correcting the test fixture, only the shopping emulator suite was rerun and passed. Expected denied-access cases generate emulator diagnostic noise; the test exit status was successful.

## 16. Payment/security files changed and why

No payment API, server payment/fulfilment module, paymentClient, Firestore rules or indexes changed. CheckoutPage received only the shared scroll hook/anchor and private loading/error presentation. StoreContext's payment creation section is unchanged; its shared cart-clearing path now commits through the safer cart transaction. `payment-emulator-runner.mjs` only adds the shopping emulator test invocation. Existing financial guards and historical COD data paths were retained.

## 17. Payment security preservation

The existing 15-minute reservations, idempotent order identity, trusted server pricing, verification signatures, raw signed webhooks, refund synchronization, late-payment review holds and financial Firestore protections remain in the unchanged implementation. Payment and authorization regressions passed locally. This does not establish deployed behavior or authorize production use.

## 18. Remaining verification

Browser automation returned 'No browser is available' in this session. Real desktop/mobile visual inspection, physical-device scrolling, layout-shift measurements, actual-account authentication and slow-network image behavior remain unverified. No live site fix is claimed. Review those flows in staging before deployment. The uploaded screenshots identify symptoms and visual references; they do not establish whether the deployed catalog was loading, empty or failing. Existing payment credentials, scheduler and deployed test-mode readiness requirements remain in `PAYMENT_IMPLEMENTATION.md`.
