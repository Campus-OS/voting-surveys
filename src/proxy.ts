import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Layer 1 Security Guard: Fast Edge Cookie Check.
 * Protects /admin routes by checking for the presence of the Better Auth session cookie.
 *
 * Note: Proxy only checks cookie existence. Layer 2 (requireAdmin in Server Components)
 * and Layer 3 (requireAdminApi in API routes) cryptographically verify the token and admin role.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    // Check for standard or secure Better Auth session token cookie
    const sessionCookie =
      request.cookies.get("better-auth.session_token") ||
      request.cookies.get("__Secure-better-auth.session_token");

    if (!sessionCookie || !sessionCookie.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};