// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

export function initFirebaseAdmin() {
  if (!getApps().length) {
    // Load service account from environment variable
    const jsonBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    let parsed: any = null;

    if (jsonRaw) {
      // Direct JSON string (alternative format)
      parsed = JSON.parse(jsonRaw);
    } else if (jsonBase64) {
      // Base64-encoded JSON (preferred format for environment variables)
      const decoded = Buffer.from(jsonBase64, 'base64').toString('utf8');
      parsed = JSON.parse(decoded);
    } else {
      throw new Error(
        'Missing Firebase Admin configuration. Please set one of:\n' +
        '- FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 (base64 encoded service account)\n' +
        '- FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string)\n\n' +
        'To generate base64: cat service-account.json | base64'
      );
    }

    initializeApp({ credential: cert(parsed) });
  }
  return getAdminAuth();
}
