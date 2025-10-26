// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

export function initFirebaseAdmin() {
  if (!getApps().length) {
    const jsonBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    let parsed: any = null;
    if (jsonRaw) {
      parsed = JSON.parse(jsonRaw);
    } else if (jsonBase64) {
      const decoded = Buffer.from(jsonBase64, 'base64').toString('utf8');
      parsed = JSON.parse(decoded);
    } else {
      throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON env var');
    }

    initializeApp({ credential: cert(parsed) });
  }
  return getAdminAuth();
}
