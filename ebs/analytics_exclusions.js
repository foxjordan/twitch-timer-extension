// Channel IDs to exclude from the Admin > Analytics dashboard (feature usage,
// setup funnel, Bits totals, and the per-streamer breakdown table). These are
// our own dev/test accounts — leaving them in skews aggregate numbers meant
// to reflect real broadcaster behavior. A fixed product decision, not a
// per-environment secret (unlike SUPER_ADMIN_IDS), so it's hardcoded rather
// than read from an env var.
//
// Excluding a channel here only affects aggregate/list queries in
// routes_admin.js's Analytics endpoints. The per-streamer drill-down
// (GET /api/admin/analytics/:userId) is untouched, so an excluded account's
// own data is still viewable by navigating to it directly.
export const ANALYTICS_EXCLUDED_CHANNEL_IDS = ["1198505560", "74034487"];
