// lib/admin-auth.ts
// Admin authentication using environment variables with HMAC-signed tokens

import crypto from 'crypto';

const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
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

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUser = ADMIN_CREDENTIALS.username;
  const expectedPass = ADMIN_CREDENTIALS.password;
  if (username.length !== expectedUser.length || password.length !== expectedPass.length) {
    return false;
  }
  const userMatch = crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser));
  const passMatch = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass));
  return userMatch && passMatch;
}

export function generateAdminToken(username: string): string {
  const payload = JSON.stringify({
    username,
    timestamp: Date.now(),
    role: 'admin',
  });
  const signature = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64');
}

export function verifyAdminToken(token: string): { valid: boolean; username?: string } {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return { valid: false };

    const payload = decoded.slice(0, lastDot);
    const signature = decoded.slice(lastDot + 1);
    const expected = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payload).digest('hex');

    if (expected.length !== signature.length) return { valid: false };
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return { valid: false };
    }

    const data = JSON.parse(payload);
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - data.timestamp > maxAge) {
      return { valid: false };
    }

    if (data.role === 'admin' && data.username === ADMIN_CREDENTIALS.username) {
      return { valid: true, username: data.username };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}
