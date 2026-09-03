// Super-admin identity. Standalone so both routes_admin.js (isSuperAdmin(req),
// session-based) and the delegate/manage plumbing in server.js / routes_delegate.js
// / routes_overlay_page.js (isSuperAdminId(id), no request object) share one
// source of truth for who the operators are.
export const SUPER_ADMIN_IDS = (process.env.SUPER_ADMIN_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isSuperAdminId(userId) {
  if (userId === null || userId === undefined || userId === "") return false;
  if (SUPER_ADMIN_IDS.length === 0) return false;
  return SUPER_ADMIN_IDS.includes(String(userId));
}
