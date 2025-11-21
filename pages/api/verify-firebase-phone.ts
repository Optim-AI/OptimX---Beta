// // pages/api/verify-firebase-phone.ts
// import type { NextApiRequest, NextApiResponse } from 'next';
// import * as admin from 'firebase-admin';
// import { createClient } from '@supabase/supabase-js';

// type SuccessResp = { success: true; phone: string };
// type ErrResp = { error: string };

// function initFirebaseAdmin() {
//   if (!admin.apps.length) {
//     const base64 = 'ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAib3B0aW0tZmMxMTkiLAogICJwcml2YXRlX2tleV9pZCI6ICJmNjE4ZDYyNjkxMzU0YThjNTRhNzcxNDMzNTAzZWMwZjI3OWMwYTA4IiwKICAicHJpdmF0ZV9rZXkiOiAiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdmdJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLZ3dnZ1NrQWdFQUFvSUJBUUM0N0tnaXZTQUg2TzdzXG4xdjRYMk04cmlPK2p1QzBmQUJqLzlOMGlVNkRjQ21Pc2tZNEEwdzBrLzRUWjJMMDd5dnlkN3dHZjdPdjhYYkMzXG5lMXNZQmpkcE1KcGlrcjV6WFM2eWNjZldWTGpOVkw3NmZNVnpYYmk2ekNHZ1NJWWNWcGI2U01wemlpZmd3aTU2XG45WlJlVmNRMWlhYm9MYmNNMnhxTDdUMGtuNTZ3bXRpSWcybmJRTFNyTTIrR2R3TU9QVXoxcm4ybjVEOTI3S1lHXG5GRWttcTNvVE5hMkdkQmoxV0hSbGRySmoyR0JpaUNGV1dLU2JhcFM5QWFTbmI1ZWtLS1dxNjZqT1A0RUFPNzlvXG5YTTNkNHhkSlJHWDlGQitxOEtEZmN5Q1NtOHpWbWtPaFpmZ3BIOEJzWitmV0JKSW4vQ3JMT0QvajZ0R3JTeFFFXG5TQzhmR1ZaSEFnTUJBQUVDZ2dFQUpYZGRRVnlNQnM0OHlpTnM2NnZ6bldCckhRS05zY0ExVUhadDd5eCtaTlorXG5CMUtlTUxDUjh6TUoyWkUrRmNVMGxWTDlRMGVmTUV4VEozbUlwVDl0THBTNFVzeGtaYjgxWE5ZTXBQSVpWeENhXG5lT21hbjVzWGVGRXZadWdLcytjZlE2cEh5a3p0YzI0a09LbFUzQ0FJVnNpQzFudWNvTEFybXJvQUwxRmZ0MnZ1XG51aFowN0N0dDlVUzVlVVMwNzJOYjYvdEhMV1dhUkx4eFpvcEdjSjBHZDJ0YlVjaExUZTAyZjZZeW0yKzZiU1RMXG56Y2YxRDZHb0d2UGR4ZTVOWE1zdzZnemtDMFBxS1oxdm5TVlB3STZWQmU1d20yMmkxQXBsNVVLZGZYRm05Nk82XG5tVzBwZitsMVk1WHE2SU8xcHRlVkczc2tJZnBpYWlrZ1V3dnUrS3Fvd1FLQmdRRCsxaEY5eCt6RjVUalFHN3RTXG40aHpvT3RLM2ZTdEduZkFIY2k5RHVlbFdlQnd4TFpVVkRNVE1mSGNmYXZleE1uQXFzV0gvVlRjWkN4amk5VFF6XG5wVUd4NHVDNmRlV1RyNnUyY3ZKekhXc2VmZ1BmZ2hSMHJDbGtna0VhMS90ZFFvZTdnM1VGbFhUaXZybEpXY2MzXG5mZ1ZXSEZPVHdxOWY4VXZMQ2lCZWdJUmZjUUtCZ1FDNXhOcVgyU3dzdzdEWDFKT3lqNjdQRjFkQ2JzMzBoYmpVXG5DcUNPNmFvaVNVZFJ3VUsxNWJhZkkvRjB5V2RnakJNQ2JzQ3ZFNDdXUXIyL2ltL0V6SDVZTk5NRVpnQ1lMdWhRXG5VbkZreDZ4RWNGWitnRWJZUlZ1bmtVZTNtdk9qOVIzNnU4OS9pQlM2QjJMVzBDeEUxQXhGYVlUYnNQbFlSRFNHXG44Slp4ZXZXbE53S0JnUUNRMUJ4d3ZiVEU2M2NVWHc1aEZueVRSd3NHbVM2RkhiR1NxY1JPMjFQUGZzZVc4MjdzXG4zYXJqQkVHM0sxWEY4UUpxWVJGdXlZRmN6RC9Dak5TMEhWRnV4YUF1bUY1M1JybHlJWFhGRW8wVWNVM0dNdWxwXG5QWWJ3eGs0MThWVzhOTmxyS2xUUmJaVldZRXB4YzRLUytSNFRTRm4vZWYrdHFUY0lGNk01MGhScElRS0JnUUMwXG5PTUpJNXF2d2tia1M2bXlQb3MxWW83QklCdTlQOWhzbHUxbWd6QmYrUTFFcGczQ1F2MWE0ZFVwZW5yWG4rSHpJXG5zMkhEZUJudXk3a0NCZkFBNE5NQ0I5MWdPd1VBbnlGS0szRk84RmV6M2JoTDZXN1JpaGd0TE1pQzI1VGF6NFpTXG5KYnBjWTB5WVhXb0tOTk45d3FwVS9OV2p2TUZxWEdFSk9JYjdlT3F2YVFLQmdCZDJPUFVYT01XUXFpMkU0aUFVXG5uckRKbGVjNFRLMncvOTdyWWlseGdOMmRCdWxvRkhaVnRUM2NCYThGYW4zU0k0NUdORXAzQWZ4d280dmFaL1JPXG5hRjNDVmRwT0dSa21tSEs5cmd5YkM0WUxDQlJRckVDQXErdWZrRWJaalU2V3ZXa0ZtblNvZytMRHl5elh0ZkNpXG56UGtBNDRLTWVRL2ZhZlBpeHBSSm5DdXZcbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsCiAgImNsaWVudF9lbWFpbCI6ICJmaXJlYmFzZS1hZG1pbnNkay1mYnN2Y0BvcHRpbS1mYzExOS5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMDM1OTc2NDI2OTExMDE4MzEyODYiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2ZpcmViYXNlLWFkbWluc2RrLWZic3ZjJTQwb3B0aW0tZmMxMTkuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K';
//     if (!base64) {
//       throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 env var');
//     }
//     const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
//     admin.initializeApp({
//       credential: admin.credential.cert(json as admin.ServiceAccount),
//     });
//   }
//   return admin;
// }

// const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
//   console.warn('Supabase URL or service role key missing - verify-firebase-phone may fail.');
// }

// const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// export default async function handler(req: NextApiRequest, res: NextApiResponse<SuccessResp | ErrResp>) {
//   if (req.method !== 'POST') {
//     res.setHeader('Allow', 'POST');
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   try {
//     const { idToken, target } = req.body as { idToken?: string; target?: 'phone' | 'business' };

//     if (!idToken) return res.status(400).json({ error: 'Missing idToken' });
//     if (!target || (target !== 'phone' && target !== 'business')) {
//       return res.status(400).json({ error: 'Missing or invalid target (phone|business)' });
//     }

//     // Validate Supabase session token from Authorization header
//     const authHeader = req.headers.authorization || '';
//     const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
//     if (!accessToken) return res.status(401).json({ error: 'Missing Supabase access token' });

//     // Get Supabase user from access token
//     const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
//     if (userErr || !userData?.user) {
//       return res.status(401).json({ error: 'Invalid Supabase session token' });
//     }
//     const supabaseUser = userData.user;

//     // Verify Firebase ID token using firebase-admin
//     initFirebaseAdmin();
//     const decoded = await admin.auth().verifyIdToken(idToken);
//     let phoneNumber = decoded.phone_number || null;

//     // If phone_number isn't on the token, fetch user record
//     if (!phoneNumber && decoded.uid) {
//       const rec = await admin.auth().getUser(decoded.uid);
//       phoneNumber = rec.phoneNumber || null;
//     }

//     if (!phoneNumber) return res.status(400).json({ error: 'No phone number present in Firebase token' });

//     // Build update payload
//     const updates: Record<string, any> = { id: supabaseUser.id };
//     if (target === 'phone') {
//       updates.phone = phoneNumber;
//       updates.phone_verified = true;
//     } else {
//       updates.business_mobile = phoneNumber;
//       updates.business_mobile_verified = true;
//     }

//     const { error: upErr } = await supabaseAdmin.from('profiles').upsert(updates, { onConflict: 'id' });
//     if (upErr) {
//       console.error('Supabase upsert error', upErr);
//       return res.status(500).json({ error: 'Failed to update profile' });
//     }

//     return res.status(200).json({ success: true, phone: phoneNumber });
//   } catch (err: any) {
//     console.error('verify-firebase-phone error', err);
//     const msg = err?.message || String(err) || 'Server error';
//     return res.status(500).json({ error: msg });
//   }
// }
