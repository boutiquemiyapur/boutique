# Payment status and loading UX implementation

## Audit findings

`PaymentService.create` creates an internal order with `orderStatus: 'Order Placed'`
and `paymentStatus: 'CREATED'` before money is captured. That stored fulfilment
field is not payment evidence. Customer history, details and tracking, plus admin
summaries/counters, previously displayed it independently of verified payment.
The correction derives presentation from existing trusted fields; it does not
rewrite historical records or change the backend state machine.

The account details modal previously held an entire order snapshot in React state.
It could stay pending after a listener received capture. It now stores only the
selected ID and reads the current exact record. Missing IDs show an unavailable
message rather than a different order. Admin refreshes reject stale completions
and preserve newer captured/refunded snapshots.

Checkout previously showed one generic preparation message for the entire SDK and
verification lifecycle. Recovery displayed raw backend codes. Payment HTTP
requests could wait indefinitely. Progress now follows actual lifecycle stages;
SDK loading has its existing 15-second deadline, and payment HTTP/token work has
a 25-second deadline with explicit uncertainty/recovery wording. Timeouts do not
mark payments failed and do not cancel trusted server processing.

Profile/measurement saves also showed success before Firestore persistence. They
now await the existing repository write, expose saving state, reject false success
on errors, and ignore completion after an account switch.

The supplied screenshots show a captured INR 1 transaction and an INR 1,350 pending
order. They do not establish matching payment/order IDs. The existing exact amount,
currency, ownership and mapping checks are unchanged. No Production records or
Razorpay transactions were read or modified during this task.

## Display mapping

| Existing evidence | Display |
| --- | --- |
| Captured/verified PAID, complete provider metadata, no review hold | Payment Successful; Order Confirmed for the initial fulfilment stage |
| CREATED | Payment Incomplete |
| PAYMENT_PENDING / AUTHORIZED / supported legacy Pending | Verifying Payment; authorization explanation remains available |
| Current customer dismisses checkout | Payment Cancelled feedback, explicitly describing checkout closure and possible later capture |
| Confirmed FAILED | Payment Failed |
| EXPIRED | Payment Expired |
| REFUND_PENDING | Refund Processing |
| PARTIALLY_REFUNDED | Partially Refunded |
| REFUNDED | Refunded |
| Review hold, missing provider, incomplete captured metadata or unknown state | Payment Under Review |
| Historical COD | Historical order / Cash on Delivery, without implying verified online payment |

Dismissal is not written as a financial status. A historical pending record cannot
be retrospectively classified as a cancelled checkout without evidence, so it
continues to display Verifying Payment. Admin cancellation filtering uses existing
recorded cancellation metadata; it does not invent cancellation history.

Fulfilment timelines/courier details are hidden for ineligible online orders. The
browser's fulfilment controls use a conservative eligibility check; the unchanged
server and Firestore guards remain authoritative. Refund/review states cannot
accidentally expose fulfilment controls.

## Customer and admin changes

- Shared payment-aware badges replace standalone unpaid Order Placed badges.
- Friendly payment labels replace technical values in customer-facing views.
- Customer details follow listener updates, including delayed capture/refunds.
- Admin orders include search, paid/unpaid/pending/failed/expired/refund/review/
  recorded-cancellation/COD filters and export of the visible snapshot.
- CSV uses friendly labels and escapes spreadsheet formula prefixes.
- Completed sales exclude unpaid delivered records. Net captured online receipts
  use verified captured amounts minus known refunds; uncertain refund amounts
  cannot inflate reported revenue. Captured money under a review hold is still a
  receipt, but is not an eligible/completed sale.
- The website layout, pricing, data sources, backend routes, inventory ledger,
  refund synchronization and financial write permissions are preserved.

## Loading system

`Loading.tsx` adds Spinner, ButtonProgress, LoadingFeedback and PageLoading. Existing
skeletons are retained and extended with order cards, admin tables/statistics and
cart/wishlist/checkout variants. Product image loading uses the same pulse style.
Slow page/data loads offer reload recovery after 15 seconds without restarting
listeners or pretending the operation failed. Timer cleanup follows unmounting.

Transitions use opacity/transforms for 200ms. Spinners rotate over 900ms; skeleton
pulses use 1.8 seconds. Reduced-motion disables these animations, and existing
Motion components inherit `reducedMotion='user'`. Confetti is skipped under reduced
motion. No Chakra dependency or artificial navigation delay was added; the
[Chakra animation reference](https://chakra-ui.com/docs/theming/animations) informed
the equivalent CSS vocabulary.

Checkout reports preparing, loading SDK, opening options, hosted checkout, and
trusted verification. Recovery reports retry/status-check progress. While the
hosted Razorpay UI is active, the website shows contextual text rather than a
competing overlay/spinner. Error, dismissal and completion clear payment progress;
duplicate submissions remain blocked and late callbacks cannot undo captured data.

## Files changed in this task

Prior uncommitted Test/Live environment work remains intact and is separate from
this list.

```text
src/App.tsx
src/index.css
src/context/StoreContext.tsx
src/services/paymentClient.ts
src/utils/paymentState.ts
src/utils/orderReporting.ts                         (new)
src/components/common/Loading.tsx                  (new)
src/components/common/OrderStatusBadge.tsx          (new)
src/components/common/Skeleton.tsx
src/components/common/ProductImage.tsx
src/components/common/WishlistPage.tsx
src/components/common/WishlistDrawer.tsx
src/components/account/CustomerAccountPage.tsx
src/components/auth/AuthPage.tsx
src/components/cart/CartPage.tsx
src/components/cart/CartDrawer.tsx
src/components/checkout/CheckoutPage.tsx
src/components/checkout/OrderConfirmationPage.tsx
src/components/checkout/PaymentRecovery.tsx
src/components/tracking/OrderTrackingPage.tsx
src/components/admin/AdminOrders.tsx               (new)
src/components/admin/AdminPortalPage.tsx
src/components/admin/CustomerEnquiriesPanel.tsx
src/components/admin/InventoryManager.tsx
src/components/admin/ProductEditor.tsx
scripts/payment-client.test.mjs
scripts/payment-presentation.test.mjs              (new)
scripts/shopping-ux.test.mjs
package.json
PAYMENT_UX_REPORT.md                               (new)
```

## Validation and limitations

Local validation: TypeScript; payment-client/presentation tests (31); shopping/store
tests (18); payment foundation/environment tests (26); legacy order endpoint test
(1); the Firestore demo emulator authorization, reservation/concurrency, duplicate
event, fulfilment and shopping tests; production build; and Git whitespace checks.

Tests cover SDK progress/timeouts, verification progress/timeouts, cancellation,
failure cleanup, delayed capture, stale evidence, duplicate events, fulfilment
eligibility, old unpaid records, refund/revenue presentation, consistent customer/
admin labels, listener-backed details, CSV safety, skeletons, reduced-motion CSS,
loader timer cleanup, and failed/stale profile saves.

Browser control reported no available browsers. Desktop/mobile visual testing,
real Razorpay-hosted modal opening and deployed webhook delivery were **not**
verified. The JavaScript large-chunk warning remains. Longer-running Firestore
save operations can still depend on connectivity; navigation remains available.

No credentials, Vercel settings, Production data or prices changed. No commit,
push or deployment occurred. The subsequent Production-only validator correction supersedes the earlier
four-pin/Test-project deployment prerequisite. Before a separately authorized
deployment, verify the two Production Firebase pins and existing LIVE credentials
using PAYMENT_ENVIRONMENTS.md. Connected Preview/Development remains unavailable
until a separate safe environment exists. Desktop/mobile hosted QA is outstanding. Live capture matching still requires separate
read-only provider/order evidence; do not mark the INR 1,350 order paid based on
the INR 1 dashboard screenshot.
