# Festival Sale Campaign System - implementation and deployment report

Implemented locally on 16 October 2026 in `C:\Users\pavan\Downloads\ab-collection` on `main`, remote `boutiquemiyapur/boutique`. The worktree was clean at the start. The existing product-discount fix was already present and was audited before integration. No Production records, credentials, checkout configuration or financial transactions were changed. Nothing was staged, committed, pushed or deployed.

## Implementation

Admin now includes **Marketing / Sale Campaigns**. Campaigns support creation, editing, private preview, publication, pausing, manual ending and archiving. The editor supports a searchable name/SKU product selector, category filter, selected-only view, images, regular prices, stock, per-product fixed prices, multi-selection and removal. It reuses existing Cloudinary uploads; desktop and mobile uploads use separate record suffixes to avoid image collisions. Published campaigns must be paused before editing. Partial assignment saves retain completed progress and revisions; conflicting or ambiguous saves require reloading rather than overwriting another admin's work.

Storefront discovery includes **Festive Offers**, `/sale`, `/sale/:slug`, and campaign slides in the existing HeroBanner carousel. Banner images and CTA buttons route to the campaign collection. Pages include responsive banners, title, description, end time in IST, name/SKU search, category and in-stock filters, sorting, progressive product display, existing ProductCard actions, variant-aware detail links and wishlist controls. Unavailable/ended, loading, empty and error states are implemented. Draft previews stay inside the authenticated admin editor and simulate the campaign alone; they are not public preview URLs.

Dussehra and Diwali are supported by the same reusable model as every future campaign. No festival names, dates, prices or assets were seeded into Production. The examples in the request do not authorize inventing real campaign offers.

## Firestore schema and indexes

- `saleCampaigns/{id}`: name, unique slug, description, desktop/mobile image URLs, CTA, epoch-millisecond `startsAt`/`endsAt`, status, pricing mode, percentage, bounded category-name selections, display order, homepage/featured toggles, assignment count, revision, server update time and admin identity.
- `saleCampaigns/{id}/products/{productId}`: canonical individual assignment, with an optional fixed selling price. Product IDs remain unchanged. Product records, variants and inventory are never duplicated.
- `saleProductAssignments/{productId}`: reverse eligibility map, synchronized transactionally with canonical assignments. Bounded to 100 campaign memberships per product to prevent oversized records; obsolete assignments can be removed through paused/draft campaigns.
- `saleCampaignSlugs/{slug}`: private transactional uniqueness reservation.
- `saleCampaignControl/published`: private publication index containing at most 20 campaign IDs. The bound includes scheduled and expired-but-still-published records; pause/end/archive older campaigns to free slots.

Campaign listing uses 20-row pages; assignment listing uses 100-row pages; assignment writes use batches of at most 50 changes; public price requests accept at most 100 product IDs. Category selections are capped at 30. Existing admin catalog loading is reused; selection search is local to that loaded catalog, and an editor loads assignment pages into memory. No new composite indexes are required: lookups use document IDs and listing uses the built-in document-name ordering. `firestore.indexes.json` is unchanged.

## Security and scheduling

`api/admin/sale-campaigns.ts` uses the existing revoked-token verification and trusted admin custom claim for every action, with request validation, rate limits and optimistic revisions. Direct campaign writes are denied by Firestore rules even to browser admins, so publication, slug reservations and both assignment indexes cannot be bypassed through the client SDK. Admins can read protected campaign metadata. Anonymous/customer reads of campaign and assignment records require published status and the current Firestore request-time window. Slug, publication and reverse indexes remain private. Public API responses explicitly omit admin audit identities and all draft content.

Images must use credential-free HTTPS URLs of up to 2,048 characters. Names, descriptions, slugs, types, dates, percentages and money are validated server-side. Public price requests accept product IDs only; forged prices, discount values and campaign IDs are rejected.

Storage status is `draft`, `published`, `paused`, `ended` or `archived`. Published campaigns derive **Scheduled**, **Active** or **Ended** from their timestamps. Eligibility is start-inclusive and end-exclusive, using server time at checkout. No scheduler or paid cron is required. Admin date inputs explicitly use Asia/Kolkata and store canonical epoch timestamps.

The client refreshes eligibility every 30 seconds and at known expiry boundaries, and refreshes again when a tab returns to the foreground. Server price results are reused only while campaign IDs/revisions and the underlying catalog source remain unchanged, avoiding repeated full pricing reads on every poll. New starts/pauses become visible within the polling interval; checkout always reads current campaign records transactionally. Expired or failed price hydration blocks new storefront checkout and shows a loading/error state. Existing order recovery remains available through its established flow.

## Pricing and payment safety

The regular `priceINR` remains authoritative in the product catalog. Campaign prices live in separate records and are transient when attached to storefront products. `productForStorage` rejects effective campaign products so an order/cart snapshot cannot accidentally overwrite the catalog price.

Collection-only preserves existing selling prices. Percentage mode discounts the regular selling price once, rounding to integer paise. Fixed mode uses the individual assignment's validated positive price and cannot exceed the regular selling price. Stale fixed offers above a newly lowered regular price are ignored rather than increasing prices. Overlaps do not stack: **lowest effective price wins, then lower display order, then stable campaign ID**. Collection membership remains independent of the winning offer, so a product may appear in multiple campaign collections while consistently showing the same best price.

The existing shared pricing utility derives percentage and savings against valid MRP. When MRP is absent, a discounted campaign product uses its regular price as the clearly labelled comparison price. The example INR 2,000 MRP / INR 1,800 regular / 20% festival discount produces INR 1,440, 28% off MRP and INR 560 saved. Coupons and delivery/charge policies retain their existing behavior; there is no second subtraction of the product discount. Existing coupons may still apply to the effective merchandise subtotal under the established coupon policy.

Trusted checkout reads authoritative products, publication index, campaign records and reverse memberships inside the existing transaction, then validates variants, quantities and stock. Effective prices are used only for order-item snapshots and server totals. The separate regular-product set remains the source for inventory writes. Tests verify that reservation, release and cancellation do not persist temporary sale prices to catalog records. Razorpay receives the resulting server-calculated paise amount. Existing credentials, saved configuration, payment verification, signed webhooks, reconciliation, idempotency, reservation and refund controls are preserved.

Price differences between the displayed cart and prepared order use the existing explicit total-review prompt before Razorpay opens. A valid existing reservation retains its original quote for the existing approximately 15-minute reservation window, including if a campaign is paused or ends during that window. This deliberately preserves payment identity and the original verified order snapshot. Fresh checkouts use current eligibility; expired quote renewal recalculates prices and rejects `RETRY_PRICE_CHANGED` before creating another provider order if totals changed. It does not automatically replace uncertain attempts; the existing store-review/recovery process remains applicable. Product galleries, valid variant choices, quantity and tailoring selections no longer reset merely because prices refresh.

Historical order totals, campaign snapshots, paid amounts and refund quotes remain based on the purchased/verified snapshot, independent of later catalog or campaign changes.

## Validation results

- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed. Existing bundle-size warning remains; the normal local build disables Firebase without a safe non-production configuration. This does not establish deployed environment correctness.
- Campaign/API/catalog/shopping/gallery fixtures: **79 tests passed**, including malformed input, admin authorization, draft privacy, routing, overlaps, category eligibility, MRP/selling-price math, stock/variants, price manipulation, expiry, history/refund preservation and selection identity.
- Backend pricing/payment/security/cancellation/refund run: **105 tests passed** before the additional selection-identity case; that additional case passed in the final fixture run.
- Existing UI/payment/webhook/cancellation/refund run: **116 tests passed**; the added dynamic sale-route case subsequently passed in the final fixture run.
- Existing payment foundation and environment-isolation suite: **37 tests passed**, including synthetic build checks.
- Full local Firestore emulator runner passed, including **151 authorization checks**, campaign create/edit/publish/pause/archive, unique slugs, revision conflicts, fixed-price validation, 101 product assignments with cursor pagination, more than 20 campaign records with cursor pagination, authoritative Razorpay amounts and historical refund snapshots. Provider calls were mocked.
- Real Chrome at **1280px desktop and 390px mobile** passed banner-image routing, Dussehra/Diwali pages, best-offer pricing, wishlist actions, search/in-stock filters, variant selection, gallery preservation after a price change, updated cart totals, loading/error/unavailable states, admin preview/save/publish, and horizontal-overflow checks. The actual catalog hook was tested with local API hydration, timed expiry and failure. Mobile screenshots were visually reviewed. Artifacts: `node_modules/.cache/campaign-browser/`.
- `git diff --check`: passed. Some tests/builds required execution outside the filesystem sandbox because esbuild and Firebase CLI access were blocked. No LIVE payment or hosted write was used to validate this feature.

Convenience commands: `npm.cmd run test:sale-campaigns`, `npm.cmd run test:sale-campaigns-browser`, and the extended `npm.cmd run test:payment-emulator` (local demo project only).

## Deployment, manual setup and remaining limits

1. Review the local diff and obtain approval before staging, committing, pushing or deployment.
2. Deploy the updated Firestore rules to the existing Firebase project after approval. No index deployment, data migration, new infrastructure or environment variable is required. Preserve all existing product/order/payment records.
3. Deploy frontend and server APIs together through the existing Vercel project and existing validated Production settings. Keep the current Firebase project, LIVE Razorpay credentials and saved checkout configuration.
4. In the real admin, create **Dussehra Festive Sale** and **Diwali Special Sale** with owner-approved names/slugs, banner assets, products/categories, pricing and IST dates. Suggested URLs from the request are `/sale/dussehra-2026` and `/sale/diwali-2026`; they become real only after their campaigns are configured and published. Recommended image ratios follow the existing hero and campaign layout: wide desktop and portrait mobile. Mobile image is optional and falls back to desktop.
5. Save, inspect the private preview, then publish. Campaign banner slides are generated automatically; do not create duplicate manual banners for the same campaign. Check the published routes, cards, variants and cart after deployment without initiating a LIVE financial transaction unless separately authorized.

There is no automatic Production migration and no pre-created Production campaign. Initial publication creates the new records lazily. Rules and API deployment must accompany the frontend; otherwise campaign pricing hydration can fail closed. Production Cloudinary uploads and hosted Vercel/Firebase behavior remain unverified locally. Public discovery can lag a newly started/paused campaign by up to 30 seconds; payment calculations do not use that client cache. Valid existing quotes retain the established reservation policy described above. Large campaign editors still depend on the existing full admin product snapshot and load assignment pages into browser memory; service-side records and payloads stay bounded. Expired publications need periodic manual archiving to free the 20 publication slots. The SPA supplies client-side campaign titles/canonical/social metadata; no new SSR or campaign analytics service was introduced.

## Exact files created or modified

- `SALE_CAMPAIGNS_IMPLEMENTATION.md`
- `api/admin/sale-campaigns.ts`
- `api/sales.ts`
- `firestore.rules`
- `package.json`
- `scripts/payment-emulator-runner.mjs`
- `scripts/payment-rules.test.mjs`
- `scripts/sale-campaigns-api.test.mjs`
- `scripts/sale-campaigns-browser.test.mjs`
- `scripts/sale-campaigns-emulator.test.ts`
- `scripts/sale-campaigns.test.ts`
- `scripts/shopping-ux.test.mjs`
- `server/payments/checkout.ts`
- `server/sales/campaigns.ts`
- `src/App.tsx`
- `src/components/admin/AdminPortalPage.tsx`
- `src/components/admin/SaleCampaignManager.tsx`
- `src/components/cart/CartDrawer.tsx`
- `src/components/cart/CartPage.tsx`
- `src/components/common/ProductCard.tsx`
- `src/components/common/QuickViewModal.tsx`
- `src/components/common/SeoManager.tsx`
- `src/components/home/FeaturedGrid.tsx`
- `src/components/home/HeroBanner.tsx`
- `src/components/layout/Header.tsx`
- `src/components/product/ProductDetailPage.tsx`
- `src/components/sales/SaleCampaignPage.tsx`
- `src/components/sales/SaleOfferBadge.tsx`
- `src/context/StoreContext.tsx`
- `src/hooks/useCampaignCatalog.ts`
- `src/services/saleCampaignClient.ts`
- `src/types/index.ts`
- `src/utils/productData.ts`
- `src/utils/productPricing.ts`
- `src/utils/saleCampaigns.ts`
