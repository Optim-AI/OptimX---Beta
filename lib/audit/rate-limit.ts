import { createHash } from 'crypto';
import type { NextApiRequest } from 'next';

export const AUDIT_LIMITS = {
  perActorHour: 5,
  perActorDay: 15,
  perIpHour: 10,
  perIpDay: 30,
} as const;

export type AuditCounts = {
  actorHour: number;
  actorDay: number;
  ipHour: number;
  ipDay: number;
};

export type RateDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number; reason: string };

export function decideAuditRateLimit(counts: AuditCounts, limits = AUDIT_LIMITS): RateDecision {
  if (counts.actorHour >= limits.perActorHour || counts.ipHour >= limits.perIpHour) {
    return { allowed: false, retryAfterSeconds: 3600, reason: 'hourly_limit' };
  }
  if (counts.actorDay >= limits.perActorDay || counts.ipDay >= limits.perIpDay) {
    return { allowed: false, retryAfterSeconds: 86_400, reason: 'daily_limit' };
  }
  return { allowed: true };
}

export function getClientIp(req: Pick<NextApiRequest, 'headers' | 'socket'>): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  const real = req.headers['x-real-ip'];
  return first || (Array.isArray(real) ? real[0] : real) || req.socket?.remoteAddress || 'unknown';
}

export function hashClientIp(ip: string): string {
  const salt = process.env.AUDIT_IP_SALT || process.env.SUPABASE_JWT_SECRET || 'skalx-audit';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}
