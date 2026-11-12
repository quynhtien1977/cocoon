import { NextResponse, type NextRequest } from "next/server";
import { getAccountRole, type AccountRole } from "./lib/auth/roles";

const portals: Record<string, AccountRole> = {
  account: "Customer", staff: "Staff", manager: "Manager", admin: "Admin",
};

const apiBase = () => (process.env.API_URL ?? "http://localhost:5080").replace(/\/+$/, "");

const callApi = (path: string, cookie: string, method = "GET") => fetch(`${apiBase()}/api/v1${path}`, {
  method,
  headers: { Accept: "application/json", Cookie: cookie },
  cache: "no-store",
  redirect: "manual",
  signal: AbortSignal.timeout(5000),
});

/** The API validates the signed token, expiry and role; the proxy never decodes a JWT or trusts caller-supplied headers. */
async function roleOf(accessToken: string): Promise<AccountRole | null | "expired"> {
  const response = await callApi("/me", `access_token=${encodeURIComponent(accessToken)}`);
  if (response.status === 401) return "expired";
  return response.ok ? getAccountRole(await response.json()) : null;
}

/** Reads the new access token from the API's Set-Cookie headers after a refresh. */
function accessTokenIn(setCookies: string[]): string | null {
  for (const header of setCookies) {
    const match = /^access_token=([^;]+)/.exec(header);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "");
  // This entry belongs to the public group even though its URL starts with /admin.
  if (pathname === "/admin/login") return NextResponse.next();
  const requiredRole = portals[pathname.split("/")[1]];
  if (!requiredRole) return NextResponse.next();

  // Cookies the API set during a refresh (new pair, or deletions when it failed) go back to the browser either way.
  const finish = (allowed: boolean, setCookies: string[] = []) => {
    let response: NextResponse;
    if (allowed) response = NextResponse.next();
    else {
      const url = request.nextUrl.clone();
      url.pathname = requiredRole === "Admin" ? "/admin/login" : "/login";
      url.search = "";
      response = NextResponse.redirect(url);
    }
    for (const header of setCookies) response.headers.append("Set-Cookie", header);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };

  try {
    const access = request.cookies.get("access_token")?.value;
    if (access) {
      const role = await roleOf(access);
      if (role !== "expired") return finish(role === requiredRole);
    }

    // The access cookie lives 15 minutes; without this step a reload or a menu click after that sends a signed-in
    // user to /login although the 7-day refresh token is still valid. Renew it here, as API calls already do.
    const refresh = request.cookies.get("refresh_token")?.value;
    if (!refresh) return finish(false);
    const renewed = await callApi("/auth/refresh", `refresh_token=${encodeURIComponent(refresh)}`, "POST");
    const setCookies = renewed.headers.getSetCookie();
    const renewedAccess = renewed.status === 204 ? accessTokenIn(setCookies) : null;
    if (!renewedAccess) return finish(false, setCookies);
    return finish(await roleOf(renewedAccess) === requiredRole, setCookies);
  } catch {
    // Unreachable API, timeout, malformed profile or missing configuration must
    // never expose a protected route. Do not log credentials or cache sessions.
    return finish(false);
  }
}

export const config = {
  matcher: ["/account/:path*", "/staff/:path*", "/manager/:path*", "/admin/:path*"],
};
