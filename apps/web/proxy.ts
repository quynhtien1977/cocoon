import { NextResponse, type NextRequest } from "next/server";
import { getAccountRole, type AccountRole } from "./lib/auth/roles";

const portals: Record<string, AccountRole> = {
  account: "Customer", staff: "Staff", manager: "Manager", admin: "Admin",
};

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "");
  // This entry belongs to the public group even though its URL starts with /admin.
  if (pathname === "/admin/login") return NextResponse.next();
  const requiredRole = portals[pathname.split("/")[1]];
  if (!requiredRole) return NextResponse.next();

  const deny = () => {
    const url = request.nextUrl.clone();
    url.pathname = requiredRole === "Admin" ? "/admin/login" : "/login";
    url.search = "";
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };

  const token = request.cookies.get("access_token")?.value;
  if (!token) return deny();
  try {
    // The API validates the signed token, expiry and role. Never decode a JWT
    // without verifying it, or trust a caller-supplied role/user header.
    const base = process.env.API_URL ?? "http://localhost:5080";
    const response = await fetch(`${base.replace(/\/+$/, "")}/api/v1/me`, {
      headers: { Accept: "application/json", Cookie: `access_token=${encodeURIComponent(token)}` },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || getAccountRole(await response.json()) !== requiredRole) return deny();
    const allowed = NextResponse.next();
    allowed.headers.set("Cache-Control", "private, no-store");
    return allowed;
  } catch {
    // Unreachable API, timeout, malformed profile or missing configuration must
    // never expose a protected route. Do not log credentials or cache sessions.
    return deny();
  }
}

export const config = {
  matcher: ["/account/:path*", "/staff/:path*", "/manager/:path*", "/admin/:path*"],
};
