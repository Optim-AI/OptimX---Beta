/** Server-side validation for free-trial access requests. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 120;
const MAX_COMPANY = 160;
const MAX_USE_CASE = 2000;
const MAX_WEBSITE = 300;

export type TrialRequestInput = {
  fullName: string;
  email: string;
  companyName: string;
  useCase: string;
  websiteUrl?: string | null;
};

export type TrialRequestValidated = {
  fullName: string;
  email: string;
  companyName: string;
  useCase: string;
  websiteUrl: string | null;
};

export type TrialValidationResult =
  | { ok: true; value: TrialRequestValidated }
  | { ok: false; error: string; field?: string };

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWebsite(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  if (!raw) return { ok: true, url: '' };
  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, error: 'Website must be an http(s) URL.' };
    }
    if (!u.hostname.includes('.')) {
      return { ok: false, error: 'Enter a valid website address.' };
    }
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, error: 'Enter a valid website address.' };
  }
}

export function validateTrialRequest(body: unknown): TrialValidationResult {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const fullName = trim(raw.fullName ?? raw.full_name);
  const email = trim(raw.email).toLowerCase();
  const companyName = trim(raw.companyName ?? raw.company_name);
  const useCase = trim(raw.useCase ?? raw.use_case);
  const websiteRaw = trim(raw.websiteUrl ?? raw.website_url ?? raw.website);

  if (!fullName) return { ok: false, field: 'fullName', error: 'Full name is required.' };
  if (fullName.length > MAX_NAME) {
    return { ok: false, field: 'fullName', error: 'Full name is too long.' };
  }
  if (!email) return { ok: false, field: 'email', error: 'Email is required.' };
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, field: 'email', error: 'Enter a valid email address.' };
  }
  if (!companyName) {
    return { ok: false, field: 'companyName', error: 'Company or brand name is required.' };
  }
  if (companyName.length > MAX_COMPANY) {
    return { ok: false, field: 'companyName', error: 'Company name is too long.' };
  }
  if (!useCase) {
    return { ok: false, field: 'useCase', error: 'Tell us why you want trial access.' };
  }
  if (useCase.length > MAX_USE_CASE) {
    return { ok: false, field: 'useCase', error: 'Use case is too long.' };
  }
  if (websiteRaw.length > MAX_WEBSITE) {
    return { ok: false, field: 'websiteUrl', error: 'Website URL is too long.' };
  }
  const site = normalizeWebsite(websiteRaw);
  if (!site.ok) return { ok: false, field: 'websiteUrl', error: site.error };

  return {
    ok: true,
    value: {
      fullName,
      email,
      companyName,
      useCase,
      websiteUrl: site.url || null,
    },
  };
}

/** Public card copy — not a billable MarketingPlanId. */
export const FREE_TRIAL_CARD = {
  name: 'Free Trial',
  priceLabel: 'Free',
  description: 'For businesses exploring SkalX',
  supporting: 'Get a guided trial of SkalX AI',
  features: [
    'AI posters and ad creatives',
    'AI video generation',
    'Brand intelligence',
    'Campaign planning tools',
    'Access subject to approval',
  ] as const,
  cta: 'Request Free Trial',
  note: 'Trial access is granted after review.',
} as const;
