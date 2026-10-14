import { NextResponse } from "next/server";

// Phase 0 scaffold. Role redirects belong to Phase 1 after login/refresh exist.
// Backend policies remain the source of truth for authorization.
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/staff/:path*", "/manager/:path*", "/admin/:path*"],
};
