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
      // Load Firebase config from environment variables
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

      if (!apiKey || !authDomain || !projectId || !appId) {
        throw new Error(
          'Missing Firebase configuration. Please check your environment variables:\n' +
          '- NEXT_PUBLIC_FIREBASE_API_KEY\n' +
          '- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN\n' +
          '- NEXT_PUBLIC_FIREBASE_PROJECT_ID\n' +
          '- NEXT_PUBLIC_FIREBASE_APP_ID'
        );
      }

      initializeApp({
        apiKey,
        authDomain,
        projectId,
        appId,
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
