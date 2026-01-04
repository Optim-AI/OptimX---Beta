// pages/api/verify-firebase-phone.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { supabaseAdmin } from '@/auth/supabase/admin';
import { initFirebaseAdmin } from '@/auth/firebase/admin';
import { ProfileDAO } from '@/database';

type SuccessResp = { success: true; phone: string };
type ErrResp = { error: string };

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

    // Build update payload for profile
    const profileData: Record<string, any> = {};
    if (target === 'phone') {
      profileData.phone = phoneNumber;
      profileData.phone_verified = true;
    } else {
      profileData.business_mobile = phoneNumber;
      profileData.business_mobile_verified = true;
    }

    // Update profile using Prisma DAO
    try {
      await ProfileDAO.upsert(supabaseUser.id, profileData);
    } catch (upErr) {
      console.error('Profile upsert error', upErr);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    return res.status(200).json({ success: true, phone: phoneNumber });
  } catch (err: any) {
    console.error('verify-firebase-phone error', err);
    const msg = err?.message || String(err) || 'Server error';
    return res.status(500).json({ error: msg });
  }
}
