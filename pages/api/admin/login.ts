// pages/api/admin/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminCredentials, generateAdminToken } from '@/lib/admin-auth';

/**
 * POST /api/admin/login
 * Admin login endpoint
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Verify credentials
    if (!verifyAdminCredentials(username, password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateAdminToken(username);

    return res.status(200).json({
      success: true,
      token,
      username,
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      error: 'Login failed',
      message: error.message,
    });
  }
}
