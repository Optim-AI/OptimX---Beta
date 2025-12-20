// pages/api/verify-firebase-phone.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { initFirebaseAdmin } from '../../lib/firebaseAdmin';

type SuccessResp = { success: true; phone: string };
type ErrResp = { error: string };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.warn('Supabase URL or service role key missing - verify-firebase-phone may fail.');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

export default async function handler(req: NextApiRequest, res: NextApiResponse<SuccessResp | ErrResp>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { idToken, target } = req.body as { idToken?: string; target?: 'phone' | 'business' };

    if (!idToken) return res.status(400).json({ error: 'Missing idToken' });
    if (!target || (target !== 'phone' && target !== 'business')) {
      return res.status(400).json({ error: 'Missing or invalid target (phone|business)' });
    }

    // Validate Supabase session token from Authorization header
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!accessToken) return res.status(401).json({ error: 'Missing Supabase access token' });

    // Get Supabase user from access token
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Invalid Supabase session token' });
    }
    const supabaseUser = userData.user;

    // Verify Firebase ID token using firebase-admin
    initFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    let phoneNumber = decoded.phone_number || null;

    // If phone_number isn't on the token, fetch user record
    if (!phoneNumber && decoded.uid) {
      const rec = await admin.auth().getUser(decoded.uid);
      phoneNumber = rec.phoneNumber || null;
    }

    if (!phoneNumber) return res.status(400).json({ error: 'No phone number present in Firebase token' });

    // Build update payload
    const updates: Record<string, any> = { id: supabaseUser.id };
    if (target === 'phone') {
      updates.phone = phoneNumber;
      updates.phone_verified = true;
    } else {
      updates.business_mobile = phoneNumber;
      updates.business_mobile_verified = true;
    }

    const { error: upErr } = await supabaseAdmin.from('profiles').upsert(updates, { onConflict: 'id' });
    if (upErr) {
      console.error('Supabase upsert error', upErr);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    return res.status(200).json({ success: true, phone: phoneNumber });
  } catch (err: any) {
    console.error('verify-firebase-phone error', err);
    const msg = err?.message || String(err) || 'Server error';
    return res.status(500).json({ error: msg });
  }
}
