import {
  AuthError, User, browserLocalPersistence, browserSessionPersistence,
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  setPersistence, signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import { firebaseAuth } from './config';

export type AuthSession = { uid: string; email: string; displayName: string | null; isAdmin: boolean } | null;

/**
 * Custom claims are encoded in the Firebase ID token. A browser can retain an
 * earlier token for up to an hour, so admin authorization must always build a
 * session from a freshly refreshed token rather than a cached result.
 */
const sessionFromFreshToken = async (user: User, fallbackEmail = ''): Promise<NonNullable<AuthSession>> => {
  await user.getIdToken(true);
  const token = await user.getIdTokenResult();
  const session = {
    uid: user.uid,
    email: user.email || fallbackEmail,
    displayName: user.displayName,
    isAdmin: token.claims.admin === true
  };
  if (import.meta.env.DEV) {
    console.debug('[Firebase Auth] refreshed ID token claims', { uid: session.uid, isAdmin: session.isAdmin });
  }
  return session;
};

export const startAuthSession = (onSession: (session: AuthSession) => void) => {
  if (!firebaseAuth) { onSession(null); return () => undefined; }
  return onAuthStateChanged(firebaseAuth, async (user: User | null) => {
    if (!user) return onSession(null);
    try {
      const session = await sessionFromFreshToken(user);
      // Ignore an obsolete async result when the user changed during refresh.
      if (firebaseAuth.currentUser?.uid === user.uid) onSession(session);
    } catch (error) {
      console.error('Unable to refresh the Firebase ID token.', error);
      if (firebaseAuth.currentUser?.uid === user.uid) onSession({ uid: user.uid, email: user.email || '', displayName: user.displayName, isAdmin: false });
    }
  });
};

export const signInWithEmail = async (email: string, password: string, remember = true) => {
  if (!firebaseAuth) throw new Error('Firebase Authentication is not configured.');
  await setPersistence(firebaseAuth, remember ? browserLocalPersistence : browserSessionPersistence);
  const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  return sessionFromFreshToken(credential.user, email.trim());
};

export const registerWithEmail = async (email: string, password: string) => {
  if (!firebaseAuth) throw new Error('Firebase Authentication is not configured.');
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
  return { uid: credential.user.uid, email: credential.user.email || email.trim(), displayName: credential.user.displayName, isAdmin: false };
};

export const requestPasswordReset = async (email: string) => {
  if (!firebaseAuth) throw new Error('Firebase Authentication is not configured.');
  await sendPasswordResetEmail(firebaseAuth, email.trim());
};

export const logoutFirebaseUser = async () => { if (firebaseAuth) await signOut(firebaseAuth); };

export const authErrorMessage = (error: unknown) => {
  const code = (error as AuthError)?.code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-not-found': 'No account exists for that email address.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists for that email address.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/network-request-failed': 'A network error occurred. Please try again later.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.'
  };
  return messages[code] || (error instanceof Error ? error.message : 'Authentication could not be completed.');
};
