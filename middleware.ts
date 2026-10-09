import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CANONICAL_HOST, WWW_HOST } from "@/lib/seo/site";

/**
 * Exact-case redirects for public marketing routes.
 * next.config redirects on case-insensitive filesystems (macOS) can loop
 * because `/About` and `/about` collide; matching the raw pathname avoids that.
 */
const CASE_CANONICAL: Record<string, string> = {
  "/about": "/About",
  "/contact": "/Contact",
  "/careers": "/Careers",
};

const STATIC_ASSET_PREFIXES = [
  "/_next/static",
  "/_next/image",
  "/images/",
  "/videos/",
];

const STATIC_ASSET_EXACT = new Set([
  "/favicon.ico",
  "/icon-512.png",
  "/icon-192.png",
  "/icon-48.png",
  "/apple-touch-icon.png",
]);

function isStaticAssetPath(pathname: string): boolean {
  if (STATIC_ASSET_EXACT.has(pathname)) return true;
  return STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Permanent www → non-www. Prefer 308 so method/body are preserved.
 * Note: Vercel Domains UI redirects often emit 307 and run before app middleware;
 * dashboard must also be set to permanent (see completion report).
 */
function redirectWwwToPrimary(request: NextRequest): NextResponse | null {
  const hostHeader = request.headers.get("host") ?? "";
  const hostname = hostHeader.split(":")[0].toLowerCase();
  if (hostname !== WWW_HOST) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  // Preserve path + query; drop accidental www from constructed absolute URL.
  return NextResponse.redirect(url, 308);
}

export function middleware(request: NextRequest) {
  const wwwRedirect = redirectWwwToPrimary(request);
  if (wwwRedirect) return wwwRedirect;

  const { pathname } = request.nextUrl;
  if (isStaticAssetPath(pathname)) return NextResponse.next();

  const caseTarget = CASE_CANONICAL[pathname];
  if (!caseTarget) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = caseTarget;
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Run on all paths so www→apex applies even to favicon/static assets.
  // Static asset early-return skips only the case-canonical redirects.
  matcher: ["/:path*"],
};
