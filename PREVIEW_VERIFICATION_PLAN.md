> SUPERSEDED by the owner's final infrastructure decision. Do not execute the setup or deployment instructions below. No additional Firebase project, Razorpay Test credentials, Preview environment, or new environment variables are required for the Wishlist/Cart release. Use WISHLIST_CART_REPORT.md for the current Production release plan. This historical proposal is excluded from the release commit.

# AB Collections: isolated Preview setup and verification

Prepared 12 October 2026. Status: **Preview deployment blocked pending isolated configuration and owner approval.**

## Verified hosted configuration

Read-only authenticated Vercel inspection identified:

- Team: `boutique8`; current plan: `hobby`.
- Existing project: `boutique`, ID `prj_9te4T4gDJPTFRKukJaMgUHjwy3Ce`.
- GitHub: `boutiquemiyapur/boutique`; Production branch: `main`.
- Framework: Vite; Node: `24.x`; no custom build/install/root/output override was returned.
- Eight Firebase client variables are assigned to BOTH Preview and Production: `VITE_FIREBASE_ENABLED`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_FIREBASE_ENABLE_ANONYMOUS_AUTH`.
- No branch overrides or shared variable attachments were returned.
- Preview has no Test identity pins, no Production comparison pins, no Firebase Admin credentials, no Razorpay credentials, no reconciliation secret, and no runtime option.
- Vercel Authentication protects Preview (`all_except_custom_domains`). No automation bypass was configured.
- This checkout is not locally linked: `.vercel/project.json` is absent. Existing CLI login is available.

**Conclusion: the existing Preview configuration does not contain an isolated TEST Firebase/Razorpay environment.** The Firebase client settings share the very same environment-variable records with Production; they are not independent Test settings. Actual credential values were neither decrypted nor displayed. No Firebase database or Razorpay endpoint was contacted. The current source's isolation guards will reject an incompletely configured hosted Preview; do not remove those guards to make the build pass.

No hosted configuration, credentials, Firebase records, account permissions, webhook, schedule, branch, commit, push, or deployment was changed by this inspection. This document is the only new preparation artifact.

## Minimal setup and cost

Reuse the existing Vercel project. Configure one dedicated Preview branch association, `preview-wishlist-cart`, rather than creating another hosting project or changing the Production branch.

Reuse an existing genuinely isolated Firebase Test project if you already own one; otherwise create one new Firebase project, for example `ab-collections-test-<unique-suffix>`. Keep its Auth users, default Firestore database, IAM/service account, and synthetic products/orders separate from Production. Do not clone customer data or reuse a Production Admin service account.

For Wishlist/Cart/payment verification, Firebase Spark plus Email/Password Auth and one default Firestore database is sufficient within its free quotas. Current Firestore free usage includes 50,000 reads and 20,000 writes per day; keep fixtures and repeated listener tests small. No Firebase Hosting, Firebase Functions, extra database, analytics, paid backup, or new domain is needed. [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Firestore free quota](https://firebase.google.com/docs/firestore/pricing).

The source initializes a Firebase Storage client but has no Storage reads/uploads elsewhere. Storage is therefore outside this verification scope. The existing validator still requires the Test namespace in the bucket configuration field; use `<TEST_PROJECT_ID>.firebasestorage.app` for that unused namespace, and do not claim a bucket has been provisioned. Do not enable or test Firebase Storage uploads on Spark. Actual Cloud Storage provisioning/access now requires Blaze; choose that only if separately testing Storage, with budget alerts. Product pictures for this scope can be neutral/local test assets; Cloudinary upload credentials can remain absent. [Firebase Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

Use the existing Razorpay account's **Test mode**, with its separate `rzp_test_...` key pair. No real money is used and Test entities do not appear in Live mode. A separate merchant account is not necessary. [Razorpay Test and Live modes](https://razorpay.com/docs/payments/dashboard/test-live-modes/).

The current Vercel team is Hobby. Vercel restricts Hobby to non-commercial personal usage; do not assume commercial boutique hosting/testing is eligible for free Hobby use. Resolve the existing team's plan eligibility with Vercel or select Pro before business deployment. Check the current applicable price/usage allowance with the owner; no upgrade or billing change was made. [Vercel fair-use policy](https://vercel.com/docs/limits/fair-use-guidelines), [current pricing](https://vercel.com/pricing).

## Exactly what to configure

In Vercel project `boutique` > Settings > Environment Variables, add **Preview-only, branch-specific entries for `preview-wishlist-cart`**. Branch-specific entries override general Preview entries. Preserve all existing Production entries and their values. Do not bulk-import the Production environment or edit a shared Production/Preview value in place. Do not select Production when adding these values. [Vercel Preview variable scoping](https://vercel.com/docs/environment-variables).

All angle-bracket values below are placeholders to obtain privately from the owner's consoles, not literal values to paste.

| Variable | Required Preview value | Source / purpose |
| --- | --- | --- |
| `FIREBASE_PRODUCTION_PROJECT_ID` | Existing Production project ID | Comparison pin only; no connection to Production |
| `FIREBASE_PRODUCTION_WEB_API_KEY` | Existing Production public web-app API key | Comparison pin only; never used as the Test client key |
| `FIREBASE_TEST_PROJECT_ID` | `<TEST_PROJECT_ID>`, distinct from Production | Firebase Test project settings |
| `FIREBASE_TEST_WEB_API_KEY` | `<TEST_WEB_API_KEY>`, distinct from Production | Firebase Test web-app configuration |
| `VITE_FIREBASE_ENABLED` | `true` | Enable only the isolated Test SDK |
| `VITE_FIREBASE_PROJECT_ID` | Same `<TEST_PROJECT_ID>` | Must match the Test pin |
| `VITE_FIREBASE_API_KEY` | Same `<TEST_WEB_API_KEY>` | Exact match; no pasted whitespace/literal quotes |
| `VITE_FIREBASE_AUTH_DOMAIN` | `<TEST_PROJECT_ID>.firebaseapp.com` | Existing guard requires this exact Test default |
| `VITE_FIREBASE_STORAGE_BUCKET` | `<TEST_PROJECT_ID>.firebasestorage.app` | Unused Test Storage namespace for this scope; never a Production bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Test web-app sender ID | Copy from the same Test web app |
| `VITE_FIREBASE_APP_ID` | Test web-app App ID | Must start with `1:<TEST_SENDER_ID>:web:` |
| `VITE_FIREBASE_ENABLE_ANONYMOUS_AUTH` | `false` | Customer shopping uses signed-in Email/Password users |
| `FIREBASE_ADMIN_PROJECT_ID` | Same `<TEST_PROJECT_ID>` | Server database/Auth target |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Test-only service-account email | Must end with `@<TEST_PROJECT_ID>.iam.gserviceaccount.com` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Matching Test service-account private key | Server-only sensitive variable; preserve PEM/newlines |
| `RAZORPAY_KEY_ID` | Test-mode key ID, matching `rzp_test_...` | Razorpay Dashboard with Test mode selected |
| `RAZORPAY_KEY_SECRET` | Matching Test-mode API secret | Server-only sensitive variable |
| `RAZORPAY_WEBHOOK_SECRET` | Independent Test webhook secret | Same secret configured on the Test webhook |
| `PAYMENTS_LIVE_ENABLED` | `false` | Explicitly reject Live mode for Preview |
| `CRON_SECRET` | Independent Test reconciliation secret | Do not reuse the Production scheduler secret |
| `NODE_OPTIONS` | `--experimental-require-module` | Existing Admin SDK/runtime compatibility setting |

The two Production **public identity pins** are required by the current code solely to prove the Test project/key differ. They do not authorize access to Production. All actual client and Admin connection settings must identify the Test project. Never copy Production Admin keys, LIVE Razorpay keys, or Production webhook/scheduler secrets into Preview.

Do not manually set `VERCEL_ENV`, `VERCEL`, or `VITE_FIREBASE_ENV_VALIDATED`. Vercel supplies its environment; Vite generates the validated flag. Do not set `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, or `FIREBASE_STORAGE_EMULATOR_HOST` for hosted Preview. Do not prefix Admin, payment, webhook, or scheduler secrets with `VITE_`.

`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are optional for this scope and currently Production-only. Leave them absent in Preview. If signed-upload regression is later included, use a separately isolated Test Cloudinary environment/account and assets; do not reuse production write credentials.

## Firebase Test project preparation

1. Register a Test web app and copy its config privately into the values above. Create one default **Standard Firestore** database. Enable Email/Password in Authentication; no phone/SMS provider is needed.
2. Create two synthetic customer accounts, A and B, and optionally a separate Test admin. Add the actual Preview hostname/branch hostname to **Test** Authentication > Settings > Authorized domains once the approved deployment URL is known. Do not add or change domains in Production Auth.
3. Create a service account restricted to the Test project, with Firestore data and Firebase Auth permissions needed by the existing Admin SDK. Ensure it has no Production-project IAM grants. Store its private key only as a server-side Vercel sensitive value. Actual key validity/IAM is verified through the Test API after deployment; metadata presence is not proof.
4. Deploy the existing repository's Firestore rules/indexes to the explicit Test project after Test setup approval. Do not run a generic deploy against the remembered/default Firebase project:

   ```powershell
   firebase deploy --project <TEST_PROJECT_ID> --only firestore:rules,firestore:indexes
   ```

5. Grant `admin: true` only to the Test admin if using the Admin panel. The repository's claim-grant script defaults to an existing Production project if `FIREBASE_ADMIN_PROJECT_ID` is omitted. Therefore set both the explicit Test project and the Test-only service-account file before invoking it:

   ```powershell
   $env:FIREBASE_ADMIN_PROJECT_ID = '<TEST_PROJECT_ID>'
   $env:GOOGLE_APPLICATION_CREDENTIALS = '<outside-repository-path-to-Test-service-account.json>'
   npm.cmd run admin:grant -- --uid <TEST_ADMIN_UID>
   ```

   Check the target/file privately first; do not execute this with a Production credential. Refresh the Test admin's login after granting the claim.

6. Seed only synthetic data. The essential server settings document is `/settings/admin` with `data: { checkoutCharges: [], lowStockThreshold: 3 }`. Add a Test category and normalized products in `/products/{id}` under `data`, using the existing Admin panel/product normalization. At minimum include an active simple product; an active product with Red/Blue and S/M combinations; an active out-of-stock variant; and hidden/archived products. Variant rows must have exact normalized keys and product `stockCount` equal to the sum of variant stock. Use one low-stock line for contention and enough stock for ordinary repeated tests.
7. Create Test wishlists for A with valid, hidden/archived, duplicate, and missing references, and a different list for B. All `/wishlists/{uid}` and `/carts/{uid}` records must belong to **Test Auth UIDs**, with matching `ownerId`. Seed legacy pending/paid compatibility fixtures in TEST only. Do not export production users, orders, wishlists, stock, private addresses, or customer contact data.

## Deployment sequence — only after explicit approval

The following are prospective commands, not actions performed by this task. No commit or push is required to deploy the reviewed local source through the CLI. Redeploying an old dashboard/Git revision would omit the uncommitted Wishlist/Cart helpers and fixes.

1. Confirm the settings table and branch association are complete and the Test-only rules/data are ready. Verify the commercial-use plan question is resolved. Record the existing Production deployment for reference without promoting/replacing it.
2. Link this checkout specifically to the existing project; do not create a new project:

   ```powershell
   Set-Location 'C:\Users\pavan\Downloads\ab-collection'
   vercel.cmd link --yes --team boutique8 --project boutique
   vercel.cmd env ls preview preview-wishlist-cart --scope boutique8
   ```

   Inspect `.vercel/project.json` privately: project ID must be `prj_9te4T4gDJPTFRKukJaMgUHjwy3Ce` and organization ID `team_KARsSrJWgFao1kNFBIxo1Aub`. Review the **effective branch** settings, not variable names alone: Test client/API-key pins/Admin target must agree and differ from the Production comparison pins, payment mode must be Test, and secrets must be non-empty. Do not print/download secret values into chat or source control.
3. Deploy the reviewed source once, explicitly selecting Preview and the same GitHub branch association:

   ```powershell
   vercel.cmd deploy --target=preview --scope boutique8 --meta githubDeployment=1 --meta githubCommitRef=preview-wishlist-cart
   ```

   This uploads current local source including new helpers/tests, and performs the hosted build with scoped variables. The metadata describes the branch; it does not create, check out, commit, or push a Git branch. Do not use `--prod`, promote, assign the Production domain, or run a redeploy of the old Production revision. Confirm deployment target **Preview** and the branch's effective variables/domain in Vercel. [Vercel source deployment and branch association](https://vercel.com/docs/cli/deploy).
4. Check the build's isolation validation and the deployed client configuration before signing in or loading test data. Verify the browser is configured for the Test project and Test API key; verify Admin APIs use the Test project. Preserve guard failures rather than bypassing them. The default local build from the earlier preflight was offline; it is not a configured Preview artifact.
5. Add the returned Preview hostname to Test Auth authorized domains. Choose a stable Preview/branch hostname for the Test webhook; if the hostname changes, update the Test webhook and Test Auth domain. Do not use `abcollectionbyaadya.in` as the Test webhook destination.

## Razorpay webhook and reconciliation

Vercel Authentication currently blocks unauthenticated external Preview requests. Keep that protection enabled. The owner must configure an authorized **Protection Bypass for Automation**, which is not currently present. Configure the Test webhook privately to:

```text
https://<APPROVED_PREVIEW_HOST>/api/payments/webhook?x-vercel-protection-bypass=<PRIVATE_AUTOMATION_BYPASS>
```

Do not paste the populated URL/token into chat, source, screenshots, or documentation. For testing tools and reconciliation, prefer the bypass HTTP header. The bypass authenticates through Vercel's deployment protection; it does not replace the app's Firebase Auth or Razorpay raw-body signature verification. No protection was disabled or bypass token created by this preparation. [Vercel authorized automation access](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

In **Razorpay Test mode**, create a separate webhook, set the same Test `RAZORPAY_WEBHOOK_SECRET`, and subscribe to `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, and `refund.failed`. Confirm actual signed Test-event deliveries return timely 2xx responses; synthetic dashboard events without a matching internal Test order cannot prove capture/cleanup. Do not edit the LIVE webhook. [Razorpay webhook configuration](https://razorpay.com/docs/payments/dashboard/account-settings/webhooks).

For a short supervised Preview session, manually invoke `/api/payments/reconcile` at least once per minute while exercising pending/expiry behavior and once after a reservation has expired. This avoids a new scheduler subscription or project-wide cron change. The endpoint processes five due attempts per call; use few fixtures and monitor `processed`/`failed`.

```powershell
$previewBase = 'https://<APPROVED_PREVIEW_HOST>'
$previewHeaders = @{
  Authorization = "Bearer $env:AB_PREVIEW_CRON_SECRET"
  'x-vercel-protection-bypass' = $env:AB_PREVIEW_BYPASS_SECRET
}
Invoke-RestMethod -Method Get -Uri "$previewBase/api/payments/reconcile" -Headers $previewHeaders
```

Supply the Test secrets privately through local environment variables; never put `CRON_SECRET` in the URL. `vercel.json` currently creates no schedule. Hobby cron cannot provide minute cadence. For unattended verification, separately approve a TEST-only scheduler with Test destination and secrets; do not alter the Production scheduler. [Vercel cron limitations](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Verification and exit criteria

1. **Isolation first:** effective deployment target Preview, Firebase client/Auth/Admin all Test, key prefix Test, Live enablement false. No network request to Production Firebase and no LIVE Razorpay event. Any mismatch stops verification.
2. **Wishlist:** header/drawer/page/account count equals visible resolved products. Test slow catalog/private hydration, cache-only startup, offline/retry, hidden/archived/missing references, out-of-stock visibility, reactivation, refresh, and A/B switching. Raw references remain preserved except explicit removal; stale A callbacks cannot change B.
3. **Cart:** quantity total in both badges, exact-variant deduplication, distinct variants, 25-unit and 30-line limits, aggregate inventory restriction, remove/decrement, rapid clicks, refresh, and failed update feedback. Use two tabs/devices for one Test UID and verify both converge.
4. **Real TEST Firestore contention:** duplicate webhook/verification processing while retrying the same checkout and updating the cart from another tab. Require safe completed outcomes, one canonical order/provider mapping, one inventory consumption, and no unrecovered transaction errors. The prior emulator stress diagnostic had code 3 errors in both baseline/candidate; functional tests passed, but that does not approve real deployed contention.
5. **Razorpay Test outcomes:** dismissal, failed payment, pending/authorization, successful captured payment, and delayed signed capture. Unconfirmed outcomes retain Cart and never show false success. A real later captured payment is confirmed from the server, not from the earlier dismissal. Add a different item and increase the original line while payment is open; only the original purchased quantities disappear.
6. **Exactly once and compatibility:** replay Test capture notifications with same/distinct event identity; examine Test `/checkoutRequests/{id}.cartClearedAt`, canonical order, reservations/movements, and remaining cart. Confirm old paid orders cannot remove later selections, even without a cleanup receipt; old requests without a cart snapshot retain Cart. Exercise reservation expiry/reconciliation without restoring inventory twice.
7. **UI/API:** desktop/mobile signed-in views and scroll/drawers; API routes return JSON rather than SPA HTML; no server secrets appear in browser assets/logs. Test invalid webhook signature and foreign-UID access denial in TEST only. Existing uploaded/loaded old frontend sessions must reload; no Production tabs are used for this session.

Record Preview URL, source snapshot, Test Firebase project ID, environment-isolation pass/fail metadata, test outcome matrix, and Test order IDs; do not record secret values. Production stays NO-GO until these gates pass and separate approval is given. No Production credential, record repair, deployment, or promotion is part of this plan.

## Owner's next action

Create/reuse the isolated Firebase Test project and register its web app; obtain Test-only Admin credentials and Razorpay Test keys. Resolve the Vercel Hobby commercial-use eligibility/plan question. Enter the 21 branch-specific Preview variables above, then arrange authorized automation access for Test webhooks. Keep credential values in your consoles, not in chat.

Once configured, tell me only the **Test project ID**, that the **Preview branch settings are saved**, and whether you **approve a Preview deployment**. I can then recheck metadata/isolation before any authorized deployment. Setup confirmation by itself is not deployment approval.
