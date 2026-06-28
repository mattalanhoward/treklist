// Client feature flags.
//
// SHOW_COMMUNITY: the community/forum feature is hidden while the app is
// dormant (low usage, stale posts look worse as they age). The routes,
// components and API remain intact — flip this back to `true` to re-expose
// the sidebar entry points and onboarding tour step.
export const SHOW_COMMUNITY = false;
