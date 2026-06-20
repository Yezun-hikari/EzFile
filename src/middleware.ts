import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("ezfile_session")?.value;
  const isAuthPage = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/setup");
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const isApiAdminRoute = request.nextUrl.pathname.startsWith("/api/admin");

  if (!token && (isAdminRoute || isApiAdminRoute)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/login", "/setup"],
};
