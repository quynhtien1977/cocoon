import { apiRequest } from "../../lib/api/client";

export async function logout(): Promise<void> {
  await apiRequest<void>("/auth/logout", { method: "POST", refresh: false, signal: AbortSignal.timeout(12000) });
  // A full navigation discards client-side account data and the router cache.
  window.location.replace("/");
}
