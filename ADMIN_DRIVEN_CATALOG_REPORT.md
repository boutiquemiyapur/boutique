# Admin-driven catalog implementation report

> Historical first-phase report. Variant inventory, trusted atomic checkout, configurable charges and category CRUD were added afterward; see `ADMIN_INVENTORY_CHARGES_CATEGORIES_REPORT.md` for the current behavior. Statements below that say those features are absent describe the earlier implementation boundary.

Local implementation, 14 September 2026. No commit, push, deployment, security-rule change, or production data write was performed.

The catalog now follows Admin → existing `/products/{id}` Firestore documents → shared normalization → live storefront → current cart → immutable order snapshot. Local regression coverage passes. Browser interaction, mobile screenshots, and authenticated live Firestore testing remain pending because browser automation reported **No browser is available**.

## A. Root cause of Raw Silk appearing

The original `ProductEditor` in `AdminPortalPage.tsx` created every product with `fabric: 'Raw Silk'`, `occasion: 'Festive & Puja'`, `availableSizes: ['S', 'M', 'L']`, and `isReadyToShip: true`. These fields were not editable in that form. Saving an empty color list inserted a `Default` color with a gray swatch and the product images.

The product page displayed the saved fabric and separately supplied `Pure Tested Metallic Zari` and `Standard` when zari/weight were missing. The error therefore existed both in saved product creation and presentation.

## B. Hard-coded content found

| Location | Finding | Resolution |
| --- | --- | --- |
| Admin product creation | Raw Silk, Festive & Puja, S/M/L, ready-to-ship true, generated Default color | New product fields start empty/unchecked; real fields are editable. |
| Product details | Invented zari, Standard weight, Pure Silk Density suffix, always-present care/material rows | Only nonempty saved specifications render. |
| Detail tabs | Saree-specific heritage tab; unconditional Silk Mark laboratory certification narrative | Conditional Product details / Additional details / Reviews. |
| Product shipping tab | Free express insured delivery, velvet boxes, worldwide DHL dates, seven-day exchange and alteration guarantees | Removed; no approved global policy data source exists for these claims. |
| Pincode checker | Pre-filled 500033, already marked available; any six-character string triggered an express-delivery promise | Empty initial input, Indian pincode-format validation, explicit notice that serviceability was not checked, contact link. |
| Stock copy | “handcrafted pieces”; card inferred “Made to order” from a false ready-to-ship flag | Neutral stock messages from quantity and the existing low-stock setting. |
| Quick view/cards/wishlist actions | Default / Standard colors and Unstitched sizes injected by add actions | Empty selections for products without options; real choices for products with options. |
| Certification badges | Handloom flag presented as Silk Mark certification | Displays only “Handloom certified” when its existing flag is saved true. |
| Reviews | Default Hyderabad city; saree/bride-specific empty-state and input copy; zero-review ratings presented as ratings | No city invention, neutral review copy, summary ratings hidden when review count is zero. |
| Catalog/context | Bundled products and `mb_products` localStorage on startup, empty query and errors | Firestore-only catalog with explicit loading, empty, and error states. |
| Coupons/customer initialization | Bundled coupon codes and browser coupon fallback; sample customer/profile defaults | Firestore coupons only; empty unauthenticated profile. Development data remains in its original file. |
| Shop filters | Fixed silk, occasion and size lists | Options derived from the current published catalog, including custom values. |
| Homepage featured grid | Hardcoded Handcrafted Fashion / Selected Styles, ignored Website Content fields | Uses the existing CMS fields; all-products tab makes unflagged real products visible. |
| Cart | Universal handloom/SSL claim, free *express* wording, WELCOME10 example, complimentary velvet packaging and an unsaved note input | Neutral copy, standard-shipping cost wording, generic coupon input, packaging enquiry. Existing item gift fields remain compatible. |
| Checkout | Insured named couriers, 4–6 day delivery, 1–2 day air express, same-day dispatch, physical Silk Mark cards/velvet boxes | Removed promises; existing shipping choices and amounts retained. Standard cost display now uses the actual computed amount. |
| Tailoring promotion/guide | Guaranteed lining, alteration margins, elaborate finishes and free timed video fitting | Neutral guidance; homepage promotion appears only when an active product offers tailoring. |
| CMS defaults | Placeholder About story and fallback marketing copy | Missing About/Website Content fields normalize to empty text. Existing contact constants and banner behavior retained. |
| Structured store data | Contact values duplicated from static brand constants despite CMS contact editor | Telephone, email, address and map consume the existing CMS contact record. |

Repository-wide searches also found demo descriptions/images/reviews in `mockProducts.ts`, demo records in `initialData.ts`, and old `ArtisanStory`, `CategoryShowcase`, `CustomerReviews`, and `InstagramLookbook` components. The old home components are not imported by the active application; they were retained rather than deleting unrelated assets/history. No production catalog import of `mockProducts.ts` remains.

## C. Existing fields reused

`title`, `subtitle`, `sku`, `category`, `description`, `priceINR`, `originalPriceINR`, `discountPercentage`, `stockCount`, `isActive`, `images`, `fabric`, `occasion`, `careInstructions`, `availableSizes`, `colors[].colorName/colorHex/images`, `zariType`, `weightGrams`, `blouseLength`, `sareeLength`, `includesBlousePiece`, `craftDetails`, `tags`, publication/merchandising flags, and custom-tailoring availability/fee.

There is no second material field: the UI label “Material / Fabric Composition” writes the existing `fabric` property. There was no existing subcategory editor to extend. Category names remain free text and are shown without mapping them to a different collection.

## D. New Admin controls

Added controls for existing material, care, sizes, colors, occasion, MRP, discount, subtitle, tags, additional details, relevant optional saree/weight fields, merchandising flags, and tailoring fields. Added a label/value editor for genuinely additional specifications. All characteristic fields remain optional. A jewellery product needs no clothing attributes.

MediaUploader and Cloudinary signing were reused without changes. Colors can have a name only; optional hex and per-color images remain supported. Uploads use the stable product ID held in editor state.

## E. Product schema changes

- Added optional `specifications: Array<{ label: string; value: string }>`.
- Widened `FabricType`, `OccasionType`, `SizeOption`, and `zariType` to strings so cotton, linen and custom sizes do not require code changes.
- Made `includesBlousePiece` optional rather than requiring every product to assert that characteristic.
- No new collection, duplicated product database or variant-stock schema.
- Shared normalization produces empty strings/arrays for missing optional content, with no invented characteristics. Unknown existing properties are retained.

## F. Firestore compatibility

Existing document envelope stays `{ data: product, category, sku, status, timestamps }`. The document ID is authoritative; archived/inactive products are excluded from public results. Admin can still read disabled products.

Both product write paths use shared normalization. Removing optional numeric fields writes `null`, so Firestore merge writes clear old values rather than retaining them or rejecting `undefined`. Empty arrays replace removed options. Old records without new fields work without migration. Rules, admin authentication, custom claims, order cancellation, and Cloudinary signing are unchanged.

## G. Sizes

Admin can click XS/S/M/L/XL/XXL suggestions, enter custom labels, and remove size chips. Values are trimmed and deduplicated case-insensitively without changing the retained spelling. No default sizes are saved. Product detail and quick view render the selector only when saved sizes exist.

## H. Colors

Admin can add/remove color rows, name colors, optionally set a hex code and manage per-color image URLs/uploads. Empty names and malformed optional hex values are rejected in the editor; duplicate names are normalized. Customer controls show readable names, optional actual swatches, and use the selected color’s images when available. There is no generated Default or Standard color.

## I. Specifications

The shared specification builder displays actual material, care, zari, weight, blouse/saree details and additional rows. Empty rows disappear. Zero weight is preserved as `0 grams`; no density claim is added. The editor rejects duplicate labels and directs material/care/etc. to their dedicated fields, avoiding duplicate sources for one characteristic.

## J. Stock/inventory

Stock remains product-level. The existing Admin inventory quantity and low-stock setting drive the UI. Zero stock disables purchase controls. The cart checks combined quantity across every size/color line for a product. Invalid options, removed/disabled products and excessive quantity block checkout with a corrective message.

Checkout re-reads Firestore before saving. Changed prices require review of the updated total. This is client validation, **not atomic inventory reservation or trusted server-side price verification**; those pre-existing backend gaps remain.

## K. Product detail changes

Conditional specifications, description and additional-details tab; no unsupported policy/certification prose; real variant names and media; neutral stock copy; truthful pincode-format check; preserved wishlist/share/WhatsApp actions. Breadcrumb displays and filters by the exact saved category. Related products use matching real category or nonempty material. Unknown IDs keep Product Not Found; loading/error never falls back to another product.

## L. Cart, checkout and order variants

Existing identity remains product + color + size + tailoring choice. Empty options now have empty identity fields rather than synthetic Unstitched. The “Already added” guard remains for the same combination; different valid combinations can be separate lines within shared stock.

Cart product information and prices resolve against the current catalog. Historical order product snapshots remain unchanged. Selected color/size survive cart storage and canonical order serialization and render in cart, checkout, confirmation, customer history/details, and Admin order details. Removed options are not silently replaced with different choices; the customer is asked to remove/reselect the line.

## M. Other customer pages

Shop/search filters consume saved values. Cards, featured products and wishlist media use the neutral image component. Product cards and featured actions open quick view when variant choice applies. Wishlist move-to-bag also opens selection for products with options; such an item stays saved until the customer chooses to remove it. Contact/About/banners continue using their existing repositories and UI. CMS contact data now also feeds structured store metadata.

## N. Demo/fallback removal

Removed production product/coupon localStorage reads/writes and bundled fallback imports. Empty Firestore collections remain empty. Demo seed files were retained. The existing generic size-guide modal remains in source, but product selectors no longer open its unconfigured chart. Existing static collection URLs remain supported; new arbitrary category names filter the shop without being remapped to an unrelated legacy URL.

## O. Realtime/Admin verification

`subscribeToCatalog` uses Firestore `onSnapshot`; Admin saves, stock edits, publication changes, and option removal feed the same normalized public array. Quick view resolves its current product by ID rather than rendering its stored object copy. The cart derives current product data from that array. Listener cleanup is implemented.

Local tests exercise real repository callbacks with a fake Firestore adapter: Cotton → Linen → empty material, option changes, empty collections, errors and unsubscribe. Actual multi-tab Firebase propagation is **not verified** here. Other CMS sections retain normal initial loading and the existing `refreshCms` calls after Admin saves; they have not been converted into cross-session live listeners.

## P. Files changed

New implementation files:

- `src/utils/productData.ts`
- `src/components/admin/ProductEditor.tsx`
- `src/components/common/ProductOptions.tsx`
- `src/components/common/ProductImage.tsx`
- `scripts/admin-driven-catalog.test.mjs`
- This report.

Existing files updated:

- `src/types/index.ts`
- `src/services/commerceRepository.ts`, `src/services/cmsRepository.ts`
- `src/context/StoreContext.tsx`
- `src/components/admin/AdminPortalPage.tsx`
- `src/components/product/ProductDetailPage.tsx`
- `src/components/common/ProductCard.tsx`, `QuickViewModal.tsx`, `WishlistDrawer.tsx`, `SeoManager.tsx`
- `src/components/shop/ProductListingPage.tsx`
- `src/components/home/FeaturedGrid.tsx`, `StorefrontHomePage.tsx`, `CustomTailoringBanner.tsx`
- `src/components/cart/CartPage.tsx`, `CartDrawer.tsx`
- `src/components/checkout/CheckoutPage.tsx`, `OrderConfirmationPage.tsx`
- `src/components/account/CustomerAccountPage.tsx`
- `src/components/pages/TailoringGuidePage.tsx`

`TECHNICAL_OVERVIEW.md` was already untracked before this task. Its catalog/test description is updated to match this implementation; its unrelated content is retained.

## Q. Tests performed

18 focused Node regressions cover legacy/sparse records; cotton with no sizes; explicit/custom size and color controls; material and option removal; product name/price/category/description changes; stock states; invalid IDs; inactive/archived/empty/error catalog; listener replacement and cleanup; trimming/deduplication; empty Admin defaults; Firestore field clearing; duplicate cart identity; shared stock and stale options; current cart versus historical order data; saved order variants; color-specific images; validation; and rendered cart/order variant labels.

Tests render actual React components to HTML and call actual repositories through test-only fake Firebase/context adapters. They do not simulate browser clicks or prove security rules/live Firebase behavior. No production test records were created.

All 9 existing Cloudinary regression checks passed. No signing/upload implementation was modified.

## R. TypeScript/build results

- `npm.cmd run lint`: pass (`tsc --noEmit`; this repo does not have a separate ESLint configuration).
- `npm.cmd run build`: pass; existing warning about the JavaScript chunk exceeding 500 kB remains.
- `node --test scripts/admin-driven-catalog.test.mjs`: 18 passed.
- `node --experimental-require-module --import tsx --test scripts/cloudinary-sign.test.ts`: 9 passed.
- `git diff --check`: pass.
- Post-build/source search confirmed no Raw Silk, Pure Tested Metallic Zari, demo product ID, Silk Mark, DHL or 7-Day fallback in the production bundle. Remaining source occurrences are preserved demo files, unused legacy components, or historical courier type labels.

The new test compiler needed approved execution outside the Windows sandbox because its directory traversal was denied. The adapter prevents real Firebase reads/writes regardless of execution mode.

## S. Existing Firestore records needing manual review

Start with the reported **AB-DM-001 / Dress Material**. Set the actual material, remove irrelevant sizes/colors/occasion and confirm ready-to-ship availability. Review all products created through the old editor for:

- `fabric: Raw Silk` when incorrect;
- `availableSizes: S, M, L` when not applicable;
- `colors: Default` and the generated gray swatch;
- `occasion: Festive & Puja` when not intentional;
- `isReadyToShip: true` when not confirmed.

Do not bulk-delete these values: a real product may intentionally use them. Saved values have no provenance marker identifying generated versus owner-entered content. No live catalog was fetched in this task, so an exhaustive affected-ID list is not claimed. Existing cart lines with obsolete selections need removal/reselection. Historical orders are not retroactively rewritten.

## T. Remaining configuration limits

| Area | Remaining behavior and reason |
| --- | --- |
| Shipping/tax amounts | Existing code uses a 5% tax calculation, standard shipping of INR 450 below INR 5,000 and INR 350 for express. They are not fields in the existing Admin settings. Their arithmetic is retained because policy/payment/checkout redesign was explicitly excluded. This report does not validate these rates as business policy. |
| Shipping/returns prose and serviceability | No finalized CMS policy or genuine pincode service was found. Product promises were removed, not replaced with invented policy. |
| Inventory | Product-level quantity only; no variant inventory or atomic reservation. |
| Category URLs | Existing fixed SEO/collection routes retained. Arbitrary Admin categories work in catalog filtering; new indexed URL generation is outside this change. |
| Ratings/reviews | Existing product aggregate values and review collection retained; no new moderation/aggregate-recalculation backend or Admin review editor. |
| Branding/contact/banners | Existing brand assets/constants and responsive banner fallback retained as requested. Configured CMS contact values take precedence; missing contact documents retain the project's pre-existing contact defaults. |
| Tailoring | Existing customer measurement/preference flow remains, enabled only by the product's saved tailoring flag. The retained general guide is not a per-product fit chart; no universal fit/courier/material guarantee should be inferred. |
| Structural UI | Button/navigation/form labels remain code. Newsletter remains its existing explicitly unconnected feature. No unrelated CMS conversion was introduced. |

## U. Exact manual checklist

Run `npm.cmd run dev`. Use the local app for code review; for write tests use an authorized staging Firebase project or deliberately selected test records. A local frontend pointing to production Firebase still writes production data. Nothing below was performed against production by this task.

1. Open Admin in one tab and the corresponding customer product page in another. Use separate browser profiles if needed. Confirm the real admin custom claim works without changing claims/rules.
2. Create **Cotton Dress Material**, SKU **AB-TEST-DM**, category **Dress Material**, material **Cotton**, one color **Green**, no sizes, stock **1**. Supply an approved image if desired. Save and reopen the editor to verify persisted values.
3. Customer page must show Cotton, Green and “Only 1 item remaining.” It must not show Raw Silk, zari, default weight, S/M/L or Default shade. Quick view must agree.
4. Change Cotton → Linen while the customer tab remains open. Confirm the visible value changes without reload. Clear material and save; its row must disappear. Clear description/care/additional details and confirm their empty sections disappear.
5. Add a clothing test product with S/M/L and Red/Blue. Add a custom size such as 42. Save, reopen, select each option, and verify exactly those choices appear. Try duplicate/blank values and malformed optional hex input.
6. Remove all sizes and save; the selector disappears. Remove all colors and save; that selector disappears too. Check both product detail and an already-open quick view.
7. Change stock 5 → 1 → 0. Verify current messages and disabled buying controls at zero. Change the low-stock setting and verify product/card warnings use it after the existing CMS refresh.
8. Change name, category, description, price and images. Check detail, card, search, shop filter choices, homepage, wishlist, and the existing cart. Category must use the saved name. Verify a per-color image appears for that color and persists through the bag/order snapshot.
9. Add S/Red, attempt S/Red again (“Already added”), then add M/Blue with enough product stock. Confirm separate lines and shared quantity limits. Remove an option or disable the product while it is in the bag; checkout must request correction.
10. Complete an authorized test COD order. Verify selected size/color and image on checkout, confirmation, Account order history/details and Admin order details. Edit the live product afterward; the historical order must keep its purchased snapshot.
11. Open an old record with no new optional fields. Confirm it renders without crashes or fabricated characteristics. Create a jewellery test product with material/finish only; no clothing fields are required.
12. Visit `/product/not-a-real-product`. Expect Product Not Found, never another product. In an empty staging catalog expect an empty shop, not sample inventory. With unavailable Firebase expect a neutral unavailable state.
13. Enter malformed and six-digit pincodes. The feature may validate the format but must never confirm courier availability, dispatch timing or delivery dates.
14. Save each Website Content field and verify the featured section/new-arrivals copy/footer. Check existing Contact, About, Banners and settings saves still feed their existing public displays. Verify desktop/mobile banner behavior and Cloudinary uploads separately.
15. At 1440 px, 768 px and 390 px widths, inspect product specifications with long values, wrapped size/color buttons, gallery switching, and Admin modal scrolling. At 390 px verify tap targets, no horizontal overflow, adding/removing options, validation messages and Save. These visual/interaction checks are still pending.
16. Review the production diff and data-cleanup results before deciding on deployment. No commit, push or deployment is included in this task.
