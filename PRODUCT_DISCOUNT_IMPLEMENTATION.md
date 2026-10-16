# Product discount implementation — 16 October 2026

Implemented locally on `main` in `C:\Users\pavan\Downloads\ab-collection`, with remote `boutiquemiyapur/boutique`. The starting worktree was clean. Nothing was staged, committed, pushed or deployed. No Production data was written and no LIVE payment was initiated.

## Root cause and evidence

The product schema stores `data.priceINR`, `data.originalPriceINR` and `data.discountPercentage` independently. Both product repositories saved these values; ProductEditor had three unrelated setters. Featured cards, ProductCard, product details and QuickView displayed the stored percentage. Checkout already correctly used the authoritative Firestore `priceINR`, so an incorrect badge never applied an additional product discount at payment time.

An unauthenticated, read-only REST inspection of all 87 product documents in the locally configured Firebase project confirmed conflicting legacy metadata. Examples: `ab-1789367796007` has selling price INR 600, MRP INR 1,499 and stored discount 40%; the actual discount rounds to 59.97%. `ab-1792126456542` has selling price INR 1,890 and stored discount 20% without MRP. This was a data-model audit, not a verification of deployed application behavior. The exact “Payment Test Product” example was not independently established by this inspection.

## Pricing architecture and admin behavior

`src/utils/productPricing.ts` owns paise conversion, validation, selling-price calculation, derived savings/percentage, last-edited mode and decimal display formatting. `priceINR` remains authoritative. MRP remains optional. Savings and discount status are derived; no new Firestore fields or migration are required. Display percentages round to two decimals and stay below 100% for positive prices.

Editing discount calculates selling price from MRP, rounded once to paise. Editing selling price derives the percentage without changing the price. MRP edits preserve the last chosen input mode. Existing products open in selling-price mode. Clearing MRP keeps the selling price and removes the discount. The preview explains the selected behavior and shows actual savings. Invalid amounts, excess precision, zero/negative prices, discounts outside [0,100), and selling prices above MRP block saving. Monetary limits align with the existing INR 1,000,000 payment limit; MRP also uses that validation limit.

Catalog normalization derives legacy discount metadata without repricing products. Both repository save paths already use `productForStorage`; that boundary now validates pricing and derives consistent metadata before saving. An invalid legacy MRP must be corrected or cleared by an admin before saving that product. No automatic repair of existing documents was performed.

## Customer prices, payment and history

Shared pricing is used by featured cards, common cards (shop/category/search/related/wishlist), details, QuickView and cart MRP display. Details and QuickView show actual savings. Undiscounted products show the selling price alone. Currency formatting now retains up to two decimals instead of hiding paise.

Frontend checkout subtotals, tailoring and payable totals accumulate integer paise. Existing coupon and charge policies are preserved, including whole-INR rounding of coupons and configured delivery/tax charges. Product discounts are already included in `priceINR` and are never subtracted a second time.

Trusted checkout still fetches Firestore prices, validates variants/quantities/inventory, calculates totals and creates the Razorpay order server-side. Zero-price products now fail closed. If the prepared server order differs from the displayed total or line prices, the customer must confirm its updated total before Checkout opens. Declining keeps the existing order/intent for review. It does not create another attempt. Valid in-flight reservations retain their order snapshot; expired renewal still rejects changed prices with `RETRY_PRICE_CHANGED` before another provider order is created.

Order history is read from its original snapshot without current-catalog normalization. Regression tests confirm catalog discounts cannot change a prior paid amount or its approved refund quote. Credentials, saved Razorpay configuration, verification, webhook handling, idempotency, reservations, reconciliation and refund implementation were preserved. Firestore rules are unchanged; customer product writes remain denied and admin custom claims remain required. Direct trusted-admin database writes bypass form validation, as before; checkout remains authoritative.

## Exact changed files

Application:

- `src/utils/productPricing.ts` (new)
- `src/utils/productData.ts`
- `src/utils/checkoutTotals.ts`
- `src/context/StoreContext.tsx`
- `src/components/admin/ProductEditor.tsx`
- `src/components/common/ProductCard.tsx`
- `src/components/common/QuickViewModal.tsx`
- `src/components/home/FeaturedGrid.tsx`
- `src/components/product/ProductDetailPage.tsx`
- `src/components/cart/CartPage.tsx`
- `src/components/cart/CartDrawer.tsx`
- `server/payments/checkout.ts`

Tests, commands and report:

- `scripts/product-pricing.test.ts` (new)
- `scripts/product-pricing-browser.test.mjs` (new)
- `scripts/product-pricing-emulator.test.ts` (new)
- `scripts/admin-driven-catalog.test.mjs`
- `scripts/shopping-ux.test.mjs`
- `scripts/payment-rules.test.mjs` (pricing permissions and decimal REST fixture encoding)
- `scripts/payment-emulator-runner.mjs`
- `package.json`
- `PRODUCT_DISCOUNT_IMPLEMENTATION.md` (this report)

## Verification

- TypeScript: `npm.cmd run lint` passed.
- Production build: `npm.cmd run build` passed. Existing bundle-size warning remains. Local build correctly disables Firebase without a distinct safe non-production configuration; this does not validate hosted Production configuration.
- Pricing regression suite: 13 tests passed, covering 0/10/25/33.33/50/75%, legacy conflicts, input modes, MRP removal, invalid amounts, paise/display rounding, quantity/variant/delivery totals, provider amount, immutable history, refund quote and expired price changes.
- Catalog/shopping suite: 54 tests passed, including explicit accept/decline of updated server pricing while retaining the original attempt.
- Backend foundation/environment/security/cancellation/refund suites: 107 tests passed in the combined run (includes 12 pricing tests before the additional refund-snapshot case).
- Payment client/presentation/webhook/cancellation/refund API and UI suites: 62 tests passed with the TypeScript loader.
- Full `npm.cmd run test:payment-emulator` passed against localhost `demo-ab-payments`, including the new decimal/variant pricing snapshot tests and unauthorized pricing writes. Provider calls were mocked. Expected denied-request and concurrency-retry diagnostics appeared; the runner exited successfully and stopped the emulator.
- Real Chrome at desktop 1280px and mobile 390px passed card/detail discounts, savings, admin editing, mode switching, validation, decimal saves and overflow checks. Mobile screenshots were visually inspected. Fixtures block external HTTPS and mock Firebase/CMS boundaries. Screenshots are under `node_modules/.cache/pricing-browser/`.
- `git diff --check` passed. Sandbox filesystem restrictions required some test/build runs outside the sandbox; failed test harness attempts were corrected and rerun.

## Deployment requirements and limits

Review and approve these local changes before committing or deploying. Deploy the frontend and backend together using the existing Vercel project and existing Production environment settings. No Firebase rules/index migration, credentials change or infrastructure change is needed. After deployment, verify the real admin/storefront with an existing product without modifying its price inadvertently. Hosted payment behavior remains untested; no LIVE transaction should be initiated without explicit authorization.

The price-review step uses a browser confirmation dialog. Declining leaves the existing reservation subject to the current expiry/reconciliation policy. Legacy records remain untouched until an authorized normal write; existing inventory operations that already serialize normalized products may persist corrected percentage metadata while preserving selling prices. Extremely high/invalid legacy amounts need explicit admin correction; they are not silently repriced.
