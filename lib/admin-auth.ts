// lib/admin-auth.ts
// Simple admin authentication using environment variables

function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  // In production, require explicit ADMIN_PASSWORD to avoid default credentials
  if (process.env.NODE_ENV === 'production' && (!password || password === 'admin123')) {
    throw new Error('ADMIN_PASSWORD must be set to a secure value in production');
  }
  return {
    username,
    password: password || 'admin123',
  };
}

export const ADMIN_CREDENTIALS = {
  get username() {
    return getAdminCredentials().username;
  },
  get password() {
    return getAdminCredentials().password;
  },
};

/**
 * Verify admin credentials
 */
export function verifyAdminCredentials(username: string, password: string): boolean {
  return username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;
}

/**
 * Generate admin session token (simple base64 encoding)
 * In production, use proper JWT or session management
 */
export function generateAdminToken(username: string): string {
  const data = JSON.stringify({
    username,
    timestamp: Date.now(),
    role: 'admin',
  });
  return Buffer.from(data).toString('base64');
}

/**
 * Verify admin session token
 */
export function verifyAdminToken(token: string): { valid: boolean; username?: string } {
  try {
    const data = JSON.parse(Buffer.from(token, 'base64').toString());

    // Check if token is valid (less than 24 hours old)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - data.timestamp > maxAge) {
      return { valid: false };
    }

    // Check if it's an admin token
    if (data.role === 'admin' && data.username === ADMIN_CREDENTIALS.username) {
      return { valid: true, username: data.username };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}
