export type AccountRole = "Admin" | "Manager" | "Staff" | "Customer";

export function getAccountRole(profile: unknown): AccountRole | null {
  if (!profile || typeof profile !== "object" || !("role" in profile)) return null;
  const roles: AccountRole[] = ["Admin", "Manager", "Staff", "Customer"];
  const role = profile.role;
  if (typeof role === "number") return roles[role] ?? null;
  if (typeof role === "string") return roles.find((name) => name.toLowerCase() === role.toLowerCase()) ?? null;
  return null;
}
