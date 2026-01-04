// pages/api/test-db.ts
// Test endpoint to verify database connection
import type { NextApiRequest, NextApiResponse } from "next";
import { OAuthSessionDAO } from '@/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('=== DATABASE CONNECTION TEST ===');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('DATABASE_URL value:', process.env.DATABASE_URL?.substring(0, 30) + '...');

    // Test storing a session
    const testSessionId = `test_${Date.now()}`;
    const testUserId = 'test-user-123';
    const testData = {
      userAccessToken: 'test-token',
      pages: [{ id: '123', name: 'Test Page', access_token: 'test' }],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    console.log('Attempting to store session:', testSessionId);

    const stored = await OAuthSessionDAO.store(
      testSessionId,
      testUserId,
      'meta',
      testData,
      new Date(Date.now() + 10 * 60 * 1000)
    );

    console.log('Session stored successfully:', stored.id);

    // Retrieve it
    const retrieved = await OAuthSessionDAO.get(testSessionId);
    console.log('Session retrieved:', retrieved ? 'YES' : 'NO');

    // Delete it
    await OAuthSessionDAO.delete(testSessionId);
    console.log('Session deleted');

    return res.status(200).json({
      success: true,
      message: 'Database connection works!',
      stored: stored.id,
      retrieved: !!retrieved,
    });
  } catch (err: any) {
    console.error('=== DATABASE TEST FAILED ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);

    return res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack,
    });
  }
}
