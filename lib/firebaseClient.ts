// lib/firebaseClient.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

/**
 * Initialize or return the client-side Firebase App.
 * MUST be called only in the browser.
 */
export function initFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('initFirebaseApp must be called from the browser');
  }

  if (!_app) {
    if (!getApps().length) {
      initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
    }
    _app = getApp();
  }

  return _app;
}

/**
 * Return a cached Auth instance (initializes the app first if needed).
 */
export function getFirebaseAuth(): Auth {
  if (typeof window === 'undefined') {
    throw new Error('getFirebaseAuth must be called from the browser');
  }
  if (!_auth) {
    const app = initFirebaseApp();
    _auth = getAuth(app);
  }
  return _auth;
}
