import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2);
const valueFor = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const email = valueFor('--email');
const uid = valueFor('--uid');
const revoke = args.includes('--revoke');

if ((email && uid) || (!email && !uid)) {
  console.error('Usage: npm run admin:grant -- --email admin@example.com');
  console.error('   or: npm run admin:grant -- --uid FIREBASE_AUTH_UID');
  console.error('Revoke: npm run admin:revoke -- --email admin@example.com');
  process.exit(1);
}

// The service-account file is deliberately supplied by an environment variable
// outside this repository. Never put its JSON or private key in frontend code.
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is required and must point to a Firebase service-account JSON file outside this repository.');
  process.exit(1);
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'boutique-79308';
const app = getApps().length ? getApps()[0] : initializeApp({
  credential: applicationDefault(),
  projectId
});
const auth = getAuth(app);
const user = email ? await auth.getUserByEmail(email.trim()) : await auth.getUser(uid);

await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: !revoke });
console.log(`${revoke ? 'Removed' : 'Assigned'} admin: ${!revoke} for ${user.email || user.uid} (${user.uid}).`);
console.log('The user must sign out and sign back in (or force-refresh their ID token) before the Admin Panel and Firestore Rules see the new claim.');
