# Admin access setup

Miyapur Boutique authorizes administrators only from the Firebase Authentication custom claim `admin: true`. The browser does not read a Firestore `role` field to make that decision.

## Create and promote an administrator

1. Enable **Email/Password** in Firebase Console for `boutique-79308`.
2. Register the intended administrator through the Miyapur Boutique sign-up screen, or create the account in **Firebase Console → Authentication → Users**.
3. In **Project settings → Service accounts**, generate a new private key. Store its JSON outside this repository, for example `C:\Users\pavan\firebase-admin\boutique-service-account.json`. Do not commit, upload, or place it under `src/`.
4. In a new PowerShell session, set the key path and run the grant command:

   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\Users\pavan\firebase-admin\boutique-service-account.json'
   npm.cmd run admin:grant -- --email admin@example.com
   ```

   You can use a Firebase Auth UID instead:

   ```powershell
   npm.cmd run admin:grant -- --uid FIREBASE_AUTH_UID
   ```

5. Sign out of the boutique and sign back in with that account. Open **Admin Portal** from the footer or mobile menu. The app refreshes the ID token during the new sign-in and recognizes the claim.

To remove access:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\Users\pavan\firebase-admin\boutique-service-account.json'
npm.cmd run admin:revoke -- --email admin@example.com
```

## Test the boundary

- A normal registered customer should receive the “You do not have boutique administrator access” message at the Admin Portal.
- The promoted account should see the Admin Portal after sign-out/sign-in.
- Firestore Rules use `request.auth.token.admin == true`, so changing `users/{uid}.role` in Firestore does not grant access.

The script is a trusted developer workflow, not a public API. Do not deploy it as part of Vite and do not place service-account credentials in `.env`, browser code, or source control.
