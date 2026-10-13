# Existing product galleries and Razorpay EMI display fix

2026-10-13. Gallery evidence baseline: `81184e588e8a4dd6b12db49afb0263ae3aca4a0b`. Current saved-configuration delta baseline: `be273e7f582c83a998579d35a4c688aa77bc8e46`. Gallery changes are now committed baseline history; this configuration update remains uncommitted. No Production Firestore record, credentials, merchant configuration, payments or deployment were changed.

## Confirmed root cause and read-only evidence

A credential-free, GET-only read of the existing publicly readable Firestore product collection returned 46 product records. It inspected product media only; no private customer/order/payment records were read. 41 records contain both general and color-specific media. The records use `data.images` and `data.colors[].images`, both arrays; no alternate gallery field or inconsistent shape was observed in this inventory. Twelve archived records remain excluded by the existing catalog mapper. All 34 nonarchived records passed an offline comparison preserving every existing general/color URL and exposing the general gallery alongside selected-color media. This was not a database migration or save.

Specific comparison:

| Product | General images | Color images | Previous behavior |
| --- | --- | --- | --- |
| `ab-1789628934256`, Cotton Handloom With Print Dress Material | 4 Cloudinary URLs | Navy Blue, Yellow, Green, Safron: 1 URL each | First color auto-selected; helper returned its single image instead of general images, so `gallery.length > 1` was false and thumbnails disappeared. |
| `ab-1791569135102`, Payment Test Product | 3 Cloudinary URLs | No colors | Helper returned all 3 general images, so thumbnails appeared. |

The primary defect was gallery selection, not absent uploads or a failed Firestore save. The same helper replaced the general list whenever a selected shade had images. Records already contained the missing media, so admins do not need to reupload/resave.

## Complete media flow and compatibility

- `ProductEditor.tsx` starts from `normalizeProduct`, keeps Additional product images in `draft.images` and each Available colors / shades URL list in `draft.colors[i].images`. Upload callbacks append only to their respective source. Submission normalizes the draft; it does not merge shade images into general images.
- `cmsRepository.saveProduct` uses `productForStorage` and the existing inventory-version/SKU transaction to write `products/{id}.data`. Existing browser/server catalog readers use `productFromDocument` and `normalizeProduct` through the current catalog listener. Storage/version/price/stock logic is unchanged.
- `ProductDetailPage` calls `productImages(product, selectedColor)`. The helper now orders selected-color images first, followed by all general images, deduplicated. Other shade images remain separate until that shade is selected. Existing main/catalog image order remains unchanged when no shade is selected; if general images are absent, catalog cards can use the first shade's media. A specifically chosen shade with no images falls back to general media or a neutral unavailable state, never an unrelated shade's image.
- General and shade URL normalization now supports canonical arrays, legacy single/newline-separated strings, and upload objects using `secure_url`, `url` or `src`. These extra formats are synthetic regression cases, not the confirmed cause of the inspected existing records. Empty/malformed/unsafe URLs are excluded; local image assets and valid HTTP(S) URLs remain supported. URL paths retain case, order is preserved and exact duplicates are removed. Duplicate shade names retain their media rather than losing the second row's URLs.
- Runtime failed images are removed from the detail gallery, falling back to another valid image or the existing neutral unavailable component. Thumbnail keys use the URL, have accessible labels/pressed state and retain existing desktop/mobile sizing and horizontal scrolling. Selecting a shade resets to its first image; selecting a thumbnail changes the preview. Single-image products show no redundant strip.

Existing Admin edit/submit plus serializer/mapper round-trip regression verifies general/color media stay separate and prices, stock, category and custom metadata survive. No migration, new fields, Firestore rules/index change or new infrastructure is needed. This fix does not determine whether every remote Cloudinary asset is currently reachable; failed loads are handled at runtime.

## Razorpay saved payment configuration update

The owner subsequently supplied `config_TnT66HkFpG4oK4`, configured to enable UPI, Cards, Netbanking and Wallets and disable EMI. The integration now uses Razorpay's documented saved-configuration method: the existing provider order request includes `checkout_config_id: 'config_TnT66HkFpG4oK4'`. Checkout receives that same server-issued `order_id`. The previous inline `config.display` override has been removed so it does not compete with the saved payment profile. [Official saved configuration integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/display-configuration/).

Only payment-display metadata was added to the provider request. Amount, INR currency, receipt, partial-payment policy, checkout/customer mapping, callback verification, order processing, webhooks, refunds, inventory and all security controls are unchanged. No unsupported client `config_id` field is guessed. No new credentials or environment variable is required.

The supplied profile contents are owner-provided, not independently inspected in LIVE Dashboard. Newly created provider orders receive the profile; previously created/reused orders retain their original configuration and are not modified or recreated. Verify the profile belongs to the existing LIVE merchant account before deployment. Hosted acceptance and display still require separately approved verification; no LIVE call/payment was made. No Dashboard change is needed merely to reference the provided profile. Full merchant-method deactivation, beyond hiding EMI in this app, remains a separate optional Support action described below.

The actual provider transport regression checks the exact configuration ID and all unchanged order fields. The existing Checkout regression checks INR 61/INR 1,410 without an inline override and preserves the server-issued order/key/amount/currency and dismissal behavior. This supersedes the earlier inline EMI hide-array implementation.

### Exact remaining merchant steps — owner action only

1. Log into the existing Razorpay Dashboard in LIVE mode using an authorized owner/admin/manager account. Open **Account & Settings → Payment Methods** and inspect enabled EMI providers, credit/debit EMI and cardless EMI. Do not share keys, signatures or customer details.
2. For complete account-level disablement, open **Account & Settings → Support tickets** under Business settings, select **+ Raise New Query**, choose the relevant payment-method topic/subtopic and submit: “Disable all credit-card EMI, debit-card EMI, cardless EMI and applicable no-cost EMI methods/offers for our LIVE merchant account. Preserve normal card, UPI, netbanking, wallet and other non-EMI methods. Confirm scope across Standard Checkout and other enabled payment channels.” Keep merchant identification inside the authenticated support channel. Review the request before submission; no ticket was sent by this implementation. Razorpay's documented alternate entry is **Help → Create support ticket**. [Official support steps](https://razorpay.com/docs/payments/dashboard/support).
3. Await Razorpay confirmation and verify method statuses privately. If an existing custom display configuration is used, inspect **Account & Settings → Payment Configuration** under Checkout settings for EMI blocks. After approval, hide EMI in that configuration and save changes; an approved default configuration can be selected with **options → Save as Default → Save all changes**. This changes display, not account activation, and should not add a new configuration ID to this app without separate review. [Official Dashboard display configuration](https://razorpay.com/docs/payments/dashboard/account-settings/payment-configuration/).
4. Hosted merchant-specific Checkout verification remains outstanding. Any new LIVE checkout/order creation is Production-affecting and requires separate approval; do not start a payment flow merely to check visibility under this task. If approved later, inspect mobile/desktop options at an EMI-eligible amount and verify non-EMI methods, without completing a transaction unless specifically authorized. Record redacted evidence and Support's scope confirmation before claiming full disablement.

## Test results

| Check | Result |
| --- | --- |
| Complete existing regressions plus new gallery/EMI tests | **240 passing in the gallery release baseline**, zero failures/cancellations/skips |
| New product gallery regression file | **7 passing**, included above |
| Real headless Chrome, localhost synthetic fixtures | Desktop 1280px + mobile 390px: thumbnail/color switching, single image, broken/empty media and no page overflow; mobile horizontal strip verified |
| Firestore emulator | **90 authorization checks**, all functional payment/shopping/cancellation/refund/inventory suites; exit 0 |
| TypeScript | Pass |
| Local Production build | Pass; existing Firebase-disabled/large-bundle warnings remain |
| Diff/manifest/index | Five current configuration files; no staged changes |

New image tests cover the observed affected-product shape, Payment Test Product shape, legacy strings/upload objects, general-only/color-only/both, case-sensitive URL deduplication, shade switching, thumbnail selection, runtime failure and real Admin submit/serialization round-trip. The browser fixture uses the actual product page and built CSS, a separate headless profile and local SVG assets; external HTTPS is blocked, Firebase and payment callbacks are mocked, and no Razorpay SDK is loaded. Desktop/mobile screenshots were visually inspected. It is local layout/control validation, not hosted Cloudinary or LIVE Checkout verification.

The mocked Razorpay regressions inspect saved configuration metadata at the provider boundary and constructor options at INR 61/INR 1,410 without an inline override, validate unchanged trusted order/key/amount/currency, then dismiss without any verification call. All existing payment-success/failure, cancellation, refund, Cart and stock safety regressions pass.

Reproduce locally (tests use existing dependencies):

```powershell
npm.cmd run lint
npm.cmd run build
node --test scripts/product-gallery.test.mjs scripts/admin-driven-catalog.test.mjs scripts/payment-client.test.mjs
node scripts/product-gallery-browser.test.mjs
npm.cmd run test:payments
npm.cmd run test:payment-security
npm.cmd run test:cancellation-refunds
npm.cmd run test:refund-management
npm.cmd run test:payment-webhook
npm.cmd run test:shopping-ux
```

For the existing emulator runner, use the installed Java 23 and `npm.cmd run test:payment-emulator`; the configuration is restricted to `demo-ab-payments`, localhost port 8189. Ignored evidence lives in `node_modules/.cache/gallery-emi-*.log`, `gallery-unit.log`, `gallery-browser.log`, `gallery-public-products.json`, and `gallery-browser/gallery-{390,1280}.png`. No public catalog fixture dump or browser profile is included in the release.

## Exact current configuration files changed: 5

| File | Change |
| --- | --- |
| `src/services/paymentClient.ts` | Remove inline display override; use configuration bound to server-issued order. |
| `server/payments/provider.ts` | Add `checkout_config_id: 'config_TnT66HkFpG4oK4'` as provider-order display metadata only. |
| `scripts/payment-client.test.mjs` | Confirm no client override at either amount; preserve trusted checkout fields. |
| `scripts/manual-refund-provider.test.mjs` | Verify exact saved configuration and unchanged order transport fields. |
| `GALLERY_EMI_FIX.md` | Record current integration, validation and legacy-order limitation. |

The earlier eight-file gallery fix is now baseline history. Its production data, compatibility, browser and emulator evidence above remains historical evidence; the current configuration delta does not alter those gallery files.

## Deployment and remaining checks — separate approval required

1. Review the five configuration files plus the earlier committed gallery changes and obtain explicit approval for commit/push/deployment. No Git write or deployment was performed. Preserve the current npm/package-lock.json/Vercel pipeline and existing Firebase/Razorpay configuration. No new project, environment, dependency or database migration is needed.
2. Resolve the existing payment-security audit release gates before deploying a full checkout that includes the earlier prepared refund changes. Keep refund activation separately authorized and verify its persisted admin toggle OFF under the existing release procedure; this task did not inspect/change it.
3. Release the complete approved frontend build through existing GitHub/Vercel Production infrastructure. No Firestore rules/data deployment is required specifically for these gallery/Checkout-display changes. Verify the official domain serves the new build.
4. Read-only after deployment: open `/product/ab-1789628934256`, confirm five unique thumbnails for each of Navy Blue, Yellow, Green and Safron, and check general-image selection; confirm Payment Test Product still has three images and single-image products work. Check mobile scrolling and desktop layout. Read existing Admin image fields without saving or uploading.
5. Complete the separately approved Razorpay merchant Support/configuration steps above. Do not claim full EMI disablement until merchant confirmation and hosted display evidence are available. No LIVE payments are authorized by this handoff.
6. If rollback is required, rebuild the reviewed prior frontend with safe current credentials and the existing refund release safeguards. Reverting this scoped display change restores the old gallery/EMI presentation. Do not reactivate an old compromised-secret deployment or an unsafe refund gate while rolling back.

Local gallery and Checkout-option implementation is verified. Merchant EMI deactivation, hosted display and the existing broader security release gates remain separate outstanding work.

## Saved-configuration validation follow-up

Relevant payment foundation/environment, client/presentation, signed webhook, payment-security and actual provider adapter suites passed **102/102** for this update. TypeScript, the Production build and git diff --check also passed. Current results are in ignored `node_modules/.cache/checkout-config-{tests,types,build}.log`. These follow-up checks do not claim LIVE merchant acceptance or hosted EMI verification. No deployment occurred.
