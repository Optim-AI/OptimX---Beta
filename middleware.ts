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

function redirectWwwToPrimary(request: NextRequest): NextResponse | null {
  const hostHeader = request.headers.get("host") ?? "";
  const hostname = hostHeader.split(":")[0].toLowerCase();
  if (hostname !== WWW_HOST) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export function middleware(request: NextRequest) {
  const wwwRedirect = redirectWwwToPrimary(request);
  if (wwwRedirect) return wwwRedirect;

  const { pathname } = request.nextUrl;
  const caseTarget = CASE_CANONICAL[pathname];
  if (!caseTarget) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = caseTarget;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: [
    /*
     * Run on all routes except Next static assets and public files that must
     * not pass through case redirects. www→non-www still applies via vercel.json
     * for excluded paths; middleware covers HTML/API routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon-512.png|icon-192.png|icon-48.png|apple-touch-icon.png|images/|videos/).*)",
  ],
};
