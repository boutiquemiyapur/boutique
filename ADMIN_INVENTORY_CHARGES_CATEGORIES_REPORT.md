# Admin inventory, checkout charges and categories

Local implementation completed 14 September 2026. No commit, push, deployment, Firestore rule deployment, category migration or production Firebase write was performed.

## Implemented behavior

- Products may use `variantInventory[]` rows keyed by color and size. Colors-only and sizes-only products are supported. When the array exists, `stockCount` is derived from its row total; older products without the array keep their existing shared product stock.
- The product editor builds the complete variant matrix, preserves matching rows, initializes new combinations at zero and explains when removed options will remove obsolete rows on save. Admin can explicitly return a product to shared stock.
- Product detail and quick view disable unavailable choices and block purchase for an unavailable exact combination. Cart quantity checks aggregate the same product/variant combination and continue to aggregate all lines for legacy shared-stock products.
- `/api/orders/create` verifies the signed-in Firebase user and re-reads products, the coupon and `settings/admin` inside a trusted flow. A Firestore transaction validates stock, snapshots authoritative product/price/charge data, creates `/orders/{id}` and decrements the selected stock rows. A stable request ID prevents the same request from decrementing stock twice.
- Firestore rules now deny direct customer order creation. Customer cancellation remains limited to the existing eligible states. Product and category writes remain admin-only.
- `settings/admin.data.checkoutCharges` is the charge source. Admin can add, remove, enable or disable fixed INR and percentage rows. Percentage charges use merchandise subtotal after coupon discount and exclude tailoring and other charges. Cart, checkout, the server transaction and confirmation use the shared rule. Orders snapshot each applied charge and amount.
- `/categories/{id}` is the shared source for Admin product selection, public navigation, homepage cards, shop filters, route parsing and dynamic sitemap entries. Category names and slugs must be unique. Slugs remain stable after creation. Categories in use cannot be deleted or renamed. Disabled categories remain in Admin and disappear from public category navigation.
- Existing six collection paths remain in the legacy SEO map and static sitemap. Admin lists category names found on products but absent from the category collection, with a one-click registration action.
- Product and inventory tables now use compact cards, status badges and clear action buttons. Settings and category screens adapt to narrow layouts and wide tables scroll within their cards.

## Data shapes

```ts
type VariantInventoryItem = {
  key: string;
  colorName: string; // empty when the product has no color choices
  size: string;      // empty when the product has no size choices
  stock: number;
};

type CheckoutCharge = {
  id: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  enabled: boolean;
  sortOrder: number;
};
```

New orders include `charges[]` with the saved definition plus `amountINR`. Legacy `shippingCostINR` and `taxGstINR` fields remain populated when configured charge names identify shipping/delivery or tax/GST, so old readers remain compatible.

## Validation completed

- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed; the existing large chunk warning remains.
- `node scripts/admin-driven-catalog.test.mjs`: 22 passed.
- `node scripts/order-transaction.test.mjs`: 3 passed, covering successful exact-variant decrement, charge snapshot, idempotent retry, rejected overselling and changed-total review with no partial write.
- `node --experimental-require-module --import tsx --test scripts/cloudinary-sign.test.ts`: 9 passed.
- `git diff --check`: passed.

The Node suites use local Firestore/Firebase Admin test doubles and make no network request or live data write. Browser automation was unavailable in this workspace, so interaction, responsive screenshots, live Firebase authorization and production Vercel execution remain unverified.

## Required operational steps

1. Review and deploy `firestore.rules` before enabling the new checkout. Once the client is deployed, direct customer order writes are no longer used.
2. Deploy the frontend and `/api/orders/create` together. The endpoint needs `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, and the existing `NODE_OPTIONS=--experimental-require-module` Vercel setting used by Firebase Admin in this project.
3. In Admin → Categories, register each legacy product category. Review generated slugs before creation because slugs stay stable afterward.
4. In Admin → Settings, enter only owner-approved charges. With no enabled rows, checkout applies no additional charge.
5. Open each product with sizes or colors and choose whether to keep legacy shared stock or configure the variant matrix. New rows start at zero by design.
6. On staging, test simultaneous final-unit orders from two customer accounts. Confirm one transaction succeeds and the other receives an out-of-stock response.
7. Verify cart, checkout, confirmation, customer history and Admin orders at desktop, tablet and mobile widths. Confirm disabled categories disappear and both legacy and new `/collections/{slug}` routes open the intended filter.

Vite development alone does not run Vercel API functions. Use a Vercel-compatible local runtime or staging deployment for end-to-end checkout verification.

Customer cancellation keeps the existing order-cancellation behavior and does not automatically return units to inventory. An administrator must review and adjust stock after a cancellation until a trusted restock workflow is added.
